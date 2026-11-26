import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export default function VenueLoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className="page shell narrow">{children}</main>
      <SiteFooter narrow />
    </>
  );
}
