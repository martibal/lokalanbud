import Link from "next/link";

export default function HomePage() {
  return (
    <section className="hero">
      <h1>Fester trenger lokaler. Lokaler trenger fester.</h1>
      <p className="lead">
        Fortell hva festen trenger. Lokalene som passer, sender deg tilbud, og du velger.
      </p>
      <Link href="/ny-foresporsel" className="button button-primary">
        Legg inn behovet ditt
      </Link>
      <ol className="steps">
        <li>
          <strong>Fyll ut behovet</strong>
          <span>Dato, antall gjester, område, budsjett og hva som er viktig for deg.</span>
        </li>
        <li>
          <strong>Få opptil tre tilbud</strong>
          <span>Hvert lokale svarer på hvert krav, slik at tilbudene kan sammenlignes.</span>
        </li>
        <li>
          <strong>Velg og bekreft</strong>
          <span>Du og lokalet får samme avtaledokument. Det er gratis for deg.</span>
        </li>
      </ol>
    </section>
  );
}
