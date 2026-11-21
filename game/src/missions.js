// Missions and story for SOLMAR HEAT.
// Five chained jobs for Ray "Vela" Cruz, a driver fresh out of Solmar Bay's
// impound lot, working for fixer Rico Marín. Pure data + a small tracker that
// reads world.state and reports events; it never draws anything.
export const MISSIONS = [
  {
    id: 'hot-wheels',
    title: '1 — Hot Wheels',
    reward: 500,
    briefing: [
      'RICO: Ray! You are out. Good. I need wheels, fast.',
      'RICO: A yellow Comet is parked on Palma Avenue. Take it.',
      'RICO: Then bring it to my garage. Do not scratch it.',
    ],
    steps: [
      { text: 'Find the yellow Comet on Palma Ave', target: { x: 1290, y: 1000, label: 'Comet' }, radius: 80, action: 'reach' },
      { text: 'Steal the Comet — press E next to it', target: { x: 1290, y: 1000, label: 'Comet' }, radius: 90, action: 'steal', carId: 'comet' },
      { text: 'Drive the Comet to Rico’s Garage', target: { x: 700, y: 620, label: 'Garage' }, radius: 100, action: 'reach' },
    ],
  },
  {
    id: 'the-courier',
    title: '2 — The Courier',
    reward: 800,
    briefing: [
      'RICO: The Comet sells itself. Now a real job.',
      'RICO: A package waits at Solmar Marina, south docks.',
      'RICO: Pick it up and bring it to the safehouse. No cops.',
    ],
    steps: [
      { text: 'Pick up the package at Solmar Marina', target: { x: 2740, y: 2050, label: 'Marina' }, radius: 80, action: 'reach' },
      { text: 'Deliver the package to the safehouse', target: { x: 300, y: 260, label: 'Safehouse' }, radius: 90, action: 'reach' },
    ],
  },
  {
    id: 'heat-wave',
    title: '3 — Heat Wave',
    reward: 1000,
    briefing: [
      'RICO: Bad news. The marina was watched. Cops are on you.',
      'RICO: Lose them. Lay low, break line of sight, wait it out.',
      'RICO: When the heat is gone, come back to me.',
    ],
    steps: [
      { text: 'Lose the wanted level — hide from the police', target: null, radius: 0, action: 'evade' },
      { text: 'Heat gone. Return to Rico’s Garage', target: { x: 700, y: 620, label: 'Garage' }, radius: 100, action: 'reach' },
    ],
  },
  {
    id: 'the-big-score',
    title: '4 — The Big Score',
    reward: 3000,
    briefing: [
      'RICO: One last job, then we are legends. Solmar National Bank.',
      'RICO: Hold E at the vault door until it opens. Grab the cash.',
      'RICO: Then run — every cop in the city will want a piece.',
    ],
    steps: [
      { text: 'Reach the vault at Solmar National Bank', target: { x: 1740, y: 700, label: 'Bank' }, radius: 90, action: 'reach' },
      { text: 'Hold E to crack the vault', target: { x: 1740, y: 700, label: 'Vault' }, radius: 90, action: 'hold', holdTime: 3 },
      { text: 'Escape with the cash — reach the safehouse', target: { x: 300, y: 260, label: 'Safehouse' }, radius: 90, action: 'reach' },
    ],
  },
  {
    id: 'clean-slate',
    title: '5 — Clean Slate',
    reward: 1500,
    briefing: [
      'RICO: The bank job put your face on every screen in Solmar Bay.',
      'RICO: Four stars. A plane waits on the Beachfront airstrip.',
      'RICO: Reach it with the heat on you, then shake the cops and vanish.',
    ],
    steps: [
      { text: 'Reach the Beachfront airstrip — wanted level 4', target: { x: 2960, y: 2220, label: 'Airstrip' }, radius: 110, action: 'reach' },
      { text: 'Lose the wanted level — hide from the police', target: null, radius: 0, action: 'evade' },
      { text: 'Heat gone. Reach the safehouse to disappear', target: { x: 300, y: 260, label: 'Safehouse' }, radius: 90, action: 'reach' },
    ],
  },
];

export function createMissions(world) {
  const state = {
    index: 0,
    stepIndex: 0,
    active: false,
    finished: false,
    holdTimer: 0,
    dialogue: null, // {lines, lineIndex, timer}
    banner: null, // {text, sub, timer}
  };

  function mission() {
    return MISSIONS[state.index] ?? null;
  }

  function stepDef() {
    const m = mission();
    return m ? m.steps[state.stepIndex] ?? null : null;
  }

  function showDialogue(lines) {
    state.dialogue = { lines, lineIndex: 0, timer: 0 };
  }

  function showBanner(text, sub) {
    state.banner = { text, sub: sub ?? '', timer: 3.2 };
  }

  function startMission(index) {
    state.index = index;
    state.stepIndex = 0;
    state.active = true;
    state.holdTimer = 0;
    const m = mission();
    showDialogue(m.briefing);
    showBanner(m.title, 'New mission — ' + m.steps[0].text);
    if (m.id === 'heat-wave') world.setWanted(2);
    if (m.id === 'the-big-score') world.setWanted(0);
    if (m.id === 'clean-slate') world.setWanted(4);
    return { type: 'mission-start', mission: m.id };
  }

  function completeMission() {
    const m = mission();
    world.state.player.money += m.reward;
    world.state.stats.missionsDone += 1;
    world.addFeed(`Mission complete — ${m.title} +$${m.reward}`);
    showBanner('Mission complete', `${m.title} — +$${m.reward}`);
    const events = [{ type: 'mission-complete', mission: m.id, reward: m.reward }];
    state.active = false;
    if (state.index + 1 < MISSIONS.length) {
      events.push(startMission(state.index + 1));
    } else {
      state.finished = true;
      showBanner('Story complete', 'Solmar Bay is yours, Ray. Free roam — keep the heat low.');
      events.push({ type: 'story-complete' });
    }
    return events;
  }

  /** Advance dialogue lines; returns true while a dialogue is showing. */
  function advanceDialogue() {
    if (!state.dialogue) return false;
    state.dialogue.lineIndex += 1;
    if (state.dialogue.lineIndex >= state.dialogue.lines.length) state.dialogue = null;
    return state.dialogue !== null;
  }

  function currentObjective() {
    if (!state.active) return state.finished ? 'Story complete — free roam Solmar Bay' : 'No mission yet';
    const s = stepDef();
    return s ? s.text : '';
  }

  /** "MISSION 3/5" for the HUD, or "" when no mission is running. */
  function missionCounter() {
    if (!state.active) return '';
    return `MISSION ${state.index + 1}/${MISSIONS.length}`;
  }

  function marker() {
    if (!state.active) return null;
    const s = stepDef();
    return s && s.target ? s.target : null;
  }

  /**
   * One step. `interactHeld` is true while E is held (vault cracking).
   * Returns an array of event objects for the caller (audio / announcements).
   */
  function update(dt, interactHeld) {
    const events = [];
    if (state.banner) {
      state.banner.timer -= dt;
      if (state.banner.timer <= 0) state.banner = null;
    }
    if (state.dialogue) {
      state.dialogue.timer += dt;
      if (state.dialogue.timer > 7) advanceDialogue();
    }
    if (!state.active) return events;
    const s = stepDef();
    if (!s) return events;
    const p = world.state.player;
    if (s.action === 'reach') {
      const d2 = (p.x - s.target.x) ** 2 + (p.y - s.target.y) ** 2;
      if (d2 < s.radius * s.radius) {
        if (s.target.label === 'Marina') world.state.packageCarried = true;
        state.stepIndex += 1;
        events.push({ type: 'step-done', text: s.text });
        if (state.stepIndex >= mission().steps.length) events.push(...completeMission());
        else showBanner(mission().title, mission().steps[state.stepIndex].text);
      }
    } else if (s.action === 'steal') {
      const car = world.carById(s.carId);
      if (car && p.inCar && p.carId === s.carId) {
        state.stepIndex += 1;
        events.push({ type: 'step-done', text: 'Comet stolen' });
        showBanner(mission().title, mission().steps[state.stepIndex].text);
      }
    } else if (s.action === 'evade') {
      if (world.state.wantedLevel === 0) {
        state.stepIndex += 1;
        events.push({ type: 'step-done', text: 'Heat lost' });
        showBanner(mission().title, mission().steps[state.stepIndex].text);
      }
    } else if (s.action === 'hold') {
      const d2 = (p.x - s.target.x) ** 2 + (p.y - s.target.y) ** 2;
      if (!p.inCar && d2 < s.radius * s.radius && interactHeld) {
        state.holdTimer += dt;
        world.state.vaultProgress = state.holdTimer / s.holdTime;
        if (state.holdTimer >= s.holdTime) {
          world.state.vaultProgress = 0;
          world.state.packageCarried = true;
          world.setWanted(3);
          state.stepIndex += 1;
          events.push({ type: 'step-done', text: 'Vault cracked — $300,000 in the bag' });
          showBanner('The Big Score', 'Every cop in Solmar Bay is coming. Run!');
        }
      } else {
        state.holdTimer = Math.max(0, state.holdTimer - dt * 2);
        world.state.vaultProgress = state.holdTimer / s.holdTime;
      }
    }
    return events;
  }

  return {
    state,
    mission,
    startMission,
    completeMission,
    advanceDialogue,
    currentObjective,
    missionCounter,
    marker,
    update,
    showBanner,
    showDialogue,
  };
}
