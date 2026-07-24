// tools/vite-content-fs.ts — dev-only middleware that lets the Content Studio write a dataset's
// edited JSON straight to its source file on disk, so edits land in `git diff` instantly with no
// download/drop. Mounted only by the Studio dev server (vite.studio.config.ts); the player app's
// vite.config.ts never includes it, so the games build can't write files.
//
// Hard safety limits (localhost dev tool, but still): writes are restricted to
// <repo>/src/games/**/*.json — no traversal, no other extensions, no escaping the games tree.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';

const ALLOWED_PREFIX = 'src/games/';

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 8 * 1024 * 1024) reject(new Error('payload too large')); // 8 MB guard
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function sendJSON(res: ServerResponse, status: number, body: unknown): void {
  const text = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(text);
}

/** Resolve a client-supplied repo-relative path to an absolute one, or null if it's not allowed. */
function safeResolve(root: string, sourcePath: unknown): string | null {
  if (typeof sourcePath !== 'string' || !sourcePath) return null;
  const rel = sourcePath.replace(/\\/g, '/').replace(/^\.\//, '');
  if (rel.includes('..')) return null;
  if (!rel.startsWith(ALLOWED_PREFIX)) return null;
  if (!rel.toLowerCase().endsWith('.json')) return null;
  const abs = path.resolve(root, rel);
  const gamesRoot = path.resolve(root, ALLOWED_PREFIX);
  // Final guard: the resolved path must stay inside <root>/src/games.
  if (abs !== gamesRoot && !abs.startsWith(gamesRoot + path.sep)) return null;
  return abs;
}

export function contentFsPlugin(): Plugin {
  return {
    name: 'content-fs-writer',
    apply: 'serve', // dev server only — never part of a production build
    configureServer(server) {
      const root = server.config.root;

      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? '';

        if (req.method === 'GET' && url.startsWith('/__content/health')) {
          sendJSON(res, 200, { ok: true });
          return;
        }

        if (req.method === 'POST' && url.startsWith('/__content/save')) {
          try {
            const raw = await readBody(req);
            const { sourcePath, content } = JSON.parse(raw) as {
              sourcePath?: string;
              content?: string;
            };

            const abs = safeResolve(root, sourcePath);
            if (!abs) {
              sendJSON(res, 400, { ok: false, error: `Rejected path: ${sourcePath}` });
              return;
            }
            if (typeof content !== 'string') {
              sendJSON(res, 400, { ok: false, error: 'Missing "content" string.' });
              return;
            }
            // Validate it's real JSON before touching the file, so a bad write can't corrupt a source.
            try {
              JSON.parse(content);
            } catch {
              sendJSON(res, 400, { ok: false, error: 'Body "content" is not valid JSON.' });
              return;
            }

            const text = content.endsWith('\n') ? content : content + '\n';
            await fs.writeFile(abs, text, 'utf8');
            server.config.logger.info(`[content-fs] wrote ${path.relative(root, abs)}`);
            sendJSON(res, 200, { ok: true });
          } catch (err) {
            sendJSON(res, 500, { ok: false, error: (err as Error).message });
          }
          return;
        }

        next();
      });
    },
  };
}
