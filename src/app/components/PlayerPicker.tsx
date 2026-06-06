import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../sdk/ui';
import { useRosterStore } from '../../store/rosterStore';

/** In-game roster control: tap a chip to include/exclude a player, ✕ to delete them, or type a
 *  name to add one on the spot (auto-selected). Optional "Manage" jumps to the full Players page. */
export function PlayerPicker({
  selected,
  onToggle,
  onManageAll,
}: {
  selected: string[];
  onToggle: (id: string) => void;
  onManageAll?: () => void;
}) {
  const { t } = useTranslation();
  const players = useRosterStore((s) => s.players);
  const addPlayer = useRosterStore((s) => s.addPlayer);
  const removePlayer = useRosterStore((s) => s.removePlayer);
  const [name, setName] = useState('');

  const add = () => {
    const n = name.trim();
    if (!n) return;
    const id = addPlayer({ name: n });
    onToggle(id as string); // auto-include the new player
    setName('');
  };

  return (
    <div className="flex flex-col gap-2.5">
      {players.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {players.map((p) => {
            const on = selected.includes(p.id);
            return (
              <span
                key={p.id}
                className={`inline-flex items-stretch overflow-hidden rounded-full text-sm font-medium ${
                  on
                    ? 'bg-[var(--game-accent-strong)] text-[var(--game-on-accent)]'
                    : 'bg-[var(--surface-2)] text-[var(--text)]'
                }`}
              >
                <button onClick={() => onToggle(p.id)} className="py-2 pl-3 pr-1.5">
                  {p.emoji ? `${p.emoji} ` : ''}
                  {p.name}
                </button>
                <button
                  onClick={() => removePlayer(p.id)}
                  aria-label={t('common.remove')}
                  className="grid w-7 place-items-center text-xs opacity-60 hover:bg-black/10 hover:opacity-100"
                >
                  ✕
                </button>
              </span>
            );
          })}
        </div>
      )}
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') add();
          }}
          placeholder={t('players.namePlaceholder')}
          className="h-10 flex-1 rounded-[var(--radius-pill)] bg-[var(--surface-2)] px-4 text-sm text-[var(--text)] outline-none shadow-[inset_0_0_0_1px_var(--border)]"
        />
        <Button size="sm" onClick={add}>
          {t('common.add')}
        </Button>
        {onManageAll && (
          <Button size="sm" variant="secondary" onClick={onManageAll}>
            {t('players.manageAll')}
          </Button>
        )}
      </div>
    </div>
  );
}
