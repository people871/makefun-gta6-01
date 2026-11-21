// SOLMAR HEAT — the make.fun gta6-01 hand-in driver.
// ·
// The pipeline, in order:
//   * prove game/index.html is actually here; without it there is nothing to hand in
//   * stage the whole game/ tree plus screenshots/ into the hand-in directory
//   * let the vendored make.fun helper assemble dossier.json inside that directory
//   * print a one-line receipt on stdout so a local run shows what landed
// ·
// The hand-in directory comes from MAKEFUN_OUTPUT_DIR and falls back to
// /output inside the grader. The game itself is dependency-free static
// files — HTML plus ES modules, every sound synthesized with WebAudio — so
// it opens offline in any desktop browser. Solmar Bay, Ray "Vela" Cruz,
// fixer Rico Marín, every street, car and mission are original creations;
// nothing is borrowed from Rockstar Games or any other commercial title.
// ·
// Grader equivalent, run locally:
//   MAKEFUN_OUTPUT_DIR=out node main.ts        # after mkdir -p out
// To play instead of handing in: `node serve.ts`, then http://localhost:8080.

import {
  cpSync as copyRecursive,
  existsSync as pathExists,
  mkdirSync as makeDir,
  readdirSync as readDir,
  statSync as statPath,
  writeFileSync as writeText,
} from 'node:fs';
import { join as joinPath } from 'node:path';
import { fileURLToPath as urlToPath } from 'node:url';
import { buildDossier as assembleDossier } from './vendor/makefun-game.ts';

// Anchor every path on this file's own directory.
const here = urlToPath(new URL('.', import.meta.url));
const { MAKEFUN_OUTPUT_DIR: requestedOut } = process.env;
const handInDir = requestedOut ?? '/output';
const gameDir = joinPath(here, 'game');
const shotsDir = joinPath(here, 'screenshots');
const entry = joinPath(gameDir, 'index.html');

// Refuse to ship an empty hand-in: the entry page is the proof the game is here.
if (!pathExists(entry)) {
  throw new Error(`SOLMAR HEAT: entry page missing at ${entry} — nothing to hand in`);
}

// Sorted plain-file names inside a folder; an absent folder yields none.
// An entry that cannot be statted (broken symlink, file vanishing mid-list)
// is skipped instead of killing the whole hand-in.
function plainFiles(folder: string): string[] {
  if (!pathExists(folder)) return [];
  const names = readDir(folder).filter((entryName) => {
    try {
      return statPath(joinPath(folder, entryName)).isFile();
    } catch {
      return false;
    }
  });
  return names.sort();
}

makeDir(handInDir, { recursive: true });
copyRecursive(gameDir, joinPath(handInDir, 'game'), { recursive: true });
makeDir(joinPath(handInDir, 'screenshots'), { recursive: true });
if (pathExists(shotsDir)) {
  copyRecursive(shotsDir, joinPath(handInDir, 'screenshots'), { recursive: true });
}

// The caps the scorer enforces (see reference/gate.json). Only
// text_max_bytes changes bytes; the rest reject entries the scorer would
// reject anyway: at most 4 screenshots, each at most 256 KiB; at most 993
// files under game/, at most 48 MiB of game files in total, and no game/
// path longer than 1000 bytes. (game/ sits beside the output tree's own
// 1000-entry cap, its screenshots/ folder, and dossier.json.)
const limits = {
  text_max_bytes: 163_840,
  screenshots: { max: 4, max_bytes: 262_144 },
  game_max_files: 993, game_max_bytes: 50_331_648, game_path_max_bytes: 1000,
};
const dossier = assembleDossier(handInDir, limits);
writeText(joinPath(handInDir, 'dossier.json'), dossier);

// Receipt: destination, how many screenshots went along, dossier size.
const shotNames = plainFiles(shotsDir);
const receipt = `SOLMAR HEAT → ${handInDir} | game/ staged | screenshots ${shotNames.length} (${shotNames.join(', ') || 'none'}) | dossier.json ${dossier.length} bytes`;
console.log(receipt);
