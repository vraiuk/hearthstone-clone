// App entry: screen router and glue between menus, battles, audio and
// progression for «Звёздная Кровь».

import { renderMenu, renderClassPick, renderCampaign, renderCollection, renderReward } from './ui/menus.js';
import { BattleScreen } from './ui/battle.js';
import { CAMPAIGN, encounterDeck } from './data/campaign.js';
import { STARTER_DECKS, CLASSES } from './data/decks.js';
import * as Save from './state/save.js';
import { Audio, installAudioUnlock } from './audio/audio.js';

const root = document.getElementById('app');

const nav = {
  state: {},          // scratch state shared between screens (deck drafts etc.)
  go(screen) {
    window.scrollTo(0, 0);
    switch (screen) {
      case 'menu': return renderMenu(root, nav);
      case 'campaign': return renderCampaign(root, nav);
      case 'collection': return renderCollection(root, nav);
      case 'quickPick':
        return renderClassPick(root, nav, (cls) => startQuickBattle(cls),
          'Быстрый бой против случайного Восходящего');
      case 'pvpPick':
        return startPvpFlow();
      default: return renderMenu(root, nav);
    }
  },
  startCampaignBattle(index) {
    const enc = CAMPAIGN[index];
    renderClassPick(root, nav, (cls) => {
      new BattleScreen({
        root,
        mode: 'ai',
        playerClass: cls,
        playerDeck: Save.battleDeck(cls),
        enemy: {
          name: enc.name,
          icon: enc.icon,
          class: enc.class,
          deck: encounterDeck(enc),
          difficulty: enc.difficulty,
          boss: enc.boss || null,
          startHealth: enc.enemyHealth || null,
        },
        onFinish(won) {
          Save.recordResult(won);
          if (won) {
            Save.addGold(enc.rewardGold);
            Save.unlockCards(enc.unlocks);
            Save.beatEncounter(index);
            renderReward(root, nav, enc);
          } else {
            nav.go('campaign');
          }
        },
      });
    }, `Противник: ${enc.icon} ${enc.name}`);
  },
};

function startQuickBattle(cls) {
  const classes = Object.keys(CLASSES);
  const enemyCls = classes[Math.floor(Math.random() * classes.length)];
  new BattleScreen({
    root,
    mode: 'ai',
    playerClass: cls,
    playerDeck: Save.battleDeck(cls),
    enemy: {
      name: CLASSES[enemyCls].hero,
      icon: CLASSES[enemyCls].icon,
      class: enemyCls,
      deck: STARTER_DECKS[enemyCls].slice(),
      difficulty: 'normal',
      boss: null,
    },
    onFinish(won) {
      Save.recordResult(won);
      if (won) Save.addGold(50);
      nav.go('menu');
    },
  });
}

// PvP hotseat: both players pick an Ascendant, then share the screen.
function startPvpFlow() {
  renderClassPick(root, nav, (cls1) => {
    renderClassPick(root, nav, (cls2) => {
      new BattleScreen({
        root,
        mode: 'hotseat',
        p1: { name: `${CLASSES[cls1].hero} (И1)`, class: cls1, deck: Save.battleDeck(cls1) },
        p2: { name: `${CLASSES[cls2].hero} (И2)`, class: cls2, deck: STARTER_DECKS[cls2].slice() },
        onFinish() { nav.go('menu'); },
      });
    }, '🤝 PvP · Игрок 2: выберите Восходящего');
  }, '🤝 PvP · Игрок 1: выберите Восходящего');
}

// ---- audio: unlock on first gesture + mute toggle button ----
installAudioUnlock();
const muteBtn = document.createElement('button');
muteBtn.className = 'mute-btn';
muteBtn.textContent = Audio.muted ? '🔇' : '🔊';
muteBtn.title = 'Музыка и звук (вкл/выкл)';
muteBtn.addEventListener('click', () => {
  const muted = Audio.toggleMute();
  muteBtn.textContent = muted ? '🔇' : '🔊';
});
document.body.append(muteBtn);

nav.go('menu');
