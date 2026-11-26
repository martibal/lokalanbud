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
  if (m.type() === "error") problems.push(m.text());
});
page.on("response", (r) => {
  if (r.status() >= 400) problems.push(`${r.status()} ${r.url()}`);
});
page.on("pageerror", (e) => problems.push("pageerror " + e.message));
const shot = (n) =>
  page.screenshot({ path: `${process.env.SCREENSHOT_DIR ?? "/tmp"}/lokalbud-${n}.png`, fullPage: true });
const step = (s) => console.log("✓", s);

async function logout() {
  await page.goto(B + "/");
  const button = page.locator("nav button", { hasText: "Logg ut" });
  if (await button.count()) {
    await button.click();
    await button.waitFor({ state: "detached" });
  }
}

async function loginVenue(name) {
  await logout();
  await page.click("text=Fortsett som lokale");
  await page.click("text=Logg inn med BankID");
  await page.locator("button.role-card", { hasText: name }).first().click();
  await page.waitForURL((u) => u.pathname === "/lokale");
}

async function loginGuest(phone) {
  await logout();
  await page.goto(B + "/logg-inn");
  await page.fill("#phone", phone);
  await page.click("text=Send kode på SMS");
  const code = await page.locator(".notice strong").innerText();
  await page.fill("#code", code);
  await page.click("button:has-text('Logg inn')");
  await page.waitForURL((u) => u.pathname === "/mine");
}

// 1. Forsiden har to valg
await page.goto(B + "/");
await shot("01-forside");
step("forsiden: " + (await page.locator(".entry-card strong").allInnerTexts()).join(" / "));

// 2. Ny gjest legger inn behov og bekrefter med engangskode
await page.click("text=Fortsett som gjest");
await page.waitForURL(/ny-foresporsel/);
await page.click("label.chip:has-text('Grünerløkka')");
await page.fill("input[inputmode=numeric] >> nth=0", "70");
await page.selectOption("select >> nth=0", "anniversary");
await page.fill("input[inputmode=numeric] >> nth=1", "20000");
await page.fill("input[type=date]", new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10));
await page.locator("li:has-text('Garderobe') label:has-text('Må')").click();
await page.locator("li:has-text('Tilgjengelig med rullestol') label:has-text('Ønske')").click();
await shot("02-skjema");
await page.click("button[type=submit]");
await page.waitForSelector("text=Bekreft mobilnummeret ditt");
await page.fill("input[autocomplete=name]", "Test Testesen");
await page.fill("input[type=tel]", "987 65 432");
await page.click("text=Send kode på SMS");
const code = await page.locator(".notice strong").innerText();
await page.fill("input[autocomplete=one-time-code]", "000000");
await page.click("text=Bekreft og publiser");
await page.waitForSelector("text=Feil kode");
step("feil kode avvist");
await page.fill("input[autocomplete=one-time-code]", code);
await shot("03-kode");
await page.click("text=Bekreft og publiser");
await page.waitForURL(/\/mine\/.+\?ny=1/);
step("forespørsel publisert etter bekreftet nummer");

// 3. Lokalet logger inn med (simulert) BankID og sender tilbud
await loginVenue("Siri");
await shot("04-lokale-oversikt");
await page.locator(".request-row", { hasText: "Jubileum" }).click();
await page.locator("li:has-text('Garderobe') label:has-text('Ikke oppfylt')").click();
step("må-krav blokkerer: " + (await page.locator("button[type=submit]").isDisabled()));
await page.locator("li:has-text('Garderobe') label:has-text('Oppfylt') >> nth=0").click();
await page.locator("li:has-text('rullestol') label:has-text('Med forbehold')").click();
await page.fill("#pris", "18 500");
await page.fill("#inkludert", "Leie fra 18 til 01, bord, stoler og lydanlegg");
await page.click("button[type=submit]");
await page.waitForSelector(".form-error");
step("forklaring kreves: " + (await page.locator(".form-error").innerText()));
await page.fill("input[placeholder^='Forklar']", "Rampe ved bakinngangen");
await page.click("button[type=submit]");
await page.waitForURL(/tilbud\?sendt/);
step("tilbud sendt");

// 4. Kari logger inn med mobilnummer, åpner og sammenligner tilbud og aksepterer
await loginGuest("91234567");
await page.locator(".list-item", { hasText: "Bursdag" }).click();
await page.waitForSelector(".offer.teaser");
await page.locator(".offer.teaser button").first().click();
await page.locator(".offer.teaser").nth(1).waitFor({ state: "detached" });
await page.locator(".offer.teaser button").first().click();
await page.waitForSelector(".comparison");
await shot("05-sammenlign");
step("to tilbud åpnet og sammenlignet");
await page.locator(".offer", { hasText: "Bryggeloftet" }).locator("button", { hasText: "Aksepter" }).click();
await page.waitForSelector(".notice-card h2");
step("akseptert: " + (await page.locator(".notice-card h2").innerText()));

// 5. Lokalet bekrefter, og avtaledokumentet lages
await loginVenue("Siri");
await page.goto(B + "/lokale/tilbud");
await page.click("text=Bekreft booking");
await page.waitForURL(/avtale/);
await shot("06-avtale");
step("avtale: " + (await page.locator(".agreement h1").innerText()));

// 6. Den nye gjesten åpner tilbudet sitt
await loginGuest("98765432");
await page.locator(".list-item").first().click();
await page.locator(".offer.teaser button").first().click();
await page.waitForSelector(".offer .price");
step("nytt tilbud åpnet: " + (await page.locator(".offer .price").first().innerText()));

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
step("Lindekroa ser: " + (await page.locator(".request-row strong").allInnerTexts()).join(", "));

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
