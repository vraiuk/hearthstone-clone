#!/usr/bin/env python3
"""Нарезка листов ИИ-арта на арты карт.

Использование:
  python3 scripts/slice-art.py assets/raw/
    — ищет sheet1.png..sheet6.png (или .jpg/.webp), режет каждый на сетку 3×5,
      сохраняет assets/art/<cardId>.webp (400px, q80) и обновляет
      js/data/art-manifest.js.

Порядок клеток в каждом листе соответствует промптам генерации
(слева направо, сверху вниз).
"""
import os
import sys
import subprocess
from PIL import Image

# Позиция в сетке (row-major) → id карты. None = клетка пропускается.
SHEETS = {
    'sheet1': [  # Народ Земли
        'gremlin_digger', 'steel_sentinel', 'miner_scout',
        'hoplite_kido', 'sigurd', 'rusty_reaper',
        'tolya_grohot', 'quarry_golem', 'forge_smith',
        'ruins_keeper', 'barricade', 'siege_kido',
        'drill_walker', 'bastion_captain', 'igg_vanguard',
    ],
    'sheet2': [  # Народ Трав
        'pup_karkh', 'tauro_bull', 'swift_varg',
        'riding_karkh', 'sky_hawk', 'lendo',
        'plains_matriarch', 'white_varg', 'thunder_tauro',
        'karkh_rider', 'pack_leader', 'elder_varg',
        'karkh_mother', 'nimble_lizard', 'blood_bat',
    ],
    'sheet3': [  # Народ Реки + лёд
        'river_sprite', 'pearl_healer', 'silver_trout',
        'tide_guard', 'aurvak', 'deep_horror',
        'ice_golem', 'token_iceShard', 'young_runist',
        'rune_keeper', 'timeless_echo', 'wandering_seer',
        'whirlwing', 'igg_knight', 'shield_disciple',
    ],
    'sheet4': [  # Черви и тени
        'larva_crawler', 'exploding_larva', 'burrower',
        'carrion_beetle', 'plague_carrier', 'imago_executioner',
        'rotting_golem', 'nest_queen', 'shadow_dancer',
        'mrak_spawn', 'night_terror', 'night_carver',
        'renegade_blade', 'sunset_blade', 'token_phantom',
    ],
    'sheet5': [  # Восходящие, оружие, титулы
        'hero_vincent', 'hero_veronika', 'hero_aino',
        'hero_azimandia', 'hero_mrak', 'igg_spear',
        'igg_hammer', 'executioner_blades', 'torq',
        'herald_ascension', 'timeless_warden', 'starblood_avatar',
        'ash_owl', 'rocket_grenadier', 'will_empress',
    ],
    'sheet6': [  # Знаковые руны
        'red_wave', 'star_ice', 'star_comet',
        'time_loop', 'void_sphere', 'wild_hunt',
        'living_chains', 'hypnotism', 'igg_light',
        'death_mark', 'blade_fan', 'phantoms',
        'shield_wall', 'illumination', 'red_stream',
    ],
}

# Токены/карты, переиспользующие чужой арт (кому не досталось клетки).
REUSE = {
    'token_vargToken': 'swift_varg',
    'token_vargPup': 'swift_varg',
    'token_larva': 'larva_crawler',
    'token_karkhCub': 'pup_karkh',
    'token_tauroCalf': 'tauro_bull',
    'token_wildBoar': 'pack_leader',
    'token_oldTauro': 'tauro_bull',
    'token_skyKarkh': 'sky_hawk',
    'token_kidoWreck': 'rusty_reaper',
    'token_slug': 'larva_crawler',
    'mind_thief': 'hypnotism',
    'prophetess': 'illumination',
    'psi_blast': 'hypnotism',
    'mind_crush': 'hypnotism',
    'suppression': 'living_chains',
    'word_of_pain': 'death_mark',
    'word_of_void': 'void_sphere',
    'heroic_surge': 'red_stream',
    'justice_hammer': 'igg_hammer',
    'sharp_throw': 'blade_fan',
    'read_tracks': 'wild_hunt',
    'beast_call': 'wild_hunt',
    'pack_order': 'blade_fan',
    'release_pack': 'wild_hunt',
    'spear_hail': 'blade_fan',
    'rune_nova': 'red_wave',
    'ice_rune': 'star_ice',
    'illumination_': None,
    'transmute_rune': 'hypnotism',
    'backstab': 'blade_fan',
    'poison_vial': 'death_mark',
    'hidden_lunge': 'blade_fan',
    'elimination': 'death_mark',
    'rune_spark': 'red_stream',
    'rune_frost': 'star_ice',
    'rune_mend': 'illumination',
}

GRID_COLS, GRID_ROWS = 3, 5
OUT_SIZE = 400
# Обрезка краёв клетки, чтобы срезать линии-разделители сетки.
CELL_INSET = 0.045


def find_sheet(raw_dir, base):
    for ext in ('.png', '.jpg', '.jpeg', '.webp'):
        p = os.path.join(raw_dir, base + ext)
        if os.path.exists(p):
            return p
    return None


def main():
    raw_dir = sys.argv[1] if len(sys.argv) > 1 else 'assets/raw'
    out_dir = 'assets/art'
    os.makedirs(out_dir, exist_ok=True)
    produced = []

    for base, ids in SHEETS.items():
        path = find_sheet(raw_dir, base)
        if not path:
            print(f'⏭  {base}: файл не найден в {raw_dir}, пропускаю')
            continue
        img = Image.open(path).convert('RGB')
        w, h = img.size
        cw, ch = w / GRID_COLS, h / GRID_ROWS
        ix, iy = cw * CELL_INSET, ch * CELL_INSET
        for i, cid in enumerate(ids):
            if not cid:
                continue
            r, c = divmod(i, GRID_COLS)
            box = (int(c * cw + ix), int(r * ch + iy),
                   int((c + 1) * cw - ix), int((r + 1) * ch - iy))
            tile = img.crop(box)
            # Квадратный кроп по центру + даунскейл.
            side = min(tile.size)
            tw, th = tile.size
            tile = tile.crop(((tw - side) // 2, (th - side) // 2,
                              (tw + side) // 2, (th + side) // 2))
            tile = tile.resize((OUT_SIZE, OUT_SIZE), Image.LANCZOS)
            out = os.path.join(out_dir, cid + '.webp')
            tile.save(out, 'WEBP', quality=80)
            produced.append(cid)
        print(f'✅ {base}: нарезано {len([x for x in ids if x])} артов')

    # Переиспользование артов.
    for target, source in REUSE.items():
        if not source:
            continue
        src = os.path.join(out_dir, source + '.webp')
        dst = os.path.join(out_dir, target + '.webp')
        if os.path.exists(src) and not os.path.exists(dst):
            subprocess.run(['cp', src, dst], check=True)
            produced.append(target)

    # Манифест для игры.
    all_ids = sorted({f[:-5] for f in os.listdir(out_dir) if f.endswith('.webp')})
    with open('js/data/art-manifest.js', 'w') as f:
        f.write('// Автогенерировано scripts/slice-art.py — список карт с ИИ-артом.\n')
        f.write('export const ART = new Set(' + repr(all_ids).replace("'", '"') + ');\n')
    print(f'\n📦 Итого артов: {len(all_ids)}; манифест обновлён.')


if __name__ == '__main__':
    main()
