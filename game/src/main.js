// Boot and the one loop for SOLMAR HEAT: input every frame, the world advances
// in fixed 1/60 s steps, missions tick alongside it, and the renderer paints.
// Screens: title, play, paused, wasted, busted.
//
// ?seed=N fixes the city. ?shot=start|drive|chase|mission (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot. ?selftest=1 runs the logic checks and
// sets window.__selftest.
import { BEST_KEY, MONEY, SAVE_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_BUSTED, EVENT_CRASH, EVENT_PICKUP, EVENT_PUNCH, EVENT_STEAL, EVENT_WASTED, EVENT_WANTED_UP } from './world.js';
import { createMissions } from './missions.js';
import { createAudio } from './audio.js';
import { ACTION_CONFIRM, ACTION_INTERACT, ACTION_MUTE, ACTION_PAUSE, ACTION_PUNCH, createInput } from './input.js';
import { createRenderer, SCREEN_BUSTED, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const selftest = params.get('selftest') === '1';
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const missions = createMissions(world);
const renderer = createRenderer(canvas);
const audio = createAudio();
// Exposed for headless play-testing (probe the live state from Playwright).
window.__game = { world, missions };

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeSave() {
  try {
    const save = {
      v: 1,
      player: world.serialize(),
      missionIndex: missions.state.index,
      missionStep: missions.state.stepIndex,
      finished: missions.state.finished,
      savedAt: Date.now(),
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}

function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch { /* storage can be off */ }
}

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch { /* storage can be off */ }
}

function applySave(save) {
  world.reset();
  world.deserialize(save.player);
  if (save.finished) {
    missions.state.finished = true;
    missions.state.active = false;
  } else {
    missions.startMission(save.missionIndex ?? 0);
    // Resume mid-mission, not from its first step.
    missions.state.stepIndex = Math.min(save.missionStep ?? 0, (missions.mission()?.steps.length ?? 1) - 1);
    missions.state.dialogue = null;
  }
}

// ---- headless logic self-test (no rendering, no audio) ----
function runSelftest() {
  const checks = [];
  function check(name, ok) {
    checks.push({ name, ok: !!ok });
  }
  const w = createWorld(createRandom(7));
  const m = createMissions(w);
  const p = w.state.player;
  const x0 = p.x;
  w.step(STEP, { x: 1, y: 0, sprint: false }, 0);
  check('walking moves the player', p.x > x0);
  check('city has buildings and roads', w.state.buildings.length > 20);
  check('traffic exists', w.state.cars.some((c) => c.traffic));
  check('pedestrians exist', w.state.peds.length >= 10);
  // Steal the Comet: walk to it and press E.
  p.x = 1290;
  p.y = 1060;
  w.step(STEP, { x: 0, y: 0, sprint: false }, ACTION_INTERACT);
  check('entering the Comet puts the player in a car', p.inCar && p.carId === 'comet');
  m.startMission(0);
  check('mission 1 starts', m.state.active && m.mission().id === 'hot-wheels');
  m.update(STEP, false);
  m.update(STEP, false);
  check('reaching and stealing the Comet advances mission 1', m.state.stepIndex === 2);
  // Driving accelerates the car.
  const car = w.playerCar();
  const speed0 = Math.abs(car.speed);
  for (let i = 0; i < 120; i += 1) w.step(STEP, { x: 0, y: -1, sprint: false }, 0);
  check('driving accelerates', Math.abs(car.speed) > speed0 + 50);
  // Wanted: punching a pedestrian raises it and police arrive.
  w.setWanted(2);
  check('wanted level sets', w.state.wantedLevel === 2);
  for (let i = 0; i < 600; i += 1) w.step(STEP, { x: 0, y: 0, sprint: false }, 0);
  check('police cars chase at wanted 2', w.state.cars.some((c) => c.police));
  check('police on foot chase at wanted 2', w.state.police.length > 0);
  // Wanted decays once the crime timer lapses and no cop is near.
  w.setWanted(1);
  w.state.crimeTimer = 0;
  for (const c of w.state.cars) if (c.police) { c.x = 100; c.y = 100; }
  for (const c of w.state.police) { c.x = 100; c.y = 100; }
  p.x = 3000;
  p.y = 300;
  const w0 = w.state.wanted;
  for (let i = 0; i < 600; i += 1) w.step(STEP, { x: 0, y: 0, sprint: false }, 0);
  check('wanted decays while hidden', w.state.wanted < w0);
  // Save / load round-trips the player.
  const saved = w.serialize();
  saved.money = 4321;
  const w2 = createWorld(createRandom(7));
  w2.deserialize(saved);
  check('save/load round-trips money and position', w2.state.player.money === 4321 && w2.state.player.x === saved.x);
  // Combat: punching a pedestrian next to the player hurts it and raises heat.
  const w3 = createWorld(createRandom(9));
  const ped0 = w3.state.peds[0];
  ped0.hp = 30; // one punch drops it, which is what raises the wanted level
  w3.state.player.x = ped0.x - 30;
  w3.state.player.y = ped0.y;
  w3.state.player.faceAngle = 0;
  const pedHp0 = ped0.hp;
  w3.step(STEP, { x: 0, y: 0, sprint: false }, 8); // ACTION_PUNCH
  check('punching a pedestrian hurts it', ped0.hp < pedHp0, `hp ${pedHp0}→${ped0.hp}`);
  check('punching raises the wanted level', w3.state.wantedLevel >= 1, `wanted=${w3.state.wantedLevel}`);
  // Mission 2: reaching the marina advances it.
  m.startMission(1);
  w.state.player.inCar = false;
  w.state.player.carId = null;
  w.state.player.x = 2740;
  w.state.player.y = 2050;
  m.update(STEP, false);
  check('marina pickup advances mission 2', m.state.stepIndex === 1);
  window.__selftest = { pass: checks.every((c) => c.ok), checks };
}

function runShot(name) {
  const scene = stageShot(name, world, missions);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, missions, { best: scene.best, hasSave: scene.hasSave, muted: false });
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let save = readSave();
  let accumulator = 0;
  let last = performance.now();
  let eHeld = false;
  let gameActions = 0;
  let nPressed = false;
  let sPressed = false;
  let qPressed = false;

  window.addEventListener('keydown', (event) => {
    if (event.code === 'KeyE') eHeld = true;
    if (event.code === 'KeyN' && !event.repeat) nPressed = true;
    if (event.code === 'KeyS' && !event.repeat) sPressed = true;
    if (event.code === 'KeyQ' && !event.repeat) qPressed = true;
  });
  window.addEventListener('keyup', (event) => {
    if (event.code === 'KeyE') eHeld = false;
  });

  function announce(message) {
    status.textContent = message;
  }

  function startNewGame() {
    clearSave();
    world.reset();
    missions.startMission(0);
    screen = SCREEN_PLAY;
    audio.unlock();
    announce('New game. Mission 1: Hot Wheels. Steal the yellow Comet on Palma Avenue.');
  }

  function continueGame() {
    save = readSave();
    if (!save) {
      startNewGame();
      return;
    }
    applySave(save);
    screen = SCREEN_PLAY;
    audio.unlock();
    announce(`Continuing. Mission ${missions.state.index + 1}. ${missions.currentObjective()}`);
  }

  function missionFailed(kind) {
    const p = world.state.player;
    p.money = Math.max(0, p.money - MONEY.hospitalFee);
    if (p.money > best) {
      best = p.money;
      saveBest(best);
    }
    // The current mission restarts from its first step.
    const idx = missions.state.index;
    world.reset();
    world.state.player.money = p.money;
    world.state.player.hp = 100;
    missions.startMission(idx);
    missions.state.dialogue = null;
    writeSave();
  }

  function handleWorldEvents(events) {
    if (events & EVENT_PUNCH) audio.punch();
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_CRASH) audio.crash();
    if (events & EVENT_STEAL) {
      audio.steal();
      announce('Car stolen. The cops noticed.');
    }
    if (events & EVENT_WANTED_UP) announce(`Wanted level ${world.state.wantedLevel}. Lose the police!`);
    if (events & EVENT_WASTED) {
      audio.fail();
      missionFailed('wasted');
      screen = SCREEN_OVER;
      announce('Wasted. Hospital fee $100. The mission restarts.');
    } else if (events & EVENT_BUSTED) {
      audio.busted();
      missionFailed('busted');
      screen = SCREEN_BUSTED;
      announce('Busted. Bail $100. The mission restarts.');
    }
  }

  function handleMissionEvents(events) {
    for (const e of events) {
      if (e.type === 'mission-complete') {
        audio.mission();
        writeSave();
        announce(`Mission complete. +$${e.reward}.`);
      } else if (e.type === 'mission-start') {
        announce(`New mission: ${missions.mission().title}.`);
      } else if (e.type === 'step-done') {
        audio.pickup();
      } else if (e.type === 'story-complete') {
        writeSave();
        announce('Story complete. Solmar Bay is yours.');
      }
    }
  }

  function handleActions(actions) {
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Sound off.' : 'Sound on.');
    }
    if (screen === SCREEN_TITLE) {
      if (nPressed) {
        nPressed = false;
        startNewGame();
        return;
      }
      if (actions & ACTION_CONFIRM) {
        audio.unlock();
        if (readSave()) continueGame();
        else startNewGame();
      }
      return;
    }
    if (screen === SCREEN_OVER || screen === SCREEN_BUSTED) {
      if (actions & ACTION_CONFIRM) {
        screen = SCREEN_PLAY;
        announce('Back on the streets.');
      }
      return;
    }
    if (screen === SCREEN_PAUSED) {
      if (sPressed) {
        sPressed = false;
        const ok = writeSave();
        announce(ok ? 'Game saved.' : 'Save failed — storage is off.');
        return;
      }
      if (qPressed) {
        qPressed = false;
        screen = SCREEN_TITLE;
        save = readSave();
        announce('SOLMAR HEAT. Press Enter to continue or N for a new game.');
        return;
      }
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
      return;
    }
    // SCREEN_PLAY
    if (actions & ACTION_PAUSE) {
      screen = SCREEN_PAUSED;
      announce('Paused. S saves, Q quits to title.');
      return;
    }
    if (actions & ACTION_CONFIRM && missions.state.dialogue) {
      missions.advanceDialogue();
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { x: 0, y: 0, sprint: false }, 0);
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    const move = input.move();
    // Punch / interact from this frame's single action snapshot; consumed once.
    const events = world.step(STEP, move, gameActions);
    gameActions = 0;
    handleWorldEvents(events);
    const mEvents = missions.update(STEP, eHeld);
    handleMissionEvents(mEvents);
    audio.setDriving(world.state.player.inCar ? Math.abs((world.playerCar()?.speed ?? 0) / 560) : 0);
    audio.setSiren(world.state.wantedLevel > 0);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    // Actions are taken once per frame: menus use confirm/pause, the world
    // uses punch/interact from the same snapshot.
    const actions = input.takeActions();
    gameActions = actions & (ACTION_PUNCH | ACTION_INTERACT);
    handleActions(actions);
    while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
      step();
      accumulator -= STEP;
      if (screen !== SCREEN_TITLE && screen !== SCREEN_PLAY) break;
    }
    if (screen !== SCREEN_TITLE && screen !== SCREEN_PLAY) accumulator = 0;
    renderer.draw(world.state, screen, missions, { best, hasSave: !!readSave(), muted: audio.isMuted() });
    // One-shot key flags are consumed here so a press between frames is not lost.
    nPressed = false;
    sPressed = false;
    qPressed = false;
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('SOLMAR HEAT. Press Enter to start.');
  requestAnimationFrame(frame);
}

if (selftest) runSelftest();
else if (shot) runShot(shot);
else runGame();
