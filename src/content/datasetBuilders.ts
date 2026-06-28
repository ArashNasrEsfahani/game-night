// src/content/datasetBuilders.ts — factories that turn a source file into a DatasetDescriptor.
//
// Two file shapes cover every game:
//   • objectFileDataset — file is `{ ...meta, [itemsKey]: Item[] }`  (most games)
//   • arrayFileDataset  — file is `Item[]`                            (Dowr categories)
import type {
  DatasetDescriptor,
  DatasetItem,
  EnumFieldDef,
  LocFieldDef,
  SubListDef,
  TextFieldDef,
} from './types';
import type { LocalizedString } from '../sdk/types';
import { hasOverride, readOverride, resetOverride, writeOverride } from './overrides';

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

const emptyLoc = (): LocalizedString => ({ en: '', fa: '' });

function mintId(prefix: string): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}${rand}`;
}

function buildNewItem(
  idPrefix: string,
  locFields: LocFieldDef[],
  textFields: TextFieldDef[],
  enumFields: EnumFieldDef[],
  constantFields: Record<string, unknown>,
  subList?: SubListDef,
): DatasetItem {
  const item: DatasetItem = { id: mintId(idPrefix), ...clone(constantFields) };
  for (const f of locFields) item[f.key] = emptyLoc();
  for (const f of textFields) item[f.key] = '';
  for (const f of enumFields) item[f.key] = f.default;
  if (subList) item[subList.key] = [];
  return item;
}

interface CoreConfig {
  gameId: string;
  datasetId: string;
  title: LocalizedString;
  itemNoun: LocalizedString;
  idPrefix: string;
  sourcePath: string | null;
  locFields: LocFieldDef[];
  textFields?: TextFieldDef[];
  enumFields?: EnumFieldDef[];
  subList?: SubListDef;
  /** Fixed props stamped onto every new item (e.g. a file-wide `category` or `kind`). */
  constantFields?: Record<string, unknown>;
}

interface ShapeAdapter {
  getItems: (file: unknown) => DatasetItem[];
  withItems: (base: unknown, items: DatasetItem[]) => unknown;
  isValidFile: (file: unknown) => boolean;
}

function makeDescriptor(
  cfg: CoreConfig,
  defaultFile: unknown,
  shape: ShapeAdapter,
): DatasetDescriptor {
  const textFields = cfg.textFields ?? [];
  const enumFields = cfg.enumFields ?? [];

  const readFile = (): unknown =>
    readOverride<unknown>(cfg.gameId, cfg.datasetId) ?? defaultFile;

  return {
    gameId: cfg.gameId,
    datasetId: cfg.datasetId,
    title: cfg.title,
    itemNoun: cfg.itemNoun,
    idPrefix: cfg.idPrefix,
    locFields: cfg.locFields,
    textFields: cfg.textFields,
    enumFields: cfg.enumFields,
    subList: cfg.subList,
    sourcePath: cfg.sourcePath,

    readFile,
    defaultFile: () => defaultFile,
    readItems: () => clone(shape.getItems(readFile())),
    defaultItemCount: () => shape.getItems(defaultFile).length,
    isOverridden: () => hasOverride(cfg.gameId, cfg.datasetId),

    newItem: () =>
      buildNewItem(
        cfg.idPrefix,
        cfg.locFields,
        textFields,
        enumFields,
        cfg.constantFields ?? {},
        cfg.subList,
      ),

    toFile: (items) => shape.withItems(readFile(), items),

    save: (items) =>
      writeOverride(cfg.gameId, cfg.datasetId, shape.withItems(readFile(), items)),

    saveFile: (file) => {
      if (!shape.isValidFile(file)) {
        throw new Error('Imported JSON does not match this dataset shape.');
      }
      return writeOverride(cfg.gameId, cfg.datasetId, file);
    },

    reset: () => resetOverride(cfg.gameId, cfg.datasetId),
  };
}

/** A file shaped `{ ...meta, [itemsKey]: Item[] }`. */
export function objectFileDataset(
  cfg: CoreConfig & { defaultFile: unknown; itemsKey: string },
): DatasetDescriptor {
  const { itemsKey, defaultFile, ...core } = cfg;
  const getItems = (file: unknown): DatasetItem[] => {
    const arr = (file as Record<string, unknown>)?.[itemsKey];
    return Array.isArray(arr) ? (arr as DatasetItem[]) : [];
  };
  return makeDescriptor(core, defaultFile, {
    getItems,
    withItems: (base, items) => ({ ...(base as object), [itemsKey]: items }),
    isValidFile: (file) =>
      !!file && typeof file === 'object' && Array.isArray((file as Record<string, unknown>)[itemsKey]),
  });
}

/** A file that is itself an array of items (e.g. Dowr's per-category files). */
export function arrayFileDataset(
  cfg: CoreConfig & { defaultFile: DatasetItem[] },
): DatasetDescriptor {
  const { defaultFile, ...core } = cfg;
  return makeDescriptor(core, defaultFile, {
    getItems: (file) => (Array.isArray(file) ? (file as DatasetItem[]) : []),
    withItems: (_base, items) => items,
    isValidFile: (file) => Array.isArray(file),
  });
}
