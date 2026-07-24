// src/studio/pages/DatasetPage.tsx — the editor for one dataset (table or cards).
import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { getContentGame, getDataset } from '../../content/registry';
import type { ContentGame } from '../../content/registry';
import type { DatasetDescriptor } from '../../content/types';
import { isFlat } from '../../content/columns';
import { useDatasetEditing } from '../lib/useDatasetEditing';
import { Toolbar } from '../components/Toolbar';
import { TableEditor } from '../components/TableEditor';
import { CardEditor } from '../components/CardEditor';
import { SaveBadge } from '../components/SaveBadge';
import { en } from '../lib/format';

function Editor({ ds, game, focusId }: { ds: DatasetDescriptor; game?: ContentGame; focusId: string | null }) {
  const ed = useDatasetEditing(ds);
  const [search, setSearch] = useState('');
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const flat = isFlat(ds);

  return (
    <>
      <header className="flex items-center gap-3 border-b border-[var(--s-border)] px-5 py-3">
        <span className="text-2xl">{game?.manifest.icon}</span>
        <div className="min-w-0">
          <div className="truncate text-xs text-[var(--s-dim)]">
            {game ? en(game.manifest.name) : ds.gameId}
            {ds.sourcePath && <span className="mono"> · {ds.sourcePath}</span>}
          </div>
          <h1 className="truncate text-lg font-bold text-[var(--s-text)]">{en(ds.title)}</h1>
        </div>
        <span className="ml-1 shrink-0 rounded-full bg-[var(--s-sunk)] px-2 py-0.5 text-xs text-[var(--s-muted)]">
          {ed.items.length} {en(ds.itemNoun)}
        </span>
        <div className="ml-auto shrink-0">
          <SaveBadge status={ed.status} mode={ed.mode} hasSource={!!ds.sourcePath} />
        </div>
      </header>

      <div className="px-5 py-2.5">
        <Toolbar ed={ed} search={search} setSearch={setSearch} flaggedOnly={flaggedOnly} setFlaggedOnly={setFlaggedOnly} />
        {ed.error && <p className="mt-2 text-xs font-medium text-[var(--s-danger)]">{ed.error}</p>}
        {!ds.sourcePath && (
          <p className="mt-2 text-xs text-[var(--s-warn)]">
            This dataset has no JSON source file, so edits can’t auto-save. Use <strong>JSON ↓</strong> to download and commit them.
          </p>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-5 pb-4">
        {flat ? (
          <TableEditor ds={ds} ed={ed} search={search} flaggedOnly={flaggedOnly} focusId={focusId} />
        ) : (
          <CardEditor ds={ds} ed={ed} search={search} flaggedOnly={flaggedOnly} focusId={focusId} />
        )}
      </div>
    </>
  );
}

export function DatasetPage() {
  const { gameId = '', datasetId = '' } = useParams();
  const [params] = useSearchParams();
  const decodedId = decodeURIComponent(datasetId);
  const ds = getDataset(gameId, decodedId);
  const game = getContentGame(gameId);

  if (!ds) {
    return (
      <div className="grid flex-1 place-items-center p-8 text-center">
        <div>
          <p className="text-[var(--s-muted)]">That dataset doesn’t exist.</p>
          <Link to="/" className="mt-2 inline-block text-sm font-semibold text-[var(--s-accent-2)]">
            ← Back to all datasets
          </Link>
        </div>
      </div>
    );
  }

  // Remount the editor (fresh state + disk probe) whenever the dataset changes.
  return <Editor key={`${gameId}/${decodedId}`} ds={ds} game={game} focusId={params.get('focus')} />;
}
