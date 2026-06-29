import { motion } from 'framer-motion';
import { Card } from './Card';
import { cn } from '../../lib/cn';
import { stagger, staggerItem } from '../motion';
import { useNum } from '../../lib/digits';

export interface ScoreRow {
  id: string;
  label: string;
  score: number;
  rank: number;
  color?: string; // ColorToken name
  /** Optional pre-formatted value shown instead of the raw number (e.g. a time "1:05"). */
  display?: string;
}

export function Scoreboard({ rows }: { rows: ScoreRow[] }) {
  const num = useNum();
  return (
    <motion.ul variants={stagger} initial="initial" animate="animate" className="flex flex-col gap-2">
      {rows.map((r) => {
        const first = r.rank === 1;
        return (
          <motion.li key={r.id} variants={staggerItem}>
            <Card
              className={cn('flex items-center gap-3 py-3', first && 'border-[color-mix(in_oklab,var(--color-game-gold)_55%,transparent)]')}
              style={
                first
                  ? { background: 'linear-gradient(100deg, color-mix(in oklab, var(--color-game-gold) 22%, var(--surface-2)), var(--surface-2))' }
                  : undefined
              }
            >
              <span
                className={cn(
                  'w-6 text-center font-display text-lg',
                  first ? 'text-[var(--color-game-gold-strong)]' : 'text-[var(--text-muted)]',
                )}
              >
                {num(r.rank)}
              </span>
              {r.color && (
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ background: `var(--color-game-${r.color})` }}
                />
              )}
              <span className="flex-1 truncate font-medium">{r.label}</span>
              <motion.span
                key={r.score}
                initial={{ scale: 1.3 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
                className="font-display text-xl tabular-nums"
              >
                {num(r.display ?? r.score)}
              </motion.span>
            </Card>
          </motion.li>
        );
      })}
    </motion.ul>
  );
}
