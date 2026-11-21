// SOLMAR HEAT — a tiny static server for playing the game locally.
// ·
//   node serve.ts                → game/ at http://localhost:8080
//   node serve.ts --port 9000    → same game, port 9000
//   node serve.ts --host 0.0.0.0 → reachable on every interface
// ·
// Nothing here is part of the shipped game: it only exists so the entry
// can be tried without a build step or a hosted static server. The game
// itself fetches nothing over the network. The server is intentionally
// dull — right MIME types, no caching at all, and any request that would
// walk out of game/ gets a 403. Node 22, standard library only.
import { createReadStream as openStream, existsSync as pathExists, statSync as statPath } from 'node:fs';
import { createServer as makeServer } from 'node:http';
import {
  extname as fileExt,
  join as joinPath,
  normalize as cleanPath,
  resolve as absPath,
  sep as pathSep,
} from 'node:path';
import { fileURLToPath as urlToPath } from 'node:url';

// The directory being served, resolved a single time when the process starts.
const servedRoot = absPath(urlToPath(new URL('./game', import.meta.url)));

// --- Flags ----------------------------------------------------------------
const argv = process.argv.slice(2);

function flagValue(name: string, fallback: string): string {
  const slot = argv.indexOf(name);
  if (slot === -1 || slot + 1 >= argv.length) return fallback;
  return argv[slot + 1];
}

function chosenPort(): number {
  const wanted = Number(flagValue('--port', '8080'));
  const ok = Number.isInteger(wanted) && wanted > 0 && wanted < 65536;
  return ok ? wanted : 8080;
}

const port = chosenPort();
const host = flagValue('--host', '127.0.0.1');

// --- MIME table -----------------------------------------------------------
const mimePairs: Array<[string, string]> = [
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.gif', 'image/gif'],
  ['.webp', 'image/webp'],
  ['.svg', 'image/svg+xml'],
  ['.ico', 'image/x-icon'],
  ['.woff2', 'font/woff2'],
  ['.glb', 'model/gltf-binary'],
  ['.gltf', 'model/gltf+json'],
  ['.bin', 'application/octet-stream'],
  ['.wasm', 'application/wasm'],
  ['.wav', 'audio/wav'],
  ['.mp3', 'audio/mpeg'],
  ['.ogg', 'audio/ogg'],
  ['.txt', 'text/plain; charset=utf-8'],
];
const mimeFor = new Map(mimePairs);

// --- Request handling -----------------------------------------------------
function sendStatus(res: any, code: number, text?: string): void {
  res.writeHead(code);
  res.end(text ?? '');
}

function pathFromRequest(req: any): string | null {
  try { // decodeURIComponent throws on a malformed % escape
    const parsed = new URL(req.url ?? '/', 'http://127.0.0.1');
    return decodeURIComponent(parsed.pathname);
  } catch { return null; }
}

function handleRequest(req: any, res: any): void {
  const raw = pathFromRequest(req);
  if (raw === null) return sendStatus(res, 400, 'bad request');
  const wantedPath = raw.endsWith('/') ? raw + 'index.html' : raw;

  const resolved = absPath(joinPath(servedRoot, cleanPath(wantedPath)));
  const inside = resolved === servedRoot || resolved.startsWith(servedRoot + pathSep);
  if (!inside) return sendStatus(res, 403, 'forbidden');
  if (!pathExists(resolved)) return sendStatus(res, 404, 'not found');
  const found = statPath(resolved);
  if (!found.isFile()) return sendStatus(res, 404, 'not found');

  const type = mimeFor.get(fileExt(resolved).toLowerCase()) ?? 'application/octet-stream';
  res.setHeader('content-type', type);
  res.setHeader('content-length', found.size);
  res.setHeader('cache-control', 'no-store');
  res.writeHead(200);
  openStream(resolved).pipe(res);
}

const server = makeServer(handleRequest);
server.listen(port, host, () => {
  console.log(`SOLMAR HEAT — game/ serving at http://${host}:${port}`);
});
