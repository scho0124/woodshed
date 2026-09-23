//! Audio input for the tuner and play-along: device listing, capture, and
//! analysis (pitch, note starts). Audio is analyzed in memory and never stored.

pub mod analysis;
pub mod capture;
pub mod devices;
pub mod pitch;
pub mod settings;

#[cfg(test)]
pub mod synth;
