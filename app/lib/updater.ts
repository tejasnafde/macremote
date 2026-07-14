// APK self-update: compare semver-ish versions numerically per segment.
// Adapted verbatim from scout/app/lib/updater.ts.
export function isNewer(candidate: string, current: string): boolean {
  const parse = (v: string) => v.split('.').map((s) => parseInt(s, 10));
  const a = parse(candidate);
  const b = parse(current);
  if (a.some(isNaN) || !a.length) return false;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d !== 0) return d > 0;
  }
  return false;
}
