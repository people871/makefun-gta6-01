# SOLMAR HEAT — 5 missions, 6 districts, 10 hidden stashes, 5-star wanted, killfeed + minimap

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/people871/makefun-gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/people871/makefun-gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

SOLMAR HEAT — an original top-down open-world crime game in the fictional city of Solmar Bay, built for [make.fun gta6-01](https://make.fun/bounty/gta6-01). You are Ray "Vela" Cruz, a driver fresh out of the impound lot, working for fixer Rico Marín: steal cars, outrun the Solmar Bay police, and pull off the Big Score — then vanish. Everything here — city, characters, vehicles, names, story, art, sound and music — is original. Nothing comes from Rockstar Games or any other commercial game.

## The numbers

- **5 chained story missions** ($500 + $800 + $1,000 + $3,000 + $1,500 = $6,300 in job rewards): Hot Wheels, The Courier, Heat Wave, The Big Score (vault-cracking hold-to-open), Clean Slate (escape at wanted level 4 to the Beachfront airstrip).
- **3,200×2,400 city in 6 named districts** — Old Town, Downtown, Harbor Heights, Palma Ave, Solmar Park, Beachfront — with a park, marina, beach, sea and airstrip; the HUD always names the district you are in.
- **20 traffic cars + 32 pedestrians + up to 4 police cars and 4 foot cops**, all simulated live: traffic stops for the car ahead, pedestrians flee a speeding car, police chase along the road grid and arrest on foot.
- **5-star wanted system** — stars rise with crimes (car theft, assault, running people over) and decay while you lay low out of sight.
- **10 hidden stashes** of $150 dirty cash tucked around the city, tracked in the HUD (STASH n/10).
- **Full HUD in every frame**: health, money, stash count, 5 wanted stars, mission counter (MISSION n/5) + live objective, speed in km/h while driving, live minimap (mission marker, police dots, airstrip) and a killfeed.
- **Zero network, zero build step**: `game/` is plain static files (HTML + ES modules, no library); sound and music are synthesized WebAudio.

## Run it

```sh
node serve.ts          # then open http://localhost:8080
```

| Key | Action |
| --- | ------ |
| WASD / arrows | Walk, or drive (W accelerate, S brake/reverse, A/D steer) |
| E or V | Enter / exit a car, steal a parked or driven car |
| F, J or X (or click) | Punch |
| Shift | Sprint on foot |
| P / Esc | Pause (S saves, Q quits to title) |
| M | Mute |
| Enter | Start / continue, advance dialogue, retry after Wasted / Busted |

## Systems

- **City on foot and by car** — enter, exit and steal cars (parked or driven, carjacking included); the driver bails out and runs.
- **Traffic and pedestrians** — cars cruise the road grid and stop for traffic ahead; pedestrians stroll the sidewalks and flee from trouble.
- **Wanted level and police** — stars rise with crimes and fall while you lay low; police cars chase and ram, foot cops chase, punch and arrest.
- **Missions and story** — five chained jobs with briefings, markers, dialogue and rewards; the vault cracks on a hold-to-open timer and the finale runs at wanted level 4.
- **Combat** — fists on foot, with knockback, particles and sound; cops fight back.
- **HUD** — health, money, stash count, wanted stars, mission counter + objective, speed while driving, a live minimap with the mission marker and police, the current district name, and a killfeed.
- **Start screen and save** — title with Continue / New game; progress saves to localStorage after every mission (and with S in the pause menu); best haul is remembered.
- **Polish** — sun-soaked look, synthesized WebAudio music and effects (engine, sirens, punches, stash chime, wanted sting, mission jingle), particles, pause, and Wasted / Busted screens.

## Layout

- `game/index.html` — the page; `game/src/` — one job per file:
  `config.js` (tuning/palette/districts), `random.js`, `input.js`, `world.js`
  (simulation + killfeed + stashes), `missions.js` (story), `audio.js` (synth sound/music),
  `render.js` (drawing + HUD + screens), `shots.js` (screenshot staging),
  `main.js` (loop, save/load, self-test).
- `main.ts` — the make.fun program: copies `game/` and `screenshots/` to
  `/output` and writes `dossier.json` with `vendor/makefun-game.ts`.
- `screenshots/` — four real renders of the game's own code (chase, driving,
  mission, title — the chase is the cover because it shows the whole HUD).
- `shots.json` — the `?shot=` scenes behind them, staged by playing the
  real simulation with an autopilot.
- `serve.ts` — a tiny static server for local play-testing.

## Screenshots

1. `1-chase.jpg` — wanted level 3, Heat Wave: police in pursuit, killfeed live, minimap + objective + speed.
2. `2-drive.jpg` — driving the stolen Comet down Palma Avenue through traffic.
3. `3-mission.jpg` — The Courier: the marina pickup, dialogue box, HUD and minimap.
4. `4-start.jpg` — title screen over downtown Solmar Bay, Ray on foot.

## Verify it yourself

```sh
node ../capture.mjs    # headless self-test (25 checks) + regenerates screenshots/
node ../playtest.mjs   # plays the real game with the keyboard: steal, drive, punch, police, save/load
```

## License

MIT — see `LICENSE`.

---

<sub>Entered on [make.fun](https://make.fun/?ref=t9cvg4vb&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
