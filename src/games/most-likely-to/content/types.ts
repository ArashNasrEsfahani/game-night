import type { LocalizedString } from '../../../sdk/types';

/** Intensity tiers, mildest to spiciest. */
export type Intensity = 'family' | 'casual' | 'spicy';

export interface MltPrompt {
  id: string;
  /** Completes "…is most likely to …". */
  text: LocalizedString;
  intensity: Intensity;
  emoji?: string;
  tags?: string[];
}

export interface MltDeck {
  id: string;
  name: LocalizedString;
  description: LocalizedString;
  version: number;
  prompts: MltPrompt[];
}
