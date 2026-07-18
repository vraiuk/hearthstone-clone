// Player progression persisted in localStorage: gold, unlocked cards, custom
// decks, campaign progress and stats. All reads go through load(); every
// mutation saves immediately.

import { STARTER_DECKS } from '../data/decks.js';

const KEY = 'star-blood-save-v1';

function starterCollection() {
  // Player starts with every card used in the four starter decks.
  const set = new Set();
  for (const cls of Object.keys(STARTER_DECKS))
    for (const id of STARTER_DECKS[cls]) set.add(id);
  return [...set];
}

function defaultSave() {
  return {
    gold: 0,
    unlocked: starterCollection(),   // card ids the player owns
    campaignProgress: 0,             // legacy: общий прогресс (для миграции)
    campaignByClass: {},             // { class: боёв пройдено этим героем }
    beaten: [],                      // индексы боёв, пройденных хоть кем-то
    customDecks: {},                 // { deckName: { class, cards: [] } }
    activeDeck: null,                // { class, cards } or null → use starter
    stats: { wins: 0, losses: 0, gamesPlayed: 0 },
  };
}

// Миграция старого общего прогресса: зачесть его каждому Восходящему.
function migrate(data) {
  if (data.campaignProgress > 0 && (!data.campaignByClass || !Object.keys(data.campaignByClass).length)) {
    data.campaignByClass = {};
    for (const cls of Object.keys(STARTER_DECKS)) data.campaignByClass[cls] = data.campaignProgress;
    data.beaten = Array.from({ length: data.campaignProgress }, (_, i) => i);
  }
  return data;
}

let cache = null;

export function load() {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const data = JSON.parse(raw);
      cache = migrate({ ...defaultSave(), ...data });
      return cache;
    }
  } catch (e) { /* corrupted save → reset */ }
  cache = defaultSave();
  return cache;
}

export function save() {
  if (!cache) return;
  try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch (e) { /* storage full/blocked */ }
}

export function addGold(amount) { load().gold += amount; save(); }

export function spendGold(amount) {
  const s = load();
  if (s.gold < amount) return false;
  s.gold -= amount; save();
  return true;
}

export function unlockCards(ids) {
  const s = load();
  for (const id of ids) if (!s.unlocked.includes(id)) s.unlocked.push(id);
  save();
}

export function isUnlocked(id) { return load().unlocked.includes(id); }

// ---- Кампания: прогресс отдельно для каждого Восходящего ----
export function progressFor(cls) {
  return load().campaignByClass[cls] || 0;
}

export function bestProgress() {
  const s = load();
  return Math.max(0, ...Object.values(s.campaignByClass));
}

// true, если бой уже проходили каким-либо героем (награда один раз).
export function isEncounterBeaten(index) {
  return load().beaten.includes(index);
}

export function beatEncounterFor(cls, index) {
  const s = load();
  if (index === (s.campaignByClass[cls] || 0)) {
    s.campaignByClass[cls] = index + 1;
    if (!s.beaten.includes(index)) s.beaten.push(index);
    s.campaignProgress = Math.max(s.campaignProgress, s.campaignByClass[cls]);
    save();
  }
}

export function recordResult(won) {
  const s = load();
  s.stats.gamesPlayed += 1;
  if (won) s.stats.wins += 1; else s.stats.losses += 1;
  save();
}

export function setCustomDeck(name, cls, cards) {
  const s = load();
  s.customDecks[name] = { class: cls, cards };
  save();
}

export function deleteCustomDeck(name) {
  const s = load();
  delete s.customDecks[name];
  save();
}

export function setActiveDeck(deck) { load().activeDeck = deck; save(); }

// Deck the player takes into battle: active custom deck if set & valid,
// otherwise the starter deck for the requested class.
export function battleDeck(cls) {
  const s = load();
  if (s.activeDeck && s.activeDeck.class === cls && s.activeDeck.cards.length === 30)
    return s.activeDeck.cards.slice();
  return STARTER_DECKS[cls].slice();
}

// Craft prices per rank (Дерево/Бронза/Серебро/Золото).
export const CRAFT_COST = { wood: 40, bronze: 100, silver: 400, gold: 1600 };

export function resetAll() {
  cache = defaultSave();
  save();
}
