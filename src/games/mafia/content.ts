// src/games/mafia/content.ts — presets + content validation (bilingual).
import type { LocalizedString } from '../../sdk/types';
import type { RoleId } from './roles';
import { ROLES, ROLE_LIST, countsAsMafia } from './roles';
import type { DatasetDescriptor, DatasetItem } from '../../content/types';
import { objectFileDataset } from '../../content/datasetBuilders';
import { registerRebuilder } from '../../content/overrides';

export interface RolePreset {
  id: string;
  name: LocalizedString;
  players: { min: number; max: number };
  composition: Record<RoleId, number>;
}

export const PRESETS: RolePreset[] = [
  {
    id: 'classic-5',
    name: { en: 'Classic (5)', fa: 'کلاسیک (۵)' },
    players: { min: 5, max: 5 },
    composition: { mafia: 1, detective: 1, doctor: 1, citizen: 2 },
  },
  {
    id: 'classic-7',
    name: { en: 'Classic (7)', fa: 'کلاسیک (۷)' },
    players: { min: 7, max: 7 },
    composition: { mafia: 2, detective: 1, doctor: 1, citizen: 3 },
  },
  {
    id: 'advanced-10',
    name: { en: 'Advanced (10)', fa: 'پیشرفته (۱۰)' },
    players: { min: 10, max: 10 },
    composition: { godfather: 1, mafia: 2, detective: 1, doctor: 1, sniper: 1, citizen: 4 },
  },
  {
    id: 'chaos-12',
    name: { en: 'Chaos (12)', fa: 'آشوب (۱۲)' },
    players: { min: 12, max: 12 },
    composition: {
      godfather: 1,
      framer: 1,
      mafia: 1,
      detective: 1,
      doctor: 1,
      bodyguard: 1,
      escort: 1,
      sniper: 1,
      jester: 1,
      citizen: 3,
    },
  },
];

/** A sensible auto composition for any player count (used as the Setup default). */
export function autoComposition(n: number): Record<RoleId, number> {
  if (n < 5) return {};
  const mafia = Math.max(1, Math.round(n / 4));
  const detective = 1;
  const doctor = 1;
  const sniper = n >= 9 ? 1 : 0;
  const citizen = Math.max(0, n - mafia - detective - doctor - sniper);
  const comp: Record<RoleId, number> = { mafia, detective, doctor, citizen };
  if (sniper) comp.sniper = sniper;
  return comp;
}

export const compositionTotal = (c: Record<RoleId, number>): number =>
  Object.values(c).reduce((a, b) => a + b, 0);

export const mafiaInComposition = (c: Record<RoleId, number>): number =>
  Object.entries(c).reduce((sum, [id, count]) => sum + (ROLES[id] && countsAsMafia(ROLES[id]) ? count : 0), 0);

/* ── Editable role text (Content Studio) ──────────────────────────────────
 * Mafia roles live in roles.ts (not a JSON file), and their structural fields
 * (faction, night action, …) are logic — NOT safe to edit. So this dataset
 * exposes only the three bilingual TEXT fields per role and patches them onto
 * the live role registry in place; everything else stays exactly as shipped. */
interface RoleTextItem extends DatasetItem {
  name: LocalizedString;
  reveal: LocalizedString;
  guide: LocalizedString;
}

const defaultRoleText = (): { roles: RoleTextItem[] } => ({
  roles: ROLE_LIST.map((r) => ({
    id: r.id,
    name: { ...r.name },
    reveal: { ...r.reveal },
    guide: { ...r.guide },
  })),
});

export const DATASETS: DatasetDescriptor[] = [
  objectFileDataset({
    gameId: 'mafia',
    datasetId: 'roles',
    itemsKey: 'roles',
    defaultFile: defaultRoleText(),
    sourcePath: null, // lives in roles.ts; edits persist only as an on-device override
    title: { en: 'Role text', fa: 'متن نقش‌ها' },
    itemNoun: { en: 'role', fa: 'نقش' },
    idPrefix: 'role-',
    locFields: [
      { key: 'name', label: { en: 'Name', fa: 'نام' } },
      { key: 'reveal', label: { en: 'Reveal (private card)', fa: 'متن کارت خصوصی' }, multiline: true },
      { key: 'guide', label: { en: 'Guide (one-liner)', fa: 'راهنما (یک‌خطی)' }, multiline: true },
    ],
  }),
];

function rebuildRoleText(): void {
  const file = DATASETS[0].readFile() as { roles: RoleTextItem[] };
  for (const item of file.roles) {
    const role = ROLES[item.id];
    if (!role) continue; // ignore added/renamed ids — roles are structural
    if (item.name) role.name = item.name;
    if (item.reveal) role.reveal = item.reveal;
    if (item.guide) role.guide = item.guide;
  }
}
registerRebuilder(rebuildRoleText);

export function validateContent(): string[] {
  const problems: string[] = [];
  for (const role of ROLE_LIST) {
    if (!role.name?.en?.trim() || !role.name?.fa?.trim()) problems.push(`role ${role.id} missing name`);
    if (!role.reveal?.en?.trim() || !role.reveal?.fa?.trim()) problems.push(`role ${role.id} missing reveal`);
    if (!role.guide?.en?.trim() || !role.guide?.fa?.trim()) problems.push(`role ${role.id} missing guide`);
  }
  for (const preset of PRESETS) {
    if (!preset.name?.en?.trim() || !preset.name?.fa?.trim()) problems.push(`preset ${preset.id} missing name`);
    for (const id of Object.keys(preset.composition)) {
      if (!ROLES[id]) problems.push(`preset ${preset.id} references unknown role ${id}`);
    }
    const total = compositionTotal(preset.composition);
    if (total < preset.players.min || total > preset.players.max)
      problems.push(`preset ${preset.id} total ${total} out of range`);
    if (mafiaInComposition(preset.composition) >= Math.ceil(total / 2))
      problems.push(`preset ${preset.id} mafia at parity`);
  }
  return problems;
}
