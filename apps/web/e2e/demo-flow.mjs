// Gjennomkjøring av hele demoflyten i en ekte nettleser, som gjest og som lokale.
// Start nettsiden først (pnpm build && pnpm start), og kjør så: pnpm test:e2e
// Miljøvariabler: BASE_URL, CHROME_PATH (sti til Chrome), SCREENSHOT_DIR.
import { chromium } from "playwright-core";
const B = process.env.BASE_URL ?? "http://localhost:3000";
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const problems = [];
page.on("console", (m) => { if (m.type() === "error") problems.push(m.text()); });
page.on("response", (r) => { if (r.status() >= 400) problems.push(r.status() + " " + r.url()); });
page.on("pageerror", (e) => problems.push("pageerror " + e.message));
const shot = (n) => page.screenshot({ path: `${process.env.SCREENSHOT_DIR ?? "/tmp"}/lokalbud-${n}.png`, fullPage: true });
const as = async (name) => { await page.goto(B + "/demo"); await page.locator("button.role-card", { hasText: name }).first().click(); await page.waitForURL((u) => !u.pathname.startsWith("/demo")); await page.waitForLoadState("networkidle"); };
const step = (s) => console.log("✓", s);

await page.goto(B + "/demo"); await shot("01-demo");
await as("Kari Nordmann"); await shot("02-mine");
await page.click(".list-item"); await page.waitForLoadState("networkidle"); await shot("03-tilbud-lukket");
const before = await page.locator(".offer.teaser").count();
await page.locator(".offer.teaser button").first().click(); await page.locator(".offer.teaser").nth(before - 1).waitFor({ state: "detached" });
await page.locator(".offer.teaser button").first().click(); await page.waitForSelector(".comparison");
step(`åpnet ${before} tilbud, sammenligning: ${await page.locator(".comparison").count()}`);
await shot("04-sammenlign");
const reqUrl = page.url();
await page.locator(".offer", { hasText: "Bryggeloftet" }).locator("button", { hasText: "Aksepter" }).click();
await page.waitForSelector(".notice-card h2");
step("akseptert: " + (await page.locator(".notice-card h2").innerText()));

await as("Bryggeloftet"); // Siri
await page.goto(B + "/lokale/tilbud"); await shot("05-lokale-tilbud");
await page.click("text=Bekreft booking"); await page.waitForURL(/avtale/);
step("avtale: " + (await page.locator(".agreement h1").innerText()));
await shot("06-avtale");

// Kari legger inn nytt behov på Grünerløkka
await as("Kari Nordmann");
await page.goto(B + "/ny-foresporsel");
await page.selectOption("select >> nth=0", "anniversary");
await page.fill("input[inputmode=numeric] >> nth=0", "70");
await page.fill("input[type=date]", new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10));
await page.click("label.chip:has-text('Grünerløkka')");
await page.fill("input[inputmode=numeric] >> nth=1", "20000");
await page.locator("li:has-text('Garderobe') label:has-text('Må')").click();
await page.locator("li:has-text('Tilgjengelig med rullestol') label:has-text('Ønske')").click();
await page.click("button[type=submit]");
await page.waitForSelector(".success");
await page.click("text=Se forespørselen"); await page.waitForLoadState("networkidle");
step("ny forespørsel opprettet");

// Siri ser den og sender tilbud, først med et må-krav som ikke er oppfylt
await as("Bryggeloftet");
await shot("07-lokale-oversikt");
const n = await page.locator(".request-row").count();
await page.locator(".request-row", { hasText: "Jubileum" }).click(); await page.waitForLoadState("networkidle");
await page.locator("li:has-text('Garderobe') label:has-text('Ikke oppfylt')").click();
step("må-krav blokkerer: " + (await page.locator("button[type=submit]").isDisabled()));
await page.locator("li:has-text('Garderobe') label:has-text('Oppfylt') >> nth=0").click();
await page.locator("li:has-text('rullestol') label:has-text('Med forbehold')").click();
await page.fill("#pris", "18 500");
await page.fill("#inkludert", "Leie fra 18 til 01, bord, stoler og lydanlegg");
await page.click("button[type=submit]");
await page.waitForSelector(".form-error");
step("forklaring kreves: " + (await page.locator(".form-error").innerText().catch(() => "-")));
await page.fill("input[placeholder^='Forklar']", "Rampe ved bakinngangen");
await shot("08-svarskjema");
await page.click("button[type=submit]"); await page.waitForURL(/tilbud\?sendt/);
step(`tilbud sendt (${n} forespørsler i oversikten)`);

// Kari åpner det nye tilbudet
await as("Kari Nordmann");
await page.click(".list-item >> nth=0"); await page.waitForLoadState("networkidle");
await page.locator(".offer.teaser button").first().click(); await page.waitForSelector(".offer .price");
step("nytt tilbud åpnet: " + (await page.locator(".offer .price").first().innerText()));

// Regnskap ser fakturagrunnlaget, booking får ikke
await as("Jonas");
await page.goto(B + "/lokale/faktura"); await shot("09-faktura");
step("faktura: " + (await page.locator(".stat strong").allInnerTexts()).join(" | "));
await as("Siri"); await page.goto(B + "/lokale/faktura");
step("booking sendt videre fra faktura til: " + new URL(page.url()).pathname);

// Lindekroa ser Ingrids konfirmasjon
await as("Lindekroa"); step("Lindekroa ser: " + (await page.locator(".request-row strong").allInnerTexts()).join(", "));

console.log("Konsollfeil:", problems);
await browser.close();
if (problems.length > 0) process.exit(1);
