// Non-battle screens: main menu, class picker, campaign map, collection with
// deck editor and crafting. Each render function fills `root` and wires
// navigation callbacks through the shared `nav` object from main.js.

import { el, buildCardEl } from './cardRender.js';
import { CLASSES, STARTER_DECKS, DECK_SIZE, MAX_COPIES } from '../data/decks.js';
import { CAMPAIGN } from '../data/campaign.js';
import { collectibleForClass, getCard, RANKS } from '../data/cards.js';
import * as Save from '../state/save.js';
import { Audio } from '../audio/audio.js';
import { ART } from '../data/art-manifest.js';

export function renderMenu(root, nav) {
  root.replaceChildren();
  Audio.setScene('menu');
  const s = Save.load();
  const wrap = el('div', 'menu-screen');
  const logo = el('div', 'game-logo');
  if (ART.has('logo_emblem')) {
    logo.classList.add('has-image');
    logo.style.backgroundImage = 'url("assets/art/logo_emblem.webp")';
  } else logo.textContent = '🌌';
  wrap.append(logo);
  wrap.append(el('h1', 'game-title', 'Звёздная Кровь'));
  wrap.append(el('div', 'game-subtitle', 'Руны Восхождения — коллекционная карточная игра'));

  const stats = el('div', 'menu-stats',
    `✦ ${s.gold} звёздных монет · 🏆 ${s.stats.wins} побед · Восхождение: ${s.campaignProgress}/${CAMPAIGN.length}`);
  wrap.append(stats);

  const buttons = el('div', 'menu-buttons');
  const btnCampaign = el('button', 'btn primary big', '⚔️ Кампания: Путь Восхождения');
  btnCampaign.addEventListener('click', () => nav.go('campaign'));
  const btnQuick = el('button', 'btn big', '🎲 Быстрый бой с ИИ');
  btnQuick.addEventListener('click', () => nav.go('quickPick'));
  const btnPvp = el('button', 'btn big', '🤝 PvP на одном экране');
  btnPvp.addEventListener('click', () => nav.go('pvpPick'));
  const btnCollection = el('button', 'btn big', '🃏 Коллекция Рун');
  btnCollection.addEventListener('click', () => nav.go('collection'));
  buttons.append(btnCampaign, btnQuick, btnPvp, btnCollection);
  wrap.append(buttons);

  const reset = el('button', 'btn danger small-btn', 'Сбросить прогресс');
  reset.addEventListener('click', () => {
    if (confirm('Точно сбросить весь прогресс?')) { Save.resetAll(); nav.go('menu'); }
  });
  wrap.append(reset);
  root.append(wrap);
}

// Pick an Ascendant before a battle.
export function renderClassPick(root, nav, onPick, subtitle) {
  root.replaceChildren();
  const wrap = el('div', 'pick-screen');
  wrap.append(el('h2', 'screen-title', 'Выберите Восходящего'));
  if (subtitle) wrap.append(el('div', 'screen-sub', subtitle));
  const grid = el('div', 'class-grid');
  for (const [cls, meta] of Object.entries(CLASSES)) {
    const cardBtn = el('div', `class-card theme-${cls}`);
    const iconEl = el('div', 'class-icon');
    if (ART.has('hero_' + cls)) {
      iconEl.classList.add('has-image');
      iconEl.style.backgroundImage = `url("assets/art/hero_${cls}.webp")`;
    } else {
      iconEl.textContent = meta.icon;
    }
    cardBtn.append(iconEl);
    cardBtn.append(el('div', 'class-hero-name', meta.hero));
    cardBtn.append(el('div', 'class-name', meta.name));
    cardBtn.append(el('div', 'class-desc', meta.desc));
    const s = Save.load();
    const hasCustom = s.activeDeck && s.activeDeck.class === cls;
    cardBtn.append(el('div', 'class-deck-tag', hasCustom ? '⭐ Своя колода' : 'Стартовая колода'));
    cardBtn.addEventListener('click', () => onPick(cls));
    grid.append(cardBtn);
  }
  wrap.append(grid);
  wrap.append(backButton(nav));
  root.append(wrap);
}

export function renderCampaign(root, nav) {
  root.replaceChildren();
  const s = Save.load();
  const wrap = el('div', 'campaign-screen');
  wrap.append(el('h2', 'screen-title', '⚔️ Путь Восхождения'));
  wrap.append(el('div', 'screen-sub', 'Одолейте десятерых — от одичавших варгов до Безвременья. Награда: звёздные монеты и новые Руны.'));

  const path = el('div', 'campaign-path');
  CAMPAIGN.forEach((enc, i) => {
    const state = i < s.campaignProgress ? 'done' : i === s.campaignProgress ? 'current' : 'locked';
    const node = el('div', `enc-node enc-${state}`);
    const iconEl = el('div', 'enc-icon');
    const bossArt = 'boss_' + enc.id;
    if (state !== 'locked' && ART.has(bossArt)) {
      iconEl.classList.add('has-image');
      iconEl.style.backgroundImage = `url("assets/art/${bossArt}.webp")`;
    } else {
      iconEl.textContent = state === 'locked' ? '🔒' : enc.icon;
    }
    node.append(iconEl);
    const info = el('div', 'enc-info');
    info.append(el('div', 'enc-name', `${i + 1}. ${enc.name}`));
    info.append(el('div', 'enc-class', `${CLASSES[enc.class].icon} ${CLASSES[enc.class].name} · ${diffLabel(enc.difficulty)}${enc.boss ? ' · 👑 БОСС' : ''}`));
    if (state !== 'locked') info.append(el('div', 'enc-intro', enc.intro));
    info.append(el('div', 'enc-reward', `Награда: ✦${enc.rewardGold} + ${enc.unlocks.length} Рун`));
    node.append(info);
    if (state === 'current') {
      const btn = el('button', 'btn primary', 'В бой!');
      btn.addEventListener('click', () => nav.startCampaignBattle(i));
      node.append(btn);
    } else if (state === 'done') {
      node.append(el('div', 'enc-check', '✅'));
    }
    path.append(node);
  });
  if (s.campaignProgress >= CAMPAIGN.length) {
    path.append(el('div', 'campaign-done', '🎉 Восхождение завершено! Ваше имя вписано в Звёздную Кровь!'));
  }
  wrap.append(path);
  wrap.append(backButton(nav));
  root.append(wrap);
}

function diffLabel(d) {
  return d === 'easy' ? 'Легко' : d === 'hard' ? 'Сложно' : 'Средне';
}

// Collection browser + deck editor + crafting.
export function renderCollection(root, nav) {
  root.replaceChildren();
  const s = Save.load();
  const wrap = el('div', 'collection-screen');
  wrap.append(el('h2', 'screen-title', '🃏 Коллекция Рун'));
  wrap.append(el('div', 'screen-sub', `✦ ${s.gold} звёздных монет — открывайте Руны и собирайте колоды. Ранги: Дерево · Бронза · Серебро · Золото.`));

  let currentClass = nav.state.collectionClass || 'vincent';
  const tabs = el('div', 'class-tabs');
  for (const [cls, meta] of Object.entries(CLASSES)) {
    const t = el('button', `tab ${cls === currentClass ? 'active' : ''}`, `${meta.icon} ${meta.name}`);
    t.addEventListener('click', () => { nav.state.collectionClass = cls; renderCollection(root, nav); });
    tabs.append(t);
  }
  wrap.append(tabs);

  const deckKey = 'deck_' + currentClass;
  if (!nav.state[deckKey]) {
    const saved = s.activeDeck && s.activeDeck.class === currentClass
      ? s.activeDeck.cards : STARTER_DECKS[currentClass];
    nav.state[deckKey] = saved.slice();
  }
  const deck = nav.state[deckKey];

  const layout = el('div', 'collection-layout');

  const grid = el('div', 'card-grid');
  const cards = collectibleForClass(currentClass).slice()
    .sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name));
  for (const c of cards) {
    const owned = s.unlocked.includes(c.id);
    const inDeck = deck.filter((id) => id === c.id).length;
    const node = buildCardEl(c, { locked: !owned });
    if (inDeck > 0) {
      node.classList.add('in-deck');
      node.append(el('div', 'deck-count-badge', `×${inDeck}`));
    }
    node.addEventListener('click', () => {
      if (!owned) {
        const cost = Save.CRAFT_COST[c.rarity || 'wood'] || 40;
        const rank = RANKS[c.rarity || 'wood']?.label || 'Дерево';
        if (confirm(`Открыть «${c.name}» (${rank}) за ✦${cost} звёздных монет?`)) {
          if (Save.spendGold(cost)) { Save.unlockCards([c.id]); renderCollection(root, nav); }
          else alert('Недостаточно звёздных монет. Проходите кампанию!');
        }
        return;
      }
      if (inDeck < MAX_COPIES && deck.length < DECK_SIZE) {
        deck.push(c.id);
        renderCollection(root, nav);
      }
    });
    grid.append(node);
  }
  layout.append(grid);

  const side = el('div', 'deck-panel');
  side.append(el('div', 'deck-panel-title', `Колода: ${deck.length}/${DECK_SIZE}`));
  const list = el('div', 'deck-list');
  const counts = {};
  for (const id of deck) counts[id] = (counts[id] || 0) + 1;
  const entries = Object.entries(counts)
    .map(([id, n]) => ({ card: getCard(id), n }))
    .sort((a, b) => a.card.cost - b.card.cost || a.card.name.localeCompare(b.card.name));
  for (const { card, n } of entries) {
    const rowEl = el('div', 'deck-row');
    rowEl.append(el('span', 'deck-row-cost', String(card.cost)));
    rowEl.append(el('span', 'deck-row-name', card.name));
    rowEl.append(el('span', 'deck-row-count', n > 1 ? `×${n}` : ''));
    rowEl.addEventListener('click', () => {
      const idx = deck.indexOf(card.id);
      if (idx !== -1) { deck.splice(idx, 1); renderCollection(root, nav); }
    });
    list.append(rowEl);
  }
  side.append(list);

  const saveBtn = el('button', `btn primary ${deck.length === DECK_SIZE ? '' : 'disabled'}`, 'Сохранить колоду');
  saveBtn.disabled = deck.length !== DECK_SIZE;
  saveBtn.addEventListener('click', () => {
    Save.setActiveDeck({ class: currentClass, cards: deck.slice() });
    saveBtn.textContent = '✅ Сохранено!';
    setTimeout(() => { saveBtn.textContent = 'Сохранить колоду'; }, 1200);
  });
  side.append(saveBtn);

  const resetBtn = el('button', 'btn', 'Стартовая колода');
  resetBtn.addEventListener('click', () => {
    nav.state[deckKey] = STARTER_DECKS[currentClass].slice();
    renderCollection(root, nav);
  });
  side.append(resetBtn);
  layout.append(side);

  wrap.append(layout);
  wrap.append(backButton(nav));
  root.append(wrap);
}

// Victory reward screen after campaign battles.
export function renderReward(root, nav, enc) {
  root.replaceChildren();
  const wrap = el('div', 'reward-screen');
  wrap.append(el('h2', 'screen-title', '🏆 Победа!'));
  wrap.append(el('div', 'screen-sub', `«${enc.name}» повержен!`));
  wrap.append(el('div', 'reward-gold', `+✦ ${enc.rewardGold} звёздных монет`));
  const cardsRow = el('div', 'reward-cards');
  for (const id of enc.unlocks) {
    const node = buildCardEl(getCard(id), { small: false });
    node.classList.add('reward-card');
    cardsRow.append(node);
  }
  wrap.append(el('div', 'reward-label', 'Новые Руны в коллекции:'));
  wrap.append(cardsRow);
  const btn = el('button', 'btn primary big', 'Продолжить');
  btn.addEventListener('click', () => nav.go('campaign'));
  wrap.append(btn);
  root.append(wrap);
}

function backButton(nav) {
  const b = el('button', 'btn back-btn', '← В меню');
  b.addEventListener('click', () => nav.go('menu'));
  return b;
}
