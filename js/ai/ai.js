// Heuristic AI opponent for «Звёздная Кровь». Plays a full turn: casts cards
// on-curve, uses removal on threats, uses its Aspect (hero power), then
// attacks — trading favourably or going face when lethal is available.

function minionValue(m) {
  let v = m.attack + m.health;
  if (m.keywords.has('taunt')) v += 1;
  if (m.keywords.has('divineShield')) v += 2;
  if (m.keywords.has('lifesteal')) v += 1;
  if (m.keywords.has('poisonous')) v += 2;
  if (m.deathrattle) v += 1;
  if (m.spellDamage) v += 1;
  if (m.spellShield) v += 1;
  return v;
}

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
    while (safety++ < 40 && !game.over) {
      const played = await this.playBestCard(game, pid, wait);
      if (!played) break;
      await wait();
    }
    if (!game.over) {
      const used = this.tryHeroPower(game, pid);
      if (used) await wait();
    }
    safety = 0;
    while (safety++ < 20 && !game.over) {
      const played = await this.playBestCard(game, pid, wait);
      if (!played) break;
      await wait();
    }
    await this.doAttacks(game, pid, wait);
  }

  playBestCard(game, pid, wait) {
    const p = game.players[pid];
    const playable = p.hand.filter((c) => c.cost <= p.mana &&
      (!c.gloryCost || p.glory >= c.gloryCost) &&
      (c.type !== 'minion' || p.board.length < 7));
    if (playable.length === 0) return Promise.resolve(false);

    let best = null; let bestScore = -Infinity; let bestTarget = null;
    for (const card of playable) {
      const { score, target } = this.scoreCard(game, pid, card);
      if (score > bestScore) { bestScore = score; best = card; bestTarget = target; }
    }
    if (!best || bestScore <= -1000) return Promise.resolve(false);

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
    let score = card.cost * 1.2;
    let target = null;

    if (card.type === 'minion') {
      score += (card.attack + card.health) * 0.6;
      if (card.gloryCost) score += 2; // титульные карты — почти всегда стоящие
      if (game.cardNeedsTarget(card)) {
        target = this.pickBattlecryTarget(game, pid, card);
        if (!target) {
          const eff = card.battlecry;
          // Battlecry needs a target we don't have: still playable as a body,
          // unless targeting is mandatory for the effect to be worth it.
          if ((eff.targetFilter || '').includes('enemy') && foe.board.length === 0) score -= 1;
          else score -= 1;
        }
      }
      return { score, target };
    }

    if (card.type === 'weapon') {
      score += (card.attack || 3) * 0.8;
      const mods = card.spell?.ops?.[0]?.mods;
      if (mods?.poisonous) score += foe.board.some((m) => m.health >= 4) ? 3 : 0;
      if (p.weapon) score -= 3; // don't overwrite a working weapon
      return { score, target };
    }

    // Runes (spells).
    const ops = card.spell?.ops || [];
    const opKinds = ops.map((o) => o.op);

    // AI never gambles with time manipulation or full spell lock.
    if (opKinds.includes('timeLoop') || opKinds.includes('spellLock'))
      return { score: -1000, target: null };

    if ((opKinds.includes('damage') || opKinds.includes('damageVsFaction')) && card.spell.targeted) {
      const dmgOp = ops.find((o) => o.op === 'damage' || o.op === 'damageVsFaction');
      const baseAmount = dmgOp.amount + game.spellDamageOf(pid);
      const valid = game.validTargets(pid, card);
      const killable = valid
        .filter((m) => !m.isHero && m.owner === foe.id)
        .filter((m) => {
          const amt = baseAmount + ((dmgOp.op === 'damageVsFaction' && m.faction === dmgOp.faction) ? dmgOp.bonus : 0);
          return m.health <= amt && !m.spellShield;
        })
        .sort((a, b) => minionValue(b) - minionValue(a));
      if (killable.length && this.profile.useRemoval) {
        target = killable[0];
        score += minionValue(target) + 2;
      } else if (valid.includes(foe.hero)) {
        target = foe.hero;
        score += 1 + this.profile.aggression * 3;
        if (foe.hero.health + foe.hero.armor <= baseAmount) score += 100;
      } else if (valid.length) {
        target = valid.filter((t) => !t.isHero && t.owner === foe.id)[0] || null;
        if (!target) return { score: -1000, target: null };
      } else return { score: -1000, target: null };
      return { score, target };
    }

    if (opKinds.includes('destroy') && card.spell.targeted) {
      const valid = game.validTargets(pid, card).filter((t) => !t.isHero && t.owner === foe.id && !t.spellShield);
      if (valid.length) {
        target = valid.sort((a, b) => minionValue(b) - minionValue(a))[0];
        score += minionValue(target) + 3;
      } else return { score: -1000, target: null };
      return { score, target };
    }

    if (opKinds.includes('shackle') && card.spell.targeted) {
      const valid = game.validTargets(pid, card).filter((t) => !t.isHero && !t.shackled && !t.spellShield);
      const juicy = valid.filter((t) => game.effectiveAttack(t) >= 4);
      if (juicy.length) {
        target = juicy.sort((a, b) => minionValue(b) - minionValue(a))[0];
        score += game.effectiveAttack(target);
      } else return { score: -1000, target: null };
      return { score, target };
    }

    if (opKinds.includes('tempSilence') && card.spell.targeted) {
      const valid = game.validTargets(pid, card).filter((t) => !t.isHero && !t.silenced && !t.spellShield);
      const juicy = valid.filter((t) => t.keywords.size > 0 || t.spellDamage || t.deathrattle);
      if (juicy.length) {
        target = juicy.sort((a, b) => minionValue(b) - minionValue(a))[0];
        score += 3;
      } else if (opKinds.includes('draw') && valid.length) {
        target = valid[0]; score += 1.5;
      } else return { score: -1000, target: null };
      return { score, target };
    }

    if (opKinds.includes('bounce') && card.spell.targeted) {
      const enemyBig = foe.board.filter((m) => m.cost === undefined || true)
        .sort((a, b) => minionValue(b) - minionValue(a));
      if (enemyBig.length && minionValue(enemyBig[0]) >= 6) { target = enemyBig[0]; score += 4; }
      else return { score: -1000, target: null };
      return { score, target };
    }

    if (opKinds.includes('copyMinion') && card.spell.targeted) {
      const own = game.players[pid].board.slice().sort((a, b) => minionValue(b) - minionValue(a));
      if (own.length && minionValue(own[0]) >= 6 && p.board.length < 7) { target = own[0]; score += minionValue(own[0]) * 0.7; }
      else return { score: -1000, target: null };
      return { score, target };
    }

    if (opKinds.includes('buff') && card.spell.targeted) {
      const targets = game.validTargets(pid, card).filter((t) => !t.isHero && t.owner === pid);
      if (targets.length) {
        // Метка смерти (яд) лучше всего на мелком существе с неистовством/натиском.
        const givesPoison = ops.some((o) => (o.keywords || []).includes('poisonous'));
        target = givesPoison
          ? targets.sort((a, b) => a.health - b.health)[0]
          : targets.sort((a, b) => minionValue(b) - minionValue(a))[0];
        score += 2;
      } else return { score: -1000, target: null };
      return { score, target };
    }

    if (opKinds.includes('transform') && card.spell.targeted) {
      const valid = game.validTargets(pid, card).filter((t) => !t.isHero && t.owner === foe.id && !t.spellShield);
      const juicy = valid.filter((t) => minionValue(t) >= 8);
      if (juicy.length) { target = juicy.sort((a, b) => minionValue(b) - minionValue(a))[0]; score += minionValue(target); }
      else return { score: -1000, target: null };
      return { score, target };
    }

    if (opKinds.includes('heal') && card.spell.targeted) {
      const hurt = [...p.board, p.hero].filter((e) => e.health < e.maxHealth)
        .sort((a, b) => (b.maxHealth - b.health) - (a.maxHealth - a.health));
      if (hurt.length) { target = hurt[0]; score += 1.5; }
      else return { score: -1000, target: null };
      return { score, target };
    }

    // Non-targeted runes.
    if (opKinds.includes('damage') && !card.spell.targeted) {
      const amount = ops.find((o) => o.op === 'damage').amount + game.spellDamageOf(pid);
      const dmgOp = ops.find((o) => o.op === 'damage');
      if (dmgOp.target === 'enemyHero') {
        score += 1 + this.profile.aggression * 2;
        if (foe.hero.health + foe.hero.armor <= amount) score += 100;
      } else {
        const hits = foe.board.filter((m) => m.health <= amount + 1).length;
        score += hits * 2.5;
        // Веер клинков бьёт и своих — штраф за своих.
        if (dmgOp.target === 'allMinions')
          score -= p.board.filter((m) => m.health <= amount).length * 2;
      }
    }
    if (opKinds.includes('randomDamage')) score += Math.min(foe.board.length, 2) * 2;
    if (opKinds.includes('freeze') && !card.spell.targeted) score += foe.board.length * 0.8;
    if (opKinds.includes('draw')) score += 1.5;
    if (opKinds.includes('summon') || opKinds.includes('summonRandom')) score += 2;
    if (opKinds.includes('summonPerEnemy')) score += foe.board.length * 1.2;
    if (opKinds.includes('summonFill')) score += (7 - p.board.length) * 0.8;
    if (opKinds.includes('armor')) score += p.hero.health < 15 ? 3 : 0.5;
    if (opKinds.includes('torq')) score += p.hero.health < 20 ? 4 : 1;
    if (opKinds.includes('heroAttack')) score += foe.board.length ? 1.5 : 0.5;
    if (opKinds.includes('stealCard')) {
      if (foe.hand.length === 0 || p.hand.length >= 10) return { score: -1000, target: null };
      score += 2.5;
    }
    if (opKinds.includes('wildHunt')) {
      const myBeasts = p.board.filter((m) => m.tribe === 'зверь').length;
      const foeBeasts = foe.board.filter((m) => m.tribe === 'зверь').length;
      if (game.wildHunt || myBeasts <= foeBeasts) return { score: -1000, target: null };
      score += myBeasts * 1.5;
    }
    if (opKinds.includes('addToHand') || opKinds.includes('addRandomToHand')) score += 1.5;

    return { score, target };
  }

  pickBattlecryTarget(game, pid, card) {
    const bc = card.battlecry;
    const foe = game.players[game.enemyOf(pid)];
    const me = game.players[pid];
    const filter = bc.targetFilter || 'any';
    const ops = bc.ops;
    const valid = game.validTargets(pid, card);

    if (ops.some((o) => o.op === 'damage')) {
      const amount = ops.find((o) => o.op === 'damage').amount;
      const kill = valid.filter((m) => !m.isHero && m.owner === foe.id && m.health <= amount)
        .sort((a, b) => minionValue(b) - minionValue(a));
      if (kill.length) return kill[0];
      return valid.includes(foe.hero) ? foe.hero : null;
    }
    if (ops.some((o) => o.op === 'heal')) {
      const hurt = me.board.filter((m) => m.health < m.maxHealth)
        .sort((a, b) => (b.maxHealth - b.health) - (a.maxHealth - a.health));
      if (hurt.length) return hurt[0];
      return me.hero.health < me.hero.maxHealth ? me.hero : (me.board[0] || null);
    }
    if (ops.some((o) => o.op === 'silence')) {
      const juicy = valid.filter((m) => !m.isHero && m.owner === foe.id &&
        (m.keywords.size > 0 || m.deathrattle || m.spellDamage))
        .sort((a, b) => minionValue(b) - minionValue(a));
      return juicy[0] || null;
    }
    if (ops.some((o) => o.op === 'shackle')) {
      const juicy = valid.filter((m) => !m.isHero && !m.shackled && game.effectiveAttack(m) >= 3)
        .sort((a, b) => minionValue(b) - minionValue(a));
      return juicy[0] || null;
    }
    if (ops.some((o) => o.op === 'bounce')) {
      const enemyBig = valid.filter((m) => !m.isHero && m.owner === foe.id)
        .sort((a, b) => minionValue(b) - minionValue(a));
      return enemyBig[0] || null;
    }
    if (ops.some((o) => o.op === 'buff')) {
      const targets = filter.includes('friendly') ? valid.filter((m) => !m.isHero && m.owner === pid) : valid.filter((m) => !m.isHero);
      return targets.sort((a, b) => minionValue(b) - minionValue(a))[0] || null;
    }
    return null;
  }

  tryHeroPower(game, pid) {
    const p = game.players[pid];
    const foe = game.players[game.enemyOf(pid)];
    const cost = game.heroPowerCost(p.heroClass);
    if (p.mana < cost || p.heroPowerUsed) return false;
    const cls = p.heroClass;

    if (cls === 'vincent') {
      // Kill a 1-hp minion, else armor up when hurt, else chip the enemy hero.
      const kill = foe.board.filter((m) => m.health === 1 && !(m.keywords.has('stealth') && !m.silenced))
        .sort((a, b) => minionValue(b) - minionValue(a));
      if (kill.length) return game.useHeroPower(pid, kill[0]).ok;
      if (p.hero.health < 20) return game.useHeroPower(pid, p.hero).ok;
      return game.useHeroPower(pid, foe.hero).ok;
    }
    if (cls === 'veronika') {
      const juicy = foe.board.filter((m) => !m.silenced && !(m.keywords.has('stealth')) &&
        (m.keywords.size > 0 || m.spellDamage || m.deathrattle || game.effectiveAttack(m) >= 4))
        .sort((a, b) => minionValue(b) - minionValue(a));
      if (juicy.length) return game.useHeroPower(pid, juicy[0]).ok;
      return false;
    }
    if (cls === 'aino') {
      if (p.board.length < 7) return game.useHeroPower(pid).ok;
      return false;
    }
    if (cls === 'azimandia') {
      if (p.hand.length < 9) return game.useHeroPower(pid).ok;
      return false;
    }
    if (cls === 'mrak') {
      // Worth it when the extra attack can kill something or push face damage.
      if (p.hero.health <= 3) return false;
      if (p.hero.attacksThisTurn >= 1) return false;
      return game.useHeroPower(pid).ok;
    }
    return false;
  }

  async doAttacks(game, pid, wait) {
    const me = game.players[pid];
    const foe = game.players[game.enemyOf(pid)];
    let safety = 0;
    while (safety++ < 30 && !game.over) {
      const attackers = me.board.filter((m) => this.canHitSomething(game, pid, m));
      if (me.hero.attack > 0 && me.hero.attacksThisTurn < 1 &&
          this.canHitSomething(game, pid, me.hero)) attackers.push(me.hero);
      if (attackers.length === 0) break;

      const enemyTaunts = foe.board.filter((m) => m.keywords.has('taunt') && !m.silenced);
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
        if (enemyTaunts.length) {
          const r2 = game.attack(pid, attacker, enemyTaunts[0]);
          if (!r2.ok) break;
        } else break;
      }
      await wait();
    }
  }

  canHitSomething(game, pid, m) {
    const foe = game.players[game.enemyOf(pid)];
    const targets = [...foe.board, foe.hero];
    return targets.some((t) => game.canAttack(pid, m, t).ok);
  }

  chooseAttackTarget(game, pid, attacker, enemyTaunts) {
    const foe = game.players[game.enemyOf(pid)];
    const atk = game.effectiveAttack(attacker);
    const attackable = (arr) => arr.filter((m) => game.canAttack(pid, attacker, m).ok);
    const candidates = enemyTaunts.length ? attackable(enemyTaunts) : attackable(foe.board);

    if (this.profile.smartTrades && candidates.length) {
      const poisonKill = !attacker.isHero && attacker.keywords.has('poisonous');
      const kills = candidates.filter((m) => poisonKill || m.health <= atk ||
        (attacker.isHero && game.players[pid].weapon?.poisonous));
      const survivingKills = kills.filter((m) => attacker.isHero || game.effectiveAttack(m) < attacker.health);
      if (survivingKills.length)
        return survivingKills.sort((a, b) => minionValue(b) - minionValue(a))[0];
      const bigKill = kills.filter((m) => minionValue(m) >= minionValue(attacker));
      if (bigKill.length) return bigKill.sort((a, b) => minionValue(b) - minionValue(a))[0];
    }

    if (enemyTaunts.length === 0) {
      if (game.canAttack(pid, attacker, foe.hero).ok &&
          (this.profile.aggression > 0.4 || candidates.length === 0)) return foe.hero;
      if (candidates.length) {
        const good = candidates.filter((m) => m.health <= atk).sort((a, b) => minionValue(b) - minionValue(a));
        if (good.length) return good[0];
      }
      return game.canAttack(pid, attacker, foe.hero).ok ? foe.hero : (candidates[0] || null);
    }
    return candidates.sort((a, b) => minionValue(b) - minionValue(a))[0] || null;
  }
}
