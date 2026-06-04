import type { LocalizedString } from '../../../sdk/types';

export type Intensity = 'classic' | 'spicy' | 'wild';

export interface Statement {
  /** Stable, unique across ALL decks, e.g. "nhie-c-001". */
  id: string;
  /** Full bilingual sentence; reads as "Never have I ever …" / "من هیچ‌وقت …". */
  text: LocalizedString;
  intensity: Intensity;
  tags?: string[];
}

export interface StatementDeckFile {
  intensity: Intensity;
  version: number;
  items: Statement[];
}
