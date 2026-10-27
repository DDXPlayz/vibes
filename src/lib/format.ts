const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
export const price = (n: number) => inr.format(n);
export const num = (n: number) => String(n).padStart(3, "0");
export const date = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
