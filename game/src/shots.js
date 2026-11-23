// The screenshot scenes behind ?shot=cover|onfoot|driving|mission. Each one
// plays the real rules forward from a fresh world for a fixed number of
// steps, steered by a simple autopilot, so the frame is what a short game
// really looks like and the same seed always gives the same frame. Cover: a
// four-star police chase in the getaway van. On foot: walking downtown among
// pedestrians and traffic with Job 2 running. Driving: a taxi fare in a
// sports car through traffic. Mission: collecting from the first shop of
// Job 2.
import { AVENUES, ROAD, STEP, STREETS } from './config.js';
import { SCREEN_PLAY } from './render.js';

const TAU = Math.PI * 2;

function emptyInput() {
  return {
    up: false, down: false, left: false, right: false, run: false, handbrake: false,
    enter: false, attack: false, shoot: false, startMission: false, startFare: false,
    aimX: 0, aimY: 0,
  };
}

function angleDiff(want, current) {
  let d = want - current;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return d;
}

// The nearest intersection to a point on a road: always on the same road as the point.
function nearestIntersection(x, y) {
  let best = null;
  let bestD = Infinity;
  for (const ax of AVENUES) {
    for (const sy of STREETS) {
      const d = (ax - x) * (ax - x) + (sy - y) * (sy - y);
      if (d < bestD) {
        bestD = d;
        best = { x: ax, y: sy };
      }
    }
  }
  return best;
}

// The intersection where a route starts: the one on the car's own road that
// lies closest to the destination, so the route never opens with a U-turn
// back down the same road.
function startIntersection(from, to) {
  const onAvenue = AVENUES.find((ax) => Math.abs(from.x - ax) < ROAD.width / 2);
  const onStreet = STREETS.find((sy) => Math.abs(from.y - sy) < ROAD.width / 2);
  let best = null;
  let bestD = Infinity;
  const consider = (p) => {
    const d = (p.x - to.x) * (p.x - to.x) + (p.y - to.y) * (p.y - to.y);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  };
  if (onAvenue !== undefined) for (const sy of STREETS) consider({ x: onAvenue, y: sy });
  if (onStreet !== undefined) for (const ax of AVENUES) consider({ x: ax, y: onStreet });
  return best || nearestIntersection(from.x, from.y);
}

function neighboursOf(point) {
  const ai = AVENUES.indexOf(point.x);
  const si = STREETS.indexOf(point.y);
  const out = [];
  if (ai > 0) out.push({ x: AVENUES[ai - 1], y: point.y });
  if (ai < AVENUES.length - 1) out.push({ x: AVENUES[ai + 1], y: point.y });
  if (si > 0) out.push({ x: point.x, y: STREETS[si - 1] });
  if (si < STREETS.length - 1) out.push({ x: point.x, y: STREETS[si + 1] });
  return out;
}

function traceBack(prev, key, start, end) {
  const path = [];
  let cur = end;
  while (cur && !(cur.x === start.x && cur.y === start.y)) {
    path.unshift(cur);
    cur = prev.get(key(cur));
  }
  path.unshift(start);
  return path;
}

// Waypoints along the road grid from `from` to `to`: the nearest
// intersection, then a breadth-first route across intersections, then the
// destination itself. A car following these in order stays on roads the
// whole way.
export function routeWaypoints(from, to) {
  const start = startIntersection(from, to);
  const end = nearestIntersection(to.x, to.y);
  const key = (p) => `${p.x},${p.y}`;
  const prev = new Map();
  const seen = new Set([key(start)]);
  const queue = [start];
  while (queue.length > 0) {
    const cur = queue.shift();
    if (cur.x === end.x && cur.y === end.y) break;
    for (const n of neighboursOf(cur)) {
      if (seen.has(key(n))) continue;
      seen.add(key(n));
      prev.set(key(n), cur);
      queue.push(n);
    }
  }
  const path = traceBack(prev, key, start, end);
  path.push({ x: to.x, y: to.y });
  return path;
}

// Drive along a route: throttle on, steer toward the current waypoint,
// advance on arrival. Through a sharp turn the driver coasts, so the car
// slows into the corner instead of swinging wide off the road.
function driveRoute(state, waypoints, leg) {
  const p = state.player;
  const input = emptyInput();
  let target = waypoints[leg.current];
  if (Math.hypot(target.x - p.x, target.y - p.y) < 90 && leg.current < waypoints.length - 1) {
    leg.current += 1;
    target = waypoints[leg.current];
  }
  const want = Math.atan2(target.y - p.y, target.x - p.x);
  const d = angleDiff(want, p.angle);
  input.up = Math.abs(d) < 0.9;
  if (d > 0.12) input.right = true;
  else if (d < -0.12) input.left = true;
  return input;
}

// Walk toward a point on foot.
function walkToward(state, target) {
  const p = state.player;
  const input = emptyInput();
  const want = Math.atan2(target.y - p.y, target.x - p.x);
  const dx = Math.cos(want);
  const dy = Math.sin(want);
  if (dy < -0.3) input.up = true;
  if (dy > 0.3) input.down = true;
  if (dx < -0.3) input.left = true;
  if (dx > 0.3) input.right = true;
  return input;
}

function runFor(world, seconds, drive) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) world.step(STEP, drive(world.state, i));
}

function enterNearestCar(world) {
  const enter = emptyInput();
  enter.enter = true;
  world.step(STEP, enter);
}

function sceneResult(world) {
  const s = world.state;
  return { screen: SCREEN_PLAY, best: 0, objective: world.objective(), toast: s.mission.toast };
}

function stageCover(world) {
  const s = world.state;
  s.mission.index = 3;
  world.startStoryMission();
  // The van is on avenue 1600 at y 640; stand beside it, get in, then run for the marina.
  s.player.x = 1600;
  s.player.y = 700;
  enterNearestCar(world);
  const waypoints = routeWaypoints({ x: 1600, y: 640 }, { x: 320, y: 1120 });
  const leg = { current: 0 };
  // Five seconds puts the van mid-route, deep in the chase, before it reaches the dock.
  runFor(world, 5, (state) => driveRoute(state, waypoints, leg));
  return sceneResult(world);
}

function stageOnFoot(world) {
  const s = world.state;
  s.mission.index = 1;
  world.startStoryMission();
  s.player.x = 1280;
  s.player.y = 320;
  const waypoints = [
    { x: 1600, y: 320 }, { x: 1600, y: 960 }, { x: 1280, y: 960 }, { x: 1280, y: 320 },
  ];
  let leg = 0;
  runFor(world, 12, (state) => {
    const target = waypoints[leg];
    if (Math.hypot(target.x - state.player.x, target.y - state.player.y) < 60) {
      leg = (leg + 1) % waypoints.length;
    }
    return walkToward(state, waypoints[leg]);
  });
  return sceneResult(world);
}

function stageDriving(world) {
  const s = world.state;
  world.startFare();
  const fare = s.mission.active.def;
  let waypoints = routeWaypoints({ x: 1320, y: 320 }, fare.pickup);
  // Spawn the car already facing the first waypoint, so it never opens with a U-turn.
  const face = Math.atan2(waypoints[0].y - 320, waypoints[0].x - 1320);
  const car = world.spawnCar(1320, 320, face, 'sport', 'parked');
  s.player.x = 1320;
  s.player.y = 380;
  enterNearestCar(world);
  if (s.player.car !== car) {
    s.player.y = 360;
    enterNearestCar(world);
  }
  const leg = { current: 0 };
  let switched = false;
  // Seven seconds puts the car mid-fare, in traffic, before the drop-off is reached.
  runFor(world, 7, (state) => {
    const a = state.mission.active;
    if (a && a.stage === 'deliver' && !switched) {
      // The fare is aboard: re-route from here to the drop-off, once.
      waypoints = routeWaypoints({ x: state.player.x, y: state.player.y }, fare.deliver);
      leg.current = 0;
      switched = true;
    }
    return driveRoute(state, waypoints, leg);
  });
  return sceneResult(world);
}

function stageMission(world) {
  const s = world.state;
  s.mission.index = 1;
  world.startStoryMission();
  // Walk into the Downtown Deli's radius to collect the first shop.
  s.player.x = 960;
  s.player.y = 1220;
  const shop = { x: 960, y: 1120 };
  runFor(world, 6, (state) => walkToward(state, shop));
  return sceneResult(world);
}

const STAGES = {
  cover: stageCover,
  onfoot: stageOnFoot,
  driving: stageDriving,
  mission: stageMission,
};
// An unknown ?shot= name falls back to the cover chase, never to a blank frame.

// Set `world` to the named scene (cover, onfoot, driving or mission; any
// other name is cover) and return the screen to draw over it and the HUD
// text to show.
export function stageShot(name, world) {
  world.reset();
  const stage = STAGES[name] || stageCover;
  return stage(world);
}
