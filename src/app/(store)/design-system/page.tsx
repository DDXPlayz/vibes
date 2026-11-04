export const metadata = { title: "Design system" };

const COLOURS = [
  { t: "--bg", n: "Ivory / Night", role: "Page" },
  { t: "--bg-2", n: "Stone", role: "Section" },
  { t: "--surface", n: "Paper", role: "Panels" },
  { t: "--ink", n: "Charcoal", role: "Text" },
  { t: "--ink-2", n: "Warm grey", role: "Body" },
  { t: "--ink-3", n: "Muted", role: "Labels" },
  { t: "--purple", n: "Aubergine", role: "Selected · 7%" },
  { t: "--gold", n: "Antique gold", role: "Accent · 3%" },
];

const MOTION = [
  { n: "Silk", v: "cubic-bezier(.33,0,.15,1)", d: "Default. Long, soft settle — reveals, hovers, theme." },
  { n: "Drape", v: "cubic-bezier(.65,0,.35,1)", d: "Symmetric — for things that travel: threads, sweeps." },
  { n: "Durations", v: "220 · 600 · 1200 · 1800 ms", d: "Feedback · state · entrance · editorial reveal." },
  { n: "Never", v: "bounce · overshoot · scale > 1.03", d: "Fabric settles; it does not spring." },
];

export default function DesignSystem() {
  return (
    <div className="wrap section">
      <span className="eyebrow">Design system</span>
      <h1 className="h1" style={{ marginTop: 24 }}>Quiet, <em>by design.</em></h1>
      <p className="lede" style={{ marginTop: 24 }}>Ninety per cent neutral. Seven per cent aubergine. Three per cent gold. Luxury from type, space and light — never ornament.</p>

      <Section title="Colour">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 20 }}>
          {COLOURS.map((c) => (
            <div key={c.t} className="stack" style={{ gap: 8 }}>
              <div style={{ aspectRatio: "1", background: `var(${c.t})`, boxShadow: "inset 0 0 0 1px var(--line)" }} />
              <span className="h4" style={{ fontSize: 20 }}>{c.n}</span>
              <span className="label">{c.t} · {c.role}</span>
            </div>
          ))}
        </div>
        <p className="body" style={{ marginTop: 24 }}>Switch the theme from the header: both modes are designed independently — light is a gallery by day, dark is the gallery after hours.</p>
      </Section>

      <Section title="Typography">
        <div className="stack">
          <div className="display" style={{ fontSize: "clamp(80px, 12vw, 180px)" }}>VIBES</div>
          <p className="label">Display · Cormorant Garamond 300 · tracked .06em</p>
          <h2 className="h1">Threads that <em>remember.</em></h2>
          <p className="label">H1 · Cormorant 300 · clamp(52–136px)</p>
          <h3 className="h3">Crafted once. Cherished for generations.</h3>
          <p className="label">H3 · Cormorant 400</p>
          <p className="lede">Every saree tells a story. The lede is set in the serif, at reading size, in warm grey.</p>
          <p className="body">Body and interface are set in Jost — a geometric sans that stays quiet at small sizes and holds wide tracking in uppercase labels.</p>
          <span className="eyebrow">Eyebrow label</span>
        </div>
      </Section>

      <Section title="Controls">
        <div className="row" style={{ flexWrap: "wrap", gap: 16 }}>
          <button className="btn">Add to bag</button>
          <button className="btn btn-ghost">Discover the craft</button>
          <button className="btn btn-gold">Add to collection</button>
          <button className="btn btn-sm">Small</button>
          <a className="link">Text link</a>
        </div>
        <div className="row" style={{ flexWrap: "wrap", gap: 10, marginTop: 28 }}>
          <span className="chip">Silk</span>
          <span className="chip on">Banarasi</span>
          <span className="badge available">One of one</span>
          <span className="badge reserved">Reserved</span>
          <span className="badge sold">In the archive</span>
          <span className="badge draft">Draft</span>
          <div className="seg"><button className="on">Grid</button><button>Editorial</button><button>3D</button></div>
        </div>
        <div className="grid-2" style={{ marginTop: 36, maxWidth: 720 }}>
          <label className="field"><span>Name</span><input className="input" placeholder="Raat ki Rani" /></label>
          <label className="field"><span>Weave</span><select className="select"><option>Banarasi</option><option>Jamdani</option></select></label>
          <label className="check"><input type="checkbox" defaultChecked /> Available now</label>
        </div>
      </Section>

      <Section title="Space">
        <div className="row" style={{ alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
          {[4, 8, 12, 16, 24, 32, 48, 72, 112, 168].map((s) => (
            <div key={s} className="stack" style={{ gap: 6, alignItems: "center" }}>
              <div style={{ width: s, height: s, background: "var(--purple-wash)", boxShadow: "inset 0 0 0 1px var(--purple)" }} />
              <span className="label">{s}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Motion">
        <dl className="kv">
          {MOTION.map((m) => (
            <div key={m.n} style={{ display: "contents" }}><dt>{m.n}</dt><dd><code>{m.v}</code> — {m.d}</dd></div>
          ))}
        </dl>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 120, borderTop: "1px solid var(--line)", paddingTop: 40, display: "grid", gridTemplateColumns: "200px 1fr", gap: 40 }}>
      <span className="eyebrow">{title}</span>
      <div>{children}</div>
    </section>
  );
}
