// Drawing only: the city, the cars and people in it, the effects, the HUD
// with its minimap and the screens. The camera shows a 1280x720 window of
// the 3840x2560 city, scaled to fit the browser window. Flat shapes and
// canvas text, no images: every pixel is drawn code.
import { AVENUES, BEACH, DISTRICTS, FONT, PALETTE, ROAD, STREETS, VIEW, WATER, WORLD } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WASTED = 'wasted';
export const SCREEN_DONE = 'done';

const PANEL_WIDTH = 640;
const PANEL_TOP = 150;
const PANEL_LINE = 32;
const PANEL_BOTTOM = 76;

function dot(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function rounded(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function roofColor(b) {
  if (b.style === 'downtown') return b.roof > 0.5 ? PALETTE.roofDowntown : PALETTE.roofDowntown2;
  if (b.style === 'houses') return b.roof > 0.5 ? PALETTE.roofHouse : PALETTE.roofHouse2;
  if (b.style === 'industrial') return PALETTE.roofIndustrial;
  if (b.style === 'marina') return PALETTE.roofMarina;
  return PALETTE.roofHouse;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const fontCache = new Map();
  let camera = { x: 1920, y: 1280 };

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / VIEW.width, height / VIEW.height);
    view.x = (width - VIEW.width * view.scale) / 2;
    view.y = (height - VIEW.height * view.scale) / 2;
  }

  function write(value, x, y, size, color, align, baseline) {
    const key = `${size}`;
    if (!fontCache.has(key)) fontCache.set(key, `${size}px ${FONT}`);
    ctx.font = fontCache.get(key);
    ctx.fillStyle = color;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = baseline || 'alphabetic';
    ctx.fillText(value, x, y);
  }

  function visible(x, y, margin) {
    return x > camera.x - 640 - margin && x < camera.x + 640 + margin
      && y > camera.y - 360 - margin && y < camera.y + 360 + margin;
  }

  function paintSea() {
    ctx.fillStyle = PALETTE.waterDeep;
    ctx.fillRect(0, 0, WATER.west, WORLD.height);
    ctx.fillRect(0, WATER.south, WORLD.width, WORLD.height - WATER.south);
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(0, 0, WATER.west - 30, WORLD.height);
    ctx.fillRect(0, WATER.south + 30, WORLD.width, WORLD.height - WATER.south - 30);
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(WATER.west, 0, BEACH.west - WATER.west, WORLD.height);
    ctx.fillRect(0, BEACH.south, WORLD.width, WATER.south - BEACH.south);
    ctx.strokeStyle = PALETTE.wave;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.5;
    for (let y = 120; y < WORLD.height; y += 180) {
      ctx.beginPath();
      ctx.moveTo(20, y);
      ctx.quadraticCurveTo(80, y - 14, 150, y);
      ctx.stroke();
    }
    for (let x = 300; x < WORLD.width; x += 260) {
      ctx.beginPath();
      ctx.moveTo(x, WATER.south + 60);
      ctx.quadraticCurveTo(x + 40, WATER.south + 46, x + 90, WATER.south + 60);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function paintRoads() {
    ctx.fillStyle = PALETTE.sidewalk;
    for (const ax of AVENUES) ctx.fillRect(ax - ROAD.width / 2 - 12, 0, ROAD.width + 24, WORLD.height);
    for (const sy of STREETS) ctx.fillRect(0, sy - ROAD.width / 2 - 12, WORLD.width, ROAD.width + 24);
    ctx.fillStyle = PALETTE.asphalt;
    for (const ax of AVENUES) ctx.fillRect(ax - ROAD.width / 2, 0, ROAD.width, WORLD.height);
    for (const sy of STREETS) ctx.fillRect(0, sy - ROAD.width / 2, WORLD.width, ROAD.width);
    ctx.fillStyle = PALETTE.lane;
    for (const ax of AVENUES) {
      for (let y = 0; y < WORLD.height; y += 64) ctx.fillRect(ax - 2, y, 4, 30);
    }
    for (const sy of STREETS) {
      for (let x = 0; x < WORLD.width; x += 64) ctx.fillRect(x, sy - 2, 30, 4);
    }
  }

  function paintGround() {
    for (const d of DISTRICTS) {
      ctx.fillStyle = d.ground;
      ctx.fillRect(d.x, d.y, d.w, d.h);
    }
    paintSea();
    paintRoads();
  }

  function paintTallRoof(b) {
    // Rooftop plant and a lit window grid, so downtown reads as towers from above.
    ctx.fillStyle = PALETTE.windowDark;
    ctx.fillRect(b.x + 8, b.y + 8, b.w - 16, 10);
    const cols = Math.max(2, Math.floor(b.w / 34));
    const rows = Math.max(2, Math.floor(b.h / 34));
    for (let c = 0; c < cols; c += 1) {
      for (let r = 0; r < rows; r += 1) {
        if ((c + r + b.windows) % 3 === 0) continue;
        ctx.fillStyle = (c * 7 + r * 3 + b.windows) % 5 === 0 ? PALETTE.window : PALETTE.windowDark;
        ctx.fillRect(b.x + 10 + c * 34, b.y + 26 + r * 34, 16, 12);
      }
    }
  }

  function paintBuildings(city) {
    for (const b of city.buildings) {
      if (!visible(b.x + b.w / 2, b.y + b.h / 2, 200)) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(b.x + 6, b.y + 8, b.w, b.h);
      ctx.fillStyle = roofColor(b);
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = PALETTE.buildingEdge;
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
      if (b.tall) paintTallRoof(b);
      else {
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, 8);
      }
    }
    for (const t of city.trees) {
      if (!visible(t.x, t.y, 40)) continue;
      ctx.fillStyle = PALETTE.trunk;
      ctx.fillRect(t.x - 2, t.y - 2, 4, 4);
      ctx.fillStyle = t.palm ? PALETTE.tree : PALETTE.treeDark;
      dot(ctx, t.x, t.y, t.r);
      ctx.fillStyle = t.palm ? PALETTE.treeDark : PALETTE.tree;
      dot(ctx, t.x - 3, t.y - 3, t.r * 0.6);
    }
  }

  function paintCar(car, time) {
    if (!visible(car.x, car.y, 80)) return;
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    rounded(ctx, -34 + 4, -17 + 5, 68, 34, 8);
    ctx.fill();
    ctx.fillStyle = car.color;
    rounded(ctx, -34, -17, 68, 34, 9);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 2;
    rounded(ctx, -34, -17, 68, 34, 9);
    ctx.stroke();
    // Windshield and rear window.
    ctx.fillStyle = '#20262e';
    ctx.fillRect(8, -14, 12, 28);
    ctx.fillRect(-24, -14, 8, 28);
    // Headlights.
    ctx.fillStyle = '#ffe9a8';
    ctx.fillRect(32, -14, 3, 6);
    ctx.fillRect(32, 8, 3, 6);
    if (car.brakeLight) {
      ctx.fillStyle = '#ff3b30';
      ctx.fillRect(-35, -14, 3, 6);
      ctx.fillRect(-35, 8, 3, 6);
    }
    if (car.driver === 'police') {
      const on = Math.floor(time * 4) % 2 === 0;
      ctx.fillStyle = on ? PALETTE.policeLight : PALETTE.policeLight2;
      ctx.fillRect(-6, -17, 12, 6);
      ctx.fillStyle = on ? PALETTE.policeLight2 : PALETTE.policeLight;
      ctx.fillRect(-6, 11, 12, 6);
      write('SPPD', 0, 4, 11, '#f2f2f2', 'center', 'middle');
    }
    if (car.driver === 'mission') {
      ctx.fillStyle = PALETTE.marker;
      ctx.fillRect(-6, -17, 12, 5);
    }
    ctx.restore();
  }

  function paintPerson(x, y, angle, shirt, down) {
    if (!visible(x, y, 40)) return;
    ctx.save();
    ctx.translate(x, y);
    if (down > 0) {
      ctx.rotate(angle + Math.PI / 2);
      ctx.fillStyle = shirt;
      ctx.fillRect(-12, -6, 24, 12);
      ctx.fillStyle = '#e8b98a';
      dot(ctx, 15, 0, 6);
    } else {
      ctx.rotate(angle);
      ctx.fillStyle = shirt;
      dot(ctx, 0, 0, 11);
      ctx.fillStyle = '#20262e';
      ctx.fillRect(8, -5, 8, 10);
      ctx.fillStyle = '#e8b98a';
      dot(ctx, 13, 0, 6);
    }
    ctx.restore();
  }

  function paintCash(state) {
    for (const pk of state.pickups) {
      if (!visible(pk.x, pk.y, 30)) continue;
      ctx.fillStyle = PALETTE.cash;
      dot(ctx, pk.x, pk.y, 10);
      write('$', pk.x, pk.y + 5, 15, '#0e1a24', 'center', 'middle');
    }
  }

  function paintPlayer(state) {
    const p = state.player;
    if (p.onFoot) {
      if (p.invulnerable === 0 || Math.floor(p.invulnerable * 10) % 2 === 1) {
        paintPerson(p.x, p.y, p.angle, PALETTE.playerJacket, 0);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 17, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (p.car) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 44, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function paintEffects(state) {
    ctx.fillStyle = '#ffd23e';
    for (const b of state.bullets) ctx.fillRect(b.x - 3, b.y - 2, 6, 4);
    for (const pt of state.particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.max);
      ctx.fillStyle = pt.color;
      dot(ctx, pt.x, pt.y, pt.size);
    }
    ctx.globalAlpha = 1;
  }

  function paintMarker(target, time, cam) {
    if (!target) return;
    const pulse = 1 + Math.sin(time * 4) * 0.12;
    // Beacon column and pulsing ring on the ground.
    ctx.fillStyle = 'rgba(255, 210, 62, 0.18)';
    ctx.fillRect(target.x - 4, target.y - 260, 8, 260);
    ctx.strokeStyle = PALETTE.marker;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(target.x, target.y, target.radius * 0.45 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = PALETTE.marker;
    ctx.beginPath();
    ctx.moveTo(target.x, target.y - 34);
    ctx.lineTo(target.x - 12, target.y - 12);
    ctx.lineTo(target.x + 12, target.y - 12);
    ctx.closePath();
    ctx.fill();
    // Edge arrow when the target is off-screen.
    const vx = target.x - cam.x;
    const vy = target.y - cam.y;
    if (Math.abs(vx) > 600 || Math.abs(vy) > 320) {
      const ax = cam.x + Math.max(-560, Math.min(560, vx));
      const ay = cam.y + Math.max(-280, Math.min(280, vy));
      const a = Math.atan2(vy, vx);
      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(a);
      ctx.fillStyle = PALETTE.marker;
      ctx.beginPath();
      ctx.moveTo(22, 0);
      ctx.lineTo(-10, -14);
      ctx.lineTo(-10, 14);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  function missionTarget(state) {
    const a = state.mission.active;
    if (!a) return null;
    const def = a.def;
    if (a.stage === 'steal') return def.target;
    if (a.stage === 'deliver') return def.deliver;
    if (a.stage === 'collect') return def.pickups.find((s) => !s.done) || null;
    if (a.stage === 'pickup') return def.pickup;
    return null;
  }

  function paintMinimap(state, target) {
    const mw = 208;
    const mh = 140;
    const mx = VIEW.width - mw - 16;
    const my = VIEW.height - mh - 16;
    const sx = mw / WORLD.width;
    const sy = mh / WORLD.height;
    ctx.fillStyle = PALETTE.hudPanel;
    ctx.fillRect(mx - 6, my - 6, mw + 12, mh + 12);
    ctx.fillStyle = '#1f5f84';
    ctx.fillRect(mx, my, mw, mh);
    ctx.fillStyle = '#8f8a7c';
    ctx.fillRect(mx, my, mw, mh);
    ctx.strokeStyle = '#3a3f46';
    ctx.lineWidth = 3;
    for (const ax of AVENUES) {
      ctx.beginPath();
      ctx.moveTo(mx + ax * sx, my);
      ctx.lineTo(mx + ax * sx, my + mh);
      ctx.stroke();
    }
    for (const sy2 of STREETS) {
      ctx.beginPath();
      ctx.moveTo(mx, my + sy2 * sy);
      ctx.lineTo(mx + mw, my + sy2 * sy);
      ctx.stroke();
    }
    if (target) {
      ctx.fillStyle = PALETTE.marker;
      dot(ctx, mx + target.x * sx, my + target.y * sy, 5);
    }
    ctx.fillStyle = '#4f8ff7';
    for (const car of state.cars) {
      if (car.driver === 'police') dot(ctx, mx + car.x * sx, my + car.y * sy, 3);
    }
    const p = state.player;
    ctx.save();
    ctx.translate(mx + p.x * sx, my + p.y * sy);
    ctx.rotate(p.angle);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(7, 0);
    ctx.lineTo(-5, -4);
    ctx.lineTo(-5, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 2;
    ctx.strokeRect(mx - 6, my - 6, mw + 12, mh + 12);
  }

  function paintHud(state, objective, toast) {
    const p = state.player;
    ctx.fillStyle = PALETTE.hudPanel;
    ctx.fillRect(12, 12, 250, 64);
    write(`$${Math.floor(state.money)}`, 24, 34, 26, PALETTE.cash, 'left', 'top');
    write(p.weapon === 'pistol' ? `Pistol ${p.ammo}` : 'Fists', 24, 62, 16, PALETTE.hudMuted, 'left', 'top');
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(140, 22, 110, 14);
    ctx.fillStyle = p.health > 30 ? PALETTE.health : PALETTE.healthLow;
    ctx.fillRect(140, 22, 110 * Math.max(0, p.health / 100), 14);
    write('HP', 140, 40, 13, PALETTE.hudMuted, 'left', 'top');
    const w = state.wanted.level;
    for (let i = 0; i < 5; i += 1) {
      write('★', VIEW.width - 24 - i * 34, 20, 30, i < w ? PALETTE.star : PALETTE.starEmpty, 'right', 'top');
    }
    write(w > 0 ? 'WANTED' : 'CLEAN', VIEW.width - 24, 56, 14, w > 0 ? PALETTE.danger : PALETTE.hudMuted, 'right', 'top');
    if (objective) {
      const width = Math.min(640, 24 + objective.length * 9);
      ctx.fillStyle = PALETTE.hudPanel;
      ctx.fillRect((VIEW.width - width) / 2, 12, width, 44);
      write(objective, VIEW.width / 2, 24, 20, PALETTE.objective, 'center', 'top');
      const a = state.mission.active;
      if (a && a.timer !== undefined) {
        write(`${Math.ceil(a.timer)}s`, VIEW.width / 2, 46, 14, PALETTE.hudMuted, 'center', 'top');
      }
    }
    if (toast && state.mission.toastTimer > 0) {
      ctx.fillStyle = PALETTE.hudPanel;
      ctx.fillRect(220, 84, VIEW.width - 440, 40);
      write(toast, VIEW.width / 2, 96, 17, PALETTE.hudText, 'center', 'top');
    }
    if (!p.onFoot && p.car) {
      write(`${Math.round(Math.abs(p.car.speed) * 0.22)} mph  ·  ${p.car.name}`, 24, VIEW.height - 64, 20, PALETTE.hudText, 'left', 'top');
      write('E exit  ·  Space handbrake', 24, VIEW.height - 36, 15, PALETTE.hudMuted, 'left', 'top');
    } else {
      write('WASD move  ·  Shift run  ·  E enter car  ·  Q punch  ·  F shoot  ·  Enter job  ·  T fare  ·  P pause', 24, VIEW.height - 36, 15, PALETTE.hudMuted, 'left', 'top');
    }
  }

  function paintPanel(title, lines, prompt, accent) {
    const height = PANEL_TOP + lines.length * PANEL_LINE + PANEL_BOTTOM;
    const x = (VIEW.width - PANEL_WIDTH) / 2;
    const y = (VIEW.height - height) / 2;
    ctx.fillStyle = PALETTE.panel;
    ctx.fillRect(x, y, PANEL_WIDTH, height);
    ctx.strokeStyle = accent || PALETTE.panelEdge;
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, PANEL_WIDTH, height);
    ctx.textBaseline = 'alphabetic';
    write(title, VIEW.width / 2, y + 78, 52, PALETTE.title, 'center');
    for (let index = 0; index < lines.length; index += 1) {
      write(lines[index], VIEW.width / 2, y + PANEL_TOP + index * PANEL_LINE, 20, PALETTE.hudMuted, 'center');
    }
    write(prompt, VIEW.width / 2, y + height - 38, 22, PALETTE.marker, 'center');
  }

  function paintTitle(ui) {
    const lines = [
      'Solara, a sun-soaked city that never sleeps.',
      'Mara Voss has work for you. Steal, deliver, survive.',
      'WASD move · E enter a car · Q punch · F shoot · Enter start a job',
      ui.best > 0 ? `Best haul $${ui.best}` : '',
    ];
    paintPanel('SOLARA', lines, 'Press Enter or click to start', PALETTE.panelEdge);
  }

  function paintOverlay(screen) {
    if (screen === SCREEN_PAUSED) {
      paintPanel('Paused', ['The city waits for you.'], 'Press P to resume');
    } else if (screen === SCREEN_BUSTED) {
      paintPanel('Busted', ['The SPPD took 20% of your cash and let you walk.', 'Mara is not impressed.'], 'Press Enter to get back out there', PALETTE.danger);
    } else if (screen === SCREEN_WASTED) {
      paintPanel('Wasted', ['You woke up at Solara General, lighter by 20%.', 'The city is still yours to take.'], 'Press Enter to get back out there', PALETTE.danger);
    } else if (screen === SCREEN_DONE) {
      paintPanel('Solara Is Yours', ['Every job done. Mara Voss shakes your hand.', 'Free roam: fares still pay. Press T for a fare.'], 'Press Enter to keep playing');
    }
  }

  // Paint one frame: the world, then the HUD or a panel for the screen the game is on.
  function draw(state, city, screen, ui) {
    camera = state.camera;
    const cam = state.camera;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = PALETTE.backdrop;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    // Clip to the logical view so nothing draws past its edges.
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, VIEW.width, VIEW.height);
    ctx.clip();
    ctx.translate(-cam.x + VIEW.width / 2, -cam.y + VIEW.height / 2);
    paintGround();
    paintBuildings(city);
    paintCash(state);
    const cars = [...state.cars].sort((a, b) => a.y - b.y);
    for (const car of cars) paintCar(car, state.time);
    for (const ped of state.peds) paintPerson(ped.x, ped.y, ped.angle, ped.color, ped.down);
    for (const off of state.officers) {
      paintPerson(off.x, off.y, off.angle, PALETTE.police, off.down);
      if (off.arrest > 0 && off.down <= 0) {
        ctx.fillStyle = PALETTE.danger;
        ctx.fillRect(off.x - 14, off.y - 26, 28 * Math.min(1, off.arrest / 1.5), 4);
      }
    }
    paintPlayer(state);
    paintEffects(state);
    const target = missionTarget(state);
    paintMarker(target, state.time, cam);
    ctx.restore();

    // HUD and panels draw in screen space.
    if (screen === SCREEN_TITLE) {
      paintTitle(ui);
      return;
    }
    paintHud(state, ui.objective, ui.toast);
    paintMinimap(state, target);
    paintOverlay(screen);
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
