# Arkitektur

## Valg

| Del | Valg | Hvorfor |
|---|---|---|
| Nettside for gjester og nettportal for lokaler | Next.js med TypeScript | Serverkode og sider i samme prosjekt, strenge sikkerhetshoder per forespørsel, god støtte for mobil |
| Lokalapp | React Native (Expo), senere | Kan dele `packages/core` med nettsiden |
| Database og innlogging | Supabase i EU-region (Postgres) | Radnivåsikkerhet i databasen, SMS-innlogging og sanntid. Data lagres i EU |
| BankID for lokaler | Criipto eller Signicat (OpenID Connect) | Etablerte norske leverandører |
| Betaling for lokaler | Stripe eller Vipps, senere | Vi lagrer aldri kortdata selv |

## Prinsipper

1. **Én kilde til forretningsregler.** `packages/core` har reglene i TypeScript.
   Det som påvirker penger og tilbudsplasser, håndheves i tillegg i databasen
   med samme formel, og en test sjekker at de er like.
2. **Tilgang avgjøres i databasen.** Radnivåsikkerhet og serverfunksjoner med
   `security definer` bestemmer hvem som ser og gjør hva. Nettsiden kan ikke
   gi noen mer tilgang enn databasen tillater.
3. **Ingen persondata til lokaler før gjesten svarer.** Lokaler leser åpne
   forespørsler gjennom `open_requests_for_venues()`, som ikke gir ut gjestens
   id. Kontaktinformasjon ligger bare i `profiles`.
4. **Avtaler kan bevises.** Tilbudsversjoner og svar kan ikke endres eller
   slettes, og hver versjon har en SHA-256-kontrollsum.
5. **Én faktureringshendelse per tilbud.** Sikret med en unik nøkkel i databasen.
   Fakturering skjer bare når gjesten selv trykker for å åpne tilbudet.

## Dataflyt for et tilbud

1. Gjesten legger inn en forespørsel med krav merket som må-krav eller ønske.
2. Verifiserte lokaler ser forespørselen uten gjestens identitet.
3. Lokalet kaller `submit_offer()`. Funksjonen låser forespørselen, sjekker at
   alle krav er besvart, at alle må-krav er oppfylt og at det er ledig plass.
4. Gjesten trykker for å åpne tilbudet. `open_offer()` lager én
   faktureringshendelse, gratis for lokalets tre første.
5. Endringer gir en ny versjon med `revise_offer()`, uten ny fakturering.

## Demoversjonen

`apps/web/lib/demo` er et lager i minnet med oppdiktede data og rollevalg via en
informasjonskapsel. Det bruker de samme reglene fra `packages/core` som den ekte
løsningen, men erstatter innlogging og database. Det fjernes eller slås av før
produksjon, og skal byttes ut med kall til databasefunksjonene i `db/migrations`.

## Endring etter konseptnotat 4.3

Gjesten godtar et tilbud, og det er bindende med en gang. Lokalet bekrefter
ikke i et eget steg. I stedet setter lokalet en frist for hvor lenge tilbudet
gjelder, og holder datoen av til da. Lokalet kan trekke et tilbud som ikke er
godtatt. En kopi av bestillingen sendes til gjesten og kontaktpersonen hos
lokalet. Demoen har dette; databasefunksjonene i `db/migrations` må oppdateres
tilsvarende (gyldighetsfrist, `accept_offer`, `withdraw_offer` og utsending).

## Gjenstår

- Kobling mellom nettsiden og Supabase, og SMS-bekreftelse for gjester.
- Innlogging for lokaler med BankID og kontroll av representasjonsrett.
- Aksept, bekreftelse og avtaledokument.
- Varsler, lagrede søk og kostnadstak per tjeneste.
- Nettportalen for lokaler og lokalappen.
- Sletting og anonymisering av kontoer. Uforanderlige tabeller hindrer i dag
  sletting via kaskade, så dette må løses med anonymisering.
