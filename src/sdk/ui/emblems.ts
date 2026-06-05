// src/sdk/ui/emblems.ts — Disco Persian heraldry. Bespoke geometric SVG emblems per game.
// All figures use currentColor for the game accent + gold/steel accents. Ported from the design pack.
const GOLD = '#f4c64d',
  GOLD_LT = '#ffe6a6',
  GOLD_DK = '#c9912a',
  DARK = '#0b0922';

/** iOS Safari will not render an inline <svg> injected via innerHTML/dangerouslySetInnerHTML
 *  unless the root carries the SVG namespace. Chrome infers it; Safari doesn't. Inject xmlns. */
const fixSvg = (s: string): string =>
  /<svg[^>]*\bxmlns=/.test(s) ? s : s.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');

const onCircle = (cx: number, cy: number, r: number, a: number): [number, number] => [
  cx + r * Math.cos(a),
  cy + r * Math.sin(a),
];

function sunRays(cx: number, cy: number, rIn: number, rOut: number, n: number, color: string): string {
  let out = '';
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    if (i % 2 === 0) {
      const [xt, yt] = onCircle(cx, cy, rOut, a);
      const [xa, ya] = onCircle(cx, cy, rIn, a - 0.13);
      const [xb, yb] = onCircle(cx, cy, rIn, a + 0.13);
      out += `<path d="M${xa.toFixed(1)} ${ya.toFixed(1)} L${xt.toFixed(1)} ${yt.toFixed(1)} L${xb.toFixed(1)} ${yb.toFixed(1)} Z" fill="${color}"/>`;
    } else {
      const [xt, yt] = onCircle(cx, cy, rOut - (rOut - rIn) * 0.32, a);
      const [xa, ya] = onCircle(cx, cy, rIn, a - 0.06);
      const [xb, yb] = onCircle(cx, cy, rIn, a + 0.06);
      out += `<path d="M${xa.toFixed(1)} ${ya.toFixed(1)} L${xt.toFixed(1)} ${yt.toFixed(1)} L${xb.toFixed(1)} ${yb.toFixed(1)} Z" fill="${color}" opacity=".85"/>`;
    }
  }
  return out;
}

function grid(cells: [number, number][], color: string): string {
  let out = '';
  for (const [x, y] of cells) out += `<rect x="${x}" y="${y}" width="15" height="15" rx="3.5" fill="${color}"/>`;
  return out;
}

const EMBLEMS: Record<string, string> = {};

EMBLEMS['spy-grid'] = `<svg viewBox="0 0 100 100">
  <g opacity=".9">${grid([[12, 12], [34, 12], [56, 12], [78, 12], [12, 34], [78, 34], [12, 56], [78, 56], [12, 78], [34, 78], [56, 78], [78, 78]], 'currentColor')}</g>
  <g opacity=".45">${grid([[34, 34], [56, 34], [34, 56], [56, 56]], 'currentColor')}</g>
  <g transform="translate(50 50)">
    <path d="M0 -26 L7 -8 26 0 7 8 0 26 -7 8 -26 0 -7 -8 Z" fill="${GOLD}"/>
    <path d="M0 -18 L5 -5 18 0 5 5 0 18 -5 5 -18 0 -5 -5 Z" fill="${GOLD_LT}" transform="rotate(45)"/>
    <circle r="4" fill="currentColor"/>
  </g>
</svg>`;

EMBLEMS['dowr'] = (() => {
  const cx = 50,
    cy = 50,
    r = 30;
  const P = (deg: number, rad = r): [number, number] => onCircle(cx, cy, rad, (deg * Math.PI) / 180);
  const a0 = 130,
    a1 = 60;
  const [sx, sy] = P(a0),
    [ex, ey] = P(a1);
  const tx = Math.cos(((a1 + 90) * Math.PI) / 180),
    ty = Math.sin(((a1 + 90) * Math.PI) / 180);
  const tip = [ex + tx * 9, ey + ty * 9];
  const nx = -ty,
    ny = tx;
  const baseA = [ex + nx * 7, ey + ny * 7],
    baseB = [ex - nx * 7, ey - ny * 7];
  let dots = '';
  for (let i = 0; i <= 5; i++) {
    const a = a0 + (i / 5) * 290;
    const [x, y] = onCircle(cx, cy, r, (a * Math.PI) / 180);
    dots += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.4" fill="${GOLD}"/>`;
  }
  return `<svg viewBox="0 0 100 100">
    <path d="M${sx.toFixed(1)} ${sy.toFixed(1)} A${r} ${r} 0 1 1 ${ex.toFixed(1)} ${ey.toFixed(1)}" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"/>
    <path d="M${tip[0].toFixed(1)} ${tip[1].toFixed(1)} L${baseA[0].toFixed(1)} ${baseA[1].toFixed(1)} L${baseB[0].toFixed(1)} ${baseB[1].toFixed(1)} Z" fill="currentColor"/>
    ${dots}
    <g transform="translate(50 50)"><circle r="7.5" fill="${GOLD}"/><path d="M0 -4.5 L1.4 -1.4 4.5 0 1.4 1.4 0 4.5 -1.4 1.4 -4.5 0 -1.4 -1.4 Z" fill="${DARK}"/></g>
  </svg>`;
})();

EMBLEMS['heads-up'] = `<svg viewBox="0 0 100 100">
  <circle cx="50" cy="56" r="32" fill="currentColor"/>
  <circle cx="50" cy="56" r="32" fill="none" stroke="${GOLD}" stroke-width="2"/>
  <clipPath id="hu-head"><circle cx="50" cy="56" r="31"/></clipPath>
  <g clip-path="url(#hu-head)">
    <rect x="18" y="26" width="64" height="20" rx="4" fill="${GOLD}"/>
    <rect x="18" y="26" width="64" height="20" rx="4" fill="none" stroke="${GOLD_DK}" stroke-width="1.4"/>
    <path d="M50 30 l2.6 6 6.4 0 -5 4.2 1.8 6.4 -5.8 -4 -5.8 4 1.8 -6.4 -5 -4.2 6.4 0 Z" fill="${DARK}"/>
  </g>
  <g fill="${DARK}"><circle cx="40" cy="60" r="3.4"/><circle cx="60" cy="60" r="3.4"/></g>
  <path d="M39 71 Q50 81 61 71" stroke="${DARK}" stroke-width="3.4" fill="none" stroke-linecap="round"/>
</svg>`;

EMBLEMS['mafia'] = `<svg viewBox="0 0 100 100">
  <g>${sunRays(50, 50, 30, 44, 16, 'currentColor')}</g>
  <circle cx="50" cy="50" r="30" fill="${DARK}"/>
  <path d="M50 20 A30 30 0 0 0 50 80 Z" fill="currentColor"/>
  <g stroke="${DARK}" stroke-width="2.4" fill="none" stroke-linecap="round"><path d="M30 45 q5 -4 10 0"/><path d="M32 60 q8 5 14 0"/></g>
  <path d="M66 38 A15 15 0 1 0 66 64 A11 11 0 1 1 66 38 Z" fill="${GOLD}"/>
  <g fill="${GOLD_LT}"><circle cx="60" cy="34" r="1.8"/><circle cx="74" cy="56" r="1.6"/><circle cx="58" cy="66" r="1.4"/></g>
</svg>`;

EMBLEMS['most-likely-to'] = `<svg viewBox="0 0 100 100">
  <g fill="currentColor">
    <rect x="40" y="14" width="15" height="42" rx="7.5"/>
    <rect x="34" y="44" width="40" height="36" rx="13"/>
    <circle cx="59" cy="46" r="7"/><circle cx="68" cy="49" r="6.5"/>
    <path d="M34 56 q-11 -3 -13 6 q-1 7 7 8 q7 0 10 -6 Z"/>
  </g>
  <g fill="none" stroke="${GOLD}" stroke-width="2" stroke-linejoin="round"><path d="M40 30 L40 21 a7.5 7.5 0 0 1 15 0 L55 44"/><path d="M21 62 q-1 7 7 8 q7 0 10 -6"/></g>
  <rect x="33" y="74" width="42" height="11" rx="4" fill="${GOLD}"/>
  <rect x="43" y="18" width="9" height="8" rx="3.5" fill="${GOLD_LT}"/>
  <path d="M47 1 l1.6 4 4 1.6 -4 1.6 -1.6 4 -1.6 -4 -4 -1.6 4 -1.6 Z" fill="${GOLD_LT}"/>
</svg>`;

EMBLEMS['nhie'] = `<svg viewBox="0 0 100 100">
  <rect x="34" y="46" width="32" height="34" rx="12" fill="currentColor" stroke="${GOLD}" stroke-width="1.6"/>
  <g fill="currentColor" stroke="${GOLD}" stroke-width="1.5">
    <rect x="35" y="22" width="8.5" height="32" rx="4.2"/><rect x="45" y="16" width="8.5" height="38" rx="4.2"/>
    <rect x="55" y="20" width="8.5" height="34" rx="4.2"/><rect x="64" y="28" width="8" height="28" rx="4"/>
  </g>
  <path d="M34 60 q-12 -2 -14 8 q-1 7 8 8 q8 1 12 -6 Z" fill="currentColor" stroke="${GOLD}" stroke-width="1.5"/>
  <circle cx="50" cy="64" r="6" fill="none" stroke="${GOLD}" stroke-width="2.4"/>
  <circle cx="50" cy="64" r="2.2" fill="${GOLD_LT}"/>
</svg>`;

EMBLEMS['pantomime'] = `<svg viewBox="0 0 100 100">
  <path d="M26 22 Q50 16 74 22 Q80 50 68 74 Q58 90 50 90 Q42 90 32 74 Q20 50 26 22 Z" fill="currentColor" stroke="${GOLD}" stroke-width="2"/>
  <path d="M33 46 Q40 38 48 46 Q40 52 33 46 Z" fill="${DARK}"/>
  <path d="M52 46 Q60 38 67 46 Q60 52 52 46 Z" fill="${DARK}"/>
  <g stroke="${GOLD}" stroke-width="2.6" fill="none" stroke-linecap="round"><path d="M32 38 q8 -6 16 -1"/><path d="M52 37 q8 -5 16 1"/></g>
  <path d="M40 66 Q50 78 60 66 Q50 72 40 66 Z" fill="${DARK}"/>
  <g fill="${GOLD}"><circle cx="24" cy="48" r="4"/><circle cx="76" cy="48" r="4"/></g>
</svg>`;

EMBLEMS['spyfall'] = `<svg viewBox="0 0 100 100">
  <path d="M8 50 Q50 16 92 50 Q50 84 8 50 Z" fill="${DARK}" stroke="currentColor" stroke-width="3"/>
  <circle cx="50" cy="50" r="20" fill="currentColor"/>
  <circle cx="50" cy="50" r="20" fill="none" stroke="${GOLD}" stroke-width="1.6"/>
  <path d="M50 64 C40 62 36 53 41 46 C45 41 53 41 56 46 C58 50 55 53 51 52 C49 51 49 48 51 47 C46 46 43 51 44 57 C45 60 47 62 50 64 Z" fill="${DARK}"/>
  <circle cx="55" cy="44" r="3" fill="${GOLD_LT}"/>
  <g stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><line x1="50" y1="22" x2="50" y2="14"/><line x1="30" y1="28" x2="26" y2="21"/><line x1="70" y1="28" x2="74" y2="21"/></g>
</svg>`;

EMBLEMS['truth-or-dare'] = `<svg viewBox="0 0 100 100">
  <g>${sunRays(50, 50, 26, 42, 16, 'currentColor')}</g>
  <circle cx="50" cy="50" r="26" fill="${GOLD}"/>
  <circle cx="50" cy="50" r="26" fill="none" stroke="${GOLD_DK}" stroke-width="1.6"/>
  <path d="M50 50 L50 24 A26 26 0 0 1 73 56 Z" fill="currentColor" opacity=".5"/>
  <path d="M50 50 L33 70 A26 26 0 0 1 30 38 Z" fill="currentColor" opacity=".3"/>
  <g transform="rotate(28 50 50)"><path d="M50 16 L55 50 45 50 Z" fill="${DARK}"/><path d="M50 84 L46 50 54 50 Z" fill="${DARK}" opacity=".55"/></g>
  <circle cx="50" cy="50" r="5.5" fill="${DARK}"/><circle cx="50" cy="50" r="2.2" fill="${GOLD_LT}"/>
</svg>`;

EMBLEMS['would-you-rather'] = `<svg viewBox="0 0 100 100">
  <g fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round" stroke-linejoin="round">
    <path d="M50 88 L50 56"/><path d="M50 56 C50 44 40 40 30 34"/><path d="M50 56 C50 44 60 40 70 34"/>
  </g>
  <path d="M30 34 l-9 1 5 -9 Z" fill="${GOLD}"/><path d="M70 34 l9 1 -5 -9 Z" fill="${GOLD}"/>
  <g fill="${GOLD}"><path d="M24 22 l1.6 4.4 4.6 .3 -3.6 2.9 1.2 4.5 -3.8 -2.6 -3.8 2.6 1.2 -4.5 -3.6 -2.9 4.6 -.3 Z"/><path d="M76 22 l1.6 4.4 4.6 .3 -3.6 2.9 1.2 4.5 -3.8 -2.6 -3.8 2.6 1.2 -4.5 -3.6 -2.9 4.6 -.3 Z"/></g>
  <g transform="translate(50 58)"><path d="M0 -11 L3 -3 11 0 3 3 0 11 -3 3 -11 0 -3 -3 Z" fill="${GOLD}"/><circle r="3" fill="${DARK}"/></g>
</svg>`;

/** Map a game id to its emblem SVG (handles id aliases). */
const EMBLEM_ALIASES: Record<string, string> = {
  codenames: 'spy-grid',
  'never-have-i-ever': 'nhie',
};
export function gameEmblem(gameId: string): string | undefined {
  return EMBLEMS[EMBLEM_ALIASES[gameId] ?? gameId];
}

/* ═══════════════════  PERSIAN DECORATIVE VOCABULARY  ═══════════════════
   Faravahar, Persepolis lotus, tulip, tar, dome, crown, nightingale, gereh,
   plus the Lion & Sun and an authentic boteh jegheh. accent (currentColor) + gold. */
const STEEL = '#dbe2f2'; void STEEL;

// scalloped ring (a mane / flower of n rounded bumps)
function scallopRing(cx: number, cy: number, r: number, n: number): string {
  let d = '';
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2,
      a1 = ((i + 1) / n) * Math.PI * 2,
      am = (a0 + a1) / 2;
    const [x0, y0] = onCircle(cx, cy, r * 0.74, a0);
    const [xc, yc] = onCircle(cx, cy, r * 1.2, am);
    const [x1, y1] = onCircle(cx, cy, r * 0.74, a1);
    d += (i === 0 ? `M${x0.toFixed(1)} ${y0.toFixed(1)} ` : '') + `Q${xc.toFixed(1)} ${yc.toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)} `;
  }
  return d + 'Z';
}

let BOTEH = `<svg viewBox="0 0 100 124" fill="none">
  <path d="M50 120 C20 113 8 86 16 60 C22 39 38 22 60 20 C82 18 95 33 90 53 C86 68 73 73 63 66 C55 60 56 50 63 47 C50 43 39 57 41 75 C43 96 47 110 50 120 Z" fill="currentColor"/>
  <path d="M50 120 C20 113 8 86 16 60 C22 39 38 22 60 20 C82 18 95 33 90 53 C86 68 73 73 63 66 C55 60 56 50 63 47 C50 43 39 57 41 75 C43 96 47 110 50 120 Z" fill="none" stroke="${GOLD}" stroke-width="2.4" stroke-linejoin="round"/>
  <path d="M50 110 C27 104 18 84 24 63 C29 46 42 33 59 31 C76 29 85 41 81 55 C78 65 69 68 62 63" fill="none" stroke="${GOLD}" stroke-width="1.5" opacity=".75"/>
  <g fill="${GOLD_LT}"><circle cx="48" cy="72" r="4.4"/><circle cx="40" cy="64" r="3"/><circle cx="56" cy="64" r="3"/><circle cx="44" cy="83" r="3"/><circle cx="53" cy="83" r="3"/><circle cx="48" cy="92" r="2.4"/></g>
  <g fill="currentColor"><circle cx="48" cy="72" r="1.8"/></g>
  <g fill="${GOLD}" opacity=".9"><path d="M50 56 q6 4 0 9 q-6 -5 0 -9 Z"/><path d="M49 44 q5 3 0 8 q-5 -5 0 -8 Z"/></g>
</svg>`;

let LION_SUN = `<svg viewBox="0 0 124 124" fill="none">
  <g>${sunRays(62, 62, 46, 60, 16, GOLD)}</g>
  <path d="${scallopRing(62, 62, 40, 16)}" fill="${GOLD}" stroke="${GOLD_DK}" stroke-width="1.4"/>
  <path d="${scallopRing(62, 63, 30, 13)}" fill="currentColor"/>
  <g><circle cx="45" cy="48" r="7" fill="${GOLD}"/><circle cx="79" cy="48" r="7" fill="${GOLD}"/><circle cx="45" cy="48" r="3" fill="currentColor"/><circle cx="79" cy="48" r="3" fill="currentColor"/></g>
  <circle cx="62" cy="65" r="23" fill="${GOLD}"/>
  <circle cx="62" cy="65" r="23" fill="none" stroke="${GOLD_DK}" stroke-width="1.4"/>
  <path d="M50 58 Q56 54 60 58 M74 58 Q68 54 64 58" stroke="${GOLD_DK}" stroke-width="2" fill="none" stroke-linecap="round"/>
  <g><path d="M49 62 Q54 57 59 62 Q54 66 49 62 Z" fill="${DARK}"/><path d="M65 62 Q70 57 75 62 Q70 66 65 62 Z" fill="${DARK}"/><circle cx="54" cy="61.5" r="1.4" fill="${GOLD_LT}"/><circle cx="70" cy="61.5" r="1.4" fill="${GOLD_LT}"/></g>
  <path d="M56 70 L68 70 L62 78 Z" fill="${DARK}"/>
  <path d="M62 78 Q56 84 50 80 M62 78 Q68 84 74 80" stroke="${GOLD_DK}" stroke-width="2" fill="none" stroke-linecap="round"/>
  <g fill="${GOLD_DK}"><circle cx="50" cy="74" r="1.1"/><circle cx="74" cy="74" r="1.1"/><circle cx="48" cy="78" r="1.1"/><circle cx="76" cy="78" r="1.1"/></g>
</svg>`;

const PERSIAN: Record<string, string> = {};

PERSIAN['faravahar'] = (() => {
  const wing = (s: number): string => {
    const x = (v: number): string => (80 + s * v).toFixed(1);
    const tiers: number[][] = [
      [8, 30, 70, 32, 40],
      [8, 41, 60, 43, 49],
      [8, 50, 50, 52, 58],
    ];
    let out = '';
    for (const [x0, y0, len, y1, y2] of tiers) {
      out += `<path d="M${x(x0)} ${y0} L${x(x0 + len)} ${y0 + 1} Q${x(x0 + len + 4)} ${(y0 + y1) / 2} ${x(x0 + len)} ${y1} L${x(x0)} ${y2} Z" fill="currentColor" stroke="${GOLD}" stroke-width="1.4" stroke-linejoin="round"/>`;
    }
    for (const fx of [22, 40, 58]) out += `<line x1="${x(fx)}" y1="32" x2="${x(fx - 2)}" y2="49" stroke="${GOLD}" stroke-width="1" opacity=".55"/>`;
    return out;
  };
  return `<svg viewBox="0 0 160 104" fill="none">
    ${wing(1)}${wing(-1)}
    <rect x="72" y="9" width="16" height="7" rx="1.5" fill="${GOLD}"/>
    <g fill="${GOLD}"><rect x="73" y="4" width="3.5" height="6"/><rect x="78.2" y="3" width="3.5" height="7"/><rect x="83.5" y="4" width="3.5" height="6"/></g>
    <circle cx="80" cy="23" r="6.5" fill="currentColor" stroke="${GOLD}" stroke-width="1.6"/>
    <circle cx="80" cy="46" r="12" fill="currentColor" stroke="${GOLD}" stroke-width="2"/>
    <circle cx="80" cy="46" r="5.5" fill="${DARK}"/>
    <path d="M71 58 L89 58 L85.5 90 Q80 94 74.5 90 Z" fill="currentColor" stroke="${GOLD}" stroke-width="1.6" stroke-linejoin="round"/>
    <g stroke="${GOLD}" stroke-width="1" opacity=".6"><line x1="76.5" y1="60" x2="77.5" y2="89"/><line x1="80" y1="60" x2="80" y2="91"/><line x1="83.5" y1="60" x2="82.5" y2="89"/></g>
    <g fill="none" stroke="${GOLD}" stroke-width="4.4" stroke-linecap="round">
      <path d="M72 64 C60 70 50 80 53 90 C55 96 63 94 62 87"/>
      <path d="M88 64 C100 70 110 80 107 90 C105 96 97 94 98 87"/>
    </g>
  </svg>`;
})();

PERSIAN['lotus'] = `<svg viewBox="0 0 100 100" fill="none">
  <path d="M50 92 L50 54" stroke="${GOLD}" stroke-width="3.4" stroke-linecap="round"/>
  <path d="M50 72 C36 70 30 60 30 50 C40 52 48 60 50 72 Z" fill="currentColor" stroke="${GOLD}" stroke-width="1.4"/>
  <path d="M50 72 C64 70 70 60 70 50 C60 52 52 60 50 72 Z" fill="currentColor" stroke="${GOLD}" stroke-width="1.4"/>
  <path d="M30 50 C24 40 26 28 33 22 C40 28 42 40 36 50 Z" fill="currentColor" stroke="${GOLD}" stroke-width="1.6"/>
  <path d="M70 50 C76 40 74 28 67 22 C60 28 58 40 64 50 Z" fill="currentColor" stroke="${GOLD}" stroke-width="1.6"/>
  <path d="M50 56 C40 44 42 24 50 10 C58 24 60 44 50 56 Z" fill="currentColor" stroke="${GOLD}" stroke-width="1.8"/>
  <path d="M40 50 L50 58 L60 50 Z" fill="${GOLD}"/>
  <g stroke="${GOLD}" stroke-width="1.2" opacity=".7"><line x1="50" y1="14" x2="50" y2="50"/></g>
</svg>`;

PERSIAN['tulip'] = `<svg viewBox="0 0 100 100" fill="none">
  <path d="M50 90 L50 56" stroke="${GOLD}" stroke-width="3.4" stroke-linecap="round"/>
  <path d="M50 74 C36 72 30 62 32 52 C42 54 49 62 50 74 Z" fill="currentColor" stroke="${GOLD}" stroke-width="1.4"/>
  <g fill="currentColor" stroke="${GOLD}" stroke-width="1.8" stroke-linejoin="round">
    <path d="M50 58 C40 56 33 44 35 30 C42 38 47 44 50 44 Z"/>
    <path d="M50 58 C60 56 67 44 65 30 C58 38 53 44 50 44 Z"/>
    <path d="M50 58 C46 50 46 34 50 22 C54 34 54 50 50 58 Z"/>
  </g>
  <circle cx="50" cy="30" r="2.4" fill="${GOLD_LT}"/>
</svg>`;

PERSIAN['tar'] = `<svg viewBox="0 0 100 100" fill="none">
  <g fill="currentColor" stroke="${GOLD}" stroke-width="2"><ellipse cx="50" cy="76" rx="20" ry="15"/><ellipse cx="50" cy="58" rx="14" ry="11"/></g>
  <ellipse cx="50" cy="76" rx="20" ry="15" fill="none" stroke="${GOLD_DK}" stroke-width="1" opacity=".6"/>
  <circle cx="50" cy="72" r="3.4" fill="${GOLD}"/>
  <rect x="46" y="16" width="8" height="36" rx="2" fill="currentColor" stroke="${GOLD}" stroke-width="1.6"/>
  <g stroke="${GOLD}" stroke-width="1" opacity=".7"><line x1="46" y1="24" x2="54" y2="24"/><line x1="46" y1="32" x2="54" y2="32"/><line x1="46" y1="40" x2="54" y2="40"/></g>
  <path d="M44 16 L56 16 L58 6 L42 6 Z" fill="currentColor" stroke="${GOLD}" stroke-width="1.6"/>
  <g fill="${GOLD}"><circle cx="46" cy="11" r="1.8"/><circle cx="54" cy="11" r="1.8"/></g>
  <g stroke="${GOLD_LT}" stroke-width="0.8" opacity=".8"><line x1="49" y1="10" x2="49" y2="84"/><line x1="51" y1="10" x2="51" y2="84"/></g>
</svg>`;

PERSIAN['dome'] = `<svg viewBox="0 0 100 100" fill="none">
  <path d="M50 6 L50 16" stroke="${GOLD}" stroke-width="2.4"/>
  <circle cx="50" cy="6" r="3.2" fill="${GOLD}"/>
  <path d="M50 16 C44 22 32 30 32 48 C32 62 40 70 50 70 C60 70 68 62 68 48 C68 30 56 22 50 16 Z" fill="currentColor" stroke="${GOLD}" stroke-width="2"/>
  <g stroke="${GOLD}" stroke-width="1.1" opacity=".65" fill="none"><path d="M50 16 L50 70"/><path d="M40 20 C36 34 36 54 43 69"/><path d="M60 20 C64 34 64 54 57 69"/></g>
  <rect x="38" y="70" width="24" height="8" fill="currentColor" stroke="${GOLD}" stroke-width="1.6"/>
  <path d="M30 92 L30 78 L70 78 L70 92 Z" fill="currentColor" stroke="${GOLD}" stroke-width="1.6"/>
  <path d="M44 92 L44 86 C44 82 56 82 56 86 L56 92 Z" fill="${DARK}"/>
</svg>`;

PERSIAN['crown'] = `<svg viewBox="0 0 100 100" fill="none">
  <rect x="22" y="64" width="56" height="16" rx="3" fill="currentColor" stroke="${GOLD}" stroke-width="2"/>
  <path d="M22 64 L26 36 L38 56 L50 30 L62 56 L74 36 L78 64 Z" fill="currentColor" stroke="${GOLD}" stroke-width="2" stroke-linejoin="round"/>
  <g fill="${GOLD}"><circle cx="26" cy="34" r="3.4"/><circle cx="50" cy="27" r="4"/><circle cx="74" cy="34" r="3.4"/></g>
  <g><path d="M50 66 l4 6 -4 6 -4 -6 Z" fill="${GOLD}"/><circle cx="34" cy="72" r="3" fill="${GOLD}"/><circle cx="66" cy="72" r="3" fill="${GOLD}"/></g>
  <g fill="${GOLD_LT}"><circle cx="28" cy="78" r="1.6"/><circle cx="42" cy="78" r="1.6"/><circle cx="58" cy="78" r="1.6"/><circle cx="72" cy="78" r="1.6"/></g>
</svg>`;

PERSIAN['nightingale'] = `<svg viewBox="0 0 100 100" fill="none">
  <path d="M6 88 C30 84 60 84 78 88" stroke="${GOLD}" stroke-width="2.6" stroke-linecap="round"/>
  <g transform="translate(80 80)"><circle r="8" fill="currentColor" stroke="${GOLD}" stroke-width="1.4"/><path d="M0 -8 A8 8 0 0 1 5.6 5.6 M-5 -5 A7 7 0 0 1 5 5" stroke="${GOLD}" stroke-width="1.1" fill="none" opacity=".7"/><circle r="2.2" fill="${GOLD_LT}"/></g>
  <g stroke="${GOLD}" stroke-width="2" stroke-linecap="round"><line x1="44" y1="70" x2="44" y2="86"/><line x1="52" y1="70" x2="52" y2="86"/></g>
  <path d="M34 60 L8 70 L34 70 Z" fill="currentColor" stroke="${GOLD}" stroke-width="1.6" stroke-linejoin="round"/>
  <path d="M34 64 C28 46 40 30 56 32 C66 33 70 42 66 50 C72 52 72 60 64 64 C54 69 42 69 34 64 Z" fill="currentColor" stroke="${GOLD}" stroke-width="2" stroke-linejoin="round"/>
  <circle cx="62" cy="38" r="9" fill="currentColor" stroke="${GOLD}" stroke-width="2"/>
  <path d="M71 37 L82 35 L71 41 Z" fill="${GOLD}"/>
  <circle cx="63" cy="36" r="2" fill="${DARK}"/>
  <path d="M40 50 C50 46 60 50 62 58 C52 60 44 58 40 50 Z" fill="${GOLD}" opacity=".85"/>
  <g fill="${GOLD_LT}"><circle cx="84" cy="26" r="2.4"/><circle cx="92" cy="18" r="1.8"/></g>
  <line x1="86" y1="26" x2="86" y2="14" stroke="${GOLD_LT}" stroke-width="1.4"/>
</svg>`;

PERSIAN['gereh'] = `<svg viewBox="0 0 100 100" fill="none">
  <g transform="translate(50 50)">
    <path d="M${[...Array(8)].map((_, i) => { const a = (i / 8) * Math.PI * 2 + Math.PI / 8; return (40 * Math.cos(a)).toFixed(1) + ' ' + (40 * Math.sin(a)).toFixed(1); }).join(' L')} Z" stroke="${GOLD}" stroke-width="2" opacity=".5"/>
    <path d="M0 -38 L11 -11 38 0 11 11 0 38 -11 11 -38 0 -11 -11 Z" fill="currentColor" stroke="${GOLD}" stroke-width="2" stroke-linejoin="round"/>
    <path d="M0 -38 L11 -11 38 0 11 11 0 38 -11 11 -38 0 -11 -11 Z" fill="none" stroke="${GOLD}" stroke-width="2" stroke-linejoin="round" transform="rotate(45)" opacity=".9"/>
    <circle r="9" fill="${GOLD}"/>
    <path d="M0 -9 L2.6 -2.6 9 0 2.6 2.6 0 9 -2.6 2.6 -9 0 -2.6 -2.6 Z" fill="${DARK}"/>
  </g>
</svg>`;

/** A decorative Persian motif SVG string (faravahar, lotus, tulip, tar, dome, crown,
 *  nightingale, gereh, plus boteh and lion-sun). */
export function motif(name: string): string | undefined {
  if (name === 'boteh') return BOTEH;
  if (name === 'lion-sun' || name === 'lionsun') return LION_SUN;
  return PERSIAN[name];
}

// Inject the SVG namespace into every emblem/motif so they render on iOS Safari (see fixSvg).
for (const k in EMBLEMS) EMBLEMS[k] = fixSvg(EMBLEMS[k]);
for (const k in PERSIAN) PERSIAN[k] = fixSvg(PERSIAN[k]);
BOTEH = fixSvg(BOTEH);
LION_SUN = fixSvg(LION_SUN);

export { EMBLEMS, PERSIAN, BOTEH, LION_SUN };
