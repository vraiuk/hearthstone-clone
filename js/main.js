// App entry: screen router and glue between menus, battles and progression.

import { renderMenu, renderClassPick, renderCampaign, renderCollection, renderReward } from './ui/menus.js';
import { BattleScreen } from './ui/battle.js';
import { CAMPAIGN, encounterDeck } from './data/campaign.js';
import { STARTER_DECKS, CLASSES } from './data/decks.js';
import * as Save from './state/save.js';

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
        return renderClassPick(root, nav, (cls) => startQuickBattle(cls), 'Быстрый бой против случайного противника');
      default: return renderMenu(root, nav);
    }
  },
  startCampaignBattle(index) {
    const enc = CAMPAIGN[index];
    renderClassPick(root, nav, (cls) => {
      new BattleScreen({
        root,
        playerClass: cls,
        playerDeck: Save.battleDeck(cls),
        enemy: {
          name: enc.name,
          icon: enc.icon,
          class: enc.class,
          deck: encounterDeck(enc),
          difficulty: enc.difficulty,
          boss: enc.boss || null,
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
    playerClass: cls,
    playerDeck: Save.battleDeck(cls),
    enemy: {
      name: 'Соперник из таверны',
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

nav.go('menu');
