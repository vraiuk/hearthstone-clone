// Кампания «Путь Восхождения»: 10 сражений с нарастающей сложностью.
// Каждое — вражеский Восходящий, колода, ИИ-уровень, боссовые модификаторы
// и награды (Звёздное золото + новые Руны в коллекцию).

import { STARTER_DECKS } from './decks.js';

// Boss modifier hooks understood by the battle controller:
//   extraHealth: N       — boss starts with more health
//   startArmor: N        — boss starts with armor
//   openingBoard: [tok]  — boss starts with tokens on board
//   doubleHeroPower: true — boss uses its Aspect twice per turn
export const CAMPAIGN = [
  {
    id: 'c1', name: 'Одичавший варг-вожак', icon: '🐺', class: 'aino',
    difficulty: 'easy', deckMod: 'weak',
    intro: 'Стая одичала без хозяина. Покажи равнинам, кто здесь Восходящий.',
    rewardGold: 100,
    unlocks: ['sigurd', 'silver_trout'],
  },
  {
    id: 'c2', name: 'Шёпот из Гнезда', icon: '🐛', class: 'mrak',
    difficulty: 'easy', deckMod: 'weak',
    intro: 'Черви прогрызают тоннели под равниной. Их разведчик уже здесь.',
    rewardGold: 100,
    unlocks: ['plague_carrier', 'whirlwing'],
  },
  {
    id: 'c3', name: 'Страж рудников', icon: '⛏️', class: 'vincent',
    difficulty: 'normal',
    intro: 'Народ Земли не пускает чужаков к жилам Звёздной Крови.',
    rewardGold: 150,
    unlocks: ['tolya_grohot', 'siege_kido'],
  },
  {
    id: 'c4', name: 'Речной шаман', icon: '🌊', class: 'veronika',
    difficulty: 'normal',
    intro: 'Народ Реки говорит с течением — и течение шепчет ему твои ходы.',
    rewardGold: 150,
    unlocks: ['aurvak', 'mind_thief'],
  },
  {
    id: 'c5', name: 'Толя Грохот', icon: '🪨', class: 'vincent',
    difficulty: 'normal', boss: { startArmor: 5 },
    intro: 'БОСС. Живая гора в Боевом Доспехе. Начинает бой с 5 брони.',
    rewardGold: 250,
    unlocks: ['igg_hammer', 'torq', 'rotting_golem'],
    addCards: ['tolya_grohot', 'tolya_grohot'],
  },
  {
    id: 'c6', name: 'Ледяная Заводь', icon: '🧊', class: 'azimandia',
    difficulty: 'normal', boss: { openingBoard: ['iceShard', 'iceShard'] },
    intro: 'БОСС. Хозяйка заводи начинает бой с ледяными осколками на столе.',
    rewardGold: 250,
    unlocks: ['star_ice', 'timeless_echo', 'lendo'],
  },
  {
    id: 'c7', name: 'Вожак Дикой Охоты', icon: '🌕', class: 'aino',
    difficulty: 'hard',
    intro: 'Когда встаёт полная луна, звери равнин отвечают только ему.',
    rewardGold: 200,
    unlocks: ['wild_hunt', 'pack_leader', 'elder_varg'],
    addCards: ['wild_hunt'],
  },
  {
    id: 'c8', name: 'Матка Гнезда', icon: '🕸️', class: 'mrak',
    difficulty: 'hard', boss: { extraHealth: 10 },
    intro: 'БОСС. 40 здоровья и бесконечный Рой. Личинки не кончаются никогда.',
    rewardGold: 300,
    unlocks: ['nest_queen', 'imago_executioner', 'death_mark'],
    addCards: ['nest_queen', 'nest_queen'],
  },
  {
    id: 'c9', name: 'Белый Дьявол', icon: '👤', class: 'mrak',
    difficulty: 'hard', boss: { startArmor: 8 },
    intro: 'БОСС. Тень с 8 брони. Говорят, его клинки не знают промаха.',
    rewardGold: 300,
    unlocks: ['executioner_blades', 'night_terror', 'will_empress'],
    addCards: ['executioner_blades', 'night_terror', 'night_terror'],
  },
  {
    id: 'c10', name: 'Азимандия Безвременья', icon: '⏳', class: 'azimandia',
    difficulty: 'hard', boss: { extraHealth: 10, startArmor: 5, doubleHeroPower: true },
    intro: 'ФИНАЛ. Отражение Азимандии из другой ветви времени: 40 здоровья, 5 брони, двойной Аспект.',
    rewardGold: 500,
    unlocks: ['time_loop', 'red_wave', 'herald_ascension'],
    addCards: ['red_wave', 'star_comet', 'timeless_echo'],
  },
];

// Build the enemy deck for an encounter. 'weak' removes the top-end cards so
// early fights stay beginner-friendly; addCards splices in boss signatures.
export function encounterDeck(enc) {
  let base = STARTER_DECKS[enc.class].slice();
  if (enc.deckMod === 'weak') {
    const cheap = ['pup_karkh', 'tauro_bull', 'burrower', 'steel_sentinel', 'gremlin_digger'];
    const expensive = ['drill_walker', 'deep_horror', 'thunder_tauro', 'plains_matriarch',
      'rune_keeper', 'ascension_banner', 'night_carver', 'elimination', 'word_of_void'];
    let swapIdx = 0;
    base = base.map((id) => expensive.includes(id) ? cheap[(swapIdx++) % cheap.length] : id);
  }
  if (enc.addCards) {
    // Boss signature cards replace the first N cards of the deck.
    base = [...enc.addCards, ...base.slice(enc.addCards.length)];
  }
  return base;
}
