/**
 * The Home hero backdrop: a night ridge line drawn in SVG (no photograph to
 * license or load). Three ranges, one per business, under one sky.
 */
export function HeroScene() {
  return (
    <svg className="hero-scene" viewBox="0 0 1440 420" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <defs>
        <linearGradient id="hero-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#050914" /><stop offset="0.55" stopColor="#0d1a3a" /><stop offset="1" stopColor="#1b2f63" />
        </linearGradient>
        <radialGradient id="hero-glow" cx="0.72" cy="0.9" r="0.6">
          <stop offset="0" stopColor="#4f86ff" stopOpacity="0.55" /><stop offset="0.5" stopColor="#2f6bff" stopOpacity="0.14" /><stop offset="1" stopColor="#2f6bff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="hero-far" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#22386f" /><stop offset="1" stopColor="#0f1c3d" /></linearGradient>
        <linearGradient id="hero-mid" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#14254f" /><stop offset="1" stopColor="#0a142d" /></linearGradient>
        <linearGradient id="hero-near" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0b1530" /><stop offset="1" stopColor="#050914" /></linearGradient>
      </defs>
      <rect width="1440" height="420" fill="url(#hero-sky)" />
      <rect width="1440" height="420" fill="url(#hero-glow)" />
      <g fill="#dbe6ff">
        {[[120, 60, 1.1], [260, 110, 0.8], [410, 40, 1], [560, 90, 0.7], [700, 30, 1.2], [860, 70, 0.8], [1010, 36, 1], [1150, 96, 0.7], [1290, 52, 1.1], [1380, 120, 0.8], [340, 150, 0.6], [960, 140, 0.6]].map(([cx, cy, r]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} opacity="0.7" />
        ))}
      </g>
      <path d="M0 300 L120 250 L210 276 L330 196 L420 246 L520 170 L610 232 L720 150 L810 214 L900 176 L1010 240 L1110 160 L1210 228 L1320 188 L1440 250 L1440 420 L0 420 Z" fill="url(#hero-far)" />
      <path d="M0 340 L140 300 L250 322 L380 262 L500 312 L640 250 L760 306 L880 268 L1000 318 L1140 256 L1260 304 L1360 276 L1440 300 L1440 420 L0 420 Z" fill="url(#hero-mid)" />
      <path d="M0 386 L160 356 L300 376 L460 340 L620 374 L780 346 L940 380 L1100 350 L1260 378 L1440 354 L1440 420 L0 420 Z" fill="url(#hero-near)" />
    </svg>
  );
}
