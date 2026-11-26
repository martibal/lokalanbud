/**
 * Krav og svar. Gjesten merker hvert krav som må-krav eller ønske. Felt
 * gjesten ikke fyller ut, er ingen preferanse og påvirker ikke matchingen.
 *
 * Lokalet svarer på hvert krav. Et lokale som ikke oppfyller et må-krav,
 * kan ikke sende tilbud. Avvik fra et ønske er lov når lokalet forklarer det.
 */

export type Importance = "must" | "wish";

export const FIXED_CRITERIA = [
  { key: "alcohol_serving", label: "Skjenking av alkohol" },
  { key: "byob", label: "Medbrakt drikke tillatt" },
  { key: "food_served", label: "Lokalet serverer mat" },
  { key: "external_catering", label: "Ekstern catering eller medbrakt mat tillatt" },
  { key: "kitchen", label: "Tilgang til kjøkken" },
  { key: "wheelchair", label: "Tilgjengelig med rullestol" },
  { key: "cloakroom", label: "Garderobe" },
  { key: "toilets", label: "Nok toaletter til antall gjester" },
  { key: "sound_system", label: "Lydanlegg" },
  { key: "late_night", label: "Åpent etter klokken 01" },
] as const;

export type FixedCriterionKey = (typeof FIXED_CRITERIA)[number]["key"];

export const FIXED_CRITERION_KEYS = FIXED_CRITERIA.map((c) => c.key) as [
  FixedCriterionKey,
  ...FixedCriterionKey[],
];

export const MAX_CUSTOM_CRITERIA = 10;
export const CUSTOM_CRITERION_MIN_LENGTH = 3;
export const CUSTOM_CRITERION_MAX_LENGTH = 200;
export const DEVIATION_COMMENT_MIN_LENGTH = 5;
export const DEVIATION_COMMENT_MAX_LENGTH = 500;

export type Criterion =
  | { id: string; kind: "fixed"; key: FixedCriterionKey; importance: Importance }
  | { id: string; kind: "custom"; text: string; importance: Importance };

export type AnswerValue = "meets" | "meets_with_reservation" | "does_not_meet";

export type CriterionAnswer = {
  criterionId: string;
  value: AnswerValue;
  /** Påkrevd ved alle svar som ikke er «meets». */
  comment?: string;
};

export type OfferCheckProblem =
  | { code: "missing_answer"; criterionId: string }
  | { code: "unknown_criterion"; criterionId: string }
  | { code: "duplicate_answer"; criterionId: string }
  | { code: "must_not_met"; criterionId: string }
  | { code: "comment_required"; criterionId: string }
  | { code: "comment_too_long"; criterionId: string };

/**
 * Sjekker om et tilbud kan sendes. Returnerer en tom liste når alt er i orden.
 * Samme regel håndheves i databasen, slik at en endret klient ikke kan omgå den.
 */
export function checkOfferAnswers(
  criteria: readonly Criterion[],
  answers: readonly CriterionAnswer[],
): OfferCheckProblem[] {
  const problems: OfferCheckProblem[] = [];
  const byId = new Map(criteria.map((c) => [c.id, c]));
  const seen = new Set<string>();

  for (const answer of answers) {
    if (!byId.has(answer.criterionId)) {
      problems.push({ code: "unknown_criterion", criterionId: answer.criterionId });
      continue;
    }
    if (seen.has(answer.criterionId)) {
      problems.push({ code: "duplicate_answer", criterionId: answer.criterionId });
      continue;
    }
    seen.add(answer.criterionId);

    const criterion = byId.get(answer.criterionId)!;
    const comment = answer.comment?.trim() ?? "";

    if (criterion.importance === "must" && answer.value !== "meets") {
      problems.push({ code: "must_not_met", criterionId: answer.criterionId });
    }
    if (answer.value !== "meets" && comment.length < DEVIATION_COMMENT_MIN_LENGTH) {
      problems.push({ code: "comment_required", criterionId: answer.criterionId });
    }
    if (comment.length > DEVIATION_COMMENT_MAX_LENGTH) {
      problems.push({ code: "comment_too_long", criterionId: answer.criterionId });
    }
  }

  for (const criterion of criteria) {
    if (!seen.has(criterion.id)) {
      problems.push({ code: "missing_answer", criterionId: criterion.id });
    }
  }

  return problems;
}

/** Et lokale som ikke oppfyller ett eller flere må-krav, svarer «Passer ikke» gratis. */
export function mustRequirementsBlocking(
  criteria: readonly Criterion[],
  answers: readonly CriterionAnswer[],
): string[] {
  const answerById = new Map(answers.map((a) => [a.criterionId, a]));
  return criteria
    .filter((c) => c.importance === "must" && answerById.get(c.id)?.value !== "meets")
    .map((c) => c.id);
}
