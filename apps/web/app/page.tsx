import Link from "next/link";

export default function HomePage() {
  return (
    <section className="entry">
      <h1>Fester trenger lokaler. Lokaler trenger fester.</h1>
      <div className="entry-grid">
        <Link href="/ny-foresporsel" className="entry-card">
          <span className="entry-kicker">Jeg er gjest</span>
          <strong>Jeg trenger et lokale</strong>
          <span>
            Fortell hvor, når, hvor mange og hva du trenger. Lokalene som passer, sender deg tilbud.
            Gratis.
          </span>
          <span className="entry-cta">Fortsett som gjest</span>
        </Link>
        <Link href="/lokale/logg-inn" className="entry-card">
          <span className="entry-kicker">Jeg har et lokale</span>
          <strong>Jeg trenger gjester</strong>
          <span>
            Se hvem som leter etter lokale nå, og send tilbud på det som passer. Du betaler bare når
            gjesten åpner tilbudet.
          </span>
          <span className="entry-cta">Fortsett som lokale</span>
        </Link>
      </div>
    </section>
  );
}
