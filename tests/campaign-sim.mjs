// Campaign balance simulator: plays every encounter many times with a
// competent "player" (hard AI) against the encounter's configured enemy,
// replicating BattleScreen's boss modifiers. Prints win rates per encounter
// so campaign difficulty can be tuned with real data.
//
// Player model: hard AI, tries each Ascendant class; deck = starter deck
// upgraded with the cards unlocked from all PREVIOUS encounters (like a real
// player who slots in rewards as they progress).

import { Game } from '../js/engine/game.js';
import { AI } from '../js/ai/ai.js';
import { CAMPAIGN, encounterDeck } from '../js/data/campaign.js';
import { STARTER_DECKS, CLASSES } from '../js/data/decks.js';
import { getCard } from '../js/data/cards.js';

const TRIALS = 30;             // seeds per encounter per class
const PLAYER_CLASSES = Object.keys(CLASSES);

// Cards unlocked before reaching encounter `index`.
function unlockedBefore(index) {
  const ids = [];
  for (let i = 0; i < index; i++) ids.push(...CAMPAIGN[i].unlocks);
  return ids;
}

// Upgrade a starter deck with unlocked cards usable by this class: swap out
// the cheapest vanilla minions for the strongest unlocks (2 copies of
// non-gold, 1 of gold), keeping deck size at 30.
function upgradedDeck(cls, unlocks) {
  const deck = STARTER_DECKS[cls].slice();
  const usable = unlocks
    .map(getCard)
    .filter((c) => c.class === 'neutral' || c.class === cls)
    .sort((a, b) => (b.cost + (b.attack || 0)) - (a.cost + (a.attack || 0)));
  // Removal candidates: vanilla (no text) minions, cheapest first.
  const isVanilla = (id) => {
    const c = getCard(id);
    return c.type === 'minion' && !c.battlecry && !c.deathrattle && !(c.keywords || []).length &&
      !c.spellDamage && !c.gloryCost;
  };
  for (const u of usable) {
    const copies = u.rarity === 'gold' ? 1 : 2;
    for (let k = 0; k < copies; k++) {
      if (deck.filter((id) => id === u.id).length >= (u.rarity === 'gold' ? 1 : 2)) break;
      const removeIdx = deck.findIndex(isVanilla);
      if (removeIdx === -1) break;
      deck.splice(removeIdx, 1);
      deck.push(u.id);
    }
  }
  return deck.slice(0, 30);
}

async function playGame(encIdx, playerCls, seed) {
  const enc = CAMPAIGN[encIdx];
  const game = new Game({
    seed,
    players: [
      { name: 'Player', hero: playerCls, deck: upgradedDeck(playerCls, unlockedBefore(encIdx)) },
      { name: enc.name, hero: enc.class, deck: encounterDeck(enc) },
    ],
  });
  // Boss modifiers (mirror BattleScreen).
  const boss = enc.boss;
  if (boss) {
    const hero = game.players[1].hero;
    if (boss.extraHealth) { hero.maxHealth += boss.extraHealth; hero.health += boss.extraHealth; }
    if (boss.startArmor) hero.armor += boss.startArmor;
  }
  game.start(0);
  if (boss && boss.openingBoard) {
    for (const tok of boss.openingBoard) {
      const m = game.summonToken(1, tok);
      if (m) m.summonedThisTurn = false;
    }
  }
  const player = new AI('hard');
  const enemy = new AI(enc.difficulty);
  let guard = 0;
  while (!game.over && guard++ < 300) {
    const pid = game.current;
    if (pid === 0) {
      await player.takeTurn(game, 0);
    } else {
      await enemy.takeTurn(game, 1);
      if (boss?.doubleHeroPower && !game.over) {
        game.players[1].heroPowerUsed = false;
        enemy.tryHeroPower(game, 1);
      }
    }
    if (!game.over) game.endTurn();
  }
  return { won: game.winner === 0, turns: Math.ceil(game.turn / 2) };
}

console.log('Кампания: симуляция прохождения (hard-игрок, колода растёт с наградами)');
console.log('Цель: лёгкие 70-90%, средние 55-75%, боссы 40-60%, финал 30-50%\n');

const summary = [];
for (let i = 0; i < CAMPAIGN.length; i++) {
  const enc = CAMPAIGN[i];
  const perClass = {};
  let totalWins = 0, totalGames = 0, totalTurns = 0;
  for (const cls of PLAYER_CLASSES) {
    let wins = 0;
    for (let t = 0; t < TRIALS; t++) {
      const r = await playGame(i, cls, i * 1000 + t * 17 + PLAYER_CLASSES.indexOf(cls) * 7);
      if (r.won) wins++;
      totalTurns += r.turns;
    }
    perClass[cls] = wins;
    totalWins += wins;
    totalGames += TRIALS;
  }
  const rate = (totalWins / totalGames * 100).toFixed(0);
  const perClsStr = PLAYER_CLASSES.map((c) => `${CLASSES[c].icon}${(perClass[c] / TRIALS * 100).toFixed(0)}%`).join(' ');
  const bossTag = enc.boss ? ' 👑' : '';
  console.log(`${String(i + 1).padStart(2)}. ${enc.name}${bossTag} [${enc.difficulty}] — winrate ${rate}% (${perClsStr}), avg ${(totalTurns / totalGames).toFixed(1)} ходов`);
  summary.push({ i: i + 1, name: enc.name, rate: Number(rate), boss: !!enc.boss, difficulty: enc.difficulty });
}

console.log('\n--- Диагностика ---');
for (const s of summary) {
  const target = s.boss ? [35, 65] : s.difficulty === 'easy' ? [65, 95] : s.difficulty === 'normal' ? [55, 80] : [40, 70];
  const status = s.rate < target[0] ? '⚠️ СЛИШКОМ СЛОЖНО' : s.rate > target[1] ? '⚠️ СЛИШКОМ ЛЕГКО' : '✅ ок';
  console.log(`${s.i}. ${s.name}: ${s.rate}% (цель ${target[0]}-${target[1]}%) ${status}`);
}
