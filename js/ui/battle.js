// Battle screen: renders game state, handles player input (drag-free click
// targeting), animates the AI turn, and reports the result via onFinish.

import { Game, HERO_POWERS } from '../engine/game.js';
import { AI } from '../ai/ai.js';
import { buildCardEl, buildMinionEl, el } from './cardRender.js';
import { CLASSES } from '../data/decks.js';

const AI_STEP_MS = 650;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class BattleScreen {
  // opts: { root, playerClass, playerDeck, enemy: {name, class, deck, difficulty, boss, icon}, onFinish }
  constructor(opts) {
    this.root = opts.root;
    this.opts = opts;
    this.selected = null;   // { kind:'card'|'minion'|'hero'|'power', ... }
    this.busy = false;      // true while AI acts or animations run
    this.finished = false;

    this.game = new Game({
      players: [
        { name: 'Вы', hero: opts.playerClass, deck: opts.playerDeck },
        { name: opts.enemy.name, hero: opts.enemy.class, deck: opts.enemy.deck },
      ],
      log: (msg) => this.pushLog(msg),
    });
    this.ai = new AI(opts.enemy.difficulty || 'normal');

    // Boss modifiers.
    const boss = opts.enemy.boss;
    if (boss) {
      const hero = this.game.players[1].hero;
      if (boss.extraHealth) { hero.maxHealth += boss.extraHealth; hero.health += boss.extraHealth; }
      if (boss.startArmor) hero.armor += boss.startArmor;
    }
    this.game.start(0); // player goes first; enemy gets coin
    if (boss && boss.openingBoard) {
      for (const tok of boss.openingBoard) {
        const m = this.game.summonToken(1, tok);
        if (m) m.summonedThisTurn = false;
      }
    }
    this.logLines = [];
    this.render();
  }

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
    const me = g.players[0], foe = g.players[1];
    this.root.replaceChildren();

    const board = el('div', 'battle');

    board.append(this.heroRow(foe, 'enemy'));
    board.append(this.boardRow(foe, 'enemy'));
    board.append(this.centerBar());
    board.append(this.boardRow(me, 'friendly'));
    board.append(this.heroRow(me, 'friendly'));
    board.append(this.handRow(me));

    // Log panel.
    const log = el('div', 'battle-log');
    log.append(el('div', 'battle-log-title', 'Журнал'));
    const lines = el('div', 'battle-log-lines');
    (this.logLines || []).slice(-8).forEach((l) => lines.append(el('div', 'log-line', l)));
    log.append(lines);
    board.append(log);

    this.root.append(board);
    this.updateSelectability();

    if (g.over && !this.finished) this.showEndScreen();
  }

  heroRow(p, side) {
    const g = this.game;
    const row = el('div', `hero-row hero-${side}`);
    const cls = CLASSES[p.heroClass];

    const portrait = el('div', `hero-portrait theme-${p.heroClass}`);
    portrait.dataset.hero = side;
    portrait.append(el('div', 'hero-icon', side === 'enemy' ? (this.opts.enemy.icon || cls.icon) : cls.icon));
    portrait.append(el('div', 'hero-name', p.name));
    const hp = el('div', 'hero-health', String(Math.max(0, p.hero.health)));
    if (p.hero.armor > 0) hp.append(el('span', 'hero-armor', '🛡' + p.hero.armor));
    portrait.append(hp);
    if (p.hero.attack > 0) portrait.append(el('div', 'hero-attack', '⚔' + p.hero.attack));
    if (p.weapon) portrait.append(el('div', 'hero-weapon', `🪓${p.weapon.attack}/${p.weapon.durability}`));
    if (p.hero.frozen) portrait.classList.add('is-frozen');

    // Hero power button.
    const power = HERO_POWERS[p.heroClass];
    const powerBtn = el('div', 'hero-power', power.icon);
    powerBtn.title = `${power.name}: ${power.desc} (2 маны)`;
    if (p.heroPowerUsed || p.mana < 2) powerBtn.classList.add('used');
    powerBtn.dataset.power = side;

    // Mana crystals.
    const mana = el('div', 'mana-bar');
    mana.append(el('span', 'mana-text', `${p.mana}/${p.maxMana}`));
    const crystals = el('span', 'mana-crystals');
    for (let i = 0; i < p.maxMana; i++) {
      const c = el('span', 'crystal');
      if (i < p.mana) c.classList.add('full');
      crystals.append(c);
    }
    mana.append(crystals);

    const deckInfo = el('div', 'deck-info', `🂠 ${p.deck.length}`);
    if (side === 'enemy') deckInfo.append(el('span', 'hand-count', ` ✋ ${p.hand.length}`));

    if (side === 'friendly') row.append(portrait, powerBtn, mana, deckInfo);
    else row.append(portrait, powerBtn, mana, deckInfo);

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
    const endBtn = el('button', 'end-turn-btn', this.busy ? 'Ход противника…' : 'Завершить ход');
    endBtn.disabled = this.busy || this.game.over;
    endBtn.addEventListener('click', () => this.onEndTurn());
    bar.append(endBtn);
    const hint = el('div', 'action-hint', this.hintText());
    bar.append(hint);
    return bar;
  }

  handRow(p) {
    const row = el('div', 'hand-row');
    for (const c of p.hand) {
      const playable = !this.busy && this.game.current === 0 &&
        this.game.canPlayCard(0, c.instanceId, null).ok;
      const node = buildCardEl(c, { unplayable: !playable });
      node.addEventListener('click', () => this.onHandCardClick(c));
      row.append(node);
    }
    return row;
  }

  hintText() {
    if (this.game.over) return '';
    if (this.busy) return 'Противник думает…';
    if (!this.selected) return 'Ваш ход. Кликните карту или существо.';
    if (this.selected.kind === 'card') return `«${this.selected.card.name}» — выберите цель.`;
    if (this.selected.kind === 'power') return 'Сила героя — выберите цель.';
    if (this.selected.kind === 'minion') return `«${this.selected.minion.name}» — выберите цель атаки.`;
    if (this.selected.kind === 'hero') return 'Герой — выберите цель атаки.';
    return '';
  }

  // Highlight valid targets / selected entity.
  updateSelectability() {
    this.root.querySelectorAll('.is-selected').forEach((n) => n.classList.remove('is-selected'));
    this.root.querySelectorAll('.is-target').forEach((n) => n.classList.remove('is-target'));
    if (!this.selected) return;

    const markMinion = (m) => {
      const node = this.root.querySelector(`.minion[data-instance-id="${m.instanceId}"]`);
      if (node) node.classList.add('is-target');
    };
    const markHero = (side) => {
      const node = this.root.querySelector(`.hero-portrait[data-hero="${side}"]`);
      if (node) node.classList.add('is-target');
    };

    if (this.selected.kind === 'card') {
      const node = this.root.querySelector(`.card[data-instance-id="${this.selected.card.instanceId}"]`);
      if (node) node.classList.add('is-selected');
      for (const t of this.selected.targets) {
        if (t.isHero) markHero(t.playerId === 0 ? 'friendly' : 'enemy');
        else markMinion(t);
      }
    } else if (this.selected.kind === 'power') {
      const node = this.root.querySelector('.hero-power[data-power="friendly"]');
      if (node) node.classList.add('is-selected');
      for (const t of this.selected.targets) {
        if (t.isHero) markHero(t.playerId === 0 ? 'friendly' : 'enemy');
        else markMinion(t);
      }
    } else if (this.selected.kind === 'minion' || this.selected.kind === 'hero') {
      const g = this.game;
      const attacker = this.selected.kind === 'hero' ? g.players[0].hero : this.selected.minion;
      if (this.selected.kind === 'minion') {
        const node = this.root.querySelector(`.minion[data-instance-id="${attacker.instanceId}"]`);
        if (node) node.classList.add('is-selected');
      } else {
        const node = this.root.querySelector('.hero-portrait[data-hero="friendly"]');
        if (node) node.classList.add('is-selected');
      }
      const foe = g.players[1];
      for (const t of [...foe.board, foe.hero]) {
        if (g.canAttack(0, attacker, t).ok) {
          if (t.isHero) markHero('enemy'); else markMinion(t);
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
    if (this.busy || this.game.over || this.game.current !== 0) return;
    const check = this.game.canPlayCard(0, card.instanceId, null);
    if (!check.ok) { this.toast(check.reason); return; }

    if (this.game.cardNeedsTarget(card)) {
      const targets = this.game.validTargets(0, card);
      if (targets.length === 0) {
        // battlecry with no targets → play without effect (minions only)
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
    const res = this.game.playCard(0, card.instanceId, target);
    if (!res.ok) this.toast(res.reason);
    this.selected = null;
    this.render();
  }

  onPowerClick(side) {
    if (side !== 'friendly' || this.busy || this.game.over || this.game.current !== 0) return;
    const check = this.game.canUseHeroPower(0, null);
    if (!check.ok) { this.toast(check.reason); return; }
    const power = HERO_POWERS[this.game.players[0].heroClass];
    if (power.targeted) {
      const targets = this.game.heroPowerTargets(0);
      this.selected = { kind: 'power', targets };
      this.render();
      return;
    }
    this.game.useHeroPower(0, null);
    this.selected = null;
    this.render();
  }

  onMinionClick(m, side) {
    if (this.busy || this.game.over || this.game.current !== 0) return;

    // If something is selected, try to use minion as target.
    if (this.selected) {
      if (this.tryResolveTarget(m)) return;
    }
    if (side === 'friendly') {
      // Select for attack.
      const g = this.game;
      const foe = g.players[1];
      const anyTarget = [...foe.board, foe.hero].some((t) => g.canAttack(0, m, t).ok);
      if (!anyTarget) {
        const reason = g.canAttack(0, m, foe.hero).reason || 'Существо не может атаковать.';
        this.toast(reason);
        return;
      }
      this.selected = { kind: 'minion', minion: m };
      this.render();
    } else {
      this.toast('Сначала выберите свою карту или существо.');
    }
  }

  onHeroClick(side) {
    if (this.busy || this.game.over || this.game.current !== 0) return;
    const g = this.game;
    if (this.selected) {
      const hero = side === 'enemy' ? g.players[1].hero : g.players[0].hero;
      if (this.tryResolveTarget(hero)) return;
    }
    if (side === 'friendly') {
      const me = g.players[0];
      if (me.hero.attack > 0) {
        const foe = g.players[1];
        const anyTarget = [...foe.board, foe.hero].some((t) => g.canAttack(0, me.hero, t).ok);
        if (!anyTarget) { this.toast('Герой не может атаковать.'); return; }
        this.selected = { kind: 'hero' };
        this.render();
      }
    }
  }

  // Returns true if the click consumed the selection.
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
        g.useHeroPower(0, entity);
        this.selected = null; this.render();
        return true;
      }
      this.selected = null; this.render();
      return false;
    }
    if (sel.kind === 'minion' || sel.kind === 'hero') {
      const attacker = sel.kind === 'hero' ? g.players[0].hero : sel.minion;
      const check = g.canAttack(0, attacker, entity);
      if (check.ok) {
        this.animateAttack(attacker, entity);
        g.attack(0, attacker, entity);
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

  animateAttack(attacker, target) {
    const sel = attacker.isHero
      ? this.root.querySelector('.hero-portrait[data-hero="friendly"]')
      : this.root.querySelector(`.minion[data-instance-id="${attacker.instanceId}"]`);
    if (sel) { sel.classList.add('attacking'); }
  }

  async onEndTurn() {
    if (this.busy || this.game.over) return;
    this.selected = null;
    this.busy = true;
    this.game.endTurn();
    this.render();
    await sleep(AI_STEP_MS);
    try {
      await this.ai.takeTurn(this.game, 1, async () => {
        this.render();
        await sleep(AI_STEP_MS);
      });
      // Boss: double hero power.
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

  showEndScreen() {
    this.finished = true;
    const won = this.game.winner === 0;
    const overlay = el('div', 'end-overlay');
    const panel = el('div', 'end-panel');
    panel.append(el('div', 'end-title', won ? '🏆 Победа!' : '💀 Поражение'));
    panel.append(el('div', 'end-sub', won ? 'Таверна гудит в вашу честь!' : 'В следующий раз повезёт больше.'));
    const btn = el('button', 'btn primary', 'Продолжить');
    btn.addEventListener('click', () => this.opts.onFinish(won));
    panel.append(btn);
    overlay.append(panel);
    this.root.append(overlay);
  }
}
