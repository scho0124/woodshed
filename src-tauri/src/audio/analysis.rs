//! Turns a mono sample stream into events for the UI: periodic frames for
//! meters and the tuner, onsets (pick/strum attacks), and notes once their
//! pitch has settled. Picked notes are found from the attack; legato notes
//! (hammer-ons, pull-offs, slides) from a pitch that jumps and then holds.

use super::pitch::{Pitch, PitchDetector};
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum InstrumentRange {
    Guitar,
    Bass,
    /// Singing: low bass voices up to soprano highs.
    Voice,
}

impl InstrumentRange {
    /// The window must hold at least two periods of the lowest note: 43 ms is
    /// enough for guitar down to drop B, bass needs 85 ms for a low B.
    fn window_secs(self) -> f64 {
        match self {
            InstrumentRange::Guitar | InstrumentRange::Voice => 2048.0 / 48_000.0,
            InstrumentRange::Bass => 4096.0 / 48_000.0,
        }
    }

    fn hz_range(self) -> (f32, f32) {
        match self {
            InstrumentRange::Guitar => (55.0, 1400.0),
            InstrumentRange::Bass => (28.0, 450.0),
            InstrumentRange::Voice => (60.0, 1200.0),
        }
    }
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum AudioEvent {
    /// Periodic reading for meters and the tuner, about 47 per second.
    Frame {
        t: f64,
        hz: Option<f32>,
        clarity: f32,
        level_db: f32,
        clipping: bool,
    },
    /// A pick or strum attack.
    Onset { t: f64 },
    /// A note whose pitch has settled. For picked notes `t` is the onset time,
    /// so it can be matched to its `Onset`; for legato notes it is when the new
    /// pitch was first heard.
    Note { t: f64, hz: f32, legato: bool },
    /// Capture stopped because of an error, e.g. the cable was unplugged.
    Error { message: String },
}

/// Analysis step: ~5 ms at 48 kHz, which sets the onset timing resolution.
const HOP: usize = 256;
const FRAME_EVERY_HOPS: u32 = 4;
const MIN_CLARITY: f32 = 0.8;
const CLIP_LEVEL: f32 = 0.98;

const ONSET_RISE_DB: f32 = 6.0;
const ONSET_LOOKBACK_HOPS: usize = 6;
const ONSET_REFRACTORY_SECS: f64 = 0.06;

/// Pitch is unreliable during the pick attack, so readings start a little after it.
const ATTACK_SKIP_SECS: f64 = 0.005;
const SETTLE_READINGS: usize = 3;
const SETTLE_SPREAD_CENTS: f32 = 35.0;
/// A strum that never settles on one pitch (a chord, a muted scratch) gives up after this.
const SETTLE_TIMEOUT_SECS: f64 = 0.15;

/// Vibrato stays well inside this; a hammer-on or slide to the next fret doesn't.
const LEGATO_JUMP_CENTS: f32 = 70.0;
const LEGATO_READINGS: usize = 6;
const LEGATO_SPREAD_CENTS: f32 = 25.0;

/// A note that starts without a detectable attack (soft hammer-on from silence,
/// or an attack the onset detector missed) must hold this long and this loud.
const UNPICKED_READINGS: usize = 8;
const UNPICKED_ABOVE_GATE_DB: f32 = 6.0;

enum Track {
    Idle,
    Settling { onset: u64, readings: Vec<f32> },
    /// `hz` is None after a strum with no single clear pitch; no notes are
    /// reported until the next attack, so a ringing chord can't produce stray notes.
    Sounding { hz: Option<f32>, candidates: VecDeque<(f64, f32)> },
}

pub struct Analyzer {
    sample_rate: u32,
    window: usize,
    gate_db: f32,
    detector: PitchDetector,
    history: Vec<f32>,
    hop: Vec<f32>,
    /// Samples consumed so far; the history ends at this sample.
    samples: u64,
    recent_levels: VecDeque<f32>,
    last_onset: Option<u64>,
    track: Track,
    unpicked: VecDeque<f32>,
    hops_since_frame: u32,
    meter_level: f32,
    meter_clipping: bool,
}

fn cents(a: f32, b: f32) -> f32 {
    1200.0 * (a / b).log2()
}

fn median(values: impl Iterator<Item = f32>) -> f32 {
    let mut v: Vec<f32> = values.collect();
    v.sort_by(|a, b| a.total_cmp(b));
    v[v.len() / 2]
}

fn all_within(values: impl Iterator<Item = f32>, center: f32, spread: f32) -> bool {
    values.into_iter().all(|v| cents(v, center).abs() <= spread)
}

impl Analyzer {
    pub fn new(sample_rate: u32, range: InstrumentRange, gate_db: f32) -> Self {
        let window = ((range.window_secs() * sample_rate as f64).round() as usize).next_multiple_of(HOP);
        let (min_hz, max_hz) = range.hz_range();
        Self {
            sample_rate,
            window,
            gate_db,
            detector: PitchDetector::new(window, sample_rate, min_hz, max_hz),
            history: vec![0.0; window],
            hop: Vec::with_capacity(HOP),
            samples: 0,
            recent_levels: VecDeque::with_capacity(ONSET_LOOKBACK_HOPS + 1),
            last_onset: None,
            track: Track::Idle,
            unpicked: VecDeque::with_capacity(UNPICKED_READINGS + 1),
            hops_since_frame: 0,
            meter_level: f32::NEG_INFINITY,
            meter_clipping: false,
        }
    }

    pub fn push(&mut self, input: &[f32], out: &mut Vec<AudioEvent>) {
        for &x in input {
            self.hop.push(x);
            if self.hop.len() == HOP {
                self.process_hop(out);
                self.hop.clear();
            }
        }
    }

    fn secs(&self, sample: u64) -> f64 {
        sample as f64 / self.sample_rate as f64
    }

    fn samples_for(&self, secs: f64) -> u64 {
        (secs * self.sample_rate as f64) as u64
    }

    fn process_hop(&mut self, out: &mut Vec<AudioEvent>) {
        let rms = (self.hop.iter().map(|x| x * x).sum::<f32>() / HOP as f32).sqrt();
        let level_db = 20.0 * (rms + 1e-9).log10();
        let clipping = self.hop.iter().any(|x| x.abs() >= CLIP_LEVEL);

        let w = self.window;
        self.history.copy_within(HOP.., 0);
        self.history[w - HOP..].copy_from_slice(&self.hop);
        let hop_start = self.samples;
        self.samples += HOP as u64;

        // Onset: a sharp rise over the quietest of the last few hops, above the gate.
        let floor = self.recent_levels.iter().copied().fold(f32::INFINITY, f32::min);
        let rested = self
            .last_onset
            .is_none_or(|s| self.secs(hop_start) - self.secs(s) >= ONSET_REFRACTORY_SECS);
        let onset = level_db >= self.gate_db && rested && level_db - floor >= ONSET_RISE_DB;
        self.recent_levels.push_back(level_db);
        if self.recent_levels.len() > ONSET_LOOKBACK_HOPS {
            self.recent_levels.pop_front();
        }
        if onset {
            self.last_onset = Some(hop_start);
            out.push(AudioEvent::Onset { t: self.secs(hop_start) });
        }

        let reading: Option<Pitch> = if self.samples >= w as u64 && level_db >= self.gate_db {
            self.detector.detect(&self.history).filter(|p| p.clarity >= MIN_CLARITY)
        } else {
            None
        };

        self.track_notes(onset.then_some(hop_start), level_db, reading.map(|p| p.hz), out);

        self.meter_level = self.meter_level.max(level_db);
        self.meter_clipping |= clipping;
        self.hops_since_frame += 1;
        if self.hops_since_frame >= FRAME_EVERY_HOPS {
            out.push(AudioEvent::Frame {
                t: self.secs(self.samples),
                hz: reading.map(|p| p.hz),
                clarity: reading.map_or(0.0, |p| p.clarity),
                level_db: self.meter_level.max(-120.0),
                clipping: self.meter_clipping,
            });
            self.hops_since_frame = 0;
            self.meter_level = f32::NEG_INFINITY;
            self.meter_clipping = false;
        }
    }

    fn track_notes(&mut self, onset: Option<u64>, level_db: f32, reading: Option<f32>, out: &mut Vec<AudioEvent>) {
        if let Some(onset) = onset {
            self.track = Track::Settling { onset, readings: Vec::with_capacity(SETTLE_READINGS + 1) };
            self.unpicked.clear();
        } else if level_db < self.gate_db {
            self.track = Track::Idle;
            self.unpicked.clear();
            return;
        }

        let now = self.secs(self.samples);
        let window_start = self.samples.saturating_sub(self.window as u64);
        let attack_skip = self.samples_for(ATTACK_SKIP_SECS);
        let settle_timeout = self.samples_for(SETTLE_TIMEOUT_SECS);
        let sr = self.sample_rate as f64;

        match &mut self.track {
            Track::Settling { onset, readings } => {
                let onset = *onset;
                if window_start < onset + attack_skip {
                    return;
                }
                if let Some(hz) = reading {
                    readings.push(hz);
                    if readings.len() > SETTLE_READINGS {
                        readings.remove(0);
                    }
                    if readings.len() == SETTLE_READINGS {
                        let m = median(readings.iter().copied());
                        if all_within(readings.iter().copied(), m, SETTLE_SPREAD_CENTS) {
                            out.push(AudioEvent::Note { t: onset as f64 / sr, hz: m, legato: false });
                            self.track = Track::Sounding { hz: Some(m), candidates: VecDeque::new() };
                            return;
                        }
                    }
                }
                if window_start > onset + attack_skip + settle_timeout {
                    self.track = Track::Sounding { hz: None, candidates: VecDeque::new() };
                }
            }
            Track::Sounding { hz: Some(current), candidates } => {
                let Some(r) = reading else { return };
                if cents(r, *current).abs() < LEGATO_JUMP_CENTS {
                    candidates.clear();
                    return;
                }
                candidates.push_back((now, r));
                if candidates.len() > LEGATO_READINGS {
                    candidates.pop_front();
                }
                if candidates.len() == LEGATO_READINGS {
                    let m = median(candidates.iter().map(|c| c.1));
                    if all_within(candidates.iter().map(|c| c.1), m, LEGATO_SPREAD_CENTS) {
                        out.push(AudioEvent::Note { t: candidates[0].0, hz: m, legato: true });
                        *current = m;
                        candidates.clear();
                    }
                }
            }
            Track::Sounding { hz: None, .. } => {}
            Track::Idle => match reading {
                Some(r) if level_db >= self.gate_db + UNPICKED_ABOVE_GATE_DB => {
                    self.unpicked.push_back(r);
                    if self.unpicked.len() > UNPICKED_READINGS {
                        self.unpicked.pop_front();
                    }
                    if self.unpicked.len() == UNPICKED_READINGS {
                        let m = median(self.unpicked.iter().copied());
                        if all_within(self.unpicked.iter().copied(), m, LEGATO_SPREAD_CENTS) {
                            out.push(AudioEvent::Note { t: now, hz: m, legato: true });
                            self.track = Track::Sounding { hz: Some(m), candidates: VecDeque::new() };
                            self.unpicked.clear();
                        }
                    }
                }
                _ => self.unpicked.clear(),
            },
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::audio::synth;

    const SR: u32 = 48_000;
    const GATE: f32 = -55.0;

    fn run(range: InstrumentRange, signal: &[f32]) -> Vec<AudioEvent> {
        let mut a = Analyzer::new(SR, range, GATE);
        let mut out = Vec::new();
        // Feed in uneven chunks, like a real audio callback.
        for chunk in signal.chunks(441) {
            a.push(chunk, &mut out);
        }
        out
    }

    fn onsets(events: &[AudioEvent]) -> Vec<f64> {
        events.iter().filter_map(|e| match e { AudioEvent::Onset { t } => Some(*t), _ => None }).collect()
    }

    fn notes(events: &[AudioEvent]) -> Vec<(f64, f32, bool)> {
        events
            .iter()
            .filter_map(|e| match e { AudioEvent::Note { t, hz, legato } => Some((*t, *hz, *legato)), _ => None })
            .collect()
    }

    fn secs(s: f32) -> usize {
        (s * SR as f32) as usize
    }

    #[test]
    fn repeated_and_new_plucks_each_give_one_onset_and_note() {
        let mut signal = vec![0.0; secs(0.2)];
        let (e2, e2_hz) = synth::pluck(82.41, SR, secs(0.5), 1);
        let (e2b, _) = synth::pluck(82.41, SR, secs(0.5), 2);
        let (a2, a2_hz) = synth::pluck(110.0, SR, secs(0.5), 3);
        signal.extend(&e2);
        signal.extend(&e2b);
        signal.extend(&a2);

        let events = run(InstrumentRange::Guitar, &signal);
        let on = onsets(&events);
        assert_eq!(on.len(), 3, "onsets at {on:?}");
        for (t, expected) in on.iter().zip([0.2, 0.7, 1.2]) {
            assert!((t - expected).abs() < 0.012, "onset at {t}, expected {expected}");
        }

        let n = notes(&events);
        assert_eq!(n.len(), 3, "notes: {n:?}");
        for ((t, hz, legato), (expected_t, expected_hz)) in n.iter().zip([(on[0], e2_hz), (on[1], e2_hz), (on[2], a2_hz)]) {
            assert_eq!(*t, expected_t);
            assert!(cents(*hz, expected_hz).abs() < 3.0, "{hz} vs {expected_hz}");
            assert!(!legato);
        }
    }

    #[test]
    fn fast_repeated_picking_is_counted_note_by_note() {
        // Eight picks of the same note 150 ms apart (16ths at 100 bpm).
        let mut signal = vec![0.0; secs(0.1)];
        let mut expected_hz = 0.0;
        for i in 0..8 {
            let (pick, hz) = synth::pluck(82.41, SR, secs(0.15), 20 + i);
            signal.extend(&pick);
            expected_hz = hz;
        }
        let events = run(InstrumentRange::Guitar, &signal);
        assert_eq!(onsets(&events).len(), 8, "onsets at {:?}", onsets(&events));
        let n = notes(&events);
        assert_eq!(n.len(), 8, "notes: {n:?}");
        assert!(n.iter().all(|(_, hz, legato)| cents(*hz, expected_hz).abs() < 3.0 && !legato));
    }

    #[test]
    fn a_strum_is_one_onset_and_no_stray_notes() {
        // Three strings struck 12 ms apart, ringing together.
        let len = secs(0.8);
        let mut signal = vec![0.0; secs(0.1) + len];
        for (k, hz) in [82.41, 123.47, 164.81].into_iter().enumerate() {
            let (s, _) = synth::pluck(hz, SR, len, 30 + k as u32);
            let offset = secs(0.1) + k * secs(0.012);
            for (i, x) in s.iter().enumerate().take(signal.len() - offset) {
                signal[offset + i] += x / 2.0;
            }
        }
        let events = run(InstrumentRange::Guitar, &signal);
        assert_eq!(onsets(&events).len(), 1, "onsets at {:?}", onsets(&events));
        let n = notes(&events);
        assert!(n.len() <= 1, "a ringing chord produced notes: {n:?}");
        assert!(n.iter().all(|(_, _, legato)| !legato));
    }

    #[test]
    fn hammer_on_is_a_legato_note_without_a_new_onset() {
        let amps = [1.0, 0.6, 0.4, 0.25];
        let mut freqs = vec![196.0; secs(0.4)];
        freqs.extend(vec![220.0; secs(0.4)]);
        let mut signal = vec![0.0; secs(0.1)];
        signal.extend(synth::glide(&freqs, SR, &amps, 0.3));

        let events = run(InstrumentRange::Guitar, &signal);
        assert_eq!(onsets(&events).len(), 1);
        let n = notes(&events);
        assert_eq!(n.len(), 2, "notes: {n:?}");
        assert!(cents(n[0].1, 196.0).abs() < 3.0 && !n[0].2);
        assert!(cents(n[1].1, 220.0).abs() < 3.0 && n[1].2);
        assert!((n[1].0 - 0.5).abs() < 0.08, "legato note at {}", n[1].0);
    }

    #[test]
    fn vibrato_does_not_create_extra_notes() {
        let freqs: Vec<f32> = (0..secs(0.8))
            .map(|i| {
                let t = i as f32 / SR as f32;
                196.0 * 2f32.powf(20.0 * (std::f32::consts::TAU * 5.0 * t).sin() / 1200.0)
            })
            .collect();
        let mut signal = vec![0.0; secs(0.1)];
        signal.extend(synth::glide(&freqs, SR, &[1.0, 0.5, 0.3], 0.3));

        let events = run(InstrumentRange::Guitar, &signal);
        assert_eq!(notes(&events).len(), 1, "notes: {:?}", notes(&events));
    }

    #[test]
    fn low_bass_notes_are_detected() {
        let mut signal = vec![0.0; secs(0.1)];
        let (b0, b0_hz) = synth::pluck(30.87, SR, secs(0.8), 5);
        signal.extend(&b0);

        let n = notes(&run(InstrumentRange::Bass, &signal));
        assert_eq!(n.len(), 1, "notes: {n:?}");
        assert!(cents(n[0].1, b0_hz).abs() < 3.0, "{} vs {b0_hz}", n[0].1);
    }

    #[test]
    fn noise_below_the_gate_is_silence() {
        let signal = synth::noise(secs(1.0), 0.0005, 9);
        let events = run(InstrumentRange::Guitar, &signal);
        assert!(onsets(&events).is_empty());
        assert!(notes(&events).is_empty());
        assert!(events.iter().all(|e| !matches!(e, AudioEvent::Frame { hz: Some(_), .. })));
    }

    #[test]
    fn frames_report_level_and_clipping() {
        let signal = synth::sine(220.0, SR, secs(0.3), 1.0);
        let events = run(InstrumentRange::Guitar, &signal);
        let frames: Vec<_> = events.iter().filter(|e| matches!(e, AudioEvent::Frame { .. })).collect();
        let expected = secs(0.3) / (HOP * FRAME_EVERY_HOPS as usize);
        assert!(frames.len() >= expected - 1 && frames.len() <= expected + 1);
        assert!(frames.iter().any(|e| matches!(e, AudioEvent::Frame { clipping: true, .. })));
        assert!(frames.iter().any(|e| matches!(e, AudioEvent::Frame { hz: Some(hz), .. } if cents(*hz, 220.0).abs() < 1.0)));
    }

    #[test]
    fn voice_range_hears_low_and_high_singing() {
        for hz in [98.0, 440.0, 880.0] {
            let signal = synth::harmonics(hz, SR, secs(0.5), &[0.5, 0.25, 0.12]);
            let heard: Vec<f32> = run(InstrumentRange::Voice, &signal)
                .iter()
                .filter_map(|e| match e { AudioEvent::Frame { hz: Some(h), .. } => Some(*h), _ => None })
                .collect();
            assert!(heard.len() > 10, "{hz} Hz: only {} pitched frames", heard.len());
            assert!(heard.iter().all(|h| cents(*h, hz).abs() < 15.0), "{hz} Hz heard as {heard:?}");
        }
    }
}
