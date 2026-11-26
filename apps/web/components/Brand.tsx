import Link from "next/link";

export function Brand({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="brand" aria-label="Lokalbud, til forsiden">
      <span className="brand-mark" aria-hidden="true" />
      Lokalbud
    </Link>
  );
}
