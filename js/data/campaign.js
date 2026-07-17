// Campaign: a 10-encounter journey with escalating difficulty and bosses.
// Each encounter defines the enemy hero, deck, AI difficulty, optional boss
// modifiers, and rewards (gold + unlocked cards).

import { STARTER_DECKS } from './decks.js';

// Boss modifier hooks understood by the battle controller:
//   extraHealth: N       — boss starts with more health
//   startArmor: N        — boss starts with armor
//   openingBoard: [tok]  — boss starts with tokens on board
//   doubleHeroPower: true — boss hero power usable twice per turn (AI)
export const CAMPAIGN = [
  {
    id: 'c1', name: 'Разбойник с большой дороги', icon: '🗡️', class: 'hunter',
    difficulty: 'easy', deckMod: 'weak',
    intro: 'Первый противник на пути к славе. Он полагается на грубую силу.',
    rewardGold: 100,
    unlocks: ['argent_squire', 'vampire_bat'],
  },
  {
    id: 'c2', name: 'Болотная ведьма', icon: '🧹', class: 'mage',
    difficulty: 'easy', deckMod: 'weak',
    intro: 'Колдует в трясине и не любит гостей. Осторожнее с её заклинаниями.',
    rewardGold: 100,
    unlocks: ['rush_drake', 'aimed_shot'],
  },
  {
    id: 'c3', name: 'Капитан наёмников', icon: '🪖', class: 'warrior',
    difficulty: 'normal',
    intro: 'Ветеран сотни битв. Его броня крепка, а топор — острее слов.',
    rewardGold: 150,
    unlocks: ['mortal_strike', 'siege_machine'],
  },
  {
    id: 'c4', name: 'Тёмный проповедник', icon: '📿', class: 'priest',
    difficulty: 'normal',
    intro: 'Лечит своих и хоронит чужих. Не давай ему затянуть игру.',
    rewardGold: 150,
    unlocks: ['prayer', 'war_hawk'],
  },
  {
    id: 'c5', name: 'Хозяин арены', icon: '🏛️', class: 'warrior',
    difficulty: 'normal', boss: { startArmor: 5 },
    intro: 'БОСС. Начинает бой с 5 брони. Толпа жаждет зрелища!',
    rewardGold: 250,
    unlocks: ['banner_warrior', 'plague_rat'],
  },
  {
    id: 'c6', name: 'Ледяная вдова', icon: '🕸️', class: 'mage',
    difficulty: 'normal', boss: { openingBoard: ['spiderling', 'spiderling'] },
    intro: 'БОСС. Начинает бой с паучками на столе. Держи удар с первого хода.',
    rewardGold: 250,
    unlocks: ['blizzard', 'harpy'],
  },
  {
    id: 'c7', name: 'Повелитель зверей', icon: '🐗', class: 'hunter',
    difficulty: 'hard',
    intro: 'Его звери чуют страх. Зачищай поле или умри под лапами.',
    rewardGold: 200,
    unlocks: ['alpha_wolf', 'crusader'],
  },
  {
    id: 'c8', name: 'Инквизитор света', icon: '☀️', class: 'priest',
    difficulty: 'hard', boss: { extraHealth: 10 },
    intro: 'БОСС. 40 здоровья и бесконечное исцеление. Запасись уроном.',
    rewardGold: 300,
    unlocks: ['archbishop'],
  },
  {
    id: 'c9', name: 'Генерал легиона', icon: '👹', class: 'warrior',
    difficulty: 'hard', boss: { startArmor: 8 },
    intro: 'БОСС. 8 брони и элитные войска. Это уже не игрушки.',
    rewardGold: 300,
    unlocks: ['fire_comet'],
  },
  {
    id: 'c10', name: 'Архимаг бездны', icon: '🌀', class: 'mage',
    difficulty: 'hard', boss: { extraHealth: 10, startArmor: 5, doubleHeroPower: true },
    intro: 'ФИНАЛЬНЫЙ БОСС. 40 здоровья, 5 брони, двойная сила героя. Удачи.',
    rewardGold: 500,
    unlocks: ['tavern_keeper'],
  },
];

// Build the enemy deck for an encounter. 'weak' removes the top-end cards so
// early fights stay beginner-friendly.
export function encounterDeck(enc) {
  const base = STARTER_DECKS[enc.class].slice();
  if (enc.deckMod === 'weak') {
    // Swap expensive cards for cheap vanilla minions.
    const cheap = ['wisp', 'murloc_raider', 'river_croc', 'bloodfen_raptor', 'ironfur_grizzly'];
    let swapIdx = 0;
    return base.map((id) => {
      // crude cost check without importing CARDS: known expensive ids
      const expensive = ['flamestrike', 'war_golem', 'boulderfist_ogre', 'archmage', 'core_hound',
        'savannah_highmane', 'temple_enforcer', 'lord_of_arena', 'reckless_rocketeer', 'abomination'];
      if (expensive.includes(id)) return cheap[(swapIdx++) % cheap.length];
      return id;
    });
  }
  return base;
}
