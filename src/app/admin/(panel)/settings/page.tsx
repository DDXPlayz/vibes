import { SettingsActions } from "@/components/admin/SettingsActions";
import { read } from "@/server/db";
import { currentSession } from "@/server/auth";

export const metadata = { title: "Settings" };

export default async function Settings() {
  const session = await currentSession();
  const { users, media } = await read((db) => ({ users: db.users.map(({ passwordHash: _, ...u }) => u), media: db.media }));
  const bytes = media.reduce((s, m) => s + m.bytes, 0);
  return (
    <div className="adm-grid" style={{ gap: 24 }}>
      <div className="adm-head" style={{ marginBottom: 0 }}>
        <div>
          <h1 className="adm-h1">Settings</h1>
          <p>People, roles and the services the studio runs on.</p>
        </div>
      </div>
      <div className="adm-card">
        <h2>People & roles</h2>
        <table className="adm-table">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Can</th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td><span className="adm-pill">{u.role}</span></td>
                <td className="adm-note">{u.role === "owner" ? "Everything, including resetting data" : u.role === "manager" ? "Products, content, studio defaults, deleting" : "Add & edit sarees, inventory, orders"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="adm-split">
        <div className="adm-card">
          <h2>Services</h2>
          <dl className="kv">
            <dt>Database</dt><dd>File store (.data/db.json) · PostgreSQL schema in prisma/schema.prisma</dd>
            <dt>Object storage</dt><dd>Local disk · {media.length} files, {(bytes / 1048576).toFixed(1)} MB · S3/R2 driver ready</dd>
            <dt>Payments</dt><dd>Prototype confirmation · Razorpay/Stripe webhook slot at /api/orders/[id]/pay</dd>
            <dt>Assistant</dt><dd>Deterministic suggestions · LLM-ready behind /api/admin/assist</dd>
            <dt>Rendering</dt><dd>In-browser WebGL render farm · headless worker-ready</dd>
          </dl>
        </div>
        <SettingsActions isOwner={session?.role === "owner"} />
      </div>
    </div>
  );
}
