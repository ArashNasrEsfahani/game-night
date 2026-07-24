// src/content/flagging.ts — heuristics that flag likely "weird"/broken items for review.
// Nothing is deleted automatically; the editor surfaces these so you can prune them fast.
import type { DatasetDescriptor, DatasetItem } from './types';
import type { LocalizedString } from '../sdk/types';

export interface Flag {
  code: string;
  label: LocalizedString;
}

const PERSIAN = /[؀-ۿ]/; // Arabic/Persian block
const norm = (s: string | undefined) => (s ?? '').trim().toLowerCase();

/** Datasets whose primary item is a single word/short label — these get length/gibberish checks. */
const shortKind = (ds: DatasetDescriptor) =>
  ['word', 'card', 'location', 'role'].includes(ds.itemNoun.en.toLowerCase());

/** Map of itemId → flags. Items with no problems are omitted. */
export function computeFlags(items: DatasetItem[], ds: DatasetDescriptor): Map<string, Flag[]> {
  const short = shortKind(ds);
  const primary = ds.locFields[0]?.key;

  const idCount = new Map<string, number>();
  const textCount = new Map<string, number>();
  for (const it of items) {
    idCount.set(it.id, (idCount.get(it.id) ?? 0) + 1);
    if (primary) {
      const t = norm((it[primary] as LocalizedString | undefined)?.en);
      if (t) textCount.set(t, (textCount.get(t) ?? 0) + 1);
    }
  }

  const out = new Map<string, Flag[]>();
  for (const it of items) {
    const flags: Flag[] = [];
    const add = (code: string, en: string, fa: string) => {
      if (!flags.some((f) => f.code === code)) flags.push({ code, label: { en, fa } });
    };

    if ((idCount.get(it.id) ?? 0) > 1) add('dupe-id', 'Duplicate id', 'شناسهٔ تکراری');

    for (const f of ds.locFields) {
      const ls = it[f.key] as LocalizedString | undefined;
      const en = (ls?.en ?? '').trim();
      const fa = (ls?.fa ?? '').trim();
      if (f.optional && !en && !fa) continue; // blank optional field is fine
      if (!en) add('empty-en', 'Empty English', 'انگلیسی خالی');
      if (!fa) add('empty-fa', 'Empty Persian', 'فارسی خالی');
      if (en && fa && en.toLowerCase() === fa.toLowerCase())
        add('untranslated', 'Not translated (EN = FA)', 'ترجمه‌نشده');
      if (fa && !PERSIAN.test(fa)) add('fa-no-persian', 'Persian field has no Persian', 'فیلد فارسی حروف فارسی ندارد');
      if (en && PERSIAN.test(en)) add('en-has-persian', 'English field has Persian', 'فیلد انگلیسی حروف فارسی دارد');
      // Only genuinely absurd lengths — NOT normal multi-word titles like "The Lord of the Rings".
      if (short && en && en.length > 60) add('too-long', 'Unusually long', 'خیلی بلند');
      // A 1-word term rendered as a 3+ word Persian phrase is too hard for one-word games.
      // (ZWNJ-joined compounds like "می‌رود" still count as one word — only real spaces split.)
      if (short) {
        const enWords = en ? en.split(/\s+/).filter(Boolean).length : 0;
        const faWords = fa ? fa.split(/\s+/).filter(Boolean).length : 0;
        if (enWords === 1 && faWords >= 3)
          add('fa-multiword', 'Persian is 3+ words for a 1-word term', 'فارسیِ سه‌کلمه‌ای برای یک واژهٔ تک‌کلمه‌ای');
      }
      if (en && /^[a-z]+$/i.test(en) && en.length >= 4 && !/[aeiouy]/i.test(en))
        add('gibberish', 'Looks like gibberish', 'به‌نظر بی‌معنی');
    }

    if (primary) {
      const t = norm((it[primary] as LocalizedString | undefined)?.en);
      if (t && (textCount.get(t) ?? 0) > 1) add('dupe-text', 'Duplicate text', 'متن تکراری');
    }

    if (flags.length) out.set(it.id, flags);
  }
  return out;
}
