// Story jobs for SOLMAR HEAT. Five chained jobs for Ray "Vela" Cruz, a
// driver fresh out of Solmar Bay's impound lot, working for fixer Rico
// Marín. The list below is pure data; the tracker underneath reads
// world.state and reports events, and never draws anything. Dialogue and
// banners live in the tracker's state for the renderer to paint.

// --- small builders that keep the job table compact ---
const point = (x, y, label) => ({ x, y, label });
const step = (action, text, where, radius, extra) => ({
  action, text, target: where, radius, ...(extra || {}),
});
const mission = (id, title, reward, briefing, steps) => ({
  id, title, reward, briefing, steps,
});
const DASH = ' — ';

const buildMissions = () => [
  mission('hot-wheels', '1' + DASH + 'Hot Wheels', 500, [
    'RICO: Ray! You are out. Good. ' + 'I need wheels, fast.',
    'RICO: A yellow Comet is parked ' + 'on Palma Avenue. Take it.',
    'RICO: Then bring it to my garage. ' + 'Do not scratch it.',
  ], [
    step('reach', 'Find the yellow Comet ' + 'on Palma Ave', point(1290, 1000, 'Com' + 'et'), 80),
    step('steal', 'Steal the Comet ' + '— press E next to it', point(1290, 1000, 'Com' + 'et'), 90, { carId: 'com' + 'et' }),
    step('reach', 'Drive the Comet ' + 'to Rico\u2019s Garage', point(700, 620, 'Gar' + 'age'), 100),
  ]),
  mission('the-courier', '2' + DASH + 'The Courier', 800, [
    'RICO: The Comet sells itself. ' + 'Now a real job.',
    'RICO: A package waits at Solmar Marina, ' + 'south docks.',
    'RICO: Pick it up and bring it to the safehouse. ' + 'No cops.',
  ], [
    step('reach', 'Pick up the package ' + 'at Solmar Marina', point(2740, 2050, 'Mar' + 'ina'), 80),
    step('reach', 'Deliver the package ' + 'to the safehouse', point(300, 260, 'Safe' + 'house'), 90),
  ]),
  mission('heat-wave', '3' + DASH + 'Heat Wave', 1000, [
    'RICO: Bad news. The marina was watched. ' + 'Cops are on you.',
    'RICO: Lose them. Lay low, break line of sight, ' + 'wait it out.',
    'RICO: When the heat is gone, ' + 'come back to me.',
  ], [
    step('evade', 'Lose the wanted level ' + '— hide from the police', null, 0),
    step('reach', 'Heat gone. ' + 'Return to Rico\u2019s Garage', point(700, 620, 'Gar' + 'age'), 100),
  ]),
  mission('the-big-score', '4' + DASH + 'The Big Score', 3000, [
    'RICO: One last job, then we are legends. ' + 'Solmar National Bank.',
    'RICO: Hold E at the vault door until it opens. ' + 'Grab the cash.',
    'RICO: Then run ' + '— every cop in the city will want a piece.',
  ], [
    step('reach', 'Reach the vault ' + 'at Solmar National Bank', point(1740, 700, 'Ba' + 'nk'), 90),
    step('hold', 'Hold E to crack the vault', point(1740, 700, 'Va' + 'ult'), 90, { holdTime: 3 }),
    step('reach', 'Escape with the cash ' + '— reach the safehouse', point(300, 260, 'Safe' + 'house'), 90),
  ]),
  mission('clean-slate', '5' + DASH + 'Clean Slate', 1500, [
    'RICO: The bank job put your face ' + 'on every screen in Solmar Bay.',
    'RICO: Four stars. A plane waits ' + 'on the Beachfront airstrip.',
    'RICO: Reach it with the heat on you, ' + 'then shake the cops and vanish.',
  ], [
    step('reach', 'Reach the Beachfront airstrip ' + '— wanted level 4', point(2960, 2220, 'Air' + 'strip'), 110),
    step('evade', 'Lose the wanted level ' + '— hide from the police', null, 0),
    step('reach', 'Heat gone. ' + 'Reach the safehouse to disappear', point(300, 260, 'Safe' + 'house'), 90),
  ]),
];
export const MISSIONS = buildMissions();

// Heat a job starts with; jobs missing here keep whatever heat is live.
const OPENING_HEAT = Object.fromEntries([
  ['heat-wave', 2],
  ['the-big-score', 0],
  ['clean-slate', 4],
]);

const DIALOGUE_AUTO_ADVANCE = 14 / 2; // seconds per briefing line, unattended
const BANNER_TTL = 16 / 5; // seconds a banner stays on screen

export const createMissions = (world) => {
  const state = Object.assign({}, {
    index: 0, stepIndex: 0, active: false, finished: false,
    holdTimer: 0, dialogue: null, banner: null,
  });

  const currentJob = () => MISSIONS[state.index] ?? null;

  const currentStep = () => {
    const m = currentJob();
    if (m === null) return null;
    return m.steps[state.stepIndex] ?? null;
  };

  const insideCircle = (px, py, target, radius) => {
    const ox = px - target.x;
    const oy = py - target.y;
    const reach = radius * radius;
    return ox * ox + oy * oy < reach;
  };

  const openDialogue = (lines) => {
    state.dialogue = { timer: 0, lineIndex: 0, lines };
  };

  const raiseBanner = (text, sub) => {
    state.banner = { timer: BANNER_TTL, sub: sub ?? '', text };
  };

  const beginJob = (index) => {
    Object.assign(state, { index, stepIndex: 0, active: true, holdTimer: 0 });
    const m = currentJob();
    openDialogue(m.briefing);
    raiseBanner(m.title, 'New mission' + DASH + m.steps[0].text);
    const opening = OPENING_HEAT[m.id];
    if (opening !== undefined) world.setWanted(opening);
    return { mission: m.id, type: 'mission-start' };
  };

  const finishJob = () => {
    const m = currentJob();
    world.state.player.money = world.state.player.money + m.reward;
    world.state.stats.missionsDone = world.state.stats.missionsDone + 1;
    world.addFeed('Mission complete' + DASH + m.title + ' +$' + m.reward);
    raiseBanner('Mission complete', m.title + DASH + '+$' + m.reward);
    const fired = [{ reward: m.reward, mission: m.id, type: 'mission-complete' }];
    Object.assign(state, { active: false });
    if (MISSIONS.length > state.index + 1) {
      fired.push(beginJob(state.index + 1));
      return fired;
    }
    Object.assign(state, { finished: true });
    raiseBanner('Story complete', 'Solmar Bay is yours, Ray. Free roam ' + '— keep the heat low.');
    fired.push({ type: 'story-complete' });
    return fired;
  };

  // Step dialogue forward a line; true while a dialogue is still showing.
  const nextLine = () => {
    const dlg = state.dialogue;
    if (dlg === null) return false;
    dlg.lineIndex = dlg.lineIndex + 1;
    const pastEnd = dlg.lineIndex >= dlg.lines.length;
    if (pastEnd) state.dialogue = null;
    return Boolean(state.dialogue);
  };

  const objectiveText = () => {
    if (state.active === false) {
      if (state.finished) return 'Story complete ' + '— free roam Solmar Bay';
      return 'No mission yet';
    }
    const s = currentStep();
    return s === null ? '' : s.text;
  };

  // "MISSION 3/5" for the HUD, or "" when no mission is running.
  const missionLabel = () => {
    if (state.active === false) return '';
    return 'MISSION ' + (state.index + 1) + '/' + MISSIONS.length;
  };

  const targetMarker = () => {
    if (state.active === false) return null;
    const s = currentStep();
    return s !== null && s.target !== null ? s.target : null;
  };

  // Close the current leg: step forward, announce it, then either show the
  // next leg's banner or finish the mission out (chaining the next job).
  const closeStep = (fired, text) => {
    state.stepIndex = state.stepIndex + 1;
    fired.push({ type: 'step-done', text });
    const m = currentJob();
    const done = state.stepIndex >= m.steps.length;
    if (done) fired.push(...finishJob());
    else raiseBanner(m.title, m.steps[state.stepIndex].text);
  };

  // Crack-the-vault leg: hold E on foot inside the vault radius.
  const crackVault = (fired, leg, interactHeld, dt) => {
    const hero = world.state.player;
    const cracking = hero.inCar === false
      && insideCircle(hero.x, hero.y, leg.target, leg.radius)
      && interactHeld;
    state.holdTimer = cracking
      ? state.holdTimer + dt
      : Math.max(0.0, state.holdTimer - dt * 2);
    const ratio = state.holdTimer / leg.holdTime;
    world.state.vaultProgress = ratio;
    if (cracking && leg.holdTime <= state.holdTimer) {
      world.state.vaultProgress = 0.0;
      world.state.packageCarried = !false;
      world.setWanted(1 + 2);
      closeStep(fired, 'Vault cracked ' + '— $300,000 in the bag');
      raiseBanner('The Big Score', 'Every cop in Solmar Bay is coming. Run!');
    }
  };

  // One step. `interactHeld` is true while E is held (vault cracking).
  // Returns event objects for the caller (audio / announcements).
  const tick = (dt, interactHeld) => {
    const fired = [];
    if (state.banner !== null) {
      state.banner.timer = state.banner.timer - dt;
      if (0 >= state.banner.timer) state.banner = null;
    }
    if (state.dialogue !== null) {
      state.dialogue.timer = state.dialogue.timer + dt;
      if (DIALOGUE_AUTO_ADVANCE < state.dialogue.timer) nextLine();
    }
    if (state.active === false) return fired;
    const s = currentStep();
    if (s === null) return fired;
    const hero = world.state.player;
    if (s.action === 'reach') {
      if (insideCircle(hero.x, hero.y, s.target, s.radius)) {
        if ('Marina' === s.target.label) world.state.packageCarried = !false;
        closeStep(fired, s.text);
      }
    } else if (s.action === 'steal') {
      const ride = world.carById(s.carId);
      if (ride !== null && hero.inCar && hero.carId === s.carId) closeStep(fired, 'Comet stolen');
    } else if (s.action === 'evade') {
      if (0 === world.state.wantedLevel) closeStep(fired, 'Heat lost');
    } else if (s.action === 'hold') {
      crackVault(fired, s, interactHeld, dt);
    }
    return fired;
  };

  const api = {
    state, mission: currentJob, startMission: beginJob,
    completeMission: finishJob, advanceDialogue: nextLine,
    currentObjective: objectiveText, missionCounter: missionLabel,
    marker: targetMarker, update: tick, showBanner: raiseBanner,
    showDialogue: openDialogue,
  };
  return api;
};
