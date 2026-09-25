use cpal::traits::{DeviceTrait, HostTrait};
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct AudioInputInfo {
    pub id: String,
    pub name: String,
    pub channels: u16,
    pub sample_rate: u32,
    pub is_default: bool,
    /// Looks like a guitar interface (Rocksmith Real Tone Cable, Hi-Z inputs...).
    pub likely_instrument: bool,
    /// Connected over USB, going by its name or id.
    pub likely_usb: bool,
}

const INSTRUMENT_HINTS: &[&str] = &["rocksmith", "real tone", "realtone", "guitar", "instrument", "hi-z"];

fn looks_like_instrument(name: &str, id: &str) -> bool {
    let text = format!("{name} {id}").to_lowercase();
    INSTRUMENT_HINTS.iter().any(|h| text.contains(h))
}

fn looks_like_usb(name: &str, id: &str) -> bool {
    format!("{name} {id}").to_lowercase().contains("usb")
}

/// PulseAudio lists each output's loopback ("Monitor of ...") as a source too.
fn is_monitor(id: &str) -> bool {
    id.ends_with(".monitor")
}

fn display_name(device: &cpal::Device, id: &cpal::DeviceId) -> String {
    device
        .description()
        .map(|d| d.name().to_string())
        .unwrap_or_else(|_| id.id().to_string())
}

/// Audio inputs, guitar interfaces first, then USB devices, then the system default.
pub fn list_inputs() -> Result<Vec<AudioInputInfo>, String> {
    let host = cpal::default_host();
    let default_id = host.default_input_device().and_then(|d| d.id().ok());
    let mut inputs: Vec<AudioInputInfo> = host
        .input_devices()
        .map_err(|e| format!("Couldn't list audio inputs: {e}"))?
        .filter_map(|device| {
            let id = device.id().ok()?;
            let id_str = id.to_string();
            if is_monitor(&id_str) {
                return None;
            }
            let config = device.default_input_config().ok()?;
            let name = display_name(&device, &id);
            Some(AudioInputInfo {
                likely_instrument: looks_like_instrument(&name, &id_str),
                likely_usb: looks_like_usb(&name, &id_str),
                is_default: default_id.as_ref() == Some(&id),
                id: id_str,
                name,
                channels: config.channels(),
                sample_rate: config.sample_rate(),
            })
        })
        .collect();
    inputs.sort_by_key(|i| (!i.likely_instrument, !i.likely_usb, !i.is_default));
    Ok(inputs)
}

fn device_by_id(host: cpal::Host, raw: &str) -> Result<cpal::Device, String> {
    let id: cpal::DeviceId = raw.parse().map_err(|_| format!("Unrecognized audio input id: {raw}"))?;
    let host = if id.host() == host.id() {
        host
    } else {
        cpal::host_from_id(id.host()).map_err(|e| e.to_string())?
    };
    host.device_by_id(&id).ok_or_else(|| {
        "The selected audio input isn't connected. Plug it in, or choose another input in audio settings."
            .to_string()
    })
}

/// The saved input, or when none is saved, a guitar interface if one is
/// plugged in, else the system default input.
pub fn find_input(device_id: Option<&str>) -> Result<cpal::Device, String> {
    let host = cpal::default_host();
    if let Some(raw) = device_id {
        return device_by_id(host, raw);
    }

    let inputs = host.input_devices().map_err(|e| format!("Couldn't list audio inputs: {e}"))?;
    for device in inputs {
        let Ok(id) = device.id() else { continue };
        let id_str = id.to_string();
        if !is_monitor(&id_str) && looks_like_instrument(&display_name(&device, &id), &id_str) {
            return Ok(device);
        }
    }
    host.default_input_device().ok_or_else(|| "No audio input found.".to_string())
}

/// The saved mic, or when none is saved, a USB mic, else the system default
/// input, skipping guitar interfaces either way.
pub fn find_voice_input(device_id: Option<&str>) -> Result<cpal::Device, String> {
    let host = cpal::default_host();
    if let Some(raw) = device_id {
        return device_by_id(host, raw);
    }
    let default_id = host.default_input_device().and_then(|d| d.id().ok());
    let mut mics: Vec<(bool, bool, cpal::Device)> = host
        .input_devices()
        .map_err(|e| format!("Couldn't list audio inputs: {e}"))?
        .filter_map(|device| {
            let id = device.id().ok()?;
            let id_str = id.to_string();
            let name = display_name(&device, &id);
            if is_monitor(&id_str) || looks_like_instrument(&name, &id_str) {
                return None;
            }
            Some((looks_like_usb(&name, &id_str), default_id.as_ref() == Some(&id), device))
        })
        .collect();
    mics.sort_by_key(|(usb, default, _)| (!usb, !default));
    mics.into_iter()
        .next()
        .map(|(_, _, device)| device)
        .ok_or_else(|| "No microphone found. Plug in a mic, ideally a USB one, and try again.".to_string())
}
