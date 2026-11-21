// SOLMAR HEAT — the painter. Nothing else in the game touches pixels.
// What lives here: the whole 3200-by-2400 bay as seen through a 1280-by-720
// window, every car and pedestrian crossing it, and the chrome ringing the
// frame — health and cash, wanted stars, the objective strip, the vault
// meter, the arrest warning, the minimap with its police dots, the feed,
// the speedometer, the hints, the banner, the talk box, and the title /
// pause / wasted / busted sheets. The simulation in world.js and the story
// in missions.js only hand over state; this module turns that state into
// pictures, one frame at a time, through a single scale-and-shift view
// transform so the picture stays identical at any window size. On the
// title screen the view drifts over downtown instead of chasing Ray.
import { districtAt } from "./world.js";
import {
  AIRSTRIP,
  BEACH_Y,
  CAR,
  FONT,
  FONT_DISPLAY,
  PALETTE,
  PLAYER,
  POLICE,
  ROADS_X,
  ROADS_Y,
  ROAD_W,
  STASHES,
  VIEW,
  WORLD,
} from "./config.js";

export const SCREEN_TITLE = "title";
export const SCREEN_PLAY = "play";
export const SCREEN_PAUSED = "paused";
export const SCREEN_OVER = "over";
export const SCREEN_BUSTED = "busted";

// Geometry the HUD is built from, in one spot so the objective strip, the
// minimap and the feed below it can never drift apart from each other.
const MINI_W = 190;
const MINI_H = 142;
const MINI_X = VIEW.width - MINI_W - 14;
const MINI_Y = 12;

export function createRenderer(canvasEl) {
  const g = canvasEl.getContext("2d");

  // How the 1280-by-720 view maps onto the real canvas: a letterbox fit.
  const viewport = { zoom: 1, ox: 0, oy: 0 };

  function resizeToWindow() {
    const density = window.devicePixelRatio || 1;
    const pxW = Math.round(window.innerWidth * density);
    const pxH = Math.round(window.innerHeight * density);
    canvasEl.width = pxW;
    canvasEl.height = pxH;
    viewport.zoom = Math.min(pxW / VIEW.width, pxH / VIEW.height);
    viewport.ox = (pxW - VIEW.width * viewport.zoom) / 2;
    viewport.oy = (pxH - VIEW.height * viewport.zoom) / 2;
  }

  // Small drawing tools shared by everything below.
  const fontMemo = new Map();
  let lastSpec = "";
  let lastAlign = "";
  function drawLabel(text, px, py, size, colour, align, face) {
    const memoKey = size + "|" + (face || FONT);
    let spec = fontMemo.get(memoKey);
    if (spec === undefined) {
      spec = size + "px " + (face || FONT);
      fontMemo.set(memoKey, spec);
    }
    // The canvas state only needs setting when it actually changes: this
    // runs dozens of times per frame, so skip the redundant assignments.
    if (spec !== lastSpec) {
      g.font = spec;
      lastSpec = spec;
    }
    g.fillStyle = colour;
    const wantAlign = align || "left";
    if (wantAlign !== lastAlign) {
      g.textAlign = wantAlign;
      lastAlign = wantAlign;
    }
    g.textBaseline = "alphabetic";
    g.fillText(text, px, py);
  }

  function roundedPath(rx, ry, rw, rh, rr) {
    g.beginPath();
    g.moveTo(rx + rr, ry);
    g.arcTo(rx + rw, ry, rx + rw, ry + rh, rr);
    g.arcTo(rx + rw, ry + rh, rx, ry + rh, rr);
    g.arcTo(rx, ry + rh, rx, ry, rr);
    g.arcTo(rx, ry, rx + rw, ry, rr);
    g.closePath();
  }

  function drawPanel(px, py, pw, ph, pr, fill) {
    g.fillStyle = fill;
    roundedPath(px, py, pw, ph, pr);
    g.fill();
  }

  // A centred sheet with a display-face heading, some lines and a prompt
  // along the bottom: the shape every full-screen overlay takes.
  function drawSheet(heading, rows, prompt, accent) {
    const sheetW = 640;
    const sheetH = 150 + rows.length * 32;
    const sheetX = (VIEW.width - sheetW) / 2;
    const sheetY = (VIEW.height - sheetH) / 2;
    drawPanel(sheetX, sheetY, sheetW, sheetH, 14, "rgba(10,16,22,0.88)");
    g.strokeStyle = accent || PALETTE.gold;
    g.lineWidth = 3;
    g.strokeRect(sheetX, sheetY, sheetW, sheetH);
    drawLabel(heading, VIEW.width / 2, sheetY + 62, 40, accent || PALETTE.title, "center", FONT_DISPLAY);
    rows.forEach((row, idx) => drawLabel(row, VIEW.width / 2, sheetY + 108 + idx * 32, 17, PALETTE.hudText, "center"));
    drawLabel(prompt, VIEW.width / 2, sheetY + sheetH - 26, 16, PALETTE.gold, "center");
  }

  function drawTitle(best, hasSave) {
    const rows = [
      "An open-world crime story in Solmar Bay",
      "Steal cars. Outrun the law. Pull off the Big Score.",
      "5 missions · 6 districts · 10 hidden stashes · 32 locals · 20 traffic cars",
      hasSave ? "A saved game is waiting for you." : "No save yet — a new story begins.",
      best > 0 ? "Best haul so far: $" + best.toLocaleString("en-US") : "",
    ].filter((row) => row !== "");
    const prompt = hasSave ? "Enter — Continue · N — New game" : "Enter or click — Start a new game";
    drawSheet("SOLMAR HEAT", rows, prompt);
    drawLabel("WASD move · E steal / enter car · F punch · P pause · M mute", VIEW.width / 2, VIEW.height - 60, 15, PALETTE.hudMuted, "center");
    drawLabel("Everything here is original — a city, story and people of our own.", VIEW.width / 2, VIEW.height - 34, 13, PALETTE.hudMuted, "center");
  }

  function drawOverlay(state, screen) {
    const hero = state.player;
    const moneyRow = "Money $" + hero.money.toLocaleString("en-US") + " · Missions done " + state.stats.missionsDone;
    if (SCREEN_PAUSED === screen) {
      g.fillStyle = "rgba(8,14,20,0.55)";
      g.fillRect(0, 0, VIEW.width, VIEW.height);
      drawSheet("Paused", [
        "Money $" + hero.money.toLocaleString("en-US") + " · Missions done " + state.stats.missionsDone + " · Cars stolen " + state.stats.carsStolen + " · Stashes " + state.stats.stashesFound + "/" + STASHES.count,
        "Your progress saves automatically after every mission.",
        "S — save now · P — resume · Q — quit to title",
      ], "Press P to resume");
    } else if (SCREEN_OVER === screen) {
      g.fillStyle = "rgba(20,4,4,0.55)";
      g.fillRect(0, 0, VIEW.width, VIEW.height);
      drawSheet("WASTED", [
        "Ray went down in Solmar Bay. The city keeps moving.",
        moneyRow,
        "Hospital fee: $100. The current mission restarts.",
      ], "Enter — back on the streets", PALETTE.danger);
    } else if (SCREEN_BUSTED === screen) {
      g.fillStyle = "rgba(4,8,20,0.55)";
      g.fillRect(0, 0, VIEW.width, VIEW.height);
      drawSheet("BUSTED", [
        "The Solmar Bay police finally got their hands on Ray.",
        moneyRow,
        "Bail: $100. The current mission restarts.",
      ], "Enter — back on the streets", "#2f7bff");
    }
  }

  // Top-left block: Ray's name, health, cash, any carried parcel, plus
  // the running tally of stashes found out of ten.
  function drawStatusBox(state) {
    const hero = state.player;
    drawPanel(14, 12, 330, 112, 10, PALETTE.hudPanel);
    drawLabel("RAY “VELA” CRUZ", 28, 38, 15, PALETTE.hudText, "left");
    g.fillStyle = "#222";
    roundedPath(28, 46, 180, 14, 7);
    g.fill();
    g.fillStyle = hero.hp > 30 ? PALETTE.health : PALETTE.danger;
    roundedPath(28, 46, Math.max(0, 180 * (hero.hp / PLAYER.maxHealth)), 14, 7);
    g.fill();
    drawLabel(String(Math.ceil(hero.hp)), 216, 59, 14, PALETTE.hudText, "left");
    drawLabel("$" + hero.money.toLocaleString("en-US"), 28, 88, 20, PALETTE.money, "left");
    if (state.packageCarried) {
      drawLabel("📦 PACKAGE", 150, 88, 15, PALETTE.gold, "left");
    }
    drawLabel("STASH " + state.stats.stashesFound + "/" + STASHES.count, 28, 110, 13, PALETTE.stash, "left");
  }

  // Five stars across the top middle, blinking whenever heat is on.
  function drawStars(state, t) {
    const heat = state.wantedLevel;
    drawPanel(VIEW.width / 2 - 110, 12, 220, 44, 10, PALETTE.hudPanel);
    for (let idx = 0; idx < 5; idx++) {
      const blinking = heat > 0 && Math.floor(t * 3) % 2 === 0;
      const starColour = idx < heat ? (blinking ? "#ffd60a" : "#ff9d00") : "rgba(245,241,230,0.25)";
      drawLabel("★", VIEW.width / 2 - 88 + idx * 40, 44, 28, starColour, "left");
    }
  }

  // The objective strip under the stars, carrying the mission counter.
  function drawObjectiveStrip(missions) {
    const tally = missions.missionCounter();
    const goal = (tally ? tally + " — " : "") + missions.currentObjective();
    const stripW = Math.min(680, 40 + goal.length * 8.4);
    drawPanel(VIEW.width / 2 - stripW / 2, 88, stripW, 34, 8, PALETTE.hudPanel);
    drawLabel("◆ " + goal, VIEW.width / 2, 111, 15, PALETTE.hudText, "center");
  }

  // The little map in the top-right corner: land, sea, roads, buildings,
  // the airstrip, the mission marker, red dots for police and Ray in the
  // middle. The line under it names the district Ray is standing in.
  function drawMiniMap(state, missions) {
    const scaleX = MINI_W / WORLD.width;
    const scaleY = MINI_H / WORLD.height;
    drawPanel(MINI_X - 6, MINI_Y - 6, MINI_W + 12, MINI_H + 12, 10, "rgba(10,16,22,0.78)");
    g.fillStyle = "#7d9b6d";
    g.fillRect(MINI_X, MINI_Y, MINI_W, MINI_H);
    g.fillStyle = PALETTE.sea;
    g.fillRect(MINI_X, MINI_Y + BEACH_Y * scaleY, MINI_W, MINI_H - BEACH_Y * scaleY);
    g.fillStyle = "#3a3f46";
    for (const avenue of ROADS_X) {
      g.fillRect(MINI_X + avenue * scaleX - 1, MINI_Y, 2, MINI_H);
    }
    for (const street of ROADS_Y) {
      g.fillRect(MINI_X, MINI_Y + street * scaleY, MINI_W, 2);
    }
    g.fillStyle = "#c96f4a";
    for (const block of state.buildings) {
      g.fillRect(MINI_X + block.x * scaleX, MINI_Y + block.y * scaleY, Math.max(1, block.w * scaleX), Math.max(1, block.h * scaleY));
    }
    g.fillStyle = PALETTE.runway;
    g.fillRect(MINI_X + AIRSTRIP.x * scaleX, MINI_Y + AIRSTRIP.y * scaleY, Math.max(2, AIRSTRIP.w * scaleX), Math.max(2, AIRSTRIP.h * scaleY));
    const pin = missions.marker();
    if (pin) {
      g.fillStyle = PALETTE.marker;
      g.beginPath();
      g.arc(MINI_X + pin.x * scaleX, MINI_Y + pin.y * scaleY, 5, 0, Math.PI * 2);
      g.fill();
    }
    for (const auto of state.cars) {
      if (auto.police) {
        g.fillStyle = "#ff3b30";
        g.beginPath();
        g.arc(MINI_X + auto.x * scaleX, MINI_Y + auto.y * scaleY, 3, 0, Math.PI * 2);
        g.fill();
      }
    }
    const hero = state.player;
    g.fillStyle = "#ffffff";
    g.beginPath();
    g.arc(MINI_X + hero.x * scaleX, MINI_Y + hero.y * scaleY, 4, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = PALETTE.player;
    g.beginPath();
    g.arc(MINI_X + hero.x * scaleX, MINI_Y + hero.y * scaleY, 2.5, 0, Math.PI * 2);
    g.fill();
    drawLabel(districtAt(hero.x, hero.y), MINI_X + MINI_W / 2, MINI_Y + MINI_H + 18, 11, PALETTE.district, "center");
  }

  // Killfeed under the minimap: newest first, fading as entries age.
  function drawKillFeed(state) {
    const entries = state.feed;
    entries.forEach((entry, idx) => {
      g.globalAlpha = Math.max(0.25, Math.min(1, entry.ttl / 2));
      drawLabel(entry.text, VIEW.width - 14, MINI_Y + MINI_H + 42 + idx * 20, 13, PALETTE.feed, "right");
    });
    g.globalAlpha = 1;
  }

  // Speed readout at bottom right, shown only while Ray drives.
  function drawSpeed(state) {
    const hero = state.player;
    if (hero.inCar === false) {
      return undefined;
    }
    const auto = state.cars.find((c) => c.id === hero.carId);
    const kmh = auto ? Math.round(Math.abs(auto.speed) * 0.24) : 0;
    drawPanel(VIEW.width - 154, VIEW.height - 66, 140, 52, 10, PALETTE.hudPanel);
    drawLabel(String(kmh), VIEW.width - 84, VIEW.height - 26, 30, PALETTE.hudText, "center");
    drawLabel("km/h", VIEW.width - 84, VIEW.height - 12, 11, PALETTE.hudMuted, "center");
  }

  // The large centred banner for missions, fading in and out.
  function drawBanner(missions) {
    const banner = missions.state["banner"];
    if (banner === null || banner === undefined) {
      return undefined;
    }
    g.globalAlpha = Math.min(1, banner.timer);
    drawPanel(VIEW.width / 2 - 300, 210, 600, 76, 12, "rgba(10,16,22,0.8)");
    drawLabel(banner.text, VIEW.width / 2, 244, 30, PALETTE.title, "center", FONT_DISPLAY);
    drawLabel(banner.sub, VIEW.width / 2, 272, 16, PALETTE.hudText, "center");
    g.globalAlpha = 1;
  }

  // The dialogue box at the bottom while Rico is talking.
  function drawTalkBox(missions) {
    const dlg = missions.state["dialogue"];
    if (dlg === null || dlg === undefined) {
      return undefined;
    }
    drawPanel(180, VIEW.height - 128, VIEW.width - 360, 64, 10, "rgba(10,16,22,0.85)");
    g.strokeStyle = PALETTE.gold;
    g.lineWidth = 2;
    g.strokeRect(180, VIEW.height - 128, VIEW.width - 360, 64);
    drawLabel(dlg.lines[dlg.lineIndex], VIEW.width / 2, VIEW.height - 92, 16, "#fff7d6", "center");
    drawLabel("Enter — next", VIEW.width - 200, VIEW.height - 76, 12, PALETTE.hudMuted, "right");
  }

  function drawHud(state, missions, t, muted) {
    drawStatusBox(state);
    drawStars(state, t);
    drawObjectiveStrip(missions);
    if (0 < state.vaultProgress) {
      drawPanel(VIEW.width / 2 - 130, 124, 260, 22, 8, PALETTE.hudPanel);
      g.fillStyle = PALETTE.gold;
      roundedPath(VIEW.width / 2 - 124, 129, 248 * state.vaultProgress, 12, 6);
      g.fill();
      drawLabel("CRACKING THE VAULT…", VIEW.width / 2, 162, 13, PALETTE.hudText, "center");
    }
    if (0.2 < state.arrestProgress) {
      drawLabel("⚠ THEY ARE GRABBING YOU — MOVE!", VIEW.width / 2, 190, 16, PALETTE.danger, "center");
    }
    drawMiniMap(state, missions);
    drawKillFeed(state);
    drawSpeed(state);
    drawLabel("WASD drive/walk · E enter/steal car · F punch · Shift sprint · P pause · M mute", 16, VIEW.height - 14, 13, "rgba(245,241,230,0.75)", "left");
    if (muted) {
      drawLabel("🔇 MUTED", VIEW.width - 16, VIEW.height - 84, 13, PALETTE.hudMuted, "right");
    }
    drawBanner(missions);
    drawTalkBox(missions);
  }

  // Warm earth first, then the southern sea and its strip of sand.
  function drawTerrain(viewX, viewY, t) {
    g.fillStyle = "#c8b18a";
    g.fillRect(0, 0, VIEW.width, VIEW.height);
    const shore = 90 + BEACH_Y;
    if (shore - viewY >= VIEW.height) {
      return undefined;
    }
    g.fillStyle = PALETTE.sea;
    g.fillRect(0, shore - viewY, VIEW.width, WORLD.height - shore);
    g.fillStyle = PALETTE.seaDeep;
    for (let wave = 0; wave < 5; wave++) {
      const waveY = shore + 20 + wave * 34 + Math.sin(t * 0.7 + wave * 2) * 4 - viewY;
      g.fillRect((wave * 317) % 900, waveY, 260, 5);
    }
    g.fillStyle = PALETTE.sand;
    g.fillRect(0, BEACH_Y - viewY, VIEW.width, 90);
  }

  // The beachfront runway the final mission escapes from, dashed centre
  // line and all, plus the green park with its crossing paths.
  function drawStripPark(state, viewX, viewY) {
    const strip = state["airstrip"];
    g.fillStyle = PALETTE.runway;
    g.fillRect(strip.x - viewX, strip.y - viewY, strip.w, strip.h);
    g.fillStyle = PALETTE.runwayLine;
    for (let dashX = strip.x + 12; dashX < strip.x + strip.w - 12; dashX += 28) {
      g.fillRect(dashX - viewX, strip.y + strip.h / 2 - 2 - viewY, 16, 4);
    }
    drawLabel("AIRSTRIP", strip.x + strip.w / 2 - viewX, strip.y + strip.h + 18 - viewY, 12, "#5a4632", "center");
    const park = state["park"];
    g.fillStyle = PALETTE.grass;
    g.fillRect(park.x - viewX, park.y - viewY, park.w, park.h);
    g.fillStyle = PALETTE.parkPath;
    g.fillRect(park.x + park.w / 2 - 10 - viewX, park.y - viewY, 20, park.h);
    g.fillRect(park.x - viewX, park.y + park.h / 2 - 10 - viewY, park.w, 20);
  }

  // Sidewalks, asphalt, centre dashes and the zebra stripes at crossings.
  function drawRoads(viewX, viewY) {
    g.fillStyle = PALETTE.sidewalk;
    for (const avenue of ROADS_X) {
      g.fillRect(avenue - ROAD_W / 2 - 14 - viewX, -viewY, ROAD_W + 28, WORLD.height);
    }
    for (const street of ROADS_Y) {
      g.fillRect(-viewX, street - ROAD_W / 2 - 14 - viewY, WORLD.width, ROAD_W + 28);
    }
    g.fillStyle = PALETTE.road;
    for (const avenue of ROADS_X) {
      g.fillRect(avenue - ROAD_W / 2 - viewX, -viewY, ROAD_W, WORLD.height);
    }
    for (const street of ROADS_Y) {
      g.fillRect(-viewX, street - ROAD_W / 2 - viewY, WORLD.width, ROAD_W);
    }
    g.fillStyle = PALETTE.roadLine;
    for (const avenue of ROADS_X) {
      for (let along = 0; along < WORLD.height; along += 56) {
        g.fillRect(avenue - 2 - viewX, along - viewY, 4, 28);
      }
    }
    for (const street of ROADS_Y) {
      for (let along = 0; along < WORLD.width; along += 56) {
        g.fillRect(along - viewX, street - 2 - viewY, 28, 4);
      }
    }
    g.fillStyle = "rgba(245,241,230,0.85)";
    for (const avenue of ROADS_X) {
      for (const street of ROADS_Y) {
        for (let stripe = -3; stripe <= 3; stripe++) {
          g.fillRect(avenue + stripe * 13 - 4 - viewX, street - ROAD_W / 2 - 8 - viewY, 8, 14);
          g.fillRect(avenue + stripe * 13 - 4 - viewX, street + ROAD_W / 2 - 6 - viewY, 8, 14);
        }
      }
    }
  }

  // One block: a soft shadow toward the sun, the roof, a bright top edge
  // and its windows, some of them lit. Off-screen blocks are skipped.
  function drawBuilding(block, viewX, viewY) {
    const bx = block.x - viewX;
    const by = block.y - viewY;
    const offscreen = bx > VIEW.width || by > VIEW.height || bx + block.w < 0 || by + block.h < 0;
    if (offscreen) {
      return undefined;
    }
    g.fillStyle = "rgba(60,40,20,0.25)";
    g.fillRect(bx + 10, by + 12, block.w, block.h);
    g.fillStyle = block.color;
    g.fillRect(bx, by, block.w, block.h);
    g.strokeStyle = PALETTE.buildingEdge;
    g.lineWidth = 3;
    g.strokeRect(bx + 1, by + 1, block.w - 2, block.h - 2);
    g.fillStyle = "rgba(255,255,255,0.18)";
    g.fillRect(bx + 6, by + 6, block.w - 12, 10);
    for (const win of block.windows) {
      g.fillStyle = win.lit ? PALETTE.windowLit : PALETTE.windowDark;
      g.fillRect(win.x - viewX, win.y - viewY, 12, 10);
    }
    if (block.label) {
      drawLabel(block.label, bx + block.w / 2, by + block.h / 2, 13, "#2c241c", "center");
    }
  }

  // A palm: a leaning trunk and five fronds fanning from the crown.
  function drawPalmTree(palm, viewX, viewY) {
    const px = palm.x - viewX;
    const py = palm.y - viewY;
    const outside = px < -20 || px > VIEW.width + 20 || py < -20 || py > VIEW.height + 20;
    if (outside) {
      return undefined;
    }
    g.strokeStyle = "#7a5a34";
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(px, py);
    g.lineTo(px + 3, py - 16);
    g.stroke();
    g.fillStyle = "#2f8f4e";
    for (let frond = 0; frond < 5; frond++) {
      const ang = (frond / 5) * Math.PI * 2 + 0.4;
      g.beginPath();
      g.ellipse(px + 3 + Math.cos(ang) * 10, py - 18 + Math.sin(ang) * 6, 12, 4, ang, 0, Math.PI * 2);
      g.fill();
    }
  }

  function drawCity(state, viewX, viewY, t) {
    drawTerrain(viewX, viewY, t);
    drawStripPark(state, viewX, viewY);
    drawRoads(viewX, viewY);
    for (const block of state.buildings) {
      drawBuilding(block, viewX, viewY);
    }
    for (const palm of state.palms) {
      drawPalmTree(palm, viewX, viewY);
    }
    drawLabel("SOLMAR BAY", 90 - viewX, 60 - viewY, 15, "#5a4632", "left");
    drawLabel("PALMA AVE", 1252 - viewX, 250 - viewY, 13, "rgba(245,241,230,0.9)", "left");
  }

  // A car from above: shadow, body, dark glass, pale roof shine, lights
  // fore and aft. Taxis, cruisers and the sport Comet get extra trim.
  function drawAuto(auto, viewX, viewY, t) {
    const cx = auto.x - viewX;
    const cy = auto.y - viewY;
    g.save();
    g.translate(cx, cy);
    g.rotate(auto.angle);
    const len = CAR.length;
    const wid = CAR.width;
    g.fillStyle = "rgba(0,0,0,0.28)";
    roundedPath(-len / 2 + 4, -wid / 2 + 5, len, wid, 8);
    g.fill();
    g.fillStyle = auto.color;
    roundedPath(-len / 2, -wid / 2, len, wid, 9);
    g.fill();
    g.fillStyle = "rgba(20,30,44,0.85)";
    roundedPath(-len / 2 + 14, -wid / 2 + 5, 16, wid - 10, 4);
    g.fill();
    g.fillStyle = "rgba(255,255,255,0.25)";
    roundedPath(-len / 2 + 16, -wid / 2 + 6, 12, wid - 12, 3);
    g.fill();
    g.fillStyle = "#ffe9a8";
    g.fillRect(len / 2 - 4, -wid / 2 + 3, 3, 6);
    g.fillRect(len / 2 - 4, wid / 2 - 9, 3, 6);
    g.fillStyle = "#ff4b3e";
    g.fillRect(-len / 2 + 1, -wid / 2 + 3, 3, 6);
    g.fillRect(-len / 2 + 1, wid / 2 - 9, 3, 6);
    if (auto.kind === "taxi") {
      drawLabel("TAXI", 0, 4, 10, "#1c2733", "center");
      g.fillStyle = "#f2c94c";
      g.fillRect(-8, -wid / 2 - 5, 16, 5);
    }
    if (auto.kind === "police") {
      g.fillStyle = "#f5f1e6";
      g.fillRect(-len / 2 + 4, -wid / 2 + 2, len - 8, 5);
      drawLabel("POLICE", 0, 4, 10, "#f5f1e6", "center");
      const redLit = Math.floor(t * 4) % 2 === 0;
      g.fillStyle = redLit ? PALETTE.policeLight : PALETTE.policeLightBlue;
      g.beginPath();
      g.arc(-6, -wid / 2 - 2, 5, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = redLit ? PALETTE.policeLightBlue : PALETTE.policeLight;
      g.beginPath();
      g.arc(6, -wid / 2 - 2, 5, 0, Math.PI * 2);
      g.fill();
    }
    if (auto.kind === "sport") {
      g.fillStyle = "rgba(0,0,0,0.25)";
      g.fillRect(-len / 2 + 2, -wid / 2 + 8, len - 4, 3);
    }
    g.restore();
  }

  // A person seen from above: shadow, shirt, legs, head and hair. Cops
  // wear a dark cap. A knocked-out person lies flat instead, head to one
  // side. The options carry walking, down, police, punchAnim and time.
  function drawPerson(px, py, heading, shirt, viewX, viewY, opts = {}) {
    const sx = px - viewX;
    const sy = py - viewY;
    const bob = opts.walking ? 1.5 * Math.sin(opts.time * 10) : 0;
    g.save();
    g.translate(sx, sy + bob);
    g.rotate(heading + Math.PI / 2);
    if (opts.down === true) {
      g.rotate(Math.PI / 2);
      g.fillStyle = shirt;
      roundedPath(-13, -7, 26, 14, 6);
      g.fill();
      g.fillStyle = PALETTE.playerSkin;
      g.beginPath();
      g.arc(16, 0, 6, 0, Math.PI * 2);
      g.fill();
      g.restore();
      return undefined;
    }
    g.fillStyle = "rgba(0,0,0,0.25)";
    g.beginPath();
    g.ellipse(0, 4, 11, 8, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = shirt;
    roundedPath(-9, -8, 18, 22, 7);
    g.fill();
    g.fillStyle = "#2c3e50";
    roundedPath(-8, 12, 16, 6, 3);
    g.fill();
    g.fillStyle = PALETTE.playerSkin;
    g.beginPath();
    g.arc(0, -13, 8, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = opts.police ? "#1c2733" : "#3a2a1a";
    g.beginPath();
    g.arc(0, -15, 8, Math.PI, 0);
    g.fill();
    if (opts.police === true) {
      g.fillStyle = "#1c2733";
      g.fillRect(-9, -19, 18, 5);
    }
    if (0 < opts.punchAnim) {
      g.strokeStyle = "#ffffff";
      g.lineWidth = 4;
      g.beginPath();
      g.arc(0, -22, 12, -0.6, 0.6);
      g.stroke();
    }
    g.restore();
  }

  function drawPickups(state, viewX, viewY, t) {
    for (const item of state.pickups) {
      if (item.active === false) {
        continue;
      }
      const px = item.x - viewX;
      const py = item.y - viewY + Math.sin(t * 3 + item.bob) * 2;
      const outside = px < -20 || px > VIEW.width + 20 || py < -20 || py > VIEW.height + 20;
      if (outside) {
        continue;
      }
      if (item.kind === "cash") {
        g.fillStyle = "#1e7d32";
        roundedPath(px - 13, py - 8, 26, 16, 2);
        g.fill();
        drawLabel("$", px, py + 5, 13, "#a5f2b0", "center");
      } else if (item.kind === "stash") {
        // A stash: a green duffel bag with a gold clasp, larger than cash.
        g.fillStyle = "#1e5d32";
        roundedPath(px - 15, py - 10, 30, 20, 6);
        g.fill();
        g.strokeStyle = PALETTE.gold;
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(px - 15, py);
        g.lineTo(px + 15, py);
        g.stroke();
        g.fillStyle = PALETTE.gold;
        g.fillRect(px - 3, py - 4, 6, 8);
        drawLabel("$", px, py - 14, 12, PALETTE.gold, "center");
      } else if (item.kind !== "cash" && item.kind !== "stash") {
        g.fillStyle = "#f5f1e6";
        roundedPath(px - 11, py - 11, 22, 22, 5);
        g.fill();
        g.fillStyle = "#e5534b";
        g.fillRect(px - 3, py - 8, 6, 16);
        g.fillRect(px - 8, py - 3, 16, 6);
      }
    }
  }

  function drawParticles(state, viewX, viewY) {
    for (const spark of state.particles) {
      g.globalAlpha = Math.max(0, spark.life / spark.maxLife);
      g.fillStyle = spark.color;
      g.fillRect(spark.x - viewX - spark.size / 2, spark.y - viewY - spark.size / 2, spark.size, spark.size);
    }
    g.globalAlpha = 1;
  }

  // The pulsing gold diamond over the current objective. When the target
  // is off the screen, an arrow hugs the screen edge and points at it.
  function drawTargetPin(state, viewX, viewY, t, pin) {
    if (pin === null || pin === undefined) {
      return undefined;
    }
    const mx = pin.x - viewX;
    const my = pin.y - viewY;
    const pulse = 1 + Math.sin(t * 5) * 0.15;
    const visible = mx > -40 && mx < VIEW.width + 40 && my > -40 && my < VIEW.height + 40;
    if (visible) {
      g.save();
      g.translate(mx, my);
      g.scale(pulse, pulse);
      g.fillStyle = PALETTE.marker;
      g.strokeStyle = "#7a5a00";
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(0, -26);
      g.lineTo(18, 0);
      g.lineTo(0, 26);
      g.lineTo(-18, 0);
      g.closePath();
      g.fill();
      g.stroke();
      g.fillStyle = "#7a5a00";
      g.beginPath();
      g.arc(0, 0, 5, 0, Math.PI * 2);
      g.fill();
      g.restore();
      drawLabel(pin.label, mx, my - 36, 15, "#fff7d6", "center");
      return undefined;
    }
    const centreX = VIEW.width / 2;
    const centreY = VIEW.height / 2;
    const ang = Math.atan2(my - centreY, mx - centreX);
    const edgeX = centreX + Math.cos(ang) * 560;
    const edgeY = centreY + Math.sin(ang) * 300;
    g.save();
    g.translate(Math.max(30, Math.min(VIEW.width - 30, edgeX)), Math.max(30, Math.min(VIEW.height - 30, edgeY)));
    g.rotate(ang);
    g.fillStyle = PALETTE.marker;
    g.beginPath();
    g.moveTo(18, 0);
    g.lineTo(-10, -12);
    g.lineTo(-10, 12);
    g.closePath();
    g.fill();
    g.restore();
  }

  // Paint one frame: city, entities, HUD, then the screen overlay.
  function paintFrame(state, screen, missions, opts) {
    const best = opts.best;
    const hasSave = opts.hasSave;
    const muted = opts.muted;
    const t = state.time;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = PALETTE.backdrop;
    g.fillRect(0, 0, canvasEl.width, canvasEl.height);
    // Camera: follows the player in play; a slow pan over downtown on title.
    let viewX;
    let viewY;
    if (SCREEN_TITLE === screen) {
      viewX = 900 + Math.sin(t * 0.08) * 260 - VIEW.width / 2;
      viewY = 800 + Math.cos(t * 0.06) * 120 - VIEW.height / 2;
    }
    if (SCREEN_TITLE !== screen) {
      viewX = state.camera.x - VIEW.width / 2;
      viewY = state.camera.y - VIEW.height / 2;
    }
    viewX = Math.max(-40, Math.min(WORLD.width - VIEW.width + 40, viewX));
    viewY = Math.max(-40, Math.min(WORLD.height - VIEW.height + 40, viewY));
    g.setTransform(viewport.zoom, 0, 0, viewport.zoom, viewport.ox, viewport.oy);
    // A sun-warmed wash laid over the whole scene.
    drawCity(state, viewX, viewY, t);
    g.fillStyle = "rgba(255, 214, 130, 0.06)";
    g.fillRect(0, 0, VIEW.width, VIEW.height);
    drawPickups(state, viewX, viewY, t);
    // Other cars first; the player's own car is painted last.
    const hero = state.player;
    for (const auto of state.cars) {
      const isHeroCar = hero.inCar && auto.id === hero.carId;
      const farAway = auto.x < viewX - 80 || auto.x > viewX + VIEW.width + 80 || auto.y < viewY - 80 || auto.y > viewY + VIEW.height + 80;
      if (isHeroCar || farAway) {
        continue;
      }
      drawAuto(auto, viewX, viewY, t);
    }
    for (const walker of state.peds) {
      const farAway = walker.x < viewX - 40 || walker.x > viewX + VIEW.width + 40 || walker.y < viewY - 40 || walker.y > viewY + VIEW.height + 40;
      if (farAway) {
        continue;
      }
      drawPerson(walker.x, walker.y, walker.angle, walker.shirt, viewX, viewY, { walking: walker.mode !== "down", down: walker.mode === "down", time: t });
    }
    for (const officer of state.police) {
      const farAway = officer.x < viewX - 40 || officer.x > viewX + VIEW.width + 40 || officer.y < viewY - 40 || officer.y > viewY + VIEW.height + 40;
      if (farAway) {
        continue;
      }
      drawPerson(officer.x, officer.y, officer.angle, "#1c2733", viewX, viewY, { walking: true, police: true, down: officer.down, time: t });
    }
    if (hero.inCar) {
      const auto = state.cars.find((c) => c.id === hero.carId);
      if (auto) {
        drawAuto(auto, viewX, viewY, t);
      }
    } else if (hero.inCar === false) {
      const blinking = hero.invuln > 0 && Math.floor(t * 12) % 2 === 0;
      if (blinking === false) {
        drawPerson(hero.x, hero.y, hero.faceAngle, PALETTE.playerShirt, viewX, viewY, { walking: hero.moving, punchAnim: hero.punchAnim, time: t });
      }
    }
    drawParticles(state, viewX, viewY);
    drawTargetPin(state, viewX, viewY, t, missions.marker());
    if (SCREEN_TITLE === screen) {
      g.fillStyle = "rgba(8,14,20,0.45)";
      g.fillRect(0, 0, VIEW.width, VIEW.height);
      drawTitle(best, hasSave);
      return undefined;
    }
    drawHud(state, missions, t, muted);
    drawOverlay(state, screen);
  }

  resizeToWindow();
  window.addEventListener("resize", resizeToWindow);
  return { draw: paintFrame };
}
