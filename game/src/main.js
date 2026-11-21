// SOLMAR HEAT — boot plus game loop for the Solmar Bay crime sandbox.
// The boot picks one mode, the loop runs the game.
// The page boots into exactly one of three modes, picked from the URL:
//   ?selftest=1   headless checks over the world and the missions; the
//                 outcome lands on window.__selftest for the harness.
//   ?shot=<name>  a staged frame (start, drive, chase, mission) painted
//                 twice, then window.__shotReady flips to true.
//   (plain)       the playable game: title, play, paused, wasted, busted.
// Play runs on a single requestAnimationFrame loop. Keys are sampled once
// per frame and the simulation then steps in fixed 1/60 s slices, so it
// plays the same on a 60 Hz screen and a 144 Hz one. A save slot and a
// best-money record live in localStorage.
import { STEP, SAVE_KEY, BEST_KEY, MONEY } from './config.js';
import { MISSIONS, createMissions } from './missions.js';
import { createWorld, EVENT_WANTED_UP, EVENT_WASTED,
    EVENT_STEAL, EVENT_STASH, EVENT_PUNCH,
    EVENT_PICKUP, EVENT_CRASH, EVENT_BUSTED } from './world.js';
import { createInput, ACTION_PUNCH, ACTION_PAUSE,
    ACTION_MUTE, ACTION_INTERACT, ACTION_CONFIRM } from './input.js';
import { SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSED,
    SCREEN_OVER, SCREEN_BUSTED, createRenderer } from './render.js';
import { createRandom } from './random.js'; // rng factory
import { createAudio } from './audio.js'; // synth effects and engine hum
import { stageShot } from './shots.js'; // screenshot scene staging

// What the URL asked for, and the seed the world is built from.
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const selftestMode = params.get('selftest') === '1';
const seedText = params.get('seed') ?? '';
const seedNum = Number.parseInt(seedText, 10);
const seedValue = Number.isInteger(seedNum) ? seedNum : Math.floor(Math.random() * 2 ** 32);

// One frame never pushes the world further than a quarter of a second;
// a hitch just drops time instead of teleporting the simulation.
const FRAME_CAP = 1 / 4;
const STILL = { sprint: false, x: 0, y: 0 };

// The shared objects every mode draws from: one world, its missions, a
// renderer for the canvas, sound, and the live-region announcer.
const board = document.getElementById('game');
const liveRegion = document.getElementById('status');
const sim = createWorld(createRandom(seedValue));
const story = createMissions(sim);
const view = createRenderer(board);
const sound = createAudio();

// Headless probe: the playtest harness reads the live world through this.
window.__game = { world: sim, missions: story };

function announce(text) {
  liveRegion.textContent = text;
}

// --- save slot and best money -------------------------------------------
// Both live in localStorage. Every access is guarded: with storage off,
// reads fall back to a fresh start and writes report failure.

function readSave() {
  let parsed = null;
  try { // storage throws when it is disabled or full
    const text = window.localStorage.getItem(SAVE_KEY);
    parsed = text ? JSON.parse(text) : null;
  } catch (err) { // unreadable save counts as no save
    parsed = null;
  }
  return parsed;
}

function writeSave() {
  let stored = false;
  try { // storage throws when it is disabled or full
    const payload = { v: 1, player: sim.serialize(), missionIndex: story.state.index, missionStep: story.state.stepIndex, finished: story.state.finished, savedAt: Date.now() };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
    stored = true;
  } catch (err) { // a failed write reports false
    stored = false;
  }
  return stored;
}

function clearSave() {
  try { // storage throws when it is disabled
    const key = SAVE_KEY;
    window.localStorage.removeItem(key);
  } catch (err) { // a missing save is a fresh start either way
  }
}

function readBest() {
  let record = 0;
  try { // storage throws when it is disabled
    record = Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch (err) { // no record on file reads as zero
    record = 0;
  }
  return record;
}

function writeBest(amount) {
  try { // storage throws when it is disabled
    window.localStorage.setItem(BEST_KEY, String(amount));
  } catch (err) { // best money is cosmetic; losing it is not fatal
  }
}

// Restore a save into the live world, picking the mission back up mid-way
// instead of restarting it from step one.
function applySave(slot) {
  sim.reset();
  sim.deserialize(slot.player);
  if (slot.finished) {
    story.state.finished = true;
    story.state.active = false;
  }
  if (!slot.finished) {
    story.startMission(slot.missionIndex ?? 0);
    const legCount = story.mission()?.steps.length ?? 1;
    story.state.stepIndex = Math.min(slot.missionStep ?? 0, legCount - 1);
    story.state.dialogue = null;
  }
}

// --- headless logic checks ------------------------------------------------
// World and mission checks only: nothing renders, nothing sounds. Every
// check is recorded by name on window.__selftest for the capture harness.

function runSelftest() {
  const outcomes = [];
  const note = (label, ok) => {
    outcomes.push({ name: label, ok: !!ok });
  };

  const sim = createWorld(createRandom(7));
  const story = createMissions(sim);
  const hero = sim.state.player;

  const x0 = hero.x;
  sim.step(STEP, { x: 1, y: 0, sprint: false }, 0);
  note('walking moves the player', hero.x > x0);
  note('city has buildings and roads', sim.state.buildings.length > 20);
  note('traffic exists', sim.state.cars.some((c) => c.traffic));
  note('pedestrians exist', sim.state.peds.length >= 10);
  note('five missions in the story', MISSIONS.length === 5);
  note('ten hidden stashes in the city', sim.state.pickups.filter((pk) => pk.kind === 'stash').length === 10);
  const mapNamed = sim.districtAt(300, 300) === 'OLD TOWN'
    && sim.districtAt(1500, 300) === 'DOWNTOWN'
    && sim.districtAt(1500, 2300) === 'BEACHFRONT';
  note('districts name the map', mapNamed);

  // On foot to the Comet, then E to take it.
  hero.x = 1290;
  hero.y = 1060;
  sim.step(STEP, { x: 0, y: 0, sprint: false }, ACTION_INTERACT);
  note('entering the Comet puts the player in a car', hero.inCar && hero.carId === 'comet');
  note('stealing the Comet logs the killfeed', sim.state.feed.some((f) => f.text.includes('Comet')));
  note('stealing a car counts it', sim.state.stats.carsStolen === 1);

  story.startMission(0);
  note('mission 1 starts', story.state.active && story.mission().id === 'hot-wheels');
  note('mission counter reads 1/5', story.missionCounter() === 'MISSION 1/5');
  story.update(STEP, false);
  story.update(STEP, false);
  note('reaching and stealing the Comet advances mission 1', story.state.stepIndex === 2);

  // Full throttle should build speed in the Comet.
  const ride = sim.playerCar();
  const v0 = Math.abs(ride.speed);
  for (let n = 0; n < 120; n += 1) sim.step(STEP, { x: 0, y: -1, sprint: false }, 0);
  note('driving accelerates', Math.abs(ride.speed) > v0 + 50);

  // Wanted: set it straight on the world, then wait for the police.
  sim.setWanted(2);
  note('wanted level sets', sim.state.wantedLevel === 2);
  for (let n = 0; n < 600; n += 1) sim.step(STEP, { x: 0, y: 0, sprint: false }, 0);
  note('police cars chase at wanted 2', sim.state.cars.some((c) => c.police));
  note('police on foot chase at wanted 2', sim.state.police.length > 0);

  // With the crime timer spent and every cop far away, heat should fade.
  sim.setWanted(1);
  sim.state.crimeTimer = 0;
  for (const c of sim.state.cars) {
    if (c.police) {
      c.x = 100;
      c.y = 100;
    }
  }
  for (const c of sim.state.police) {
    c.x = 100;
    c.y = 100;
  }
  hero.x = 3000;
  hero.y = 300;
  const heatBefore = sim.state.wanted;
  for (let n = 0; n < 600; n += 1) sim.step(STEP, { x: 0, y: 0, sprint: false }, 0);
  note('wanted decays while hidden', sim.state.wanted < heatBefore);

  // Serialise the world, load it into a fresh one, compare.
  const snap = sim.serialize();
  snap.money = 4321;
  const sim2 = createWorld(createRandom(7));
  sim2.deserialize(snap);
  const roundTrips = sim2.state.player.money === 4321 && sim2.state.player.x === snap.x;
  note('save/load round-trips money and position', roundTrips);

  // Fight check: one punch at a weakened pedestrian standing nearby.
  const sim3 = createWorld(createRandom(9));
  const mark = sim3.state.peds[0];
  mark.hp = 30; // a single punch drops this one, which is what draws heat
  sim3.state.player.x = mark.x - 30;
  sim3.state.player.y = mark.y;
  sim3.state.player.faceAngle = 0;
  const hp0 = mark.hp;
  sim3.step(STEP, { x: 0, y: 0, sprint: false }, ACTION_PUNCH);
  note('punching a pedestrian hurts it', mark.hp < hp0);
  note('punching raises the wanted level', sim3.state.wantedLevel >= 1);
  note('punching logs the killfeed', sim3.state.feed.length > 0);

  // Two solid punches on a healthy pedestrian should already earn a star:
  // the assault itself draws heat, not just the knock-out.
  const sim5 = createWorld(createRandom(13));
  const mark2 = sim5.state.peds[0];
  const swing = () => {
    sim5.state.player.x = mark2.x - 30;
    sim5.state.player.y = mark2.y;
    sim5.state.player.faceAngle = Math.atan2(mark2.y - sim5.state.player.y, mark2.x - sim5.state.player.x);
    sim5.step(STEP, { x: 0, y: 0, sprint: false }, ACTION_PUNCH);
  };
  swing();
  sim5.state.player.punchTimer = 0;
  swing();
  note('two landed punches draw a wanted star', sim5.state.wantedLevel >= 1);

  // Mission 2 should advance once the hero reaches the marina.
  story.startMission(1);
  sim.state.player.inCar = false;
  sim.state.player.carId = null;
  sim.state.player.x = 2740;
  sim.state.player.y = 2050;
  story.update(STEP, false);
  note('marina pickup advances mission 2', story.state.stepIndex === 1);

  // Mission 5 opens at wanted 4 with the airstrip as its target.
  story.startMission(4);
  note('mission 5 starts at wanted 4', story.mission().id === 'clean-slate' && sim.state.wantedLevel === 4);
  note('mission 5 target is the airstrip', story.marker() && story.marker().label === 'Airstrip');
  sim.state.player.x = 2960;
  sim.state.player.y = 2220;
  story.update(STEP, false);
  note('reaching the airstrip advances mission 5', story.state.stepIndex === 1);

  // Walking over a hidden stash should pay $150 and count as found.
  const sim4 = createWorld(createRandom(11));
  const cache = sim4.state.pickups.find((pk) => pk.kind === 'stash');
  const cash0 = sim4.state.player.money;
  sim4.state.player.x = cache.x;
  sim4.state.player.y = cache.y;
  const evts = sim4.step(STEP, { x: 0, y: 0, sprint: false }, 0);
  note('a hidden stash pays out', (evts & EVENT_STASH) !== 0 && sim4.state.player.money === cash0 + 150);
  note('stash count rises', sim4.state.stats.stashesFound === 1);

  window.__selftest = { checks: outcomes, pass: outcomes.every((c) => c.ok) };
}

// --- staged frames for screenshots ----------------------------------------
// Stage the named scene, paint it twice so the canvas settles, then raise
// the flag the capture harness waits on.

function paintShot(name) {
  const scene = stageShot(name, sim, story);
  let done = 0;
  const repaint = () => {
    view.draw(sim.state, scene.screen, story, { best: scene.best, hasSave: scene.hasSave, muted: false });
    done += 1;
    if (done >= 2) {
      window.__shotReady = true;
    } else {
      requestAnimationFrame(repaint);
    }
  };
  requestAnimationFrame(repaint);
}

// --- playing the game ------------------------------------------------------
// One rAF loop, fixed-step simulation, five screens, and the save slot.

function runGame() {
  const keys = createInput(board);
  let mode = SCREEN_TITLE;
  let bestMoney = readBest();
  let leftover = 0;
  let prevNow = performance.now();
  // Punch / interact for this frame's step, taken once from the
  // input snapshot and spent by the first step that runs.
  let pendingActions = 0;
  // E is held down (vault cracking); N, S and Q are one-shot menu keys.
  let eHeld = false;
  let nPressed = false;
  let sPressed = false;
  let qPressed = false;

  const onKeyDown = (event) => {
    const code = event.code;
    if (code === 'KeyE') eHeld = true;
    else if (code === 'KeyN' && !event.repeat) nPressed = true;
    else if (code === 'KeyS' && !event.repeat) sPressed = true;
    else if (code === 'KeyQ' && !event.repeat) qPressed = true;
  };
  const onKeyUp = (event) => {
    if (event.code === 'KeyE') eHeld = false;
  };
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  function startFresh() {
    clearSave();
    sim.reset();
    story.startMission(0);
    mode = SCREEN_PLAY;
    sound.unlock();
    announce('New game. Mission 1: Hot Wheels. Steal the yellow Comet on Palma Avenue.');
  }

  function resumeSave() {
    const slot = readSave();
    if (slot) {
      applySave(slot);
      mode = SCREEN_PLAY;
      sound.unlock();
      announce('Continuing. Mission ' + (story.state.index + 1) + '. ' + story.currentObjective());
    }
    if (!slot) startFresh();
  }

  // Wasted or busted: hospital fee or bail, keep the money, restart the
  // current mission from its first step, and save straight away.
  function handleDefeat() {
    const hero = sim.state.player;
    const kept = Math.max(0, hero.money - MONEY.hospitalFee);
    hero.money = kept;
    if (kept > bestMoney) {
      bestMoney = kept;
      writeBest(bestMoney);
    }
    const missionIdx = story.state.index;
    sim.reset();
    sim.state.player.money = kept;
    sim.state.player.hp = 100;
    story.startMission(missionIdx);
    story.state.dialogue = null;
    writeSave();
  }

  function onWorldEvents(flags) {
    if (flags & EVENT_PUNCH) sound.punch();
    if (flags & EVENT_PICKUP) sound.pickup();
    if (flags & EVENT_STASH) sound.stash();
    if (flags & EVENT_CRASH) sound.crash();
    if (flags & EVENT_STEAL) {
      sound.steal();
      announce('Car stolen. The cops noticed.');
    }
    if (flags & EVENT_WANTED_UP) {
      sound.heat();
      announce('Wanted level ' + sim.state.wantedLevel + '. Lose the police!');
    }
    if (flags & EVENT_WASTED) {
      sound.fail();
      handleDefeat();
      mode = SCREEN_OVER;
      announce('Wasted. Hospital fee $' + MONEY.hospitalFee + '. The mission restarts.');
    } else if (flags & EVENT_BUSTED) {
      sound.busted();
      handleDefeat();
      mode = SCREEN_BUSTED;
      announce('Busted. Bail $' + MONEY.hospitalFee + '. The mission restarts.');
    }
  }

  function onMissionEvents(list) {
    for (const ev of list) {
      if (ev.type === 'mission-complete') {
        sound.mission();
        writeSave();
        announce('Mission complete. +$' + ev.reward + '.');
      } else if (ev.type === 'mission-start') {
        announce('New mission: ' + story.mission().title + '.');
      } else if (ev.type === 'step-done') {
        sound.pickup();
      } else if (ev.type === 'story-complete') {
        writeSave();
        announce('Story complete. Solmar Bay is yours.');
      }
    }
  }

  // One-shot menu keys, routed by whichever screen is showing.
  function onActions(flags) {
    if (flags & ACTION_MUTE) {
      const muted = sound.toggleMute();
      announce(muted ? 'Sound off.' : 'Sound on.');
    }
    if (mode === SCREEN_TITLE) {
      if (nPressed) {
        nPressed = false;
        startFresh();
      } else if (flags & ACTION_CONFIRM) {
        sound.unlock();
        if (readSave()) resumeSave();
        else startFresh();
      }
    } else if (mode === SCREEN_OVER || mode === SCREEN_BUSTED) {
      if (flags & ACTION_CONFIRM) {
        mode = SCREEN_PLAY;
        announce('Back on the streets.');
      }
    } else if (mode === SCREEN_PAUSED) {
      if (sPressed) {
        sPressed = false;
        const saved = writeSave();
        announce(saved ? 'Game saved.' : 'Save failed — storage is off.');
      } else if (qPressed) {
        qPressed = false;
        mode = SCREEN_TITLE;
        announce('SOLMAR HEAT. Press Enter to continue or N for a new game.');
      } else if (flags & (ACTION_PAUSE | ACTION_CONFIRM)) {
        mode = SCREEN_PLAY;
        announce('Playing.');
      }
    } else if (flags & ACTION_PAUSE) {
      mode = SCREEN_PAUSED;
      announce('Paused. S saves, Q quits to title.');
    } else if (flags & ACTION_CONFIRM && story.state.dialogue) {
      story.advanceDialogue();
    }
  }

  // A single fixed slice of the live game. The title screen lets the
  // city idle behind the menu; other screens only step while playing.
  function tick() {
    if (mode === SCREEN_TITLE) {
      sim.step(STEP, STILL, 0);
    } else if (mode === SCREEN_PLAY) {
      const move = keys.move();
      const flags = sim.step(STEP, move, pendingActions);
      pendingActions = 0;
      onWorldEvents(flags);
      onMissionEvents(story.update(STEP, eHeld));
      const ride = sim.playerCar();
      const pace = sim.state.player.inCar ? Math.abs((ride ? ride.speed : 0) / 560) : 0;
      sound.setDriving(pace);
      sound.setSiren(sim.state.wantedLevel > 0);
    }
  }

  function loop(now) {
    requestAnimationFrame(loop);
    leftover += Math.min((now - prevNow) / 1000, FRAME_CAP);
    prevNow = now;
    // Actions are taken once per frame: menus use confirm and pause, the
    // world uses punch and interact from the same snapshot.
    const flags = keys.takeActions();
    pendingActions = flags & (ACTION_PUNCH | ACTION_INTERACT);
    onActions(flags);
    while (leftover >= STEP && (mode === SCREEN_TITLE || mode === SCREEN_PLAY)) {
      tick();
      leftover -= STEP;
    }
    if (mode !== SCREEN_TITLE && mode !== SCREEN_PLAY) leftover = 0;
    view.draw(sim.state, mode, story, {
      best: bestMoney,
      hasSave: !!readSave(),
      muted: sound.isMuted(),
    });
    // One-shot key flags are cleared here so a press between frames is kept.
    nPressed = false;
    sPressed = false;
    qPressed = false;
  }

  const onHidden = () => {
    if (document.hidden && mode === SCREEN_PLAY) {
      mode = SCREEN_PAUSED;
      announce('Paused.');
    }
  };
  document.addEventListener('visibilitychange', onHidden);

  announce('SOLMAR HEAT. Press Enter to start.');
  requestAnimationFrame(loop);
}

// --- start here ------------------------------------------------------------
// Self-test first, then a staged shot, then the playable game.
if (selftestMode) runSelftest();
else if (shot) paintShot(shot);
else runGame();
