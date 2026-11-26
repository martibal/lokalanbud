import Link from "next/link";

const isProductionStage = process.env.LOKALBUD_STAGE === "production";

export function SiteFooter({ narrow = false }: { narrow?: boolean }) {
  return (
    <footer className={narrow ? "site-footer shell narrow" : "site-footer shell"}>
      <p>Lokalbud formidler. Avtalen inngås mellom gjesten og lokalet.</p>
      {!isProductionStage && (
        <p>
          <Link href="/demo">Demoverktøy</Link> lar deg bytte rolle raskt og nullstille dataene.
        </p>
      )}
    </footer>
  );
}
