// Card database. Cards are pure data: stats + declarative effect "ops".
// The engine (js/engine/effects.js) knows how to resolve each op, so cards
// never contain imperative logic. This keeps them serialisable and testable.
//
// Effect op vocabulary (see effects.js for authoritative implementation):
//   { op:'damage',  target, amount }
//   { op:'heal',    target, amount }
//   { op:'draw',    amount }
//   { op:'buff',    target, attack, health, keywords }
//   { op:'summon',  token, count, side }
//   { op:'armor',   amount }
//   { op:'destroy', target }
//   { op:'silence', target }
//   { op:'freeze',  target }
//   { op:'transform', token, target }
//   { op:'weapon',  attack, durability }
//   { op:'heroAttack', amount }        // temporary hero attack this turn
//   { op:'randomDamage', target, amount, hits } // split amount across random targets
//
// Targets: 'chosen' (player selects), 'enemyHero', 'friendlyHero',
//   'allEnemyMinions', 'allFriendlyMinions', 'allMinions', 'allEnemies',
//   'allFriendlies', 'randomEnemyMinion', 'self', 'triggerSource'.

export const KEYWORDS = {
  taunt: { label: 'Провокация', desc: 'Врагам нужно атаковать это существо первым.' },
  charge: { label: 'Рывок', desc: 'Может атаковать сразу.' },
  rush: { label: 'Натиск', desc: 'Может атаковать существ сразу.' },
  divineShield: { label: 'Божественный щит', desc: 'Первый полученный урон игнорируется.' },
  lifesteal: { label: 'Похищение жизни', desc: 'Урон этим существом лечит вашего героя.' },
  windfury: { label: 'Неистовство ветра', desc: 'Может атаковать дважды за ход.' },
  poisonous: { label: 'Яд', desc: 'Уничтожает любое повреждённое существо.' },
  stealth: { label: 'Маскировка', desc: 'Не может быть целью, пока не атакует.' },
};

// Tokens are minions summoned by effects but not part of any deck/collection.
export const TOKENS = {
  sheep: { name: 'Овца', cost: 0, type: 'minion', attack: 1, health: 1, art: '🐑', theme: 'nature', token: true },
  mirrorImage: { name: 'Зеркальный образ', cost: 0, type: 'minion', attack: 0, health: 2, keywords: ['taunt'], art: '🪞', theme: 'arcane', token: true },
  damagedGolem: { name: 'Повреждённый голем', cost: 1, type: 'minion', attack: 2, health: 1, art: '🤖', theme: 'mech', token: true },
  hyena: { name: 'Гиена', cost: 1, type: 'minion', attack: 2, health: 2, keywords: [], art: '🐕', theme: 'nature', token: true },
  huffer: { name: 'Дикий вепрь', cost: 3, type: 'minion', attack: 4, health: 2, keywords: ['charge'], art: '🐗', theme: 'nature', token: true },
  misha: { name: 'Бурый медведь', cost: 3, type: 'minion', attack: 4, health: 4, keywords: ['taunt'], art: '🐻', theme: 'nature', token: true },
  leokk: { name: 'Гордый лев', cost: 3, type: 'minion', attack: 2, health: 4, art: '🦁', theme: 'nature', token: true },
  spiderling: { name: 'Паучок', cost: 1, type: 'minion', attack: 1, health: 1, art: '🕷️', theme: 'shadow', token: true },
  houndToken: { name: 'Гончая', cost: 1, type: 'minion', attack: 1, health: 1, keywords: ['charge'], art: '🐺', theme: 'nature', token: true },
};

// The full playable card list.
const CARD_LIST = [
  // ============================ NEUTRAL ============================
  { id: 'wisp', name: 'Огонёк', cost: 0, type: 'minion', class: 'neutral', rarity: 'common', attack: 1, health: 1, art: '✨', theme: 'nature', text: '' },
  { id: 'murloc_raider', name: 'Мурлок-налётчик', cost: 1, type: 'minion', class: 'neutral', rarity: 'basic', attack: 2, health: 1, art: '🐟', theme: 'nature', text: '' },
  { id: 'argent_squire', name: 'Юный оруженосец', cost: 1, type: 'minion', class: 'neutral', rarity: 'common', attack: 1, health: 1, keywords: ['divineShield'], art: '🛡️', theme: 'holy', text: 'Божественный щит.' },
  { id: 'elven_archer', name: 'Эльфийская лучница', cost: 1, type: 'minion', class: 'neutral', rarity: 'basic', attack: 1, health: 1, art: '🏹', theme: 'nature', text: 'Боевой клич: наносит 1 ед. урона.', battlecry: { ops: [{ op: 'damage', target: 'chosen', amount: 1 }], targeted: true } },
  { id: 'leper_gnome', name: 'Прокажённый гном', cost: 1, type: 'minion', class: 'neutral', rarity: 'common', attack: 2, health: 1, art: '💀', theme: 'shadow', text: 'Предсмертный хрип: наносит 2 ед. урона герою противника.', deathrattle: { ops: [{ op: 'damage', target: 'enemyHero', amount: 2 }] } },
  { id: 'voodoo_doctor', name: 'Знахарь', cost: 1, type: 'minion', class: 'neutral', rarity: 'basic', attack: 2, health: 1, art: '🧪', theme: 'shadow', text: 'Боевой клич: восстанавливает 2 ед. здоровья.', battlecry: { ops: [{ op: 'heal', target: 'chosen', amount: 2 }], targeted: true } },
  { id: 'bloodfen_raptor', name: 'Болотный ящер', cost: 2, type: 'minion', class: 'neutral', rarity: 'basic', attack: 3, health: 2, art: '🦖', theme: 'nature', text: '' },
  { id: 'river_croc', name: 'Речной кроколиск', cost: 2, type: 'minion', class: 'neutral', rarity: 'basic', attack: 2, health: 3, art: '🐊', theme: 'nature', text: '' },
  { id: 'frostwolf_grunt', name: 'Волчий пехотинец', cost: 2, type: 'minion', class: 'neutral', rarity: 'basic', attack: 2, health: 2, keywords: ['taunt'], art: '🐺', theme: 'frost', text: 'Провокация.' },
  { id: 'novice_engineer', name: 'Инженер-недоучка', cost: 2, type: 'minion', class: 'neutral', rarity: 'basic', attack: 1, health: 1, art: '🔧', theme: 'mech', text: 'Боевой клич: взять карту.', battlecry: { ops: [{ op: 'draw', amount: 1 }] } },
  { id: 'kobold_geomancer', name: 'Кобольд-геомант', cost: 2, type: 'minion', class: 'neutral', rarity: 'common', attack: 2, health: 2, spellDamage: 1, art: '🔮', theme: 'arcane', text: 'Сила заклинаний +1.' },
  { id: 'loot_hoarder', name: 'Собиратель хлама', cost: 2, type: 'minion', class: 'neutral', rarity: 'common', attack: 2, health: 1, art: '📦', theme: 'mech', text: 'Предсмертный хрип: взять карту.', deathrattle: { ops: [{ op: 'draw', amount: 1 }] } },
  { id: 'ironbeak_owl', name: 'Совух', cost: 2, type: 'minion', class: 'neutral', rarity: 'common', attack: 2, health: 1, art: '🦉', theme: 'nature', text: 'Боевой клич: делает существо немым.', battlecry: { ops: [{ op: 'silence', target: 'chosen' }], targeted: true } },
  { id: 'harvest_golem', name: 'Уборочный голем', cost: 3, type: 'minion', class: 'neutral', rarity: 'common', attack: 2, health: 3, art: '🤖', theme: 'mech', text: 'Предсмертный хрип: призывает Повреждённого голема 2/1.', deathrattle: { ops: [{ op: 'summon', token: 'damagedGolem', count: 1 }] } },
  { id: 'shattered_sun', name: 'Клирик Расколотого Солнца', cost: 3, type: 'minion', class: 'neutral', rarity: 'common', attack: 3, health: 2, art: '☀️', theme: 'holy', text: 'Боевой клич: даёт существу +1/+1.', battlecry: { ops: [{ op: 'buff', target: 'chosen', attack: 1, health: 1 }], targeted: true, targetFilter: 'friendlyMinion' } },
  { id: 'wolfrider', name: 'Всадник на волке', cost: 3, type: 'minion', class: 'neutral', rarity: 'basic', attack: 3, health: 1, keywords: ['charge'], art: '🐺', theme: 'nature', text: 'Рывок.' },
  { id: 'ironfur_grizzly', name: 'Стальнокожий гризли', cost: 3, type: 'minion', class: 'neutral', rarity: 'basic', attack: 3, health: 3, keywords: ['taunt'], art: '🐻', theme: 'nature', text: 'Провокация.' },
  { id: 'spider_tank', name: 'Паук-танк', cost: 3, type: 'minion', class: 'neutral', rarity: 'common', attack: 3, health: 4, art: '🕸️', theme: 'mech', text: '' },
  { id: 'chillwind_yeti', name: 'Морозный йети', cost: 4, type: 'minion', class: 'neutral', rarity: 'basic', attack: 4, health: 5, art: '🧊', theme: 'frost', text: '' },
  { id: 'senjin', name: 'Каменный страж', cost: 4, type: 'minion', class: 'neutral', rarity: 'basic', attack: 3, health: 5, keywords: ['taunt'], art: '🗿', theme: 'nature', text: 'Провокация.' },
  { id: 'oasis_snapjaw', name: 'Оазисный аллигатор', cost: 4, type: 'minion', class: 'neutral', rarity: 'basic', attack: 2, health: 7, art: '🐢', theme: 'nature', text: '' },
  { id: 'gnomish_inventor', name: 'Гномий изобретатель', cost: 4, type: 'minion', class: 'neutral', rarity: 'basic', attack: 2, health: 4, art: '⚙️', theme: 'mech', text: 'Боевой клич: взять карту.', battlecry: { ops: [{ op: 'draw', amount: 1 }] } },
  { id: 'dark_iron_dwarf', name: 'Хмельной кузнец', cost: 4, type: 'minion', class: 'neutral', rarity: 'common', attack: 4, health: 4, art: '🍺', theme: 'mech', text: 'Боевой клич: даёт существу +2 к атаке.', battlecry: { ops: [{ op: 'buff', target: 'chosen', attack: 2, health: 0 }], targeted: true } },
  { id: 'stormpike_commando', name: 'Гренадёр-подрывник', cost: 5, type: 'minion', class: 'neutral', rarity: 'basic', attack: 4, health: 2, art: '💣', theme: 'mech', text: 'Боевой клич: наносит 2 ед. урона.', battlecry: { ops: [{ op: 'damage', target: 'chosen', amount: 2 }], targeted: true } },
  { id: 'abomination', name: 'Гнусень', cost: 5, type: 'minion', class: 'neutral', rarity: 'rare', attack: 4, health: 4, keywords: ['taunt'], art: '🧟', theme: 'shadow', text: 'Провокация. Предсмертный хрип: наносит 2 ед. урона всем существам.', deathrattle: { ops: [{ op: 'damage', target: 'allMinions', amount: 2 }] } },
  { id: 'fen_creeper', name: 'Болотный ползун', cost: 5, type: 'minion', class: 'neutral', rarity: 'common', attack: 3, health: 6, keywords: ['taunt'], art: '🐸', theme: 'nature', text: 'Провокация.' },
  { id: 'nightblade', name: 'Ночной клинок', cost: 5, type: 'minion', class: 'neutral', rarity: 'basic', attack: 4, health: 4, art: '🗡️', theme: 'shadow', text: 'Боевой клич: наносит 3 ед. урона герою противника.', battlecry: { ops: [{ op: 'damage', target: 'enemyHero', amount: 3 }] } },
  { id: 'reckless_rocketeer', name: 'Безрассудный ракетчик', cost: 6, type: 'minion', class: 'neutral', rarity: 'basic', attack: 5, health: 2, keywords: ['charge'], art: '🚀', theme: 'mech', text: 'Рывок.' },
  { id: 'boulderfist_ogre', name: 'Огр-громила', cost: 6, type: 'minion', class: 'neutral', rarity: 'basic', attack: 6, health: 7, art: '👹', theme: 'nature', text: '' },
  { id: 'lord_of_arena', name: 'Владыка Арены', cost: 6, type: 'minion', class: 'neutral', rarity: 'basic', attack: 6, health: 5, keywords: ['taunt'], art: '🏛️', theme: 'holy', text: 'Провокация.' },
  { id: 'core_hound', name: 'Адская гончая', cost: 7, type: 'minion', class: 'neutral', rarity: 'basic', attack: 9, health: 5, art: '🔥', theme: 'fire', text: '' },
  { id: 'war_golem', name: 'Боевой голем', cost: 7, type: 'minion', class: 'neutral', rarity: 'basic', attack: 7, health: 7, art: '🗿', theme: 'mech', text: '' },

  // ============================ MAGE ============================
  { id: 'arcane_missiles', name: 'Тайные стрелы', cost: 1, type: 'spell', class: 'mage', rarity: 'basic', art: '🌟', theme: 'arcane', text: 'Наносит 3 ед. урона, распределённого случайно между врагами.', spell: { ops: [{ op: 'randomDamage', target: 'allEnemies', amount: 1, hits: 3 }] } },
  { id: 'frostbolt', name: 'Ледяная стрела', cost: 2, type: 'spell', class: 'mage', rarity: 'basic', art: '❄️', theme: 'frost', text: 'Наносит 3 ед. урона и замораживает цель.', spell: { ops: [{ op: 'damage', target: 'chosen', amount: 3 }, { op: 'freeze', target: 'chosen' }], targeted: true } },
  { id: 'arcane_explosion', name: 'Тайный взрыв', cost: 2, type: 'spell', class: 'mage', rarity: 'basic', art: '💥', theme: 'arcane', text: 'Наносит 1 ед. урона всем существам противника.', spell: { ops: [{ op: 'damage', target: 'allEnemyMinions', amount: 1 }] } },
  { id: 'mirror_image', name: 'Отражения', cost: 1, type: 'spell', class: 'mage', rarity: 'common', art: '🪞', theme: 'arcane', text: 'Призывает двух Зеркальных образов 0/2 с провокацией.', spell: { ops: [{ op: 'summon', token: 'mirrorImage', count: 2 }] } },
  { id: 'arcane_intellect', name: 'Интеллект', cost: 3, type: 'spell', class: 'mage', rarity: 'basic', art: '📘', theme: 'arcane', text: 'Возьмите 2 карты.', spell: { ops: [{ op: 'draw', amount: 2 }] } },
  { id: 'sorcerers_apprentice', name: 'Ученица чародея', cost: 2, type: 'minion', class: 'mage', rarity: 'common', attack: 3, health: 2, art: '🧙', theme: 'arcane', text: '' },
  { id: 'water_elemental', name: 'Водный элементаль', cost: 4, type: 'minion', class: 'mage', rarity: 'basic', attack: 3, health: 6, art: '💧', theme: 'frost', freezeOnDamage: true, text: 'Замораживает любое повреждённое им существо.' },
  { id: 'polymorph', name: 'Превращение', cost: 4, type: 'spell', class: 'mage', rarity: 'basic', art: '🐑', theme: 'arcane', text: 'Превращает существо в овцу 1/1.', spell: { ops: [{ op: 'transform', token: 'sheep', target: 'chosen' }], targeted: true } },
  { id: 'fireball', name: 'Огненный шар', cost: 4, type: 'spell', class: 'mage', rarity: 'basic', art: '🔥', theme: 'fire', text: 'Наносит 6 ед. урона.', spell: { ops: [{ op: 'damage', target: 'chosen', amount: 6 }], targeted: true } },
  { id: 'archmage', name: 'Верховный маг', cost: 6, type: 'minion', class: 'mage', rarity: 'common', attack: 4, health: 7, spellDamage: 1, art: '🧙‍♂️', theme: 'arcane', text: 'Сила заклинаний +1.' },
  { id: 'flamestrike', name: 'Огненный вихрь', cost: 7, type: 'spell', class: 'mage', rarity: 'basic', art: '🌋', theme: 'fire', text: 'Наносит 4 ед. урона всем существам противника.', spell: { ops: [{ op: 'damage', target: 'allEnemyMinions', amount: 4 }] } },

  // ============================ WARRIOR ============================
  { id: 'whirlwind', name: 'Вихрь', cost: 1, type: 'spell', class: 'warrior', rarity: 'common', art: '🌪️', theme: 'fire', text: 'Наносит 1 ед. урона всем существам.', spell: { ops: [{ op: 'damage', target: 'allMinions', amount: 1 }] } },
  { id: 'fiery_war_axe', name: 'Огненный боевой топор', cost: 2, type: 'weapon', class: 'warrior', rarity: 'basic', attack: 3, durability: 2, art: '🪓', theme: 'fire', text: 'Оружие 3/2.', spell: { ops: [{ op: 'weapon', attack: 3, durability: 2 }] } },
  { id: 'execute', name: 'Казнь', cost: 1, type: 'spell', class: 'warrior', rarity: 'basic', art: '⚔️', theme: 'shadow', text: 'Уничтожает повреждённое существо противника.', spell: { ops: [{ op: 'destroy', target: 'chosen' }], targeted: true, targetFilter: 'damagedEnemyMinion' } },
  { id: 'heroic_strike', name: 'Героический удар', cost: 2, type: 'spell', class: 'warrior', rarity: 'basic', art: '💪', theme: 'fire', text: 'Даёт герою +4 к атаке в этом ходу.', spell: { ops: [{ op: 'heroAttack', amount: 4 }] } },
  { id: 'cleave', name: 'Рубящий удар', cost: 2, type: 'spell', class: 'warrior', rarity: 'common', art: '🪚', theme: 'fire', text: 'Наносит 2 ед. урона двум случайным существам противника.', spell: { ops: [{ op: 'randomDamage', target: 'allEnemyMinions', amount: 2, hits: 2, distinct: true }] } },
  { id: 'shield_block', name: 'Блокирование', cost: 3, type: 'spell', class: 'warrior', rarity: 'basic', art: '🛡️', theme: 'holy', text: 'Даёт 5 ед. брони. Возьмите карту.', spell: { ops: [{ op: 'armor', amount: 5 }, { op: 'draw', amount: 1 }] } },
  { id: 'warsong_commander', name: 'Боевой барабанщик', cost: 3, type: 'minion', class: 'warrior', rarity: 'common', attack: 2, health: 3, art: '🥁', theme: 'fire', text: '' },
  { id: 'kor_kron_elite', name: 'Элитный боец Кор\'крон', cost: 4, type: 'minion', class: 'warrior', rarity: 'basic', attack: 4, health: 3, keywords: ['charge'], art: '⚔️', theme: 'fire', text: 'Рывок.' },
  { id: 'arcanite_reaper', name: 'Тяжёлая секира', cost: 5, type: 'weapon', class: 'warrior', rarity: 'basic', attack: 5, durability: 2, art: '🔨', theme: 'fire', text: 'Оружие 5/2.', spell: { ops: [{ op: 'weapon', attack: 5, durability: 2 }] } },

  // ============================ PRIEST ============================
  { id: 'power_word_shield', name: 'Слово силы: Щит', cost: 1, type: 'spell', class: 'priest', rarity: 'basic', art: '✨', theme: 'holy', text: 'Даёт существу +2 к здоровью. Возьмите карту.', spell: { ops: [{ op: 'buff', target: 'chosen', attack: 0, health: 2 }, { op: 'draw', amount: 1 }], targeted: true, targetFilter: 'minion' } },
  { id: 'northshire_cleric', name: 'Молодая жрица', cost: 1, type: 'minion', class: 'priest', rarity: 'basic', attack: 1, health: 3, art: '📿', theme: 'holy', text: '' },
  { id: 'holy_smite', name: 'Кара', cost: 1, type: 'spell', class: 'priest', rarity: 'common', art: '🌟', theme: 'holy', text: 'Наносит 2 ед. урона.', spell: { ops: [{ op: 'damage', target: 'chosen', amount: 2 }], targeted: true } },
  { id: 'shadow_word_pain', name: 'Слово тьмы: Боль', cost: 2, type: 'spell', class: 'priest', rarity: 'basic', art: '🌑', theme: 'shadow', text: 'Уничтожает существо с атакой 3 или меньше.', spell: { ops: [{ op: 'destroy', target: 'chosen' }], targeted: true, targetFilter: 'lowAttackMinion' } },
  { id: 'mind_blast', name: 'Взрыв разума', cost: 2, type: 'spell', class: 'priest', rarity: 'basic', art: '🧠', theme: 'shadow', text: 'Наносит 5 ед. урона герою противника.', spell: { ops: [{ op: 'damage', target: 'enemyHero', amount: 5 }] } },
  { id: 'shadow_word_death', name: 'Слово тьмы: Смерть', cost: 3, type: 'spell', class: 'priest', rarity: 'common', art: '☠️', theme: 'shadow', text: 'Уничтожает существо с атакой 5 или больше.', spell: { ops: [{ op: 'destroy', target: 'chosen' }], targeted: true, targetFilter: 'highAttackMinion' } },
  { id: 'temple_enforcer', name: 'Храмовый страж', cost: 6, type: 'minion', class: 'priest', rarity: 'common', attack: 6, health: 6, art: '🛕', theme: 'holy', text: 'Боевой клич: даёт дружественному существу +3 к здоровью.', battlecry: { ops: [{ op: 'buff', target: 'chosen', attack: 0, health: 3 }], targeted: true, targetFilter: 'friendlyMinion' } },
  { id: 'holy_nova', name: 'Священная кара', cost: 5, type: 'spell', class: 'priest', rarity: 'basic', art: '🌤️', theme: 'holy', text: 'Наносит 2 ед. урона врагам. Восстанавливает 2 ед. здоровья союзникам.', spell: { ops: [{ op: 'damage', target: 'allEnemies', amount: 2 }, { op: 'heal', target: 'allFriendlies', amount: 2 }] } },
  { id: 'lightspawn', name: 'Порождение света', cost: 4, type: 'minion', class: 'priest', rarity: 'common', attack: 0, health: 5, art: '💡', theme: 'holy', text: 'Атака этого существа равна его здоровью.', attackEqualsHealth: true },

  // ============================ HUNTER ============================
  { id: 'arcane_shot', name: 'Магический выстрел', cost: 1, type: 'spell', class: 'hunter', rarity: 'basic', art: '🎯', theme: 'nature', text: 'Наносит 2 ед. урона.', spell: { ops: [{ op: 'damage', target: 'chosen', amount: 2 }], targeted: true } },
  { id: 'timber_wolf', name: 'Лесной волк', cost: 1, type: 'minion', class: 'hunter', rarity: 'basic', attack: 1, health: 1, art: '🐺', theme: 'nature', text: '' },
  { id: 'tracking', name: 'Выслеживание', cost: 1, type: 'spell', class: 'hunter', rarity: 'basic', art: '👣', theme: 'nature', text: 'Возьмите карту.', spell: { ops: [{ op: 'draw', amount: 1 }] } },
  { id: 'animal_companion', name: 'Верный зверь', cost: 3, type: 'spell', class: 'hunter', rarity: 'basic', art: '🐾', theme: 'nature', text: 'Призывает случайного зверя-спутника.', spell: { ops: [{ op: 'summonRandom', tokens: ['huffer', 'misha', 'leokk'], count: 1 }] } },
  { id: 'kill_command', name: 'Приказ об убийстве', cost: 3, type: 'spell', class: 'hunter', rarity: 'basic', art: '🩸', theme: 'nature', text: 'Наносит 5 ед. урона.', spell: { ops: [{ op: 'damage', target: 'chosen', amount: 5 }], targeted: true } },
  { id: 'multi_shot', name: 'Множественный выстрел', cost: 4, type: 'spell', class: 'hunter', rarity: 'basic', art: '🏹', theme: 'nature', text: 'Наносит 3 ед. урона двум случайным существам противника.', spell: { ops: [{ op: 'randomDamage', target: 'allEnemyMinions', amount: 3, hits: 2, distinct: true }] } },
  { id: 'houndmaster', name: 'Псарь', cost: 4, type: 'minion', class: 'hunter', rarity: 'basic', attack: 4, health: 3, art: '🧑‍🌾', theme: 'nature', text: 'Боевой клич: даёт существу +2/+2 и провокацию.', battlecry: { ops: [{ op: 'buff', target: 'chosen', attack: 2, health: 2, keywords: ['taunt'] }], targeted: true, targetFilter: 'friendlyMinion' } },
  { id: 'unleash_hounds', name: 'Спустить собак', cost: 3, type: 'spell', class: 'hunter', rarity: 'common', art: '🐕', theme: 'nature', text: 'Призывает Гончую 1/1 с рывком за каждое существо противника.', spell: { ops: [{ op: 'summonPerEnemy', token: 'houndToken' }] } },
  { id: 'starving_buzzard', name: 'Голодный канюк', cost: 5, type: 'minion', class: 'hunter', rarity: 'common', attack: 3, health: 2, art: '🦅', theme: 'nature', text: '' },
  { id: 'savannah_highmane', name: 'Вожак прайда', cost: 6, type: 'minion', class: 'hunter', rarity: 'rare', attack: 6, health: 5, art: '🦁', theme: 'nature', text: 'Предсмертный хрип: призывает двух Гиен 2/2.', deathrattle: { ops: [{ op: 'summon', token: 'hyena', count: 2 }] } },

  // ================= CAMPAIGN REWARD CARDS (not in starter decks) =================
  { id: 'vampire_bat', name: 'Вампир-нетопырь', cost: 3, type: 'minion', class: 'neutral', rarity: 'common', attack: 3, health: 2, keywords: ['lifesteal'], art: '🦇', theme: 'shadow', text: 'Похищение жизни.' },
  { id: 'rush_drake', name: 'Молодой дракон', cost: 4, type: 'minion', class: 'neutral', rarity: 'common', attack: 4, health: 4, keywords: ['rush'], art: '🐉', theme: 'fire', text: 'Натиск.' },
  { id: 'plague_rat', name: 'Чумная крыса', cost: 3, type: 'minion', class: 'neutral', rarity: 'rare', attack: 2, health: 3, keywords: ['poisonous'], art: '🐀', theme: 'shadow', text: 'Яд: уничтожает любое существо, которому наносит урон.' },
  { id: 'harpy', name: 'Буревестница-гарпия', cost: 5, type: 'minion', class: 'neutral', rarity: 'rare', attack: 4, health: 5, keywords: ['windfury'], art: '🪽', theme: 'nature', text: 'Неистовство ветра: атакует дважды за ход.' },
  { id: 'crusader', name: 'Крестоносец', cost: 6, type: 'minion', class: 'neutral', rarity: 'rare', attack: 5, health: 5, keywords: ['taunt', 'divineShield'], art: '🏇', theme: 'holy', text: 'Провокация. Божественный щит.' },
  { id: 'siege_machine', name: 'Осадная машина', cost: 5, type: 'minion', class: 'neutral', rarity: 'common', attack: 5, health: 6, keywords: ['taunt'], art: '🛞', theme: 'mech', text: 'Провокация.' },
  { id: 'tavern_keeper', name: 'Хозяин таверны', cost: 9, type: 'minion', class: 'neutral', rarity: 'legendary', attack: 8, health: 8, keywords: ['taunt'], art: '🍺', theme: 'holy', text: 'Провокация. Боевой клич: возьмите 2 карты.', battlecry: { ops: [{ op: 'draw', amount: 2 }] } },
  { id: 'blizzard', name: 'Метель', cost: 6, type: 'spell', class: 'mage', rarity: 'rare', art: '🌨️', theme: 'frost', text: 'Наносит 2 ед. урона существам противника и замораживает их.', spell: { ops: [{ op: 'damage', target: 'allEnemyMinions', amount: 2 }, { op: 'freeze', target: 'allEnemyMinions' }] } },
  { id: 'fire_comet', name: 'Огненная комета', cost: 8, type: 'spell', class: 'mage', rarity: 'epic', art: '☄️', theme: 'fire', text: 'Наносит 8 ед. урона.', spell: { ops: [{ op: 'damage', target: 'chosen', amount: 8 }], targeted: true } },
  { id: 'mortal_strike', name: 'Смертельный удар', cost: 4, type: 'spell', class: 'warrior', rarity: 'common', art: '🗡️', theme: 'fire', text: 'Наносит 4 ед. урона.', spell: { ops: [{ op: 'damage', target: 'chosen', amount: 4 }], targeted: true } },
  { id: 'banner_warrior', name: 'Знаменосец', cost: 5, type: 'minion', class: 'warrior', rarity: 'common', attack: 4, health: 4, art: '🚩', theme: 'fire', text: 'Боевой клич: даёт вашим существам +1/+1.', battlecry: { ops: [{ op: 'buff', target: 'allFriendlyMinions', attack: 1, health: 1 }] } },
  { id: 'prayer', name: 'Общая молитва', cost: 4, type: 'spell', class: 'priest', rarity: 'common', art: '🙏', theme: 'holy', text: 'Восстанавливает 4 ед. здоровья всем союзникам. Возьмите карту.', spell: { ops: [{ op: 'heal', target: 'allFriendlies', amount: 4 }, { op: 'draw', amount: 1 }] } },
  { id: 'archbishop', name: 'Архиепископ', cost: 7, type: 'minion', class: 'priest', rarity: 'rare', attack: 6, health: 8, keywords: ['taunt', 'lifesteal'], art: '⛪', theme: 'holy', text: 'Провокация. Похищение жизни.' },
  { id: 'war_hawk', name: 'Боевой ястреб', cost: 3, type: 'minion', class: 'hunter', rarity: 'common', attack: 3, health: 2, keywords: ['windfury'], art: '🦅', theme: 'nature', text: 'Неистовство ветра: атакует дважды за ход.' },
  { id: 'aimed_shot', name: 'Прицельный выстрел', cost: 2, type: 'spell', class: 'hunter', rarity: 'common', art: '🎯', theme: 'nature', text: 'Наносит 3 ед. урона.', spell: { ops: [{ op: 'damage', target: 'chosen', amount: 3 }], targeted: true } },
  { id: 'alpha_wolf', name: 'Вожак стаи', cost: 5, type: 'minion', class: 'hunter', rarity: 'rare', attack: 4, health: 4, keywords: ['charge'], art: '🐺', theme: 'nature', text: 'Рывок.' },
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
  return CARD_LIST.filter((c) => c.class === cls || c.class === 'neutral');
}
