import { redirect } from "next/navigation";
import { AdminNav, AdminTop } from "@/components/admin/AdminNav";
import { currentSession } from "@/server/auth";

export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const session = await currentSession();
  if (!session) redirect("/admin/login");
  return (
    <div className="adm">
      <aside className="adm-side">
        <div className="adm-brand">
          <span className="wordmark" style={{ fontSize: 20 }}>VIBES</span>
          <span className="label" style={{ fontSize: 9.5 }}>Studio</span>
        </div>
        <AdminNav />
        <div className="adm-user">
          <span>{session.name}</span>
          <span className="adm-pill" style={{ justifySelf: "start" }}>{session.role}</span>
        </div>
      </aside>
      <div className="adm-main">
        <AdminTop name={session.name} />
        <div className="adm-page">{children}</div>
      </div>
    </div>
  );
}
