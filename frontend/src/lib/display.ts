/** Formatting helpers for presentation only; calculation values remain untouched. */
export function formatDisplayNumber(value: number, fractionDigits: 2 | 3): string {
  const threshold = 0.5 * 10 ** -fractionDigits;
  const normalized = Math.abs(value) < threshold ? 0 : value;
  return new Intl.NumberFormat("en-AU", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
    roundingMode: "halfExpand",
  }).format(normalized);
}

export function formatQuantity(value: number, unit: "L" | "min"): string {
  const formatted = formatDisplayNumber(value, 3);
  if (value > 0 && Number(formatted.replaceAll(",", "")) === 0) return `<0.001 ${unit}`;
  return `${formatted} ${unit}`;
}

export function formatContribution(value: number): string {
  if (value !== 0 && Math.abs(value) < 0.005) return `AUD ${value < 0 ? "-" : ""}<0.01`;
  return `AUD ${formatDisplayNumber(value, 2)}`;
}

export function formatPercent(value: number): string {
  if (value > 0 && value < 0.005) return "<0.01%";
  return `${formatDisplayNumber(value, 2)}%`;
}

export function formatPrecision(value: number): string {
  return Object.is(value, -0) ? "0" : value.toString();
}
