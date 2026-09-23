//! Synthetic test signals: sines, harmonic tones, Karplus-Strong plucked
//! strings, and noise. Test-only; the app never generates audio.

use std::f32::consts::TAU;

/// Deterministic white noise in -amp..amp (xorshift, so tests are repeatable).
pub fn noise(len: usize, amp: f32, seed: u32) -> Vec<f32> {
    let mut state = seed.max(1);
    (0..len)
        .map(|_| {
            state ^= state << 13;
            state ^= state >> 17;
            state ^= state << 5;
            (state as f32 / u32::MAX as f32 * 2.0 - 1.0) * amp
        })
        .collect()
}

pub fn sine(hz: f32, sr: u32, len: usize, amp: f32) -> Vec<f32> {
    (0..len).map(|i| (TAU * hz * i as f32 / sr as f32).sin() * amp).collect()
}

/// Fundamental plus overtones with the given amplitudes (index 0 = fundamental).
pub fn harmonics(hz: f32, sr: u32, len: usize, amps: &[f32]) -> Vec<f32> {
    glide(&vec![hz; len], sr, amps, 0.3)
}

/// Continuous-phase harmonic tone following a per-sample frequency track, so
/// pitch can change without any new attack (legato, vibrato, bends).
pub fn glide(freqs: &[f32], sr: u32, amps: &[f32], level: f32) -> Vec<f32> {
    let total: f32 = amps.iter().sum();
    let mut phase = 0.0f32;
    freqs
        .iter()
        .map(|&f| {
            phase = (phase + TAU * f / sr as f32) % (TAU * 64.0);
            let s: f32 = amps
                .iter()
                .enumerate()
                .map(|(k, a)| a * (phase * (k + 1) as f32).sin())
                .sum();
            s / total * level
        })
        .collect()
}

/// Karplus-Strong plucked string. Returns the samples and the frequency the
/// loop actually produces, which differs slightly from `target` because the
/// delay line is a whole number of samples. Each output feeds back as the
/// average of itself and the following sample, so y[n] = (y[n-L] + y[n-L+1]) / 2
/// and the loop delay is L - 0.5 samples.
pub fn pluck(target: f32, sr: u32, len: usize, seed: u32) -> (Vec<f32>, f32) {
    let delay = ((sr as f32 / target) + 0.5).round() as usize;
    let actual = sr as f32 / (delay as f32 - 0.5);
    let mut line = noise(delay, 0.5, seed);
    let mut out = Vec::with_capacity(len);
    let mut i = 0;
    for _ in 0..len {
        let next = (i + 1) % delay;
        let y = line[i];
        line[i] = 0.996 * 0.5 * (line[i] + line[next]);
        out.push(y);
        i = next;
    }
    (out, actual)
}
