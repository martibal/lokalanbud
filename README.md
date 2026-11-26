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

## Kom i gang

Krever Node 22, pnpm 10 og Postgres 16 lokalt.

```sh
pnpm install
pnpm test          # enhetstester
pnpm typecheck
pnpm test:db       # databasetester, se under
pnpm dev           # nettsiden på http://localhost:3000
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
