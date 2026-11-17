// The simulation for SOLMAR HEAT: the city of Solmar Bay, its cars, pedestrians,
// police, wanted level, combat, pickups and particles. No drawing and no browser
// calls here — step() advances one fixed step and returns what happened as bit
// flags, so the caller (main.js) can play sounds and announce without the world
// knowing about screens or audio.
import {
  BEACH_Y, CAR, MONEY, PALETTE, PEDS, PLAYER, POLICE, ROADS_X, ROADS_Y, ROAD_W,
  TRAFFIC, WANTED, WORLD,
} from './config.js';
import { angleDiff, angleTo, clamp, dist2, pick, range } from './random.js';

export const EVENT_PUNCH = 1;
export const EVENT_PICKUP = 2;
export const EVENT_CRASH = 4;
export const EVENT_STEAL = 8;
export const EVENT_WASTED = 16;
export const EVENT_BUSTED = 32;
export const EVENT_WANTED_UP = 64;
export const EVENT_HIT_PLAYER = 128;

const CAR_COLORS = ['#d94f3d', '#3d7bd9', '#e8e8e8', '#2f2f33', '#7fb069', '#c96fb0', '#e07b39', '#5bc0be'];
const CAR_KINDS = ['sedan', 'sedan', 'sedan', 'taxi', 'van', 'truck'];

function overlapsCircleRect(cx, cy, r, rect) {
  const nx = clamp(cx, rect.x, rect.x + rect.w);
  const ny = clamp(cy, rect.y, rect.y + rect.h);
  return dist2(cx, cy, nx, ny) < r * r;
}

function pushCircleOutOfRect(circle, r, rect) {
  const nx = clamp(circle.x, rect.x, rect.x + rect.w);
  const ny = clamp(circle.y, rect.y, rect.y + rect.h);
  const dx = circle.x - nx;
  const dy = circle.y - ny;
  const d2 = dx * dx + dy * dy;
  if (d2 >= r * r) return false;
  if (d2 < 0.0001) {
    // Centre inside the rect: push out through the nearest edge.
    const left = circle.x - rect.x;
    const right = rect.x + rect.w - circle.x;
    const top = circle.y - rect.y;
    const bottom = rect.y + rect.h - circle.y;
    const m = Math.min(left, right, top, bottom);
    if (m === left) circle.x = rect.x - r;
    else if (m === right) circle.x = rect.x + rect.w + r;
    else if (m === top) circle.y = rect.y - r;
    else circle.y = rect.y + rect.h + r;
    return true;
  }
  const d = Math.sqrt(d2);
  circle.x = nx + (dx / d) * r;
  circle.y = ny + (dy / d) * r;
  return true;
}

export function createWorld(random) {
  // ---- city generation (seeded, so every seed builds the same Solmar Bay) ----
  const buildings = [];
  const palms = [];
  const park = { x: 1800, y: 1160, w: 380, h: 320 };
  const bank = { x: 1700, y: 560, w: 220, h: 140 };
  const garage = { x: 620, y: 540, w: 160, h: 110 };
  const hideout = { x: 260, y: 200, w: 130, h: 110 };
  const marina = { x: 2660, y: 2020, w: 180, h: 120 };

  const roadXs = [0, ...ROADS_X, WORLD.width];
  const roadYs = [0, ...ROADS_Y, BEACH_Y];
  for (let bi = 0; bi < roadXs.length - 1; bi += 1) {
    for (let bj = 0; bj < roadYs.length - 1; bj += 1) {
      const x0 = roadXs[bi] + (bi === 0 ? 40 : ROAD_W / 2 + 34);
      const x1 = roadXs[bi + 1] - (bi + 1 === roadXs.length - 1 ? 40 : ROAD_W / 2 + 34);
      const y0 = roadYs[bj] + (bj === 0 ? 40 : ROAD_W / 2 + 34);
      const y1 = roadYs[bj + 1] - (bj + 1 === roadYs.length - 1 ? 40 : ROAD_W / 2 + 34);
      if (x1 - x0 < 90 || y1 - y0 < 90) continue;
      // The park block stays green; the bank, garage, hideout and marina are fixed.
      if (x0 < park.x + park.w && x1 > park.x && y0 < park.y + park.h && y1 > park.y) continue;
      if (y0 >= BEACH_Y - 40) continue;
      const n = 1 + Math.floor(random() * 2);
      for (let k = 0; k < n; k += 1) {
        const w = range(random, 90, Math.min(200, (x1 - x0) / n));
        const h = range(random, 80, Math.min(170, y1 - y0));
        const x = range(random, x0, Math.max(x0 + 1, x1 - w));
        const y = range(random, y0, Math.max(y0 + 1, y1 - h));
        const rect = { x, y, w, h, color: pick(random, PALETTE.buildingRoof), windows: [] };
        const cols = Math.max(2, Math.floor(w / 34));
        const rows = Math.max(2, Math.floor(h / 30));
        for (let c = 0; c < cols; c += 1) {
          for (let r = 0; r < rows; r += 1) {
            rect.windows.push({ x: x + 12 + c * 34, y: y + 12 + r * 30, lit: random() < 0.4 });
          }
        }
        // Keep the fixed landmarks clear of random buildings.
        const clear = [bank, garage, hideout, marina].every((b) => rect.x + rect.w < b.x - 10 || rect.x > b.x + b.w + 10 || rect.y + rect.h < b.y - 10 || rect.y > b.y + b.h + 10);
        if (clear) buildings.push(rect);
      }
    }
  }
  buildings.push({ x: bank.x, y: bank.y, w: bank.w, h: bank.h, color: '#d9c9a3', windows: [], label: 'SOLMAR NATIONAL BANK' });
  buildings.push({ x: garage.x, y: garage.y, w: garage.w, h: garage.h, color: '#7fa8a0', windows: [], label: "RICO'S GARAGE" });
  buildings.push({ x: hideout.x, y: hideout.y, w: hideout.w, h: hideout.h, color: '#c98a7a', windows: [], label: 'SAFEHOUSE' });
  buildings.push({ x: marina.x, y: marina.y, w: marina.w, h: marina.h, color: '#8fa3b8', windows: [], label: 'MARINA' });
  for (let i = 0; i < 46; i += 1) {
    palms.push({ x: range(random, 60, WORLD.width - 60), y: range(random, BEACH_Y + 12, WORLD.height - 60) });
  }
  for (let i = 0; i < 10; i += 1) {
    palms.push({ x: park.x + range(random, 20, park.w - 20), y: park.y + range(random, 20, park.h - 20) });
  }

  // ---- entities ----
  let nextCarId = 1;
  let nextPedId = 1;
  function makeCar(x, y, angle, kind, color, opts = {}) {
    return {
      id: opts.id ?? `car${nextCarId++}`,
      x, y, angle, speed: 0, kind, color,
      parked: opts.parked ?? false,
      traffic: opts.traffic ?? false,
      police: opts.police ?? false,
      driver: opts.driver ?? null,
      axis: opts.axis ?? null,
      road: opts.road ?? 0,
      dir: opts.dir ?? 1,
      cruise: opts.cruise ?? 150,
      flash: 0,
      bumpTimer: 0,
    };
  }
  function makePed(x, y) {
    return {
      id: `ped${nextPedId++}`,
      x, y, angle: range(random, 0, Math.PI * 2), speed: 0,
      shirt: pick(random, PALETTE.pedShirt), hp: 100,
      mode: 'walk', tx: x, ty: y, wait: 0, fleeTimer: 0, hitCooldown: 0, downTimer: 0,
    };
  }

  const player = {
    x: 1180, y: 1480, angle: -Math.PI / 2, faceAngle: -Math.PI / 2,
    hp: PLAYER.maxHealth, money: MONEY.start, inCar: false, carId: null,
    punchTimer: 0, punchAnim: 0, invuln: 0, moving: false, speed: 0,
  };

  const cars = [];
  const peds = [];
  const police = [];
  const particles = [];
  const pickups = [];

  function reset() {
    cars.length = 0;
    peds.length = 0;
    police.length = 0;
    particles.length = 0;
    pickups.length = 0;
    nextCarId = 1;
    nextPedId = 1;
    player.x = 1180;
    player.y = 1480;
    player.angle = -Math.PI / 2;
    player.faceAngle = -Math.PI / 2;
    player.hp = PLAYER.maxHealth;
    player.money = MONEY.start;
    player.inCar = false;
    player.carId = null;
    player.punchTimer = 0;
    player.punchAnim = 0;
    player.invuln = 0;
    // The hero car for mission 1, parked on Palma Avenue.
    cars.push(makeCar(1290, 1000, Math.PI / 2, 'sport', '#ffd60a', { id: 'comet', parked: true }));
    // Parked cars scattered along the avenues.
    const parkedSpots = [
      [300, 700, 0], [780, 1180, Math.PI], [1300, 700, 0], [1800, 1620, Math.PI],
      [2300, 700, 0], [2800, 1180, Math.PI], [780, 1620, 0], [2300, 1620, Math.PI],
      [300, 1620, 0], [1800, 700, Math.PI], [2800, 1620, 0], [1300, 1620, Math.PI],
    ];
    for (const [x, y, a] of parkedSpots) {
      cars.push(makeCar(x, y, a, pick(random, CAR_KINDS), pick(random, CAR_COLORS), { parked: true }));
    }
    // Traffic on the roads.
    for (let i = 0; i < TRAFFIC.count; i += 1) {
      const vertical = random() < 0.5;
      const road = vertical ? pick(random, ROADS_X) : pick(random, ROADS_Y);
      const dir = random() < 0.5 ? 1 : -1;
      const lane = (random() < 0.5 ? -1 : 1) * 22;
      const x = vertical ? road + lane : range(random, 60, WORLD.width - 60);
      const y = vertical ? range(random, 60, WORLD.height - 60) : road + lane;
      const angle = vertical ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
      cars.push(makeCar(x, y, angle, pick(random, CAR_KINDS), pick(random, CAR_COLORS), {
        traffic: true, axis: vertical ? 'y' : 'x', road, dir, cruise: range(random, TRAFFIC.minSpeed, TRAFFIC.maxSpeed),
      }));
    }
    for (let i = 0; i < PEDS.count; i += 1) {
      const road = pick(random, ROADS_X);
      const street = pick(random, ROADS_Y);
      peds.push(makePed(road + (random() < 0.5 ? -70 : 70), street + range(random, -160, 160)));
    }
    for (let i = 0; i < 12; i += 1) {
      pickups.push({ x: range(random, 120, WORLD.width - 120), y: range(random, 120, BEACH_Y - 60), kind: 'cash', amount: 25, active: true, bob: random() * 6 });
    }
    for (let i = 0; i < 4; i += 1) {
      pickups.push({ x: range(random, 120, WORLD.width - 120), y: range(random, 120, BEACH_Y - 60), kind: 'health', amount: 30, active: true, bob: random() * 6 });
    }
    state.time = 0;
    state.wanted = 0;
    state.wantedLevel = 0;
    state.crimeTimer = 0;
    state.packageCarried = false;
    state.vaultProgress = 0;
    state.arrestProgress = 0;
    state.camera.x = player.x;
    state.camera.y = player.y;
    state.stats = { carsStolen: 0, pedsDown: 0, missionsDone: 0, cashCollected: 0 };
  }

  const state = {
    time: 0, player, cars, peds, police, particles, pickups,
    buildings, palms, park, bank, garage, hideout, marina,
    wanted: 0, wantedLevel: 0, crimeTimer: 0,
    packageCarried: false, vaultProgress: 0, arrestProgress: 0,
    camera: { x: player.x, y: player.y },
    stats: { carsStolen: 0, pedsDown: 0, missionsDone: 0, cashCollected: 0 },
  };

  function carById(id) {
    for (const c of cars) if (c.id === id) return c;
    return null;
  }

  function playerCar() {
    return player.inCar ? carById(player.carId) : null;
  }

  function addWanted(amount) {
    const before = state.wantedLevel;
    state.wanted = clamp(state.wanted + amount, 0, WANTED.max);
    state.wantedLevel = Math.floor(state.wanted + 0.001);
    state.crimeTimer = 5;
    return state.wantedLevel > before;
  }

  function setWanted(level) {
    state.wanted = level;
    state.wantedLevel = level;
    state.crimeTimer = 5;
  }

  function burst(x, y, color, n, speed) {
    for (let i = 0; i < n; i += 1) {
      const a = random() * Math.PI * 2;
      const s = range(random, speed * 0.3, speed);
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: range(random, 0.3, 0.7), maxLife: 0.7, color, size: range(random, 2, 5) });
    }
    if (particles.length > 220) particles.splice(0, particles.length - 220);
  }

  function nearestCar(x, y, maxDist, includeTraffic = true) {
    // A parked car is the obvious target: prefer one in range over a
    // passing car, so E next to the Comet steals the Comet, not traffic.
    for (let pass = 0; pass < 2; pass += 1) {
      let best = null;
      let bestD2 = maxDist * maxDist;
      for (const c of cars) {
        if (c.police) continue;
        if (pass === 0 && !c.parked) continue;
        if (pass === 1 && c.parked) continue;
        if (!includeTraffic && c.traffic) continue;
        const d2 = dist2(x, y, c.x, c.y);
        if (d2 < bestD2) {
          bestD2 = d2;
          best = c;
        }
      }
      if (best) return best;
    }
    return null;
  }

  function collideBuildingsCircle(circle, r) {
    let hit = false;
    for (const b of buildings) {
      if (circle.x + r < b.x || circle.x - r > b.x + b.w || circle.y + r < b.y || circle.y - r > b.y + b.h) continue;
      if (pushCircleOutOfRect(circle, r, b)) hit = true;
    }
    return hit;
  }

  function onRoad(x, y) {
    if (y > BEACH_Y) return false;
    for (const rx of ROADS_X) if (Math.abs(x - rx) < ROAD_W / 2) return true;
    for (const ry of ROADS_Y) if (Math.abs(y - ry) < ROAD_W / 2) return true;
    return false;
  }

  function randomRoadPointNear(x, y, minDist, maxDist) {
    for (let tries = 0; tries < 12; tries += 1) {
      const vertical = random() < 0.5;
      const road = vertical ? pick(random, ROADS_X) : pick(random, ROADS_Y);
      const along = clamp((vertical ? y : x) + range(random, -maxDist, maxDist), 80, (vertical ? WORLD.height : WORLD.width) - 80);
      const px = vertical ? road + (random() < 0.5 ? -22 : 22) : along;
      const py = vertical ? along : road + (random() < 0.5 ? -22 : 22);
      if (dist2(px, py, x, y) > minDist * minDist) return { x: px, y: py };
    }
    return { x: clamp(x + 500, 80, WORLD.width - 80), y: clamp(y, 80, WORLD.height - 80) };
  }

  function spawnPoliceCar() {
    const spot = randomRoadPointNear(player.x, player.y, 420, 700);
    const angle = angleTo(spot.x, spot.y, player.x, player.y);
    const car = makeCar(spot.x, spot.y, angle, 'police', PALETTE.policeCar, { police: true, cruise: POLICE.carSpeed });
    // The car chases along roads: its axis is the road it spawned on.
    const onAvenue = ROADS_X.some((rx) => Math.abs(spot.x - rx) < 50);
    car.axis = onAvenue ? 'y' : 'x';
    car.dir = 1;
    cars.push(car);
    return car;
  }

  function spawnFootCop() {
    const spot = randomRoadPointNear(player.x, player.y, 260, 420);
    police.push({ x: spot.x, y: spot.y, angle: 0, hp: 60, punchTimer: 0, arrestTimer: 0 });
  }

  function punch() {
    if (player.punchTimer > 0 || player.inCar) return 0;
    player.punchTimer = PLAYER.punchCooldown;
    player.punchAnim = 0.22;
    // A short lunge toward the punch so it connects with a moving target.
    player.x += Math.cos(player.faceAngle) * 10;
    player.y += Math.sin(player.faceAngle) * 10;
    let events = EVENT_PUNCH;
    let hitAnything = false;
    const px = player.x + Math.cos(player.faceAngle) * 26;
    const py = player.y + Math.sin(player.faceAngle) * 26;
    for (const ped of peds) {
      if (ped.mode === 'down') continue;
      const d = Math.sqrt(dist2(px, py, ped.x, ped.y));
      if (d < PLAYER.punchRange && Math.abs(angleDiff(player.faceAngle, angleTo(player.x, player.y, ped.x, ped.y))) < PLAYER.punchArc) {
        ped.hp -= PLAYER.punchDamage;
        ped.mode = 'flee';
        ped.fleeTimer = 3;
        ped.x += Math.cos(player.faceAngle) * 14;
        ped.y += Math.sin(player.faceAngle) * 14;
        burst(ped.x, ped.y, '#ffffff', 8, 160);
        hitAnything = true;
        if (ped.hp <= 0) {
          ped.mode = 'down';
          ped.downTimer = 6;
          state.stats.pedsDown += 1;
          if (addWanted(WANTED.punchPed)) events |= EVENT_WANTED_UP;
          if (random() < 0.6) pickups.push({ x: ped.x, y: ped.y, kind: 'cash', amount: 20, active: true, bob: 0 });
        }
      }
    }
    for (const cop of police) {
      const d = Math.sqrt(dist2(px, py, cop.x, cop.y));
      if (d < PLAYER.punchRange && Math.abs(angleDiff(player.faceAngle, angleTo(player.x, player.y, cop.x, cop.y))) < PLAYER.punchArc) {
        cop.hp -= PLAYER.punchDamage;
        cop.x += Math.cos(player.faceAngle) * 16;
        cop.y += Math.sin(player.faceAngle) * 16;
        burst(cop.x, cop.y, '#ffffff', 8, 160);
        hitAnything = true;
        if (addWanted(WANTED.damagePolice)) events |= EVENT_WANTED_UP;
        if (cop.hp <= 0) {
          cop.hp = 0;
          cop.down = true;
          burst(cop.x, cop.y, '#2f7bff', 14, 200);
        }
      }
    }
    if (hitAnything) events |= EVENT_HIT_PLAYER;
    return events;
  }

  function interact() {
    if (player.inCar) {
      // Get out of the car.
      const car = playerCar();
      if (car) {
        car.parked = true;
        car.speed = 0;
        player.x = car.x + Math.cos(car.angle + Math.PI / 2) * 44;
        player.y = car.y + Math.sin(car.angle + Math.PI / 2) * 44;
        player.faceAngle = car.angle;
        player.inCar = false;
        player.carId = null;
      }
      return 0;
    }
    const car = nearestCar(player.x, player.y, CAR.enterRange, true);
    if (!car) return 0;
    let events = 0;
    if (car.traffic && !car.parked) {
      // Carjacking: the driver bails out and runs.
      const driver = makePed(car.x + 40, car.y + 40);
      driver.mode = 'flee';
      driver.fleeTimer = 4;
      peds.push(driver);
      car.driver = null;
      state.stats.carsStolen += 1;
      if (addWanted(WANTED.stealCar)) events |= EVENT_WANTED_UP;
      events |= EVENT_STEAL;
    } else if (car.parked) {
      state.stats.carsStolen += car.id === 'comet' ? 0 : 0;
      if (car.id !== 'comet') {
        // Stealing any parked car is still a crime in Solmar Bay.
        if (addWanted(WANTED.stealCar)) events |= EVENT_WANTED_UP;
        events |= EVENT_STEAL;
      }
    }
    car.traffic = false;
    car.parked = false;
    car.speed = 0;
    player.inCar = true;
    player.carId = car.id;
    player.angle = car.angle;
    player.faceAngle = car.angle;
    return events;
  }

  function stepTraffic(dt) {
    for (const car of cars) {
      if (!car.traffic) continue;
      // Slow down for the car ahead on the same road.
      let target = car.cruise;
      for (const other of cars) {
        if (other === car) continue;
        if (other.axis === undefined && !other.traffic && !other.police) {
          // Player-driven or parked car: check ahead along this car's axis.
        }
        const ahead = car.axis === 'x'
          ? (other.y > car.y - 34 && other.y < car.y + 34 && (other.x - car.x) * car.dir > 0 && (other.x - car.x) * car.dir < 90)
          : (other.x > car.x - 34 && other.x < car.x + 34 && (other.y - car.y) * car.dir > 0 && (other.y - car.y) * car.dir < 90);
        if (ahead) target = 0;
      }
      car.speed += clamp(target - car.speed, -500 * dt, 320 * dt);
      if (car.axis === 'x') {
        car.x += car.dir * car.speed * dt;
        if (car.x > WORLD.width - 40) car.x = 40;
        if (car.x < 40) car.x = WORLD.width - 40;
      } else {
        car.y += car.dir * car.speed * dt;
        if (car.y > WORLD.height - 40) car.y = 40;
        if (car.y < 40) car.y = WORLD.height - 40;
      }
    }
  }

  function stepPeds(dt) {
    for (const ped of peds) {
      if (ped.hitCooldown > 0) ped.hitCooldown -= dt;
      if (ped.mode === 'down') {
        ped.downTimer -= dt;
        if (ped.downTimer <= 0) {
          // Get up somewhere else in the city and walk on.
          const road = pick(random, ROADS_X);
          ped.x = road + 70;
          ped.y = range(random, 100, BEACH_Y - 100);
          ped.hp = 100;
          ped.mode = 'walk';
        }
        continue;
      }
      const pd = Math.sqrt(dist2(ped.x, ped.y, player.x, player.y));
      const playerCarObj = playerCar();
      const threat = player.inCar ? (playerCarObj ? Math.abs(playerCarObj.speed) : 0) : 0;
      // Flee from a fast car bearing down, or after being hit (set in punch()).
      if (ped.mode === 'flee' || (pd < 110 && threat > 200)) {
        ped.mode = 'flee';
        ped.fleeTimer = Math.max(ped.fleeTimer, 1.2);
        const away = angleTo(player.x, player.y, ped.x, ped.y);
        ped.angle = away;
        ped.x += Math.cos(away) * PEDS.fleeSpeed * dt;
        ped.y += Math.sin(away) * PEDS.fleeSpeed * dt;
        ped.fleeTimer -= dt;
        if (ped.fleeTimer <= 0) ped.mode = 'walk';
      } else {
        if (Math.abs(ped.x - ped.tx) < 12 && Math.abs(ped.y - ped.ty) < 12) {
          ped.wait -= dt;
          if (ped.wait <= 0) {
            const road = pick(random, ROADS_X);
            const street = pick(random, ROADS_Y);
            ped.tx = road + (random() < 0.5 ? -70 : 70);
            ped.ty = clamp(street + range(random, -180, 180), 80, BEACH_Y - 80);
            ped.wait = range(random, 0, 3);
          }
        } else {
          ped.angle = angleTo(ped.x, ped.y, ped.tx, ped.ty);
          ped.x += Math.cos(ped.angle) * PEDS.walkSpeed * dt;
          ped.y += Math.sin(ped.angle) * PEDS.walkSpeed * dt;
        }
      }
      ped.x = clamp(ped.x, 40, WORLD.width - 40);
      ped.y = clamp(ped.y, 40, WORLD.height - 40);
      collideBuildingsCircle(ped, 12);
    }
  }

  function stepPolice(dt) {
    // How many police the wanted level calls for.
    const wantCars = state.wantedLevel >= 1 ? Math.min(POLICE.maxCars, state.wantedLevel) : 0;
    const wantFoot = state.wantedLevel >= 2 ? Math.min(POLICE.maxFoot, state.wantedLevel - 1) : 0;
    let haveCars = 0;
    let haveFoot = 0;
    for (const c of cars) if (c.police) haveCars += 1;
    for (const c of police) if (!c.down) haveFoot += 1;
    if (haveCars < wantCars && random() < dt * 1.2) spawnPoliceCar();
    if (haveFoot < wantFoot && random() < dt * 1.0) spawnFootCop();
    // Police cars chase along the road grid (Manhattan chase): they drive
    // down their current road toward the player and turn only at an
    // intersection, so they never cut across blocks and wedge on buildings.
    for (const car of cars) {
      if (!car.police) continue;
      car.flash += dt;
      const dx = player.x - car.x;
      const dy = player.y - car.y;
      const wantAxis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      if (!car.axis) car.axis = wantAxis;
      if (car.axis !== wantAxis) {
        const nearCross = car.axis === 'x'
          ? ROADS_Y.some((ry) => Math.abs(car.y - ry) < 80)
          : ROADS_X.some((rx) => Math.abs(car.x - rx) < 80);
        if (nearCross) car.axis = wantAxis;
      }
      const dist = Math.sqrt(dx * dx + dy * dy);
      const wantSpeed = dist > 120 ? POLICE.carSpeed : 160;
      car.speed += clamp(wantSpeed - car.speed, -600 * dt, 420 * dt);
      if (car.axis === 'x') {
        car.dir = dx >= 0 ? 1 : -1;
        car.angle = car.dir > 0 ? 0 : Math.PI;
        car.x += car.dir * car.speed * dt;
      } else {
        car.dir = dy >= 0 ? 1 : -1;
        car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        car.y += car.dir * car.speed * dt;
      }
      car.x = clamp(car.x, 40, WORLD.width - 40);
      car.y = clamp(car.y, 40, WORLD.height - 40);
      // Ram the player's car, or knock the player down on foot.
      if (dist < 46) {
        if (player.inCar) {
          const pc = playerCar();
          if (pc) pc.speed *= 0.92;
          if (random() < dt * 2) burst(player.x, player.y, '#ffd60a', 6, 180);
        } else if (player.invuln <= 0) {
          player.hp -= 22;
          player.invuln = 0.8;
          burst(player.x, player.y, '#ff4b3e', 10, 200);
        }
      }
    }
    // Foot cops chase and arrest.
    let nearestCopDist = Infinity;
    for (const cop of police) {
      if (cop.down) continue;
      const d = Math.sqrt(dist2(cop.x, cop.y, player.x, player.y));
      nearestCopDist = Math.min(nearestCopDist, d);
      cop.angle = angleTo(cop.x, cop.y, player.x, player.y);
      if (d > 26) {
        cop.x += Math.cos(cop.angle) * POLICE.footSpeed * dt;
        cop.y += Math.sin(cop.angle) * POLICE.footSpeed * dt;
      }
      if (cop.punchTimer > 0) cop.punchTimer -= dt;
      if (d < 30 && !player.inCar && player.invuln <= 0 && cop.punchTimer <= 0) {
        player.hp -= 9;
        player.invuln = 0.5;
        cop.punchTimer = 0.9;
        burst(player.x, player.y, '#ff4b3e', 8, 160);
      }
      collideBuildingsCircle(cop, 12);
    }
    // Arrest: a cop standing on the player for long enough busts them.
    if (!player.inCar && nearestCopDist < POLICE.arrestRange && state.wantedLevel > 0) {
      state.arrestProgress += dt;
    } else {
      state.arrestProgress = Math.max(0, state.arrestProgress - dt * 2);
    }
    // Drop police that are far away once the heat is gone.
    if (state.wantedLevel === 0) {
      for (let i = cars.length - 1; i >= 0; i -= 1) {
        if (cars[i].police && dist2(cars[i].x, cars[i].y, player.x, player.y) > 900 * 900) cars.splice(i, 1);
      }
      for (let i = police.length - 1; i >= 0; i -= 1) {
        if (!police[i].down && dist2(police[i].x, police[i].y, player.x, player.y) > 900 * 900) police.splice(i, 1);
      }
    }
  }

  function stepPlayer(dt, move, actions) {
    let events = 0;
    if (player.punchTimer > 0) player.punchTimer -= dt;
    if (player.punchAnim > 0) player.punchAnim -= dt;
    if (player.invuln > 0) player.invuln -= dt;
    if (actions & 8) events |= punch(); // ACTION_PUNCH
    if (actions & 4) events |= interact(); // ACTION_INTERACT

    if (player.inCar) {
      const car = playerCar();
      if (!car) {
        player.inCar = false;
        player.carId = null;
      } else {
        const throttle = move.y < 0 ? 1 : move.y > 0 ? -1 : 0;
        if (throttle > 0) car.speed += CAR.accel * dt;
        else if (throttle < 0) {
          if (car.speed > 30) car.speed -= CAR.brake * dt;
          else car.speed -= CAR.reverseAccel * dt;
        } else {
          car.speed -= car.speed * CAR.drag * dt;
          if (Math.abs(car.speed) < 4) car.speed = 0;
        }
        car.speed = clamp(car.speed, -CAR.maxReverse, CAR.maxSpeed);
        const steer = (move.x !== 0 ? move.x : 0);
        const steerFactor = clamp(Math.abs(car.speed) / 180, 0, 1) * (car.speed < 0 ? -1 : 1);
        car.angle += steer * CAR.steerRate * steerFactor * dt;
        const nx = car.x + Math.cos(car.angle) * car.speed * dt;
        const ny = car.y + Math.sin(car.angle) * car.speed * dt;
        car.x = nx;
        car.y = ny;
        car.x = clamp(car.x, 40, WORLD.width - 40);
        car.y = clamp(car.y, 40, WORLD.height - 40);
        if (collideBuildingsCircle(car, 26)) {
          if (Math.abs(car.speed) > 240) {
            events |= EVENT_CRASH;
            burst(car.x, car.y, '#ffd60a', 10, 220);
          }
          car.speed *= 0.45;
        }
        // Running over pedestrians.
        for (const ped of peds) {
          if (ped.mode === 'down' || ped.hitCooldown > 0) continue;
          if (Math.abs(car.speed) > 120 && dist2(car.x, car.y, ped.x, ped.y) < 34 * 34) {
            ped.mode = 'down';
            ped.downTimer = 6;
            ped.hp = 0;
            ped.hitCooldown = 2;
            state.stats.pedsDown += 1;
            if (addWanted(WANTED.hitPedWithCar)) events |= EVENT_WANTED_UP;
            burst(ped.x, ped.y, '#ff4b3e', 12, 240);
            events |= EVENT_CRASH;
            if (random() < 0.6) pickups.push({ x: ped.x, y: ped.y, kind: 'cash', amount: 20, active: true, bob: 0 });
          }
        }
        // Bump into other cars: separate fully, shove the other car aside,
        // and cut speed once per contact (not every frame while touching).
        if (car.bumpTimer > 0) car.bumpTimer -= dt;
        for (const other of cars) {
          if (other === car) continue;
          const d2 = dist2(car.x, car.y, other.x, other.y);
          if (d2 < 58 * 58 && d2 > 0.01) {
            const d = Math.sqrt(d2);
            const overlap = 58 - d;
            const nx2 = (other.x - car.x) / d;
            const ny2 = (other.y - car.y) / d;
            car.x -= nx2 * overlap * 0.5;
            car.y -= ny2 * overlap * 0.5;
            other.x += nx2 * overlap * 0.5;
            other.y += ny2 * overlap * 0.5;
            if (car.bumpTimer <= 0) {
              if (Math.abs(car.speed) > 200) {
                events |= EVENT_CRASH;
                burst(car.x, car.y, '#ffd60a', 6, 180);
              }
              car.speed *= 0.75;
              car.bumpTimer = 0.35;
            }
          }
        }
        player.x = car.x;
        player.y = car.y;
        player.angle = car.angle;
        player.faceAngle = car.angle;
        player.speed = Math.abs(car.speed);
        player.moving = Math.abs(car.speed) > 10;
      }
    } else {
      const speed = move.sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
      let mx = move.x;
      let my = move.y;
      const len = Math.hypot(mx, my);
      if (len > 0) {
        mx /= len;
        my /= len;
        player.faceAngle = Math.atan2(my, mx);
        player.moving = true;
        player.speed = speed;
      } else {
        player.moving = false;
        player.speed = 0;
      }
      player.x += mx * speed * dt;
      player.y += my * speed * dt;
      player.x = clamp(player.x, 30, WORLD.width - 30);
      player.y = clamp(player.y, 30, WORLD.height - 30);
      if (collideBuildingsCircle(player, PLAYER.radius)) {
        // pushed out already; nothing else needed
      }
      // Pickups on foot.
      for (const pk of pickups) {
        if (!pk.active) continue;
        if (dist2(player.x, player.y, pk.x, pk.y) < 34 * 34) {
          pk.active = false;
          if (pk.kind === 'cash') {
            player.money += pk.amount;
            state.stats.cashCollected += pk.amount;
          } else {
            player.hp = Math.min(PLAYER.maxHealth, player.hp + pk.amount);
          }
          events |= EVENT_PICKUP;
        }
      }
    }
    return events;
  }

  function step(dt, move, actions) {
    let events = 0;
    state.time += dt;
    if (state.crimeTimer > 0) state.crimeTimer -= dt;
    // Wanted decays when the player is laying low.
    if (state.wanted > 0 && state.crimeTimer <= 0) {
      let anyCopNear = false;
      for (const c of cars) if (c.police && dist2(c.x, c.y, player.x, player.y) < 520 * 520) anyCopNear = true;
      for (const c of police) if (!c.down && dist2(c.x, c.y, player.x, player.y) < 420 * 420) anyCopNear = true;
      const decay = WANTED.decayPerSecond + (anyCopNear ? 0 : WANTED.decayHiddenBonus);
      state.wanted = Math.max(0, state.wanted - decay * dt);
      state.wantedLevel = Math.floor(state.wanted + 0.001);
    }
    events |= stepPlayer(dt, move, actions);
    stepTraffic(dt);
    stepPeds(dt);
    stepPolice(dt);
    // Particles.
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const pt = particles[i];
      pt.life -= dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= 1 - 2 * dt;
      pt.vy *= 1 - 2 * dt;
      if (pt.life <= 0) particles.splice(i, 1);
    }
    // Arrest / death.
    if (state.arrestProgress >= POLICE.arrestTime) {
      state.arrestProgress = 0;
      events |= EVENT_BUSTED;
    }
    if (player.hp <= 0) {
      player.hp = 0;
      events |= EVENT_WASTED;
    }
    // Camera follows the player.
    const tx = clamp(player.x, 640, WORLD.width - 640);
    const ty = clamp(player.y, 360, WORLD.height - 360);
    state.camera.x += (tx - state.camera.x) * Math.min(1, dt * 5);
    state.camera.y += (ty - state.camera.y) * Math.min(1, dt * 5);
    return events;
  }

  function serialize() {
    return {
      x: player.x, y: player.y, hp: player.hp, money: player.money,
      wanted: state.wanted, missionsDone: state.stats.missionsDone,
      time: state.time, packageCarried: state.packageCarried,
    };
  }

  function deserialize(save) {
    player.x = save.x;
    player.y = save.y;
    player.hp = save.hp;
    player.money = save.money;
    state.wanted = save.wanted ?? 0;
    state.wantedLevel = Math.floor(state.wanted + 0.001);
    state.packageCarried = !!save.packageCarried;
    state.time = save.time ?? 0;
    state.camera.x = player.x;
    state.camera.y = player.y;
  }

  reset();
  return {
    state, reset, step, carById, playerCar, nearestCar, addWanted, setWanted,
    serialize, deserialize, onRoad, burst, spawnPoliceCar,
  };
}
