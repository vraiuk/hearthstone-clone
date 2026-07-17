// Effect resolution: turns declarative card "ops" into concrete game mutations.
// resolveOps() is called by the Game engine for battlecries, deathrattles and
// spells. It never mutates state directly — it delegates to primitive methods
// on the `game` object so all state changes flow through one place.

// Resolve a target specification into a concrete list of entities.
// ctx = { casterId, chosen } where `chosen` is a pre-selected entity (for
// targeted cards) and casterId is the player who owns the effect.
export function resolveTargets(game, spec, ctx) {
  const me = ctx.casterId;
  const foe = game.enemyOf(me);
  const src = ctx.source || null;
  switch (spec) {
    case 'chosen':
      return ctx.chosen ? [ctx.chosen] : [];
    case 'self':
      return src ? [src] : [];
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
        game.equipWeapon(casterId, op.attack, op.durability);
        break;
      case 'destroy':
        for (const t of resolveTargets(game, op.target, ctx)) game.destroyEntity(t);
        break;
      case 'silence':
        for (const t of resolveTargets(game, op.target, ctx)) game.silenceMinion(t);
        break;
      case 'freeze':
        for (const t of resolveTargets(game, op.target, ctx)) game.freezeEntity(t);
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
      default:
        console.warn('Unknown op', op.op);
    }
    game.processDeaths();
  }
}
