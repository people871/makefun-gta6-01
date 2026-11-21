// Keyboard and mouse input for SOLMAR HEAT. Every physical key maps to
// one role; held roles steer on foot and in a car, while one-shot roles
// (interact, punch, pause, confirm, mute) are queued as bit flags and taken
// once per frame by the loop. Keeping the mapping in a single table means a
// new binding is one line, and the held set still stores raw codes, so
// releasing one of two keys bound to the same direction never drops the
// other one.

// One-shot action flags, consumed once per frame via takeActions().
export const ACTION_CONFIRM = 1 << 0;
export const ACTION_PAUSE = 1 << 1;
export const ACTION_INTERACT = 1 << 2;
export const ACTION_PUNCH = 1 << 3;
export const ACTION_MUTE = 1 << 4;

// Role -> the physical codes that trigger it. E steals and enters cars; V
// is the same action for left-handed players. F or J punches; X is a third
// way, so a mouse-free player always has one.
const BINDINGS = [
  ['up', ['ArrowUp', 'KeyW']],
  ['down', ['ArrowDown', 'KeyS']],
  ['left', ['ArrowLeft', 'KeyA']],
  ['right', ['ArrowRight', 'KeyD']],
  ['sprint', ['ShiftLeft', 'ShiftRight']],
  ['confirm', ['Enter', 'Space']],
  ['pause', ['KeyP', 'Escape']],
  ['interact', ['KeyE', 'KeyV']],
  ['punch', ['KeyF', 'KeyJ', 'KeyX']],
  ['mute', ['KeyM']],
];

// code -> role, flattened out of the table above.
const ROLE_BY_CODE = new Map(
  BINDINGS.flatMap(([role, codes]) => codes.map((code) => [code, role])),
);

// Roles that stay live while held, rather than firing once per press.
const HELD_ROLES = new Set(['sprint', 'up', 'down', 'left', 'right']);

// One-shot role -> its action flag.
const FLAG_BY_ROLE = { mute: ACTION_MUTE, punch: ACTION_PUNCH, interact: ACTION_INTERACT, pause: ACTION_PAUSE, confirm: ACTION_CONFIRM };

export const createInput = (target) => {
  const downCodes = new Set(); // raw event.code values currently down
  let pending = 0; // one-shot flags waiting to be taken
  let pointerX = 0;
  let pointerY = 0;

  const keyDown = (event) => {
    const found = ROLE_BY_CODE.get(event.code);
    if (found === undefined) {
      // unmapped key: let the browser have it
    } else if (HELD_ROLES.has(found)) {
      downCodes.add(event.code);
      event['preventDefault']();
    } else if (event.repeat === false) {
      pending |= FLAG_BY_ROLE[found];
      event['preventDefault']();
    }
  };

  const keyUp = (event) => {
    downCodes.delete(event.code);
  };

  const loseFocus = () => {
    downCodes.clear();
  };

  const trackPointer = (event) => {
    const box = target.getBoundingClientRect();
    pointerX = event.clientX - box.left;
    pointerY = event.clientY - box.top;
  };

  const pressPointer = (event) => {
    trackPointer(event);
    // A click punches on foot and also confirms on menus.
    pending |= ACTION_PUNCH | ACTION_CONFIRM;
  };

  window.addEventListener('keydown', keyDown);
  window.addEventListener('keyup', keyUp);
  window.addEventListener('blur', loseFocus);
  target.addEventListener('pointermove', trackPointer);
  target.addEventListener('pointerdown', pressPointer);

  const heldRole = (wanted) => {
    let found = false;
    for (const code of downCodes) {
      if (ROLE_BY_CODE.get(code) === wanted) found = true;
    }
    return found;
  };

  const api = {
    // {x, y} in -1..1: up/down/left/right from the held keys.
    move: () => {
      const x = (heldRole('right') ? 1 : 0) - (heldRole('left') ? 1 : 0);
      const y = (heldRole('down') ? 1 : 0) - (heldRole('up') ? 1 : 0);
      return { x, y, sprint: heldRole('sprint') };
    },
    up() { return heldRole('up'); },
    down() { return heldRole('down'); },
    left() { return heldRole('left'); },
    right() { return heldRole('right'); },
    sprint() { return heldRole('sprint'); },
    mouse: () => {
      return { x: pointerX, y: pointerY };
    },
    // One-shot actions queued since the last take, as bit flags.
    takeActions: () => {
      const snapshot = pending;
      pending = 0;
      return snapshot;
    },
    // Drop every held key and queued action (handy when the game pauses).
    reset() {
      downCodes.clear();
      pending = 0;
    },
  };
  return api;
};
