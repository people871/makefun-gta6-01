// Solmar Bay rebuilt: streets, crowds, heat, and the getaway, take two.
//
// This module keeps every bit of live simulation for the game. It draws
// nothing, plays no sound, and talks to no server. Each call to tick()
// moves the city forward one fixed slice and hands back a set of bit
// flags describing what happened, which main.js turns into noise and
// pictures. Because the city grows from one seeded stream, the same seed
// always grows the same blocks, the same parked cars, and the same stashes.
import { AIRSTRIP,
  BEACH_Y,
  CAR,
  DISTRICTS,
  KILLFEED,
  MONEY,
  PALETTE,
  PEDS,
  PLAYER,
  POLICE,
  ROADS_X,
  ROADS_Y,
  ROAD_W,
  STASHES,
  TRAFFIC,
  WANTED,
  WORLD,
} from "./config.js";
import { angleDiff,
  angleTo,
  clamp,
  dist2,
  pick,
  range,
  shuffle,
} from "./random.js";

// Bit flags handed back by tick(), and by throwPunch() / enterOrExit()
// through it. main.js tests these bits to decide what to play and say.
export const EVENT_PUNCH = 0x01;
export const EVENT_PICKUP = 0x02;
export const EVENT_CRASH = 0x04;
export const EVENT_STEAL = 0x08;
export const EVENT_WASTED = 0x10;
export const EVENT_BUSTED = 0x20;
export const EVENT_WANTED_UP = 0x40;
export const EVENT_HIT_PLAYER = 0x80;
export const EVENT_STASH = 0x100;

// Paint and body choices the seeded stream draws parked cars and moving
// traffic from. The Comet keeps its own yellow, set where it is spawned.
const PAINT_JOBS = [
  "#d94f3d",
  "#3d7bd9",
  "#e8e8e8",
  "#2f2f33",
  "#7fb069",
  "#c96fb0",
  "#e07b39",
  "#5bc0be",
];
const BODY_STYLES = [
  "sedan",
  "sedan",
  "sedan",
  "taxi",
  "van",
  "truck",
];

// ---- small shapes ---------------------------------------------------------

// True when a disc of the given radius around (cx, cy) touches a rect.
function touchesRect(cx, cy, radius, rect) {
  const nearX = clamp(cx, rect.x, rect.x + rect.w);
  const nearY = clamp(cy, rect.y, rect.y + rect.h);
  return dist2(cx, cy, nearX, nearY) < radius * radius;
}

// Push a disc out of a rect it overlaps, taking the shortest way out, and
// report whether anything moved. A disc whose centre is already inside
// the rect leaves through whichever edge is closest to that centre.
function shoveCircleOut(body, radius, rect) {
  const nearX = clamp(body.x, rect.x, rect.x + rect.w);
  const nearY = clamp(body.y, rect.y, rect.y + rect.h);
  const dx = body.x - nearX;
  const dy = body.y - nearY;
  const sq = dx * dx + dy * dy;
  let moved = false;
  if (sq < radius * radius) {
    moved = true;
    if (sq < 0.0001) {
      const toLeft = body.x - rect.x;
      const toRight = rect.x + rect.w - body.x;
      const toTop = body.y - rect.y;
      const toBottom = rect.y + rect.h - body.y;
      const closestEdge = Math.min(toLeft, toRight, toTop, toBottom);
      if (closestEdge === toLeft) {
        body.x = rect.x - radius;
      } else if (closestEdge === toRight) {
        body.x = rect.x + rect.w + radius;
      } else if (closestEdge === toTop) {
        body.y = rect.y - radius;
      }
else {
        body.y = rect.y + rect.h + radius;
      }
    }
else {
      const len = Math.sqrt(sq);
      body.x = nearX + (dx / len) * radius;
      body.y = nearY + (dy / len) * radius;
    }
  }
  return moved;
}

// Which named part of town a map point sits in, for the HUD and minimap.
export function districtAt(px, py) {
  let found = "SOLMAR BAY";
  for (const zone of DISTRICTS) {
    if (px >= zone.x0 && px < zone.x1 && py >= zone.y0 && py < zone.y1) {
      found = zone.name;
      break;
    }
  }
  return found;
}

export function createWorld(streamFn) {
  // ---- hand-placed ground -------------------------------------------------
  // The park stays green, and the bank, the garage, the safehouse and the
  // marina sit where the story needs them, never left to the seed.
  const parkZone = {
    x: 1800,
    y: 1160,
    w: 380,
    h: 320,
  };
  const bankZone = {
    x: 1700,
    y: 560,
    w: 220,
    h: 140,
  };
  const garageZone = {
    x: 620,
    y: 540,
    w: 160,
    h: 110,
  };
  const hideoutZone = {
    x: 260,
    y: 200,
    w: 130,
    h: 110,
  };
  const marinaZone = {
    x: 2660,
    y: 2020,
    w: 180,
    h: 120,
  };
  const stripZone = {
    x: AIRSTRIP.x,
    y: AIRSTRIP.y,
    w: AIRSTRIP.w,
    h: AIRSTRIP.h,
  };

  const city = growCity(streamFn);

  // Grow the seeded part of town: one or two blocks per street cell, each
  // with lit and dark windows, then the named landmarks, then the palms.
  function growCity(draw) {
    const blocksOut = [];
    const palmsOut = [];
    const edgeXs = [0, ...ROADS_X, WORLD.width];
    const edgeYs = [0, ...ROADS_Y, BEACH_Y];
    for (let gx = 0; gx < edgeXs.length - 1; gx += 1) {
      for (let gy = 0; gy < edgeYs.length - 1; gy += 1) {
        const left = edgeXs[gx] + (gx === 0 ? 40 : 34 + ROAD_W / 2);
        const right = edgeXs[gx + 1] - (gx + 1 === edgeXs.length - 1 ? 40 : 34 + ROAD_W / 2);
        const top = edgeYs[gy] + (gy === 0 ? 40 : 34 + ROAD_W / 2);
        const bottom = edgeYs[gy + 1] - (gy + 1 === edgeYs.length - 1 ? 40 : 34 + ROAD_W / 2);
        if (right - left >= 90 && bottom - top >= 90) {
          const parkOverlap = left < parkZone.x + parkZone.w && right > parkZone.x && top < parkZone.y + parkZone.h && bottom > parkZone.y;
          if (!parkOverlap && top < BEACH_Y - 40) {
            const perBlock = 1 + Math.floor(draw() * 2);
            for (let slot = 0; slot < perBlock; slot += 1) {
              const bw = range(draw, 90, Math.min(200, (right - left) / perBlock));
              const bh = range(draw, 80, Math.min(170, bottom - top));
              const bx = range(draw, left, Math.max(left + 1, right - bw));
              const by = range(draw, top, Math.max(top + 1, bottom - bh));
              const block = {
                x: bx,
                y: by,
                w: bw,
                h: bh,
                color: pick(draw, PALETTE.buildingRoof),
                windows: [],
              };
              const winCols = Math.max(2, Math.floor(bw / 34));
              const winRows = Math.max(2, Math.floor(bh / 30));
              for (let wc = 0; wc < winCols; wc += 1) {
                for (let wr = 0; wr < winRows; wr += 1) {
                  block.windows.push({
                    x: bx + 12 + wc * 34,
                    y: by + 12 + wr * 30,
                    lit: draw() < 0.4,
                  });
                }
              }
              // No random block may crowd a hand-placed landmark.
              let clear = true;
              for (const zone of [bankZone, garageZone, hideoutZone, marinaZone]) {
                const gap = bx + bw < zone.x - 10 || bx > zone.x + zone.w + 10 || by + bh < zone.y - 10 || by > zone.y + zone.h + 10;
                if (!gap) {
                  clear = false;
                }
              }
              if (clear) {
                blocksOut.push(block);
              }
            }
          }
        }
      }
    }
    const named = [
      { zone: bankZone, color: "#d9c9a3", label: "SOLMAR NATIONAL BANK" },
      { zone: garageZone, color: "#7fa8a0", label: "RICO'S GARAGE" },
      { zone: hideoutZone, color: "#c98a7a", label: "SAFEHOUSE" },
      { zone: marinaZone, color: "#8fa3b8", label: "MARINA" },
    ];
    for (const spot of named) {
      blocksOut.push({
        x: spot.zone.x,
        y: spot.zone.y,
        w: spot.zone.w,
        h: spot.zone.h,
        color: spot.color,
        windows: [],
        label: spot.label,
      });
    }
    for (let t = 0; t < 46; t += 1) {
      const tx = range(draw, 60, WORLD.width - 60);
      const ty = range(draw, BEACH_Y + 12, WORLD.height - 60);
      palmsOut.push({ x: tx, y: ty });
    }
    for (let t = 0; t < 10; t += 1) {
      const tx = parkZone.x + range(draw, 20, parkZone.w - 20);
      const ty = parkZone.y + range(draw, 20, parkZone.h - 20);
      palmsOut.push({ x: tx, y: ty });
    }
    return { blocks: blocksOut, trees: palmsOut };
  }

  // ---- entity builders ----------------------------------------------------
  let nextCarNo = 1;
  let nextPedNo = 1;

  function makeCar(px, py, heading, kind, colour, opts = {}) {
    const options = opts;
    const ident = options.id !== undefined && options.id !== null ? options.id : "car" + String(nextCarNo++);
    const parked = options.parked !== undefined && options.parked !== null ? options.parked : false;
    const inTraffic = options.traffic !== undefined && options.traffic !== null ? options.traffic : false;
    const isPolice = options.police !== undefined && options.police !== null ? options.police : false;
    const driver = options.driver !== undefined && options.driver !== null ? options.driver : null;
    const axis = options.axis !== undefined && options.axis !== null ? options.axis : null;
    const road = options.road !== undefined && options.road !== null ? options.road : 0;
    const dir = options.dir !== undefined && options.dir !== null ? options.dir : 1;
    const cruise = options.cruise !== undefined && options.cruise !== null ? options.cruise : 150;
    const made = {
      id: ident,
      x: px,
      y: py,
      angle: heading,
      speed: 0,
      kind: kind,
      color: colour,
      parked: parked,
      traffic: inTraffic,
      police: isPolice,
      driver: driver,
      axis: axis,
      road: road,
      dir: dir,
      cruise: cruise,
      flash: 0, bumpTimer: 0,
    };
    return made;
  }

  function makePed(px, py) {
    const heading = range(streamFn, 0, Math.PI * 2);
    const top = pick(streamFn, PALETTE.pedShirt);
    const fresh = {
      id: "ped" + String(nextPedNo++),
      x: px,
      y: py,
      angle: heading,
      speed: 0,
      shirt: top,
      hp: 100,
      mode: "walk",
      tx: px,
      ty: py,
      wait: 0,
      fleeTimer: 0,
      hitCooldown: 0,
      downTimer: 0,
    };
    return fresh;
  }

  const ray = {
    x: 1180,
    y: 1480,
    angle: 0 - Math.PI / 2,
    faceAngle: 0 - Math.PI / 2,
    hp: PLAYER.maxHealth,
    money: MONEY.start,
    inCar: false,
    carId: null,
    punchTimer: 0,
    punchAnim: 0,
    invuln: 0,
    moving: false,
    speed: 0,
  };

  const rides = [];
  const locals = [];
  const beatCops = [];
  const bits = [];
  const drops = [];
  const ticker = [];

  function pushFeed(line) {
    ticker.push({ text: line, ttl: KILLFEED.ttl });
    while (ticker.length > KILLFEED.max) {
      ticker.shift();
    }
  }

  // Everything live hangs off this one object, which render.js and
  // missions.js both read directly — each key is public, so keep them all.
  const worldState = {
    buildings: city.blocks,
    palms: city.trees,
    park: parkZone,
    bank: bankZone,
    garage: garageZone,
    hideout: hideoutZone,
    marina: marinaZone,
    airstrip: stripZone,
    time: 0,
    player: ray,
    cars: rides,
    peds: locals,
    police: beatCops,
    particles: bits,
    pickups: drops,
    feed: ticker,
    wanted: 0,
    wantedLevel: 0,
    crimeTimer: 0,
    packageCarried: false,
    vaultProgress: 0,
    arrestProgress: 0,
    camera: { x: ray.x, y: ray.y },
    stats: { stashesFound: 0, cashCollected: 0, missionsDone: 0, pedsDown: 0, carsStolen: 0 },
  };

  // ---- fresh start --------------------------------------------------------
  function startFresh() {
    rides.length = 0;
    locals.length = 0;
    beatCops.length = 0;
    bits.length = 0;
    drops.length = 0;
    ticker.length = 0;
    nextCarNo = 1;
    nextPedNo = 1;
    ray.x = 1180;
    ray.y = 1480;
    ray.angle = 0 - Math.PI / 2;
    ray.faceAngle = 0 - Math.PI / 2;
    ray.hp = PLAYER.maxHealth;
    ray.money = MONEY.start;
    ray.inCar = false;
    ray.carId = null;
    ray.punchTimer = 0;
    ray.punchAnim = 0;
    ray.invuln = 0;
    // The hero car for mission 1, waiting on Palma Avenue.
    rides.push(makeCar(1290, 1000, Math.PI / 2, "sport", "#ffd60a", { id: "comet", parked: true }));
    // Parked cars dotted along the avenues, shuffled first so a given
    // seed never parks the same car in the same bay twice.
    const bays = shuffle(streamFn, [
      [300, 700, 0],
      [780, 1180, Math.PI],
      [1300, 700, 0],
      [1800, 1620, Math.PI],
      [2300, 700, 0],
      [2800, 1180, Math.PI],
      [780, 1620, 0],
      [2300, 1620, Math.PI],
      [300, 1620, 0],
      [1800, 700, Math.PI],
      [2800, 1620, 0],
      [1300, 1620, Math.PI],
    ]);
    for (const bay of bays) {
      const kind = pick(streamFn, BODY_STYLES);
      const colour = pick(streamFn, PAINT_JOBS);
      rides.push(makeCar(bay[0], bay[1], bay[2], kind, colour, { parked: true }));
    }
    // Moving traffic, spread across the road grid.
    for (let n = 0; n < TRAFFIC.count; n += 1) {
      const vertical = streamFn() < 0.5;
      const road = pick(streamFn, vertical ? ROADS_X : ROADS_Y);
      const dir = streamFn() < 0.5 ? 1 : -1;
      const lane = (streamFn() < 0.5 ? -1 : 1) * 22;
      const along = range(streamFn, 60, (vertical ? WORLD.height : WORLD.width) - 60);
      const tx = vertical ? road + lane : along;
      const ty = vertical ? along : road + lane;
      const heading = vertical ? (dir > 0 ? Math.PI / 2 : 0 - Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
      const kind = pick(streamFn, BODY_STYLES);
      const colour = pick(streamFn, PAINT_JOBS);
      const cruise = range(streamFn, TRAFFIC.minSpeed, TRAFFIC.maxSpeed);
      rides.push(makeCar(tx, ty, heading, kind, colour, {
        traffic: true,
        axis: vertical ? "y" : "x",
        road: road,
        dir: dir,
        cruise: cruise,
      }));
    }
    // Locals strolling near the avenues.
    for (let n = 0; n < PEDS.count; n += 1) {
      const road = pick(streamFn, ROADS_X);
      const street = pick(streamFn, ROADS_Y);
      const side = streamFn() < 0.5 ? -70 : 70;
      const off = range(streamFn, -160, 160);
      locals.push(makePed(road + side, street + off));
    }
    // Loose cash and medkits scattered on the streets, followed by the
    // ten hidden stashes of dirty cash, $150 apiece for free roam.
    for (let n = 0; n < 12; n += 1) {
      const px = range(streamFn, 120, WORLD.width - 120);
      const py = range(streamFn, 120, BEACH_Y - 60);
      const wob = streamFn() * 6;
      drops.push({ x: px, y: py, kind: "cash", amount: 25, active: true, bob: wob });
    }
    for (let n = 0; n < 4; n += 1) {
      const px = range(streamFn, 120, WORLD.width - 120);
      const py = range(streamFn, 120, BEACH_Y - 60);
      const wob = streamFn() * 6;
      drops.push({ x: px, y: py, kind: "health", amount: 30, active: true, bob: wob });
    }
    for (let n = 0; n < STASHES.count; n += 1) {
      const px = range(streamFn, 120, WORLD.width - 120);
      const py = range(streamFn, 120, BEACH_Y - 60);
      const wob = streamFn() * 6;
      drops.push({ x: px, y: py, kind: "stash", amount: STASHES.amount, active: true, bob: wob });
    }
    worldState.time = 0;
    worldState.wanted = 0;
    worldState.wantedLevel = 0;
    worldState.crimeTimer = 0;
    worldState.packageCarried = false;
    worldState.vaultProgress = 0;
    worldState.arrestProgress = 0;
    worldState.camera.x = ray.x;
    worldState.camera.y = ray.y;
    worldState.stats = { stashesFound: 0, cashCollected: 0, missionsDone: 0, pedsDown: 0, carsStolen: 0 };
  }

  // ---- lookups ------------------------------------------------------------
  function findCar(wantId) {
    let found = null;
    for (const ride of rides) {
      if (ride.id === wantId) {
        found = ride;
        break;
      }
    }
    return found;
  }

  function heroCar() {
    let ride = null;
    if (ray.inCar) {
      ride = findCar(ray.carId);
    }
    return ride;
  }

  function raiseHeat(amount) {
    const before = worldState.wantedLevel;
    worldState.wanted = clamp(worldState.wanted + amount, 0, WANTED.max);
    worldState.wantedLevel = Math.floor(worldState.wanted + 0.001);
    worldState.crimeTimer = 5;
    let rose = false;
    if (worldState.wantedLevel > before) {
      rose = true;
    }
    return rose;
  }

  function setHeat(level) {
    worldState.wanted = level;
    worldState.wantedLevel = level;
    worldState.crimeTimer = 5;
  }

  // ---- small systems ------------------------------------------------------
  function spray(px, py, colour, count, power) {
    for (let n = 0; n < count; n += 1) {
      const a = streamFn() * Math.PI * 2;
      const s = range(streamFn, power * 0.3, power);
      const life = range(streamFn, 0.3, 0.7);
      const size = range(streamFn, 2, 5);
      bits.push({
        x: px,
        y: py,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: life,
        maxLife: 0.7,
        color: colour,
        size: size,
      });
    }
    if (bits.length > 220) {
      bits.splice(0, bits.length - 220);
    }
  }

  function closestCar(px, py, maxDist, includeTraffic) {
    const wantTraffic = includeTraffic === undefined ? true : includeTraffic;
    let answer = null;
    for (let pass = 0; pass < 2 && answer === null; pass += 1) {
      let bestRide = null;
      let bestSq = maxDist * maxDist;
      for (const ride of rides) {
        let skip = false;
        if (ride.police) {
          skip = true;
        }
        if (pass === 0 && !ride.parked) {
          skip = true;
        }
        if (pass === 1 && ride.parked) {
          skip = true;
        }
        if (!wantTraffic && ride.traffic) {
          skip = true;
        }
        if (!skip) {
          const dSq = dist2(px, py, ride.x, ride.y);
          if (dSq < bestSq) {
            bestSq = dSq;
            bestRide = ride;
          }
        }
      }
      if (bestRide !== null) {
        answer = bestRide;
      }
    }
    return answer;
  }

  function pushOutOfBuildings(body, radius) {
    let touched = false;
    for (const block of city.blocks) {
      const clearX = body.x + radius < block.x || body.x - radius > block.x + block.w;
      const clearY = body.y + radius < block.y || body.y - radius > block.y + block.h;
      if (!clearX && !clearY) {
        if (shoveCircleOut(body, radius, block)) {
          touched = true;
        }
      }
    }
    return touched;
  }

  function isOnRoad(px, py) {
    let on = false;
    if (py <= BEACH_Y) {
      for (const rx of ROADS_X) {
        if (Math.abs(px - rx) < ROAD_W / 2) {
          on = true;
        }
      }
      for (const ry of ROADS_Y) {
        if (Math.abs(py - ry) < ROAD_W / 2) {
          on = true;
        }
      }
    }
    return on;
  }

  function pickRoadSpot(px, py, minDist, maxDist) {
    let spot = null;
    for (let attempt = 0; attempt < 12 && spot === null; attempt += 1) {
      const vertical = streamFn() < 0.5;
      const road = pick(streamFn, vertical ? ROADS_X : ROADS_Y);
      const along = clamp((vertical ? py : px) + range(streamFn, 0 - maxDist, maxDist), 80, (vertical ? WORLD.height : WORLD.width) - 80);
      const sx = vertical ? road + (streamFn() < 0.5 ? -22 : 22) : along;
      const sy = vertical ? along : road + (streamFn() < 0.5 ? -22 : 22);
      if (dist2(sx, sy, px, py) > minDist * minDist) {
        spot = { x: sx, y: sy };
      }
    }
    if (spot === null) {
      spot = { x: clamp(px + 500, 80, WORLD.width - 80), y: clamp(py, 80, WORLD.height - 80) };
    }
    return spot;
  }

  function dispatchCruiser() {
    const spot = pickRoadSpot(ray.x, ray.y, 420, 700);
    const heading = angleTo(spot.x, spot.y, ray.x, ray.y);
    const cruiser = makeCar(spot.x, spot.y, heading, "police", PALETTE.policeCar, { police: true, cruise: POLICE.carSpeed });
    // Pursuit cars stick to the road grid, so the axis here is whichever
    // road this cruiser happened to spawn on.
    let onAvenue = false;
    for (const rx of ROADS_X) {
      if (Math.abs(spot.x - rx) < 50) {
        onAvenue = true;
      }
    }
    cruiser.axis = onAvenue ? "y" : "x";
    cruiser.dir = 1;
    rides.push(cruiser);
    return cruiser;
  }

  function dispatchBeatCop() {
    const spot = pickRoadSpot(ray.x, ray.y, 260, 420);
    beatCops.push({ x: spot.x, y: spot.y, angle: 0, hp: 60, punchTimer: 0, arrestTimer: 0 });
  }

  // ---- combat -------------------------------------------------------------
  function throwPunch() {
    let flags = 0;
    if (ray.punchTimer <= 0 && !ray.inCar) {
      ray.punchTimer = PLAYER.punchCooldown;
      ray.punchAnim = 0.22;
      // Step into the punch a little, so it still lands on a moving mark.
      ray.x += Math.cos(ray.faceAngle) * 10;
      ray.y += Math.sin(ray.faceAngle) * 10;
      flags |= EVENT_PUNCH;
      let landed = false;
      const fistX = ray.x + Math.cos(ray.faceAngle) * 26;
      const fistY = ray.y + Math.sin(ray.faceAngle) * 26;
      for (const walker of locals) {
        if (walker.mode !== "down") {
          const reach = Math.sqrt(dist2(fistX, fistY, walker.x, walker.y));
          const bearing = angleTo(ray.x, ray.y, walker.x, walker.y);
          if (reach < PLAYER.punchRange && Math.abs(angleDiff(ray.faceAngle, bearing)) < PLAYER.punchArc) {
            walker.hp -= PLAYER.punchDamage;
            walker.mode = "flee";
            walker.fleeTimer = 3;
            walker.x += Math.cos(ray.faceAngle) * 14;
            walker.y += Math.sin(ray.faceAngle) * 14;
            spray(walker.x, walker.y, "#ffffff", 8, 160);
            landed = true;
            // Heat arrives with the hit itself; the knock-out only adds more.
            if (walker.hp > 0) {
              if (raiseHeat(WANTED.punchHit)) {
                flags |= EVENT_WANTED_UP;
              }
            }
            if (walker.hp <= 0) {
              walker.mode = "down";
              walker.downTimer = 6;
              worldState.stats.pedsDown += 1;
              pushFeed("RAY " + "knocked out a local");
              if (raiseHeat(WANTED.punchPed)) {
                flags |= EVENT_WANTED_UP;
              }
              if (streamFn() < 0.6) {
                drops.push({ x: walker.x, y: walker.y, kind: "cash", amount: 20, active: true, bob: 0 });
              }
            }
          }
        }
      }
      for (const officer of beatCops) {
        const reach = Math.sqrt(dist2(fistX, fistY, officer.x, officer.y));
        const bearing = angleTo(ray.x, ray.y, officer.x, officer.y);
        if (reach < PLAYER.punchRange && Math.abs(angleDiff(ray.faceAngle, bearing)) < PLAYER.punchArc) {
          officer.hp -= PLAYER.punchDamage;
          officer.x += Math.cos(ray.faceAngle) * 16;
          officer.y += Math.sin(ray.faceAngle) * 16;
          spray(officer.x, officer.y, "#ffffff", 8, 160);
          landed = true;
          if (raiseHeat(WANTED.damagePolice)) {
            flags |= EVENT_WANTED_UP;
          }
          if (officer.hp <= 0) {
            officer.hp = Math.max(0, officer.hp);
            officer.down = true;
            pushFeed("RAY dropped a " + "cop");
            spray(officer.x, officer.y, "#2f7bff", 14, 200);
          }
        }
      }
      if (landed) {
        flags |= EVENT_HIT_PLAYER;
      }
    }
    return flags;
  }

  function enterOrExit() {
    let flags = 0;
    if (ray.inCar) {
      // Climb out on the car's left-hand side.
      const ride = heroCar();
      if (ride !== null) {
        ride.parked = true;
        ride.speed = 0;
        ray.x = ride.x + Math.cos(ride.angle + Math.PI / 2) * 44;
        ray.y = ride.y + Math.sin(ride.angle + Math.PI / 2) * 44;
        ray.faceAngle = ride.angle;
        ray.inCar = false;
        ray.carId = null;
      }
    }
else {
      const ride = closestCar(ray.x, ray.y, CAR.enterRange, true);
      if (ride !== null) {
        if (ride.traffic && !ride.parked) {
          // A carjacking: the driver scrambles out and legs it.
          const fleeingDriver = makePed(ride.x + 40, ride.y + 40);
          fleeingDriver.mode = "flee";
          fleeingDriver.fleeTimer = 4;
          locals.push(fleeingDriver);
          ride.driver = null;
          worldState.stats.carsStolen += 1;
          pushFeed("RAY carjacked a " + ride.kind);
          if (raiseHeat(WANTED.stealCar)) {
            flags |= EVENT_WANTED_UP;
          }
          flags |= EVENT_STEAL;
        } else if (ride.parked) {
          // Stealing a parked car counts — the Comet included — and is a
          // crime unless it is the mission's own Comet handover.
          worldState.stats.carsStolen += 1;
          if (ride.id === "comet") {
            pushFeed("RAY stole the yellow " + "Comet");
          }
else {
            pushFeed("RAY stole a parked " + ride.kind);
          }
          if (ride.id !== "comet") {
            if (raiseHeat(WANTED.stealCar)) {
              flags |= EVENT_WANTED_UP;
            }
            flags |= EVENT_STEAL;
          }
        }
        ride.traffic = false;
        ride.parked = false;
        ride.speed = 0;
        ray.inCar = true;
        ray.carId = ride.id;
        ray.angle = ride.angle;
        ray.faceAngle = ride.angle;
      }
    }
    return flags;
  }

  // ---- steppers -----------------------------------------------------------
  function moveTraffic(dt) {
    for (const ride of rides) {
      if (ride.traffic) {
        // Slow down for whoever is ahead on the same road.
        let target = ride.cruise;
        for (const other of rides) {
          if (other !== ride) {
            let ahead = false;
            if (ride.axis === "x") {
              const inLane = other.y > ride.y - 34 && other.y < ride.y + 34;
              const gap = (other.x - ride.x) * ride.dir;
              if (inLane && gap > 0 && gap < 90) {
                ahead = true;
              }
            }
else {
              const inLane = other.x > ride.x - 34 && other.x < ride.x + 34;
              const gap = (other.y - ride.y) * ride.dir;
              if (inLane && gap > 0 && gap < 90) {
                ahead = true;
              }
            }
            if (ahead) {
              target = 0;
            }
          }
        }
        ride.speed += clamp(target - ride.speed, -500 * dt, 320 * dt);
        if (ride.axis === "x") {
          ride.x += ride.dir * ride.speed * dt;
          if (ride.x > WORLD.width - 40) {
            ride.x = 40;
          }
          if (ride.x < 40) {
            ride.x = WORLD.width - 40;
          }
        }
else {
          ride.y += ride.dir * ride.speed * dt;
          if (ride.y > WORLD.height - 40) {
            ride.y = 40;
          }
          if (ride.y < 40) {
            ride.y = WORLD.height - 40;
          }
        }
      }
    }
  }

  function moveWalkers(dt) {
    for (const walker of locals) {
      if (walker.hitCooldown > 0) {
        walker.hitCooldown -= dt;
      }
      if (walker.mode === "down") {
        walker.downTimer -= dt;
        if (walker.downTimer <= 0) {
          // Back on their feet somewhere new, and walking again.
          const road = pick(streamFn, ROADS_X);
          walker.x = road + 70;
          walker.y = range(streamFn, 100, BEACH_Y - 100);
          walker.hp = 100;
          walker.mode = "walk";
        }
      }
else {
        const near = Math.sqrt(dist2(walker.x, walker.y, ray.x, ray.y));
        const driven = heroCar();
        let threat = 0;
        if (ray.inCar && driven !== null) {
          threat = Math.abs(driven.speed);
        }
        // Run from a fast car bearing down, or after being hit.
        if (walker.mode === "flee" || (near < 110 && threat > 200)) {
          walker.mode = "flee";
          walker.fleeTimer = Math.max(walker.fleeTimer, 1.2);
          const away = angleTo(ray.x, ray.y, walker.x, walker.y);
          walker.angle = away;
          walker.x += Math.cos(away) * PEDS.fleeSpeed * dt;
          walker.y += Math.sin(away) * PEDS.fleeSpeed * dt;
          walker.fleeTimer -= dt;
          if (walker.fleeTimer <= 0) {
            walker.mode = "walk";
          }
        } else if (Math.abs(walker.x - walker.tx) < 12 && Math.abs(walker.y - walker.ty) < 12) {
          walker.wait -= dt;
          if (walker.wait <= 0) {
            const road = pick(streamFn, ROADS_X);
            const street = pick(streamFn, ROADS_Y);
            const side = streamFn() < 0.5 ? -70 : 70;
            walker.tx = road + side;
            walker.ty = clamp(street + range(streamFn, -180, 180), 80, BEACH_Y - 80);
            walker.wait = range(streamFn, 0, 3);
          }
        }
else {
          walker.angle = angleTo(walker.x, walker.y, walker.tx, walker.ty);
          walker.x += Math.cos(walker.angle) * PEDS.walkSpeed * dt;
          walker.y += Math.sin(walker.angle) * PEDS.walkSpeed * dt;
        }
        walker.x = clamp(walker.x, 40, WORLD.width - 40);
        walker.y = clamp(walker.y, 40, WORLD.height - 40);
        pushOutOfBuildings(walker, 12);
      }
    }
  }

  function movePolice(dt) {
    // How many police this wanted level should bring out.
    const wantCars = worldState.wantedLevel >= 1 ? Math.min(POLICE.maxCars, worldState.wantedLevel) : 0;
    const wantFoot = worldState.wantedLevel >= 2 ? Math.min(POLICE.maxFoot, worldState.wantedLevel - 1) : 0;
    let cruisersOut = 0;
    let beatOut = 0;
    for (const ride of rides) {
      if (ride.police) {
        cruisersOut += 1;
      }
    }
    for (const officer of beatCops) {
      if (!officer.down) {
        beatOut += 1;
      }
    }
    if (cruisersOut < wantCars && streamFn() < dt * 1.2) {
      dispatchCruiser();
    }
    if (beatOut < wantFoot && streamFn() < dt * 1.0) {
      dispatchBeatCop();
    }
    // Cruiser chases stay on the grid, Manhattan-style: a cruiser drives
    // down its current road toward Ray and only turns at a crossing,
    // so it never cuts across a block and gets wedged on a building.
    for (const ride of rides) {
      if (ride.police) {
        ride.flash += dt;
        const gapX = ray.x - ride.x;
        const gapY = ray.y - ride.y;
        const wantAxis = Math.abs(gapX) > Math.abs(gapY) ? "x" : "y";
        if (!ride.axis) {
          ride.axis = wantAxis;
        }
        if (ride.axis !== wantAxis) {
          let nearCross = false;
          if (ride.axis === "x") {
            for (const ry of ROADS_Y) {
              if (Math.abs(ride.y - ry) < 80) {
                nearCross = true;
              }
            }
          }
else {
            for (const rx of ROADS_X) {
              if (Math.abs(ride.x - rx) < 80) {
                nearCross = true;
              }
            }
          }
          if (nearCross) {
            ride.axis = wantAxis;
          }
        }
        const gap = Math.sqrt(gapX * gapX + gapY * gapY);
        const chaseSpeed = gap > 120 ? POLICE.carSpeed : 160;
        ride.speed += clamp(chaseSpeed - ride.speed, -600 * dt, 420 * dt);
        if (ride.axis === "x") {
          ride.dir = gapX >= 0 ? 1 : -1;
          ride.angle = ride.dir > 0 ? 0 : Math.PI;
          ride.x += ride.dir * ride.speed * dt;
        }
else {
          ride.dir = gapY >= 0 ? 1 : -1;
          ride.angle = ride.dir > 0 ? Math.PI / 2 : 0 - Math.PI / 2;
          ride.y += ride.dir * ride.speed * dt;
        }
        ride.x = clamp(ride.x, 40, WORLD.width - 40);
        ride.y = clamp(ride.y, 40, WORLD.height - 40);
        // Ram Ray's car, or shove Ray over while on foot.
        if (gap < 46) {
          if (ray.inCar) {
            const pc = heroCar();
            if (pc !== null) {
              pc.speed *= 0.92;
            }
            if (streamFn() < dt * 2) {
              spray(ray.x, ray.y, "#ffd60a", 6, 180);
            }
          } else if (ray.invuln <= 0) {
            ray.hp -= 22;
            ray.invuln = 0.8;
            spray(ray.x, ray.y, "#ff4b3e", 10, 200);
          }
        }
      }
    }
    // Beat cops give chase and try to make the arrest.
    let closestCop = Infinity;
    for (const officer of beatCops) {
      if (!officer.down) {
        const gapToCop = Math.sqrt(dist2(officer.x, officer.y, ray.x, ray.y));
        closestCop = Math.min(closestCop, gapToCop);
        officer.angle = angleTo(officer.x, officer.y, ray.x, ray.y);
        if (gapToCop > 26) {
          officer.x += Math.cos(officer.angle) * POLICE.footSpeed * dt;
          officer.y += Math.sin(officer.angle) * POLICE.footSpeed * dt;
        }
        if (officer.punchTimer > 0) {
          officer.punchTimer -= dt;
        }
        if (gapToCop < 30 && !ray.inCar && ray.invuln <= 0 && officer.punchTimer <= 0) {
          ray.hp -= 9;
          ray.invuln = 0.5;
          officer.punchTimer = 0.9;
          spray(ray.x, ray.y, "#ff4b3e", 8, 160);
        }
        pushOutOfBuildings(officer, 12);
      }
    }
    // An arrest builds while a cop stands on Ray long enough.
    if (!ray.inCar && closestCop < POLICE.arrestRange && worldState.wantedLevel > 0) {
      worldState.arrestProgress += dt;
    }
else {
      worldState.arrestProgress = Math.max(0, worldState.arrestProgress - dt * 2);
    }
    // Once the heat is gone, drop police that wandered far away.
    if (worldState.wantedLevel === 0) {
      for (let i = rides.length - 1; i >= 0; i -= 1) {
        if (rides[i].police && dist2(rides[i].x, rides[i].y, ray.x, ray.y) > 900 * 900) {
          rides.splice(i, 1);
        }
      }
      for (let i = beatCops.length - 1; i >= 0; i -= 1) {
        if (!beatCops[i].down && dist2(beatCops[i].x, beatCops[i].y, ray.x, ray.y) > 900 * 900) {
          beatCops.splice(i, 1);
        }
      }
    }
  }

  function moveHero(dt, move, actions) {
    let flags = 0;
    if (ray.punchTimer > 0) {
      ray.punchTimer -= dt;
    }
    if (ray.punchAnim > 0) {
      ray.punchAnim -= dt;
    }
    if (ray.invuln > 0) {
      ray.invuln -= dt;
    }
    if ((actions & 8) !== 0) {
      flags |= throwPunch();
    }
    if ((actions & 4) !== 0) {
      flags |= enterOrExit();
    }

    if (ray.inCar) {
      const ride = heroCar();
      if (ride === null) {
        ray.inCar = false;
        ray.carId = null;
      }
else {
        const pedal = move.y < 0 ? 1 : move.y > 0 ? -1 : 0;
        if (pedal > 0) {
          ride.speed += CAR.accel * dt;
        } else if (pedal < 0) {
          if (ride.speed > 30) {
            ride.speed -= CAR.brake * dt;
          }
else {
            ride.speed -= CAR.reverseAccel * dt;
          }
        }
else {
          ride.speed -= ride.speed * CAR.drag * dt;
          if (Math.abs(ride.speed) < 4) {
            ride.speed = 0;
          }
        }
        ride.speed = clamp(ride.speed, 0 - CAR.maxReverse, CAR.maxSpeed);
        const steerFactor = clamp(Math.abs(ride.speed) / 180, 0, 1) * (ride.speed < 0 ? -1 : 1);
        ride.angle += move.x * CAR.steerRate * steerFactor * dt;
        ride.x += Math.cos(ride.angle) * ride.speed * dt;
        ride.y += Math.sin(ride.angle) * ride.speed * dt;
        ride.x = clamp(ride.x, 40, WORLD.width - 40);
        ride.y = clamp(ride.y, 40, WORLD.height - 40);
        if (pushOutOfBuildings(ride, 26)) {
          if (Math.abs(ride.speed) > 240) {
            flags |= EVENT_CRASH;
            spray(ride.x, ride.y, "#ffd60a", 10, 220);
          }
          ride.speed *= 0.45;
        }
        // Pedestrians caught under the wheels.
        for (const walker of locals) {
          if (walker.mode !== "down" && walker.hitCooldown <= 0) {
            if (Math.abs(ride.speed) > 120 && dist2(ride.x, ride.y, walker.x, walker.y) < 34 * 34) {
              walker.mode = "down";
              walker.downTimer = 6;
              walker.hp = 0;
              walker.hitCooldown = 2;
              worldState.stats.pedsDown += 1;
              pushFeed("RAY ran over a " + "local");
              if (raiseHeat(WANTED.hitPedWithCar)) {
                flags |= EVENT_WANTED_UP;
              }
              spray(walker.x, walker.y, "#ff4b3e", 12, 240);
              flags |= EVENT_CRASH;
              if (streamFn() < 0.6) {
                drops.push({ x: walker.x, y: walker.y, kind: "cash", amount: 20, active: true, bob: 0 });
              }
            }
          }
        }
        // Knocking into other cars: push both cars fully apart, shove the
        // other one aside, and bleed speed once per bump, not per frame.
        if (ride.bumpTimer > 0) {
          ride.bumpTimer -= dt;
        }
        for (const other of rides) {
          if (other !== ride) {
            const dSq = dist2(ride.x, ride.y, other.x, other.y);
            if (dSq < 58 * 58 && dSq > 0.01) {
              const d = Math.sqrt(dSq);
              const shove = 58 - d;
              const ux = (other.x - ride.x) / d;
              const uy = (other.y - ride.y) / d;
              ride.x -= ux * shove * 0.5;
              ride.y -= uy * shove * 0.5;
              other.x += ux * shove * 0.5;
              other.y += uy * shove * 0.5;
              if (ride.bumpTimer <= 0) {
                if (Math.abs(ride.speed) > 200) {
                  flags |= EVENT_CRASH;
                  spray(ride.x, ride.y, "#ffd60a", 6, 180);
                }
                ride.speed *= 0.75;
                ride.bumpTimer = 0.35;
              }
            }
          }
        }
        ray.x = ride.x;
        ray.y = ride.y;
        ray.angle = ride.angle;
        ray.faceAngle = ride.angle;
        ray.speed = Math.abs(ride.speed);
        ray.moving = Math.abs(ride.speed) > 10;
      }
    }
else {
      const pace = move.sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
      let stepX = move.x;
      let stepY = move.y;
      const span = Math.hypot(stepX, stepY);
      if (span > 0) {
        stepX /= span;
        stepY /= span;
        ray.faceAngle = Math.atan2(stepY, stepX);
        ray.moving = true;
        ray.speed = pace;
      }
else {
        ray.moving = false;
        ray.speed = 0;
      }
      ray.x += stepX * pace * dt;
      ray.y += stepY * pace * dt;
      ray.x = clamp(ray.x, 30, WORLD.width - 30);
      ray.y = clamp(ray.y, 30, WORLD.height - 30);
      pushOutOfBuildings(ray, PLAYER.radius);
      // Things Ray can grab while walking.
      for (const pk of drops) {
        if (pk.active) {
          if (dist2(ray.x, ray.y, pk.x, pk.y) < 34 * 34) {
            pk.active = false; // spent
            if (pk.kind === "cash") {
              ray.money += pk.amount;
              worldState.stats.cashCollected += pk.amount;
            } else if (pk.kind === "stash") {
              ray.money += pk.amount;
              worldState.stats.cashCollected += pk.amount;
              worldState.stats.stashesFound += 1;
              pushFeed("RAY found a hidden stash +$" + String(pk.amount));
              flags |= EVENT_STASH;
            }
else {
              ray.hp = Math.min(PLAYER.maxHealth, ray.hp + pk.amount);
            }
            flags |= EVENT_PICKUP;
          }
        }
      }
    }
    return flags;
  }

  // ---- one step -----------------------------------------------------------
  function tick(dt, move, actions) {
    let flags = 0;
    worldState.time += dt;
    if (worldState.crimeTimer > 0) {
      worldState.crimeTimer -= dt;
    }
    // Killfeed lines age out on their own timer.
    for (let i = ticker.length - 1; i >= 0; i -= 1) {
      ticker[i].ttl -= dt;
      if (ticker[i].ttl <= 0) {
        ticker.splice(i, 1);
      }
    }
    // Wanted fades while Ray keeps a low profile.
    if (worldState.wanted > 0 && worldState.crimeTimer <= 0) {
      let copClose = false;
      for (const ride of rides) {
        if (ride.police && dist2(ride.x, ride.y, ray.x, ray.y) < 520 * 520) {
          copClose = true;
        }
      }
      for (const officer of beatCops) {
        if (!officer.down && dist2(officer.x, officer.y, ray.x, ray.y) < 420 * 420) {
          copClose = true;
        }
      }
      const decay = WANTED.decayPerSecond + (copClose ? 0 : WANTED.decayHiddenBonus);
      worldState.wanted = Math.max(0, worldState.wanted - decay * dt);
      worldState.wantedLevel = Math.floor(worldState.wanted + 0.001);
    }
    flags |= moveHero(dt, move, actions);
    moveTraffic(dt);
    moveWalkers(dt);
    movePolice(dt);
    // Sparks drift, slow down, and fade away.
    for (let i = bits.length - 1; i >= 0; i -= 1) {
      const mote = bits[i];
      mote.life -= dt;
      mote.x += mote.vx * dt;
      mote.y += mote.vy * dt;
      mote.vx *= 1 - 2 * dt;
      mote.vy *= 1 - 2 * dt;
      if (mote.life <= 0) {
        bits.splice(i, 1);
      }
    }
    // Getting busted, or going down.
    if (worldState.arrestProgress >= POLICE.arrestTime) {
      worldState.arrestProgress = 0;
      flags |= EVENT_BUSTED;
    }
    if (ray.hp <= 0) {
      ray.hp = 0;
      flags |= EVENT_WASTED;
    }
    // The camera trails Ray, eased toward him.
    const tx = clamp(ray.x, 640, WORLD.width - 640);
    const ty = clamp(ray.y, 360, WORLD.height - 360);
    worldState.camera.x += (tx - worldState.camera.x) * Math.min(1, dt * 5);
    worldState.camera.y += (ty - worldState.camera.y) * Math.min(1, dt * 5);
    return flags;
  }

  // ---- save / load --------------------------------------------------------
  // Pickups belong in the save too: where each one sits and whether it
  // has been collected already. Left out, a reload would re-roll every
  // stash off a fresh seed, so one could pop up under Ray's feet and pay
  // twice — or sit within reach on the title screen and change the saved
  // money before the player has even pressed Enter.
  function packSave() {
    const snap = {
      x: ray.x,
      y: ray.y,
      hp: ray.hp,
      money: ray.money,
      wanted: worldState.wanted,
      missionsDone: worldState.stats.missionsDone,
      time: worldState.time,
      packageCarried: worldState.packageCarried,
      stashesFound: worldState.stats.stashesFound,
      cashCollected: worldState.stats.cashCollected,
      pickups: drops.map((pk) => {
        const item = {
          x: pk.x,
          y: pk.y,
          kind: pk.kind,
          amount: pk.amount,
          active: pk.active,
          bob: pk.bob,
        };
        return item;
      }),
    };
    return snap;
  }

  function unpackSave(save) {
    ray.x = save.x;
    ray.y = save.y;
    ray.hp = save.hp;
    ray.money = save.money;
    worldState.wanted = save.wanted !== undefined && save.wanted !== null ? save.wanted : 0;
    worldState.wantedLevel = Math.floor(worldState.wanted + 0.001);
    worldState.packageCarried = Boolean(save.packageCarried);
    worldState.time = save.time !== undefined && save.time !== null ? save.time : 0;
    worldState.stats.stashesFound = save.stashesFound !== undefined && save.stashesFound !== null ? save.stashesFound : 0;
    worldState.stats.cashCollected = save.cashCollected !== undefined && save.cashCollected !== null ? save.cashCollected : 0;
    const savedDrops = save.pickups;
    if (Array.isArray(savedDrops)) {
      drops.length = 0;
      for (const pk of savedDrops) {
        drops.push({
          x: pk.x,
          y: pk.y,
          kind: pk.kind,
          amount: pk.amount,
          active: Boolean(pk.active),
          bob: pk.bob !== undefined && pk.bob !== null ? pk.bob : 0,
        });
      }
    }
    worldState.camera.x = ray.x;
    worldState.camera.y = ray.y;
  }

  startFresh();
  const api = {
    state: worldState,
    reset: startFresh,
    step: tick,
    carById: findCar,
    playerCar: heroCar,
    nearestCar: closestCar,
    addWanted: raiseHeat,
    setWanted: setHeat,
    serialize: packSave,
    deserialize: unpackSave,
    onRoad: isOnRoad,
    burst: spray,
    spawnPoliceCar: dispatchCruiser,
    addFeed: pushFeed,
    districtAt: districtAt,
  };
  return api;
}
