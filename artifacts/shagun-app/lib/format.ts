/**
 * Format a number as Indian Rupees using correct lakh/crore notation.
 * e.g. formatINR(1500) → "1,500"
 *      formatINR(100000) → "1,00,000"
 */
export function formatINR(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(amount);
}
