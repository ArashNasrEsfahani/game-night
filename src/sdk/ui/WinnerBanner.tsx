import { motion } from 'framer-motion';
import { Confetti } from './Confetti';
import { Medallion } from './Medallion';

export function WinnerBanner({
  title,
  names,
  tie = false,
}: {
  title: string;
  names: string[];
  /** A draw rather than a single winner — shows a 🤝 instead of the 🏆 so the result reads honestly. */
  tie?: boolean;
}) {
  return (
    <div className="relative flex flex-col items-center gap-3 py-6 text-center">
      <Confetti />
      <motion.div
        initial={{ scale: 0, rotate: -25 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 13, delay: 0.05 }}
      >
        <Medallion size={118}>
          <span className="text-5xl drop-shadow-[0_0_18px_var(--game-accent-glow)]">
            {tie ? '🤝' : '🏆'}
          </span>
        </Medallion>
      </motion.div>
      <motion.h2
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="dp-foil font-display text-3xl leading-tight"
      >
        {title}
      </motion.h2>
      {names.length > 0 && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35 }}
          className="text-lg text-[var(--text-muted)]"
        >
          {names.join('، ')}
        </motion.p>
      )}
    </div>
  );
}
