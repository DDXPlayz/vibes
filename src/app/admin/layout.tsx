import "./admin.css";

export const metadata = { title: { default: "Studio", template: "%s · VIBES Studio" }, robots: { index: false } };

export default function AdminRoot({ children }: { children: React.ReactNode }) {
  return children;
}
