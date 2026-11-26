"use server";

import type { AnswerValue, CriterionAnswer } from "@lokalbud/core";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { clearSession, requireGuest, requireVenueUser, setSessionUser } from "./session";
import * as store from "./store";

function withError(path: string, error: unknown): never {
  const message = error instanceof store.DemoRuleError ? error.message : "Noe gikk galt";
  if (!(error instanceof store.DemoRuleError)) console.error(error);
  revalidatePath("/", "layout");
  redirect(`${path}${path.includes("?") ? "&" : "?"}feil=${encodeURIComponent(message)}`);
}

function str(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
}

// ---------------------------------------------------------------------------
// Rollevalg
// ---------------------------------------------------------------------------

export async function loginAs(form: FormData): Promise<void> {
  const user = store.getUser(str(form, "userId"));
  if (!user) redirect("/demo");
  await setSessionUser(user.id);
  revalidatePath("/", "layout");
  redirect(user.kind === "guest" ? "/mine" : "/lokale");
}

/** Simulert BankID: lokalets ansatt velges fra en liste over testpersoner. */
export async function bankIdLogin(form: FormData): Promise<void> {
  const user = store.getUser(str(form, "userId"));
  if (!user || user.kind !== "venue") redirect("/lokale/logg-inn");
  await setSessionUser(user.id);
  revalidatePath("/", "layout");
  redirect("/lokale");
}

export async function logout(): Promise<void> {
  await clearSession();
  revalidatePath("/", "layout");
  redirect("/");
}

export async function resetDemo(): Promise<void> {
  store.resetDemo();
  revalidatePath("/", "layout");
  redirect("/demo?nullstilt=1");
}

// ---------------------------------------------------------------------------
// Gjesten
// ---------------------------------------------------------------------------

export async function openOfferAction(form: FormData): Promise<void> {
  const guest = await requireGuest();
  const offerId = str(form, "offerId");
  const requestId = str(form, "requestId");
  try {
    store.openOffer(guest.id, offerId);
  } catch (error) {
    withError(`/mine/${requestId}`, error);
  }
  revalidatePath("/", "layout");
  redirect(`/mine/${requestId}`);
}

/** Gjesten godtar et tilbud. Bindende med en gang, og en kopi sendes til begge parter. */
export async function acceptOfferAction(input: {
  offerId: string;
  binding: boolean;
}): Promise<{ errors: Record<string, string> } | undefined> {
  const guest = await requireGuest();
  if (input?.binding !== true) return { errors: { binding: "Kryss av for at du forstår at bestillingen er bindende" } };
  let offerId: string;
  try {
    offerId = store.acceptOffer(guest.id, String(input.offerId)).id;
  } catch (error) {
    if (error instanceof store.DemoRuleError) return { errors: { _form: error.message } };
    throw error;
  }
  revalidatePath("/", "layout");
  redirect(`/avtale/${offerId}?ny=1`);
}

export async function newRoundAction(form: FormData): Promise<void> {
  const guest = await requireGuest();
  const requestId = str(form, "requestId");
  try {
    store.requestNewRound(guest.id, requestId);
  } catch (error) {
    withError(`/mine/${requestId}`, error);
  }
  revalidatePath("/", "layout");
  redirect(`/mine/${requestId}`);
}

export async function closeRequestAction(form: FormData): Promise<void> {
  const guest = await requireGuest();
  const requestId = str(form, "requestId");
  try {
    store.closeRequest(guest.id, requestId);
  } catch (error) {
    withError(`/mine/${requestId}`, error);
  }
  revalidatePath("/", "layout");
  redirect(`/mine/${requestId}`);
}

// ---------------------------------------------------------------------------
// Lokalet
// ---------------------------------------------------------------------------

export type OfferFormInput = {
  requestId: string;
  totalPriceNok: number;
  conditions: string;
  cancellationTerms: string;
  validUntil: string;
  answers: { criterionId: string; value: AnswerValue; comment: string }[];
};

export async function submitOfferAction(input: OfferFormInput): Promise<{ error: string } | undefined> {
  const user = await requireVenueUser();
  const answers: CriterionAnswer[] = input.answers.map((a) => ({
    criterionId: String(a.criterionId),
    value: a.value,
    ...(a.comment.trim() ? { comment: a.comment.trim().slice(0, 500) } : {}),
  }));
  try {
    store.submitOffer(user.id, String(input.requestId), {
      totalPriceNok: Number(input.totalPriceNok),
      conditions: String(input.conditions ?? "")
        .trim()
        .slice(0, 2000),
      cancellationTerms: String(input.cancellationTerms ?? "")
        .trim()
        .slice(0, 1000),
      validUntil: String(input.validUntil ?? ""),
      answers,
    });
  } catch (error) {
    if (error instanceof store.DemoRuleError) return { error: error.message };
    throw error;
  }
  revalidatePath("/", "layout");
  redirect("/lokale/tilbud?sendt=1");
}

export async function declineAction(form: FormData): Promise<void> {
  const user = await requireVenueUser();
  store.declineRequest(user.id, str(form, "requestId"), str(form, "reason").slice(0, 300));
  revalidatePath("/", "layout");
  redirect("/lokale?avslatt=1");
}

export async function withdrawOfferAction(form: FormData): Promise<void> {
  const user = await requireVenueUser();
  try {
    store.withdrawOffer(user.id, str(form, "offerId"));
  } catch (error) {
    withError("/lokale/tilbud", error);
  }
  revalidatePath("/", "layout");
  redirect("/lokale/tilbud");
}

// ---------------------------------------------------------------------------
// Lagrede søk
// ---------------------------------------------------------------------------

export async function saveSearchAction(form: FormData): Promise<void> {
  const user = await requireVenueUser();
  const query = str(form, "query");
  try {
    store.saveSearch(user.id, str(form, "name"), query, form.get("notify") === "1");
  } catch (error) {
    withError(`/lokale?${query}`, error);
  }
  revalidatePath("/", "layout");
  redirect("/lokale/sok?lagret=1");
}

export async function toggleNotifyAction(form: FormData): Promise<void> {
  const user = await requireVenueUser();
  store.toggleSavedSearchNotify(user.id, str(form, "id"));
  revalidatePath("/", "layout");
  redirect("/lokale/sok");
}

export async function deleteSearchAction(form: FormData): Promise<void> {
  const user = await requireVenueUser();
  store.deleteSavedSearch(user.id, str(form, "id"));
  revalidatePath("/", "layout");
  redirect("/lokale/sok");
}
