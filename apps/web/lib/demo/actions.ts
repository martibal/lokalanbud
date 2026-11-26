"use server";

import type { AnswerValue, CriterionAnswer } from "@lokalbud/core";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DEMO_COOKIE, requireGuest, requireVenueUser } from "./session";
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
  const jar = await cookies();
  jar.set(DEMO_COOKIE, user.id, { httpOnly: true, sameSite: "lax", path: "/" });
  revalidatePath("/", "layout");
  redirect(user.kind === "guest" ? "/mine" : "/lokale");
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
