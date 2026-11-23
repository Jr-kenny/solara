// The city of Solara, built once from a seed: road grid, districts,
// buildings, trees and parked cars. Everything is plain data the renderer
// draws and the world collides with; nothing here knows about screens or
// input.
import { AVENUES, BEACH, DISTRICTS, ROAD, STREETS, WATER, WORLD } from './config.js';

const GRID_X = [0, ...AVENUES, WORLD.width];
const GRID_Y = [0, ...STREETS, WORLD.height];

function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d;
  }
  return DISTRICTS[1];
}

function onRoad(x, y) {
  const half = ROAD.width / 2;
  for (const ax of AVENUES) if (Math.abs(x - ax) < half) return true;
  for (const sy of STREETS) if (Math.abs(y - sy) < half) return true;
  return false;
}

function closeToRoad(x, y, margin) {
  const half = ROAD.width / 2 + margin;
  for (const ax of AVENUES) if (Math.abs(x - ax) < half) return true;
  for (const sy of STREETS) if (Math.abs(y - sy) < half) return true;
  return false;
}

export function isWater(x, y) {
  return x < WATER.west || y > WATER.south;
}

export function isRoad(x, y) {
  return onRoad(x, y);
}

// True when a circle of `radius` at (x, y) sits on drivable or walkable ground.
export function isWalkable(city, x, y, radius) {
  if (x < radius || y < radius || x > WORLD.width - radius || y > WORLD.height - radius) return false;
  if (isWater(x, y)) return false;
  for (const b of city.buildings) {
    const overlapsX = x + radius > b.x && x - radius < b.x + b.w;
    const overlapsY = y + radius > b.y && y - radius < b.y + b.h;
    if (overlapsX && overlapsY) return false;
  }
  return true;
}

function lotCount(style) {
  if (style === 'downtown') return 2;
  if (style === 'houses') return 4;
  return 3;
}

function lotSize(random, style) {
  if (style === 'downtown') return { w: 150 + random() * 130, h: 130 + random() * 120 };
  if (style === 'houses') return { w: 90 + random() * 60, h: 80 + random() * 50 };
  return { w: 170 + random() * 110, h: 110 + random() * 90 };
}

function clashes(buildings, x, y, w, h) {
  for (const b of buildings) {
    const nearX = x < b.x + b.w + 30 && x + w + 30 > b.x;
    const nearY = y < b.y + b.h + 30 && y + h + 30 > b.y;
    if (nearX && nearY) return true;
  }
  return false;
}

function fillBlock(random, bounds, style, out) {
  const { x0, x1, y0, y1 } = bounds;
  const count = lotCount(style);
  for (let lot = 0; lot < count; lot += 1) {
    const size = lotSize(random, style);
    // Buildings sit well inside the block, leaving a clear apron around it
    // that a car can drive through: the roads are the arteries, the apron
    // is the shortcut.
    const x = x0 + 48 + random() * Math.max(1, x1 - x0 - size.w - 96);
    const y = y0 + 48 + random() * Math.max(1, y1 - y0 - size.h - 96);
    if (x + size.w > x1 - 10 || y + size.h > y1 - 10) continue;
    if (clashes(out.buildings, x, y, size.w, size.h)) continue;
    out.buildings.push({
      x, y, w: size.w, h: size.h,
      style,
      tall: style === 'downtown' && random() < 0.6,
      windows: Math.floor(random() * 4),
      roof: random(),
    });
  }
}

function plantTrees(random, bounds, style, out) {
  const count = style === 'houses' ? 5 : 2;
  for (let i = 0; i < count; i += 1) {
    const tx = bounds.x0 + random() * (bounds.x1 - bounds.x0);
    const ty = bounds.y0 + random() * (bounds.y1 - bounds.y0);
    if (closeToRoad(tx, ty, 26) || onRoad(tx, ty)) continue;
    out.trees.push({ x: tx, y: ty, palm: false, r: 10 + random() * 5 });
  }
}

function plantPalms(random, bounds, out) {
  for (let i = 0; i < 5; i += 1) {
    out.trees.push({
      x: bounds.x0 + random() * (bounds.x1 - bounds.x0),
      y: bounds.y0 + random() * (bounds.y1 - bounds.y0),
      palm: true,
      r: 14 + random() * 6,
    });
  }
}

const PARKED_TYPES = ['sedan', 'sedan', 'sport', 'van', 'taxi'];

function parkCar(random, out) {
  if (random() >= 0.7) return;
  const ax = AVENUES[Math.floor(random() * AVENUES.length)];
  const sy = STREETS[Math.floor(random() * STREETS.length)];
  const horizontal = random() < 0.5;
  const side = random() < 0.5 ? -1 : 1;
  const px = horizontal
    ? ax + side * (ROAD.width / 2 - 14)
    : ax + (random() - 0.5) * 60;
  const py = horizontal
    ? sy + (random() - 0.5) * 60
    : sy + side * (ROAD.width / 2 - 14);
  if (isWater(px, py)) return;
  out.parked.push({
    x: px, y: py,
    angle: horizontal ? 0 : Math.PI / 2,
    type: PARKED_TYPES[Math.floor(random() * PARKED_TYPES.length)],
  });
}

function blockBounds(bx, by) {
  // The margin keeps buildings off the road and its sidewalk: half the road
  // width plus a 24-unit apron on every side of the block.
  const margin = ROAD.width / 2 + 24;
  return {
    x0: GRID_X[bx] + margin,
    x1: GRID_X[bx + 1] - margin,
    y0: GRID_Y[by] + margin,
    y1: GRID_Y[by + 1] - margin,
  };
}

export function createCity(random) {
  const out = { buildings: [], trees: [], parked: [] };
  // Blocks are the cells between neighbouring avenues and streets.
  for (let bx = 0; bx < GRID_X.length - 1; bx += 1) {
    for (let by = 0; by < GRID_Y.length - 1; by += 1) {
      const bounds = blockBounds(bx, by);
      if (bounds.x1 - bounds.x0 < 120 || bounds.y1 - bounds.y0 < 120) continue;
      const cx = (bounds.x0 + bounds.x1) / 2;
      const cy = (bounds.y0 + bounds.y1) / 2;
      const district = districtAt(cx, cy);
      if (district.style === 'beach') {
        plantPalms(random, bounds, out);
        continue;
      }
      fillBlock(random, bounds, district.style, out);
      plantTrees(random, bounds, district.style, out);
      parkCar(random, out);
    }
  }
  return out;
}

// The nearest point on a road to (x, y): where cars and police spawn and drive.
export function nearestRoadPoint(x, y) {
  let best = null;
  let bestD = Infinity;
  for (const ax of AVENUES) {
    const d = Math.abs(x - ax);
    if (d < bestD) { bestD = d; best = { x: ax, y }; }
  }
  for (const sy of STREETS) {
    const d = Math.abs(y - sy);
    if (d < bestD) { bestD = d; best = { x, y: sy }; }
  }
  return best;
}

// Pick a road point at least `minDist` from (x, y), for spawning traffic and police.
export function randomRoadPoint(random, x, y, minDist) {
  for (let tries = 0; tries < 20; tries += 1) {
    const ax = AVENUES[Math.floor(random() * AVENUES.length)];
    const sy = STREETS[Math.floor(random() * STREETS.length)];
    const horizontal = random() < 0.5;
    const px = horizontal ? ax : ax + (random() - 0.5) * (ROAD.width - 40);
    const py = horizontal ? sy + (random() - 0.5) * (ROAD.width - 40) : sy;
    if (Math.hypot(px - x, py - y) >= minDist) {
      return { x: px, y: py, angle: horizontal ? 0 : Math.PI / 2 };
    }
  }
  return { x: AVENUES[0], y: STREETS[0], angle: 0 };
}
