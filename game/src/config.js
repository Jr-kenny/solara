// Solara tuning, kept in one module so the world, the city and the renderer
// all read the same numbers. The city is 3840 by 2560 units and the camera
// shows a 1280 by 720 window of it. Roads sit on a fixed grid and the
// districts give each part of the map its own ground and building style.

export const STEP = 1 / 60;
export const WORLD = { width: 3840, height: 2560 };
export const VIEW = { width: 1280, height: 720 };

export const ROAD = { width: 96, lane: 24 };
export const AVENUES = [320, 960, 1600, 2240, 2880, 3520];
export const STREETS = [320, 960, 1600, 2240];

// The sea runs down the west edge (the marina) and along the south edge
// (the beach). BEACH marks where the sand starts.
export const WATER = { west: 240, south: 2400 };
export const BEACH = { west: 320, south: 2320 };

export const PLAYER = {
  radius: 13,
  walkSpeed: 185,
  runSpeed: 260,
  health: 100,
  punchRange: 34,
  punchDamage: 34,
  pistolDamage: 34,
  pistolRange: 420,
  pistolCooldown: 0.28,
};

const SEDAN = { maxSpeed: 400, color: '#7fa8c9', name: 'Solano' };
const SPORT = { maxSpeed: 540, color: '#e8b13c', name: 'Comet GT' };
const TAXI = { maxSpeed: 380, color: '#f2c94c', name: 'Sun Cab' };
const VAN = { maxSpeed: 340, color: '#9aa5b1', name: 'Mover Van' };
const CRUISER = { maxSpeed: 500, color: '#2e4a6b', name: 'SPPD Cruiser' };
const COUPE = { maxSpeed: 480, color: '#c94f5e', name: 'Vespa Coupe' };

export const CAR = {
  length: 66,
  width: 34,
  accel: 420,
  brake: 700,
  reverseMax: 160,
  drag: 0.6,
  steer: 2.6,
  types: { sedan: SEDAN, sport: SPORT, taxi: TAXI, van: VAN, police: CRUISER, coupe: COUPE },
};

export const TRAFFIC = { cars: 14, peds: 26, policeCars: 6, policeFoot: 4 };
// How the heat fades: a level drops after 22 quiet seconds with no police
// within 500 units, or after 8 seconds with every officer further than 950 away.
export const WANTED = { max: 5, decaySeconds: 22, loseDistance: 950, loseSeconds: 8 };
export const SAVE_KEY = 'solara.save.v1';

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

export const PALETTE = {
  backdrop: '#0e1a24',
  sand: '#e8cf9a',
  grass: '#7fae62',
  lawn: '#6b9e57',
  concrete: '#b9b3a4',
  plaza: '#c9c2b2',
  asphalt: '#3a3f46',
  roadEdge: '#2c3036',
  lane: '#e8e0c8',
  sidewalk: '#a9a294',
  water: '#2e7fa8',
  waterDeep: '#1f5f84',
  wave: '#bfe3f0',
  roofDowntown: '#5d6b7a',
  roofDowntown2: '#46525f',
  roofHouse: '#b0715a',
  roofHouse2: '#8a6a52',
  roofIndustrial: '#7a7568',
  roofMarina: '#4f7d8a',
  buildingEdge: '#2c343c',
  window: '#ffd98a',
  windowDark: '#3d4a58',
  tree: '#3f7a44',
  treeDark: '#2f5e33',
  trunk: '#6b4a2f',
  player: '#f2f2f2',
  playerJacket: '#d84f4f',
  pedShirt: ['#e8e0c8', '#7fa8c9', '#c98a4f', '#8ab06a', '#b06a9a', '#4f8a7a'],
  police: '#2e4a6b',
  policeLight: '#e5534b',
  policeLight2: '#4f8ff7',
  cash: '#5ec96a',
  cashDark: '#2f7a38',
  marker: '#ffd23e',
  markerEdge: '#8a6d00',
  danger: '#e5534b',
  hudPanel: 'rgba(12, 20, 28, 0.72)',
  hudText: '#f2f2f2',
  hudMuted: '#aeb8c2',
  star: '#ffd23e',
  starEmpty: '#5a6470',
  health: '#5ec96a',
  healthLow: '#e5534b',
  title: '#ffd23e',
  titleShadow: '#8a3c1e',
  panel: 'rgba(16, 26, 34, 0.92)',
  panelEdge: '#ffd23e',
  objective: '#ffd23e',
};

// District rectangles: name, bounds, ground colour, building style.
export const DISTRICTS = [
  { name: 'Marina', x: 0, y: 0, w: 640, h: 1280, ground: '#c9c2b2', style: 'marina' },
  { name: 'Downtown', x: 640, y: 0, w: 1280, h: 1280, ground: '#b9b3a4', style: 'downtown' },
  { name: 'Uptown', x: 1920, y: 0, w: 1920, h: 1280, ground: '#b9b3a4', style: 'downtown' },
  { name: 'Old Town', x: 640, y: 1280, w: 1280, h: 1040, ground: '#a9a294', style: 'houses' },
  { name: 'Industrial', x: 1920, y: 1280, w: 1920, h: 1040, ground: '#8f8a7c', style: 'industrial' },
  { name: 'Beachfront', x: 0, y: 2320, w: 3840, h: 240, ground: '#e8cf9a', style: 'beach' },
];

// Key places. Every one sits on a road, so the player and the mission cars
// can reach it without crossing buildings or water.
export const PLACES = {
  hospital: { x: 1280, y: 320, name: 'Solara General' },
  marinaDock: { x: 320, y: 1120, name: 'Marina Dock 7' },
  courierCar: { x: 320, y: 800, name: 'Courier Coupe' },
  suburbDrop: { x: 2880, y: 1760, name: 'Palm Court Drop' },
  shop1: { x: 960, y: 1120, name: 'Downtown Deli' },
  shop2: { x: 2240, y: 1440, name: 'Ironworks Cafe' },
  shop3: { x: 960, y: 2080, name: 'Boardwalk Kiosk' },
  getawayVan: { x: 1600, y: 640, name: 'Getaway Van' },
  policeHQ: { x: 2240, y: 480, name: 'SPPD Headquarters' },
};
