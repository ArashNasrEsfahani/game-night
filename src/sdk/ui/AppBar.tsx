import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { pressIcon } from '../motion';

/** The host advertises the active game's name here so every in-game AppBar shows it as a gold
 *  header (matching the native GameAppBar) without each screen having to pass a title. Empty
 *  outside a game, where titles render in the normal style. */
export const GameChromeContext = createContext<{ name?: string }>({});

export function AppBar({
  title,
  onBack,
  right,
}: {
  title?: ReactNode;
  onBack?: () => void;
  right?: ReactNode;
}) {
  const { name } = useContext(GameChromeContext);
  const inGame = name != null;
  const shown = title ?? name;
  // In-game, the host overlays a fixed top-right chrome cluster (leave ✕ + how-to-play ?). When this
  // bar also has a trailing slot (e.g. "End game"), reserve space at the inline-end so it clears that
  // overlay instead of rendering underneath it. `pe-*` is logical, so it flips correctly in RTL.
  return (
    <header className={`flex h-14 items-center gap-2${inGame && right ? ' pe-24' : ''}`}>
      {onBack && (
        <motion.button
          onClick={onBack}
          aria-label="Back"
          whileTap={pressIcon.whileTap}
          whileHover={pressIcon.whileHover}
          transition={pressIcon.transition}
          className="grid h-10 w-10 place-items-center rounded-full text-2xl text-[var(--text)]"
        >
          <span className="rtl:rotate-180">‹</span>
        </motion.button>
      )}
      <h1
        className={
          inGame
            ? 'dp-foil flex-1 truncate font-display text-xl font-extrabold'
            : 'flex-1 truncate text-xl font-bold'
        }
      >
        {shown}
      </h1>
      {right}
    </header>
  );
}
