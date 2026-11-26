/**
 * Pris per åpnet tilbud: 0,75 % av beregningsgrunnlaget, minst 19 kr og
 * maks 499 kr, uten mva. Beløp regnes i hele kroner som heltall, slik at
 * avrunding aldri avhenger av flyttall.
 *
 * Gebyret beregnes bare på serveren. Klienten kan vise det, men verdien
 * klienten sender inn brukes aldri.
 */

/** 0,75 % uttrykt i basispunkter (1/100 prosent). */
export const FEE_RATE_BASIS_POINTS = 75;
export const FEE_MIN_NOK = 19;
export const FEE_MAX_NOK = 499;

/** Gratis introduksjonstilbud per nytt lokale. */
export const FREE_INTRO_OFFERS = 3;

export type Budget =
  /** Gjesten har satt et fast maksbeløp. Gebyret regnes av det. */
  | { kind: "fixed"; amountNok: number }
  /** Gjesten har merket budsjettet som veiledende. Gebyret regnes av lokalets totalpris. */
  | { kind: "indicative"; amountNok: number };

function assertWholeNok(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${label} må være et positivt heltall i kroner, fikk ${value}`);
  }
}

/** Grunnlaget gebyret regnes av, etter implementeringsreglene. */
export function feeBasisNok(budget: Budget, offerTotalNok: number): number {
  assertWholeNok(budget.amountNok, "Budsjett");
  assertWholeNok(offerTotalNok, "Totalpris i tilbudet");
  return budget.kind === "fixed" ? budget.amountNok : offerTotalNok;
}

/**
 * Gebyret for ett åpnet tilbud, i hele kroner. Halve kroner rundes opp.
 * Eksempel: 16 200 kr gir 121,5 kr, som blir 122 kr.
 */
export function offerFeeNok(basisNok: number): number {
  assertWholeNok(basisNok, "Beregningsgrunnlag");
  // Heltallsaritmetikk: (grunnlag * 75 + 5 000) / 10 000, avrundet ned.
  const rounded = Math.floor((basisNok * FEE_RATE_BASIS_POINTS + 5_000) / 10_000);
  return Math.min(FEE_MAX_NOK, Math.max(FEE_MIN_NOK, rounded));
}

/**
 * Hva lokalet faktisk faktureres for et åpnet tilbud, når det har brukt
 * et gitt antall av de gratis introduksjonstilbudene fra før.
 */
export function chargeForOpenedOffer(
  budget: Budget,
  offerTotalNok: number,
  freeIntroOffersUsed: number,
): { feeNok: number; free: boolean } {
  if (!Number.isSafeInteger(freeIntroOffersUsed) || freeIntroOffersUsed < 0) {
    throw new RangeError("Antall brukte gratistilbud må være et heltall fra 0");
  }
  const fee = offerFeeNok(feeBasisNok(budget, offerTotalNok));
  const free = freeIntroOffersUsed < FREE_INTRO_OFFERS;
  return { feeNok: free ? 0 : fee, free };
}
