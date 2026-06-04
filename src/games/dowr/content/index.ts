import type { LocalizedString } from '../../../sdk/types';
import food from './food.json';
import objects from './objects.json';
import jobs from './jobs.json';
import places from './places.json';
import animals from './animals.json';

export type DowrCategory = 'food' | 'objects' | 'jobs' | 'places' | 'animals';
export type DowrDifficulty = 'easy' | 'med' | 'hard';

export interface WordCard {
  id: string;
  word: LocalizedString;
  category: DowrCategory;
  difficulty: DowrDifficulty;
  hints?: { taboo?: LocalizedString[] };
}

export const CONTENT: Record<DowrCategory, WordCard[]> = {
  food: food as unknown as WordCard[],
  objects: objects as unknown as WordCard[],
  jobs: jobs as unknown as WordCard[],
  places: places as unknown as WordCard[],
  animals: animals as unknown as WordCard[],
};

export const ALL_CARDS: WordCard[] = Object.values(CONTENT).flat();

export const CARD_BY_ID: Record<string, WordCard> = Object.fromEntries(
  ALL_CARDS.map((c) => [c.id, c]),
);
