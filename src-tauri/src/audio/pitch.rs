//! McLeod Pitch Method (McLeod & Wyvill, "A Smarter Way to Find Pitch", 2005).
//!
//! The normalized square difference function (NSDF) is computed with an FFT
//! autocorrelation. The pitch is the first "key maximum" (the highest point of
//! each positive NSDF region) that reaches `KEY_MAX_THRESHOLD` of the highest
//! key maximum, which is what keeps it on the fundamental instead of jumping to
//! a strong harmonic. Lags outside the instrument's range are never considered.

use realfft::num_complex::Complex;
use realfft::{ComplexToReal, RealFftPlanner, RealToComplex};
use std::sync::Arc;

const KEY_MAX_THRESHOLD: f32 = 0.9;

#[derive(Debug, Clone, Copy)]
pub struct Pitch {
    pub hz: f32,
    /// Height of the chosen NSDF peak, 0..=1. Close to 1 for a clean periodic tone.
    pub clarity: f32,
}

pub struct PitchDetector {
    size: usize,
    sample_rate: f32,
    min_lag: usize,
    max_lag: usize,
    fft: Arc<dyn RealToComplex<f32>>,
    ifft: Arc<dyn ComplexToReal<f32>>,
    time: Vec<f32>,
    spectrum: Vec<Complex<f32>>,
    scratch_fwd: Vec<Complex<f32>>,
    scratch_inv: Vec<Complex<f32>>,
    nsdf: Vec<f32>,
    peaks: Vec<(usize, f32)>,
}

impl PitchDetector {
    /// `size` is the analysis window in samples. It must hold at least two
    /// periods of `min_hz`, so the longest usable lag is `size / 2`.
    pub fn new(size: usize, sample_rate: u32, min_hz: f32, max_hz: f32) -> Self {
        let sample_rate = sample_rate as f32;
        let mut planner = RealFftPlanner::<f32>::new();
        let fft = planner.plan_fft_forward(size * 2);
        let ifft = planner.plan_fft_inverse(size * 2);
        let spectrum = fft.make_output_vec();
        let scratch_fwd = fft.make_scratch_vec();
        let scratch_inv = ifft.make_scratch_vec();
        Self {
            size,
            sample_rate,
            min_lag: ((sample_rate / max_hz).floor() as usize).max(2),
            max_lag: ((sample_rate / min_hz).ceil() as usize).min(size / 2),
            fft,
            ifft,
            time: vec![0.0; size * 2],
            spectrum,
            scratch_fwd,
            scratch_inv,
            nsdf: vec![0.0; size],
            peaks: Vec::with_capacity(64),
        }
    }

    pub fn detect(&mut self, signal: &[f32]) -> Option<Pitch> {
        let n = self.size;
        assert_eq!(signal.len(), n, "signal must match the detector window");

        // Linear (not circular) autocorrelation: zero-pad to 2n, |FFT|^2, inverse FFT.
        self.time[..n].copy_from_slice(signal);
        self.time[n..].fill(0.0);
        self.fft
            .process_with_scratch(&mut self.time, &mut self.spectrum, &mut self.scratch_fwd)
            .ok()?;
        for c in self.spectrum.iter_mut() {
            *c = Complex::new(c.norm_sqr(), 0.0);
        }
        self.ifft
            .process_with_scratch(&mut self.spectrum, &mut self.time, &mut self.scratch_inv)
            .ok()?;
        let fft_scale = 1.0 / (2 * n) as f32;

        // m'(tau) = sum over the overlap of x_j^2 + x_{j+tau}^2, updated incrementally.
        let mut m: f32 = 2.0 * signal.iter().map(|x| x * x).sum::<f32>();
        if m <= 1e-10 {
            return None;
        }
        for tau in 0..n {
            if tau > 0 {
                m -= signal[tau - 1] * signal[tau - 1] + signal[n - tau] * signal[n - tau];
            }
            self.nsdf[tau] = if m > 1e-10 { 2.0 * self.time[tau] * fft_scale / m } else { 0.0 };
        }

        // Key maxima: skip the lobe around lag 0, then take the top of each positive region.
        self.peaks.clear();
        let limit = (self.max_lag + 2).min(n - 1);
        let mut tau = 1;
        while tau < limit && self.nsdf[tau] > 0.0 {
            tau += 1;
        }
        while tau < limit {
            while tau < limit && self.nsdf[tau] <= 0.0 {
                tau += 1;
            }
            let mut best = tau;
            while tau < limit && self.nsdf[tau] > 0.0 {
                if self.nsdf[tau] > self.nsdf[best] {
                    best = tau;
                }
                tau += 1;
            }
            // A region cut off by `limit` has no confirmed peak inside the range.
            let cut_off = tau >= limit && best + 1 >= limit;
            if !cut_off && best >= self.min_lag && best <= self.max_lag {
                self.peaks.push((best, self.nsdf[best]));
            }
        }

        let highest = self.peaks.iter().map(|p| p.1).fold(0.0f32, f32::max);
        if highest <= 0.0 {
            return None;
        }
        let &(idx, _) = self.peaks.iter().find(|p| p.1 >= KEY_MAX_THRESHOLD * highest)?;

        // Parabolic interpolation through the peak and its neighbours.
        let (y0, y1, y2) = (self.nsdf[idx - 1], self.nsdf[idx], self.nsdf[idx + 1]);
        let denom = y0 - 2.0 * y1 + y2;
        let (offset, peak) = if denom.abs() > 1e-12 {
            let d = 0.5 * (y0 - y2) / denom;
            (d, y1 - 0.25 * (y0 - y2) * d)
        } else {
            (0.0, y1)
        };

        Some(Pitch {
            hz: self.sample_rate / (idx as f32 + offset),
            clarity: peak.clamp(0.0, 1.0),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::audio::synth;

    fn cents(a: f32, b: f32) -> f32 {
        1200.0 * (a / b).log2()
    }

    const SR: u32 = 48_000;

    #[test]
    fn sine_waves_across_guitar_range() {
        let mut det = PitchDetector::new(2048, SR, 55.0, 1400.0);
        for hz in [61.74, 82.41, 110.0, 146.83, 196.0, 246.94, 329.63, 440.0, 659.25, 1318.5] {
            let signal = synth::sine(hz, SR, 2048, 0.5);
            let p = det.detect(&signal).expect("pitch");
            assert!(cents(p.hz, hz).abs() < 1.0, "{hz} Hz read as {}", p.hz);
            assert!(p.clarity > 0.95);
        }
    }

    #[test]
    fn weak_fundamental_is_not_mistaken_for_the_octave() {
        // Second harmonic twice as loud as the fundamental, as on a bright low E.
        let mut det = PitchDetector::new(2048, SR, 55.0, 1400.0);
        for hz in [82.41, 110.0, 146.83] {
            let signal = synth::harmonics(hz, SR, 2048, &[0.5, 1.0, 0.6, 0.4, 0.3]);
            let p = det.detect(&signal).expect("pitch");
            assert!(cents(p.hz, hz).abs() < 2.0, "{hz} Hz read as {}", p.hz);
        }
    }

    #[test]
    fn plucked_strings_guitar_and_bass() {
        let mut guitar = PitchDetector::new(2048, SR, 55.0, 1400.0);
        for target in [82.41, 110.0, 146.83, 196.0, 246.94, 329.63] {
            let (signal, actual) = synth::pluck(target, SR, 24_000, 7);
            // Skip the noisy first 20 ms of the attack.
            let p = guitar.detect(&signal[960..960 + 2048]).expect("pitch");
            assert!(cents(p.hz, actual).abs() < 3.0, "{actual} Hz read as {}", p.hz);
        }

        let mut bass = PitchDetector::new(4096, SR, 28.0, 450.0);
        for target in [30.87, 41.2, 55.0, 73.42, 98.0] {
            let (signal, actual) = synth::pluck(target, SR, 24_000, 11);
            let p = bass.detect(&signal[960..960 + 4096]).expect("pitch");
            assert!(cents(p.hz, actual).abs() < 3.0, "{actual} Hz read as {}", p.hz);
        }
    }

    #[test]
    fn noise_has_low_clarity_or_no_pitch() {
        let mut det = PitchDetector::new(2048, SR, 55.0, 1400.0);
        let signal = synth::noise(2048, 0.3, 42);
        if let Some(p) = det.detect(&signal) {
            assert!(p.clarity < 0.8, "noise read as {} Hz, clarity {}", p.hz, p.clarity);
        }
    }

    #[test]
    fn silence_has_no_pitch() {
        let mut det = PitchDetector::new(2048, SR, 55.0, 1400.0);
        assert!(det.detect(&vec![0.0; 2048]).is_none());
    }
}
