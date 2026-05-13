/**
 * Rounds a float to 8 significant figures to eliminate IEEE-754 artifacts
 * (e.g. 0.19999999999999999 → "0.2"), then returns a clean string.
 */
export function fmt(n: number | null | undefined): string {
  if (n == null || !isFinite(n as number)) return "—";
  return parseFloat((n as number).toPrecision(8)).toString();
}

/** Same as fmt() but always appends a unit string. */
export function fmtUnit(n: number | null | undefined, unit: string): string {
  return `${fmt(n)} ${unit}`;
}

/** Rounds a number to 8 sig figs — use before storing floats in the DB. */
export function roundQty(n: number): number {
  return parseFloat(n.toPrecision(8));
}
