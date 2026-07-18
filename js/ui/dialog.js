// Кастомные модалки и тултипы вместо системных confirm/alert/title.

import { el } from './cardRender.js';
import { KEYWORDS } from '../data/cards.js';

// ---------- Модальные окна ----------
function buildModal(title, text) {
  const overlay = el('div', 'modal-overlay');
  overlay.tabIndex = -1;
  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') overlay.querySelector('.modal-actions .btn:not(.primary)')?.click() ||
      overlay.querySelector('.modal-actions .btn')?.click();
  });
  const panel = el('div', 'modal-panel');
  panel.append(el('div', 'modal-title', title));
  if (text) panel.append(el('div', 'modal-text', text));
  const row = el('div', 'modal-actions');
  panel.append(row);
  overlay.append(panel);
  document.body.append(overlay);
  requestAnimationFrame(() => overlay.classList.add('show'));
  return { overlay, row };
}

function closeModal(overlay) {
  overlay.classList.remove('show');
  setTimeout(() => overlay.remove(), 200);
}

export function confirmDialog(title, text, okText = 'Да', cancelText = 'Отмена') {
  return new Promise((resolve) => {
    const { overlay, row } = buildModal(title, text);
    const ok = el('button', 'btn primary', okText);
    const cancel = el('button', 'btn', cancelText);
    ok.addEventListener('click', () => { closeModal(overlay); resolve(true); });
    cancel.addEventListener('click', () => { closeModal(overlay); resolve(false); });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) { closeModal(overlay); resolve(false); }
    });
    row.append(cancel, ok);
    ok.focus();
  });
}

export function alertDialog(title, text, okText = 'Понятно') {
  return new Promise((resolve) => {
    const { overlay, row } = buildModal(title, text);
    const ok = el('button', 'btn primary', okText);
    ok.addEventListener('click', () => { closeModal(overlay); resolve(); });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) { closeModal(overlay); resolve(); }
    });
    row.append(ok);
    ok.focus();
  });
}

// ---------- Тултипы ----------
let tipEl = null;

function ensureTip() {
  if (!tipEl) {
    tipEl = el('div', 'game-tooltip');
    document.body.append(tipEl);
  }
  return tipEl;
}

function positionTip(target) {
  const r = target.getBoundingClientRect();
  const tip = ensureTip();
  const tw = tip.offsetWidth, th = tip.offsetHeight;
  let x = r.left + r.width / 2 - tw / 2;
  let y = r.top - th - 12;
  if (y < 8) y = r.bottom + 12;
  x = Math.max(8, Math.min(x, window.innerWidth - tw - 8));
  tip.style.left = x + 'px';
  tip.style.top = y + 'px';
}

// Привязывает тултип к ноде; contentFn() возвращает DOM-узел при наведении.
export function attachTooltip(node, contentFn) {
  let over = false;
  node.addEventListener('mouseenter', () => {
    over = true;
    setTimeout(() => {
      if (!over || !node.isConnected) return;
      const tip = ensureTip();
      tip.replaceChildren(contentFn());
      tip.classList.add('show');
      positionTip(node);
    }, 250);
  });
  node.addEventListener('mouseleave', () => {
    over = false;
    tipEl?.classList.remove('show');
  });
  node.addEventListener('pointerdown', () => tipEl?.classList.remove('show'));
}

// Содержимое тултипа карты/существа: имя, текст, глоссарий ключевых слов.
export function cardTipContent({ name, cost, type, text, keywords = [], extra = [] }) {
  const box = el('div', 'tip-card');
  const head = el('div', 'tip-head');
  head.append(el('span', 'tip-name', name));
  if (cost != null) head.append(el('span', 'tip-cost', String(cost)));
  box.append(head);
  if (type) box.append(el('div', 'tip-type', type));
  if (text) box.append(el('div', 'tip-text', text));
  for (const line of extra) box.append(el('div', 'tip-extra', line));
  const kws = keywords.filter((k) => KEYWORDS[k]);
  if (kws.length) {
    const gl = el('div', 'tip-glossary');
    for (const k of kws) {
      const row = el('div', 'tip-kw');
      row.append(el('b', '', KEYWORDS[k].label + '. '));
      row.append(document.createTextNode(KEYWORDS[k].desc));
      gl.append(row);
    }
    box.append(gl);
  }
  return box;
}
