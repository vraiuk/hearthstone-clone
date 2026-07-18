// Перетаскивание в бою: карты из руки на стол/в цель и атаки существ
// прицельной стрелой. Pointer Events — работает и мышью, и пальцем.
//
// Философия UX (как в классических ККИ):
//   • карта-существо / руна без цели → тянем на стол, отпускаем — разыгрыш;
//   • руна с целью / сила героя      → стрела от карты к цели;
//   • своё существо / герой          → стрела атаки к врагу.
// Клик-выбор остаётся как fallback: короткий тап без движения = старый флоу.

const DRAG_THRESHOLD = 8; // px до входа в режим перетаскивания

export class DragController {
  // host: BattleScreen — используем его game/pid/методы разыгрыша.
  constructor(host) {
    this.host = host;
    this.active = null;      // текущая операция перетаскивания
    this.arrowSvg = null;
    this.ghost = null;
    this.buildArrow();
    // Глобальные обработчики живут один раз.
    this.onMove = (e) => this.pointerMove(e);
    this.onUp = (e) => this.pointerUp(e);
    window.addEventListener('pointermove', this.onMove, { passive: false });
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('pointercancel', this.onUp);
  }

  destroy() {
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('pointercancel', this.onUp);
    this.arrowSvg?.remove();
    this.ghost?.remove();
  }

  // ---------- стрела Звёздной Крови ----------
  buildArrow() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'target-arrow');
    svg.innerHTML = `
      <defs>
        <linearGradient id="arrowGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#ff5d7a" stop-opacity=".25"/>
          <stop offset="1" stop-color="#ff2050"/>
        </linearGradient>
      </defs>
      <path class="arrow-path" fill="none" stroke="url(#arrowGrad)" stroke-width="7"
            stroke-linecap="round" stroke-dasharray="14 10"/>
      <polygon class="arrow-head" fill="#ff2050"/>`;
    svg.style.display = 'none';
    document.body.append(svg);
    this.arrowSvg = svg;
  }

  drawArrow(x1, y1, x2, y2) {
    const svg = this.arrowSvg;
    svg.style.display = 'block';
    // Квадратичная кривая с подъёмом — стрела «парит» над столом.
    const mx = (x1 + x2) / 2;
    const my = Math.min(y1, y2) - 60 - Math.abs(x2 - x1) * 0.08;
    const path = svg.querySelector('.arrow-path');
    path.setAttribute('d', `M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`);
    // Наконечник ориентируем по касательной в конце кривой.
    const ang = Math.atan2(y2 - my, x2 - mx);
    const s = 16;
    const p = (a, r) => `${x2 + Math.cos(a) * r},${y2 + Math.sin(a) * r}`;
    svg.querySelector('.arrow-head').setAttribute('points',
      `${p(ang, s)} ${p(ang + 2.5, s)} ${p(ang - 2.5, s)}`);
  }

  hideArrow() { this.arrowSvg.style.display = 'none'; }

  // ---------- запуск перетаскиваний (вызывается из battle.js) ----------
  // Карта из руки.
  armCard(node, card) {
    node.addEventListener('pointerdown', (e) => {
      if (!this.host.canAct()) return;
      e.preventDefault();
      this.arm({ kind: 'card', card, node, e });
    });
  }

  // Своё существо (атака).
  armMinion(node, minion) {
    node.addEventListener('pointerdown', (e) => {
      if (!this.host.canAct()) return;
      this.arm({ kind: 'attack', attacker: minion, node, e });
    });
  }

  // Свой герой (атака оружием).
  armHero(node, hero) {
    node.addEventListener('pointerdown', (e) => {
      if (!this.host.canAct()) return;
      this.arm({ kind: 'attack', attacker: hero, node, e });
    });
  }

  // Сила героя.
  armPower(node) {
    node.addEventListener('pointerdown', (e) => {
      if (!this.host.canAct()) return;
      this.arm({ kind: 'power', node, e });
    });
  }

  arm(op) {
    const { e } = op;
    this.active = {
      ...op,
      startX: e.clientX, startY: e.clientY,
      dragging: false,
    };
  }

  // ---------- жизненный цикл ----------
  pointerMove(e) {
    const a = this.active;
    if (!a) return;
    const dx = e.clientX - a.startX, dy = e.clientY - a.startY;
    if (!a.dragging) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      this.beginDrag(a, e);
      // beginDrag мог отменить операцию (нет целей, спящее существо).
      if (!this.active) return;
    }
    e.preventDefault();
    this.updateDrag(a, e);
  }

  beginDrag(a, e) {
    a.dragging = true;
    const host = this.host;
    const rect = a.node.getBoundingClientRect();
    a.originX = rect.left + rect.width / 2;
    a.originY = rect.top + rect.height / 2;

    if (a.kind === 'card') {
      const card = a.card;
      const targeted = host.game.cardNeedsTarget(card);
      const targets = targeted ? host.game.validTargets(host.pid, card) : [];
      // Руна с целью и живыми целями → стрела; иначе — призрак карты.
      a.mode = (targeted && card.type === 'spell' && targets.length) ? 'arrow' : 'ghost';
      a.targets = targets;
      if (a.mode === 'ghost') {
        this.ghost = a.node.cloneNode(true);
        this.ghost.className = a.node.className + ' drag-ghost';
        this.ghost.style.width = rect.width + 'px';
        this.ghost.style.height = rect.height + 'px';
        document.body.append(this.ghost);
        a.node.classList.add('drag-source');
        host.showDropZone(card);
      } else {
        host.highlightTargets(a.targets);
      }
    } else if (a.kind === 'attack') {
      a.mode = 'arrow';
      const foe = host.game.players[host.foePid];
      a.targets = [...foe.board, foe.hero]
        .filter((t) => host.game.canAttack(host.pid, a.attacker, t).ok);
      if (!a.targets.length) { this.cancel(); return; }
      host.highlightTargets(a.targets);
    } else if (a.kind === 'power') {
      const power = host.currentPower();
      if (power.targeted) {
        a.mode = 'arrow';
        a.targets = host.game.heroPowerTargets(host.pid);
        host.highlightTargets(a.targets);
      } else {
        // Бесцелевую силу активируем сразу — тянуть некуда.
        this.cancel();
        host.usePowerUntargeted();
      }
    }
  }

  updateDrag(a, e) {
    if (!a.dragging) return;
    if (a.mode === 'ghost' && this.ghost) {
      this.ghost.style.left = e.clientX + 'px';
      this.ghost.style.top = e.clientY + 'px';
      this.host.markDropHover(this.zoneUnder(e));
    } else if (a.mode === 'arrow') {
      this.drawArrow(a.originX, a.originY, e.clientX, e.clientY);
      this.host.markTargetHover(this.entityUnder(e, a.targets));
    }
  }

  pointerUp(e) {
    const a = this.active;
    if (!a) return;
    this.active = null;
    if (!a.dragging) return; // короткий тап — отдаём клик-флоу
    e.preventDefault();
    const host = this.host;

    if (a.mode === 'ghost') {
      const inZone = this.zoneUnder(e);
      this.cleanup(a);
      if (inZone) host.playDragged(a.card, null);
    } else if (a.mode === 'arrow') {
      const target = this.entityUnder(e, a.targets);
      this.cleanup(a);
      if (!target) return;
      if (a.kind === 'card') host.playDragged(a.card, target);
      else if (a.kind === 'attack') host.attackDragged(a.attacker, target);
      else if (a.kind === 'power') host.powerDragged(target);
    }
  }

  cancel() { if (this.active) { this.cleanup(this.active); this.active = null; } }

  cleanup(a) {
    this.hideArrow();
    this.ghost?.remove();
    this.ghost = null;
    a.node?.classList.remove('drag-source');
    this.host.clearDragHints();
  }

  // ---------- хит-тест ----------
  // Что под курсором (призрак/стрела не мешают: у них pointer-events:none).
  zoneUnder(e) {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    return !!el?.closest('.board-friendly, .board-enemy, .center-bar');
  }

  entityUnder(e, targets) {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el) return null;
    const minionNode = el.closest('.minion');
    if (minionNode) {
      const id = Number(minionNode.dataset.instanceId);
      return targets.find((t) => !t.isHero && t.instanceId === id) || null;
    }
    const heroNode = el.closest('.hero-portrait');
    if (heroNode) {
      const side = heroNode.dataset.hero;
      const pid = side === 'friendly' ? this.host.pid : this.host.foePid;
      return targets.find((t) => t.isHero && t.playerId === pid) || null;
    }
    return null;
  }
}
