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

3. Åpne <http://localhost:3000> og velg «Fortsett som gjest» eller
   «Fortsett som lokale».
4. Stopp med Ctrl+C. For å hente siste versjon senere: `git pull` og så
   `pnpm install` og `pnpm dev` igjen.

Slik logger du inn i demoen:

- **Ny gjest:** fyll ut behovet og trykk «Publiser forespørselen». Den
  publiseres med en gang, uten mobilnummer, og vises straks hos lokalene.
  Nettleseren husker deg som gjest.
- **Eksisterende gjest:** «Se forespørslene dine» med mobilnummeret til Kari
  (912 34 567), Ola (412 34 567) eller Ingrid (900 00 001). Ingen kode i demoen.
- **Lokale:** «Logg inn med BankID» viser en simulert BankID der du velger
  testperson, for eksempel Siri i Bryggeloftet.

Forslag til gjennomgang:

- Som **gjest**: legg inn et behov på Grünerløkka med et må-krav.
- Som **Siri (Bryggeloftet)**: finn forespørselen, svar på kravene og send tilbud.
- Som **Kari**: åpne bursdagen, se tilbudene med bilder og kontaktperson,
  sammenlign og godta ett. Det er bindende med en gang, og en kopi av
  bestillingen sendes til begge (i demoen vises kopiene under Demoverktøy).
- Som **Siri**: se bookingen med gjestens kontaktinformasjon under «Våre tilbud».
- Som **Jonas (regnskap i Bryggeloftet)**: se fakturagrunnlaget.

Tips: bruk ett vanlig og ett privat nettleservindu for å være gjest og lokale
samtidig. «Demoverktøy» nederst på siden lar deg bytte rolle raskt og
nullstille dataene.

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
