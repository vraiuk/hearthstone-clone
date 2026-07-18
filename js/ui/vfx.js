// Визуальные эффекты боя. Движок шлёт события через game.onEvent; BattleScreen
// копит их в очередь и вызывает flush() ПОСЛЕ рендера, когда DOM-ноды существ
// уже на месте. Все эффекты — чистый CSS/DOM, без внешних ассетов.

function nodeFor(root, entity, pid) {
  if (!entity) return null;
  if (entity.isHero) {
    const side = entity.playerId === pid ? 'friendly' : 'enemy';
    return root.querySelector(`.hero-portrait[data-hero="${side}"]`);
  }
  return root.querySelector(`.minion[data-instance-id="${entity.instanceId}"]`);
}

function centerOf(node) {
  const r = node.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

// Всплывающий текст в точке экрана.
function floatAt(x, y, text, cls) {
  const el = document.createElement('div');
  el.className = `fx-float ${cls}`;
  el.textContent = text;
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  document.body.append(el);
  setTimeout(() => el.remove(), 1100);
}

// Всплывающее число (урон/лечение) над целью.
function floatNumber(node, text, cls) {
  const { x, y } = centerOf(node);
  floatAt(x, y, text, cls);
}

// Расширяющееся кольцо (призыв существа, мощные эффекты).
export function ringBurst(x, y, color = '#ffd76e') {
  const r = document.createElement('div');
  r.className = 'fx-ring';
  r.style.cssText = `left:${x}px;top:${y}px;border-color:${color};`;
  document.body.append(r);
  setTimeout(() => r.remove(), 650);
}

// Ударная волна в точке попадания.
export function impactRipple(x, y) {
  const r = document.createElement('div');
  r.className = 'fx-ripple';
  r.style.cssText = `left:${x}px;top:${y}px;`;
  document.body.append(r);
  setTimeout(() => r.remove(), 500);
}

// Полёт клона карты из руки в точку на столе (розыгрыш).
export function flyCard(cardNode, toX, toY, onDone) {
  const rect = cardNode.getBoundingClientRect();
  const clone = cardNode.cloneNode(true);
  clone.className = cardNode.className + ' fx-fly-card';
  clone.style.cssText = `left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;`;
  document.body.append(clone);
  requestAnimationFrame(() => {
    clone.style.transform =
      `translate(${toX - rect.left - rect.width / 2}px, ${toY - rect.top - rect.height / 2}px) scale(.55) rotate(4deg)`;
    clone.style.opacity = '0';
  });
  setTimeout(() => { clone.remove(); onDone && onDone(); }, 340);
}

// Гаснущая дуга атаки «кто → кого» — считывается направление удара.
function attackTrail(from, to) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'fx-trail');
  const mx = (from.x + to.x) / 2;
  const my = Math.min(from.y, to.y) - 40 - Math.abs(to.x - from.x) * 0.06;
  svg.innerHTML = `<path d="M ${from.x} ${from.y} Q ${mx} ${my} ${to.x} ${to.y}"
    fill="none" stroke="#ff2050" stroke-width="5" stroke-linecap="round" opacity=".85"/>`;
  document.body.append(svg);
  setTimeout(() => svg.remove(), 550);
}

// Вспышка на цели (удар / щит).
function flash(node, cls) {
  node.classList.remove(cls);
  void node.offsetWidth; // перезапуск анимации
  node.classList.add(cls);
  setTimeout(() => node.classList.remove(cls), 500);
}

// Разлетающиеся частицы в точке.
function burst(x, y, { count = 10, colors = ['#ffd76e'], size = 6, dist = 55, dur = 650, shape = 'circle' } = {}) {
  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.className = 'fx-particle';
    const ang = (Math.PI * 2 * i) / count + Math.random() * 0.7;
    const d = dist * (0.5 + Math.random() * 0.7);
    const s = size * (0.6 + Math.random() * 0.8);
    p.style.cssText = `left:${x}px;top:${y}px;width:${s}px;height:${s}px;` +
      `background:${colors[i % colors.length]};` +
      `border-radius:${shape === 'circle' ? '50%' : '2px'};` +
      `--dx:${Math.cos(ang) * d}px;--dy:${Math.sin(ang) * d}px;` +
      `animation-duration:${dur}ms;`;
    document.body.append(p);
    setTimeout(() => p.remove(), dur + 50);
  }
}

// Тряска всего поля.
function shake(root, strong = false) {
  const b = root.querySelector('.battle');
  if (!b) return;
  const cls = strong ? 'fx-shake-strong' : 'fx-shake';
  b.classList.remove('fx-shake', 'fx-shake-strong');
  void b.offsetWidth;
  b.classList.add(cls);
  setTimeout(() => b.classList.remove(cls), 450);
}

export class VFX {
  constructor(root, getPid) {
    this.root = root;
    this.getPid = getPid;
    this.queue = [];
    // Позиции сущностей на момент ПРОШЛОГО рендера: эффекты смерти и урона
    // играют точно на месте, даже если DOM-нода уже удалена.
    this.lastPositions = new Map();
  }

  // Снимок позиций перед перерисовкой (вызывает BattleScreen.render()).
  snapshotPositions(pid) {
    const map = new Map();
    this.root.querySelectorAll('.minion[data-instance-id]').forEach((n) => {
      map.set('m' + n.dataset.instanceId, centerOf(n));
    });
    const fr = this.root.querySelector('.hero-portrait[data-hero="friendly"]');
    const en = this.root.querySelector('.hero-portrait[data-hero="enemy"]');
    if (fr) map.set('h' + pid, centerOf(fr));
    if (en) map.set('h' + (pid === 0 ? 1 : 0), centerOf(en));
    if (map.size) this.lastPositions = map;
  }

  // Позиция сущности: живая нода или последняя известная точка.
  posFor(entity, pid) {
    const node = nodeFor(this.root, entity, pid);
    if (node) return centerOf(node);
    const key = entity.isHero ? 'h' + entity.playerId : 'm' + entity.instanceId;
    return this.lastPositions.get(key) || null;
  }

  push(event) { this.queue.push(event); }

  // Проиграть накопленные события поверх свежего DOM.
  flush() {
    const events = this.queue.splice(0);
    const pid = this.getPid();
    let delay = 0;
    for (const ev of events) {
      const run = () => this.play(ev, pid);
      if (delay === 0) run();
      else setTimeout(run, delay);
      // Лёгкий каскад, чтобы одновременные события читались глазом.
      if (ev.type === 'damage' || ev.type === 'death') delay += 60;
    }
  }

  play(ev, pid) {
    const root = this.root;
    switch (ev.type) {
      case 'damage': {
        const node = nodeFor(root, ev.target, pid);
        const pos = this.posFor(ev.target, pid);
        if (!pos) return;
        floatAt(pos.x, pos.y, `−${ev.amount}`, ev.amount >= 5 ? 'fx-dmg fx-crit' : 'fx-dmg');
        if (node) flash(node, 'fx-hit');
        burst(pos.x, pos.y, { count: 8, colors: ['#ff5d7a', '#ffb1c1', '#c0392b'], size: 5, dist: 40 });
        if (ev.amount >= 5) shake(root, ev.amount >= 8);
        break;
      }
      case 'heal': {
        const node = nodeFor(root, ev.target, pid);
        if (!node) return;
        floatNumber(node, `+${ev.amount}`, 'fx-heal');
        flash(node, 'fx-healed');
        const { x, y } = centerOf(node);
        burst(x, y, { count: 6, colors: ['#7ee787', '#c2f5c8'], size: 5, dist: 34, dur: 800 });
        break;
      }
      case 'death': {
        // Точное место гибели — из снапшота позиций прошлого рендера.
        const pos = this.posFor(ev.target, pid);
        if (!pos) return;
        burst(pos.x, pos.y, { count: 14, colors: ['#9a93bd', '#56508f', '#2c2950'], size: 7, dist: 70, dur: 750, shape: 'square' });
        floatAt(pos.x, pos.y, '💀', 'fx-skull');
        break;
      }
      case 'shieldPop': {
        const node = nodeFor(root, ev.target, pid);
        if (!node) return;
        flash(node, 'fx-shield-pop');
        const { x, y } = centerOf(node);
        burst(x, y, { count: 12, colors: ['#ffd76e', '#fff3c9'], size: 4, dist: 48, dur: 700 });
        floatNumber(node, 'ЩИТ', 'fx-shield-text');
        break;
      }
      case 'attack': {
        const from = this.posFor(ev.attacker, pid);
        const to = this.posFor(ev.target, pid);
        if (!from || !to) return;
        const a = nodeFor(root, ev.attacker, pid);
        if (a) {
          a.style.setProperty('--lx', (to.x - from.x) * 0.35 + 'px');
          a.style.setProperty('--ly', (to.y - from.y) * 0.35 + 'px');
          flash(a, 'fx-lunge');
        }
        // След удара: гаснущая алая дуга «кто → кого».
        attackTrail(from, to);
        // Ударная волна + искры в точке контакта чуть позже выпада.
        setTimeout(() => {
          impactRipple(to.x, to.y);
          burst(to.x, to.y, { count: 10, colors: ['#ffd76e', '#ff5d7a', '#fff'], size: 4, dist: 34, dur: 450 });
        }, 140);
        break;
      }
      case 'summon': {
        const node = nodeFor(root, ev.target, pid);
        if (!node) return;
        flash(node, 'fx-summoned');
        break;
      }
    }
  }

  // Залп победных звёзд.
  celebrate() {
    const w = window.innerWidth, h = window.innerHeight;
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        burst(w * (0.2 + Math.random() * 0.6), h * (0.25 + Math.random() * 0.3), {
          count: 18, colors: ['#ffd76e', '#ff5d7a', '#7ee787', '#8fc7ff'],
          size: 7, dist: 110, dur: 1100,
        });
      }, i * 220);
    }
  }
}
