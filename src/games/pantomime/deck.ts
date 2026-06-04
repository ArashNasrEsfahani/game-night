import { shuffle } from '../../engine/rng';
import { selectPrompts } from './content';
import type { PantomimePrompt } from './content';
import type { PantomimeOptions } from './config';

export { shuffle };

/** Build the UNSHUFFLED prompt pool for the chosen categories/difficulties (deck/seed shuffles). */
export function buildPool(o: PantomimeOptions): PantomimePrompt[] {
  return selectPrompts(o.categories, o.difficulties);
}
