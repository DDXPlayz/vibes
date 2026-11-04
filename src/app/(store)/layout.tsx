import { Footer } from "@/components/store/Footer";
import { Header } from "@/components/store/Header";
import { StoreProvider } from "@/components/store/StoreProvider";
import { Toast } from "@/components/store/Toast";
import { siteContent } from "@/server/catalog";

export const dynamic = "force-dynamic";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const content = await siteContent();
  return (
    <StoreProvider>
      {content.banner.enabled && <div className="banner">{content.banner.text}</div>}
      <Header />
      <main>{children}</main>
      <Footer />
      <Toast />
    </StoreProvider>
  );
}
