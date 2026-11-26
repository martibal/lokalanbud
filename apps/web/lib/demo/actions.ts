"use server";

import type { AnswerValue, CriterionAnswer } from "@lokalbud/core";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { norwegianMobile } from "@lokalbud/core";
import { clearSession, requireGuest, requireVenueUser, setSessionUser } from "./session";
import * as store from "./store";

function withError(path: string, error: unknown): never {
  const message = error instanceof store.DemoRuleError ? error.message : "Noe gikk galt";
  if (!(error instanceof store.DemoRuleError)) console.error(error);
  revalidatePath("/", "layout");
  redirect(`${path}?feil=${encodeURIComponent(message)}`);
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

// ---------------------------------------------------------------------------
// Engangskode på SMS for gjester
// ---------------------------------------------------------------------------

export type CodeResult = { ok: true; phone: string; demoCode: string } | { ok: false; error: string };

export async function sendGuestCode(rawPhone: string, mustExist: boolean): Promise<CodeResult> {
  const parsed = norwegianMobile.safeParse(String(rawPhone ?? ""));
  if (!parsed.success) return { ok: false, error: "Oppgi et norsk mobilnummer med 8 siffer" };
  if (mustExist && !store.findGuestByPhone(parsed.data)) {
    return { ok: false, error: "Vi finner ingen forespørsler på dette nummeret" };
  }
  // I den ekte løsningen sendes koden på SMS og vises aldri her.
  return { ok: true, phone: parsed.data, demoCode: store.startPhoneVerification(parsed.data) };
}

export async function guestLoginWithCode(phone: string, code: string): Promise<{ error: string } | undefined> {
  try {
    store.verifyPhoneCode(String(phone), String(code));
  } catch (error) {
    if (error instanceof store.DemoRuleError) return { error: error.message };
    throw error;
  }
  const guest = store.findGuestByPhone(String(phone));
  if (!guest) return { error: "Vi finner ingen forespørsler på dette nummeret" };
  await setSessionUser(guest.id);
  revalidatePath("/", "layout");
  redirect("/mine");
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

export async function acceptOfferAction(form: FormData): Promise<void> {
  const guest = await requireGuest();
  const requestId = str(form, "requestId");
  try {
    store.acceptOffer(guest.id, str(form, "offerId"));
  } catch (error) {
    withError(`/mine/${requestId}`, error);
  }
  revalidatePath("/", "layout");
  redirect(`/mine/${requestId}`);
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
      conditions: String(input.conditions ?? "").trim().slice(0, 2000),
      cancellationTerms: String(input.cancellationTerms ?? "").trim().slice(0, 1000),
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

export async function confirmBookingAction(form: FormData): Promise<void> {
  const user = await requireVenueUser();
  const offerId = str(form, "offerId");
  try {
    store.confirmBooking(user.id, offerId);
  } catch (error) {
    withError("/lokale/tilbud", error);
  }
  revalidatePath("/", "layout");
  redirect(`/avtale/${offerId}`);
}

export async function rejectAcceptedAction(form: FormData): Promise<void> {
  const user = await requireVenueUser();
  try {
    store.rejectAcceptedOffer(user.id, str(form, "offerId"));
  } catch (error) {
    withError("/lokale/tilbud", error);
  }
  revalidatePath("/", "layout");
  redirect("/lokale/tilbud");
}
