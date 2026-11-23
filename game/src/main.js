// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between six screens: title,
// play, paused, busted, wasted and story done.
//
// ?seed=N fixes the city. ?shot=cover|onfoot|driving|mission (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady.
import { STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_BUSTED, EVENT_CASH, EVENT_FAIL, EVENT_MISSION, EVENT_SHOT, EVENT_WASTED } from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, ACTION_START_MISSION, createInput } from './input.js';
import { createRenderer, SCREEN_BUSTED, SCREEN_DONE, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WASTED } from './render.js';
import { createAudio } from './audio.js';
import { loadSave, writeSave } from './save.js';
import { stageShot } from './shots.js';

// The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped.
const MAX_FRAME = 0.25;
// Screens where a confirm press (Enter, Space, click) starts a fresh run.
const MENU_SCREENS = [SCREEN_TITLE, SCREEN_BUSTED, SCREEN_WASTED, SCREEN_DONE];

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

const save = loadSave();
let best = save ? save.best : 0;

function restoreSave() {
  if (!save) return;
  world.state.money = save.money;
  world.state.mission.index = save.missionIndex;
  world.state.mission.storyDone = save.storyDone;
  best = save.best;
}

function storeSave() {
  const ms = world.state.mission;
  best = Math.max(best, Math.floor(world.state.money));
  writeSave({ money: world.state.money, missionIndex: ms.index, storyDone: ms.storyDone, best });
}

function say(message) {
  status.textContent = message;
}

function paintShot(name) {
  restoreSave();
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, world.city, scene.screen, {
      best: scene.best,
      objective: scene.objective,
      toast: scene.toast,
    });
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function playGame() {
  const input = createInput(canvas);
  const clock = { accumulator: 0, last: performance.now() };
  let screen = SCREEN_TITLE;
  let doneShown = false;

  // A handle for automated play-testing (and nothing else): the live world and screen.
  window.__solara = { world, get screen() { return screen; } };

  function startGame() {
    world.reset();
    restoreSave();
    doneShown = false;
    clock.accumulator = 0;
    screen = SCREEN_PLAY;
    audio.unlock();
    say('Playing Solara. Press Enter to start the next job.');
  }

  function react(events) {
    if (events & EVENT_SHOT) audio.shot();
    if (events & EVENT_CASH) audio.cash();
    if (events & EVENT_MISSION) {
      audio.mission();
      storeSave();
      if (world.state.mission.storyDone && !doneShown) {
        doneShown = true;
        screen = SCREEN_DONE;
        say('Story complete. Solara is yours.');
      }
    }
    if (events & EVENT_FAIL) audio.fail();
    if (events & EVENT_BUSTED) {
      audio.busted();
      storeSave();
      screen = SCREEN_BUSTED;
      say('Busted. The SPPD took 20 percent of your cash.');
    }
    if (events & EVENT_WASTED) {
      audio.busted();
      storeSave();
      screen = SCREEN_WASTED;
      say('Wasted. You woke up at Solara General.');
    }
  }

  function advance(frameInput) {
    const events = world.step(STEP, frameInput);
    react(events);
    audio.update(STEP, world.state.player.speed, world.state.wanted.level);
  }

  function tick(now) {
    requestAnimationFrame(tick);
    clock.accumulator += Math.min((now - clock.last) / 1000, MAX_FRAME);
    clock.last = now;
    // Read the frame's input first (it snapshots the one-shot flags), then
    // take the menu actions; the two reads together clear the flags exactly once.
    const frameInput = input.read();
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      say(muted ? 'Sound off.' : 'Sound on.');
    }
    if (MENU_SCREENS.includes(screen)) {
      if (actions & (ACTION_CONFIRM | ACTION_START_MISSION)) startGame();
    } else if (actions & ACTION_PAUSE) {
      screen = screen === SCREEN_PLAY ? SCREEN_PAUSED : SCREEN_PLAY;
      say(screen === SCREEN_PAUSED ? 'Paused.' : 'Playing.');
    }
    if (screen === SCREEN_PLAY) {
      // One-shot presses fire on the first sub-step only; held keys run every sub-step.
      let pending = frameInput;
      while (clock.accumulator >= STEP) {
        advance(pending);
        pending = { ...pending, enter: false, attack: false, shoot: false, startMission: false, startFare: false };
        clock.accumulator -= STEP;
        if (screen !== SCREEN_PLAY) {
          clock.accumulator = 0;
          break;
        }
      }
    } else {
      clock.accumulator = 0;
    }
    renderer.draw(world.state, world.city, screen, {
      best,
      objective: world.objective(),
      toast: world.state.mission.toast,
    });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      say('Paused.');
    }
  });

  restoreSave();
  say('Solara. Press Enter or click to start.');
  requestAnimationFrame(tick);
}

if (shot) paintShot(shot);
else playGame();
