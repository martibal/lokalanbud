// Gjennomkjøring av hele demoflyten i en ekte nettleser, som gjest og som lokale.
// Start nettsiden først (pnpm build && pnpm start), og kjør så: pnpm test:e2e
// Miljøvariabler: BASE_URL, CHROME_PATH (sti til Chrome), SCREENSHOT_DIR.
import { chromium } from "playwright-core";

const B = process.env.BASE_URL ?? "http://localhost:3000";
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "/usr/bin/google-chrome",
  args: ["--no-sandbox"],
});
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const problems = [];
page.on("console", (m) => {
  if (m.type() === "error") problems.push(`${m.text()} (${m.location()?.url ?? ""})`);
});
page.on("response", (r) => {
  if (r.status() >= 400) problems.push(`${r.status()} ${r.url()}`);
});
page.on("pageerror", (e) => problems.push("pageerror " + e.message));
const shot = (n) =>
  page.screenshot({ path: `${process.env.SCREENSHOT_DIR ?? "/tmp"}/lokalbud-${n}.png`, fullPage: true });
const step = (s) => console.log("✓", s);

async function logout() {
  await page.goto(B + "/demo");
  const button = page.locator("button", { hasText: "Logg ut" });
  if (await button.count()) {
    await button.click();
    await button.waitFor({ state: "detached" });
  }
}

async function loginVenue(name) {
  await logout();
  await page.goto(B + "/");
  await page.click("text=Finn gjester");
  await page.click("text=Logg inn med BankID");
  await page.locator("button.role-card", { hasText: name }).first().click();
  await page.waitForURL((u) => u.pathname === "/lokale");
}

async function loginGuest(phone) {
  await logout();
  await page.goto(B + "/logg-inn");
  await page.fill("#phone", phone);
  await page.click("button:has-text('Se forespørslene')");
  await page.waitForURL((u) => u.pathname === "/mine");
}

// 0. Start med eksempeldataene, slik at testen kan kjøres flere ganger
await page.goto(B + "/demo");
await page.click("button:has-text('Nullstill demoen')");
await page.waitForURL(/nullstilt=1/);

// 1. Forsiden har to valg
await page.goto(B + "/");
await shot("01-forside");
step("forsiden: " + (await page.locator(".split-headline").allInnerTexts()).join(" / "));

// 2. Ny gjest legger inn behov og publiserer med en gang, uten innlogging.
// Den nye gjesten bruker et eget nettleservindu, slik en ekte gjest ville gjort.
const guestCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const guestPage = await guestCtx.newPage();
guestPage.on("pageerror", (e) => problems.push("pageerror " + e.message));
await guestPage.goto(B + "/");
await guestPage.click("text=Finn lokale");
await guestPage.waitForURL(/ny-foresporsel/);
await guestPage.click("button:has-text('Neste')");
const stepErrors = await guestPage.locator(".field-error").count();
if (stepErrors < 3) problems.push("steg 1 viser ikke feil for tomme felt");
step(`tomt steg 1 stoppes med ${stepErrors} feilmeldinger`);
await guestPage.click("label.tile:has-text('Jubileum')");
await guestPage.fill("input[placeholder='Antall gjester']", "70");
await guestPage.click("label.chip:has-text('Grünerløkka')");
await guestPage.fill("input[type=date]", new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10));
await guestPage.screenshot({ path: `${process.env.SCREENSHOT_DIR ?? "/tmp"}/lokalbud-02-steg1.png`, fullPage: true });
await guestPage.click("button:has-text('Neste')");
await guestPage.getByLabel("Makspris").fill("20000");
await guestPage.click("label.chip:has-text('Garderobe')");
await guestPage.click("label.chip:has-text('Tilgjengelig med rullestol')");
await guestPage.click("label.switch-row:has-text('Garderobe')");
await guestPage.screenshot({ path: `${process.env.SCREENSHOT_DIR ?? "/tmp"}/lokalbud-02-steg2.png`, fullPage: true });
await guestPage.click("button:has-text('Neste')");
await guestPage.waitForSelector("text=Ser dette riktig ut?");
const review = await guestPage.locator(".review .tags").innerText();
if (!review.includes("Må: Garderobe")) problems.push("oppsummeringen viser ikke må-kravet");
await guestPage.screenshot({ path: `${process.env.SCREENSHOT_DIR ?? "/tmp"}/lokalbud-02-steg3.png`, fullPage: true });
await guestPage.click("button:has-text('Publiser forespørselen')");
await guestPage.waitForURL(/\/mine\/.+\?ny=1/);
step("forespørsel publisert med en gang");

// Den dukker opp med en gang hos lokaler, også utenfor området
await loginVenue("Amir");
const fjordsalen = await page.locator(".request-card", { hasText: "Jubileum" }).count();
if (fjordsalen !== 1) problems.push("Fjordsalen ser ikke den nye forespørselen");
step("Fjordsalen (Frogner) ser den nye forespørselen: " + (fjordsalen === 1));

// 3. Lokalet logger inn med (simulert) BankID og sender tilbud
await loginVenue("Siri");
await shot("04-lokale-oversikt");
await page.locator(".request-card", { hasText: "Jubileum" }).click();
await page.locator("li:has-text('Garderobe') label:has-text('Ikke oppfylt')").click();
step("må-krav blokkerer: " + (await page.locator("button[type=submit]").isDisabled()));
await page.click("button:has-text('Alt er oppfylt')");
await page.locator("li:has-text('rullestol') label:has-text('Med forbehold')").click();
await page.fill("#pris", "18 500");
await page.fill("#inkludert", "Leie fra 18 til 01, bord, stoler og lydanlegg");
await page.click("button[type=submit]");
await page.waitForSelector("text=Forklar avviket kort");
step("forklaring kreves ved avvik");
await page.fill("input[placeholder^='Forklar']", "Rampe ved bakinngangen");
await shot("05-svarskjema");
await page.click("button[type=submit]");
await page.waitForURL(/tilbud\?sendt/);
step("tilbud sendt");

// 4. Kari logger inn, ser tilbudene, sammenligner og godtar ett. Det er bindende med en gang.
await loginGuest("91234567");
await page.locator(".list-item", { hasText: "Bursdag" }).click();
await page.waitForSelector(".offer.teaser");
await page.locator(".offer.teaser button").first().click();
await page.locator(".offer.teaser").nth(1).waitFor({ state: "detached" });
await page.locator(".offer.teaser button").first().click();
await page.waitForSelector(".comparison");
const galleries = await page.locator(".gallery-main").count();
const contacts = await page.locator(".contact-card").count();
if (galleries < 2 || contacts < 2) problems.push("åpnede tilbud mangler bilder eller kontaktperson");
step(`to tilbud åpnet med bilder (${galleries}) og kontaktperson (${contacts})`);
await page.locator(".offer-full", { hasText: "Bryggeloftet" }).locator(".gallery-thumbs button").nth(1).click();
await shot("06-tilbud-gjest");
const bryggeloftet = page.locator(".offer-full", { hasText: "Bryggeloftet" });
await bryggeloftet.locator("button", { hasText: "Godta tilbudet" }).click();
await bryggeloftet.locator("button", { hasText: "Godta og bestill" }).click();
await page.waitForSelector("text=Bekreft at du forstår");
step("bindende godkjenning må krysses av");
await bryggeloftet.locator("input[type=email]").fill("kari@eksempel.demo");
await bryggeloftet.locator(".binding input").check();
await bryggeloftet.locator("button", { hasText: "Godta og bestill" }).click();
await page.waitForURL(/avtale\/.+\?ny=1/);
await shot("07-bestilling");
step("bestilling: " + (await page.locator(".agreement .reference").innerText()));
step("kopi sendt: " + (await page.locator(".card.success p").innerText()));

// 5. Lokalet ser bookingen med gjestens kontaktinformasjon, og kan trekke andre tilbud
await loginVenue("Siri");
await page.goto(B + "/lokale/tilbud");
const bookedText = await page.locator(".offer.confirmed").first().innerText();
if (!bookedText.includes("Kari Nordmann")) problems.push("lokalet ser ikke gjestens kontaktinformasjon");
step("lokalet ser bookingen med kontaktinformasjon");
await page.goto(B + "/demo");
step("e-postkopier i demoverktøyet: " + (await page.locator(".outbox li").count()));

// 6. Den nye gjesten åpner tilbudet sitt i sitt eget vindu
await guestPage.goto(B + "/mine");
await guestPage.locator(".list-item").first().click();
await guestPage.locator(".offer.teaser button").first().click();
await guestPage.waitForSelector(".offer-price");
step("nytt tilbud åpnet: " + (await guestPage.locator(".offer-price").first().innerText()));

// Lokalet trekker tilbudet, og gjesten ser det ikke lenger
await loginVenue("Siri");
await page.goto(B + "/lokale/tilbud");
await page.click(".offer.active >> text=Trekk tilbudet");
await page.waitForSelector("text=Avsluttede tilbud");
step("tilbud trukket");
await guestPage.reload();
if ((await guestPage.locator(".offer-full").count()) !== 0) problems.push("trukket tilbud vises fortsatt for gjesten");
step("trukket tilbud er borte hos gjesten");

// 7. Tilganger: regnskap ser faktura, booking gjør ikke
await loginVenue("Jonas");
await page.goto(B + "/lokale/faktura");
await shot("07-faktura");
step("faktura: " + (await page.locator(".stat strong").allInnerTexts()).join(" | "));
await loginVenue("Siri");
await page.goto(B + "/lokale/faktura");
await page.waitForURL((u) => u.pathname === "/lokale");
step("booking sendes bort fra faktura");
await loginVenue("Lise");
step("Lindekroa ser: " + (await page.locator(".request-card h3").allInnerTexts()).join(", "));

// Lagret søk
await loginVenue("Siri");
if (await page.locator(".filter-toggle").isVisible()) await page.click(".filter-toggle");
await page.locator(".filters label.chip", { hasText: "Grünerløkka" }).click();
await page.click("button:has-text('Vis treff')");
await page.waitForURL(/omrade=grunerlokka/);
await page.fill("#sokenavn", "Løkka");
await page.click("button:has-text('Lagre søk')");
await page.waitForURL(/\/lokale\/sok/);
await shot("08-lagrede-sok");
step("lagret søk: " + (await page.locator(".list h2").allInnerTexts()).join(", "));
await page.click("text=Vis treff");
await page.waitForURL(/sok=/);
step("treff i lagret søk: " + (await page.locator(".request-card").count()));

// 8. Sider som krever innlogging, sender videre til riktig innlogging
await logout();
await page.goto(B + "/lokale");
if (new URL(page.url()).pathname !== "/lokale/logg-inn") problems.push("/lokale sender ikke til innlogging");
step("uinnlogget /lokale → " + new URL(page.url()).pathname);
await page.goto(B + "/mine");
if (new URL(page.url()).pathname !== "/logg-inn") problems.push("/mine sender ikke til innlogging");
step("uinnlogget /mine → " + new URL(page.url()).pathname);

console.log("Konsollfeil:", problems);
await browser.close();
if (problems.length > 0) process.exit(1);
