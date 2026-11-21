// SOLMAR HEAT: every number the game runs on, gathered in one file.
// A top-down open-world crime game set in the fictional city of Solmar Bay.
// The map is fixed at 3200 by 2400 and the renderer shows a 1280 by 720
// slice of it. The groups below run: the view and the fixed timestep, the
// road grid, the actors' tuning, the economy and the rules, then the
// palette and the typefaces.

// ---- view + fixed step ----
export const VIEW = { width: 640 * 2, height: 360 * 2 };
export const WORLD = { width: 32 * 100, height: 24 * 100 };
export const STEP = 1 / (3 * 20);

// ---- road grid ----
// The road grid: vertical avenues and horizontal streets, 96 wide each.
// The blocks between roads hold buildings, a park, the marina, the beach.
// Avenues start at 240 and repeat every 500; streets start at 220 and
// repeat every 440.
export const ROADS_X = Array.from({ length: 6 }, (_v, i) => 240 + 500 * i);
export const ROADS_Y = Array.from({ length: 5 }, (_v, i) => 220 + 440 * i);
export const ROAD_W = 48 * 2;
export const BEACH_Y = 2000 + 180; // sand and sea south of this line

// Six named districts, so the HUD and minimap can name where Ray stands.
const zone = (name, x0, y0, x1, y1) => ({ name, x0, y0, x1, y1 });
export const DISTRICTS = Object.freeze([zone('OLD TOWN', 0, 0, 1000, 900),
  zone('DOWNTOWN', 1000, 0, 2000, 900),
  zone('HARBOR HEIGHTS', 2000, 0, 3200, 900),
  zone('PALMA AVE', 0, 900, 1600, 1980),
  zone('SOLMAR PARK', 1600, 900, 3200, 1980),
  zone('BEACHFRONT', 0, 1980, 3200, 2400),
]);

// Beachfront airstrip, the escape point of the final mission.
export const AIRSTRIP = { x: 2900 + 60, y: 2100 + 90, w: 220, h: 60 };

// ---- actors ----
export const PLAYER = { walkSpeed: 210, sprintSpeed: 320, radius: 28 / 2, punchRange: 46,
  punchArc: 1.1, punchDamage: 34, punchCooldown: 0.38, maxHealth: 100 };

export const CAR = { length: 64, width: 30, accel: 420, brake: 700, reverseAccel: 260,
  maxSpeed: 560, maxReverse: 180, drag: 55 / 100, steerRate: 26 / 10, enterRange: 84 };

export const TRAFFIC = { minSpeed: 120, maxSpeed: 210, count: 20 };
export const PEDS = { walkSpeed: 46, fleeSpeed: 150, count: 32 };
export const POLICE = { carSpeed: 520, footSpeed: 235, arrestRange: 34, arrestTime: 11 / 5,
  maxCars: 4, maxFoot: 4 };

// ---- economy + rules ----
// Ten hidden stashes of dirty cash tucked around the city for free roam.
export const STASHES = { amount: 3 * 50, count: 5 * 2 };

export const KILLFEED = { ttl: 6, max: 2 * 2 };

export const WANTED = { max: 5, decayPerSecond: 55 / 1000,
  decayHiddenBonus: 9 / 100, // wanted falls slowly unseen, faster while hidden from every cop
  stealCar: 1, punchPed: 1, punchHit: 1 / 2, hitPedWithCar: 1, damagePolice: 1 };

export const MONEY = { hospitalFee: 100, start: 3 * 50 };

export const SAVE_KEY = 'solmar-heat.save.v' + '1';
export const BEST_KEY = 'solmar-heat.' + 'best';

// ---- palette + type ----
export const PALETTE = { backdrop: '#0E1A24', sea: '#1B7FA8', seaDeep: '#0F5D84',
  sand: '#E8CF9A', grass: '#5DA24A', parkPath: '#CBB98A', sidewalk: '#B9B3A4',
  road: '#3A3F46', roadLine: '#E8D44D', curb: '#8F8A7C',
  buildingRoof: ['#C96F4A', '#D9A05B', '#7FA8A0', '#B08968', '#A67C52', '#E0CFA8', '#8FA3B8', '#C98A7A'],
  buildingEdge: '#4A3F35', windowLit: '#FFE9A8', windowDark: '#2C3E50',
  player: '#FF5D5D', playerShirt: '#FF5D5D', playerSkin: '#E8B98A',
  pedShirt: ['#4FC3F7', '#F2C94C', '#9B7EDE', '#7ED491', '#EF8FB0', '#F28C4A'],
  policeCar: '#1C2733', policeLight: '#FF3B30', policeLightBlue: '#2F7BFF', taxi: '#F2C94C',
  hudPanel: 'rgba(10,16,22,0.72)', hudText: '#F5F1E6', hudMuted: '#C9C2AE',
  gold: '#F2C94C', marker: '#FFE14D', danger: '#FF4B3E', health: '#58D68D',
  money: '#7BE382', title: '#FFD166', titleShadow: '#B34700', feed: '#FFD166',
  district: '#C9C2AE', runway: '#5A6068', runwayLine: '#E8D44D', stash: '#7BE382' };

export const FONT = ['system-ui', '-apple-system', '"Segoe UI"', 'sans-serif'].join(', ');
export const FONT_DISPLAY = ['"Trebuchet MS"', '"Segoe UI"', 'system-ui', 'sans-serif'].join(', ');
