import truths from './truths.json';
import dares from './dares.json';
import type { LocalizedString } from '../../../sdk/types';

export type Intensity = 'mild' | 'medium' | 'spicy';
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

export const TRUTHS: PromptItem[] = (truths as DeckFile).items;
export const DARES: PromptItem[] = (dares as DeckFile).items;
export const ALL_PROMPTS: PromptItem[] = [...TRUTHS, ...DARES];

export const PROMPT_BY_ID: Record<string, PromptItem> = Object.fromEntries(
  ALL_PROMPTS.map((p) => [p.id, p]),
);

export const INTENSITIES: Intensity[] = ['mild', 'medium', 'spicy'];

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
