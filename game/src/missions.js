// The story of Solara: four jobs for Mara Voss, the fixer who runs the
// marina, then free-roam taxi fares. A mission is plain data plus a small
// state machine: an objective, a place or a thing to reach, a timer, and
// what happens when it is done. The world drives the stages; this module
// only describes them.
import { PLACES } from './config.js';

export const MISSION_COUNT = 4;

function carJob(id, title, brief, targetPlace, targetType, deliverPlace, seconds, pay, finish, extra) {
  return {
    id, title, brief,
    objective: '',
    target: { ...targetPlace, kind: 'car', type: targetType, radius: 90 },
    deliver: { ...deliverPlace, kind: 'place', radius: targetPlace === PLACES.getawayVan ? 120 : 110 },
    timeLimit: seconds,
    reward: pay,
    complete: finish,
    ...(extra || {}),
  };
}

const COURIER = carJob(
  'courier',
  'Job 1 - The Courier',
  'Mara Voss: "A coupe full of cash is parked at the marina. Take it. Bring it to Palm Court. Don\'t scratch it."',
  PLACES.courierCar, 'coupe', PLACES.suburbDrop, 100, 400,
  'The coupe is delivered. Mara is pleased. Take this pistol, you\'ll need it.',
  { onStart: 'pistol' },
);
COURIER.objective = 'Steal the red coupe at the marina';

const PROTECTION = {
  id: 'protection',
  title: 'Job 2 - Protection Run',
  brief: 'Mara Voss: "Three shops owe me. Collect from the Deli, the Ironworks Cafe and the Boardwalk Kiosk. The cops will notice, so move fast."',
  objective: 'Collect from 3 shops',
  pickups: [
    { ...PLACES.shop1, kind: 'place', radius: 90, name: 'Downtown Deli' },
    { ...PLACES.shop2, kind: 'place', radius: 90, name: 'Ironworks Cafe' },
    { ...PLACES.shop3, kind: 'place', radius: 90, name: 'Boardwalk Kiosk' },
  ],
  timeLimit: 170,
  reward: 600,
  wantedOnStart: 1,
  complete: 'All three shops paid up. Mara trusts you with bigger work now.',
};

const HEAT = {
  id: 'heat',
  title: 'Job 3 - The Heat',
  brief: 'Mara Voss: "The SPPD has your face. Stay alive and stay free for one minute while they come at you with everything."',
  objective: 'Survive the heat for 60 seconds',
  survive: 60,
  timeLimit: 90,
  reward: 800,
  wantedOnStart: 3,
  complete: 'You slipped the whole department. Nobody in Solara forgets a night like that.',
};

const GETAWAY = carJob(
  'getaway',
  'Job 4 - The Getaway',
  'Mara Voss: "Last job. Drive the van from Downtown to Marina Dock 7. Four stars on your tail the whole way. Do this and the city is yours."',
  PLACES.getawayVan, 'van', PLACES.marinaDock, 150, 1500,
  'The van is in. Mara Voss shakes your hand: Solara is yours now, kid.',
  { wantedOnStart: 4 },
);
GETAWAY.objective = 'Drive the van to Marina Dock 7';

export const MISSIONS = [COURIER, PROTECTION, HEAT, GETAWAY];

const FARE_SPOTS = [
  { x: 960, y: 480, name: 'Downtown' },
  { x: 2240, y: 1120, name: 'Uptown' },
  { x: 960, y: 1760, name: 'Old Town' },
  { x: 2880, y: 1120, name: 'Industrial' },
  { x: 320, y: 2080, name: 'Boardwalk' },
];

function pickSpot(random, avoid) {
  let spot = FARE_SPOTS[Math.floor(random() * FARE_SPOTS.length)];
  let guard = 0;
  while (spot === avoid && guard < 10) {
    spot = FARE_SPOTS[Math.floor(random() * FARE_SPOTS.length)];
    guard += 1;
  }
  return spot;
}

/** A repeatable taxi fare: pick up a marked pedestrian, drive them to the marker. */
export function makeFare(random, player) {
  const from = pickSpot(random, null);
  const to = pickSpot(random, from);
  const fare = 80 + Math.floor(random() * 140);
  return {
    id: 'fare',
    title: 'Taxi Fare',
    brief: `A fare is waiting at ${from.name}. Pick them up and drop them at ${to.name}.`,
    objective: `Pick up the fare at ${from.name}`,
    pickup: { ...from, kind: 'place', radius: 80 },
    deliver: { ...to, kind: 'place', radius: 110 },
    timeLimit: 120,
    reward: fare,
    complete: `Fare delivered. +$${fare}.`,
  };
}

export function createMissionState() {
  return {
    index: 0,
    active: null,
    toast: '',
    toastTimer: 0,
    storyDone: false,
  };
}

function firstStage(def) {
  if (def.pickup) return 'pickup';
  if (def.pickups) return 'collect';
  if (def.survive) return 'survive';
  if (def.target) return 'steal';
  return 'deliver';
}

/** Begin a mission: returns its opening objective text. */
export function startMission(ms, def, wanted) {
  ms.active = {
    def,
    stage: firstStage(def),
    timer: def.timeLimit,
    collected: 0,
    survived: 0,
    delivered: false,
    pickedUp: false,
  };
  if (def.wantedOnStart) wanted.level = Math.max(wanted.level, def.wantedOnStart);
  return def.brief;
}

/** True when no mission is running. */
export function missionDone(ms) {
  return ms.active === null;
}

const STAGE_LINES = {
  steal: (a) => `Steal the ${a.def.target.name}`,
  deliver: (a) => `Deliver to ${a.def.deliver.name}`,
  collect: (a) => `Collect: ${a.collected} of ${a.def.pickups.length} shops`,
  survive: (a) => `Survive: ${Math.ceil(a.survived)}s of ${a.def.survive}s`,
  pickup: (a) => `Pick up the fare at ${a.def.pickup.name}`,
};

export function currentObjective(ms) {
  const a = ms.active;
  if (!a) {
    return ms.storyDone
      ? 'Free roam, fares pay. Press T for a fare.'
      : 'Press Enter to start the next job.';
  }
  const line = STAGE_LINES[a.stage];
  return line ? line(a) : a.def.objective;
}
