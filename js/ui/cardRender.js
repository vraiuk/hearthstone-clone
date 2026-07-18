// DOM builders for cards and minions. Shared by the battle screen and the
// collection/deck editor. Pure functions: state in, element out.

import { KEYWORDS, RANKS } from '../data/cards.js';
import { ART } from '../data/art-manifest.js';

// Арт-бокс: ИИ-картинка, если она нарезана, иначе эмодзи на градиенте.
function applyArt(node, key, emoji) {
  if (ART.has(key)) {
    node.classList.add('has-image');
    node.style.backgroundImage = `url("assets/art/${key}.webp")`;
    node.textContent = '';
  } else {
    node.textContent = emoji || '❔';
  }
}

export function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = text;
  return node;
}

// A hand/collection card.
export function buildCardEl(card, opts = {}) {
  const root = el('div', `card theme-${card.theme || 'nature'} type-${card.type}`);
  if (opts.small) root.classList.add('card-small');
  if (opts.unplayable) root.classList.add('unplayable');
  if (opts.locked) root.classList.add('locked');
  root.dataset.instanceId = card.instanceId || '';
  root.dataset.cardId = card.id || '';

  const cost = el('div', 'card-cost', String(card.cost));
  cost.title = 'Стоимость в Звёздной Крови';
  const art = el('div', 'card-art');
  applyArt(art, card.id, card.art);
  const name = el('div', 'card-name', card.name);
  const text = el('div', 'card-text', card.text || '');

  root.append(cost, art, name, text);

  if (card.gloryCost) {
    const glory = el('div', 'card-glory', `⭐${card.gloryCost}`);
    glory.title = `Титульная карта: требует ${card.gloryCost} Славы`;
    root.append(glory);
  }

  if (card.type === 'minion') {
    root.append(
      el('div', 'card-attack', String(card.attack)),
      el('div', 'card-health', String(card.health)),
    );
  } else if (card.type === 'weapon') {
    root.append(
      el('div', 'card-attack', String(card.attack)),
      el('div', 'card-health card-durability', String(card.durability)),
    );
    root.classList.add('is-weapon');
  } else {
    root.classList.add('is-spell');
  }
  if (card.rarity && card.rarity !== 'wood') {
    const dot = el('div', `card-rarity rarity-${card.rarity}`);
    dot.title = RANKS[card.rarity]?.label || '';
    root.append(dot);
  }
  if (opts.locked) root.append(el('div', 'card-lock', '🔒'));
  return root;
}

// A minion on the board. С ИИ-артом тайл становится арт-доминантным:
// картинка на весь тайл, имя на градиентной плашке снизу.
export function buildMinionEl(m, game) {
  const root = el('div', `minion theme-${m.theme || 'nature'}`);
  root.dataset.instanceId = m.instanceId;
  if (ART.has(m.cardId)) {
    root.classList.add('art-full');
    root.style.backgroundImage = `url("assets/art/${m.cardId}.webp")`;
  }
  const atk = game ? game.effectiveAttack(m) : m.attack;

  if (m.keywords.has('taunt') && !m.silenced) root.classList.add('has-taunt');
  if (m.divineShield) root.classList.add('has-shield');
  if (m.frozen) root.classList.add('is-frozen');
  if (m.silenced) root.classList.add('is-silenced');
  if (m.shackled) root.classList.add('is-shackled');
  if (m.keywords.has('stealth') && !m.silenced) root.classList.add('is-stealth');

  const art = el('div', 'minion-art');
  applyArt(art, m.cardId, m.art);
  const name = el('div', 'minion-name', m.name);
  const stats = el('div', 'minion-stats');
  const a = el('span', 'minion-attack', String(atk));
  const h = el('span', 'minion-health', String(m.health));
  if (m.health < m.maxHealth) h.classList.add('damaged');
  if (game && atk > m.attack) a.classList.add('buffed'); // Связь и баффы
  stats.append(a, h);
  root.append(art, name, stats);

  const badges = el('div', 'minion-badges');
  if (m.deathrattle && !m.silenced) badges.append(el('span', 'badge', '💀'));
  if (m.spellDamage && !m.silenced) badges.append(el('span', 'badge', '🔮'));
  if (m.keywords.has('lifesteal')) badges.append(el('span', 'badge', '🩸'));
  if (m.keywords.has('poisonous') && !m.silenced) badges.append(el('span', 'badge', '☠️'));
  if (m.keywords.has('windfury')) badges.append(el('span', 'badge', '🌀'));
  if (m.spellShield) badges.append(el('span', 'badge', '🔰'));
  if (m.shackled) badges.append(el('span', 'badge', '⛓️'));
  if (m.keywords.has('stealth') && !m.silenced) badges.append(el('span', 'badge', '🌫️'));
  if (badges.children.length) root.append(badges);
  return root;
}

// Tooltip text with keyword explanations for a card.
export function cardTooltip(card) {
  const lines = [];
  for (const k of (card.keywords || [])) {
    const kw = KEYWORDS[k];
    if (kw) lines.push(`${kw.label} — ${kw.desc}`);
  }
  return lines.join('\n');
}
