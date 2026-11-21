// The screenshot scenes behind ?shot=start|drive|chase|mission.
// Each one drives the real simulation forward from a fresh world with a small
// autopilot (walk/drive toward the mission marker, steer around buildings),
// so the frame is what real play looks like and the same seed always gives
// the same frame. No scene is posed by hand.
// Scene order in shots.json puts the chase first: it is the cover, because
// it shows the full HUD at once — wanted stars, objective, killfeed,
// minimap with the mission marker and police, speed and the district name.
import { STEP } from './config.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

function driveToward(world, missions, tx, ty, seconds) {
  // Autopilot: on foot, walk toward the target; in a car, steer and throttle.
  for (let i = 0; i < seconds / STEP; i += 1) {
    const p = world.state.player;
    const dx = tx - p.x;
    const dy = ty - p.y;
    const move = { x: 0, y: 0, sprint: false };
    if (p.inCar) {
      const car = world.playerCar();
      const want = Math.atan2(dy, dx);
      let diff = want - car.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff <= -Math.PI) diff += Math.PI * 2;
      const d = Math.hypot(dx, dy);
      if (d < 60) {
        move.y = 1; // arrived: brake
      } else if (Math.abs(car.speed) < 40 && Math.abs(diff) > 1.5) {
        // Facing away and barely moving: reverse while steering the
        // other way to swing the nose around, then drive forward.
        move.y = 1;
        move.x = diff > 0 ? -1 : 1;
      } else {
        move.x = diff > 0.12 ? 1 : diff < -0.12 ? -1 : 0;
        // Speed control: full throttle far away, coast when close so the
        // car can actually stop at the target instead of overshooting it
        // and looping through the blocks.
        move.y = d > 260 ? -1 : 0;
      }
    } else {
      move.x = Math.abs(dx) > 24 ? Math.sign(dx) : 0;
      move.y = Math.abs(dy) > 24 ? Math.sign(dy) : 0;
    }
    world.step(STEP, move, 0);
    missions.update(STEP, false);
  }
}

function settle(world, missions, seconds) {
  for (let i = 0; i < seconds / STEP; i += 1) {
    world.step(STEP, { x: 0, y: 0, sprint: false }, 0);
    missions.update(STEP, false);
  }
}

/**
 * Set `world` and `missions` to the named scene and return the screen to draw
 * and the save/best info for the title. Scenes: start, drive, chase, mission.
 */
export function stageShot(name, world, missions) {
  world.reset();
  if (name === 'drive') {
    missions.startMission(0);
    missions.state.dialogue = null;
    // Walk to the Comet, steal it, then drive south down Palma Avenue:
    // first onto the avenue's centre line, then straight down it.
    driveToward(world, missions, 1290, 1000, 14);
    world.step(STEP, { x: 0, y: 0, sprint: false }, 4); // E: steal
    driveToward(world, missions, 1240, 1250, 3);
    // Stop the drive mid-run, while the Comet is still at speed.
    driveToward(world, missions, 1240, 1980, 1.8);
    return { screen: SCREEN_PLAY, best: 0, hasSave: false };
  }
  if (name === 'chase') {
    // Steal the Comet first with no mission active (mission 3's evade step
    // would otherwise complete while the wanted level is still 0), then
    // start Heat Wave at wanted 3 with police already in pursuit.
    driveToward(world, missions, 1290, 1000, 14);
    world.step(STEP, { x: 0, y: 0, sprint: false }, 4); // E: steal the Comet
    missions.startMission(2);
    missions.state.dialogue = null;
    world.setWanted(3);
    // The killfeed keeps the steal and the heat, so the cover frame shows
    // it live under the minimap. (The mission banner fades on its own
    // 3.2 s timer during the drive, so it never covers the player's car.)
    world.addFeed('WANTED LEVEL 3 — HEAT WAVE');
    world.spawnPoliceCar();
    world.spawnPoliceCar();
    // Line the pursuit up on the same street, a few hundred pixels behind
    // the Comet, so the frame shows the chase at speed.
    const pursuit = world.state.cars.filter((c) => c.police);
    pursuit.forEach((pc, i) => {
      pc.x = world.state.player.x - 300 - i * 130;
      pc.y = 1100;
      pc.axis = 'x';
      pc.dir = 1;
      pc.angle = 0;
      pc.speed = 380;
    });
    // East along the 1100 street, target past the map edge so the car is
    // still at full speed — mid-chase — when the frame is taken.
    driveToward(world, missions, 3100, 1100, 3.5);
    return { screen: SCREEN_PLAY, best: 0, hasSave: false };
  }
  if (name === 'mission') {
    missions.startMission(1);
    missions.state.dialogue = { lines: ['RICO: A package waits at Solmar Marina, south docks.', 'RICO: Pick it up and bring it to the safehouse. No cops.'], lineIndex: 0, timer: 0 };
    // Hero on foot near the marina with the marker in view.
    world.state.player.x = 2620;
    world.state.player.y = 1960;
    world.state.player.faceAngle = Math.PI / 4;
    world.state.camera.x = 2620;
    world.state.camera.y = 1960;
    settle(world, missions, 1.5);
    return { screen: SCREEN_PLAY, best: 0, hasSave: false };
  }
  // start: title screen over a living downtown, hero on foot on the street
  // east of the panel so the title, the city and the hero all show.
  missions.startMission(0);
  missions.state.dialogue = null;
  missions.state.banner = null;
  world.state.player.x = 1500;
  world.state.player.y = 1100;
  world.state.player.faceAngle = -Math.PI / 2;
  settle(world, missions, 6);
  return { screen: SCREEN_TITLE, best: 1500, hasSave: true };
}
