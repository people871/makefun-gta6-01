// SOLMAR HEAT — tuning, palette and city layout in one place.
// A top-down open-world crime game in the fictional city of Solmar Bay.
// The world is a fixed 3200x2400 map; the renderer shows a 1280x720 window of it.
export const VIEW = { width: 1280, height: 720 };

export const WORLD = { width: 3200, height: 2400 };

// Roads run on a grid: vertical avenues and horizontal streets, each 96 wide.
// Blocks between them hold buildings, a park, the marina and the beach.
export const ROADS_X = [240, 740, 1240, 1740, 2240, 2740];
export const ROADS_Y = [220, 660, 1100, 1540, 1980];
export const ROAD_W = 96;
export const BEACH_Y = 2180; // sand and sea south of this line

export const STEP = 1 / 60;

export const PLAYER = {
  radius: 14,
  walkSpeed: 210,
  sprintSpeed: 320,
  punchRange: 46,
  punchArc: 1.1,
  punchDamage: 34,
  punchCooldown: 0.38,
  maxHealth: 100,
};

export const CAR = {
  length: 64,
  width: 30,
  accel: 420,
  brake: 700,
  reverseAccel: 260,
  maxSpeed: 560,
  maxReverse: 180,
  drag: 0.55,
  steerRate: 2.6,
  enterRange: 84,
};

export const TRAFFIC = { count: 16, minSpeed: 120, maxSpeed: 210 };
export const PEDS = { count: 26, walkSpeed: 46, fleeSpeed: 150 };
export const POLICE = { maxCars: 4, maxFoot: 4, carSpeed: 520, footSpeed: 235, arrestRange: 34, arrestTime: 2.2 };

export const WANTED = {
  max: 5,
  decayPerSecond: 0.055, // wanted falls slowly while no police can see the player
  decayHiddenBonus: 0.09, // and faster while the player is out of every cop's sight
  stealCar: 1,
  punchPed: 1,
  hitPedWithCar: 1,
  damagePolice: 1,
};

export const MONEY = { start: 150, hospitalFee: 100 };

export const SAVE_KEY = 'solmar-heat.save.v1';
export const BEST_KEY = 'solmar-heat.best';

export const PALETTE = {
  backdrop: '#0e1a24',
  sea: '#1b7fa8',
  seaDeep: '#0f5d84',
  sand: '#e8cf9a',
  grass: '#5da24a',
  parkPath: '#cbb98a',
  sidewalk: '#b9b3a4',
  road: '#3a3f46',
  roadLine: '#e8d44d',
  curb: '#8f8a7c',
  buildingRoof: ['#c96f4a', '#d9a05b', '#7fa8a0', '#b08968', '#a67c52', '#e0cfa8', '#8fa3b8', '#c98a7a'],
  buildingEdge: '#4a3f35',
  windowLit: '#ffe9a8',
  windowDark: '#2c3e50',
  player: '#ff5d5d',
  playerShirt: '#ff5d5d',
  playerSkin: '#e8b98a',
  pedShirt: ['#4fc3f7', '#f2c94c', '#9b7ede', '#7ed491', '#ef8fb0', '#f28c4a'],
  policeCar: '#1c2733',
  policeLight: '#ff3b30',
  policeLightBlue: '#2f7bff',
  taxi: '#f2c94c',
  hudPanel: 'rgba(10, 16, 22, 0.72)',
  hudText: '#f5f1e6',
  hudMuted: '#c9c2ae',
  gold: '#f2c94c',
  marker: '#ffe14d',
  danger: '#ff4b3e',
  health: '#58d68d',
  money: '#7be382',
  title: '#ffd166',
  titleShadow: '#b34700',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
export const FONT_DISPLAY = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';
