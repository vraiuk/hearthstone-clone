// Headless smoke test: AI vs AI full games. Verifies the engine finishes
// games without crashes, invariants hold, and both sides can win.
import { Game } from '../js/engine/game.js';
import { AI } from '../js/ai/ai.js';
import { CARDS, collectibleForClass } from '../js/data/cards.js';

function basicDeck(cls) {
  // Build a naive 30-card deck: cheapest 15 distinct cards x2.
  const pool = collectibleForClass(cls).filter((c) => !c.token);
  pool.sort((a, b) => a.cost - b.cost);
  const deck = [];
  for (const c of pool) {
    if (deck.length >= 30) break;
    deck.push(c.id, c.id);
  }
  return deck.slice(0, 30);
}

function checkInvariants(game, tag) {
  for (const p of game.players) {
    if (p.board.length > 7) throw new Error(`${tag}: board overflow ${p.board.length}`);
    if (p.hand.length > 10) throw new Error(`${tag}: hand overflow ${p.hand.length}`);
    for (const m of p.board) {
      if (m.health <= 0) throw new Error(`${tag}: dead minion on board: ${m.name} hp=${m.health}`);
      if (m.owner !== p.id) throw new Error(`${tag}: wrong owner`);
    }
    if (p.mana < 0) throw new Error(`${tag}: negative mana`);
  }
}

const classes = ['mage', 'warrior', 'priest', 'hunter'];
let wins = [0, 0, 0]; // p0, p1, draw
let totalTurns = 0;

for (let i = 0; i < 40; i++) {
  const c0 = classes[i % 4];
  const c1 = classes[(i + 1 + (i >> 2)) % 4];
  const game = new Game({
    seed: 1000 + i,
    players: [
      { name: 'P0', hero: c0, deck: basicDeck(c0) },
      { name: 'P1', hero: c1, deck: basicDeck(c1) },
    ],
  });
  game.start(i % 2);
  const ai0 = new AI('hard');
  const ai1 = new AI('normal');
  let guard = 0;
  while (!game.over && guard++ < 200) {
    const pid = game.current;
    const ai = pid === 0 ? ai0 : ai1;
    await ai.takeTurn(game, pid, async () => checkInvariants(game, `game${i} turn${game.turn}`));
    checkInvariants(game, `game${i} post-turn${game.turn}`);
    if (!game.over) game.endTurn();
  }
  if (!game.over) throw new Error(`game ${i} did not finish in 200 turns (${c0} vs ${c1})`);
  totalTurns += Math.ceil(game.turn / 2);
  if (game.winner === -1) wins[2]++;
  else wins[game.winner]++;
}

console.log(`OK: 40 games finished. P0(hard) wins=${wins[0]}, P1(normal) wins=${wins[1]}, draws=${wins[2]}`);
console.log(`Avg game length: ${(totalTurns / 40).toFixed(1)} turns`);

// Targeted unit checks -------------------------------------------------
const g = new Game({
  seed: 42,
  players: [
    { name: 'A', hero: 'mage', deck: basicDeck('mage') },
    { name: 'B', hero: 'warrior', deck: basicDeck('warrior') },
  ],
});
g.start(0);
const p0 = g.players[0];

// Divine shield absorbs one hit.
const squire = g.makeMinionFromCard(CARDS['argent_squire'], 0);
p0.board.push(squire);
g.dealDamage(squire, 5, { test: true });
if (squire.health !== 1 || squire.divineShield) throw new Error('divine shield failed');
g.dealDamage(squire, 1, { test: true });
g.processDeaths();
if (p0.board.includes(squire)) throw new Error('squire should die after shield popped');

// Deathrattle: leper gnome hits enemy hero for 2.
const gnome = g.makeMinionFromCard(CARDS['leper_gnome'], 0);
p0.board.push(gnome);
const hpBefore = g.players[1].hero.health;
g.destroyEntity(gnome);
g.processDeaths();
if (g.players[1].hero.health !== hpBefore - 2) throw new Error('deathrattle failed');

// Armor absorbs damage.
g.gainArmor(0, 5);
const heroHp = p0.hero.health;
g.dealDamage(p0.hero, 3, { test: true });
if (p0.hero.armor !== 2 || p0.hero.health !== heroHp) throw new Error('armor failed');

// Taunt blocks attacks on hero.
const taunt = g.makeMinionFromCard(CARDS['frostwolf_grunt'], 1);
g.players[1].board.push(taunt);
const raptor = g.makeMinionFromCard(CARDS['bloodfen_raptor'], 0);
raptor.summonedThisTurn = false;
p0.board.push(raptor);
g.current = 0;
const blocked = g.canAttack(0, raptor, g.players[1].hero);
if (blocked.ok) throw new Error('taunt should block hero attack');
const allowed = g.canAttack(0, raptor, taunt);
if (!allowed.ok) throw new Error('attack into taunt should be allowed: ' + allowed.reason);

// Lightspawn attack tracks health.
const spawn = g.makeMinionFromCard(CARDS['lightspawn'], 0);
p0.board.push(spawn);
g.normalizeMinion(spawn);
if (g.effectiveAttack(spawn) !== 5) throw new Error('lightspawn attack should equal health');
g.dealDamage(spawn, 2, { test: true });
if (g.effectiveAttack(spawn) !== 3) throw new Error('lightspawn attack should track health');

// Polymorph transforms.
const ogre = g.makeMinionFromCard(CARDS['boulderfist_ogre'], 1);
g.players[1].board.push(ogre);
g.transformMinion(ogre, 'sheep');
if (!g.players[1].board.some((m) => m.name === 'Овца')) throw new Error('transform failed');

// Poisonous kills any minion it damages, but not through divine shield.
const rat = g.makeMinionFromCard(CARDS['plague_rat'], 0);
rat.summonedThisTurn = false;
p0.board.push(rat);
const bigOgre = g.makeMinionFromCard(CARDS['war_golem'], 1);
g.players[1].board.push(bigOgre);
g.players[1].board = g.players[1].board.filter((m) => !m.keywords.has('taunt')); // clear taunts
g.current = 0;
g.attack(0, rat, bigOgre);
if (g.players[1].board.includes(bigOgre)) throw new Error('poisonous should kill the golem');

const rat2 = g.makeMinionFromCard(CARDS['plague_rat'], 0);
rat2.summonedThisTurn = false;
p0.board.push(rat2);
const shielded = g.makeMinionFromCard(CARDS['crusader'], 1);
g.players[1].board.push(shielded);
g.attack(0, rat2, shielded);
if (!g.players[1].board.includes(shielded) || shielded.health !== shielded.maxHealth)
  throw new Error('divine shield should stop poisonous');

// Windfury: two attacks per turn.
const hawk = g.makeMinionFromCard(CARDS['war_hawk'], 0);
hawk.summonedThisTurn = false;
p0.board.push(hawk);
g.players[1].board = [];
const foeHp = g.players[1].hero.health;
g.attack(0, hawk, g.players[1].hero);
const second = g.canAttack(0, hawk, g.players[1].hero);
if (!second.ok) throw new Error('windfury should allow a second attack: ' + second.reason);
g.attack(0, hawk, g.players[1].hero);
const third = g.canAttack(0, hawk, g.players[1].hero);
if (third.ok) throw new Error('windfury should stop after two attacks');

console.log('OK: unit checks passed (divine shield, deathrattle, armor, taunt, lightspawn, transform, poisonous, windfury)');
