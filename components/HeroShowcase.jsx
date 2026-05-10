export function HeroShowcase() {
  return (
    <div className="hero-showcase" aria-label="3D trading card store display">
      <div className="showcase-curve showcase-curve-one" aria-hidden="true" />
      <div className="showcase-curve showcase-curve-two" aria-hidden="true" />
      <div className="display-plinth" aria-hidden="true" />

      <div className="pack-stack" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>

      <div className="graded-slab">
        <div className="slab-label">
          <span>Freaking Collectibles</span>
          <strong>Foil Pull - Gem</strong>
          <small>Verified condition</small>
          <b>10</b>
        </div>
        <div className="slab-card">
          <div className="card-title-row">
            <strong>Limited Foil</strong>
            <span>FC</span>
          </div>
          <div className="card-art">
            <span className="card-glow" />
            <span className="card-ribbon ribbon-one" />
            <span className="card-ribbon ribbon-two" />
            <span className="card-shine" />
          </div>
          <div className="card-lines">
            <span />
            <span />
            <span />
          </div>
        </div>
      </div>

      <div className="collector-box">
        <span className="box-badge">M</span>
        <strong>Freaking Collectibles</strong>
        <small>Trading Cards</small>
        <span className="box-wave wave-one" />
        <span className="box-wave wave-two" />
        <span className="box-wave wave-three" />
      </div>

      <div className="floating-card card-one" aria-hidden="true" />
      <div className="floating-card card-two" aria-hidden="true" />
    </div>
  );
}
