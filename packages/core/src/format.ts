/**
 * Kronebeløp med mellomrom som tusenskille, for eksempel «16 200 kr».
 * Skrevet uten Intl, slik at resultatet er likt på server og i alle nettlesere.
 */
export function formatNok(amount: number): string {
  if (!Number.isSafeInteger(amount)) throw new RangeError(`Ugyldig beløp: ${amount}`);
  const sign = amount < 0 ? "-" : "";
  const digits = String(Math.abs(amount)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${sign}${digits} kr`;
}
