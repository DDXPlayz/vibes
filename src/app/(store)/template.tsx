/** Re-mounts per navigation: every page arrives with the same soft settle. */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
