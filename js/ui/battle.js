// Battle screen: renders game state, handles click targeting, animates the AI
// turn (mode 'ai') or swaps perspective between two humans (mode 'hotseat'),
// and reports the result via onFinish.

import { Game, HERO_POWERS } from '../engine/game.js';
import { AI } from '../ai/ai.js';
import { buildCardEl, buildMinionEl, el } from './cardRender.js';
import { CLASSES } from '../data/decks.js';
import { Audio } from '../audio/audio.js';
import { VFX } from './vfx.js';
import { ART } from '../data/art-manifest.js';

const AI_STEP_MS = 650;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class BattleScreen {
  // opts: {
  //   root, mode: 'ai'|'hotseat',
  //   playerClass, playerDeck,                      // mode 'ai'
  //   p1: {name, class, deck}, p2: {name, class, deck},  // mode 'hotseat'
  //   enemy: {name, class, deck, difficulty, boss, icon},// mode 'ai'
  //   onFinish(winnerPid|won)
  // }
  constructor(opts) {
    this.root = opts.root;
    this.opts = opts;
    this.mode = opts.mode || 'ai';
    this.selected = null;
    this.busy = false;
    this.finished = false;
    this.awaitHandoff = false;

    const players = this.mode === 'hotseat'
      ? [
        { name: opts.p1.name, hero: opts.p1.class, deck: opts.p1.deck },
        { name: opts.p2.name, hero: opts.p2.class, deck: opts.p2.deck },
      ]
      : [
        { name: CLASSES[opts.playerClass].hero, hero: opts.playerClass, deck: opts.playerDeck },
        { name: opts.enemy.name, hero: opts.enemy.class, deck: opts.enemy.deck },
      ];

    this.vfx = new VFX(opts.root, () => this.pid);
    this.game = new Game({
      players,
      log: (msg) => this.pushLog(msg),
      onEvent: (ev) => {
        this.vfx.push(ev);
        if (ev.type === 'damage') Audio.sfx('damage');
      },
    });
    this.ai = this.mode === 'ai' ? new AI(opts.enemy.difficulty || 'normal') : null;

    // Boss modifiers (campaign only).
    const boss = this.mode === 'ai' ? opts.enemy.boss : null;
    if (boss) {
      const hero = this.game.players[1].hero;
      if (boss.extraHealth) { hero.maxHealth += boss.extraHealth; hero.health += boss.extraHealth; }
      if (boss.startArmor) hero.armor += boss.startArmor;
    }
    this.game.start(0);
    if (boss && boss.openingBoard) {
      for (const tok of boss.openingBoard) {
        const m = this.game.summonToken(1, tok);
        if (m) m.summonedThisTurn = false;
      }
    }
    this.logLines = [];
    Audio.setScene('battle');
    this.render();
  }

  // Perspective: in AI mode the human is always player 0; in hotseat the
  // "bottom" player is whoever's turn it is.
  get pid() { return this.mode === 'hotseat' ? this.game.current : 0; }
  get foePid() { return this.game.enemyOf(this.pid); }

  pushLog(msg) {
    this.logLines = this.logLines || [];
    this.logLines.push(msg);
    if (this.logLines.length > 60) this.logLines.shift();
    const logEl = this.root.querySelector('.battle-log-lines');
    if (logEl) {
      logEl.replaceChildren(...this.logLines.slice(-8).map((l) => el('div', 'log-line', l)));
      logEl.scrollTop = logEl.scrollHeight;
    }
  }

  // ---------- rendering ----------
  render() {
    const g = this.game;
    const me = g.players[this.pid], foe = g.players[this.foePid];
    this.root.replaceChildren();

    const board = el('div', 'battle');
    board.append(this.heroRow(foe, 'enemy'));
    board.append(this.boardRow(foe, 'enemy'));
    board.append(this.centerBar());
    board.append(this.boardRow(me, 'friendly'));
    board.append(this.heroRow(me, 'friendly'));
    board.append(this.handRow(me));

    const log = el('div', 'battle-log');
    log.append(el('div', 'battle-log-title', 'Хроника'));
    const lines = el('div', 'battle-log-lines');
    (this.logLines || []).slice(-8).forEach((l) => lines.append(el('div', 'log-line', l)));
    log.append(lines);
    board.append(log);

    this.root.append(board);
    this.updateSelectability();
    // Проигрываем накопленные эффекты поверх свежего DOM.
    this.vfx.flush();

    if (this.awaitHandoff) this.showHandoff();
    // Re-append the end screen on every render while the game is over —
    // an async AI step may re-render after the first showEndScreen call.
    if (g.over) this.showEndScreen();
  }

  heroRow(p, side) {
    const g = this.game;
    const row = el('div', `hero-row hero-${side}`);
    const cls = CLASSES[p.heroClass];

    const portrait = el('div', `hero-portrait theme-${p.heroClass}`);
    portrait.dataset.hero = side;
    const iconEl = el('div', 'hero-icon');
    const artKey = 'hero_' + p.heroClass;
    if (ART.has(artKey)) {
      iconEl.classList.add('has-image');
      iconEl.style.backgroundImage = `url("assets/art/${artKey}.webp")`;
    } else {
      iconEl.textContent = (this.mode === 'ai' && side === 'enemy' && this.opts.enemy.icon) || cls.icon;
    }
    portrait.append(iconEl);
    portrait.append(el('div', 'hero-name', p.name));
    portrait.append(el('div', 'hero-class-tag', cls.name));
    const hp = el('div', 'hero-health', String(Math.max(0, p.hero.health)));
    if (p.hero.armor > 0) hp.append(el('span', 'hero-armor', '🛡' + p.hero.armor));
    portrait.append(hp);
    if (p.hero.attack > 0) portrait.append(el('div', 'hero-attack', '⚔' + p.hero.attack));
    if (p.weapon) {
      const wTags = [];
      if (p.weapon.poisonous) wTags.push('☠️');
      if (p.weapon.stunAdjacent) wTags.push('💫');
      portrait.append(el('div', 'hero-weapon', `🗡${p.weapon.attack}/${p.weapon.durability}${wTags.join('')}`));
    }
    if (p.hero.shieldCharges > 0) portrait.append(el('div', 'hero-torq', `📿×${p.hero.shieldCharges}`));
    if (p.hero.frozen) portrait.classList.add('is-frozen');

    // Аспект героя.
    const power = HERO_POWERS[p.heroClass];
    const cost = power.cost ?? 2;
    const powerBtn = el('div', 'hero-power', power.icon);
    powerBtn.title = `${power.name}: ${power.desc} (${cost} Звёздной Крови)`;
    if (p.heroPowerUsed || p.mana < cost) powerBtn.classList.add('used');
    powerBtn.dataset.power = side;

    // Звёздная Кровь (мана).
    const mana = el('div', 'mana-bar');
    mana.append(el('span', 'mana-text', `🩸 ${p.mana}/${p.maxMana}`));
    const crystals = el('span', 'mana-crystals');
    for (let i = 0; i < p.maxMana; i++) {
      const c = el('span', 'crystal');
      if (i < p.mana) c.classList.add('full');
      crystals.append(c);
    }
    mana.append(crystals);

    const deckInfo = el('div', 'deck-info', `🂠 ${p.deck.length}`);
    if (side === 'enemy') deckInfo.append(el('span', 'hand-count', ` ✋ ${p.hand.length}`));
    const glory = el('div', 'glory-info', `⭐ ${p.glory}`);
    glory.title = 'Слава: копится за убийства существ врага, открывает Титульные карты';

    row.append(portrait, powerBtn, mana, glory, deckInfo);

    portrait.addEventListener('click', () => this.onHeroClick(side));
    powerBtn.addEventListener('click', (e) => { e.stopPropagation(); this.onPowerClick(side); });
    return row;
  }

  boardRow(p, side) {
    const row = el('div', `board-row board-${side}`);
    for (const m of p.board) {
      const node = buildMinionEl(m, this.game);
      node.addEventListener('click', () => this.onMinionClick(m, side));
      row.append(node);
    }
    if (p.board.length === 0) row.append(el('div', 'board-empty', ''));
    return row;
  }

  centerBar() {
    const bar = el('div', 'center-bar');
    const label = this.busy ? 'Ход противника…'
      : this.mode === 'hotseat' ? 'Передать ход' : 'Завершить ход';
    const endBtn = el('button', 'end-turn-btn', label);
    endBtn.disabled = this.busy || this.game.over;
    endBtn.addEventListener('click', () => this.onEndTurn());
    bar.append(endBtn);
    const hints = [];
    if (this.game.turn < this.game.spellLockUntil) hints.push('⚫ Сфера Пустоты: Руны запечатаны!');
    if (this.game.wildHunt) hints.push('🌕 Дикая Охота бушует!');
    hints.push(this.hintText());
    bar.append(el('div', 'action-hint', hints.filter(Boolean).join(' · ')));
    return bar;
  }

  handRow(p) {
    const row = el('div', 'hand-row');
    for (const c of p.hand) {
      const playable = !this.busy && this.game.current === this.pid &&
        this.game.canPlayCard(this.pid, c.instanceId, null).ok;
      const node = buildCardEl(c, { unplayable: !playable });
      node.addEventListener('click', () => this.onHandCardClick(c));
      row.append(node);
    }
    return row;
  }

  hintText() {
    if (this.game.over) return '';
    if (this.busy) return 'Противник думает…';
    if (!this.selected) return 'Ваш ход. Кликните руну или существо.';
    if (this.selected.kind === 'card') return `«${this.selected.card.name}» — выберите цель.`;
    if (this.selected.kind === 'power') return 'Аспект — выберите цель.';
    if (this.selected.kind === 'minion') return `«${this.selected.minion.name}» — выберите цель атаки.`;
    if (this.selected.kind === 'hero') return 'Герой — выберите цель атаки.';
    return '';
  }

  updateSelectability() {
    this.root.querySelectorAll('.is-selected').forEach((n) => n.classList.remove('is-selected'));
    this.root.querySelectorAll('.is-target').forEach((n) => n.classList.remove('is-target'));
    if (!this.selected) return;

    const markMinion = (m) => {
      const node = this.root.querySelector(`.minion[data-instance-id="${m.instanceId}"]`);
      if (node) node.classList.add('is-target');
    };
    const markHero = (pidOfHero) => {
      const side = pidOfHero === this.pid ? 'friendly' : 'enemy';
      const node = this.root.querySelector(`.hero-portrait[data-hero="${side}"]`);
      if (node) node.classList.add('is-target');
    };

    if (this.selected.kind === 'card' || this.selected.kind === 'power') {
      if (this.selected.kind === 'card') {
        const node = this.root.querySelector(`.card[data-instance-id="${this.selected.card.instanceId}"]`);
        if (node) node.classList.add('is-selected');
      } else {
        const node = this.root.querySelector('.hero-power[data-power="friendly"]');
        if (node) node.classList.add('is-selected');
      }
      for (const t of this.selected.targets) {
        if (t.isHero) markHero(t.playerId);
        else markMinion(t);
      }
    } else if (this.selected.kind === 'minion' || this.selected.kind === 'hero') {
      const g = this.game;
      const attacker = this.selected.kind === 'hero' ? g.players[this.pid].hero : this.selected.minion;
      if (this.selected.kind === 'minion') {
        const node = this.root.querySelector(`.minion[data-instance-id="${attacker.instanceId}"]`);
        if (node) node.classList.add('is-selected');
      } else {
        const node = this.root.querySelector('.hero-portrait[data-hero="friendly"]');
        if (node) node.classList.add('is-selected');
      }
      const foe = g.players[this.foePid];
      for (const t of [...foe.board, foe.hero]) {
        if (g.canAttack(this.pid, attacker, t).ok) {
          if (t.isHero) markHero(t.playerId); else markMinion(t);
        }
      }
    }
  }

  toast(msg) {
    const t = el('div', 'toast', msg);
    this.root.append(t);
    setTimeout(() => t.classList.add('show'), 10);
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 1600);
  }

  // ---------- input ----------
  onHandCardClick(card) {
    if (this.busy || this.game.over || this.game.current !== this.pid || this.awaitHandoff) return;
    const check = this.game.canPlayCard(this.pid, card.instanceId, null);
    if (!check.ok) { this.toast(check.reason); return; }

    if (this.game.cardNeedsTarget(card)) {
      const targets = this.game.validTargets(this.pid, card);
      if (targets.length === 0) {
        if (card.type === 'minion') { this.playCard(card, null); return; }
        this.toast('Нет целей.'); return;
      }
      this.selected = { kind: 'card', card, targets };
      this.render();
      return;
    }
    this.playCard(card, null);
  }

  playCard(card, target) {
    const res = this.game.playCard(this.pid, card.instanceId, target);
    if (!res.ok) this.toast(res.reason);
    else Audio.sfx('play');
    this.selected = null;
    this.render();
  }

  onPowerClick(side) {
    if (side !== 'friendly' || this.busy || this.game.over ||
        this.game.current !== this.pid || this.awaitHandoff) return;
    const check = this.game.canUseHeroPower(this.pid, null);
    if (!check.ok) { this.toast(check.reason); return; }
    const power = HERO_POWERS[this.game.players[this.pid].heroClass];
    if (power.targeted) {
      const targets = this.game.heroPowerTargets(this.pid);
      this.selected = { kind: 'power', targets };
      this.render();
      return;
    }
    this.game.useHeroPower(this.pid, null);
    Audio.sfx('power');
    this.selected = null;
    this.render();
  }

  onMinionClick(m, side) {
    if (this.busy || this.game.over || this.game.current !== this.pid || this.awaitHandoff) return;

    if (this.selected) {
      if (this.tryResolveTarget(m)) return;
    }
    if (side === 'friendly') {
      const g = this.game;
      const foe = g.players[this.foePid];
      const anyTarget = [...foe.board, foe.hero].some((t) => g.canAttack(this.pid, m, t).ok);
      if (!anyTarget) {
        const reason = g.canAttack(this.pid, m, foe.hero).reason || 'Существо не может атаковать.';
        this.toast(reason);
        return;
      }
      this.selected = { kind: 'minion', minion: m };
      this.render();
    } else {
      this.toast('Сначала выберите свою руну или существо.');
    }
  }

  onHeroClick(side) {
    if (this.busy || this.game.over || this.game.current !== this.pid || this.awaitHandoff) return;
    const g = this.game;
    if (this.selected) {
      const hero = side === 'enemy' ? g.players[this.foePid].hero : g.players[this.pid].hero;
      if (this.tryResolveTarget(hero)) return;
    }
    if (side === 'friendly') {
      const me = g.players[this.pid];
      if (me.hero.attack > 0) {
        const foe = g.players[this.foePid];
        const anyTarget = [...foe.board, foe.hero].some((t) => g.canAttack(this.pid, me.hero, t).ok);
        if (!anyTarget) { this.toast('Герой не может атаковать.'); return; }
        this.selected = { kind: 'hero' };
        this.render();
      }
    }
  }

  tryResolveTarget(entity) {
    const sel = this.selected;
    const g = this.game;
    if (sel.kind === 'card') {
      if (sel.targets.includes(entity)) { this.playCard(sel.card, entity); return true; }
      this.selected = null; this.render();
      return false;
    }
    if (sel.kind === 'power') {
      if (sel.targets.includes(entity)) {
        g.useHeroPower(this.pid, entity);
        Audio.sfx('power');
        this.selected = null; this.render();
        return true;
      }
      this.selected = null; this.render();
      return false;
    }
    if (sel.kind === 'minion' || sel.kind === 'hero') {
      const attacker = sel.kind === 'hero' ? g.players[this.pid].hero : sel.minion;
      const check = g.canAttack(this.pid, attacker, entity);
      if (check.ok) {
        g.attack(this.pid, attacker, entity);
        Audio.sfx('attack');
        this.selected = null;
        this.render();
        return true;
      }
      if (entity !== attacker) this.toast(check.reason);
      this.selected = null; this.render();
      return false;
    }
    return false;
  }

  async onEndTurn() {
    if (this.busy || this.game.over || this.awaitHandoff) return;
    this.selected = null;

    if (this.mode === 'hotseat') {
      this.game.endTurn();
      if (!this.game.over) this.awaitHandoff = true;
      this.render();
      return;
    }

    // AI mode.
    this.busy = true;
    this.game.endTurn();
    this.render();
    await sleep(AI_STEP_MS);
    try {
      await this.ai.takeTurn(this.game, 1, async () => {
        this.render();
        await sleep(AI_STEP_MS);
      });
      if (this.opts.enemy.boss?.doubleHeroPower && !this.game.over) {
        this.game.players[1].heroPowerUsed = false;
        this.ai.tryHeroPower(this.game, 1);
        this.render();
        await sleep(AI_STEP_MS);
      }
    } catch (e) {
      console.error('AI error', e);
    }
    if (!this.game.over) this.game.endTurn();
    this.busy = false;
    this.render();
  }

  showHandoff() {
    const p = this.game.players[this.game.current];
    const overlay = el('div', 'end-overlay handoff-overlay');
    const panel = el('div', 'end-panel');
    panel.append(el('div', 'end-title', '🔄 Передайте устройство'));
    panel.append(el('div', 'end-sub', `Ходит ${p.name} (${CLASSES[p.heroClass].name})`));
    const btn = el('button', 'btn primary big', 'Я готов!');
    btn.addEventListener('click', () => {
      this.awaitHandoff = false;
      Audio.sfx('click');
      this.render();
    });
    panel.append(btn);
    overlay.append(panel);
    this.root.append(overlay);
  }

  showEndScreen() {
    const firstTime = !this.finished;
    this.finished = true;
    if (firstTime) {
      Audio.setScene('menu');
      const playerWon = this.mode === 'hotseat' ? this.game.winner !== -1 : this.game.winner === 0;
      if (playerWon) this.vfx.celebrate();
    }
    const overlay = el('div', 'end-overlay');
    const panel = el('div', 'end-panel');
    if (this.mode === 'hotseat') {
      const w = this.game.winner;
      const title = w === -1 ? '⚖️ Ничья!' : `🏆 ${this.game.players[w].name} побеждает!`;
      if (firstTime) Audio.sfx('win');
      panel.append(el('div', 'end-title', title));
      panel.append(el('div', 'end-sub', 'Славная дуэль Восходящих!'));
    } else {
      const won = this.game.winner === 0;
      if (firstTime) Audio.sfx(won ? 'win' : 'lose');
      panel.append(el('div', 'end-title', won ? '🏆 Победа!' : '💀 Поражение'));
      panel.append(el('div', 'end-sub', won ? 'Звёздная Кровь поёт в ваших жилах!' : 'Восхождение продолжается. Попробуйте ещё раз.'));
    }
    const btn = el('button', 'btn primary', 'Продолжить');
    btn.addEventListener('click', () => {
      const result = this.mode === 'hotseat' ? this.game.winner : this.game.winner === 0;
      this.opts.onFinish(result);
    });
    panel.append(btn);
    overlay.append(panel);
    this.root.append(overlay);
  }
}
