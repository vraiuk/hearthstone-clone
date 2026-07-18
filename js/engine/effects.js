// Effect resolution: turns declarative card "ops" into concrete game mutations.
// resolveOps() is called by the Game engine for battlecries, deathrattles,
// runes (spells) and hero powers (Aspects). It never mutates state directly —
// it delegates to primitive methods on the `game` object so all state changes
// flow through one place.

// Resolve a target specification into a concrete list of entities.
// ctx = { casterId, chosen, source }.
export function resolveTargets(game, spec, ctx) {
  const me = ctx.casterId;
  const foe = game.enemyOf(me);
  const src = ctx.source || null;
  switch (spec) {
    case 'chosen':
      return ctx.chosen ? [ctx.chosen] : [];
    case 'self':
    case 'triggerSource':
      return src ? [src] : [];
    case 'enemyHero':
      return [game.players[foe].hero];
    case 'friendlyHero':
      return [game.players[me].hero];
    case 'allEnemyMinions':
      return game.players[foe].board.slice();
    case 'allFriendlyMinions':
      return game.players[me].board.slice();
    case 'allMinions':
      return [...game.players[me].board, ...game.players[foe].board];
    case 'allEnemies':
      return [...game.players[foe].board, game.players[foe].hero];
    case 'allFriendlies':
      return [...game.players[me].board, game.players[me].hero];
    case 'randomEnemyMinion': {
      const b = game.players[foe].board;
      return b.length ? [game.pickRandom(b)] : [];
    }
    default:
      return [];
  }
}

// Execute a list of ops. `opts.isSpell` enables spell-damage bonus on damage ops.
export function resolveOps(game, ops, ctx, opts = {}) {
  const isSpell = !!opts.isSpell;
  const casterId = ctx.casterId;
  const spellDamage = isSpell ? game.spellDamageOf(casterId) : 0;

  for (const op of ops) {
    switch (op.op) {
      case 'damage': {
        const amount = op.amount + spellDamage;
        for (const t of resolveTargets(game, op.target, ctx)) {
          game.dealDamage(t, amount, ctx.source || { spell: true, owner: casterId });
        }
        break;
      }
      // Damage with a bonus versus a specific faction (Игг-Свет vs Черви).
      case 'damageVsFaction': {
        for (const t of resolveTargets(game, op.target, ctx)) {
          const bonus = (!t.isHero && t.faction === op.faction) ? op.bonus : 0;
          game.dealDamage(t, op.amount + bonus + spellDamage, { spell: true, owner: casterId });
        }
        break;
      }
      case 'randomDamage': {
        const amount = op.amount + spellDamage;
        let pool = resolveTargets(game, op.target, ctx).filter((t) => game.isAlive(t));
        for (let i = 0; i < op.hits; i++) {
          const live = pool.filter((t) => game.isAlive(t));
          if (!live.length) break;
          const target = game.pickRandom(live);
          game.dealDamage(target, amount, { spell: true, owner: casterId });
          if (op.distinct) pool = pool.filter((t) => t !== target);
          game.processDeaths();
        }
        break;
      }
      case 'heal': {
        for (const t of resolveTargets(game, op.target, ctx)) game.healEntity(t, op.amount);
        break;
      }
      case 'draw':
        for (let i = 0; i < op.amount; i++) game.drawCard(casterId);
        break;
      case 'buff': {
        for (const t of resolveTargets(game, op.target, ctx)) {
          game.buffMinion(t, op.attack || 0, op.health || 0, op.keywords || []);
        }
        break;
      }
      case 'armor':
        game.gainArmor(casterId, op.amount);
        break;
      case 'heroAttack':
        game.grantHeroAttack(casterId, op.amount);
        break;
      case 'weapon':
        game.equipWeapon(casterId, op.attack, op.durability, op.mods || {});
        break;
      case 'destroy':
        for (const t of resolveTargets(game, op.target, ctx)) game.destroyEntity(t);
        break;
      case 'silence':
        for (const t of resolveTargets(game, op.target, ctx)) game.silenceMinion(t);
        break;
      // Немота на время (Ментальный всплеск): abilities off, restored later.
      case 'tempSilence':
        for (const t of resolveTargets(game, op.target, ctx)) game.tempSilence(t, op.turns || 2);
        break;
      case 'freeze':
        for (const t of resolveTargets(game, op.target, ctx)) game.freezeEntity(t);
        break;
      // Живые Цепи: existo cannot attack until silenced/dead.
      case 'shackle':
        for (const t of resolveTargets(game, op.target, ctx)) game.shackleMinion(t);
        break;
      case 'transform':
        for (const t of resolveTargets(game, op.target, ctx)) game.transformMinion(t, op.token);
        break;
      case 'summon':
        for (let i = 0; i < (op.count || 1); i++) game.summonToken(casterId, op.token);
        break;
      case 'summonRandom': {
        for (let i = 0; i < (op.count || 1); i++) {
          const tok = game.pickRandom(op.tokens);
          game.summonToken(casterId, tok);
        }
        break;
      }
      case 'summonPerEnemy': {
        const n = game.players[game.enemyOf(casterId)].board.length;
        for (let i = 0; i < n; i++) game.summonToken(casterId, op.token);
        break;
      }
      // Матка Гнезда: fill the board with larvae up to op.upTo total minions.
      case 'summonFill': {
        const p = game.players[casterId];
        const upTo = Math.min(op.upTo || 7, 7);
        while (p.board.length < upTo) {
          if (!game.summonToken(casterId, op.token)) break;
        }
        break;
      }
      // Серебряная Форель: return a minion to its owner's hand.
      case 'bounce':
        for (const t of resolveTargets(game, op.target, ctx)) game.bounceMinion(t);
        break;
      // Эхо Безвременья: summon a copy of a minion (current stats).
      case 'copyMinion':
        for (const t of resolveTargets(game, op.target, ctx)) game.copyMinion(casterId, t);
        break;
      // Гипнотизм: steal a random card from the opponent's hand.
      case 'stealCard':
        for (let i = 0; i < (op.count || 1); i++) game.stealRandomCard(casterId);
        break;
      // Специалист Сигурд: dig up a specific rune into hand.
      case 'addToHand':
        game.addCardToHand(casterId, op.cardId);
        break;
      // Рунная ковка: random Малая Руна.
      case 'addRandomToHand':
        game.addCardToHand(casterId, game.pickRandom(op.pool));
        break;
      // Торк: absorbs the next N hits on your hero.
      case 'torq':
        game.grantHeroShield(casterId, op.charges || 3);
        break;
      // Сфера Пустоты: no runes (spells) for either player for a turn.
      case 'spellLock':
        game.lockSpells();
        break;
      // Дикая Охота: global — beasts ramp up, Ascendants bleed.
      case 'wildHunt':
        game.startWildHunt();
        break;
      // Временная Петля: revert both boards to the start of caster's last turn.
      case 'timeLoop':
        game.timeLoop(casterId);
        break;
      // Призрачная Длань: 1 damage to an enemy OR +1 armor when self-targeted.
      case 'ghostHand': {
        const t = ctx.chosen;
        if (!t) break;
        if (t.isHero && t.playerId === casterId) game.gainArmor(casterId, 1);
        else game.dealDamage(t, 1, { power: true, owner: casterId });
        break;
      }
      default:
        console.warn('Unknown op', op.op);
    }
    game.processDeaths();
  }
}
