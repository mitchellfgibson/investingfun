/** Display formatting helpers shared across the UI. */

export function fmtMoney(n: number, currency = "USD"): string {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    notation: abs >= 1_000_000 ? "compact" : "standard",
    maximumFractionDigits: abs >= 1000 || abs >= 1_000_000 ? 1 : 2,
  }).format(n);
}

export function fmtPrice(n: number, currency = "USD"): string {
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(n);
}

export function fmtPct(n: number, digits = 1): string {
  if (!Number.isFinite(n)) return "—";
  return `${n >= 0 ? "+" : ""}${(n * 100).toFixed(digits)}%`;
}

export function fmtNum(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(digits);
}

/** Map a rating label to its CSS pill class. */
export function pillClass(label: string): string {
  return "pill pill-" + label.toLowerCase().replace(/\s+/g, "-");
}

/** Color for a +/- value. */
export function changeColor(n: number): string {
  return n > 0 ? "green" : n < 0 ? "red" : "dim";
}
