// src/content/types.ts — the field-driven description of an editable dataset.
//
// A DatasetDescriptor is a self-contained, generic description of one source file's
// content. The Content Studio renders an editor purely from this (it knows nothing about
// any specific game), and each game's content loader uses the SAME descriptor to read its
// effective (default + override) data. One source of truth, two consumers.
import type { LocalizedString } from '../sdk/types';

/** A bilingual ({en, fa}) field on an item — the actual editable "words / phrases". */
export interface LocFieldDef {
  key: string;
  label: LocalizedString;
  multiline?: boolean;
  /** Optional content (e.g. a hint) — left blank is fine, so it is never flagged as "empty". */
  optional?: boolean;
}

/** A plain (non-localized) short text field, e.g. an emoji / icon. */
export interface TextFieldDef {
  key: string;
  label: LocalizedString;
  placeholder?: string;
}

export interface EnumOption {
  value: string;
  label: LocalizedString;
}

/** A constrained choice on an item, e.g. difficulty or intensity. */
export interface EnumFieldDef {
  key: string;
  label: LocalizedString;
  options: EnumOption[];
  default: string;
}

/** A nested editable list within each item (e.g. a Spyfall location's roles). */
export interface SubListDef {
  key: string;
  itemNoun: LocalizedString;
  locFields: LocFieldDef[];
  idPrefix: string;
}

/** One item (row) in a dataset. Always has a stable `id`; other props are field-driven. */
export interface DatasetItem {
  id: string;
  [key: string]: unknown;
}

export interface DatasetDescriptor {
  gameId: string;
  /** Unique within the game; mirrors the source file (e.g. "animals", "statements.spicy"). */
  datasetId: string;
  title: LocalizedString;
  /** Singular noun for one row, e.g. "word", "prompt", "location". */
  itemNoun: LocalizedString;
  /** Prefix used when minting ids for new items. */
  idPrefix: string;

  locFields: LocFieldDef[];
  textFields?: TextFieldDef[];
  enumFields?: EnumFieldDef[];
  subList?: SubListDef;

  /** Repo-relative path of the source JSON, for "export & commit". null = no source file. */
  sourcePath: string | null;

  /** Effective items (built-in default merged with any saved override). Safe to mutate. */
  readItems(): DatasetItem[];
  /** The whole effective file object (used for export and by the game loader). */
  readFile(): unknown;
  /** The built-in default file object (ignores overrides). */
  defaultFile(): unknown;
  /** Count of items in the built-in default (drives the "modified" hint). */
  defaultItemCount(): number;
  /** True when a saved override exists for this dataset. */
  isOverridden(): boolean;

  /** A blank item with sensible defaults for every field. */
  newItem(): DatasetItem;
  /** Build the source-file object for an item list WITHOUT persisting — used to write the
   *  edited JSON straight to disk (the Content Studio) or to export it. */
  toFile(items: DatasetItem[]): unknown;
  /** Persist an edited item list as an override (rebuilds the file shape). */
  save(items: DatasetItem[]): Promise<void>;
  /** Persist a raw file object (used by JSON import). Throws if the shape is invalid. */
  saveFile(file: unknown): Promise<void>;
  /** Discard the override, reverting to the built-in default. */
  reset(): Promise<void>;
}
