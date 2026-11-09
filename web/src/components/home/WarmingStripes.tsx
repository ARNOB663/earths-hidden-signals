// Warming stripes (after Ed Hawkins' #ShowYourStripes): one stripe per year, coloured from cooler
// (blue) to warmer (red) than the period's average. No axis, no numbers: the picture is the point.

const STEPS = ["--cool-4", "--cool-3", "--cool-2", "--cool-1", "--mid", "--warm-1", "--warm-2", "--warm-3", "--warm-4"];

export function WarmingStripes({ values, label }: { values: number[]; label: string }) {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const span = Math.max(...values.map((v) => Math.abs(v - mean))) || 1;
  return (
    <div role="img" aria-label={label} className="flex h-full w-full overflow-hidden">
      {values.map((v, i) => {
        const k = Math.round(((v - mean) / span) * 4) + 4;
        return <span key={i} className="h-full flex-1" style={{ background: `var(${STEPS[Math.min(8, Math.max(0, k))]})` }} />;
      })}
    </div>
  );
}
