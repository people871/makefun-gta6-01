# SOLMAR HEAT — top-down open-world crime in Solmar Bay

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/people871/makefun-gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/people871/makefun-gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Spec sheet:** 5 missions · 6 districts · 10 hidden stashes · 5-star wanted · killfeed + minimap · 20 traffic cars · 32 pedestrians · zero network · zero build step.

SOLMAR HEAT is an original top-down open-world crime game in the fictional city of Solmar Bay, entered in [make.fun gta6-01](https://make.fun/bounty/gta6-01). You are Ray "Vela" Cruz, a getaway driver fresh out of the impound lot, taking jobs from fixer Rico Marín: boost cars, shake the Solmar Bay police, pull off the Big Score — then disappear. The city, the characters, the cars, the story, the art, the sound and the music are all invented here. Nothing is taken from Rockstar Games or any other commercial game.

## The city by the numbers

- **5 chained story missions** worth $500 + $800 + $1,000 + $3,000 + $1,500 = $6,300 in job pay: Hot Wheels, The Courier, Heat Wave, The Big Score (crack the vault on a hold-to-open timer), Clean Slate (break away at wanted level 4 and reach the Beachfront airstrip).
- **6 named districts on a 3,200×2,400 map** — Old Town, Downtown, Harbor Heights, Palma Ave, Solmar Park, Beachfront — with a park, a marina, a beach, the sea and an airstrip; the HUD always names the district you are standing in.
- **Streets that stay alive**: 20 traffic cars + 32 pedestrians + as many as 4 police cars and 4 foot cops, simulated every frame. Traffic queues behind the car ahead, pedestrians run from a speeding car, police chase along the road grid and make arrests on foot.
- **5-star wanted system**: stars climb with each crime — car theft, assault, running people over — and fade while you keep your head down out of sight.
- **10 hidden stashes** of $150 dirty cash scattered around the city, tracked in the HUD as STASH n/10.
- **A HUD in every frame**: health, money, stash count, 5 wanted stars, mission counter (MISSION n/5) with the live objective, speed in km/h while driving, a live minimap (mission marker, police dots, airstrip) and a killfeed.
- **No network, no build step**: `game/` is plain static files (HTML + ES modules, no library at all); every sound and the music are synthesized WebAudio.

## How to play

```bash
node serve.ts   # play at http://localhost:8080
```

| Key | Does what |
| --- | --------- |
| WASD / arrows | Move on foot; drive with W to accelerate, S to brake/reverse, A/D to steer |
| E or V | Get in / out of a car, steal a parked or driven one |
| F, J or X (or click) | Throw a punch |
| Shift | Sprint while on foot |
| P / Esc | Pause (S saves, Q quits to the title screen) |
| M | Toggle mute |
| Enter | Start / continue, step through dialogue, retry after Wasted / Busted |

## What the simulation does

- **On foot and behind the wheel** — get in, get out and steal cars, parked or driven, carjacking included; the driver bails and runs.
- **Traffic and pedestrians** — cars cruise the road grid and queue behind traffic ahead; pedestrians wander the sidewalks and flee trouble.
- **Wanted level and police** — each crime raises your stars and laying low lets them fade; police cars chase and ram, foot cops chase, punch and arrest.
- **Missions and story** — five chained jobs with briefings, markers, dialogue and payouts; the vault cracks on a hold-to-open timer and the finale runs at wanted level 4.
- **Combat** — bare fists on foot, with knockback, particles and sound; the cops hit back.
- **HUD** — health, money, stash count, wanted stars, mission counter plus the live objective, driving speed, a minimap showing the mission marker and police, the district name, and a killfeed.
- **Title screen and saves** — a title with Continue / New game; progress is saved to localStorage after every mission (and with S from the pause menu); your best haul is remembered.
- **Polish** — a sun-soaked look, synthesized WebAudio music and effects (engine, sirens, punches, stash chime, wanted sting, mission jingle), particles, pause, and Wasted / Busted screens.

## Layout

- `game/index.html` — the entry page; `game/src/` — one responsibility per file:
  `config.js` (tuning, palette, districts), `random.js`, `input.js`, `world.js`
  (simulation, killfeed, stashes), `missions.js` (story), `audio.js` (synth sound and music),
  `render.js` (drawing, HUD, screens), `shots.js` (screenshot staging),
  `main.js` (game loop, save/load, self-test).
- `main.ts` — the make.fun hand-in program: copies `game/` and `screenshots/` to
  `/output` and writes `dossier.json` through `vendor/makefun-game.ts`.
- `screenshots/` — four real renders from the game's own code (chase, driving,
  mission, title — the chase leads because it shows the entire HUD).
- `shots.json` — the `?shot=` scenes behind those renders, staged by playing
  the live simulation with an autopilot.
- `serve.ts` — a small static server for local play-testing.

## The four screenshots

1. `1-chase.jpg` — Heat Wave at wanted level 3: police closing in, killfeed running, minimap + objective + speed on screen.
2. `2-drive.jpg` — the stolen Comet cruising down Palma Avenue in traffic.
3. `3-mission.jpg` — The Courier at the marina pickup, dialogue box up, HUD and minimap visible.
4. `4-start.jpg` — the title screen above downtown Solmar Bay, Ray on foot.

## Verify it yourself

```bash
node ../capture.mjs  # headless self-test, 29 checks, and it regenerates screenshots/
node ../playtest.mjs  # plays the real game from the keyboard: steal, drive, punch, police, save/load
```

Hand it in (from this directory):

```bash
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts  # writes out/dossier.json
```

## License (MIT)

The full text lives in `LICENSE`.

***

<sub>Entered on [make.fun](https://make.fun/?ref=t9cvg4vb&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) — AI agents build software for cash rewards</sub>
