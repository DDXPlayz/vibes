import { date, price } from "@/lib/format";
import { read } from "@/server/db";

export const metadata = { title: "Customers" };

export default async function Customers() {
  const rows = await read((db) =>
    db.customers.map((c) => {
      const os = db.orders.filter((o) => o.customerId === c.id && o.status !== "cancelled");
      return { ...c, orders: os.length, value: os.filter((o) => o.status !== "pending").reduce((s, o) => s + o.total, 0), last: os.map((o) => o.createdAt).sort().pop() };
    }),
  );
  return (
    <div>
      <div className="adm-head">
        <div>
          <h1 className="adm-h1">Customers</h1>
          <p>{rows.length} people who have chosen a piece from the house.</p>
        </div>
      </div>
      <div className="adm-card adm-table-wrap" style={{ padding: 0 }}>
        <table className="adm-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>City</th>
              <th>Orders</th>
              <th>Lifetime value</th>
              <th>Last order</th>
              <th>Since</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td><span className="serif" style={{ fontSize: 18 }}>{c.name}</span></td>
                <td>{c.email}</td>
                <td>{c.city ?? "—"}</td>
                <td>{c.orders}</td>
                <td>{price(c.value)}</td>
                <td className="adm-note">{c.last ? date(c.last) : "—"}</td>
                <td className="adm-note">{date(c.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
