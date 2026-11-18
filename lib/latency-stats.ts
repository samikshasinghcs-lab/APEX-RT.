export interface LatencySummary {
  n: number;
  min: number;
  p50: number;
  p95: number;
  p99: number;
  max: number;
  mean: number;
}

/** Nearest-rank percentile on an ascending-sorted array. p is 0-100. */
export function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) throw new Error('percentile: no samples');
  if (!(p >= 0 && p <= 100)) {
    throw new Error('percentile: p must be within 0-100');
  }
  const rank = Math.max(1, Math.ceil((p / 100) * sortedAsc.length));
  return sortedAsc[rank - 1];
}

export function summarizeLatencies(samples: number[]): LatencySummary {
  const clean = samples.filter((x) => Number.isFinite(x) && x >= 0);
  if (clean.length === 0) {
    throw new Error('summarizeLatencies: no valid samples');
  }
  const s = [...clean].sort((a, b) => a - b);
  const mean = s.reduce((a, b) => a + b, 0) / s.length;
  return {
    n: s.length,
    min: Number(s[0].toFixed(2)),
    p50: Number(percentile(s, 50).toFixed(2)),
    p95: Number(percentile(s, 95).toFixed(2)),
    p99: Number(percentile(s, 99).toFixed(2)),
    max: Number(s[s.length - 1].toFixed(2)),
    mean: Number(mean.toFixed(2)),
  };
}

/** Times a synchronous or async function `runs` times with performance.now() and summarizes the results. */
export async function benchmarkAsync(
  fn: () => unknown | Promise<unknown>,
  runs: number
): Promise<LatencySummary> {
  const out: number[] = [];
  for (let i = 0; i < runs; i++) {
    const t0 = performance.now();
    await fn();
    out.push(performance.now() - t0);
  }
  return summarizeLatencies(out);
}
