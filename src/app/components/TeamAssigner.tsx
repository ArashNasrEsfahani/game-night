import { useEffect, useMemo, useRef, useState } from 'react';

/** Balance players across `teamCount` teams, preserving any prior manual choices: existing valid
 *  assignments stay put; everyone else fills the smallest team (stable order → same round-robin the
 *  games used to auto-build, so default behaviour is unchanged). */
function balance<T extends string>(
  ids: T[],
  teamCount: number,
  prev: Record<string, number> = {},
): Record<string, number> {
  const next: Record<string, number> = {};
  const counts = new Array(Math.max(1, teamCount)).fill(0);
  for (const id of ids) {
    const t = prev[id];
    if (t != null && t >= 0 && t < teamCount) {
      next[id] = t;
      counts[t] += 1;
    }
  }
  for (const id of ids) {
    if (next[id] == null) {
      let min = 0;
      for (let k = 1; k < teamCount; k += 1) if (counts[k] < counts[min]) min = k;
      next[id] = min;
      counts[min] += 1;
    }
  }
  return next;
}

/**
 * Manual-but-auto-seeded team assignment. Seeds an even split on first render; re-balances when the
 * player set or team count changes WITHOUT clobbering moves the host already made. `cycle(id)` bumps
 * a player to the next team. `memberIdsByTeam` is what each game feeds into its `TeamSetup`.
 */
export function useTeamAssignment<T extends string>(orderedIds: T[], teamCount: number) {
  const idsKey = orderedIds.join(',');
  const [byPlayer, setByPlayer] = useState<Record<string, number>>(() =>
    balance(orderedIds, teamCount),
  );
  const lastIds = useRef(idsKey);
  const lastCount = useRef(teamCount);

  useEffect(() => {
    const countChanged = lastCount.current !== teamCount;
    const idsChanged = lastIds.current !== idsKey;
    if (!countChanged && !idsChanged) return;
    lastCount.current = teamCount;
    lastIds.current = idsKey;
    // Changing the team COUNT is structural → re-balance fresh. Adding/removing players keeps the
    // host's manual arrangement and just slots the newcomers into the smallest teams.
    setByPlayer((prev) => balance(orderedIds, teamCount, countChanged ? {} : prev));
    // orderedIds is captured via idsKey; depending on the array identity would re-run every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, teamCount]);

  const cycle = (id: string) =>
    setByPlayer((prev) => ({ ...prev, [id]: ((prev[id] ?? 0) + 1) % teamCount }));

  const memberIdsByTeam = useMemo(() => {
    const out: T[][] = Array.from({ length: teamCount }, () => [] as T[]);
    for (const id of orderedIds) {
      const t = Math.min(byPlayer[id] ?? 0, teamCount - 1);
      out[t].push(id);
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, teamCount, byPlayer]);

  return { byPlayer, cycle, memberIdsByTeam };
}

/**
 * Seat-order assignment for games that need EXACTLY 2 players per team (Dowr's relay). Free columns
 * could leave a team of 1 or 3, so here the host taps two players to SWAP their seats: pairs are
 * always consecutive slots, which keeps every team a duo. Default order is the roster order — the
 * same consecutive pairing the game used to build on its own.
 */
export function usePairAssignment<T extends string>(orderedIds: T[]) {
  const idsKey = orderedIds.join(',');
  const [moved, setMoved] = useState<T[]>(orderedIds);
  const [pickedRaw, setPicked] = useState<T | null>(null);

  // Derived, never stale: the host's arrangement filtered to who's still selected, with newcomers
  // appended. Deriving (rather than syncing in an effect) keeps `order` valid on the very render a
  // player is added or removed.
  const order = useMemo(() => {
    const kept = moved.filter((id) => orderedIds.includes(id));
    return [...kept, ...orderedIds.filter((id) => !kept.includes(id))];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, moved]);
  const picked = pickedRaw !== null && order.includes(pickedRaw) ? pickedRaw : null;

  const tap = (id: T) => {
    if (picked === null || picked === id) {
      setPicked(picked === id ? null : id);
      return;
    }
    const a = order.indexOf(picked);
    const b = order.indexOf(id);
    setPicked(null);
    if (a < 0 || b < 0) return;
    const next = [...order];
    next[a] = order[b];
    next[b] = order[a];
    setMoved(next);
  };

  return { order, picked, tap };
}

/**
 * Pair rows for `usePairAssignment`: one row per team of two, showing exactly who is with whom. Tap
 * a player to pick them up, tap a second to swap the two. A trailing odd player gets an empty slot
 * so it's obvious the roster isn't even yet (the game's own validation blocks Start).
 */
export function PairAssigner({
  players,
  order,
  picked,
  onTap,
  teamName,
  palette = PAIR_PALETTE,
  hint,
}: {
  players: { id: string; name: string; emoji?: string }[];
  order: string[];
  picked: string | null;
  onTap: (id: string) => void;
  /** Localised label for pair `n` (1-based). */
  teamName: (n: number) => string;
  palette?: string[];
  hint?: string;
}) {
  const byId = new Map(players.map((p) => [p.id, p]));
  const pairs: (string | null)[][] = [];
  for (let i = 0; i < order.length; i += 2) pairs.push([order[i], order[i + 1] ?? null]);

  return (
    <div className="flex flex-col gap-2">
      {pairs.map((pair, pi) => {
        const accent = `var(--color-game-${palette[pi % palette.length]})`;
        return (
          <div key={pi} className="flex items-center gap-2 rounded-2xl bg-[var(--surface-2)] p-2">
            {/* A dot rather than an inset edge stripe: physical offsets don't mirror in RTL. */}
            <span className="flex w-16 shrink-0 items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: accent }} />
              <span className="truncate">{teamName(pi + 1)}</span>
            </span>
            <div className="flex min-w-0 flex-1 items-center gap-1.5">
              {pair.map((id, si) => {
                const p = id ? byId.get(id) : undefined;
                if (!p) {
                  return (
                    <span
                      key={si}
                      className="flex-1 rounded-xl border border-dashed border-[var(--border)] px-2 py-2 text-center text-[11px] text-[var(--text-muted)]"
                    >
                      —
                    </span>
                  );
                }
                const isPicked = picked === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onTap(p.id)}
                    className="min-w-0 flex-1 truncate rounded-xl px-2 py-2 text-sm font-medium transition active:scale-[0.96]"
                    style={
                      isPicked
                        ? { background: accent, color: 'var(--on-accent)' }
                        : {
                            background: 'var(--surface)',
                            color: 'var(--text)',
                            boxShadow: 'inset 0 0 0 1px var(--border)',
                          }
                    }
                  >
                    {p.emoji ? `${p.emoji} ` : ''}
                    {p.name}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
      {hint && <p className="text-center text-xs text-[var(--text-muted)]">{hint}</p>}
    </div>
  );
}

const PAIR_PALETTE = ['rose', 'sky', 'lime', 'gold', 'violet'];

export interface TeamColumn {
  /** Display name, e.g. "Team 1" or "Red". */
  name: string;
  /** ColorToken (e.g. 'rose') used to tint the column; falls back to the game accent. */
  color?: string;
}

/**
 * Grouped-columns team picker: one column per team, players shown under it, tap a player chip to
 * move them to the next team. Pure presentation — assignment state lives in `useTeamAssignment`.
 * Set `spymasterFirst` (Codenames) to flag the first member of each column with 🔍.
 */
export function TeamAssigner({
  players,
  teamColumns,
  byPlayer,
  onCycle,
  hint,
  spymasterFirst = false,
}: {
  players: { id: string; name: string; emoji?: string }[];
  teamColumns: TeamColumn[];
  byPlayer: Record<string, number>;
  onCycle: (id: string) => void;
  hint?: string;
  spymasterFirst?: boolean;
}) {
  const n = Math.max(1, teamColumns.length);
  return (
    <div className="flex flex-col gap-2">
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
        {teamColumns.map((col, ti) => {
          const accent = col.color ? `var(--color-game-${col.color})` : 'var(--game-accent-strong)';
          const members = players.filter((p) => Math.min(byPlayer[p.id] ?? 0, n - 1) === ti);
          return (
            <div
              key={ti}
              className="flex min-h-[5rem] flex-col gap-1.5 rounded-2xl bg-[var(--surface-2)] p-2"
              style={{ boxShadow: `inset 0 2.5px 0 ${accent}` }}
            >
              <div className="flex items-center justify-center gap-1.5 pb-0.5 text-[11px] font-bold uppercase tracking-wide">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: accent }} />
                <span className="truncate">{col.name}</span>
              </div>
              {members.length === 0 ? (
                <p className="grid flex-1 place-items-center text-[11px] text-[var(--text-muted)]">—</p>
              ) : (
                members.map((p, mi) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onCycle(p.id)}
                    className="truncate rounded-xl bg-[var(--surface)] px-2 py-2 text-sm font-medium text-[var(--text)] shadow-[inset_0_0_0_1px_var(--border)] transition active:scale-[0.96]"
                  >
                    {spymasterFirst && mi === 0 ? '🔍 ' : ''}
                    {p.emoji ? `${p.emoji} ` : ''}
                    {p.name}
                  </button>
                ))
              )}
            </div>
          );
        })}
      </div>
      {hint && <p className="text-center text-xs text-[var(--text-muted)]">{hint}</p>}
    </div>
  );
}
