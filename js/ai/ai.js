// Heuristic AI opponent. Plays a full turn: casts cards on-curve, uses removal
// on threats, uses the hero power, then attacks — trading favourably or going
// face when lethal is available. It mutates the game directly; `step` is an
// async hook the battle controller uses to animate one action at a time.

function minionValue(m) {
  let v = m.attack + m.health;
  if (m.keywords.has('taunt')) v += 1;
  if (m.keywords.has('divineShield')) v += 2;
  if (m.keywords.has('lifesteal')) v += 1;
  if (m.deathrattle) v += 1;
  if (m.spellDamage) v += 1;
  return v;
}

// A rough per-difficulty personality. `aggression` biases going face.
const PROFILES = {
  easy:   { aggression: 0.2, useRemoval: false, smartTrades: false },
  normal: { aggression: 0.5, useRemoval: true, smartTrades: true },
  hard:   { aggression: 0.7, useRemoval: true, smartTrades: true },
};

export class AI {
  constructor(difficulty = 'normal') {
    this.profile = PROFILES[difficulty] || PROFILES.normal;
  }

  async takeTurn(game, pid, step) {
    const wait = step || (async () => {});
    let safety = 0;
    // Play cards until nothing useful remains.
    while (safety++ < 40 && !game.over) {
      const played = await this.playBestCard(game, pid, wait);
      if (!played) break;
      await wait();
    }
    // Hero power.
    if (!game.over) {
      const used = this.tryHeroPower(game, pid);
      if (used) await wait();
    }
    // Play again in case hero power / draws opened something up.
    safety = 0;
    while (safety++ < 20 && !game.over) {
      const played = await this.playBestCard(game, pid, wait);
      if (!played) break;
      await wait();
    }
    // Attacks.
    await this.doAttacks(game, pid, wait);
  }

  playBestCard(game, pid, wait) {
    const p = game.players[pid];
    const playable = p.hand.filter((c) => c.cost <= p.mana &&
      (c.type !== 'minion' || p.board.length < 7));
    if (playable.length === 0) return Promise.resolve(false);

    // Rank candidates.
    let best = null; let bestScore = -Infinity; let bestTarget = null;
    for (const card of playable) {
      const { score, target } = this.scoreCard(game, pid, card);
      if (score > bestScore) { bestScore = score; best = card; bestTarget = target; }
    }
    if (!best || bestScore <= -1000) return Promise.resolve(false);

    // For targeted cards with no chosen target, bail.
    if (game.cardNeedsTarget(best) && !bestTarget) {
      const valid = game.validTargets(pid, best);
      if (valid.length === 0 && best.type === 'spell') return Promise.resolve(false);
    }
    const res = game.playCard(pid, best.instanceId, bestTarget);
    return Promise.resolve(res.ok);
  }

  scoreCard(game, pid, card) {
    const p = game.players[pid];
    const foe = game.players[game.enemyOf(pid)];
    let score = card.cost * 1.2; // prefer using mana efficiently
    let target = null;

    if (card.type === 'minion') {
      score += (card.attack + card.health) * 0.6;
      if (game.cardNeedsTarget(card)) {
        target = this.pickBattlecryTarget(game, pid, card);
        if (!target && (card.battlecry?.targetFilter || '').includes('friendly')) {
          // buff with no friendly minion: low value, still playable body
          score -= 1;
        }
      }
      return { score, target };
    }

    if (card.type === 'weapon') {
      score += (card.attack || 3) * 0.8;
      return { score, target };
    }

    // Spells.
    const ops = card.spell?.ops || [];
    const opKinds = ops.map((o) => o.op);

    if (opKinds.includes('damage') && card.spell.targeted) {
      // Targeted damage → best enemy minion we can kill, else face if aggressive.
      const amount = ops.find((o) => o.op === 'damage').amount + game.spellDamageOf(pid);
      const killable = foe.board
        .filter((m) => m.health <= amount)
        .sort((a, b) => minionValue(b) - minionValue(a));
      if (killable.length && (this.profile.useRemoval)) {
        target = killable[0];
        score += minionValue(target) + 2;
      } else {
        // face damage
        target = foe.hero;
        score += 1 + this.profile.aggression * 3;
        if (foe.hero.health <= amount) score += 100; // lethal-ish
      }
      return { score, target };
    }

    if (opKinds.includes('destroy') && card.spell.targeted) {
      const valid = game.validTargets(pid, card).filter((t) => !t.isHero && t.owner === foe.id);
      if (valid.length) {
        target = valid.sort((a, b) => minionValue(b) - minionValue(a))[0];
        score += minionValue(target) + 3;
      } else return { score: -1000, target: null };
      return { score, target };
    }

    if (opKinds.includes('buff') && card.spell.targeted) {
      const targets = game.validTargets(pid, card).filter((t) => !t.isHero && t.owner === pid);
      if (targets.length) { target = targets.sort((a, b) => minionValue(b) - minionValue(a))[0]; score += 2; }
      else return { score: -1000, target: null };
      return { score, target };
    }

    // AoE damage: value scales with enemy board.
    if (opKinds.includes('damage') && !card.spell.targeted) {
      const amount = ops.find((o) => o.op === 'damage').amount + game.spellDamageOf(pid);
      const hits = foe.board.filter((m) => m.health <= amount + 1).length;
      score += hits * 2.5;
      if (opKinds.includes('heal')) score += 1;
    }
    if (opKinds.includes('randomDamage')) {
      score += Math.min(foe.board.length, 2) * 2;
    }
    if (opKinds.includes('draw')) score += 1.5;
    if (opKinds.includes('summon') || opKinds.includes('summonRandom')) score += 2;
    if (opKinds.includes('summonPerEnemy')) score += foe.board.length * 1.2;
    if (opKinds.includes('armor')) score += p.hero.health < 15 ? 3 : 0.5;
    if (opKinds.includes('heroAttack')) score += foe.board.length ? 1.5 : 0.5;

    // Avoid wasting single-target removal on empty board handled above.
    return { score, target };
  }

  pickBattlecryTarget(game, pid, card) {
    const bc = card.battlecry;
    const foe = game.players[game.enemyOf(pid)];
    const me = game.players[pid];
    const filter = bc.targetFilter || 'any';
    const ops = bc.ops;
    if (ops.some((o) => o.op === 'damage')) {
      const amount = ops.find((o) => o.op === 'damage').amount;
      const kill = foe.board.filter((m) => m.health <= amount).sort((a, b) => minionValue(b) - minionValue(a));
      if (kill.length) return kill[0];
      return foe.hero;
    }
    if (ops.some((o) => o.op === 'heal')) {
      const hurt = me.board.filter((m) => m.health < m.maxHealth).sort((a, b) => (b.maxHealth - b.health) - (a.maxHealth - a.health));
      if (hurt.length) return hurt[0];
      return me.hero.health < me.hero.maxHealth ? me.hero : (me.board[0] || null);
    }
    if (ops.some((o) => o.op === 'silence')) {
      const juicy = foe.board.filter((m) => m.keywords.has('taunt') || m.keywords.has('divineShield') || m.deathrattle)
        .sort((a, b) => minionValue(b) - minionValue(a));
      return juicy[0] || null;
    }
    if (ops.some((o) => o.op === 'buff')) {
      const targets = filter.includes('friendly') ? me.board : [...me.board, ...foe.board];
      return targets.sort((a, b) => minionValue(b) - minionValue(a))[0] || null;
    }
    return null;
  }

  tryHeroPower(game, pid) {
    const p = game.players[pid];
    if (p.mana < 2 || p.heroPowerUsed) return false;
    const foe = game.players[game.enemyOf(pid)];
    const cls = p.heroClass;
    if (cls === 'warrior') {
      if (p.hand.filter((c) => c.cost <= p.mana - 2).length === 0 || p.hero.health < 20)
        return game.useHeroPower(pid).ok;
      return false;
    }
    if (cls === 'hunter') {
      // Only if we won't overspend needed mana for a card.
      return game.useHeroPower(pid).ok;
    }
    if (cls === 'priest') {
      const hurt = [...p.board, p.hero].filter((e) => e.health < e.maxHealth)
        .sort((a, b) => (b.maxHealth - b.health) - (a.maxHealth - a.health));
      if (hurt.length && (hurt[0].maxHealth - hurt[0].health) >= 2)
        return game.useHeroPower(pid, hurt[0]).ok;
      return false;
    }
    if (cls === 'mage') {
      const kill = foe.board.filter((m) => m.health === 1).sort((a, b) => minionValue(b) - minionValue(a));
      if (kill.length) return game.useHeroPower(pid, kill[0]).ok;
      if (p.mana >= 2 && p.hand.filter((c) => c.cost <= p.mana - 2).length === 0)
        return game.useHeroPower(pid, foe.hero).ok;
      return false;
    }
    return false;
  }

  async doAttacks(game, pid, wait) {
    const me = game.players[pid];
    const foe = game.players[game.enemyOf(pid)];
    let safety = 0;
    while (safety++ < 30 && !game.over) {
      const attackers = me.board.filter((m) => this.readyToAttack(game, pid, m));
      if (game.players[pid].hero.attack > 0 && game.players[pid].hero.attacksThisTurn < 1)
        attackers.push(me.hero);
      if (attackers.length === 0) break;

      const enemyTaunts = foe.board.filter((m) => m.keywords.has('taunt') && !m.silenced);
      // Lethal check (no taunts): dump everything face.
      if (enemyTaunts.length === 0) {
        const faceDmg = attackers.reduce((s, a) => s + game.effectiveAttack(a), 0);
        if (faceDmg >= foe.hero.health + foe.hero.armor) {
          const a = attackers[0];
          if (!game.attack(pid, a, foe.hero).ok) break;
          await wait();
          continue;
        }
      }

      const attacker = attackers[0];
      const target = this.chooseAttackTarget(game, pid, attacker, enemyTaunts);
      if (!target) break;
      const res = game.attack(pid, attacker, target);
      if (!res.ok) {
        // Can't attack chosen (e.g. taunt) — try forcing taunt, else stop.
        if (enemyTaunts.length) {
          const r2 = game.attack(pid, attacker, enemyTaunts[0]);
          if (!r2.ok) break;
        } else break;
      }
      await wait();
    }
  }

  readyToAttack(game, pid, m) {
    return game.canAttack(pid, m, game.players[game.enemyOf(pid)].hero).ok ||
      (m.board !== undefined) || this.canHitSomething(game, pid, m);
  }

  canHitSomething(game, pid, m) {
    const foe = game.players[game.enemyOf(pid)];
    const targets = [...foe.board, foe.hero];
    return targets.some((t) => game.canAttack(pid, m, t).ok);
  }

  chooseAttackTarget(game, pid, attacker, enemyTaunts) {
    const foe = game.players[game.enemyOf(pid)];
    const atk = game.effectiveAttack(attacker);
    const candidates = enemyTaunts.length ? enemyTaunts : foe.board;

    if (this.profile.smartTrades && candidates.length) {
      // Prefer a kill where we survive.
      const kills = candidates.filter((m) => m.health <= atk);
      const survivingKills = kills.filter((m) => attacker.isHero || game.effectiveAttack(m) < attacker.health);
      if (survivingKills.length)
        return survivingKills.sort((a, b) => minionValue(b) - minionValue(a))[0];
      // Value trade: kill something big even if we die.
      const bigKill = kills.filter((m) => minionValue(m) >= minionValue(attacker));
      if (bigKill.length) return bigKill.sort((a, b) => minionValue(b) - minionValue(a))[0];
    }

    // Aggression: go face if allowed.
    if (enemyTaunts.length === 0) {
      if (this.profile.aggression > 0.4 || foe.board.length === 0) return foe.hero;
      // Otherwise trade into best available if favorable, else face.
      if (candidates.length) {
        const good = candidates.filter((m) => m.health <= atk).sort((a, b) => minionValue(b) - minionValue(a));
        if (good.length) return good[0];
      }
      return foe.hero;
    }
    // Must break taunt.
    return enemyTaunts.sort((a, b) => minionValue(b) - minionValue(a))[0];
  }
}
