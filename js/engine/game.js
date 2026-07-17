// Core game engine. Owns all rules and state mutation. The UI and AI read
// state and call the public action methods (playCard, attack, useHeroPower,
// endTurn). Every state change funnels through the primitive methods here so
// death-processing and triggers stay consistent.

import { getCard, TOKENS, KEYWORDS } from '../data/cards.js';
import { resolveOps, resolveTargets } from './effects.js';

const MAX_BOARD = 7;
const MAX_HAND = 10;
const START_HEALTH = 30;
const MAX_MANA = 10;

let INSTANCE_COUNTER = 1;
function nextId() { return INSTANCE_COUNTER++; }

// A seeded RNG keeps games reproducible for tests; falls back to Math.random.
function makeRng(seed) {
  if (seed == null) return Math.random;
  let s = seed >>> 0;
  return function () {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export class Game {
  // config: { players:[{name,hero,deck:[cardId...]}], seed?, log? }
  constructor(config) {
    this.rng = makeRng(config.seed);
    this.log = [];
    this.onLog = config.log || null;
    this.pendingDeaths = [];
    this.winner = null;
    this.over = false;

    this.players = config.players.map((p, idx) => this.makePlayer(p, idx));
    this.current = 0;
    this.turn = 0;
  }

  makePlayer(p, idx) {
    const deck = this.shuffle(p.deck.map((id) => getCard(id)));
    const hero = {
      isHero: true,
      playerId: idx,
      heroClass: p.hero,
      name: p.name,
      health: START_HEALTH,
      maxHealth: START_HEALTH,
      armor: 0,
      attack: 0,          // from weapon + temp buffs
      tempAttack: 0,      // heroic-strike style, resets each turn
      attacksThisTurn: 0,
      frozen: false,
    };
    return {
      id: idx,
      name: p.name,
      heroClass: p.hero,
      hero,
      weapon: null,       // { attack, durability }
      mana: 0,
      maxMana: 0,
      overload: 0,
      hand: [],
      deck,
      board: [],
      fatigue: 0,
      heroPowerUsed: false,
    };
  }

  // ---- utility ----
  emit(msg) { this.log.push(msg); if (this.onLog) this.onLog(msg); }
  enemyOf(id) { return id === 0 ? 1 : 0; }
  pickRandom(arr) { return arr[Math.floor(this.rng() * arr.length)]; }
  shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  spellDamageOf(playerId) {
    return this.players[playerId].board.reduce(
      (sum, m) => sum + (m.silenced ? 0 : (m.spellDamage || 0)), 0);
  }

  // ---- setup / mulligan ----
  start(firstPlayer = 0) {
    this.current = firstPlayer;
    // Opening hands: first player 3 cards, second 4 + "The Coin".
    for (const p of this.players) {
      const count = p.id === firstPlayer ? 3 : 4;
      for (let i = 0; i < count; i++) this.drawCard(p.id, true);
    }
    const second = this.players[this.enemyOf(firstPlayer)];
    second.hand.push(this.makeCardInstance({
      id: 'the_coin', name: 'Монета', cost: 0, type: 'spell', class: 'neutral',
      art: '🪙', theme: 'arcane', text: 'Даёт кристалл маны в этом ходу.',
      spell: { ops: [{ op: '__coin' }] },
    }));
    this.turn = 0;
    this.beginTurn(firstPlayer);
  }

  makeCardInstance(card) {
    return { ...card, instanceId: nextId() };
  }

  // ---- drawing ----
  drawCard(playerId, silent = false) {
    const p = this.players[playerId];
    if (p.deck.length === 0) {
      p.fatigue += 1;
      this.dealDamage(p.hero, p.fatigue, { fatigue: true });
      this.emit(`${p.name} измотан и получает ${p.fatigue} урона!`);
      this.processDeaths();
      return null;
    }
    const card = this.makeCardInstance(p.deck.shift());
    if (p.hand.length >= MAX_HAND) {
      this.emit(`Рука ${p.name} переполнена — карта «${card.name}» сгорает.`);
      return null;
    }
    p.hand.push(card);
    if (!silent) this.emit(`${p.name} берёт карту.`);
    return card;
  }

  // ---- turn flow ----
  beginTurn(playerId) {
    this.current = playerId;
    this.turn += 1;
    const p = this.players[playerId];
    p.maxMana = Math.min(MAX_MANA, p.maxMana + 1);
    p.mana = Math.max(0, p.maxMana - p.overload);
    p.overload = 0;
    p.heroPowerUsed = false;
    p.hero.tempAttack = 0;
    p.hero.attacksThisTurn = 0;
    // Refresh hero attack (weapon persists between turns).
    this.recalcHeroAttack(playerId);

    // Un-freeze / ready minions.
    for (const m of p.board) {
      m.summonedThisTurn = false;
      m.attacksThisTurn = 0;
      if (m.frozenNextTurn) { m.frozenNextTurn = false; }
      else m.frozen = false;
      m.canAttack = !m.frozen;
    }
    if (p.hero.frozenNextTurn) { p.hero.frozenNextTurn = false; } else p.hero.frozen = false;

    this.emit(`— Ход ${Math.ceil(this.turn / 2)}: ходит ${p.name} —`);
    if (this.turn > 1) this.drawCard(playerId);
  }

  endTurn() {
    if (this.over) return;
    const next = this.enemyOf(this.current);
    this.beginTurn(next);
  }

  // ---- hero attack / weapons ----
  recalcHeroAttack(playerId) {
    const p = this.players[playerId];
    const weaponAtk = p.weapon ? p.weapon.attack : 0;
    p.hero.attack = weaponAtk + p.hero.tempAttack;
  }
  grantHeroAttack(playerId, amount) {
    const p = this.players[playerId];
    p.hero.tempAttack += amount;
    this.recalcHeroAttack(playerId);
    this.emit(`${p.name}: герой получает +${amount} к атаке.`);
  }
  equipWeapon(playerId, attack, durability) {
    const p = this.players[playerId];
    p.weapon = { attack, durability };
    this.recalcHeroAttack(playerId);
    this.emit(`${p.name} берёт оружие ${attack}/${durability}.`);
  }
  degradeWeapon(playerId) {
    const p = this.players[playerId];
    if (!p.weapon) return;
    p.weapon.durability -= 1;
    if (p.weapon.durability <= 0) {
      p.weapon = null;
      this.emit(`Оружие ${p.name} сломалось.`);
    }
    this.recalcHeroAttack(playerId);
  }

  // ---- minion creation ----
  makeMinionFromCard(card, ownerId) {
    const keywords = new Set(card.keywords || []);
    return {
      instanceId: nextId(),
      cardId: card.id,
      owner: ownerId,
      name: card.name,
      art: card.art,
      theme: card.theme,
      attack: card.attack,
      health: card.health,
      maxHealth: card.health,
      keywords,
      divineShield: keywords.has('divineShield'),
      spellDamage: card.spellDamage || 0,
      deathrattle: card.deathrattle || null,
      battlecry: card.battlecry || null,
      freezeOnDamage: !!card.freezeOnDamage,
      attackEqualsHealth: !!card.attackEqualsHealth,
      frozen: false,
      silenced: false,
      summonedThisTurn: true,
      canAttack: keywords.has('charge') || keywords.has('rush'),
      attacksThisTurn: 0,
      maxAttacks: keywords.has('windfury') ? 2 : 1,
    };
  }

  summonToken(playerId, tokenKey) {
    const def = TOKENS[tokenKey];
    if (!def) { console.warn('Unknown token', tokenKey); return null; }
    const p = this.players[playerId];
    if (p.board.length >= MAX_BOARD) return null;
    const card = { id: 'token_' + tokenKey, ...def };
    const m = this.makeMinionFromCard(card, playerId);
    p.board.push(m);
    this.normalizeMinion(m);
    this.emit(`${p.name} призывает «${def.name}».`);
    return m;
  }

  // ---- playing cards ----
  // Returns { ok, reason } — UI validates before calling.
  canPlayCard(playerId, instanceId, chosen) {
    const p = this.players[playerId];
    const card = p.hand.find((c) => c.instanceId === instanceId);
    if (!card) return { ok: false, reason: 'Карты нет в руке.' };
    if (playerId !== this.current) return { ok: false, reason: 'Не ваш ход.' };
    if (card.cost > p.mana) return { ok: false, reason: 'Недостаточно маны.' };
    if (card.type === 'minion' && p.board.length >= MAX_BOARD)
      return { ok: false, reason: 'Поле заполнено.' };
    if (this.cardNeedsTarget(card)) {
      const valid = this.validTargets(playerId, card);
      if (valid.length === 0) {
        // A card that requires a target with no valid targets can't be cast
        // if it's a spell whose only effect is targeting.
        if (card.type === 'spell') return { ok: false, reason: 'Нет целей.' };
      } else if (chosen && !valid.includes(chosen)) {
        return { ok: false, reason: 'Недопустимая цель.' };
      }
    }
    return { ok: true };
  }

  cardNeedsTarget(card) {
    const eff = card.battlecry || card.spell;
    return !!(eff && eff.targeted);
  }

  // All legal targets for a targeted card.
  validTargets(playerId, card) {
    const eff = card.battlecry || card.spell;
    if (!eff || !eff.targeted) return [];
    const filter = eff.targetFilter || 'any';
    const me = this.players[playerId];
    const foe = this.players[this.enemyOf(playerId)];
    const all = [];
    const addMinions = (arr, side) => arr.forEach((m) => all.push({ e: m, side }));
    addMinions(me.board, 'friendly');
    addMinions(foe.board, 'enemy');
    const heroes = [{ e: me.hero, side: 'friendly' }, { e: foe.hero, side: 'enemy' }];

    let pool;
    switch (filter) {
      case 'friendlyMinion': pool = all.filter((x) => x.side === 'friendly'); break;
      case 'enemyMinion': pool = all.filter((x) => x.side === 'enemy'); break;
      case 'minion': pool = all; break;
      case 'damagedEnemyMinion':
        pool = all.filter((x) => x.side === 'enemy' && x.e.health < x.e.maxHealth); break;
      case 'lowAttackMinion': pool = all.filter((x) => this.effectiveAttack(x.e) <= 3); break;
      case 'highAttackMinion': pool = all.filter((x) => this.effectiveAttack(x.e) >= 5); break;
      case 'any':
      default:
        pool = [...all, ...heroes];
    }
    // Stealthed minions can still be targeted by your own effects but not enemy;
    // we keep it simple: stealth not used on collectible targets here.
    return pool.map((x) => x.e);
  }

  playCard(playerId, instanceId, chosen = null) {
    const check = this.canPlayCard(playerId, instanceId, chosen);
    if (!check.ok) return check;
    const p = this.players[playerId];
    const idx = p.hand.findIndex((c) => c.instanceId === instanceId);
    const card = p.hand[idx];
    p.hand.splice(idx, 1);
    p.mana -= card.cost;

    const ctx = { casterId: playerId, chosen };

    if (card.type === 'minion') {
      const m = this.makeMinionFromCard(card, playerId);
      p.board.push(m);
      this.normalizeMinion(m);
      this.emit(`${p.name} разыгрывает «${card.name}».`);
      ctx.source = m;
      if (card.battlecry) resolveOps(this, card.battlecry.ops, ctx, { isSpell: false });
    } else if (card.type === 'weapon') {
      this.emit(`${p.name} разыгрывает «${card.name}».`);
      resolveOps(this, card.spell.ops, ctx, { isSpell: false });
    } else { // spell
      this.emit(`${p.name} применяет «${card.name}».`);
      if (card.spell.ops.some((o) => o.op === '__coin')) {
        p.mana = Math.min(MAX_MANA, p.mana + 1);
      } else {
        resolveOps(this, card.spell.ops, ctx, { isSpell: true });
      }
    }
    this.processDeaths();
    this.checkWin();
    return { ok: true };
  }

  // ---- hero power ----
  heroPowerInfo(cls) { return HERO_POWERS[cls]; }

  canUseHeroPower(playerId, chosen) {
    const p = this.players[playerId];
    if (playerId !== this.current) return { ok: false, reason: 'Не ваш ход.' };
    if (p.heroPowerUsed) return { ok: false, reason: 'Способность уже использована.' };
    if (p.mana < 2) return { ok: false, reason: 'Нужно 2 маны.' };
    const hp = HERO_POWERS[p.heroClass];
    if (hp.targeted) {
      const valid = this.heroPowerTargets(playerId);
      if (valid.length === 0) return { ok: false, reason: 'Нет целей.' };
      if (chosen && !valid.includes(chosen)) return { ok: false, reason: 'Недопустимая цель.' };
    }
    return { ok: true };
  }

  heroPowerTargets(playerId) {
    const me = this.players[playerId];
    const foe = this.players[this.enemyOf(playerId)];
    const hp = HERO_POWERS[me.heroClass];
    if (hp.id === 'fireblast') // any character
      return [...me.board, ...foe.board, me.hero, foe.hero];
    if (hp.id === 'heal') // any character (heal)
      return [...me.board, ...foe.board, me.hero, foe.hero];
    return [];
  }

  useHeroPower(playerId, chosen = null) {
    const check = this.canUseHeroPower(playerId, chosen);
    if (!check.ok) return check;
    const p = this.players[playerId];
    p.mana -= 2;
    p.heroPowerUsed = true;
    const hp = HERO_POWERS[p.heroClass];
    this.emit(`${p.name}: ${hp.name}.`);
    const ctx = { casterId: playerId, chosen };
    resolveOps(this, hp.ops, ctx, { isSpell: false });
    this.processDeaths();
    this.checkWin();
    return { ok: true };
  }

  // ---- attacking ----
  effectiveAttack(entity) {
    if (entity.isHero) return entity.attack;
    if (entity.attackEqualsHealth && !entity.silenced) return entity.health;
    return entity.attack;
  }

  canAttack(playerId, attacker, target) {
    if (playerId !== this.current) return { ok: false, reason: 'Не ваш ход.' };
    if (attacker.owner !== undefined && attacker.owner !== playerId && !attacker.isHero)
      return { ok: false, reason: 'Чужое существо.' };
    if (attacker.isHero && attacker.playerId !== playerId)
      return { ok: false, reason: 'Чужой герой.' };
    if (attacker.frozen) return { ok: false, reason: 'Существо заморожено.' };
    if (this.effectiveAttack(attacker) <= 0) return { ok: false, reason: 'Нулевая атака.' };

    if (attacker.isHero) {
      if (attacker.attacksThisTurn >= 1) return { ok: false, reason: 'Герой уже атаковал.' };
    } else {
      if (attacker.summonedThisTurn && !attacker.keywords.has('charge') && !attacker.keywords.has('rush'))
        return { ok: false, reason: 'Существо не готово.' };
      if (attacker.attacksThisTurn >= attacker.maxAttacks)
        return { ok: false, reason: 'Уже атаковало.' };
      // Rush minions can only hit minions on the turn they're summoned.
      if (attacker.summonedThisTurn && attacker.keywords.has('rush') && !attacker.keywords.has('charge') && target.isHero)
        return { ok: false, reason: 'Натиск: только по существам в первый ход.' };
    }

    // Taunt enforcement.
    const foe = this.players[this.enemyOf(playerId)];
    const taunts = foe.board.filter((m) => m.keywords.has('taunt') && !m.silenced);
    if (taunts.length > 0 && !(target.owner === undefined ? false : false)) {
      const targetIsTaunt = !target.isHero && target.keywords.has('taunt') && !target.silenced;
      if (!targetIsTaunt) return { ok: false, reason: 'Сначала нужно уничтожить существо с провокацией.' };
    }
    return { ok: true };
  }

  attack(playerId, attacker, target) {
    const check = this.canAttack(playerId, attacker, target);
    if (!check.ok) return check;

    const atkVal = this.effectiveAttack(attacker);
    const defVal = this.effectiveAttack(target);
    const aName = attacker.isHero ? this.players[attacker.playerId].name : attacker.name;
    const tName = target.isHero ? this.players[target.playerId].name : target.name;
    this.emit(`${aName} атакует ${tName}.`);

    // Simultaneous combat damage. dealDamage reports whether damage landed
    // (false when a divine shield absorbed the hit).
    const hitTarget = this.dealDamage(target, atkVal, attacker);
    const hitAttacker = defVal > 0 ? this.dealDamage(attacker, defVal, target) : false;

    // freezeOnDamage (Water Elemental).
    if (!attacker.isHero && attacker.freezeOnDamage && hitTarget) this.freezeEntity(target);
    if (!target.isHero && target.freezeOnDamage && hitAttacker) this.freezeEntity(attacker);

    // Poisonous: any minion actually damaged by a poisonous minion dies.
    if (!attacker.isHero && attacker.keywords.has('poisonous') && !attacker.silenced &&
        !target.isHero && hitTarget) this.destroyEntity(target);
    if (!target.isHero && target.keywords.has('poisonous') && !target.silenced &&
        !attacker.isHero && hitAttacker) this.destroyEntity(attacker);

    // Lifesteal.
    if (!attacker.isHero && attacker.keywords.has('lifesteal') && atkVal > 0)
      this.healEntity(this.players[playerId].hero, atkVal);

    attacker.attacksThisTurn = (attacker.attacksThisTurn || 0) + 1;
    if (attacker.isHero) this.degradeWeapon(playerId);

    this.processDeaths();
    this.checkWin();
    return { ok: true };
  }

  // ---- primitive mutations ----
  isAlive(entity) {
    if (entity.isHero) return entity.health > 0;
    return this.players[entity.owner]?.board.includes(entity) && entity.health > 0;
  }

  // Returns true when damage actually landed (false: absorbed by shield).
  dealDamage(entity, amount, source) {
    if (amount <= 0) return false;
    if (!entity.isHero && entity.divineShield && !entity.silenced) {
      entity.divineShield = false;
      entity.keywords.delete('divineShield');
      this.emit(`Божественный щит «${entity.name}» поглощает урон.`);
      return false;
    }
    if (entity.isHero) {
      let dmg = amount;
      if (entity.armor > 0) {
        const absorbed = Math.min(entity.armor, dmg);
        entity.armor -= absorbed;
        dmg -= absorbed;
      }
      entity.health -= dmg;
    } else {
      entity.health -= amount;
      this.normalizeMinion(entity);
      if (entity.health <= 0 && !this.pendingDeaths.includes(entity))
        this.pendingDeaths.push(entity);
    }
    return true;
  }

  healEntity(entity, amount) {
    if (amount <= 0) return;
    const before = entity.health;
    entity.health = Math.min(entity.maxHealth, entity.health + amount);
    const healed = entity.health - before;
    if (healed > 0) {
      const n = entity.isHero ? this.players[entity.playerId].name : entity.name;
      this.emit(`«${n}» восстанавливает ${healed} здоровья.`);
    }
    if (!entity.isHero) this.normalizeMinion(entity);
  }

  buffMinion(minion, atk, hp, keywords = []) {
    if (minion.isHero) return;
    minion.attack += atk;
    minion.maxHealth += hp;
    minion.health += hp;
    for (const k of keywords) {
      minion.keywords.add(k);
      if (k === 'divineShield') minion.divineShield = true;
      if (k === 'windfury') minion.maxAttacks = 2;
    }
    this.normalizeMinion(minion);
  }

  silenceMinion(minion) {
    if (minion.isHero) return;
    minion.silenced = true;
    minion.keywords = new Set();
    minion.divineShield = false;
    minion.deathrattle = null;
    minion.spellDamage = 0;
    minion.freezeOnDamage = false;
    minion.frozen = false;
    minion.attackEqualsHealth = false;
    minion.maxAttacks = 1;
    this.emit(`«${minion.name}» становится немым.`);
  }

  freezeEntity(entity) {
    // Frozen now; if it hasn't acted it thaws next turn. We freeze until the
    // owner's next turn begins.
    entity.frozen = true;
    entity.frozenNextTurn = true;
    entity.canAttack = false;
    const n = entity.isHero ? this.players[entity.playerId].name : entity.name;
    this.emit(`«${n}» заморожен.`);
  }

  destroyEntity(entity) {
    if (entity.isHero) { entity.health = 0; return; }
    entity.health = 0;
    if (!this.pendingDeaths.includes(entity)) this.pendingDeaths.push(entity);
  }

  transformMinion(minion, tokenKey) {
    if (minion.isHero) return;
    const def = TOKENS[tokenKey];
    const p = this.players[minion.owner];
    const idx = p.board.indexOf(minion);
    if (idx === -1) return;
    const card = { id: 'token_' + tokenKey, ...def };
    const fresh = this.makeMinionFromCard(card, minion.owner);
    fresh.summonedThisTurn = false; // transform keeps board presence
    p.board[idx] = fresh;
    this.emit(`«${minion.name}» превращается в «${def.name}».`);
  }

  gainArmor(playerId, amount) {
    this.players[playerId].hero.armor += amount;
    this.emit(`${this.players[playerId].name} получает ${amount} брони.`);
  }

  // Keep derived stats consistent (e.g. Lightspawn's attack = health).
  normalizeMinion(m) {
    if (m.attackEqualsHealth && !m.silenced) m.attack = Math.max(0, m.health);
    if (m.health > m.maxHealth) m.health = m.maxHealth;
  }

  // Remove dead minions, firing deathrattles. Loops until stable.
  processDeaths() {
    let guard = 0;
    while (this.pendingDeaths.length > 0 && guard++ < 50) {
      const dying = this.pendingDeaths.filter((m) => m.health <= 0);
      this.pendingDeaths = [];
      if (dying.length === 0) break;
      for (const m of dying) {
        const p = this.players[m.owner];
        const idx = p.board.indexOf(m);
        if (idx === -1) continue;
        p.board.splice(idx, 1);
        this.emit(`«${m.name}» уничтожен.`);
        if (m.deathrattle && !m.silenced) {
          resolveOps(this, m.deathrattle.ops, { casterId: m.owner, source: m }, { isSpell: false });
        }
      }
    }
    this.checkWin();
  }

  checkWin() {
    if (this.over) return;
    const dead0 = this.players[0].hero.health <= 0;
    const dead1 = this.players[1].hero.health <= 0;
    if (dead0 || dead1) {
      this.over = true;
      if (dead0 && dead1) this.winner = -1; // draw
      else this.winner = dead0 ? 1 : 0;
      this.emit(this.winner === -1 ? 'Ничья!' : `${this.players[this.winner].name} побеждает!`);
    }
  }
}

// Hero powers per class (2 mana each).
export const HERO_POWERS = {
  mage:   { id: 'fireblast', name: 'Прилив огня', desc: 'Наносит 1 ед. урона.', icon: '🔥', targeted: true, ops: [{ op: 'damage', target: 'chosen', amount: 1 }] },
  warrior:{ id: 'armor_up',  name: 'Наращивание брони', desc: 'Даёт 2 ед. брони.', icon: '🛡️', targeted: false, ops: [{ op: 'armor', amount: 2 }] },
  priest: { id: 'heal',      name: 'Малое исцеление', desc: 'Восстанавливает 2 ед. здоровья.', icon: '✨', targeted: true, ops: [{ op: 'heal', target: 'chosen', amount: 2 }] },
  hunter: { id: 'steady_shot', name: 'Меткий выстрел', desc: 'Наносит 2 ед. урона герою противника.', icon: '🏹', targeted: false, ops: [{ op: 'damage', target: 'enemyHero', amount: 2 }] },
};

export { KEYWORDS, MAX_BOARD };
