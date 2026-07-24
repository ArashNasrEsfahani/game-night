import truths from './truths.json';
import dares from './dares.json';
import type { LocalizedString } from '../../../sdk/types';
import type { DatasetDescriptor, EnumFieldDef } from '../../../content/types';
import { objectFileDataset } from '../../../content/datasetBuilders';
import { registerRebuilder } from '../../../content/overrides';

export type Intensity = 'mild' | 'medium' | 'spicy' | 'extreme';
export type PromptKind = 'truth' | 'dare';

export interface PromptItem {
  id: string;
  kind: PromptKind;
  intensity: Intensity;
  text: LocalizedString;
  tags?: string[];
  minPlayers?: number;
  requiresProps?: boolean;
}

export interface DeckFile {
  schemaVersion: number;
  deckId: string;
  kind: PromptKind;
  title: LocalizedString;
  items: PromptItem[];
}

export const INTENSITIES: Intensity[] = ['mild', 'medium', 'spicy', 'extreme'];

const GAME = 'truth-or-dare';

const INTENSITY_FIELD: EnumFieldDef = {
  key: 'intensity',
  label: { en: 'Intensity', fa: 'شدت' },
  default: 'mild',
  options: [
    { value: 'mild', label: { en: 'Mild', fa: 'ملایم' } },
    { value: 'medium', label: { en: 'Medium', fa: 'متوسط' } },
    { value: 'spicy', label: { en: 'Spicy', fa: 'تند' } },
    { value: 'extreme', label: { en: 'Extreme (18+)', fa: 'شدید (+۱۸)' } },
  ],
};

export const DATASETS: DatasetDescriptor[] = [
  objectFileDataset({
    gameId: GAME,
    datasetId: 'truths',
    itemsKey: 'items',
    defaultFile: truths,
    sourcePath: 'src/games/truth-or-dare/content/truths.json',
    title: { en: 'Truths', fa: 'حقیقت‌ها' },
    itemNoun: { en: 'truth', fa: 'حقیقت' },
    idPrefix: 'truth-',
    locFields: [{ key: 'text', label: { en: 'Question', fa: 'سوال' }, multiline: true }],
    enumFields: [INTENSITY_FIELD],
    constantFields: { kind: 'truth' },
  }),
  objectFileDataset({
    gameId: GAME,
    datasetId: 'dares',
    itemsKey: 'items',
    defaultFile: dares,
    sourcePath: 'src/games/truth-or-dare/content/dares.json',
    title: { en: 'Dares', fa: 'جرأت‌ها' },
    itemNoun: { en: 'dare', fa: 'جرأت' },
    idPrefix: 'dare-',
    locFields: [{ key: 'text', label: { en: 'Dare', fa: 'جرأت' }, multiline: true }],
    enumFields: [INTENSITY_FIELD],
    constantFields: { kind: 'dare' },
  }),
];

export const TRUTHS: PromptItem[] = [];
export const DARES: PromptItem[] = [];
export const ALL_PROMPTS: PromptItem[] = [];
export const PROMPT_BY_ID: Record<string, PromptItem> = {};

function rebuild(): void {
  TRUTHS.length = 0;
  TRUTHS.push(...(DATASETS[0].readFile() as DeckFile).items);
  DARES.length = 0;
  DARES.push(...(DATASETS[1].readFile() as DeckFile).items);
  ALL_PROMPTS.length = 0;
  ALL_PROMPTS.push(...TRUTHS, ...DARES);
  for (const k of Object.keys(PROMPT_BY_ID)) delete PROMPT_BY_ID[k];
  for (const p of ALL_PROMPTS) PROMPT_BY_ID[p.id] = p;
}
registerRebuilder(rebuild);

/** Filter a kind's pool by enabled intensities + minPlayers gate (NOT shuffled). */
export function getPool(opts: {
  kind: PromptKind;
  intensities: Record<Intensity, boolean>;
  playerCount: number;
}): PromptItem[] {
  const source = opts.kind === 'truth' ? TRUTHS : DARES;
  return source.filter(
    (p) => opts.intensities[p.intensity] && (p.minPlayers ?? 2) <= opts.playerCount,
  );
}

export function validateContent(): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const p of ALL_PROMPTS) {
    if (seen.has(p.id)) problems.push(`duplicate id ${p.id}`);
    seen.add(p.id);
    if (!p.text?.en?.trim() || !p.text?.fa?.trim()) problems.push(`empty text ${p.id}`);
    if (!INTENSITIES.includes(p.intensity)) problems.push(`bad intensity ${p.id}`);
  }
  return problems;
}
