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

// Всплывающее число (урон/лечение) над целью.
function floatNumber(node, text, cls) {
  const { x, y } = centerOf(node);
  const el = document.createElement('div');
  el.className = `fx-float ${cls}`;
  el.textContent = text;
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  document.body.append(el);
  setTimeout(() => el.remove(), 1100);
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
        if (!node) return;
        floatNumber(node, `−${ev.amount}`, 'fx-dmg');
        flash(node, 'fx-hit');
        const { x, y } = centerOf(node);
        burst(x, y, { count: 8, colors: ['#ff5d7a', '#ffb1c1', '#c0392b'], size: 5, dist: 40 });
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
        // Нода уже удалена рендером — рисуем взрыв по последней позиции не выйдет,
        // поэтому взрываемся в центре соответствующего ряда.
        const side = ev.target.owner === pid ? 'friendly' : 'enemy';
        const row = root.querySelector(`.board-${side}`);
        if (!row) return;
        const { x, y } = centerOf(row);
        burst(x, y, { count: 14, colors: ['#9a93bd', '#56508f', '#2c2950'], size: 7, dist: 70, dur: 750, shape: 'square' });
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
        const a = nodeFor(root, ev.attacker, pid);
        const t = nodeFor(root, ev.target, pid);
        if (a && t) {
          const from = centerOf(a), to = centerOf(t);
          a.style.setProperty('--lx', (to.x - from.x) * 0.35 + 'px');
          a.style.setProperty('--ly', (to.y - from.y) * 0.35 + 'px');
          flash(a, 'fx-lunge');
        }
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
