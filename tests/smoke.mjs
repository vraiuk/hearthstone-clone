// Headless smoke test: AI vs AI full games + unit checks for mechanics.
import { Game, HERO_POWERS } from '../js/engine/game.js';
import { AI } from '../js/ai/ai.js';
import { CARDS, collectibleForClass } from '../js/data/cards.js';
import { STARTER_DECKS, CLASSES, validateDeck } from '../js/data/decks.js';
import { getCard } from '../js/data/cards.js';

// ---- data sanity: starter decks are legal, hero powers exist ----
for (const cls of Object.keys(CLASSES)) {
  const deck = STARTER_DECKS[cls];
  const v = validateDeck(deck, cls, getCard);
  if (!v.ok) throw new Error(`Starter deck ${cls}: ${v.reason}`);
  if (!HERO_POWERS[cls]) throw new Error(`No hero power for ${cls}`);
}
console.log('OK: starter decks valid, hero powers present for all 5 classes');

function basicDeck(cls) {
  const pool = collectibleForClass(cls).filter((c) => !c.token && !c.gloryCost);
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
    if (p.glory < 0) throw new Error(`${tag}: negative glory`);
  }
}

const classes = Object.keys(CLASSES);
let wins = [0, 0, 0];
let totalTurns = 0;
const GAMES = 50;

for (let i = 0; i < GAMES; i++) {
  const c0 = classes[i % classes.length];
  const c1 = classes[(i + 1 + (i >> 2)) % classes.length];
  // Mix starter decks and generated decks for coverage.
  const d0 = i % 2 === 0 ? STARTER_DECKS[c0].slice() : basicDeck(c0);
  const d1 = i % 3 === 0 ? STARTER_DECKS[c1].slice() : basicDeck(c1);
  const game = new Game({
    seed: 2000 + i,
    players: [
      { name: 'P0', hero: c0, deck: d0 },
      { name: 'P1', hero: c1, deck: d1 },
    ],
  });
  game.start(i % 2);
  const ai0 = new AI('hard');
  const ai1 = new AI('normal');
  let guard = 0;
  while (!game.over && guard++ < 200) {
    const pid = game.current;
    const ai = pid === 0 ? ai0 : ai1;
    await ai.takeTurn(game, pid, async () => checkInvariants(game, `game${i} t${game.turn}`));
    checkInvariants(game, `game${i} post-t${game.turn}`);
    if (!game.over) game.endTurn();
  }
  if (!game.over) throw new Error(`game ${i} (${c0} vs ${c1}) did not finish in 200 turns`);
  totalTurns += Math.ceil(game.turn / 2);
  if (game.winner === -1) wins[2]++;
  else wins[game.winner]++;
}
console.log(`OK: ${GAMES} games finished. P0(hard)=${wins[0]}, P1(normal)=${wins[1]}, draws=${wins[2]}`);
console.log(`Avg game length: ${(totalTurns / GAMES).toFixed(1)} turns`);

// ---- targeted unit checks ----
function freshGame() {
  const g = new Game({
    seed: 42,
    players: [
      { name: 'A', hero: 'vincent', deck: STARTER_DECKS.vincent.slice() },
      { name: 'B', hero: 'mrak', deck: STARTER_DECKS.mrak.slice() },
    ],
  });
  g.start(0);
  return g;
}

let g = freshGame();
const p0 = g.players[0], p1 = g.players[1];

// Divine shield absorbs one hit; dealDamage reports absorption.
const squire = g.makeMinionFromCard(CARDS['shield_disciple'], 0);
p0.board.push(squire);
if (g.dealDamage(squire, 5, {}) !== false) throw new Error('shield hit should report false');
if (squire.health !== 1 || squire.divineShield) throw new Error('divine shield failed');

// Deathrattle + Слава: exploding larva hits enemy hero; killer side gains glory.
const larva = g.makeMinionFromCard(CARDS['exploding_larva'], 1);
p1.board.push(larva);
const hpBefore = p0.hero.health;
const gloryBefore = p0.glory;
g.destroyEntity(larva);
g.processDeaths();
if (p0.hero.health !== hpBefore - 2) throw new Error('deathrattle failed');
if (p0.glory !== gloryBefore + 1) throw new Error('glory not awarded');

// Торк absorbs whole hits.
g.grantHeroShield(0, 2);
const h0 = p0.hero.health;
g.dealDamage(p0.hero, 9, {});
g.dealDamage(p0.hero, 9, {});
if (p0.hero.health !== h0) throw new Error('torq should absorb both hits');
g.dealDamage(p0.hero, 3, {});
if (p0.hero.health !== h0 - 3) throw new Error('torq should be exhausted');

// Живые Цепи: shackled minion cannot attack; permanent silence frees it.
const varg = g.makeMinionFromCard(CARDS['swift_varg'], 0);
varg.summonedThisTurn = false;
p0.board.push(varg);
g.current = 0;
g.shackleMinion(varg);
if (g.canAttack(0, varg, p1.hero).ok) throw new Error('shackle should block attack');
g.silenceMinion(varg);
if (!g.canAttack(0, varg, p1.hero).ok) throw new Error('silence should clear shackle');

// Temp silence expires after the victim's next turn begins.
const hawk = g.makeMinionFromCard(CARDS['sky_hawk'], 1);
p1.board.push(hawk);
g.tempSilence(hawk, 2);
if (!hawk.silenced) throw new Error('temp silence should apply');
g.beginTurn(1); g.beginTurn(0);
if (hawk.silenced) throw new Error('temp silence should expire');

// Боевой Доспех reflects the first enemy targeted rune.
g = freshGame();
const tolya = g.makeMinionFromCard(CARDS['tolya_grohot'], 1);
g.players[1].board.push(tolya);
g.current = 0;
g.players[0].mana = 10;
const lunge = g.players[0].hand.find((c) => c.id === 'hidden_lunge') ||
  (g.players[0].hand.push(g.makeCardInstance(CARDS['hidden_lunge'])), g.players[0].hand[g.players[0].hand.length - 1]);
g.playCard(0, lunge.instanceId, tolya);
if (tolya.health !== tolya.maxHealth) throw new Error('spellShield should reflect first rune');
if (tolya.spellShield) throw new Error('spellShield should be consumed');

// Связь: riding karkh gets +2 with another beast on board.
g = freshGame();
const karkh = g.makeMinionFromCard(CARDS['riding_karkh'], 0);
g.players[0].board.push(karkh);
if (g.effectiveAttack(karkh) !== 2) throw new Error('bond should be inactive alone');
g.players[0].board.push(g.makeMinionFromCard(CARDS['tauro_bull'], 0));
if (g.effectiveAttack(karkh) !== 4) throw new Error('bond should add +2 with ally beast');

// Stealth: cannot be attacked or targeted; breaks after attacking.
g = freshGame();
const dancer = g.makeMinionFromCard(CARDS['shadow_dancer'], 1);
dancer.summonedThisTurn = false;
g.players[1].board.push(dancer);
g.current = 0;
const att = g.makeMinionFromCard(CARDS['swift_varg'], 0);
att.summonedThisTurn = false;
g.players[0].board.push(att);
if (g.canAttack(0, att, dancer).ok) throw new Error('stealth should block attack');
g.current = 1;
g.attack(1, dancer, g.players[0].hero);
if (dancer.keywords.has('stealth')) throw new Error('stealth should break after attacking');

// Poisonous weapon: hero kills any minion it damages.
g = freshGame();
g.equipWeapon(0, 2, 2, { poisonous: true });
const big = g.makeMinionFromCard(CARDS['deep_horror'], 1);
big.summonedThisTurn = false;
g.players[1].board.push(big);
g.current = 0;
g.attack(0, g.players[0].hero, big);
if (g.players[1].board.includes(big)) throw new Error('poisonous weapon should kill');

// Матка Гнезда fills the board.
g = freshGame();
g.players[0].board.push(g.makeMinionFromCard(CARDS['nest_queen'], 0));
g.current = 0; g.players[0].mana = 10;
g.players[0].hand.push(g.makeCardInstance(CARDS['nest_queen']));
const nq = g.players[0].hand[g.players[0].hand.length - 1];
g.playCard(0, nq.instanceId, null);
if (g.players[0].board.length !== 7) throw new Error('nest queen should fill board to 7, got ' + g.players[0].board.length);

// Титульная карта requires glory.
g = freshGame();
g.players[0].mana = 10;
g.players[0].hand.push(g.makeCardInstance(CARDS['herald_ascension']));
const herald = g.players[0].hand[g.players[0].hand.length - 1];
let res = g.playCard(0, herald.instanceId, null);
if (res.ok) throw new Error('titled card should need glory');
g.players[0].glory = 4;
res = g.playCard(0, herald.instanceId, null);
if (!res.ok) throw new Error('titled card should play with glory: ' + res.reason);
if (g.players[0].glory !== 0) throw new Error('glory should be spent');

// Сфера Пустоты blocks runes for both players.
g = freshGame();
g.current = 0; g.players[0].mana = 10;
g.lockSpells();
g.players[0].hand.push(g.makeCardInstance(CARDS['illumination']));
const ill = g.players[0].hand[g.players[0].hand.length - 1];
if (g.playCard(0, ill.instanceId, null).ok) throw new Error('spell lock should block runes');

// Временная Петля restores boards.
g = freshGame();
const guard1 = g.makeMinionFromCard(CARDS['tide_guard'], 1);
g.players[1].board.push(guard1);
g.beginTurn(1); g.beginTurn(0); // snapshot with guard on board (start of P0 turn)
g.destroyEntity(guard1); g.processDeaths();
if (g.players[1].board.length !== 0) throw new Error('guard should be dead');
g.beginTurn(1); g.beginTurn(0);
g.timeLoop(0); // back to start of P0's previous turn → guard alive
if (g.players[1].board.length !== 1) throw new Error('time loop should restore the board');

// Дикая Охота: beasts grow, current hero bleeds.
g = freshGame();
const beast = g.makeMinionFromCard(CARDS['tauro_bull'], 0);
g.players[0].board.push(beast);
g.startWildHunt();
const beastAtk = beast.attack;
const heroHp2 = g.players[1].hero.health;
g.beginTurn(1);
if (beast.attack !== beastAtk + 1) throw new Error('wild hunt should buff beasts');
if (g.players[1].hero.health !== heroHp2 - 1) throw new Error('wild hunt should damage the hero');

// Игг-Свет: double vs черви.
g = freshGame();
const worm = g.makeMinionFromCard(CARDS['nest_queen'], 1); // червь 3/6
g.players[1].board.push(worm);
g.current = 0; g.players[0].mana = 10;
g.players[0].hand.push(g.makeCardInstance(CARDS['igg_light']));
const light = g.players[0].hand[g.players[0].hand.length - 1];
g.playCard(0, light.instanceId, worm);
if (g.players[1].board.includes(worm)) throw new Error('igg light should deal 6 to червь (3+3)');

console.log('OK: unit checks passed (shield, deathrattle+glory, torq, chains, temp silence, spellShield, bond, stealth, poison weapon, nest fill, titled/glory, void sphere, time loop, wild hunt, igg light)');
