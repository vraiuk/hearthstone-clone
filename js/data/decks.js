// Восходящие (классы героев) и их стартовые колоды (30 карт, максимум 2 копии).

export const CLASSES = {
  vincent:   { name: 'Предводитель',    hero: 'Винсент Кассиди',      icon: '🛡️', color: '#c9a84c', desc: 'Броня, оружие Игг и усиление отрядов.' },
  veronika:  { name: 'Менталист',       hero: 'Вероника Максвелл',    icon: '🌀', color: '#a56fd6', desc: 'Контроль разума, немота и кража карт.' },
  aino:      { name: 'Охотник',         hero: 'Айно Ветер Равнин',    icon: '🏹', color: '#4faf62', desc: 'Звери равнин, скорость и Дикая Охота.' },
  azimandia: { name: 'Мастер Рун',      hero: 'Азимандия Визу Аран',  icon: '⚒️', color: '#5aa7e8', desc: 'Руны, копии существ и Безвременье.' },
  mrak:      { name: 'Теневой Убийца',  hero: 'Мрак, Белый Дьявол',   icon: '🗡️', color: '#b8434e', desc: 'Скрытность, яды и точечное устранение.' },
};

export const STARTER_DECKS = {
  vincent: [
    'igg_spear', 'igg_spear',
    'shield_wall', 'shield_wall',
    'heroic_surge', 'heroic_surge',
    'igg_light', 'igg_light',
    'justice_hammer',
    'bastion_captain', 'bastion_captain',
    'igg_vanguard', 'igg_vanguard',
    'ascension_banner',
    'steel_sentinel', 'steel_sentinel',
    'hoplite_kido', 'hoplite_kido',
    'quarry_golem', 'quarry_golem',
    'miner_scout', 'miner_scout',
    'barricade',
    'shield_disciple', 'shield_disciple',
    'renegade_blade', 'renegade_blade',
    'drill_walker',
    'night_carver',
    'rocket_grenadier',
  ],
  veronika: [
    'psi_blast', 'psi_blast',
    'mind_crush', 'mind_crush',
    'suppression', 'suppression',
    'phantoms', 'phantoms',
    'word_of_pain', 'word_of_pain',
    'word_of_void', 'word_of_void',
    'prophetess', 'prophetess',
    'wandering_seer', 'wandering_seer',
    'tide_guard', 'tide_guard',
    'pearl_healer', 'pearl_healer',
    'ash_owl', 'ash_owl',
    'quarry_golem', 'quarry_golem',
    'deep_horror',
    'barricade',
    'night_carver',
    'blood_bat', 'blood_bat',
    'ruins_keeper',
  ],
  aino: [
    'sharp_throw', 'sharp_throw',
    'beast_call', 'beast_call',
    'pack_order', 'pack_order',
    'release_pack', 'release_pack',
    'read_tracks', 'read_tracks',
    'spear_hail', 'spear_hail',
    'karkh_rider', 'karkh_rider',
    'pup_karkh', 'pup_karkh',
    'tauro_bull', 'tauro_bull',
    'swift_varg', 'swift_varg',
    'riding_karkh', 'riding_karkh',
    'sky_hawk', 'sky_hawk',
    'plains_matriarch', 'plains_matriarch',
    'thunder_tauro',
    'nimble_lizard', 'nimble_lizard',
    'renegade_blade',
  ],
  azimandia: [
    'ice_rune', 'ice_rune',
    'rune_nova', 'rune_nova',
    'illumination', 'illumination',
    'red_stream', 'red_stream',
    'transmute_rune',
    'young_runist', 'young_runist',
    'ice_golem', 'ice_golem',
    'rune_keeper', 'rune_keeper',
    'river_sprite', 'river_sprite',
    'wandering_seer', 'wandering_seer',
    'miner_scout', 'miner_scout',
    'quarry_golem', 'quarry_golem',
    'drill_walker',
    'deep_horror',
    'tide_guard', 'tide_guard',
    'barricade',
    'night_carver',
    'pearl_healer',
  ],
  mrak: [
    'backstab', 'backstab',
    'poison_vial', 'poison_vial',
    'hidden_lunge', 'hidden_lunge',
    'blade_fan', 'blade_fan',
    'elimination',
    'shadow_dancer', 'shadow_dancer',
    'mrak_spawn', 'mrak_spawn',
    'blood_bat', 'blood_bat',
    'exploding_larva', 'exploding_larva',
    'burrower', 'burrower',
    'carrion_beetle', 'carrion_beetle',
    'larva_crawler', 'larva_crawler',
    'renegade_blade', 'renegade_blade',
    'nimble_lizard', 'nimble_lizard',
    'night_carver',
    'rocket_grenadier',
    'deep_horror',
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
      return { ok: false, reason: `«${c.name}» не подходит этому Восходящему.` };
  }
  return { ok: true };
}
