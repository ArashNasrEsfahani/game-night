import { useTranslation } from 'react-i18next';
import type { LocalizedString } from '../../../sdk/types';
import { ROLES } from '../roles';
import type { RoleId, Faction } from '../roles';

const FACTION_DOT: Record<Faction, string> = {
  town: 'var(--color-game-teal)',
  mafia: 'var(--color-game-rose)',
  neutral: 'var(--color-game-gold)',
};

/**
 * The "how each role works" reference. Lists every role (or a given subset) with its
 * icon, name, a colored side dot, and a one-line guide. Used inside a Sheet on Setup
 * so players can learn the powers before dealing.
 */
export function RoleGuideList({
  localize,
  roleIds,
}: {
  localize: (s: LocalizedString) => string;
  roleIds?: RoleId[];
}) {
  const { t } = useTranslation();
  const ids = roleIds ?? Object.keys(ROLES);
  return (
    <ul className="flex flex-col gap-2.5">
      {ids.map((id) => {
        const role = ROLES[id];
        if (!role) return null;
        return (
          <li key={id} className="dp-glass-2 flex gap-3 rounded-2xl p-3">
            <span className="text-2xl leading-none" aria-hidden>
              {role.icon}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-[var(--text)]">{localize(role.name)}</span>
                <span
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--text-muted)]"
                >
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ background: FACTION_DOT[role.faction] }}
                    aria-hidden
                  />
                  {t(`mf.faction.${role.faction}`)}
                </span>
              </div>
              <p className="mt-0.5 text-sm leading-snug text-[var(--text-muted)]">{localize(role.guide)}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
