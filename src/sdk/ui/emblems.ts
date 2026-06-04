// src/sdk/ui/emblems.ts — Disco Persian heraldry. Bespoke geometric SVG emblems per game.
// All figures use currentColor for the game accent + gold/steel accents. Ported from the design pack.
/* eslint-disable */
const GOLD = '#f4c64d',
  GOLD_LT = '#ffe6a6',
  GOLD_DK = '#c9912a',
  DARK = '#0b0922';

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

export { EMBLEMS };
