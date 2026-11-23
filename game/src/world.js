// The simulation of Solara: the player on foot or in a car, traffic,
// pedestrians, police, the wanted level, combat, cash, particles and the
// mission rules. No drawing and no browser in it: step() advances one fixed
// step and returns what happened as bit flags, so the caller can react
// without the world knowing about screens or sound.
import { AVENUES, CAR, PLAYER, PLACES, TRAFFIC, WANTED, WORLD } from './config.js';
import { createCity, isWalkable, randomRoadPoint } from './city.js';
import { MISSIONS, currentObjective, makeFare, startMission } from './missions.js';

export const EVENT_BUSTED = 1;
export const EVENT_WASTED = 2;
export const EVENT_MISSION = 4;
export const EVENT_FAIL = 8;
export const EVENT_CASH = 16;
export const EVENT_SHOT = 32;

const TAU = Math.PI * 2;
const SHIRT_COLORS = ['#e8e0c8', '#7fa8c9', '#c98a4f', '#8ab06a', '#b06a9a', '#4f8a7a'];

function clamp(v, lo, hi) {
  if (v < lo) return lo;
  if (v > hi) return hi;
  return v;
}

function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

function shortestTurn(angle, target, maxStep) {
  let d = target - angle;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return angle + clamp(d, -maxStep, maxStep);
}

function pick(list, random) {
  return list[Math.floor(random() * list.length)];
}

function buildCar(x, y, angle, type, driver) {
  const spec = CAR.types[type];
  return {
    x, y, angle,
    speed: 0,
    type,
    color: spec.color,
    name: spec.name,
    maxSpeed: spec.maxSpeed,
    driver,
    hp: driver === 'mission' ? 200 : 100,
    target: null,
    stuck: 0,
    ramTimer: 0,
    siren: driver === 'police',
    brakeLight: false,
  };
}

function buildPed(x, y, color) {
  return {
    x, y,
    angle: Math.random() * TAU,
    speed: 0,
    color,
    state: 'walk',
    target: null,
    down: 0,
    flee: 0,
    fare: false,
  };
}

function freshPlayer() {
  return {
    x: 1280, y: 320, angle: -Math.PI / 2,
    health: PLAYER.health,
    onFoot: true, car: null,
    weapon: null, ammo: 0, cooldown: 0,
    invulnerable: 0, regenDelay: 0, speed: 0,
  };
}

export function createWorld(random) {
  const city = createCity(random);
  const state = {
    time: 0,
    seed: 0,
    player: freshPlayer(),
    cars: [],
    peds: [],
    officers: [],
    bullets: [],
    particles: [],
    pickups: [],
    wanted: { level: 0, cleanTimer: 0, loseTimer: 0 },
    money: 50,
    mission: { index: 0, active: null, toast: '', toastTimer: 0, storyDone: false },
    camera: { x: 1280, y: 320 },
    fare: null,
  };

  // Move a circle through the city, sliding along buildings. True if it moved.
  function slide(e, dx, dy, radius) {
    let moved = false;
    if (dx !== 0 && isWalkable(city, e.x + dx, e.y, radius)) {
      e.x += dx;
      moved = true;
    }
    if (dy !== 0 && isWalkable(city, e.x, e.y + dy, radius)) {
      e.y += dy;
      moved = true;
    }
    return moved;
  }

  function burst(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const a = random() * TAU;
      const s = speed * (0.4 + random() * 0.6);
      state.particles.push({
        x, y,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: 0.5 + random() * 0.4, max: 0.9,
        color, size: 2 + random() * 3,
      });
    }
  }

  function dropCash(x, y, amount) {
    state.pickups.push({ x, y, amount, kind: 'cash', life: 25 });
  }

  function raiseWanted(n) {
    state.wanted.level = clamp(state.wanted.level + n, 0, WANTED.max);
    state.wanted.cleanTimer = 0;
  }

  function populateTraffic() {
    const types = ['sedan', 'sedan', 'sedan', 'sport', 'taxi', 'van'];
    for (let i = 0; i < TRAFFIC.cars; i += 1) {
      const p = randomRoadPoint(random, state.player.x, state.player.y, 500);
      const car = buildCar(p.x, p.y, p.angle, pick(types, random), 'traffic');
      car.target = randomRoadPoint(random, p.x, p.y, 300);
      state.cars.push(car);
    }
    for (const parked of city.parked) {
      state.cars.push(buildCar(parked.x, parked.y, parked.angle, parked.type, 'parked'));
    }
  }

  function populatePeds() {
    for (let i = 0; i < TRAFFIC.peds; i += 1) {
      const x = 300 + random() * (WORLD.width - 600);
      const y = 300 + random() * (WORLD.height - 600);
      if (!isWalkable(city, x, y, 12)) continue;
      state.peds.push(buildPed(x, y, pick(SHIRT_COLORS, random)));
    }
  }

  function reset() {
    state.time = 0;
    state.player = freshPlayer();
    state.cars.length = 0;
    state.peds.length = 0;
    state.officers.length = 0;
    state.bullets.length = 0;
    state.particles.length = 0;
    state.pickups.length = 0;
    state.wanted.level = 0;
    state.wanted.cleanTimer = 0;
    state.wanted.loseTimer = 0;
    state.money = 50;
    state.mission.index = 0;
    state.mission.active = null;
    state.mission.toast = '';
    state.mission.toastTimer = 0;
    state.mission.storyDone = false;
    state.fare = null;
    populateTraffic();
    populatePeds();
  }

  function hurtPlayer(amount) {
    const p = state.player;
    if (p.invulnerable > 0) return;
    p.health -= amount;
    p.regenDelay = 5;
    p.invulnerable = 0.4;
    burst(p.x, p.y, '#e5534b', 8, 120);
  }

  function getIn(car) {
    const p = state.player;
    if (car.driver === 'traffic') {
      // The driver bails out as a pedestrian.
      state.peds.push(buildPed(car.x + 40, car.y + 40, '#e8e0c8'));
      raiseWanted(1);
    } else if (car.driver === 'parked') {
      raiseWanted(1);
    } else if (car.driver === 'police') {
      raiseWanted(2);
    }
    car.driver = 'player';
    p.car = car;
    p.onFoot = false;
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
  }

  function getOut() {
    const p = state.player;
    const car = p.car;
    if (!car) return;
    car.driver = 'parked';
    car.speed = 0;
    p.car = null;
    p.onFoot = true;
    const sideX = car.x - Math.sin(car.angle) * 44;
    const sideY = car.y + Math.cos(car.angle) * 44;
    if (isWalkable(city, sideX, sideY, PLAYER.radius)) {
      p.x = sideX;
      p.y = sideY;
    } else {
      p.x = car.x + Math.sin(car.angle) * 44;
      p.y = car.y - Math.cos(car.angle) * 44;
    }
    p.angle = car.angle;
  }

  function closestCar(maxDist) {
    const p = state.player;
    let best = null;
    let bestD = maxDist * maxDist;
    for (const car of state.cars) {
      if (car.driver === 'player' || car.hp <= 0) continue;
      const d = dist2(p.x, p.y, car.x, car.y);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    return best;
  }

  function firePistol() {
    const p = state.player;
    if (p.weapon !== 'pistol' || p.ammo <= 0 || p.cooldown > 0) return 0;
    p.cooldown = PLAYER.pistolCooldown;
    p.ammo -= 1;
    const dx = Math.cos(p.angle);
    const dy = Math.sin(p.angle);
    state.bullets.push({
      x: p.x + dx * 20, y: p.y + dy * 20,
      vx: dx * 900, vy: dy * 900,
      life: PLAYER.pistolRange / 900,
      damage: PLAYER.pistolDamage,
      from: 'player',
    });
    burst(p.x + dx * 24, p.y + dy * 24, '#ffd23e', 4, 90);
    return EVENT_SHOT;
  }

  function punch() {
    const p = state.player;
    if (p.cooldown > 0) return 0;
    p.cooldown = 0.35;
    const dx = Math.cos(p.angle);
    const dy = Math.sin(p.angle);
    const hx = p.x + dx * PLAYER.punchRange;
    const hy = p.y + dy * PLAYER.punchRange;
    let events = 0;
    for (const ped of state.peds) {
      if (ped.down > 0) continue;
      if (dist2(hx, hy, ped.x, ped.y) >= 30 * 30) continue;
      ped.down = 4;
      ped.state = 'down';
      burst(ped.x, ped.y, '#e8e0c8', 6, 100);
      if (random() < 0.5) dropCash(ped.x, ped.y, 10 + Math.floor(random() * 20));
      raiseWanted(1);
      events |= EVENT_CASH;
    }
    for (const off of state.officers) {
      if (dist2(hx, hy, off.x, off.y) >= 30 * 30) continue;
      off.down = 4;
      burst(off.x, off.y, '#2e4a6b', 8, 120);
      dropCash(off.x, off.y, 20);
      raiseWanted(1);
      events |= EVENT_CASH;
    }
    return events;
  }

  function walkPlayer(dt, input) {
    const p = state.player;
    const speed = input.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
    let mx = 0;
    let my = 0;
    if (input.up) my -= 1;
    if (input.down) my += 1;
    if (input.left) mx -= 1;
    if (input.right) mx += 1;
    if (mx !== 0 || my !== 0) {
      const len = Math.hypot(mx, my);
      mx /= len;
      my /= len;
      p.angle = Math.atan2(my, mx);
      slide(p, mx * speed * dt, my * speed * dt, PLAYER.radius);
      p.speed = speed;
    } else {
      p.speed = 0;
    }
    if (input.aimX !== undefined) {
      const wx = state.camera.x - 640 + input.aimX;
      const wy = state.camera.y - 360 + input.aimY;
      if (Math.hypot(wx - p.x, wy - p.y) > 20) p.angle = Math.atan2(wy - p.y, wx - p.x);
    }
    if (input.enter) {
      const car = closestCar(70);
      if (car) getIn(car);
    }
    if (input.attack) return punch();
    if (input.shoot) return firePistol();
    return 0;
  }

  function drivePlayer(dt, input) {
    const p = state.player;
    const car = p.car;
    if (!car) {
      p.onFoot = true;
      return 0;
    }
    const throttle = input.up ? 1 : input.down ? -0.6 : 0;
    const steer = (input.left ? -1 : 0) + (input.right ? 1 : 0);
    const dir = car.speed >= 0 ? 1 : -1;
    // The wheel still turns at a standstill (arcade, not a simulation):
    // without a floor here a car facing the wrong way can never turn around,
    // it just drives into a wall.
    const grip = clamp(Math.abs(car.speed) / 120, 0.35, 1);
    car.angle += steer * CAR.steer * dt * grip * dir;
    car.speed += throttle * (throttle > 0 ? CAR.accel : CAR.brake) * dt;
    car.speed -= car.speed * CAR.drag * dt;
    if (input.handbrake) car.speed *= Math.max(0, 1 - 4 * dt);
    car.speed = clamp(car.speed, -CAR.reverseMax, car.maxSpeed);
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    const frontClear = isWalkable(city, nx + Math.cos(car.angle) * 26, ny + Math.sin(car.angle) * 26, 10);
    const rearClear = isWalkable(city, nx - Math.cos(car.angle) * 26, ny - Math.sin(car.angle) * 26, 10);
    if (isWalkable(city, nx, ny, 24) && frontClear && rearClear) {
      car.x = nx;
      car.y = ny;
    } else {
      // Hitting a building stops the car dead: bouncing it backwards made
      // the steering fight the driver, so the car just waits for the driver
      // to reverse out.
      car.speed = 0;
      burst(car.x, car.y, '#e8e0c8', 3, 60);
    }
    car.brakeLight = input.down;
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    p.speed = Math.abs(car.speed);
    if (input.enter) getOut();
    return 0;
  }

  function updatePlayer(dt, input) {
    const p = state.player;
    if (p.cooldown > 0) p.cooldown -= dt;
    if (p.invulnerable > 0) p.invulnerable -= dt;
    if (p.regenDelay > 0) {
      p.regenDelay -= dt;
    } else if (p.health < PLAYER.health) {
      p.health = Math.min(PLAYER.health, p.health + 2 * dt);
    }
    return p.onFoot ? walkPlayer(dt, input) : drivePlayer(dt, input);
  }

  function pushApart(a, b, gap) {
    const dd = dist2(a.x, a.y, b.x, b.y);
    if (dd >= gap * gap || dd <= 0.01) return;
    const push = (gap - Math.sqrt(dd)) / 2;
    const ang = Math.atan2(a.y - b.y, a.x - b.x);
    a.x += Math.cos(ang) * push;
    a.y += Math.sin(ang) * push;
  }

  function updateTraffic(dt) {
    for (const car of state.cars) {
      if (car.driver !== 'traffic') continue;
      if (!car.target) car.target = randomRoadPoint(random, car.x, car.y, 300);
      const d = Math.hypot(car.target.x - car.x, car.target.y - car.y);
      if (d < 60) {
        car.target = randomRoadPoint(random, car.x, car.y, 300);
        continue;
      }
      const want = Math.atan2(car.target.y - car.y, car.target.x - car.x);
      car.angle = shortestTurn(car.angle, want, 2.2 * dt);
      car.speed = clamp(car.speed + 200 * dt, 0, 260);
      const nx = car.x + Math.cos(car.angle) * car.speed * dt;
      const ny = car.y + Math.sin(car.angle) * car.speed * dt;
      if (isWalkable(city, nx, ny, 24)) {
        car.x = nx;
        car.y = ny;
      } else {
        car.angle += Math.PI / 2;
        car.speed = 0;
      }
      for (const other of state.cars) {
        if (other === car || other.driver === 'player') continue;
        pushApart(car, other, 50);
      }
    }
  }

  function updatePeds(dt) {
    const p = state.player;
    for (const ped of state.peds) {
      if (ped.down > 0) {
        ped.down -= dt;
        continue;
      }
      const scared = dist2(ped.x, ped.y, p.x, p.y) < 200 * 200 && (!p.onFoot || p.speed > 100);
      if (scared || ped.flee > 0) {
        ped.flee = scared ? 1.2 : Math.max(0, ped.flee - dt);
        const a = Math.atan2(ped.y - p.y, ped.x - p.x);
        slide(ped, Math.cos(a) * 130 * dt, Math.sin(a) * 130 * dt, 10);
        ped.angle = a;
        continue;
      }
      if (!ped.target || dist2(ped.x, ped.y, ped.target.x, ped.target.y) < 30 * 30) {
        ped.target = {
          x: clamp(ped.x + (random() - 0.5) * 500, 100, WORLD.width - 100),
          y: clamp(ped.y + (random() - 0.5) * 500, 100, WORLD.height - 100),
        };
      }
      const a = Math.atan2(ped.target.y - ped.y, ped.target.x - ped.x);
      slide(ped, Math.cos(a) * 55 * dt, Math.sin(a) * 55 * dt, 10);
      ped.angle = a;
      // Run over by a car: down, and the driver is wanted.
      if (!p.onFoot && p.car && dist2(ped.x, ped.y, p.x, p.y) < 34 * 34) {
        ped.down = 5;
        ped.state = 'down';
        burst(ped.x, ped.y, '#e5534b', 10, 140);
        raiseWanted(1);
        if (random() < 0.4) dropCash(ped.x, ped.y, 15);
      }
    }
  }

  function spawnPoliceCar() {
    const spawn = randomRoadPoint(random, state.player.x, state.player.y, 700);
    const car = buildCar(spawn.x, spawn.y, spawn.angle, 'police', 'police');
    state.cars.push(car);
  }

  function spawnOfficer() {
    const p = state.player;
    const a = random() * TAU;
    const x = clamp(p.x + Math.cos(a) * 500, 50, WORLD.width - 50);
    const y = clamp(p.y + Math.sin(a) * 500, 50, WORLD.height - 50);
    if (isWalkable(city, x, y, 12)) {
      state.officers.push({ x, y, angle: 0, down: 0, arrest: 0, shootTimer: 1 + random() });
    }
  }

  function updatePoliceCars(dt) {
    const p = state.player;
    const w = state.wanted;
    for (const car of state.cars) {
      if (car.driver !== 'police') continue;
      if (w.level === 0) {
        car.driver = 'parked';
        car.speed = 0;
        continue;
      }
      const want = Math.atan2(p.y - car.y, p.x - car.x);
      car.angle = shortestTurn(car.angle, want, 3.0 * dt);
      const d = dist2(car.x, car.y, p.x, p.y);
      if (p.onFoot && d < 160 * 160) {
        // On foot the cruisers pull up and stop short: the arrest is the
        // officers' job, not a bumper. They never ram a pedestrian.
        car.speed = Math.max(0, car.speed - 800 * dt);
      } else {
        car.speed = clamp(car.speed + 380 * dt, 0, car.maxSpeed);
      }
      const nx = car.x + Math.cos(car.angle) * car.speed * dt;
      const ny = car.y + Math.sin(car.angle) * car.speed * dt;
      if (isWalkable(city, nx, ny, 24)) {
        car.x = nx;
        car.y = ny;
      } else {
        car.speed *= 0.3;
      }
      for (const other of state.cars) {
        if (other === car || other.driver !== 'police') continue;
        pushApart(car, other, 56);
      }
      // Ram the player's car only: a pedestrian is never run down by a
      // cruiser. Each cruiser can only land a hit once every 0.8s, so a
      // pile-up does not shred a car in a second.
      if (car.ramTimer > 0) car.ramTimer -= dt;
      if (!p.onFoot && d < 46 * 46 && p.car && car.ramTimer <= 0) {
        car.ramTimer = 0.8;
        p.car.hp -= 2;
        p.car.speed *= 0.9;
        burst(p.x, p.y, '#e8e0c8', 4, 80);
        if (p.car.hp <= 0) {
          burst(p.car.x, p.car.y, '#3a3f46', 20, 160);
          getOut();
        }
        car.speed *= 0.5;
      }
    }
  }

  function updateOfficers(dt) {
    const p = state.player;
    const w = state.wanted;
    for (const off of state.officers) {
      if (off.down > 0) {
        off.down -= dt;
        continue;
      }
      if (w.level === 0) {
        off.down = 0.01;
        continue;
      }
      const d = Math.hypot(p.x - off.x, p.y - off.y);
      const a = Math.atan2(p.y - off.y, p.x - off.x);
      off.angle = a;
      if (d > 34) {
        slide(off, Math.cos(a) * 150 * dt, Math.sin(a) * 150 * dt, 10);
      } else if (p.onFoot) {
        // An officer can only arrest a player on foot: a player in a car is
        // chased, not cuffed.
        off.arrest += dt;
        if (off.arrest > 1.5) return EVENT_BUSTED;
      }
      if (d < 500 && w.level >= 3) {
        off.shootTimer -= dt;
        if (off.shootTimer <= 0) {
          off.shootTimer = 1.1 + random() * 0.8;
          const miss = (random() - 0.5) * 0.5;
          state.bullets.push({
            x: off.x, y: off.y,
            vx: Math.cos(a + miss) * 700, vy: Math.sin(a + miss) * 700,
            life: 0.8, damage: 9, from: 'police',
          });
        }
      }
    }
    return 0;
  }

  function updatePolice(dt) {
    const w = state.wanted;
    const wantCars = w.level > 0 ? Math.min(TRAFFIC.policeCars, w.level) : 0;
    let policeCars = 0;
    for (const car of state.cars) if (car.driver === 'police') policeCars += 1;
    if (policeCars < wantCars) spawnPoliceCar();
    const activeOfficers = state.officers.filter((o) => o.down <= 0).length;
    if (w.level >= 3 && activeOfficers < TRAFFIC.policeFoot) spawnOfficer();
    updatePoliceCars(dt);
    return updateOfficers(dt);
  }

  function updateBullets(dt) {
    let events = 0;
    for (const b of state.bullets) {
      b.life -= dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (!isWalkable(city, b.x, b.y, 2)) {
        b.life = 0;
        burst(b.x, b.y, '#e8e0c8', 3, 60);
        continue;
      }
      const p = state.player;
      if (b.from === 'police' && dist2(b.x, b.y, p.x, p.y) < (p.onFoot ? 16 * 16 : 30 * 30)) {
        b.life = 0;
        if (p.onFoot) {
          hurtPlayer(b.damage);
        } else if (p.car) {
          p.car.hp -= b.damage;
          if (p.car.hp <= 0) {
            burst(p.car.x, p.car.y, '#3a3f46', 20, 160);
            getOut();
          }
        }
        continue;
      }
      if (b.from !== 'player') continue;
      let spent = false;
      for (const off of state.officers) {
        if (off.down > 0) continue;
        if (dist2(b.x, b.y, off.x, off.y) < 18 * 18) {
          b.life = 0;
          off.down = 5;
          burst(off.x, off.y, '#2e4a6b', 8, 120);
          dropCash(off.x, off.y, 20);
          raiseWanted(1);
          events |= EVENT_CASH;
          spent = true;
          break;
        }
      }
      if (spent) continue;
      for (const ped of state.peds) {
        if (ped.down > 0) continue;
        if (dist2(b.x, b.y, ped.x, ped.y) < 16 * 16) {
          b.life = 0;
          ped.down = 5;
          ped.state = 'down';
          burst(ped.x, ped.y, '#e5534b', 8, 120);
          raiseWanted(1);
          break;
        }
      }
    }
    state.bullets = state.bullets.filter((b) => b.life > 0);
    return events;
  }

  function updatePickups(dt) {
    const p = state.player;
    let events = 0;
    for (const pk of state.pickups) {
      pk.life -= dt;
      if (dist2(pk.x, pk.y, p.x, p.y) >= 34 * 34) continue;
      pk.life = 0;
      state.money += pk.amount;
      events |= EVENT_CASH;
      burst(pk.x, pk.y, '#5ec96a', 6, 90);
    }
    state.pickups = state.pickups.filter((pk) => pk.life > 0);
    return events;
  }

  function updateParticles(dt) {
    for (const pt of state.particles) {
      pt.life -= dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= 0.98;
      pt.vy *= 0.98;
    }
    state.particles = state.particles.filter((pt) => pt.life > 0);
  }

  function nearestPoliceDistance() {
    const p = state.player;
    let best = Infinity;
    for (const car of state.cars) {
      if (car.driver !== 'police') continue;
      best = Math.min(best, Math.hypot(car.x - p.x, car.y - p.y));
    }
    for (const off of state.officers) {
      if (off.down > 0) continue;
      best = Math.min(best, Math.hypot(off.x - p.x, off.y - p.y));
    }
    return best;
  }

  function updateWanted(dt) {
    const w = state.wanted;
    if (w.level === 0) return;
    const nearest = nearestPoliceDistance();
    if (nearest > WANTED.loseDistance) {
      w.loseTimer += dt;
      if (w.loseTimer > WANTED.loseSeconds) {
        w.level -= 1;
        w.loseTimer = 0;
        state.mission.toast = w.level === 0
          ? 'You lost them. The heat is off.'
          : 'Wanted level dropped.';
        state.mission.toastTimer = 3;
      }
    } else {
      w.loseTimer = 0;
    }
    w.cleanTimer += dt;
    if (w.cleanTimer > WANTED.decaySeconds && nearest > 500) {
      w.level = Math.max(0, w.level - 1);
      w.cleanTimer = 0;
    }
  }

  function failMission(reason) {
    const ms = state.mission;
    if (!ms.active) return;
    ms.active = null;
    ms.toast = reason;
    ms.toastTimer = 4;
  }

  function completeMission() {
    const ms = state.mission;
    const a = ms.active;
    if (!a) return 0;
    state.money += a.def.reward;
    ms.toast = a.def.complete;
    ms.toastTimer = 5;
    ms.index += 1;
    if (ms.index >= MISSIONS.length) ms.storyDone = true;
    ms.active = null;
    state.wanted.level = Math.max(0, state.wanted.level - 1);
    return EVENT_MISSION;
  }

  function missionAtTarget(target, radius) {
    const p = state.player;
    return dist2(p.x, p.y, target.x, target.y) < radius * radius;
  }

  function updateMission(dt) {
    const ms = state.mission;
    const a = ms.active;
    if (!a) return 0;
    a.timer -= dt;
    if (a.timer <= 0) {
      failMission('Out of time, the job fell through. Press Enter to try again.');
      return EVENT_FAIL;
    }
    const p = state.player;
    const def = a.def;
    if (a.stage === 'steal') {
      if (p.car && p.car.missionCar) {
        a.stage = 'deliver';
        ms.toast = `Got it. Now deliver the ${p.car.name} to ${def.deliver.name}.`;
        ms.toastTimer = 4;
      }
      return 0;
    }
    if (a.stage === 'deliver') {
      if (p.car && missionAtTarget(def.deliver, def.deliver.radius)) return completeMission();
      return 0;
    }
    if (a.stage === 'collect') {
      for (const shop of def.pickups) {
        if (shop.done) continue;
        if (!missionAtTarget(shop, shop.radius)) continue;
        shop.done = true;
        a.collected += 1;
        state.money += 50;
        ms.toast = `Collected from ${shop.name} (+$50). ${a.collected} of ${def.pickups.length}.`;
        ms.toastTimer = 3;
        if (a.collected >= def.pickups.length) return completeMission();
      }
      return 0;
    }
    if (a.stage === 'survive') {
      a.survived += dt;
      if (a.survived >= def.survive) return completeMission();
      return 0;
    }
    if (a.stage === 'pickup') {
      if (p.car && missionAtTarget(def.pickup, def.pickup.radius)) {
        a.stage = 'deliver';
        a.pickedUp = true;
        ms.toast = `Fare aboard. Drop them at ${def.deliver.name}.`;
        ms.toastTimer = 3;
      }
      return 0;
    }
    return 0;
  }

  function missionCarAngle(def) {
    const onAvenue = AVENUES.some((ax) => Math.abs(def.target.x - ax) < 48);
    if (onAvenue) return def.deliver.y > def.target.y ? Math.PI / 2 : -Math.PI / 2;
    return def.deliver.x > def.target.x ? 0 : Math.PI;
  }

  function startStoryMission() {
    const ms = state.mission;
    if (ms.active || ms.storyDone) return;
    const def = MISSIONS[ms.index];
    if (!def) return;
    if (def.pickups) for (const s of def.pickups) s.done = false;
    // Place the mission car in the world, facing along its road toward the drop-off.
    if (def.target && def.target.kind === 'car') {
      const car = buildCar(def.target.x, def.target.y, missionCarAngle(def), def.target.type, 'mission');
      car.missionCar = true;
      state.cars.push(car);
    }
    ms.toast = startMission(ms, def, state.wanted);
    ms.toastTimer = 6;
    if (def.onStart === 'pistol' && !state.player.weapon) {
      state.player.weapon = 'pistol';
      state.player.ammo = 48;
    }
  }

  function startFare() {
    const ms = state.mission;
    if (ms.active) return;
    const def = makeFare(random, state.player);
    startMission(ms, def, state.wanted);
    ms.toast = def.brief;
    ms.toastTimer = 5;
  }

  function respawn() {
    const p = state.player;
    if (p.car) {
      p.car.driver = 'parked';
      p.car.speed = 0;
      p.car = null;
    }
    p.x = PLACES.hospital.x;
    p.y = PLACES.hospital.y;
    p.health = PLAYER.health;
    p.onFoot = true;
    p.invulnerable = 2;
    state.wanted.level = 0;
    state.wanted.cleanTimer = 0;
    state.wanted.loseTimer = 0;
    state.officers.length = 0;
    for (const car of state.cars) {
      if (car.driver === 'police') {
        car.driver = 'parked';
        car.speed = 0;
      }
    }
  }

  function takeCut() {
    state.money = Math.floor(state.money * 0.8);
  }

  // One fixed step. `input` is the frame's held keys and one-shot flags.
  function step(dt, input) {
    let events = 0;
    state.time += dt;
    if (state.mission.toastTimer > 0) state.mission.toastTimer -= dt;
    if (input.startMission) startStoryMission();
    if (input.startFare) startFare();
    events |= updatePlayer(dt, input);
    updateTraffic(dt);
    updatePeds(dt);
    events |= updatePolice(dt);
    events |= updateBullets(dt);
    events |= updatePickups(dt);
    events |= updateMission(dt);
    updateWanted(dt);
    updateParticles(dt);
    const p = state.player;
    if (p.health <= 0) {
      takeCut();
      failMission('Wasted, you woke up at Solara General, lighter by 20%. Press Enter to retry the job.');
      respawn();
      return events | EVENT_WASTED;
    }
    if (events & EVENT_BUSTED) {
      takeCut();
      failMission('Busted, the SPPD took 20% and let you walk. Press Enter to retry the job.');
      respawn();
    }
    // Camera follows the player.
    state.camera.x = clamp(p.x, 640, WORLD.width - 640);
    state.camera.y = clamp(p.y, 360, WORLD.height - 360);
    return events;
  }

  reset();
  return {
    state,
    city,
    reset,
    step,
    objective: () => currentObjective(state.mission),
    startStoryMission,
    startFare,
    // Put a car in the world (used by the screenshot scenes).
    spawnCar(x, y, angle, type, driver) {
      const car = buildCar(x, y, angle, type, driver);
      state.cars.push(car);
      return car;
    },
  };
}
