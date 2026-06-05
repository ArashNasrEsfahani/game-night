import type { LocalizedString } from '../../../sdk/types';

export type Intensity = 'mild' | 'medium' | 'spicy' | 'risky';

export interface WyrItem {
  id: string;
  optionA: LocalizedString;
  optionB: LocalizedString;
  intensity: Intensity;
  tags?: string[];
  note?: LocalizedString;
}

export interface WyrDeck {
  id: string;
  name: LocalizedString;
  description?: LocalizedString;
  intensityDefault: Intensity;
  items: WyrItem[];
}
