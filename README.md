# makefun-gta6-01

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/people871/makefun-gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/people871/makefun-gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

SOLMAR HEAT — an original top-down open-world crime game in the fictional city of Solmar Bay. You are Ray "Vela" Cruz, a driver fresh out of the impound lot, working for fixer Rico Marín: steal cars, outrun the Solmar Bay police, and pull off the Big Score. Everything here — city, characters, vehicles, names, story, art, sound and music — is original. Nothing comes from Rockstar Games or any other commercial game.

## Run it

```sh
node serve.ts          # then open http://localhost:8080
```

No build step, no network requests: `game/` is plain static files.

| Key | Action |
| --- | ------ |
| WASD / arrows | Walk, or drive (W accelerate, S brake/reverse, A/D steer) |
| E | Enter / exit a car, steal a parked or driven car |
| F or click | Punch |
| Shift | Sprint on foot |
| P / Esc | Pause (S saves, Q quits to title) |
| M | Mute |
| Enter | Start / continue, advance dialogue, retry after Wasted / Busted |

## Systems

- **City on foot and by car** — a 3200×2400 Solmar Bay with avenues,
  streets, a park, the marina, the beach and the sea; enter, exit and steal
  cars (parked or driven).
- **Traffic and pedestrians** — cars cruise the road grid and stop for
  traffic ahead; pedestrians stroll the sidewalks and flee from trouble.
- **Wanted level and police** — stars rise with crimes (car theft, assault,
  running people over) and fall while you lay low; police cars chase and ram,
  foot cops chase, punch and arrest.
- **Missions and story** — four chained jobs with briefings, markers,
  dialogue and rewards: Hot Wheels, The Courier, Heat Wave, The Big Score.
- **Combat** — fists on foot, with knockback, particles and sound; cops
  fight back.
- **HUD** — health, money, wanted stars, mission objective, speed while
  driving, and a live minimap with the mission marker and police.
- **Start screen and save** — title with Continue / New game; progress saves
  to localStorage after every mission (and with S in the pause menu).
- **Polish** — sun-soaked look, synthesized WebAudio music and effects
  (engine, sirens, punches, mission jingle), particles, pause, and
  Wasted / Busted screens.

## Layout

- `game/index.html` — the page; `game/src/` — one job per file:
  `config.js` (tuning/palette), `random.js`, `input.js`, `world.js`
  (simulation), `missions.js` (story), `audio.js` (synth sound/music),
  `render.js` (drawing + HUD + screens), `shots.js` (screenshot staging),
  `main.js` (loop, save/load, self-test).
- `main.ts` — the make.fun program: copies `game/` and `screenshots/` to
  `/output` and writes `dossier.json` with `vendor/makefun-game.ts`.
- `screenshots/` — four real renders of the game's own code (title, driving,
  police chase, mission).
- `shots.json` — the `?shot=` scenes behind them, staged by playing the
  real simulation with an autopilot.
- `serve.ts` — a tiny static server for local play-testing.

## Screenshots

1. `1-start.jpg` — title screen over downtown Solmar Bay, Ray on foot.
2. `2-drive.jpg` — driving the stolen Comet through traffic.
3. `3-chase.jpg` — wanted level 3, police in pursuit.
4. `4-mission.jpg` — The Courier: the marina pickup, HUD and minimap.

## License

MIT — see `LICENSE`.

---

<sub>Entered on [make.fun](https://make.fun/?ref=t9cvg4vb&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
