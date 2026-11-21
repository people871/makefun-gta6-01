// Drawing only for SOLMAR HEAT: the sun-soaked city, its cars and people, the
// HUD (health, money, stashes, wanted stars, objective, mission counter,
// speed, minimap, district name, killfeed) and the screens
// (title, pause, wasted, busted). The camera shows a 1280x720 window of the
// 3200x2400 world, scaled to fit the browser window.
import { AIRSTRIP, BEACH_Y, CAR, FONT, FONT_DISPLAY, PALETTE, PLAYER, POLICE, ROADS_X, ROADS_Y, ROAD_W, STASHES, VIEW, WORLD } from './config.js';
import { districtAt } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_BUSTED = 'busted';

const SUN = { x: 0.82, y: 0.18 }; // light direction for building shadows

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };

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

  const fonts = new Map();
  function text(value, x, y, size, color, align, font) {
    const key = size + (font || '');
    if (!fonts.has(key)) fonts.set(key, `${size}px ${font || FONT}`);
    ctx.font = fonts.get(key);
    ctx.fillStyle = color;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(value, x, y);
  }

  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // ---------- city ----------
  function drawCity(state, camX, camY, time) {
    // Ground: pale streets grid over warm ground, sea and sand at the south.
    // (0,0) here is the top-left of the 1280x720 view; world objects are
    // drawn at world-minus-camera below.
    ctx.fillStyle = '#c8b18a';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    // Sea (world y from BEACH_Y+90 to the bottom of the map).
    const seaTop = BEACH_Y + 90;
    if (seaTop - camY < VIEW.height) {
      ctx.fillStyle = PALETTE.sea;
      ctx.fillRect(0, seaTop - camY, VIEW.width, WORLD.height - seaTop);
      ctx.fillStyle = PALETTE.seaDeep;
      for (let i = 0; i < 5; i += 1) {
        const wy = seaTop + 20 + i * 34 + Math.sin(time * 0.7 + i * 2) * 4 - camY;
        ctx.fillRect(((i * 317) % 900), wy, 260, 5);
      }
      ctx.fillStyle = PALETTE.sand;
      ctx.fillRect(0, BEACH_Y - camY, VIEW.width, 90);
    }
    // Beachfront airstrip: a dark runway on the sand, with a dashed centre
    // line — the final mission's escape strip.
    const strip = state.airstrip;
    ctx.fillStyle = PALETTE.runway;
    ctx.fillRect(strip.x - camX, strip.y - camY, strip.w, strip.h);
    ctx.fillStyle = PALETTE.runwayLine;
    for (let x = strip.x + 12; x < strip.x + strip.w - 12; x += 28) {
      ctx.fillRect(x - camX, strip.y + strip.h / 2 - 2 - camY, 16, 4);
    }
    text('AIRSTRIP', strip.x + strip.w / 2 - camX, strip.y + strip.h + 18 - camY, 12, '#5a4632', 'center');
    // Park.
    const park = state.park;
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(park.x - camX, park.y - camY, park.w, park.h);
    ctx.fillStyle = PALETTE.parkPath;
    ctx.fillRect(park.x + park.w / 2 - 10 - camX, park.y - camY, 20, park.h);
    ctx.fillRect(park.x - camX, park.y + park.h / 2 - 10 - camY, park.w, 20);
    // Sidewalks then roads.
    ctx.fillStyle = PALETTE.sidewalk;
    for (const rx of ROADS_X) ctx.fillRect(rx - ROAD_W / 2 - 14 - camX, -camY, ROAD_W + 28, WORLD.height);
    for (const ry of ROADS_Y) ctx.fillRect(-camX, ry - ROAD_W / 2 - 14 - camY, WORLD.width, ROAD_W + 28);
    ctx.fillStyle = PALETTE.road;
    for (const rx of ROADS_X) ctx.fillRect(rx - ROAD_W / 2 - camX, -camY, ROAD_W, WORLD.height);
    for (const ry of ROADS_Y) ctx.fillRect(-camX, ry - ROAD_W / 2 - camY, WORLD.width, ROAD_W);
    // Centre dashes.
    ctx.fillStyle = PALETTE.roadLine;
    for (const rx of ROADS_X) {
      for (let y = 0; y < WORLD.height; y += 56) ctx.fillRect(rx - 2 - camX, y - camY, 4, 28);
    }
    for (const ry of ROADS_Y) {
      for (let x = 0; x < WORLD.width; x += 56) ctx.fillRect(x - camX, ry - 2 - camY, 28, 4);
    }
    // Crosswalks at intersections.
    ctx.fillStyle = 'rgba(245,241,230,0.85)';
    for (const rx of ROADS_X) {
      for (const ry of ROADS_Y) {
        for (let i = -3; i <= 3; i += 1) {
          ctx.fillRect(rx + i * 13 - 4 - camX, ry - ROAD_W / 2 - 8 - camY, 8, 14);
          ctx.fillRect(rx + i * 13 - 4 - camX, ry + ROAD_W / 2 - 6 - camY, 8, 14);
        }
      }
    }
    // Buildings with a sun-side shadow, roof colour and lit windows.
    for (const b of state.buildings) {
      const bx = b.x - camX;
      const by = b.y - camY;
      if (bx > VIEW.width || by > VIEW.height || bx + b.w < 0 || by + b.h < 0) continue;
      ctx.fillStyle = 'rgba(60,40,20,0.25)';
      ctx.fillRect(bx + 10, by + 12, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(bx, by, b.w, b.h);
      ctx.strokeStyle = PALETTE.buildingEdge;
      ctx.lineWidth = 3;
      ctx.strokeRect(bx + 1, by + 1, b.w - 2, b.h - 2);
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(bx + 6, by + 6, b.w - 12, 10);
      for (const w of b.windows) {
        ctx.fillStyle = w.lit ? PALETTE.windowLit : PALETTE.windowDark;
        ctx.fillRect(w.x - camX, w.y - camY, 12, 10);
      }
      if (b.label) {
        text(b.label, bx + b.w / 2, by + b.h / 2, 13, '#2c241c', 'center');
      }
    }
    // Palm trees on the beach and in the park.
    for (const p of state.palms) {
      const px = p.x - camX;
      const py = p.y - camY;
      if (px < -20 || px > VIEW.width + 20 || py < -20 || py > VIEW.height + 20) continue;
      ctx.strokeStyle = '#7a5a34';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + 3, py - 16);
      ctx.stroke();
      ctx.fillStyle = '#2f8f4e';
      for (let i = 0; i < 5; i += 1) {
        const a = (i / 5) * Math.PI * 2 + 0.4;
        ctx.beginPath();
        ctx.ellipse(px + 3 + Math.cos(a) * 10, py - 18 + Math.sin(a) * 6, 12, 4, a, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Landmark signs.
    text('SOLMAR BAY', 90 - camX, 60 - camY, 15, '#5a4632', 'left');
    text('PALMA AVE', 1252 - camX, 250 - camY, 13, 'rgba(245,241,230,0.9)', 'left');
  }

  function drawCarShape(car, camX, camY, time) {
    const cx = car.x - camX;
    const cy = car.y - camY;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(car.angle);
    const L = CAR.length;
    const W = CAR.width;
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    rr(-L / 2 + 4, -W / 2 + 5, L, W, 8);
    ctx.fill();
    ctx.fillStyle = car.color;
    rr(-L / 2, -W / 2, L, W, 9);
    ctx.fill();
    // Roof, windshield, headlights, tail lights.
    ctx.fillStyle = 'rgba(20,30,44,0.85)';
    rr(-L / 2 + 14, -W / 2 + 5, 16, W - 10, 4);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    rr(-L / 2 + 16, -W / 2 + 6, 12, W - 12, 3);
    ctx.fill();
    ctx.fillStyle = '#ffe9a8';
    ctx.fillRect(L / 2 - 4, -W / 2 + 3, 3, 6);
    ctx.fillRect(L / 2 - 4, W / 2 - 9, 3, 6);
    ctx.fillStyle = '#ff4b3e';
    ctx.fillRect(-L / 2 + 1, -W / 2 + 3, 3, 6);
    ctx.fillRect(-L / 2 + 1, W / 2 - 9, 3, 6);
    if (car.kind === 'taxi') {
      ctx.fillStyle = '#1c2733';
      text('TAXI', 0, 4, 10, '#1c2733', 'center');
      ctx.fillStyle = '#f2c94c';
      ctx.fillRect(-8, -W / 2 - 5, 16, 5);
    }
    if (car.kind === 'police') {
      ctx.fillStyle = '#f5f1e6';
      ctx.fillRect(-L / 2 + 4, -W / 2 + 2, L - 8, 5);
      text('POLICE', 0, 4, 10, '#f5f1e6', 'center');
      const on = Math.floor(time * 4) % 2 === 0;
      ctx.fillStyle = on ? PALETTE.policeLight : PALETTE.policeLightBlue;
      ctx.beginPath();
      ctx.arc(-6, -W / 2 - 2, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = on ? PALETTE.policeLightBlue : PALETTE.policeLight;
      ctx.beginPath();
      ctx.arc(6, -W / 2 - 2, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    if (car.kind === 'sport') {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(-L / 2 + 2, -W / 2 + 8, L - 4, 3);
    }
    ctx.restore();
  }

  function drawPerson(x, y, angle, shirt, camX, camY, opts = {}) {
    const px = x - camX;
    const py = y - camY;
    const bob = opts.walking ? Math.sin(opts.time * 10) * 1.5 : 0;
    ctx.save();
    ctx.translate(px, py + bob);
    ctx.rotate(angle + Math.PI / 2);
    if (opts.down) {
      ctx.rotate(Math.PI / 2);
      ctx.fillStyle = shirt;
      rr(-13, -7, 26, 14, 6);
      ctx.fill();
      ctx.fillStyle = PALETTE.playerSkin;
      ctx.beginPath();
      ctx.arc(16, 0, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    // Shadow, body, head, shoulders.
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(0, 4, 11, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = shirt;
    rr(-9, -8, 18, 22, 7);
    ctx.fill();
    ctx.fillStyle = '#2c3e50';
    rr(-8, 12, 16, 6, 3);
    ctx.fill();
    ctx.fillStyle = PALETTE.playerSkin;
    ctx.beginPath();
    ctx.arc(0, -13, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = opts.police ? '#1c2733' : '#3a2a1a';
    ctx.beginPath();
    ctx.arc(0, -15, 8, Math.PI, 0);
    ctx.fill();
    if (opts.police) {
      ctx.fillStyle = '#1c2733';
      ctx.fillRect(-9, -19, 18, 5);
    }
    if (opts.punchAnim > 0) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, -22, 12, -0.6, 0.6);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawMarker(state, camX, camY, time, marker) {
    if (!marker) return;
    const mx = marker.x - camX;
    const my = marker.y - camY;
    const pulse = 1 + Math.sin(time * 5) * 0.15;
    const onScreen = mx > -40 && mx < VIEW.width + 40 && my > -40 && my < VIEW.height + 40;
    if (onScreen) {
      ctx.save();
      ctx.translate(mx, my);
      ctx.scale(pulse, pulse);
      ctx.fillStyle = PALETTE.marker;
      ctx.strokeStyle = '#7a5a00';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, -26);
      ctx.lineTo(18, 0);
      ctx.lineTo(0, 26);
      ctx.lineTo(-18, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#7a5a00';
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      text(marker.label, mx, my - 36, 15, '#fff7d6', 'center');
    } else {
      // Off-screen arrow at the screen edge pointing at the marker.
      const cx = VIEW.width / 2;
      const cy = VIEW.height / 2;
      const ang = Math.atan2(my - cy, mx - cx);
      const ex = cx + Math.cos(ang) * 560;
      const ey = cy + Math.sin(ang) * 300;
      ctx.save();
      ctx.translate(Math.max(30, Math.min(VIEW.width - 30, ex)), Math.max(30, Math.min(VIEW.height - 30, ey)));
      ctx.rotate(ang);
      ctx.fillStyle = PALETTE.marker;
      ctx.beginPath();
      ctx.moveTo(18, 0);
      ctx.lineTo(-10, -12);
      ctx.lineTo(-10, 12);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  function drawPickups(state, camX, camY, time) {
    for (const pk of state.pickups) {
      if (!pk.active) continue;
      const px = pk.x - camX;
      const py = pk.y - camY + Math.sin(time * 3 + pk.bob) * 2;
      if (px < -20 || px > VIEW.width + 20 || py < -20 || py > VIEW.height + 20) continue;
      if (pk.kind === 'cash') {
        ctx.fillStyle = '#1e7d32';
        rr(px - 13, py - 8, 26, 16, 2);
        ctx.fill();
        ctx.fillStyle = '#a5f2b0';
        text('$', px, py + 5, 13, '#a5f2b0', 'center');
      } else if (pk.kind === 'stash') {
        // A hidden stash: a green duffel with a gold clasp, bigger than cash.
        ctx.fillStyle = '#1e5d32';
        rr(px - 15, py - 10, 30, 20, 6);
        ctx.fill();
        ctx.strokeStyle = PALETTE.gold;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(px - 15, py);
        ctx.lineTo(px + 15, py);
        ctx.stroke();
        ctx.fillStyle = PALETTE.gold;
        ctx.fillRect(px - 3, py - 4, 6, 8);
        text('$', px, py - 14, 12, PALETTE.gold, 'center');
      } else {
        ctx.fillStyle = '#f5f1e6';
        rr(px - 11, py - 11, 22, 22, 5);
        ctx.fill();
        ctx.fillStyle = '#e5534b';
        ctx.fillRect(px - 3, py - 8, 6, 16);
        ctx.fillRect(px - 8, py - 3, 16, 6);
      }
    }
  }

  function drawParticles(state, camX, camY) {
    for (const pt of state.particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - camX - pt.size / 2, pt.y - camY - pt.size / 2, pt.size, pt.size);
    }
    ctx.globalAlpha = 1;
  }

  // ---------- HUD ----------
  function drawHud(state, missions, time, muted) {
    const p = state.player;
    ctx.textBaseline = 'alphabetic';
    // Top-left: health + money + stash count.
    ctx.fillStyle = PALETTE.hudPanel;
    rr(14, 12, 330, 112, 10);
    ctx.fill();
    text('RAY “VELA” CRUZ', 28, 38, 15, PALETTE.hudText, 'left');
    ctx.fillStyle = '#222';
    rr(28, 46, 180, 14, 7);
    ctx.fill();
    ctx.fillStyle = p.hp > 30 ? PALETTE.health : PALETTE.danger;
    rr(28, 46, Math.max(0, 180 * (p.hp / PLAYER.maxHealth)), 14, 7);
    ctx.fill();
    text(`${Math.ceil(p.hp)}`, 216, 59, 14, PALETTE.hudText, 'left');
    text(`$${p.money.toLocaleString('en-US')}`, 28, 88, 20, PALETTE.money, 'left');
    if (state.packageCarried) text('📦 PACKAGE', 150, 88, 15, PALETTE.gold, 'left');
    text(`STASH ${state.stats.stashesFound}/${STASHES.count}`, 28, 110, 13, PALETTE.stash, 'left');
    // Wanted stars, top centre.
    const stars = state.wantedLevel;
    ctx.fillStyle = PALETTE.hudPanel;
    rr(VIEW.width / 2 - 110, 12, 220, 44, 10);
    ctx.fill();
    for (let i = 0; i < 5; i += 1) {
      const flashing = stars > 0 && Math.floor(time * 3) % 2 === 0;
      text('★', VIEW.width / 2 - 88 + i * 40, 44, 28, i < stars ? (flashing ? '#ffd60a' : '#ff9d00') : 'rgba(245,241,230,0.25)', 'left');
    }
    // Objective banner under the stars, with the mission counter.
    const counter = missions.missionCounter();
    const objective = (counter ? counter + ' — ' : '') + missions.currentObjective();
    ctx.fillStyle = PALETTE.hudPanel;
    const ow = Math.min(680, 40 + objective.length * 8.4);
    rr(VIEW.width / 2 - ow / 2, 88, ow, 34, 8);
    ctx.fill();
    text('◆ ' + objective, VIEW.width / 2, 111, 15, PALETTE.hudText, 'center');
    // Vault progress.
    if (state.vaultProgress > 0) {
      ctx.fillStyle = PALETTE.hudPanel;
      rr(VIEW.width / 2 - 130, 124, 260, 22, 8);
      ctx.fill();
      ctx.fillStyle = PALETTE.gold;
      rr(VIEW.width / 2 - 124, 129, 248 * state.vaultProgress, 12, 6);
      ctx.fill();
      text('CRACKING THE VAULT…', VIEW.width / 2, 162, 13, PALETTE.hudText, 'center');
    }
    // Arrest warning.
    if (state.arrestProgress > 0.2) {
      text('⚠ THEY ARE GRABBING YOU — MOVE!', VIEW.width / 2, 190, 16, PALETTE.danger, 'center');
    }
    // Minimap, top right. Its label under it names the district Ray is in.
    drawMinimap(state, missions);
    // Killfeed under the minimap: newest first, fading out.
    const feed = state.feed;
    for (let i = 0; i < feed.length; i += 1) {
      const entry = feed[i];
      ctx.globalAlpha = Math.max(0.25, Math.min(1, entry.ttl / 2));
      text(entry.text, VIEW.width - 14, 12 + 142 + 42 + i * 20, 13, PALETTE.feed, 'right');
    }
    ctx.globalAlpha = 1;
    // Speed, bottom right, while driving.
    if (p.inCar) {
      const car = state.cars.find((c) => c.id === p.carId);
      const kmh = car ? Math.round(Math.abs(car.speed) * 0.24) : 0;
      ctx.fillStyle = PALETTE.hudPanel;
      rr(VIEW.width - 154, VIEW.height - 66, 140, 52, 10);
      ctx.fill();
      text(`${kmh}`, VIEW.width - 84, VIEW.height - 26, 30, PALETTE.hudText, 'center');
      text('km/h', VIEW.width - 84, VIEW.height - 12, 11, PALETTE.hudMuted, 'center');
    }
    // Controls hint, bottom left.
    text('WASD drive/walk · E enter/steal car · F punch · Shift sprint · P pause · M mute', 16, VIEW.height - 14, 13, 'rgba(245,241,230,0.75)', 'left');
    if (muted) text('🔇 MUTED', VIEW.width - 16, VIEW.height - 84, 13, PALETTE.hudMuted, 'right');
    // Mission banner.
    const banner = missions.state.banner;
    if (banner) {
      const alpha = Math.min(1, banner.timer);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = 'rgba(10,16,22,0.8)';
      rr(VIEW.width / 2 - 300, 210, 600, 76, 12);
      ctx.fill();
      text(banner.text, VIEW.width / 2, 244, 30, PALETTE.title, 'center', FONT_DISPLAY);
      text(banner.sub, VIEW.width / 2, 272, 16, PALETTE.hudText, 'center');
      ctx.globalAlpha = 1;
    }
    // Dialogue box.
    const dlg = missions.state.dialogue;
    if (dlg) {
      ctx.fillStyle = 'rgba(10,16,22,0.85)';
      rr(180, VIEW.height - 128, VIEW.width - 360, 64, 10);
      ctx.fill();
      ctx.strokeStyle = PALETTE.gold;
      ctx.lineWidth = 2;
      ctx.strokeRect(180, VIEW.height - 128, VIEW.width - 360, 64);
      text(dlg.lines[dlg.lineIndex], VIEW.width / 2, VIEW.height - 92, 16, '#fff7d6', 'center');
      text('Enter — next', VIEW.width - 200, VIEW.height - 76, 12, PALETTE.hudMuted, 'right');
    }
  }

  function drawMinimap(state, missions) {
    const mw = 190;
    const mh = 142;
    const mx = VIEW.width - mw - 14;
    const my = 12;
    const sx = mw / WORLD.width;
    const sy = mh / WORLD.height;
    ctx.fillStyle = 'rgba(10,16,22,0.78)';
    rr(mx - 6, my - 6, mw + 12, mh + 12, 10);
    ctx.fill();
    ctx.fillStyle = '#7d9b6d';
    ctx.fillRect(mx, my, mw, mh);
    ctx.fillStyle = PALETTE.sea;
    ctx.fillRect(mx, my + BEACH_Y * sy, mw, mh - BEACH_Y * sy);
    ctx.fillStyle = '#3a3f46';
    for (const rx of ROADS_X) ctx.fillRect(mx + rx * sx - 1, my, 2, mh);
    for (const ry of ROADS_Y) ctx.fillRect(mx, my + ry * sy, mw, 2);
    ctx.fillStyle = '#c96f4a';
    for (const b of state.buildings) ctx.fillRect(mx + b.x * sx, my + b.y * sy, Math.max(1, b.w * sx), Math.max(1, b.h * sy));
    // The airstrip shows on the minimap too.
    ctx.fillStyle = PALETTE.runway;
    ctx.fillRect(mx + AIRSTRIP.x * sx, my + AIRSTRIP.y * sy, Math.max(2, AIRSTRIP.w * sx), Math.max(2, AIRSTRIP.h * sy));
    const marker = missions.marker();
    if (marker) {
      ctx.fillStyle = PALETTE.marker;
      ctx.beginPath();
      ctx.arc(mx + marker.x * sx, my + marker.y * sy, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const car of state.cars) {
      if (car.police) {
        ctx.fillStyle = '#ff3b30';
        ctx.beginPath();
        ctx.arc(mx + car.x * sx, my + car.y * sy, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    const p = state.player;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(mx + p.x * sx, my + p.y * sy, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath();
    ctx.arc(mx + p.x * sx, my + p.y * sy, 2.5, 0, Math.PI * 2);
    ctx.fill();
    // The label under the minimap is the district Ray is standing in.
    text(districtAt(p.x, p.y), mx + mw / 2, my + mh + 18, 11, PALETTE.district, 'center');
  }

  // ---------- screens ----------
  function drawPanel(title, lines, prompt, accent) {
    const w = 640;
    const h = 150 + lines.length * 32;
    const x = (VIEW.width - w) / 2;
    const y = (VIEW.height - h) / 2;
    ctx.fillStyle = 'rgba(10,16,22,0.88)';
    rr(x, y, w, h, 14);
    ctx.fill();
    ctx.strokeStyle = accent || PALETTE.gold;
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, w, h);
    text(title, VIEW.width / 2, y + 62, 40, accent || PALETTE.title, 'center', FONT_DISPLAY);
    for (let i = 0; i < lines.length; i += 1) text(lines[i], VIEW.width / 2, y + 108 + i * 32, 17, PALETTE.hudText, 'center');
    text(prompt, VIEW.width / 2, y + h - 26, 16, PALETTE.gold, 'center');
  }

  function drawTitle(state, best, hasSave, time) {
    drawPanel('SOLMAR HEAT', [
      'An open-world crime story in Solmar Bay',
      'Steal cars. Outrun the law. Pull off the Big Score.',
      '5 missions · 6 districts · 10 hidden stashes · 32 locals · 20 traffic cars',
      hasSave ? 'A saved game is waiting for you.' : 'No save yet — a new story begins.',
      best > 0 ? `Best haul so far: $${best.toLocaleString('en-US')}` : '',
    ].filter((l) => l !== ''), hasSave ? 'Enter — Continue · N — New game' : 'Enter or click — Start a new game');
    text('WASD move · E steal / enter car · F punch · P pause · M mute', VIEW.width / 2, VIEW.height - 60, 15, PALETTE.hudMuted, 'center');
    text('Everything here is original — a city, story and people of our own.', VIEW.width / 2, VIEW.height - 34, 13, PALETTE.hudMuted, 'center');
  }

  /** Paint one frame: city, entities, HUD, then the screen overlay. */
  function draw(state, screen, missions, opts) {
    const { best, hasSave, muted } = opts;
    const time = state.time;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = PALETTE.backdrop;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Camera: follows the player in play; a slow pan over downtown on the title.
    let camX;
    let camY;
    if (screen === SCREEN_TITLE) {
      camX = 900 + Math.sin(time * 0.08) * 260 - VIEW.width / 2;
      camY = 800 + Math.cos(time * 0.06) * 120 - VIEW.height / 2;
    } else {
      camX = state.camera.x - VIEW.width / 2;
      camY = state.camera.y - VIEW.height / 2;
    }
    camX = Math.max(-40, Math.min(WORLD.width - VIEW.width + 40, camX));
    camY = Math.max(-40, Math.min(WORLD.height - VIEW.height + 40, camY));
    ctx.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    // Sun-soaked wash over everything.
    drawCity(state, camX, camY, time);
    ctx.fillStyle = 'rgba(255, 214, 130, 0.06)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    drawPickups(state, camX, camY, time);
    // Cars under the player, player car last among cars.
    const p = state.player;
    for (const car of state.cars) {
      if (p.inCar && car.id === p.carId) continue;
      if (car.x < camX - 80 || car.x > camX + VIEW.width + 80 || car.y < camY - 80 || car.y > camY + VIEW.height + 80) continue;
      drawCarShape(car, camX, camY, time);
    }
    for (const ped of state.peds) {
      if (ped.x < camX - 40 || ped.x > camX + VIEW.width + 40 || ped.y < camY - 40 || ped.y > camY + VIEW.height + 40) continue;
      drawPerson(ped.x, ped.y, ped.angle, ped.shirt, camX, camY, { walking: ped.mode !== 'down', down: ped.mode === 'down', time });
    }
    for (const cop of state.police) {
      if (cop.x < camX - 40 || cop.x > camX + VIEW.width + 40 || cop.y < camY - 40 || cop.y > camY + VIEW.height + 40) continue;
      drawPerson(cop.x, cop.y, cop.angle, '#1c2733', camX, camY, { walking: true, police: true, down: cop.down, time });
    }
    if (p.inCar) {
      const car = state.cars.find((c) => c.id === p.carId);
      if (car) drawCarShape(car, camX, camY, time);
    } else {
      const blink = p.invuln > 0 && Math.floor(time * 12) % 2 === 0;
      if (!blink) {
        drawPerson(p.x, p.y, p.faceAngle, PALETTE.playerShirt, camX, camY, { walking: p.moving, punchAnim: p.punchAnim, time });
      }
    }
    drawParticles(state, camX, camY);
    drawMarker(state, camX, camY, time, missions.marker());
    if (screen === SCREEN_TITLE) {
      ctx.fillStyle = 'rgba(8,14,20,0.45)';
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);
      drawTitle(state, best, hasSave, time);
      return;
    }
    drawHud(state, missions, time, muted);
    if (screen === SCREEN_PAUSED) {
      ctx.fillStyle = 'rgba(8,14,20,0.55)';
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);
      drawPanel('Paused', [
        `Money $${p.money.toLocaleString('en-US')} · Missions done ${state.stats.missionsDone} · Cars stolen ${state.stats.carsStolen} · Stashes ${state.stats.stashesFound}/${STASHES.count}`,
        'Your progress saves automatically after every mission.',
        'S — save now · P — resume · Q — quit to title',
      ], 'Press P to resume');
    } else if (screen === SCREEN_OVER) {
      ctx.fillStyle = 'rgba(20,4,4,0.55)';
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);
      drawPanel('WASTED', [
        `Ray went down in Solmar Bay. The city keeps moving.`,
        `Money $${p.money.toLocaleString('en-US')} · Missions done ${state.stats.missionsDone}`,
        'Hospital fee: $100. The current mission restarts.',
      ], 'Enter — back on the streets', PALETTE.danger);
    } else if (screen === SCREEN_BUSTED) {
      ctx.fillStyle = 'rgba(4,8,20,0.55)';
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);
      drawPanel('BUSTED', [
        'The Solmar Bay police finally got their hands on Ray.',
        `Money $${p.money.toLocaleString('en-US')} · Missions done ${state.stats.missionsDone}`,
        'Bail: $100. The current mission restarts.',
      ], 'Enter — back on the streets', '#2f7bff');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
