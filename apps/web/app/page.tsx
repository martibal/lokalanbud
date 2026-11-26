import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";

export default function HomePage() {
  return (
    <>
      <main>
        <section className="split" aria-label="Velg hvordan du vil bruke Lokalbud">
          <Link href="/ny-foresporsel" className="split-side split-guest">
            <div className="split-top">
              <span className="brand" aria-hidden="true">
                <span className="brand-mark" />
                Lokalbud
              </span>
            </div>
            <div>
              <h1 className="split-headline">Fester trenger lokaler.</h1>
            </div>
            <div>
              <p className="split-body">
                Si hvor, når og hvor mange dere blir. Lokalene som passer, sender deg tilbud. Gratis for deg.
              </p>
            </div>
            <span className="split-cta">Finn lokale</span>
          </Link>
          <Link href="/lokale/logg-inn" className="split-side split-venue">
            <div className="split-top" aria-hidden="true" />
            <div>
              <h2 className="split-headline">Lokaler trenger fester.</h2>
            </div>
            <div>
              <p className="split-body">
                Se hvem som leter etter lokale akkurat nå, og send tilbud på det som passer. Du betaler bare når gjesten
                åpner tilbudet.
              </p>
            </div>
            <span className="split-cta">Finn gjester</span>
          </Link>
        </section>

        <section className="how shell" aria-label="Slik fungerer det">
          <div>
            <h2>For deg som skal ha fest</h2>
            <ol>
              <li>
                <div>
                  <strong>Fortell hva festen trenger</strong>
                  <span>Bydel, dato, antall gjester, makspris og hva som må være på plass.</span>
                </div>
              </li>
              <li>
                <div>
                  <strong>Få opptil tre tilbud</strong>
                  <span>Hvert lokale svarer på hvert krav, så tilbudene kan sammenlignes rett fram.</span>
                </div>
              </li>
              <li>
                <div>
                  <strong>Velg, og få avtalen skriftlig</strong>
                  <span>Du og lokalet får det samme avtaledokumentet når lokalet har bekreftet.</span>
                </div>
              </li>
            </ol>
          </div>
          <div className="venue">
            <h2>For deg som har lokale</h2>
            <ol>
              <li>
                <div>
                  <strong>Se etterspørselen</strong>
                  <span>Alle åpne forespørsler i Oslo, med budsjett, dato og antall gjester.</span>
                </div>
              </li>
              <li>
                <div>
                  <strong>Send tilbud på to minutter</strong>
                  <span>Kryss av for hvert krav, sett pris og send. Passer det ikke, koster det ingenting.</span>
                </div>
              </li>
              <li>
                <div>
                  <strong>Betal bare for tilbud som blir lest</strong>
                  <span>0,75 % av budsjettet, minst 19 og maks 499 kr. De tre første er gratis.</span>
                </div>
              </li>
            </ol>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
