// Keyboard and pointer input. Held keys give movement; one-shot presses
// (start, pause, enter a car, punch, shoot, mission, fare, mute) are queued
// as bit flags and taken once by the loop, so a press between two frames is
// never lost and never counted twice. The mouse aims the pistol on foot.
// Space is the handbrake in a car and the menu confirm elsewhere.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_ATTACK = 8;
export const ACTION_SHOOT = 16;
export const ACTION_START_MISSION = 32;
export const ACTION_FARE = 64;
export const ACTION_MUTE = 128;

const HELD_KEYS = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
};

const PRESS_KEYS = {
  Enter: ACTION_START_MISSION,
  KeyP: ACTION_PAUSE,
  Escape: ACTION_PAUSE,
  KeyE: ACTION_ENTER,
  KeyQ: ACTION_ATTACK,
  KeyF: ACTION_SHOOT,
  KeyT: ACTION_FARE,
  KeyM: ACTION_MUTE,
};

export function createInput(target) {
  const held = { up: false, down: false, left: false, right: false, run: false, space: false };
  let queued = 0;
  let aimX = 0;
  let aimY = 0;

  function clearHeld() {
    held.up = false;
    held.down = false;
    held.left = false;
    held.right = false;
    held.run = false;
    held.space = false;
  }

  function onKeyDown(event) {
    const direction = HELD_KEYS[event.code];
    if (direction) {
      held[direction] = true;
    } else if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
      held.run = true;
    } else if (event.code === 'Space') {
      held.space = true;
      if (!event.repeat) queued |= ACTION_CONFIRM;
    } else {
      const flag = PRESS_KEYS[event.code];
      if (flag === undefined) return;
      if (!event.repeat) queued |= flag;
    }
    event.preventDefault();
  }
  // Every handled key stops the browser's own behaviour (arrow keys would
  // scroll the page, Space would scroll it too); unhandled keys fall through.

  function onKeyUp(event) {
    const direction = HELD_KEYS[event.code];
    if (direction) held[direction] = false;
    else if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') held.run = false;
    else if (event.code === 'Space') held.space = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', clearHeld);

  target.addEventListener('pointerdown', (event) => {
    aimX = event.clientX;
    aimY = event.clientY;
    queued |= ACTION_CONFIRM;
  });
  target.addEventListener('pointermove', (event) => {
    aimX = event.clientX;
    aimY = event.clientY;
  });

  return {
    // The frame's input as the world reads it. One-shot flags stay set until
    // takeActions() is called (once a frame, by the loop), so a press is
    // never lost or counted twice.
    read() {
      return {
        up: held.up,
        down: held.down,
        left: held.left,
        right: held.right,
        run: held.run,
        handbrake: held.space,
        enter: Boolean(queued & ACTION_ENTER),
        attack: Boolean(queued & ACTION_ATTACK),
        shoot: Boolean(queued & ACTION_SHOOT),
        startMission: Boolean(queued & ACTION_START_MISSION),
        startFare: Boolean(queued & ACTION_FARE),
        aimX,
        aimY,
      };
    },
    // One-shot presses since the last read, as ACTION_* flags (for menus).
    takeActions() {
      const taken = queued;
      queued = 0;
      return taken;
    },
  };
}
