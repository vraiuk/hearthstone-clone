// База Рун «Звёздной Крови». Карты — чистые данные: статы + декларативные
// «оп-коды» эффектов (см. engine/effects.js).
//
// Ранги (rarity): wood (Дерево), bronze (Бронза), silver (Серебро), gold (Золото).
// Фракции (faction): 'земля' | 'травы' | 'река' | 'черви' | null.
// Племена (tribe): 'зверь' | 'механизм' | 'червь' | null.
// Титульные карты: gloryCost — требуют Славы (за убийства существ врага).

export const KEYWORDS = {
  taunt: { label: 'Провокация', desc: 'Врагам нужно атаковать это существо первым.' },
  charge: { label: 'Рывок', desc: 'Может атаковать сразу.' },
  rush: { label: 'Натиск', desc: 'Может атаковать существ сразу.' },
  divineShield: { label: 'Щит', desc: 'Первый полученный урон игнорируется.' },
  lifesteal: { label: 'Похищение жизни', desc: 'Урон этим существом лечит вашего героя.' },
  windfury: { label: 'Неистовство', desc: 'Может атаковать дважды за ход.' },
  poisonous: { label: 'Яд', desc: 'Уничтожает любое существо, которому наносит урон.' },
  stealth: { label: 'Скрытность', desc: 'Не может быть целью, пока не атакует.' },
};

export const RANKS = {
  wood: { label: 'Дерево', color: '#9b7a52' },
  bronze: { label: 'Бронза', color: '#cd7f32' },
  silver: { label: 'Серебро', color: '#c9d1d9' },
  gold: { label: 'Золото', color: '#ffd700' },
};

// Токены — существа, призываемые эффектами; вне коллекции.
export const TOKENS = {
  karkhCub: { name: 'Молодой карх', cost: 1, type: 'minion', attack: 2, health: 1, keywords: ['charge'], tribe: 'зверь', faction: 'травы', art: '🦎', theme: 'nature', token: true },
  tauroCalf: { name: 'Телёнок тауро', cost: 1, type: 'minion', attack: 1, health: 2, keywords: ['taunt'], tribe: 'зверь', faction: 'травы', art: '🐂', theme: 'nature', token: true },
  vargToken: { name: 'Варг', cost: 2, type: 'minion', attack: 2, health: 2, tribe: 'зверь', faction: 'травы', art: '🐺', theme: 'nature', token: true },
  vargPup: { name: 'Варжонок', cost: 1, type: 'minion', attack: 1, health: 1, keywords: ['charge'], tribe: 'зверь', faction: 'травы', art: '🐺', theme: 'nature', token: true },
  larva: { name: 'Личинка', cost: 1, type: 'minion', attack: 1, health: 1, tribe: 'червь', faction: 'черви', art: '🐛', theme: 'shadow', token: true },
  iceShard: { name: 'Ледяной осколок', cost: 1, type: 'minion', attack: 1, health: 3, keywords: ['taunt'], faction: 'река', art: '🧊', theme: 'frost', token: true },
  phantom: { name: 'Фантом', cost: 0, type: 'minion', attack: 0, health: 2, keywords: ['taunt'], art: '👻', theme: 'arcane', token: true },
  slug: { name: 'Слизень', cost: 0, type: 'minion', attack: 1, health: 1, art: '🐌', theme: 'nature', token: true },
  kidoWreck: { name: 'Обломок кидо', cost: 1, type: 'minion', attack: 2, health: 1, tribe: 'механизм', faction: 'земля', art: '🦾', theme: 'mech', token: true },
  wildBoar: { name: 'Свирепый варг', cost: 3, type: 'minion', attack: 4, health: 2, keywords: ['charge'], tribe: 'зверь', faction: 'травы', art: '🐺', theme: 'nature', token: true },
  oldTauro: { name: 'Старый тауро', cost: 3, type: 'minion', attack: 4, health: 4, keywords: ['taunt'], tribe: 'зверь', faction: 'травы', art: '🐂', theme: 'nature', token: true },
  skyKarkh: { name: 'Небесная кархиня', cost: 3, type: 'minion', attack: 2, health: 4, keywords: ['windfury'], tribe: 'зверь', faction: 'травы', art: '🦅', theme: 'nature', token: true },
};

const CARD_LIST = [
  // ======================= МАЛЫЕ РУНЫ (некоколлекционные) =======================
  { id: 'rune_spark', name: 'Малая руна: Искра', cost: 1, type: 'spell', class: 'azimandia', rarity: 'wood', uncollectible: true, art: '⚡', theme: 'arcane', text: 'Наносит 2 ед. урона.', spell: { ops: [{ op: 'damage', target: 'chosen', amount: 2 }], targeted: true } },
  { id: 'rune_frost', name: 'Малая руна: Иней', cost: 1, type: 'spell', class: 'azimandia', rarity: 'wood', uncollectible: true, art: '❄️', theme: 'frost', text: 'Наносит 1 ед. урона и замораживает цель.', spell: { ops: [{ op: 'damage', target: 'chosen', amount: 1 }, { op: 'freeze', target: 'chosen' }], targeted: true } },
  { id: 'rune_mend', name: 'Малая руна: Шов', cost: 1, type: 'spell', class: 'azimandia', rarity: 'wood', uncollectible: true, art: '🪡', theme: 'holy', text: 'Восстанавливает 4 ед. здоровья.', spell: { ops: [{ op: 'heal', target: 'chosen', amount: 4 }], targeted: true } },

  // ======================= НАРОД ЗЕМЛИ (нейтральные) =======================
  { id: 'gremlin_digger', name: 'Гремлин-бурильщик', cost: 1, type: 'minion', class: 'neutral', rarity: 'wood', attack: 1, health: 2, tribe: 'механизм', faction: 'земля', art: '⛏️', theme: 'mech', text: '' },
  { id: 'steel_sentinel', name: 'Стальной часовой', cost: 2, type: 'minion', class: 'neutral', rarity: 'wood', attack: 2, health: 2, keywords: ['taunt'], tribe: 'механизм', faction: 'земля', art: '🤖', theme: 'mech', text: 'Провокация.' },
  { id: 'miner_scout', name: 'Рудничный разведчик', cost: 2, type: 'minion', class: 'neutral', rarity: 'wood', attack: 1, health: 1, faction: 'земля', art: '🔦', theme: 'mech', text: 'Боевой клич: возьмите руну.', battlecry: { ops: [{ op: 'draw', amount: 1 }] } },
  { id: 'hoplite_kido', name: 'Гоплит Кидо', cost: 3, type: 'minion', class: 'neutral', rarity: 'wood', attack: 2, health: 5, tribe: 'механизм', faction: 'земля', art: '🛡️', theme: 'mech', text: '' },
  { id: 'sigurd', name: 'Специалист Сигурд', cost: 3, type: 'minion', class: 'neutral', rarity: 'bronze', attack: 2, health: 3, faction: 'земля', art: '🧰', theme: 'mech', text: 'Боевой клич: раскапывает руну «Алый Поток».', battlecry: { ops: [{ op: 'addToHand', cardId: 'red_stream' }] } },
  { id: 'rusty_reaper', name: 'Ржавый жнец', cost: 3, type: 'minion', class: 'neutral', rarity: 'wood', attack: 2, health: 3, tribe: 'механизм', faction: 'земля', art: '🦾', theme: 'mech', text: 'Предсмертный хрип: призывает Обломок кидо 2/1.', deathrattle: { ops: [{ op: 'summon', token: 'kidoWreck', count: 1 }] } },
  { id: 'tolya_grohot', name: 'Толя Грохот', cost: 4, type: 'minion', class: 'neutral', rarity: 'bronze', attack: 3, health: 5, keywords: ['taunt'], spellShield: true, faction: 'земля', art: '🪨', theme: 'mech', text: 'Провокация. Боевой Доспех: отражает первую вражескую руну.' },
  { id: 'quarry_golem', name: 'Карьерный голем', cost: 4, type: 'minion', class: 'neutral', rarity: 'wood', attack: 4, health: 5, tribe: 'механизм', faction: 'земля', art: '🗿', theme: 'mech', text: '' },
  { id: 'forge_smith', name: 'Хмельной оружейник', cost: 4, type: 'minion', class: 'neutral', rarity: 'wood', attack: 4, health: 4, faction: 'земля', art: '🍺', theme: 'mech', text: 'Боевой клич: даёт существу +2 к атаке.', battlecry: { ops: [{ op: 'buff', target: 'chosen', attack: 2, health: 0 }], targeted: true } },
  { id: 'ruins_keeper', name: 'Хранитель руин', cost: 4, type: 'minion', class: 'neutral', rarity: 'wood', attack: 2, health: 4, faction: 'земля', art: '🏚️', theme: 'mech', text: 'Боевой клич: возьмите руну.', battlecry: { ops: [{ op: 'draw', amount: 1 }] } },
  { id: 'barricade', name: 'Живая баррикада', cost: 5, type: 'minion', class: 'neutral', rarity: 'wood', attack: 3, health: 6, keywords: ['taunt'], faction: 'земля', art: '🧱', theme: 'mech', text: 'Провокация.' },
  { id: 'siege_kido', name: 'Осадный кидо', cost: 5, type: 'minion', class: 'neutral', rarity: 'wood', attack: 5, health: 6, keywords: ['taunt'], tribe: 'механизм', faction: 'земля', art: '🛞', theme: 'mech', text: 'Провокация.' },
  { id: 'drill_walker', name: 'Шагоход-бур', cost: 6, type: 'minion', class: 'neutral', rarity: 'wood', attack: 6, health: 7, tribe: 'механизм', faction: 'земля', art: '🏗️', theme: 'mech', text: '' },

  // ======================= НАРОД ТРАВ (нейтральные) =======================
  { id: 'pup_karkh', name: 'Кархёнок', cost: 1, type: 'minion', class: 'neutral', rarity: 'wood', attack: 2, health: 1, tribe: 'зверь', faction: 'травы', art: '🦎', theme: 'nature', text: '' },
  { id: 'tauro_bull', name: 'Боевой тауро', cost: 2, type: 'minion', class: 'neutral', rarity: 'wood', attack: 2, health: 3, tribe: 'зверь', faction: 'травы', art: '🐂', theme: 'nature', text: '' },
  { id: 'swift_varg', name: 'Быстрый варг', cost: 3, type: 'minion', class: 'neutral', rarity: 'wood', attack: 3, health: 1, keywords: ['charge'], tribe: 'зверь', faction: 'травы', art: '🐺', theme: 'nature', text: 'Рывок.' },
  { id: 'riding_karkh', name: 'Ездовой Карх', cost: 3, type: 'minion', class: 'neutral', rarity: 'wood', attack: 2, health: 3, tribe: 'зверь', faction: 'травы', bond: { attack: 2, requires: 'зверь' }, art: '🐎', theme: 'nature', text: 'Связь: +2 к атаке, пока у вас есть другой зверь.' },
  { id: 'sky_hawk', name: 'Равнинный ястреб', cost: 3, type: 'minion', class: 'neutral', rarity: 'wood', attack: 3, health: 2, keywords: ['windfury'], tribe: 'зверь', faction: 'травы', art: '🦅', theme: 'nature', text: 'Неистовство.' },
  { id: 'lendo', name: 'Лэндо Солнечное Крыло', cost: 4, type: 'minion', class: 'neutral', rarity: 'bronze', attack: 3, health: 3, faction: 'травы', art: '☀️', theme: 'holy', text: 'Боевой клич: даёт дружественному существу Рывок.', battlecry: { ops: [{ op: 'buff', target: 'chosen', attack: 0, health: 0, keywords: ['charge'] }], targeted: true, targetFilter: 'friendlyMinion' } },
  { id: 'plains_matriarch', name: 'Матриарх равнин', cost: 5, type: 'minion', class: 'neutral', rarity: 'wood', attack: 4, health: 5, keywords: ['taunt'], tribe: 'зверь', faction: 'травы', art: '🦬', theme: 'nature', text: 'Провокация.' },
  { id: 'white_varg', name: 'Белый Варг', cost: 6, type: 'minion', class: 'neutral', rarity: 'gold', attack: 5, health: 5, keywords: ['windfury'], tribe: 'зверь', faction: 'травы', art: '🐺', theme: 'frost', text: 'Неистовство. Предсмертный хрип: призывает двух варгов 2/2.', deathrattle: { ops: [{ op: 'summon', token: 'vargToken', count: 2 }] } },
  { id: 'thunder_tauro', name: 'Громовой тауро', cost: 7, type: 'minion', class: 'neutral', rarity: 'wood', attack: 9, health: 5, tribe: 'зверь', faction: 'травы', art: '⛈️', theme: 'nature', text: '' },

  // ======================= НАРОД РЕКИ (нейтральные) =======================
  { id: 'river_sprite', name: 'Речной дух', cost: 1, type: 'minion', class: 'neutral', rarity: 'wood', attack: 1, health: 2, spellDamage: 1, faction: 'река', art: '💧', theme: 'frost', text: 'Сила рун +1.' },
  { id: 'pearl_healer', name: 'Жемчужная целительница', cost: 1, type: 'minion', class: 'neutral', rarity: 'wood', attack: 2, health: 1, faction: 'река', art: '🦪', theme: 'frost', text: 'Боевой клич: восстанавливает 2 ед. здоровья.', battlecry: { ops: [{ op: 'heal', target: 'chosen', amount: 2 }], targeted: true } },
  { id: 'silver_trout', name: 'Серебряная Форель', cost: 2, type: 'minion', class: 'neutral', rarity: 'bronze', attack: 2, health: 1, faction: 'река', art: '🐟', theme: 'frost', text: 'Боевой клич: возвращает существо в руку владельца.', battlecry: { ops: [{ op: 'bounce', target: 'chosen' }], targeted: true, targetFilter: 'minion' } },
  { id: 'tide_guard', name: 'Страж прилива', cost: 3, type: 'minion', class: 'neutral', rarity: 'wood', attack: 2, health: 4, keywords: ['taunt'], faction: 'река', art: '🌊', theme: 'frost', text: 'Провокация.' },
  { id: 'aurvak', name: 'Аурвак Владыка Чешуи', cost: 5, type: 'minion', class: 'neutral', rarity: 'silver', attack: 4, health: 6, freezeOnDamage: true, faction: 'река', art: '🐉', theme: 'frost', text: 'Замораживает любое повреждённое им существо.' },
  { id: 'deep_horror', name: 'Глубинный ужас', cost: 7, type: 'minion', class: 'neutral', rarity: 'wood', attack: 7, health: 7, faction: 'река', art: '🦑', theme: 'frost', text: '' },

  // ======================= ЧЕРВИ И ОТРЕКШИЕСЯ (нейтральные) =======================
  { id: 'larva_crawler', name: 'Ползучая личинка', cost: 0, type: 'minion', class: 'neutral', rarity: 'wood', attack: 1, health: 1, tribe: 'червь', faction: 'черви', art: '🐛', theme: 'shadow', text: '' },
  { id: 'exploding_larva', name: 'Взрывная личинка', cost: 1, type: 'minion', class: 'neutral', rarity: 'wood', attack: 2, health: 1, tribe: 'червь', faction: 'черви', art: '💥', theme: 'shadow', text: 'Предсмертный хрип: наносит 2 ед. урона герою противника.', deathrattle: { ops: [{ op: 'damage', target: 'enemyHero', amount: 2 }] } },
  { id: 'burrower', name: 'Червь-прогрызатель', cost: 2, type: 'minion', class: 'neutral', rarity: 'wood', attack: 3, health: 2, tribe: 'червь', faction: 'черви', art: '🪱', theme: 'shadow', text: '' },
  { id: 'carrion_beetle', name: 'Жук-падальщик', cost: 2, type: 'minion', class: 'neutral', rarity: 'wood', attack: 2, health: 1, tribe: 'червь', faction: 'черви', art: '🪲', theme: 'shadow', text: 'Предсмертный хрип: возьмите руну.', deathrattle: { ops: [{ op: 'draw', amount: 1 }] } },
  { id: 'plague_carrier', name: 'Разносчик чумы', cost: 3, type: 'minion', class: 'neutral', rarity: 'bronze', attack: 2, health: 3, keywords: ['poisonous'], tribe: 'червь', faction: 'черви', art: '🐀', theme: 'shadow', text: 'Яд.' },
  { id: 'imago_executioner', name: 'Имаго-Палач', cost: 4, type: 'minion', class: 'neutral', rarity: 'silver', attack: 3, health: 2, keywords: ['poisonous', 'stealth'], tribe: 'червь', faction: 'черви', art: '🦂', theme: 'shadow', text: 'Яд. Скрытность.' },
  { id: 'rotting_golem', name: 'Гниющий голем', cost: 5, type: 'minion', class: 'neutral', rarity: 'bronze', attack: 4, health: 4, keywords: ['taunt'], faction: 'черви', art: '🧟', theme: 'shadow', text: 'Провокация. Предсмертный хрип: наносит 2 ед. урона всем существам.', deathrattle: { ops: [{ op: 'damage', target: 'allMinions', amount: 2 }] } },
  { id: 'nest_queen', name: 'Матка Гнезда', cost: 6, type: 'minion', class: 'neutral', rarity: 'silver', attack: 3, health: 6, tribe: 'червь', faction: 'черви', art: '🕸️', theme: 'shadow', text: 'Боевой клич: заполняет ваше поле личинками 1/1.', battlecry: { ops: [{ op: 'summonFill', token: 'larva', upTo: 7 }] } },

  // ======================= ПРОЧИЕ НЕЙТРАЛЬНЫЕ =======================
  { id: 'shield_disciple', name: 'Ученик со щитом', cost: 1, type: 'minion', class: 'neutral', rarity: 'wood', attack: 1, health: 1, keywords: ['divineShield'], art: '🛡️', theme: 'holy', text: 'Щит.' },
  { id: 'wandering_seer', name: 'Странствующая провидица', cost: 2, type: 'minion', class: 'neutral', rarity: 'wood', attack: 2, health: 2, spellDamage: 1, art: '🔮', theme: 'arcane', text: 'Сила рун +1.' },
  { id: 'ash_owl', name: 'Пепельный сыч', cost: 2, type: 'minion', class: 'neutral', rarity: 'wood', attack: 2, health: 1, tribe: 'зверь', art: '🦉', theme: 'shadow', text: 'Боевой клич: делает существо немым.', battlecry: { ops: [{ op: 'silence', target: 'chosen' }], targeted: true } },
  { id: 'renegade_blade', name: 'Отрёкшийся клинок', cost: 3, type: 'minion', class: 'neutral', rarity: 'wood', attack: 3, health: 1, keywords: ['charge'], art: '⚔️', theme: 'shadow', text: 'Рывок.' },
  { id: 'blood_bat', name: 'Кровавый нетопырь', cost: 3, type: 'minion', class: 'neutral', rarity: 'wood', attack: 3, health: 2, keywords: ['lifesteal'], tribe: 'зверь', art: '🦇', theme: 'shadow', text: 'Похищение жизни.' },
  { id: 'nimble_lizard', name: 'Юркий ящер', cost: 4, type: 'minion', class: 'neutral', rarity: 'wood', attack: 4, health: 4, keywords: ['rush'], tribe: 'зверь', art: '🦖', theme: 'nature', text: 'Натиск.' },
  { id: 'night_carver', name: 'Ночной резчик', cost: 5, type: 'minion', class: 'neutral', rarity: 'wood', attack: 4, health: 4, art: '🌒', theme: 'shadow', text: 'Боевой клич: наносит 3 ед. урона герою противника.', battlecry: { ops: [{ op: 'damage', target: 'enemyHero', amount: 3 }] } },
  { id: 'rocket_grenadier', name: 'Гренадёр-ракетчик', cost: 5, type: 'minion', class: 'neutral', rarity: 'wood', attack: 4, health: 2, faction: 'земля', art: '🚀', theme: 'mech', text: 'Боевой клич: наносит 2 ед. урона.', battlecry: { ops: [{ op: 'damage', target: 'chosen', amount: 2 }], targeted: true } },
  { id: 'whirlwing', name: 'Вихрекрылая', cost: 5, type: 'minion', class: 'neutral', rarity: 'bronze', attack: 4, health: 5, keywords: ['windfury'], art: '🪽', theme: 'nature', text: 'Неистовство.' },
  { id: 'igg_knight', name: 'Игг-Рыцарь', cost: 6, type: 'minion', class: 'neutral', rarity: 'bronze', attack: 5, health: 5, keywords: ['taunt', 'divineShield'], art: '🏇', theme: 'holy', text: 'Провокация. Щит.' },
  // Титульные нейтральные (требуют Славы).
  { id: 'herald_ascension', name: 'Вестник Восхождения', cost: 8, type: 'minion', class: 'neutral', rarity: 'gold', gloryCost: 4, attack: 8, health: 8, keywords: ['taunt', 'lifesteal'], art: '👁️', theme: 'holy', text: 'Титул (4 Славы). Провокация. Похищение жизни.' },
  { id: 'timeless_warden', name: 'Смотритель Безвременья', cost: 9, type: 'minion', class: 'neutral', rarity: 'gold', gloryCost: 5, attack: 8, health: 8, keywords: ['taunt'], art: '⏳', theme: 'arcane', text: 'Титул (5 Славы). Провокация. Боевой клич: возьмите 2 руны.', battlecry: { ops: [{ op: 'draw', amount: 2 }] } },

  // ======================= ВИНСЕНТ КАССИДИ · ПРЕДВОДИТЕЛЬ =======================
  { id: 'igg_spear', name: 'Игг-Копьё', cost: 2, type: 'weapon', class: 'vincent', rarity: 'wood', attack: 2, durability: 2, art: '🔱', theme: 'holy', text: 'Оружие 2/2.', spell: { ops: [{ op: 'weapon', attack: 2, durability: 2 }] } },
  { id: 'shield_wall', name: 'Стена щитов', cost: 3, type: 'spell', class: 'vincent', rarity: 'wood', art: '🛡️', theme: 'holy', text: 'Даёт 5 ед. брони. Возьмите руну.', spell: { ops: [{ op: 'armor', amount: 5 }, { op: 'draw', amount: 1 }] } },
  { id: 'heroic_surge', name: 'Героический порыв', cost: 2, type: 'spell', class: 'vincent', rarity: 'wood', art: '💪', theme: 'fire', text: 'Даёт герою +4 к атаке в этом ходу.', spell: { ops: [{ op: 'heroAttack', amount: 4 }] } },
  { id: 'igg_light', name: 'Игг-Свет', cost: 3, type: 'spell', class: 'vincent', rarity: 'wood', art: '🌟', theme: 'holy', text: 'Наносит 3 ед. урона существу. Червям — 6.', spell: { ops: [{ op: 'damageVsFaction', target: 'chosen', amount: 3, bonus: 3, faction: 'черви' }], targeted: true, targetFilter: 'minion' } },
  { id: 'justice_hammer', name: 'Молот правосудия', cost: 4, type: 'spell', class: 'vincent', rarity: 'wood', art: '🔨', theme: 'holy', text: 'Наносит 4 ед. урона.', spell: { ops: [{ op: 'damage', target: 'chosen', amount: 4 }], targeted: true } },
  { id: 'bastion_captain', name: 'Капитан бастиона', cost: 3, type: 'minion', class: 'vincent', rarity: 'wood', attack: 2, health: 4, keywords: ['taunt'], faction: 'земля', art: '🪖', theme: 'mech', text: 'Провокация. Боевой клич: +2 брони вашему герою.', battlecry: { ops: [{ op: 'armor', amount: 2 }] } },
  { id: 'igg_vanguard', name: 'Авангард Игг', cost: 4, type: 'minion', class: 'vincent', rarity: 'wood', attack: 4, health: 3, keywords: ['charge'], faction: 'земля', art: '⚔️', theme: 'holy', text: 'Рывок.' },
  { id: 'ascension_banner', name: 'Знаменосец Восхождения', cost: 5, type: 'minion', class: 'vincent', rarity: 'wood', attack: 4, health: 4, faction: 'земля', art: '🚩', theme: 'holy', text: 'Боевой клич: даёт вашим существам +1/+1.', battlecry: { ops: [{ op: 'buff', target: 'allFriendlyMinions', attack: 1, health: 1 }] } },
  { id: 'torq', name: 'Торк', cost: 3, type: 'spell', class: 'vincent', rarity: 'bronze', art: '📿', theme: 'holy', text: 'Артефакт: поглощает следующие 3 удара по вашему герою.', spell: { ops: [{ op: 'torq', charges: 3 }] } },
  { id: 'igg_hammer', name: 'Игг-Молот', cost: 5, type: 'weapon', class: 'vincent', rarity: 'silver', attack: 4, durability: 2, art: '🛠️', theme: 'holy', text: 'Оружие 4/2. После атаки героя оглушает соседей цели.', spell: { ops: [{ op: 'weapon', attack: 4, durability: 2, mods: { stunAdjacent: true } }] } },

  // ======================= ВЕРОНИКА МАКСВЕЛЛ · МЕНТАЛИСТ =======================
  { id: 'psi_blast', name: 'Пси-удар', cost: 1, type: 'spell', class: 'veronika', rarity: 'wood', art: '💫', theme: 'arcane', text: 'Наносит 2 ед. урона.', spell: { ops: [{ op: 'damage', target: 'chosen', amount: 2 }], targeted: true } },
  { id: 'phantoms', name: 'Фантомы', cost: 1, type: 'spell', class: 'veronika', rarity: 'wood', art: '👻', theme: 'arcane', text: 'Призывает двух Фантомов 0/2 с провокацией.', spell: { ops: [{ op: 'summon', token: 'phantom', count: 2 }] } },
  { id: 'suppression', name: 'Подавление', cost: 2, type: 'spell', class: 'veronika', rarity: 'wood', art: '🤐', theme: 'arcane', text: 'Немота существу противника на 1 ход. Возьмите руну.', spell: { ops: [{ op: 'tempSilence', target: 'chosen', turns: 2 }, { op: 'draw', amount: 1 }], targeted: true, targetFilter: 'enemyMinion' } },
  { id: 'word_of_pain', name: 'Слово Боли', cost: 2, type: 'spell', class: 'veronika', rarity: 'wood', art: '😖', theme: 'shadow', text: 'Уничтожает существо с атакой 3 или меньше.', spell: { ops: [{ op: 'destroy', target: 'chosen' }], targeted: true, targetFilter: 'lowAttackMinion' } },
  { id: 'mind_crush', name: 'Ментальный взрыв', cost: 2, type: 'spell', class: 'veronika', rarity: 'wood', art: '🧠', theme: 'shadow', text: 'Наносит 5 ед. урона герою противника.', spell: { ops: [{ op: 'damage', target: 'enemyHero', amount: 5 }] } },
  { id: 'living_chains', name: 'Живые Цепи', cost: 2, type: 'spell', class: 'veronika', rarity: 'bronze', art: '⛓️', theme: 'shadow', text: 'Существо противника больше не может атаковать.', spell: { ops: [{ op: 'shackle', target: 'chosen' }], targeted: true, targetFilter: 'enemyMinion' } },
  { id: 'word_of_void', name: 'Слово Пустоты', cost: 3, type: 'spell', class: 'veronika', rarity: 'wood', art: '🕳️', theme: 'shadow', text: 'Уничтожает существо с атакой 5 или больше.', spell: { ops: [{ op: 'destroy', target: 'chosen' }], targeted: true, targetFilter: 'highAttackMinion' } },
  { id: 'prophetess', name: 'Пророчица', cost: 3, type: 'spell', class: 'veronika', rarity: 'wood', art: '🃏', theme: 'arcane', text: 'Возьмите 2 руны.', spell: { ops: [{ op: 'draw', amount: 2 }] } },
  { id: 'hypnotism', name: 'Гипнотизм', cost: 4, type: 'spell', class: 'veronika', rarity: 'bronze', art: '🌀', theme: 'arcane', text: 'Крадёт случайную карту из руки противника.', spell: { ops: [{ op: 'stealCard', count: 1 }] } },
  { id: 'void_sphere', name: 'Сфера Пустоты', cost: 4, type: 'spell', class: 'veronika', rarity: 'silver', art: '⚫', theme: 'shadow', text: 'До вашего следующего хода оба игрока не могут разыгрывать Руны.', spell: { ops: [{ op: 'spellLock' }] } },
  { id: 'mind_thief', name: 'Похитительница разума', cost: 4, type: 'minion', class: 'veronika', rarity: 'bronze', attack: 3, health: 3, art: '🎭', theme: 'arcane', text: 'Боевой клич: крадёт случайную карту из руки противника.', battlecry: { ops: [{ op: 'stealCard', count: 1 }] } },
  { id: 'will_empress', name: 'Владычица воли', cost: 6, type: 'minion', class: 'veronika', rarity: 'bronze', attack: 5, health: 5, art: '👑', theme: 'arcane', text: 'Боевой клич: сковывает существо противника Живыми Цепями.', battlecry: { ops: [{ op: 'shackle', target: 'chosen' }], targeted: true, targetFilter: 'enemyMinion' } },

  // ======================= АЙНО ВЕТЕР РАВНИН · ОХОТНИК =======================
  { id: 'sharp_throw', name: 'Меткий бросок', cost: 1, type: 'spell', class: 'aino', rarity: 'wood', art: '🪃', theme: 'nature', text: 'Наносит 2 ед. урона.', spell: { ops: [{ op: 'damage', target: 'chosen', amount: 2 }], targeted: true } },
  { id: 'read_tracks', name: 'Чтение следов', cost: 1, type: 'spell', class: 'aino', rarity: 'wood', art: '👣', theme: 'nature', text: 'Возьмите руну.', spell: { ops: [{ op: 'draw', amount: 1 }] } },
  { id: 'beast_call', name: 'Зов зверей', cost: 3, type: 'spell', class: 'aino', rarity: 'wood', art: '🐾', theme: 'nature', text: 'Призывает случайного зверя-спутника.', spell: { ops: [{ op: 'summonRandom', tokens: ['wildBoar', 'oldTauro', 'skyKarkh'], count: 1 }] } },
  { id: 'pack_order', name: 'Приказ стаи', cost: 3, type: 'spell', class: 'aino', rarity: 'wood', art: '🩸', theme: 'nature', text: 'Наносит 5 ед. урона.', spell: { ops: [{ op: 'damage', target: 'chosen', amount: 5 }], targeted: true } },
  { id: 'release_pack', name: 'Спустить стаю', cost: 3, type: 'spell', class: 'aino', rarity: 'wood', art: '🐺', theme: 'nature', text: 'Призывает Варжонка 1/1 с рывком за каждое существо противника.', spell: { ops: [{ op: 'summonPerEnemy', token: 'vargPup' }] } },
  { id: 'spear_hail', name: 'Град копий', cost: 4, type: 'spell', class: 'aino', rarity: 'wood', art: '🎯', theme: 'nature', text: 'Наносит 3 ед. урона двум случайным существам противника.', spell: { ops: [{ op: 'randomDamage', target: 'allEnemyMinions', amount: 3, hits: 2, distinct: true }] } },
  { id: 'karkh_rider', name: 'Наездница кархов', cost: 4, type: 'minion', class: 'aino', rarity: 'wood', attack: 4, health: 3, faction: 'травы', art: '🏇', theme: 'nature', text: 'Боевой клич: даёт существу +2/+2 и Провокацию.', battlecry: { ops: [{ op: 'buff', target: 'chosen', attack: 2, health: 2, keywords: ['taunt'] }], targeted: true, targetFilter: 'friendlyMinion' } },
  { id: 'pack_leader', name: 'Вожак стаи', cost: 5, type: 'minion', class: 'aino', rarity: 'bronze', attack: 4, health: 4, keywords: ['charge'], tribe: 'зверь', faction: 'травы', art: '🐺', theme: 'nature', text: 'Рывок.' },
  { id: 'wild_hunt', name: 'Дикая Охота', cost: 5, type: 'spell', class: 'aino', rarity: 'silver', art: '🌕', theme: 'nature', text: 'До конца игры: звери получают +1 к атаке в начале каждого хода, а Восходящие — 1 ед. урона.', spell: { ops: [{ op: 'wildHunt' }] } },
  { id: 'elder_varg', name: 'Старший варг', cost: 6, type: 'minion', class: 'aino', rarity: 'bronze', attack: 6, health: 5, tribe: 'зверь', faction: 'травы', art: '🐺', theme: 'nature', text: 'Предсмертный хрип: призывает двух варгов 2/2.', deathrattle: { ops: [{ op: 'summon', token: 'vargToken', count: 2 }] } },
  { id: 'karkh_mother', name: 'Мать Кархов', cost: 8, type: 'minion', class: 'aino', rarity: 'gold', gloryCost: 3, attack: 6, health: 6, tribe: 'зверь', faction: 'травы', art: '🐲', theme: 'nature', text: 'Титул (3 Славы). Боевой клич: призывает двух Ездовых Кархов.', battlecry: { ops: [{ op: 'summonRandom', tokens: ['karkhCub'], count: 2 }] } },

  // ======================= АЗИМАНДИЯ ВИЗУ АРАН · МАСТЕР РУН =======================
  { id: 'rune_nova', name: 'Рунный взрыв', cost: 2, type: 'spell', class: 'azimandia', rarity: 'wood', art: '💥', theme: 'arcane', text: 'Наносит 1 ед. урона всем существам противника.', spell: { ops: [{ op: 'damage', target: 'allEnemyMinions', amount: 1 }] } },
  { id: 'ice_rune', name: 'Руна Льда', cost: 2, type: 'spell', class: 'azimandia', rarity: 'wood', art: '❄️', theme: 'frost', text: 'Наносит 3 ед. урона и замораживает цель.', spell: { ops: [{ op: 'damage', target: 'chosen', amount: 3 }, { op: 'freeze', target: 'chosen' }], targeted: true } },
  { id: 'red_stream', name: 'Алый Поток', cost: 2, type: 'spell', class: 'azimandia', rarity: 'wood', art: '🩸', theme: 'fire', text: 'Наносит 3 ед. урона.', spell: { ops: [{ op: 'damage', target: 'chosen', amount: 3 }], targeted: true } },
  { id: 'illumination', name: 'Озарение', cost: 3, type: 'spell', class: 'azimandia', rarity: 'wood', art: '📖', theme: 'arcane', text: 'Возьмите 2 руны.', spell: { ops: [{ op: 'draw', amount: 2 }] } },
  { id: 'transmute_rune', name: 'Руна Превращения', cost: 4, type: 'spell', class: 'azimandia', rarity: 'wood', art: '🐌', theme: 'arcane', text: 'Превращает существо в Слизня 1/1.', spell: { ops: [{ op: 'transform', token: 'slug', target: 'chosen' }], targeted: true } },
  { id: 'young_runist', name: 'Юная рунистка', cost: 2, type: 'minion', class: 'azimandia', rarity: 'wood', attack: 3, health: 2, art: '👧', theme: 'arcane', text: '' },
  { id: 'ice_golem', name: 'Ледяной голем', cost: 4, type: 'minion', class: 'azimandia', rarity: 'wood', attack: 3, health: 6, freezeOnDamage: true, faction: 'река', art: '🧊', theme: 'frost', text: 'Замораживает любое повреждённое им существо.' },
  { id: 'rune_keeper', name: 'Хранитель рун', cost: 6, type: 'minion', class: 'azimandia', rarity: 'wood', attack: 4, health: 7, spellDamage: 1, art: '🧙', theme: 'arcane', text: 'Сила рун +1.' },
  { id: 'timeless_echo', name: 'Эхо Безвременья', cost: 3, type: 'spell', class: 'azimandia', rarity: 'bronze', art: '🪞', theme: 'arcane', text: 'Создаёт копию вашего существа.', spell: { ops: [{ op: 'copyMinion', target: 'chosen' }], targeted: true, targetFilter: 'friendlyMinion' } },
  { id: 'red_wave', name: 'Алая Волна', cost: 6, type: 'spell', class: 'azimandia', rarity: 'bronze', art: '🌊', theme: 'fire', text: 'Наносит 3 ед. урона всем существам противника.', spell: { ops: [{ op: 'damage', target: 'allEnemyMinions', amount: 3 }] } },
  { id: 'star_ice', name: 'Звёздный лёд', cost: 6, type: 'spell', class: 'azimandia', rarity: 'bronze', art: '🌨️', theme: 'frost', text: 'Наносит 2 ед. урона существам противника и замораживает их.', spell: { ops: [{ op: 'damage', target: 'allEnemyMinions', amount: 2 }, { op: 'freeze', target: 'allEnemyMinions' }] } },
  { id: 'time_loop', name: 'Временная Петля', cost: 7, type: 'spell', class: 'azimandia', rarity: 'silver', art: '⏳', theme: 'arcane', text: 'Возвращает стол к состоянию начала вашего прошлого хода.', spell: { ops: [{ op: 'timeLoop' }] } },
  { id: 'star_comet', name: 'Звёздная комета', cost: 8, type: 'spell', class: 'azimandia', rarity: 'silver', art: '☄️', theme: 'fire', text: 'Наносит 8 ед. урона.', spell: { ops: [{ op: 'damage', target: 'chosen', amount: 8 }], targeted: true } },
  { id: 'starblood_avatar', name: 'Аватар Звёздной Крови', cost: 9, type: 'minion', class: 'azimandia', rarity: 'gold', gloryCost: 5, attack: 7, health: 7, art: '🌌', theme: 'arcane', text: 'Титул (5 Славы). Боевой клич: наносит 3 ед. урона всем существам противника.', battlecry: { ops: [{ op: 'damage', target: 'allEnemyMinions', amount: 3 }] } },

  // ======================= МРАК · ТЕНЕВОЙ УБИЙЦА =======================
  { id: 'backstab', name: 'Удар в спину', cost: 0, type: 'spell', class: 'mrak', rarity: 'wood', art: '🔪', theme: 'shadow', text: 'Наносит 2 ед. урона неповреждённому существу.', spell: { ops: [{ op: 'damage', target: 'chosen', amount: 2 }], targeted: true, targetFilter: 'undamagedMinion' } },
  { id: 'blade_fan', name: 'Веер клинков', cost: 1, type: 'spell', class: 'mrak', rarity: 'wood', art: '🌪️', theme: 'shadow', text: 'Наносит 1 ед. урона всем существам.', spell: { ops: [{ op: 'damage', target: 'allMinions', amount: 1 }] } },
  { id: 'poison_vial', name: 'Флакон яда', cost: 2, type: 'spell', class: 'mrak', rarity: 'wood', art: '🧪', theme: 'shadow', text: 'Уничтожает повреждённое существо противника.', spell: { ops: [{ op: 'destroy', target: 'chosen' }], targeted: true, targetFilter: 'damagedEnemyMinion' } },
  { id: 'hidden_lunge', name: 'Скрытый выпад', cost: 2, type: 'spell', class: 'mrak', rarity: 'wood', art: '🗡️', theme: 'shadow', text: 'Наносит 3 ед. урона.', spell: { ops: [{ op: 'damage', target: 'chosen', amount: 3 }], targeted: true } },
  { id: 'death_mark', name: 'Метка смерти', cost: 2, type: 'spell', class: 'mrak', rarity: 'bronze', art: '☠️', theme: 'shadow', text: 'Даёт вашему существу Яд.', spell: { ops: [{ op: 'buff', target: 'chosen', attack: 0, health: 0, keywords: ['poisonous'] }], targeted: true, targetFilter: 'friendlyMinion' } },
  { id: 'shadow_dancer', name: 'Танцовщица теней', cost: 3, type: 'minion', class: 'mrak', rarity: 'wood', attack: 3, health: 3, keywords: ['stealth'], art: '🩰', theme: 'shadow', text: 'Скрытность.' },
  { id: 'mrak_spawn', name: 'Порождение Мрака', cost: 4, type: 'minion', class: 'mrak', rarity: 'wood', attack: 4, health: 3, keywords: ['lifesteal'], art: '🌑', theme: 'shadow', text: 'Похищение жизни.' },
  { id: 'executioner_blades', name: 'Лезвия Палача', cost: 4, type: 'weapon', class: 'mrak', rarity: 'bronze', attack: 2, durability: 2, art: '⚔️', theme: 'shadow', text: 'Оружие 2/2. Яд: герой уничтожает существ, которым наносит урон.', spell: { ops: [{ op: 'weapon', attack: 2, durability: 2, mods: { poisonous: true } }] } },
  { id: 'elimination', name: 'Устранение', cost: 5, type: 'spell', class: 'mrak', rarity: 'wood', art: '🎯', theme: 'shadow', text: 'Уничтожает существо противника.', spell: { ops: [{ op: 'destroy', target: 'chosen' }], targeted: true, targetFilter: 'enemyMinion' } },
  { id: 'night_terror', name: 'Ночной кошмар', cost: 5, type: 'minion', class: 'mrak', rarity: 'bronze', attack: 5, health: 4, keywords: ['stealth'], art: '😱', theme: 'shadow', text: 'Скрытность.' },
  { id: 'sunset_blade', name: 'Клинок Заката', cost: 8, type: 'minion', class: 'mrak', rarity: 'gold', gloryCost: 4, attack: 7, health: 5, keywords: ['charge', 'lifesteal'], art: '🌇', theme: 'shadow', text: 'Титул (4 Славы). Рывок. Похищение жизни.' },
];

// Index by id for O(1) lookups.
export const CARDS = {};
for (const c of CARD_LIST) CARDS[c.id] = c;

export function getCard(id) {
  const c = CARDS[id];
  if (!c) throw new Error('Unknown card id: ' + id);
  return c;
}

export function allCards() {
  return CARD_LIST.slice();
}

// Collectible cards for a given class = that class's cards + neutrals.
export function collectibleForClass(cls) {
  return CARD_LIST.filter((c) => !c.uncollectible && (c.class === cls || c.class === 'neutral'));
}
