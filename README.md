# Lokalbud

Omvendt markedsplass for selskapslokaler. Gjesten legger inn behovet sitt, og
lokalene som passer, sender tilbud. Konseptet er beskrevet i konseptnotatet
(versjon 4.3), som er styrende for alt i dette repoet.

> Status: under utvikling i lukket miljø. Ingen lokaler eller gjester skal
> kontaktes før alle lanseringskravene i `docs/SECURITY.md` er oppfylt.

## Innhold

| Mappe | Hva |
|---|---|
| `packages/core` | Forretningsregler uten avhengigheter til server eller nettleser: gebyr, krav og svar, hasteregler, validering av forespørsler |
| `apps/web` | Nettsiden (Next.js). Gjestedelen først, deretter nettportalen for lokaler |
| `db/migrations` | Databaseskjema for Postgres (Supabase), med radnivåsikkerhet og serverfunksjoner |
| `db/tests` | Tester av tilgangsstyring, tilbudsregler og fakturering mot en ekte Postgres |
| `docs` | Arkitektur og sikkerhetskrav |

## Prøv demoen på din egen maskin

Demoen har oppdiktede lokaler og gjester, og alt lagres bare i minnet. Du kan
bytte fritt mellom å være gjest og lokale.

1. Installer [Node.js 22 LTS](https://nodejs.org) og [Git](https://git-scm.com).
2. Åpne Terminal (Mac) eller PowerShell (Windows) og kjør:

   ```sh
   npm install -g corepack@latest
   corepack enable
   git clone https://github.com/martibal/lokalanbud.git
   cd lokalanbud
   pnpm install
   pnpm dev
   ```

   Den første linjen oppdaterer Corepack. Eldre utgaver av Node 22 har en
   Corepack med utgåtte nøkler, som gir feilen «Cannot find matching keyid».
   Svarer kommandoene med en feil om rettigheter på Mac, sett `sudo` foran.

3. Åpne <http://localhost:3000/demo> i nettleseren og velg en rolle.
4. Stopp med Ctrl+C. For å hente siste versjon senere: `git pull` og så
   `pnpm install` og `pnpm dev` igjen.

Forslag til gjennomgang:

- Som **Kari** (gjest): åpne bursdagen, åpne de to tilbudene, sammenlign dem og
  aksepter ett.
- Som **Bryggeloftet** (Siri): bekreft bookingen under «Våre tilbud» og se
  avtaledokumentet.
- Som **Kari**: legg inn et nytt behov på Grünerløkka med et må-krav.
- Som **Bryggeloftet**: finn forespørselen, svar på kravene og send tilbud.
- Som **Bryggeloftet** (Jonas, regnskap): se fakturagrunnlaget.

Tips: bruk ett vanlig og ett privat nettleservindu for å være gjest og lokale
samtidig. «Nullstill demoen» på rollesiden starter på nytt.

## Kom i gang for utviklere

Krever Node 22, pnpm 10 og Postgres 16 lokalt.

```sh
pnpm install
pnpm test          # enhetstester
pnpm typecheck
pnpm test:db       # databasetester, se under
pnpm dev           # nettsiden på http://localhost:3000
pnpm --filter @lokalbud/web test:e2e   # hele demoflyten i Chrome, mot en kjørende server
```

Databasetestene oppretter en egen, midlertidig database for hver kjøring og
sletter den etterpå. De kobler til med `DATABASE_ADMIN_URL`, som standard
`postgres://postgres:postgres@localhost:5432/postgres`.

## Regler for arbeidet

- Forretningsregler skrives i `packages/core` og håndheves på nytt i databasen.
  Klienten er aldri eneste kontroll.
- Alt som påvirker penger, tilbudsplasser eller avtaler, skjer i
  serverfunksjoner med tester.
- Hver ny tabell får radnivåsikkerhet. En test feiler hvis det glemmes.
- Ingen hemmeligheter i koden. Bruk miljøvariabler, se `.env.example`.
