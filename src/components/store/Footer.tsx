import Link from "next/link";

export function Footer() {
  return (
    <footer className="footer">
      <div className="wrap">
        <div className="footer-grid">
          <div>
            <div className="wordmark" style={{ fontSize: 30 }}>VIBES</div>
            <p className="serif italic" style={{ fontSize: 24, margin: "14px 0 0", color: "var(--ink-2)" }}>Love your legacy.</p>
            <p className="body" style={{ marginTop: 20, fontSize: 13 }}>A house of handloom sarees. Every piece woven by hand, recorded once, and kept in our archive — even after it finds its home.</p>
          </div>
          <div>
            <h4 className="label">The house</h4>
            <ul>
              <li><Link href="/collection">Collection</Link></li>
              <li><Link href="/collection?availability=archive">Archive</Link></li>
              <li><Link href="/craft">The craft</Link></li>
              <li><Link href="/artisans">Artisans</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="label">Care</h4>
            <ul>
              <li><Link href="/craft#care">Caring for handloom</Link></li>
              <li><Link href="/bag">Your bag</Link></li>
              <li><Link href="/wishlist">Your collection</Link></li>
              <li><Link href="/design-system">Design system</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="label">Visit</h4>
            <ul>
              <li>By appointment</li>
              <li>Mumbai · Kolkata</li>
              <li><a href="mailto:house@vibes.in">house@vibes.in</a></li>
              <li><Link href="/admin">Studio login</Link></li>
            </ul>
          </div>
        </div>
        <hr className="rule" style={{ margin: "72px 0 20px" }} />
        <div className="row label" style={{ fontSize: 10 }}>
          <span>© {new Date().getFullYear()} Vibes Handloom</span>
          <span className="spacer" />
          <span>Handwoven in India</span>
        </div>
      </div>
    </footer>
  );
}
