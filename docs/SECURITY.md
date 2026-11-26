# Sikkerhetskrav

Kravene kommer fra avsnittet «Sikkerhet og compliance» i konseptnotatet.
Minstestandard er OWASP ASVS nivå 2, og nivå 3 for innlogging og tilgangsstyring.

Status: **på plass** betyr implementert og dekket av en automatisk test.

## Tilgang og data

| Krav | Status | Hvor |
|---|---|---|
| Radnivåsikkerhet på alle tabeller | På plass | `db/migrations/0001_core.sql`, test i `db/tests` |
| Lokaler ser aldri andre lokalers tilbud eller priser | På plass | RLS, test |
| Lokaler ser aldri gjestens id eller kontaktinformasjon | På plass | `open_requests_for_venues()`, test |
| Anonyme brukere har ingen tilgang | På plass | Rettigheter, test |
| Bruker kan ikke selv sette telefonnummer som verifisert | På plass | Kolonnerettigheter, test |
| Priser, gebyrer og tilbudsplasser beregnes bare på serveren | På plass | `submit_offer()`, `open_offer()`, test |
| Én faktureringshendelse per tilbud | På plass | Unik nøkkel, test med samtidige åpninger |
| Siste tilbudsplass avgjøres i én transaksjon | På plass | Radlås, test med fem samtidige tilbud |
| Akseptert avtaleversjon låst med kontrollsum | Delvis | Versjoner er låst og har kontrollsum. Aksept gjenstår |
| Uforanderlig revisjonslogg | På plass | Trigger, ingen lesetilgang for brukere |
| Data lagret i EU/EØS | Gjenstår | Velges ved oppsett av Supabase |
| Automatisk sletting etter fast lagringstid | Gjenstår | |

## Nettsiden

| Krav | Status | Hvor |
|---|---|---|
| Streng Content-Security-Policy med nonce per visning | På plass | `apps/web/proxy.ts` |
| HSTS, nosniff, ingen innramming, Referrer- og Permissions-Policy | På plass | `apps/web/next.config.ts` |
| All input valideres på nytt på serveren, ukjente felt avvises | På plass | `requestInputSchema`, test |
| Fritekst renses for kontrolltegn og vises aldri som HTML | På plass | `cleanText`, React escaper all tekst |
| Fakturering bare ved bevisst trykk, aldri ved forhåndsvisning av lenker | Gjenstår | Visningen av tilbud er ikke laget ennå |

## Drift

| Krav | Status |
|---|---|
| Kostnadstak per tjeneste, varsling ved 50 og 80 %, nødstopp | Gjenstår |
| Begrensning per konto, IP og enhet | Gjenstår |
| Kontinuerlig sikkerhetskopi, testet gjenoppretting | Gjenstår |
| Skanning av avhengigheter og hemmeligheter ved hver endring | Delvis, se CI |

## Krav før lansering

Løsningen settes ikke i produksjon, og ingen lokaler eller gjester kontaktes,
før alle punktene i konseptnotatet er oppfylt, blant annet uavhengig
penetrasjonstest, juridisk gjennomgang, øvd beredskapsplan og testet
gjenoppretting.
