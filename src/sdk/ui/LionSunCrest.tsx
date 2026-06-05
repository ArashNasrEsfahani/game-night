import { cn } from '../../lib/cn';
import { LION_SUN } from './emblems';

const DISCO_RAYS =
  'conic-gradient(from 0deg,' +
  'color-mix(in oklab, var(--color-game-gold) 75%, transparent) 0 7deg, transparent 7deg 38deg,' +
  'color-mix(in oklab, var(--color-game-rose) 75%, transparent) 38deg 45deg, transparent 45deg 82deg,' +
  'color-mix(in oklab, var(--color-game-teal) 75%, transparent) 82deg 89deg, transparent 89deg 128deg,' +
  'color-mix(in oklab, var(--color-game-sky) 75%, transparent) 128deg 135deg, transparent 135deg 172deg,' +
  'color-mix(in oklab, var(--color-game-lime) 75%, transparent) 172deg 179deg, transparent 179deg 218deg,' +
  'color-mix(in oklab, var(--color-game-grape) 75%, transparent) 218deg 225deg, transparent 225deg 262deg,' +
  'color-mix(in oklab, var(--color-game-tangerine) 75%, transparent) 262deg 269deg, transparent 269deg 308deg,' +
  'color-mix(in oklab, var(--color-game-violet) 75%, transparent) 308deg 315deg, transparent 315deg 360deg)';

/** The Lion & Sun (شیر و خورشید) heraldry over sweeping disco rays. */
export function LionSunCrest({ size = 150, className }: { size?: number; className?: string }) {
  return (
    <div className={cn('relative grid place-items-center', className)} style={{ width: size, height: size }} aria-hidden>
      {/* sweeping disco rays */}
      <span
        className="dp-spin-slow absolute rounded-full"
        style={{ width: size * 1.28, height: size * 1.28, background: DISCO_RAYS, filter: 'blur(9px)', opacity: 0.55 }}
      />
      {/* warm halo */}
      <span
        className="absolute rounded-full"
        style={{
          width: size * 0.96,
          height: size * 0.96,
          background: 'radial-gradient(circle, color-mix(in oklab, var(--color-game-gold) 24%, transparent), transparent 70%)',
          boxShadow: '0 0 54px -8px var(--game-accent-glow)',
        }}
      />
      {/* the Lion & Sun emblem (currentColor = fiery mane/ruff, gold sun) */}
      <div
        className="relative text-[var(--color-game-tangerine-strong)] [&_svg]:h-full [&_svg]:w-full"
        style={{ width: size * 0.82, height: size * 0.82, filter: 'drop-shadow(0 6px 18px rgb(0 0 0 / 0.4))' }}
        dangerouslySetInnerHTML={{ __html: LION_SUN }}
      />
    </div>
  );
}
