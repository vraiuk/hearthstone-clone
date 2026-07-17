// Curated starter decks (30 cards, max 2 copies) and class metadata.

export const CLASSES = {
  mage:    { name: 'Маг',     icon: '🧙', color: '#4fa3e3', desc: 'Заклинания, контроль поля и прямой урон.' },
  warrior: { name: 'Воин',    icon: '⚔️', color: '#c0392b', desc: 'Оружие, броня и агрессивные существа.' },
  priest:  { name: 'Жрец',    icon: '✨', color: '#e8e3d3', desc: 'Исцеление, живучесть и поздняя игра.' },
  hunter:  { name: 'Охотник', icon: '🏹', color: '#27ae60', desc: 'Звери и безжалостный урон в лицо.' },
};

export const STARTER_DECKS = {
  mage: [
    'arcane_missiles', 'arcane_missiles',
    'mirror_image',
    'frostbolt', 'frostbolt',
    'arcane_explosion',
    'sorcerers_apprentice', 'sorcerers_apprentice',
    'novice_engineer',
    'kobold_geomancer', 'kobold_geomancer',
    'arcane_intellect', 'arcane_intellect',
    'wolfrider',
    'spider_tank',
    'water_elemental', 'water_elemental',
    'fireball', 'fireball',
    'polymorph',
    'chillwind_yeti', 'chillwind_yeti',
    'senjin',
    'stormpike_commando',
    'nightblade',
    'archmage',
    'boulderfist_ogre',
    'flamestrike',
    'war_golem',
    'gnomish_inventor',
  ],
  warrior: [
    'whirlwind',
    'execute', 'execute',
    'murloc_raider',
    'leper_gnome', 'leper_gnome',
    'fiery_war_axe', 'fiery_war_axe',
    'heroic_strike', 'heroic_strike',
    'cleave',
    'bloodfen_raptor', 'bloodfen_raptor',
    'frostwolf_grunt',
    'loot_hoarder',
    'shield_block', 'shield_block',
    'warsong_commander',
    'wolfrider',
    'ironfur_grizzly',
    'kor_kron_elite', 'kor_kron_elite',
    'chillwind_yeti',
    'dark_iron_dwarf',
    'arcanite_reaper', 'arcanite_reaper',
    'fen_creeper',
    'reckless_rocketeer',
    'boulderfist_ogre',
    'lord_of_arena',
  ],
  priest: [
    'northshire_cleric', 'northshire_cleric',
    'power_word_shield', 'power_word_shield',
    'holy_smite', 'holy_smite',
    'voodoo_doctor',
    'shadow_word_pain', 'shadow_word_pain',
    'mind_blast',
    'river_croc',
    'frostwolf_grunt',
    'shadow_word_death',
    'shattered_sun',
    'ironfur_grizzly',
    'harvest_golem',
    'lightspawn', 'lightspawn',
    'chillwind_yeti',
    'oasis_snapjaw',
    'senjin', 'senjin',
    'holy_nova',
    'fen_creeper',
    'temple_enforcer', 'temple_enforcer',
    'lord_of_arena',
    'boulderfist_ogre',
    'war_golem',
    'abomination',
  ],
  hunter: [
    'arcane_shot', 'arcane_shot',
    'timber_wolf', 'timber_wolf',
    'tracking',
    'wisp',
    'murloc_raider',
    'elven_archer',
    'bloodfen_raptor', 'bloodfen_raptor',
    'river_croc',
    'ironbeak_owl',
    'animal_companion', 'animal_companion',
    'kill_command', 'kill_command',
    'unleash_hounds',
    'wolfrider', 'wolfrider',
    'ironfur_grizzly',
    'houndmaster', 'houndmaster',
    'multi_shot',
    'oasis_snapjaw',
    'starving_buzzard',
    'stormpike_commando',
    'savannah_highmane', 'savannah_highmane',
    'reckless_rocketeer',
    'core_hound',
  ],
};

// Deck-building rules.
export const DECK_SIZE = 30;
export const MAX_COPIES = 2;

export function validateDeck(cardIds, heroClass, getCard) {
  if (cardIds.length !== DECK_SIZE) return { ok: false, reason: `В колоде должно быть ${DECK_SIZE} карт (сейчас ${cardIds.length}).` };
  const counts = {};
  for (const id of cardIds) {
    counts[id] = (counts[id] || 0) + 1;
    if (counts[id] > MAX_COPIES) return { ok: false, reason: 'Не больше 2 копий карты.' };
    const c = getCard(id);
    if (c.class !== 'neutral' && c.class !== heroClass)
      return { ok: false, reason: `«${c.name}» не подходит классу.` };
  }
  return { ok: true };
}
