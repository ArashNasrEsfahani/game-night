import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Sheet } from '../../sdk/ui';
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
  // ✕ deletes a player from the roster (not just deselects), so confirm first — matching the
  // Players page, so a stray tap during setup can't wipe someone's saved name/emoji/colour.
  const [confirm, setConfirm] = useState<{ id: (typeof players)[number]['id']; name: string } | null>(
    null,
  );

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
                  onClick={() => setConfirm({ id: p.id, name: p.name })}
                  aria-label={`${t('common.remove')} ${p.name}`}
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

      <Sheet open={confirm != null} onClose={() => setConfirm(null)} title={t('players.removeTitle')}>
        <p className="text-sm leading-relaxed text-[var(--text-muted)]">
          {t('players.removeConfirm', { name: confirm?.name ?? '' })}
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <Button
            variant="danger"
            fullWidth
            onClick={() => {
              if (confirm) removePlayer(confirm.id);
              setConfirm(null);
            }}
          >
            {t('common.remove')}
          </Button>
          <Button variant="secondary" fullWidth onClick={() => setConfirm(null)}>
            {t('common.cancel')}
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
