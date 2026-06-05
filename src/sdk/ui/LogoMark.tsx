import { cn } from '../../lib/cn';

const RAYS =
  'conic-gradient(from 0deg,' +
  'color-mix(in oklab, var(--color-game-gold) 70%, transparent) 0 8deg, transparent 8deg 38deg,' +
  'color-mix(in oklab, var(--color-game-rose) 70%, transparent) 38deg 46deg, transparent 46deg 82deg,' +
  'color-mix(in oklab, var(--color-game-teal) 70%, transparent) 82deg 90deg, transparent 90deg 128deg,' +
  'color-mix(in oklab, var(--color-game-sky) 70%, transparent) 128deg 136deg, transparent 136deg 172deg,' +
  'color-mix(in oklab, var(--color-game-lime) 70%, transparent) 172deg 180deg, transparent 180deg 218deg,' +
  'color-mix(in oklab, var(--color-game-grape) 70%, transparent) 218deg 226deg, transparent 226deg 262deg,' +
  'color-mix(in oklab, var(--color-game-tangerine) 70%, transparent) 262deg 270deg, transparent 270deg 308deg,' +
  'color-mix(in oklab, var(--color-game-violet) 70%, transparent) 308deg 316deg, transparent 316deg 360deg)';

/** The brand mark: a disco mirror ball cradled in a pointed Persian arch (طاق),
 *  with sweeping colored rays behind it. Animations respect reduced motion. */
export function LogoMark({ size = 140, className }: { size?: number; className?: string }) {
  return (
    <div className={cn('relative grid place-items-center', className)} style={{ width: size, height: size * 1.1 }}>
      {/* hanging string */}
      <span
        aria-hidden
        className="absolute left-1/2 top-0 w-px -translate-x-1/2"
        style={{ height: size * 0.1, background: 'linear-gradient(var(--color-game-gold), transparent)' }}
      />
      {/* rotating colored rays */}
      <span
        aria-hidden
        className="dp-spin-slow absolute left-1/2 top-[52%] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ width: size * 1.08, height: size * 1.08, background: RAYS, filter: 'blur(7px)', opacity: 0.55 }}
      />
      {/* pointed-arch frame */}
      <svg aria-hidden viewBox="0 0 100 116" className="absolute inset-0 h-full w-full" fill="none">
        <circle cx="50" cy="6" r="3.2" fill="var(--color-game-gold)" />
        <path
          d="M16 112 L16 52 Q16 12 50 6 Q84 12 84 52 L84 112"
          stroke="var(--color-game-gold)"
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.9"
        />
      </svg>
      {/* the mirror ball */}
      <div
        className="dp-ball relative"
        style={{ width: size * 0.5, height: size * 0.5, marginTop: size * 0.05 }}
      />
    </div>
  );
}
