//! Owns the one active capture. The audio callback only downmixes and copies
//! samples into a lock-free ring buffer; a separate thread runs the analysis
//! and sends events to the UI. Samples are never written anywhere else.

use super::analysis::{Analyzer, AudioEvent, InstrumentRange};
use super::devices;
use super::settings::AudioSettings;
use cpal::traits::{DeviceTrait, StreamTrait};
use cpal::{FromSample, SampleFormat, SizedSample};
use serde::Serialize;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{mpsc, Arc, Mutex};
use std::thread::JoinHandle;
use std::time::Duration;
use tauri::ipc::Channel;

#[derive(Debug, Clone, Serialize)]
pub struct StartedInput {
    /// Pass back to `stop_audio_input` so a late stop can't end a newer capture.
    pub session: u64,
    pub device_name: String,
    pub sample_rate: u32,
    pub channels: u16,
}

struct Active {
    session: u64,
    stop: Arc<AtomicBool>,
    thread: JoinHandle<()>,
}

#[derive(Default)]
pub struct AudioState {
    active: Mutex<Option<Active>>,
    /// Held for the whole of `start` so two starts can't both think they own the input.
    starting: Mutex<()>,
    next_session: AtomicU64,
}

type Failure = Arc<Mutex<Option<String>>>;

impl AudioState {
    /// Replaces any running capture with a new one on the configured input.
    pub fn start(
        &self,
        settings: AudioSettings,
        range: InstrumentRange,
        events: Channel<AudioEvent>,
    ) -> Result<StartedInput, String> {
        let _starting = self.starting.lock().unwrap_or_else(|e| e.into_inner());
        self.stop(None);

        let session = self.next_session.fetch_add(1, Ordering::Relaxed) + 1;
        let stop = Arc::new(AtomicBool::new(false));
        let (ready_tx, ready_rx) = mpsc::sync_channel(1);
        let thread_stop = stop.clone();
        let thread = std::thread::Builder::new()
            .name("woodshed-audio".into())
            .spawn(move || run_capture(session, settings, range, events, thread_stop, ready_tx))
            .map_err(|e| e.to_string())?;

        match ready_rx.recv_timeout(Duration::from_secs(10)) {
            Ok(Ok(started)) => {
                *self.active.lock().unwrap_or_else(|e| e.into_inner()) = Some(Active { session, stop, thread });
                Ok(started)
            }
            Ok(Err(message)) => {
                let _ = thread.join();
                Err(message)
            }
            Err(_) => {
                stop.store(true, Ordering::Relaxed);
                Err("The audio input didn't respond. Check the cable and try again.".into())
            }
        }
    }

    /// Stops capture. With a session id, only stops if that session is still the active one.
    pub fn stop(&self, session: Option<u64>) {
        let active = {
            let mut guard = self.active.lock().unwrap_or_else(|e| e.into_inner());
            match (guard.as_ref(), session) {
                (Some(a), Some(s)) if a.session != s => None,
                _ => guard.take(),
            }
        };
        if let Some(a) = active {
            a.stop.store(true, Ordering::Relaxed);
            let _ = a.thread.join();
        }
    }
}

fn run_capture(
    session: u64,
    settings: AudioSettings,
    range: InstrumentRange,
    events: Channel<AudioEvent>,
    stop: Arc<AtomicBool>,
    ready: mpsc::SyncSender<Result<StartedInput, String>>,
) {
    let (stream, mut samples, started, failure) = match open_stream(session, &settings, range) {
        Ok(opened) => opened,
        Err(message) => {
            let _ = ready.send(Err(message));
            return;
        }
    };
    if let Err(e) = stream.play() {
        let _ = ready.send(Err(format!("Couldn't start the audio input: {e}")));
        return;
    }
    let mut analyzer = Analyzer::new(started.sample_rate, range, settings.gate_db);
    let _ = ready.send(Ok(started));

    let mut buf = Vec::with_capacity(8192);
    let mut out = Vec::with_capacity(64);
    while !stop.load(Ordering::Relaxed) {
        if let Some(message) = failure.lock().ok().and_then(|mut f| f.take()) {
            let _ = events.send(AudioEvent::Error { message });
            break;
        }
        let available = samples.slots();
        if available == 0 {
            std::thread::sleep(Duration::from_millis(3));
            continue;
        }
        if let Ok(chunk) = samples.read_chunk(available) {
            buf.clear();
            let (a, b) = chunk.as_slices();
            buf.extend_from_slice(a);
            buf.extend_from_slice(b);
            chunk.commit_all();
        }
        analyzer.push(&buf, &mut out);
        for event in out.drain(..) {
            if events.send(event).is_err() {
                return; // the page that asked for audio is gone
            }
        }
    }
    drop(stream);
}

fn open_stream(
    session: u64,
    settings: &AudioSettings,
    range: InstrumentRange,
) -> Result<(cpal::Stream, rtrb::Consumer<f32>, StartedInput, Failure), String> {
    let voice = range == InstrumentRange::Voice;
    let device = if voice {
        devices::find_voice_input(settings.voice_device_id.as_deref())?
    } else {
        devices::find_input(settings.device_id.as_deref())?
    };
    let device_name = device
        .description()
        .map(|d| d.name().to_string())
        .unwrap_or_else(|_| "Audio input".to_string());
    let config = device
        .default_input_config()
        .map_err(|e| format!("Couldn't read the input's audio format: {e}"))?;

    let channels = config.channels() as usize;
    // The channel setting belongs to the guitar input; a mic is mixed down.
    let pick = if voice { None } else { settings.channel.map(usize::from).filter(|&c| c < channels) };
    // One second of headroom in case the analysis thread falls behind.
    let (producer, consumer) = rtrb::RingBuffer::<f32>::new(config.sample_rate() as usize);
    let failure: Failure = Arc::new(Mutex::new(None));
    let stream_config = config.config();

    let stream = match config.sample_format() {
        SampleFormat::F32 => build::<f32>(&device, stream_config, channels, pick, producer, failure.clone()),
        SampleFormat::I16 => build::<i16>(&device, stream_config, channels, pick, producer, failure.clone()),
        SampleFormat::I32 => build::<i32>(&device, stream_config, channels, pick, producer, failure.clone()),
        SampleFormat::U16 => build::<u16>(&device, stream_config, channels, pick, producer, failure.clone()),
        SampleFormat::U8 => build::<u8>(&device, stream_config, channels, pick, producer, failure.clone()),
        SampleFormat::F64 => build::<f64>(&device, stream_config, channels, pick, producer, failure.clone()),
        other => Err(format!("The input uses an unsupported sample format ({other}).")),
    }?;

    let started = StartedInput {
        session,
        device_name,
        sample_rate: config.sample_rate(),
        channels: config.channels(),
    };
    Ok((stream, consumer, started, failure))
}

fn build<T>(
    device: &cpal::Device,
    config: cpal::StreamConfig,
    channels: usize,
    pick: Option<usize>,
    mut producer: rtrb::Producer<f32>,
    failure: Failure,
) -> Result<cpal::Stream, String>
where
    T: SizedSample,
    f32: FromSample<T>,
{
    device
        .build_input_stream::<T, _, _>(
            config,
            move |data: &[T], _| {
                for frame in data.chunks(channels) {
                    let x = match pick {
                        Some(c) => f32::from_sample_(frame[c]),
                        None => frame.iter().map(|&s| f32::from_sample_(s)).sum::<f32>() / frame.len() as f32,
                    };
                    // If the analysis thread fell a full second behind, drop samples
                    // rather than block the real-time audio thread.
                    if producer.push(x).is_err() {
                        break;
                    }
                }
            },
            move |err| {
                if let Ok(mut f) = failure.lock() {
                    f.get_or_insert_with(|| format!("The audio input stopped: {err}"));
                }
            },
            Some(Duration::from_secs(5)),
        )
        .map_err(|e| format!("Couldn't open the audio input: {e}"))
}
