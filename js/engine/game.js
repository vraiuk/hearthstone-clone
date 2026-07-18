// Core game engine for «Звёздная Кровь». Owns all rules and state mutation.
// The UI and AI read state and call the public action methods (playCard,
// attack, useHeroPower, endTurn). Every state change funnels through the
// primitive methods here so death-processing and triggers stay consistent.
//
// Setting glossary: mana = Звёздная Кровь, spells = Руны, heroes = Восходящие,
// hero powers = Аспекты, kill-reward resource = Слава (gates Титульные cards).

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
    this.onEvent = config.onEvent || null;  // VFX hook: {type, target?, amount?}
    this.pendingDeaths = [];
    this.winner = null;
    this.over = false;

    this.spellLockUntil = 0;   // Сфера Пустоты: no runes while turn < this
    this.wildHunt = false;     // Дикая Охота active
    this.boardSnapshots = [];  // for Временная Петля

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
      shieldCharges: 0,   // Торк: absorbs whole hits
      attack: 0,          // from weapon + temp buffs
      tempAttack: 0,      // resets each turn
      attacksThisTurn: 0,
      frozen: false,
    };
    return {
      id: idx,
      name: p.name,
      heroClass: p.hero,
      hero,
      weapon: null,       // { attack, durability, stunAdjacent?, poisonous? }
      mana: 0,
      maxMana: 0,
      glory: 0,           // Слава: earned per enemy minion killed
      hand: [],
      deck,
      board: [],
      fatigue: 0,
      heroPowerUsed: false,
    };
  }

  // ---- utility ----
  emit(msg) { this.log.push(msg); if (this.onLog) this.onLog(msg); }
  fx(event) { if (this.onEvent) this.onEvent(event); }
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

  // ---- setup ----
  start(firstPlayer = 0) {
    this.current = firstPlayer;
    for (const p of this.players) {
      const count = p.id === firstPlayer ? 3 : 4;
      for (let i = 0; i < count; i++) this.drawCard(p.id, true);
    }
    const second = this.players[this.enemyOf(firstPlayer)];
    second.hand.push(this.makeCardInstance({
      id: 'star_drop', name: 'Капля Звёздной Крови', cost: 0, type: 'spell', class: 'neutral',
      art: '🩸', theme: 'arcane', text: 'Даёт 1 ед. Звёздной Крови в этом ходу.',
      spell: { ops: [{ op: '__coin' }] },
    }));
    this.turn = 0;
    this.beginTurn(firstPlayer);
  }

  makeCardInstance(card) {
    return { ...card, instanceId: nextId() };
  }

  // ---- drawing / hand ----
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
      this.emit(`Рука ${p.name} переполнена — руна «${card.name}» рассыпается.`);
      return null;
    }
    p.hand.push(card);
    if (!silent) this.emit(`${p.name} берёт руну.`);
    return card;
  }

  addCardToHand(playerId, cardId) {
    const p = this.players[playerId];
    if (p.hand.length >= MAX_HAND) return null;
    const card = this.makeCardInstance(getCard(cardId));
    p.hand.push(card);
    this.emit(`${p.name} получает «${card.name}».`);
    return card;
  }

  stealRandomCard(playerId) {
    const me = this.players[playerId];
    const foe = this.players[this.enemyOf(playerId)];
    if (!foe.hand.length || me.hand.length >= MAX_HAND) return null;
    const idx = Math.floor(this.rng() * foe.hand.length);
    const [card] = foe.hand.splice(idx, 1);
    me.hand.push(card);
    this.emit(`${me.name} похищает карту из руки ${foe.name}!`);
    return card;
  }

  // ---- turn flow ----
  beginTurn(playerId) {
    this.current = playerId;
    this.turn += 1;
    const p = this.players[playerId];
    p.maxMana = Math.min(MAX_MANA, p.maxMana + 1);
    p.mana = p.maxMana;
    p.heroPowerUsed = false;
    p.hero.tempAttack = 0;
    p.hero.attacksThisTurn = 0;
    this.recalcHeroAttack(playerId);

    // Snapshot boards for Временная Петля BEFORE start-of-turn effects.
    this.boardSnapshots.push({ turn: this.turn, player: playerId, boards: this.serializeBoards() });
    if (this.boardSnapshots.length > 8) this.boardSnapshots.shift();

    // Ready minions, thaw, expire temp silences.
    for (const pl of this.players) {
      for (const m of pl.board) {
        if (m.tempSilence > 0) {
          m.tempSilence -= 1;
          if (m.tempSilence === 0 && !m.permSilenced) {
            m.silenced = false;
            this.emit(`«${m.name}» вновь обретает голос.`);
          }
        }
      }
    }
    for (const m of p.board) {
      m.summonedThisTurn = false;
      m.attacksThisTurn = 0;
      if (m.frozenNextTurn) { m.frozenNextTurn = false; }
      else m.frozen = false;
      m.canAttack = !m.frozen;
    }
    if (p.hero.frozenNextTurn) { p.hero.frozenNextTurn = false; } else p.hero.frozen = false;

    this.emit(`— Ход ${Math.ceil(this.turn / 2)}: ходит ${p.name} —`);

    // Дикая Охота: beasts grow, the Ascendant whose turn begins bleeds.
    if (this.wildHunt) {
      for (const pl of this.players)
        for (const m of pl.board)
          if (m.tribe === 'зверь' && !m.silenced) m.attack += 1;
      this.emit('Дикая Охота: звери свирепеют!');
      this.dealDamage(p.hero, 1, { wildHunt: true });
      this.emit(`Дикая Охота ранит ${p.name}.`);
      this.processDeaths();
      if (this.over) return;
    }

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
  equipWeapon(playerId, attack, durability, mods = {}) {
    const p = this.players[playerId];
    p.weapon = { attack, durability, ...mods };
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
  grantHeroShield(playerId, charges) {
    this.players[playerId].hero.shieldCharges = charges;
    this.emit(`${this.players[playerId].name}: Торк поглотит следующие ${charges} удара.`);
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
      faction: card.faction || null,
      tribe: card.tribe || null,
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
      spellShield: !!card.spellShield,   // Боевой Доспех: reflects first rune
      bond: card.bond || null,           // Связь: +atk while ally tribe on board
      frozen: false,
      silenced: false,
      permSilenced: false,
      tempSilence: 0,
      shackled: false,                   // Живые Цепи
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

  copyMinion(playerId, source) {
    if (source.isHero) return null;
    const p = this.players[playerId];
    if (p.board.length >= MAX_BOARD) return null;
    const m = {
      ...source,
      instanceId: nextId(),
      owner: playerId,
      keywords: new Set(source.keywords),
      summonedThisTurn: true,
      attacksThisTurn: 0,
      canAttack: source.keywords.has('charge') || source.keywords.has('rush'),
      frozen: false, frozenNextTurn: false,
    };
    p.board.push(m);
    this.emit(`${p.name} создаёт копию «${source.name}».`);
    return m;
  }

  bounceMinion(m) {
    if (m.isHero) return;
    const p = this.players[m.owner];
    const idx = p.board.indexOf(m);
    if (idx === -1) return;
    p.board.splice(idx, 1);
    // Tokens vanish; real cards return to hand if there is room.
    const isToken = String(m.cardId).startsWith('token_');
    if (!isToken && p.hand.length < MAX_HAND) {
      p.hand.push(this.makeCardInstance(getCard(m.cardId)));
      this.emit(`«${m.name}» возвращается в руку ${p.name}.`);
    } else {
      this.emit(`«${m.name}» исчезает с поля.`);
    }
  }

  // ---- playing cards ----
  canPlayCard(playerId, instanceId, chosen) {
    const p = this.players[playerId];
    const card = p.hand.find((c) => c.instanceId === instanceId);
    if (!card) return { ok: false, reason: 'Карты нет в руке.' };
    if (playerId !== this.current) return { ok: false, reason: 'Не ваш ход.' };
    if (card.cost > p.mana) return { ok: false, reason: 'Недостаточно Звёздной Крови.' };
    if (card.gloryCost && p.glory < card.gloryCost)
      return { ok: false, reason: `Титульная карта: нужно ${card.gloryCost} Славы (у вас ${p.glory}).` };
    if (card.type === 'spell' && this.turn < this.spellLockUntil && !card.spell?.ops?.some((o) => o.op === '__coin'))
      return { ok: false, reason: 'Сфера Пустоты: Руны запечатаны!' };
    if (card.type === 'minion' && p.board.length >= MAX_BOARD)
      return { ok: false, reason: 'Поле заполнено.' };
    if (this.cardNeedsTarget(card)) {
      const valid = this.validTargets(playerId, card);
      if (valid.length === 0) {
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

  // All legal targets for a targeted card. Enemy stealth minions are untargetable.
  validTargets(playerId, card) {
    const eff = card.battlecry || card.spell;
    if (!eff || !eff.targeted) return [];
    const filter = eff.targetFilter || 'any';
    const me = this.players[playerId];
    const foe = this.players[this.enemyOf(playerId)];
    const all = [];
    me.board.forEach((m) => all.push({ e: m, side: 'friendly' }));
    foe.board.forEach((m) => {
      if (!(m.keywords.has('stealth') && !m.silenced)) all.push({ e: m, side: 'enemy' });
    });
    const heroes = [{ e: me.hero, side: 'friendly' }, { e: foe.hero, side: 'enemy' }];

    let pool;
    switch (filter) {
      case 'friendlyMinion': pool = all.filter((x) => x.side === 'friendly'); break;
      case 'enemyMinion': pool = all.filter((x) => x.side === 'enemy'); break;
      case 'minion': pool = all; break;
      case 'damagedEnemyMinion':
        pool = all.filter((x) => x.side === 'enemy' && x.e.health < x.e.maxHealth); break;
      case 'undamagedMinion':
        pool = all.filter((x) => x.e.health >= x.e.maxHealth); break;
      case 'lowAttackMinion': pool = all.filter((x) => this.effectiveAttack(x.e) <= 3); break;
      case 'highAttackMinion': pool = all.filter((x) => this.effectiveAttack(x.e) >= 5); break;
      case 'any':
      default:
        pool = [...all, ...heroes];
    }
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
    if (card.gloryCost) p.glory -= card.gloryCost;

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
    } else { // spell (Руна)
      this.emit(`${p.name} применяет руну «${card.name}».`);
      if (card.spell.ops.some((o) => o.op === '__coin')) {
        p.mana = Math.min(MAX_MANA, p.mana + 1);
      } else if (chosen && !chosen.isHero && chosen.spellShield && chosen.owner !== playerId && card.spell.targeted) {
        // Боевой Доспех: the first enemy rune aimed at this minion fizzles.
        chosen.spellShield = false;
        this.emit(`Боевой Доспех «${chosen.name}» отражает руну!`);
      } else {
        resolveOps(this, card.spell.ops, ctx, { isSpell: true });
      }
    }
    this.processDeaths();
    this.checkWin();
    return { ok: true };
  }

  // ---- special mechanics ----
  lockSpells() {
    this.spellLockUntil = this.turn + 2; // rest of this turn + opponent's next
    this.emit('Сфера Пустоты: Руны запечатаны для обоих Восходящих!');
  }

  startWildHunt() {
    this.wildHunt = true;
    this.emit('Начинается Дикая Охота! Звери крепнут, Восходящие истекают кровью.');
  }

  serializeBoards() {
    return this.players.map((p) => p.board.map((m) => ({ ...m, keywords: [...m.keywords] })));
  }

  timeLoop(casterId) {
    // Find the snapshot taken at the start of the caster's PREVIOUS turn.
    const snaps = this.boardSnapshots.filter((s) => s.player === casterId && s.turn < this.turn);
    const snap = snaps[snaps.length - 1];
    if (!snap) { this.emit('Временная Петля рассеивается — прошлое ещё не написано.'); return; }
    this.pendingDeaths = [];
    this.players.forEach((p, i) => {
      p.board = snap.boards[i].map((m) => ({
        ...m,
        keywords: new Set(m.keywords),
        summonedThisTurn: false,
        attacksThisTurn: 0,
        frozen: false, frozenNextTurn: false,
        canAttack: true,
      }));
    });
    this.emit('⏳ Временная Петля! Стол возвращается к началу прошлого хода.');
  }

  // ---- hero power (Аспект) ----
  heroPowerInfo(cls) { return HERO_POWERS[cls]; }
  heroPowerCost(cls) { return HERO_POWERS[cls].cost ?? 2; }

  canUseHeroPower(playerId, chosen) {
    const p = this.players[playerId];
    const hp = HERO_POWERS[p.heroClass];
    const cost = hp.cost ?? 2;
    if (playerId !== this.current) return { ok: false, reason: 'Не ваш ход.' };
    if (p.heroPowerUsed) return { ok: false, reason: 'Аспект уже использован.' };
    if (p.mana < cost) return { ok: false, reason: `Нужно ${cost} ед. Звёздной Крови.` };
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
    const targetableEnemies = foe.board.filter((m) => !(m.keywords.has('stealth') && !m.silenced));
    if (hp.id === 'ghost_hand') // enemy characters or own hero (armor)
      return [...targetableEnemies, foe.hero, me.hero];
    if (hp.id === 'mind_surge') // enemy minions
      return targetableEnemies;
    return [];
  }

  useHeroPower(playerId, chosen = null) {
    const check = this.canUseHeroPower(playerId, chosen);
    if (!check.ok) return check;
    const p = this.players[playerId];
    const hp = HERO_POWERS[p.heroClass];
    p.mana -= hp.cost ?? 2;
    p.heroPowerUsed = true;
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
    let atk = entity.attack;
    if (entity.attackEqualsHealth && !entity.silenced) atk = entity.health;
    // Связь: bonus while another minion of the required tribe is on your board.
    if (entity.bond && !entity.silenced) {
      const allies = this.players[entity.owner].board;
      if (allies.some((o) => o !== entity && o.tribe === entity.bond.requires))
        atk += entity.bond.attack;
    }
    return atk;
  }

  canAttack(playerId, attacker, target) {
    if (playerId !== this.current) return { ok: false, reason: 'Не ваш ход.' };
    if (attacker.owner !== undefined && attacker.owner !== playerId && !attacker.isHero)
      return { ok: false, reason: 'Чужое существо.' };
    if (attacker.isHero && attacker.playerId !== playerId)
      return { ok: false, reason: 'Чужой герой.' };
    if (attacker.frozen) return { ok: false, reason: 'Заморожен.' };
    if (!attacker.isHero && attacker.shackled) return { ok: false, reason: 'Сковано Живыми Цепями.' };
    if (this.effectiveAttack(attacker) <= 0) return { ok: false, reason: 'Нулевая атака.' };

    // Stealth: cannot be attacked directly.
    if (!target.isHero && target.keywords.has('stealth') && !target.silenced)
      return { ok: false, reason: 'Цель в Скрытности.' };

    if (attacker.isHero) {
      if (attacker.attacksThisTurn >= 1) return { ok: false, reason: 'Герой уже атаковал.' };
    } else {
      if (attacker.summonedThisTurn && !attacker.keywords.has('charge') && !attacker.keywords.has('rush'))
        return { ok: false, reason: 'Существо не готово.' };
      if (attacker.attacksThisTurn >= attacker.maxAttacks)
        return { ok: false, reason: 'Уже атаковало.' };
      if (attacker.summonedThisTurn && attacker.keywords.has('rush') && !attacker.keywords.has('charge') && target.isHero)
        return { ok: false, reason: 'Натиск: только по существам в первый ход.' };
    }

    // Taunt enforcement.
    const foe = this.players[this.enemyOf(playerId)];
    const taunts = foe.board.filter((m) => m.keywords.has('taunt') && !m.silenced);
    if (taunts.length > 0) {
      const targetIsTaunt = !target.isHero && target.keywords.has('taunt') && !target.silenced;
      if (!targetIsTaunt) return { ok: false, reason: 'Сначала нужно пробить Провокацию.' };
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
    this.fx({ type: 'attack', attacker, target });

    // Attacking breaks stealth.
    if (!attacker.isHero && attacker.keywords.has('stealth')) attacker.keywords.delete('stealth');

    // Simultaneous combat damage; dealDamage reports whether it landed.
    const hitTarget = this.dealDamage(target, atkVal, attacker);
    const hitAttacker = defVal > 0 ? this.dealDamage(attacker, defVal, target) : false;

    // freezeOnDamage (Аурвак и ледяные существа).
    if (!attacker.isHero && attacker.freezeOnDamage && hitTarget) this.freezeEntity(target);
    if (!target.isHero && target.freezeOnDamage && hitAttacker) this.freezeEntity(attacker);

    // Poisonous minions / envenomed hero weapon.
    if (!attacker.isHero && attacker.keywords.has('poisonous') && !attacker.silenced &&
        !target.isHero && hitTarget) this.destroyEntity(target);
    if (!target.isHero && target.keywords.has('poisonous') && !target.silenced &&
        !attacker.isHero && hitAttacker) this.destroyEntity(attacker);
    const myWeapon = attacker.isHero ? this.players[playerId].weapon : null;
    if (myWeapon?.poisonous && !target.isHero && hitTarget) {
      this.emit(`Лезвия Палача источают яд — «${target.name}» обречён.`);
      this.destroyEntity(target);
    }

    // Игг-Молот: hero attack stuns the target's neighbours.
    if (attacker.isHero && myWeapon?.stunAdjacent && !target.isHero) {
      const enemyBoard = this.players[target.owner].board;
      const i = enemyBoard.indexOf(target);
      for (const n of [enemyBoard[i - 1], enemyBoard[i + 1]]) {
        if (n) { this.freezeEntity(n); this.emit(`Игг-Молот оглушает «${n.name}».`); }
      }
    }

    // Lifesteal.
    if (!attacker.isHero && attacker.keywords.has('lifesteal') && hitTarget)
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

  // Returns true when damage actually landed (false: absorbed by shield/Торк).
  dealDamage(entity, amount, source) {
    if (amount <= 0) return false;
    if (!entity.isHero && entity.divineShield && !entity.silenced) {
      entity.divineShield = false;
      entity.keywords.delete('divineShield');
      this.emit(`Щит «${entity.name}» поглощает урон.`);
      this.fx({ type: 'shieldPop', target: entity });
      return false;
    }
    if (entity.isHero) {
      if (entity.shieldCharges > 0) {
        entity.shieldCharges -= 1;
        this.emit(`Торк поглощает удар (осталось ${entity.shieldCharges}).`);
        this.fx({ type: 'shieldPop', target: entity });
        return false;
      }
      let dmg = amount;
      if (entity.armor > 0) {
        const absorbed = Math.min(entity.armor, dmg);
        entity.armor -= absorbed;
        dmg -= absorbed;
      }
      entity.health -= dmg;
      this.fx({ type: 'damage', target: entity, amount });
    } else {
      entity.health -= amount;
      this.normalizeMinion(entity);
      this.fx({ type: 'damage', target: entity, amount });
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
      this.fx({ type: 'heal', target: entity, amount: healed });
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
    minion.permSilenced = true;
    minion.keywords = new Set();
    minion.divineShield = false;
    minion.deathrattle = null;
    minion.spellDamage = 0;
    minion.freezeOnDamage = false;
    minion.frozen = false;
    minion.attackEqualsHealth = false;
    minion.spellShield = false;
    minion.bond = null;
    minion.shackled = false;
    minion.maxAttacks = 1;
    this.emit(`«${minion.name}» становится немым.`);
  }

  // Немота на время: abilities off while silenced flag holds, data preserved.
  tempSilence(minion, turns = 2) {
    if (minion.isHero) return;
    minion.silenced = true;
    minion.tempSilence = Math.max(minion.tempSilence || 0, turns);
    this.emit(`«${minion.name}» онемевает.`);
  }

  shackleMinion(minion) {
    if (minion.isHero) return;
    minion.shackled = true;
    this.emit(`«${minion.name}» сковано Живыми Цепями.`);
  }

  freezeEntity(entity) {
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
    fresh.summonedThisTurn = false;
    p.board[idx] = fresh;
    this.emit(`«${minion.name}» превращается в «${def.name}».`);
  }

  gainArmor(playerId, amount) {
    this.players[playerId].hero.armor += amount;
    this.emit(`${this.players[playerId].name} получает ${amount} брони.`);
  }

  normalizeMinion(m) {
    if (m.attackEqualsHealth && !m.silenced) m.attack = Math.max(0, m.health);
    if (m.health > m.maxHealth) m.health = m.maxHealth;
  }

  // Remove dead minions, firing deathrattles and awarding Слава to the killer's
  // side (the opponent of the dead minion's owner). Loops until stable.
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
        this.fx({ type: 'death', target: m });
        // Слава: the opposing Ascendant claims the kill.
        this.players[this.enemyOf(m.owner)].glory += 1;
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
      if (dead0 && dead1) this.winner = -1;
      else this.winner = dead0 ? 1 : 0;
      this.emit(this.winner === -1 ? 'Ничья!' : `${this.players[this.winner].name} восходит к славе!`);
    }
  }
}

// Аспекты Восходящих.
export const HERO_POWERS = {
  vincent:   { id: 'ghost_hand',   name: 'Призрачная Длань',   desc: '1 ед. урона врагу — или +1 брони, если цель ваш герой.', icon: '🫳', cost: 1, targeted: true, ops: [{ op: 'ghostHand' }] },
  veronika:  { id: 'mind_surge',   name: 'Ментальный всплеск', desc: 'Существо противника получает Немоту на 1 ход.', icon: '🌀', cost: 2, targeted: true, ops: [{ op: 'tempSilence', target: 'chosen', turns: 2 }] },
  aino:      { id: 'plains_call',  name: 'Зов Равнины',        desc: 'Призывает случайного зверя равнин.', icon: '🐾', cost: 2, targeted: false, ops: [{ op: 'summonRandom', tokens: ['karkhCub', 'tauroCalf'], count: 1 }] },
  azimandia: { id: 'rune_forge',   name: 'Рунная ковка',       desc: 'Даёт случайную Малую Руну (стоимость 1).', icon: '⚒️', cost: 2, targeted: false, ops: [{ op: 'addRandomToHand', pool: ['rune_spark', 'rune_frost', 'rune_mend'] }] },
  mrak:      { id: 'shadow_strike', name: 'Удар из тени',      desc: '+2 к атаке героя в этом ходу; ваш герой получает 1 урона.', icon: '🗡️', cost: 2, targeted: false, ops: [{ op: 'heroAttack', amount: 2 }, { op: 'damage', target: 'friendlyHero', amount: 1 }] },
};

export { KEYWORDS, MAX_BOARD };
