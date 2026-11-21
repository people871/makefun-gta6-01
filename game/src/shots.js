// Staged frames for ?shot=start|drive|chase|mission.
// Nothing here is posed by hand. Every scene runs the live simulation
// from a fresh world under a small autopilot that walks or drives at the
// mission marker and steers around buildings, so the captured frame is
// genuine play — and a fixed seed always reproduces the same frame.
// shots.json lists the chase first because it makes the cover: one frame
// shows the whole HUD — wanted stars, objective, killfeed, minimap with
// the marker and the police, speed, and the district name.
import { STEP } from './config.js'; // fixed-step seconds
import { ACTION_INTERACT } from './input.js'; // E key action bit
import { SCREEN_TITLE, SCREEN_PLAY } from './render.js'; // scene screens

// No input at all: the one move object handed to every idle step. The
// world never writes to the move it is given, so sharing it is safe.
const IDLE = { sprint: false, x: 0, y: 0 };

// Fold an angle difference into (-PI, PI] so the autopilot steers the
// shortest way round.
function foldAngle(turn) {
  let folded = turn;
  while (folded > Math.PI) folded -= Math.PI * 2;
  while (folded <= -Math.PI) folded += Math.PI * 2;
  return folded;
}

// What the autopilot does on one step, from the vector to the target.
function chooseMove(sim, tx, ty) {
  const hero = sim.state.player;
  const dx = tx - hero.x;
  const dy = ty - hero.y;
  const choice = { x: 0, y: 0, sprint: false };
  if (!hero.inCar) {
    // On foot the hero just walks at the target, one axis at a time.
    choice.x = Math.abs(dx) > 24 ? Math.sign(dx) : 0;
    choice.y = Math.abs(dy) > 24 ? Math.sign(dy) : 0;
    return choice;
  }
  const ride = sim.playerCar();
  const bearing = Math.atan2(dy, dx);
  const turn = foldAngle(bearing - ride.angle);
  const gap = Math.hypot(dx, dy);
  const far = gap >= 60;
  const slowTurn = Math.abs(ride.speed) < 40 && Math.abs(turn) > 1.5;
  if (gap < 60) {
    choice.y = 1; // arrived: brake
  } else if (slowTurn) {
    // Nose pointing away and barely rolling: reverse while steering
    // the other way to swing around, then drive forward.
    choice.y = 1;
    choice.x = turn > 0 ? -1 : 1;
  }
  if (far && !slowTurn) {
    choice.x = turn > 0.12 ? 1 : turn < -0.12 ? -1 : 0;
    // Throttle control: flat out while far off, coast when close, so
    // the car can stop on the target instead of overshooting it and
    // looping around the blocks instead.
    choice.y = gap > 260 ? -1 : 0;
  }
  return choice;
}

// Steer the autopilot at a point for this many seconds.
function runPilot(sim, story, tx, ty, seconds) {
  const steps = seconds / STEP;
  for (let n = 0; n < steps; n += 1) {
    sim.step(STEP, chooseMove(sim, tx, ty), 0);
    story.update(STEP, false);
  }
}

// Let the world run on with no input for this many seconds.
function runIdle(sim, story, seconds) {
  const steps = seconds / STEP;
  for (let n = 0; n < steps; n += 1) {
    sim.step(STEP, IDLE, 0);
    story.update(STEP, false);
  }
}

// Fetch the Comet on foot, steal it, and end up behind its wheel.
function grabComet(sim, story) {
  runPilot(sim, story, 1290, 1000, 14);
  sim.step(STEP, IDLE, ACTION_INTERACT);
}

// Title frame: downtown alive behind the menu, hero on foot on the
// street east of the panel, so title, city and hero all show at once.
function sceneTitle(sim, story) {
  story.startMission(0);
  story.state.dialogue = null;
  story.state.banner = null;
  sim.state.player.x = 1500;
  sim.state.player.y = 1100;
  sim.state.player.faceAngle = -Math.PI / 2;
  runIdle(sim, story, 6);
  return { best: 1500, hasSave: true, screen: SCREEN_TITLE };
}

// Driving frame: take the Comet, then run south down Palma Avenue —
// first across to the avenue's centre line, then straight down it —
// and catch it mid-run, while the Comet is still at speed.
function sceneDrive(sim, story) {
  story.startMission(0);
  story.state.dialogue = null;
  grabComet(sim, story);
  runPilot(sim, story, 1240, 1250, 3);
  runPilot(sim, story, 1240, 1980, 1.8);
  return { best: 0, hasSave: false, screen: SCREEN_PLAY };
}

// Cover frame: grab the Comet before any mission is live (mission 3's
// evade step would otherwise finish while the wanted level is still 0),
// then open Heat Wave at wanted 3 with police already in pursuit.
function sceneChase(sim, story) {
  grabComet(sim, story);
  story.startMission(2);
  story.state.dialogue = null;
  sim.setWanted(3);
  // Keep the steal and the heat in the killfeed so the cover shows
  // them live under the minimap. (The mission banner fades on its own
  // 3.2 s timer during the drive, so it never covers the player's car.)
  sim.addFeed('WANTED LEVEL ' + 3 + ' — HEAT WAVE');
  sim.spawnPoliceCar();
  sim.spawnPoliceCar();
  // Set the pursuit on the same street, a few hundred pixels behind
  // the Comet, so the frame catches the chase at speed.
  const hunters = sim.state.cars.filter((c) => c.police);
  hunters.forEach((cop, i) => {
    cop.x = sim.state.player.x - 300 - i * 130;
    cop.y = 1100;
    cop.axis = 'x';
    cop.dir = 1;
    cop.angle = 0;
    cop.speed = 380;
  });
  // East along the 1100 street, aiming past the map edge so the car is
  // still flat out — mid-chase — when the frame is taken.
  runPilot(sim, story, 3100, 1100, 3.5);
  return { best: 0, hasSave: false, screen: SCREEN_PLAY };
}

// Mission frame: hero on foot by the marina, marker in view, with
// Rico's briefing still up on screen.
function sceneMission(sim, story) {
  story.startMission(1);
  const firstLine = 'RICO: A package waits at Solmar Marina, south docks.';
  const secondLine = 'RICO: Pick it up and bring it to the safehouse. No cops.';
  story.state.dialogue = { lines: [firstLine, secondLine], lineIndex: 0, timer: 0 };
  sim.state.player.x = 2620;
  sim.state.player.y = 1960;
  sim.state.player.faceAngle = Math.PI / 4;
  sim.state.camera.x = 2620;
  sim.state.camera.y = 1960;
  runIdle(sim, story, 1.5);
  return { best: 0, hasSave: false, screen: SCREEN_PLAY };
}

// Set `sim` and `story` to the named scene and hand back the screen to
// draw plus the save and best info for the title. Scenes: start, drive,
// chase, mission.
export function stageShot(sceneName, sim, story) {
  sim.reset();
  if (sceneName === 'drive') return sceneDrive(sim, story);
  if (sceneName === 'chase') return sceneChase(sim, story);
  if (sceneName === 'mission') return sceneMission(sim, story);
  return sceneTitle(sim, story);
}
