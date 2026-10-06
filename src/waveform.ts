// RMS energy per time bin, on a shared timeline. Stereo channels are combined
// by energy so phase cancellation cannot erase the displayed waveform.
export function waveformEnvelope(channels: Float32Array[], sampleRate: number, start: number, end: number, timeline: number, bins = 240, speed = 1): number[] {
  const result = Array<number>(bins).fill(0);
  for (let bin = 0; bin < bins; bin++) {
    const from = start + bin / bins * timeline * speed;
    const to = Math.min(end, start + (bin + 1) / bins * timeline * speed);
    if (from >= end || to <= from) continue;
    const first = Math.max(0, Math.floor(from * sampleRate));
    const last = Math.min(channels[0]?.length || 0, Math.ceil(to * sampleRate));
    let energy = 0;
    for (const channel of channels) for (let i = first; i < last; i++) energy += channel[i] * channel[i];
    result[bin] = last > first && channels.length ? Math.sqrt(energy / ((last - first) * channels.length)) : 0;
  }
  return result;
}

// Distribute packet energy by overlap, clipping preroll and the selected tail.
export function accumulateWaveform(energies: Float64Array, counts: Float64Array, energy: number, count: number, from: number, duration: number, limit: number, timeline: number) {
  const left = Math.max(0, from), right = Math.min(limit, from + duration);
  if (duration <= 0 || timeline <= 0 || right <= left) return;
  const width = timeline / energies.length;
  for (let bin = Math.max(0, Math.floor(left / width)); bin < energies.length && bin * width < right; bin++) {
    const overlap = Math.min(right, (bin + 1) * width) - Math.max(left, bin * width);
    if (overlap > 0) { energies[bin] += energy * overlap / duration; counts[bin] += count * overlap / duration; }
  }
}
