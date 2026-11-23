// Saving Solara between visits: money, story progress and the best haul,
// kept in localStorage. Storage can be off (private windows): then the game
// still runs, it just forgets everything when the tab closes.
import { SAVE_KEY } from './config.js';

const DEFAULT_MONEY = 50;

function asNumber(value, fallback) {
  return typeof value === 'number' ? value : fallback;
}

function normalize(data) {
  if (typeof data !== 'object' || data === null) return null;
  // A save from a newer build could name a mission past the end of the
  // story; clamp it so the mission lookup never reads past the list.
  const index = asNumber(data.missionIndex, 0);
  return {
    money: asNumber(data.money, DEFAULT_MONEY),
    missionIndex: Math.max(0, Math.min(4, Math.floor(index))),
    storyDone: data.storyDone === true,
    best: asNumber(data.best, 0),
  };
}

export function loadSave() {
  let raw = null;
  try {
    raw = window.localStorage.getItem(SAVE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    return normalize(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writeSave(data) {
  const payload = {
    money: Math.floor(data.money),
    missionIndex: data.missionIndex,
    storyDone: data.storyDone,
    best: Math.floor(data.best),
  };
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
  } catch {
    // Storage can be off: the save then lasts this visit only.
  }
}
