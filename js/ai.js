// Grand Legends TCG - Motor de IA Táctica Avanzada
window.GLTCG = window.GLTCG || {};

const AI_DIFFICULTIES = {
  baja: {
    label: 'Baja',
    think: 0.65,
    maxPlays: 3,
    maxAttacks: 3,
    attachDon: 1,
    randomness: 0.35,
    aggression: 0.45,
    antiSuicide: false,
    smartTrades: false,
    lethalCheck: false
  },
  normal: {
    label: 'Normal',
    think: 0.40,
    maxPlays: 6,
    maxAttacks: 8,
    attachDon: 2,
    randomness: 0.12,
    aggression: 0.72,
    antiSuicide: true,
    smartTrades: true,
    lethalCheck: false
  },
  dificil: {
    label: 'Difícil',
    think: 0.20,
    maxPlays: 12,
    maxAttacks: 12,
    attachDon: 4,
    randomness: 0.02,
    aggression: 0.95,
    antiSuicide: true,
    smartTrades: true,
    lethalCheck: true,
    comboSequencing: true
  }
};

let aiDifficulty = localStorage.getItem('GLTCG_AI_DIFFICULTY') || 'normal';
if (!AI_DIFFICULTIES[aiDifficulty]) aiDifficulty = 'normal';

function setAIDifficulty(v) {
  if (!AI_DIFFICULTIES[v]) return;
  aiDifficulty = v;
  localStorage.setItem('GLTCG_AI_DIFFICULTY', v);
  const s = document.getElementById('aiDifficulty');
  if (s) s.value = v;
}

window.addEventListener('DOMContentLoaded', () => {
  const s = document.getElementById('aiDifficulty');
  if (s) s.value = aiDifficulty;
});

function getAIDifficultyConfig() {
  return AI_DIFFICULTIES[aiDifficulty] || AI_DIFFICULTIES.normal;
}

function cardTypeScore(card, config) {
  let score = 0, p = Number(card.power || 0), cost = Number(card.cost || 0);
  
  if (card.type === 'Personaje') {
    score += 2400 + p + cost * 180;
    if (card.blocker) score += (p1Field.length >= 2 ? 1500 : 800);
    if (card.attackBoost) score += 600;
  } else if (card.type === 'Evento') {
    score += 1800 + cost * 150;
  } else if (card.type === 'Recurso') {
    score += 1200 + cost * 100;
  }

  if (card.onPlay) score += 500;
  if (card.active) score += 450;
  if (card.awakening) score += 600;

  if (card.effect === 'ko1500' && p1Field.some(c => totalPower(c) <= 1500)) score += 3200;
  if (card.effect === 'bounce1000' && p1Field.some(c => totalPower(c) <= 1000)) score += 2600;
  if (card.effect === 'break2') score += (p1shield > 0 ? 3000 : 500);
  if (card.effect === 'stormCollision' && p1Field.length >= 2) score += 3200;
  if (card.effect === 'koCollision' && p1Field.length) score += 2800;
  if (card.effect === 'debuff700' && p1Field.length) score += 1900;
  if (card.effect === 'draw2' || card.effect === 'draw3' || card.effect === 'draw3Discard') score += 1500;
  
  if (card.id && (card.id.startsWith('C') || card.id.startsWith('R') || card.id.startsWith('E') || card.id.startsWith('T'))) {
    score += 300;
  }
  return score;
}

function scoreAICard(card, config) {
  return cardTypeScore(card, config) + (Math.random() < config.randomness ? Math.random() * 2000 : 0);
}

function chooseAICard(cards, config) {
  if (!cards || !cards.length) return null;
  return cards.slice().sort((a, b) => scoreAICard(b, config) - scoreAICard(a, config))[0];
}

function chooseAITarget(attacker, config) {
  if (!p1Field.length) return -1;
  const ap = totalPower(attacker);

  const targets = p1Field.map((card, index) => {
    const tp = totalPower(card);
    let score = 0;

    if (ap > tp) {
      score += 5000 + (tp * 1.5);
      if (card.blocker) score += 2500;
      if (card.power >= 2000) score += 1200;
      score += Math.max(0, 1000 - (ap - tp));
      if (config.aggression > 0.7) score += 1500;
    } else if (ap === tp) {
      if (card.blocker || card.power >= attacker.power) {
        score += 2600;
      } else {
        score += 1000;
      }
    } else {
      if (config.antiSuicide) {
        score = -10000 + (ap - tp);
      } else {
        score -= 2500;
        if (card.blocker) score += 1000;
      }
    }

    return { index, score, tp };
  });

  const viable = config.antiSuicide ? targets.filter(t => t.score > 0) : targets;
  if (!viable.length) {
    return -1;
  }

  viable.sort((a, b) => b.score - a.score);

  if (Math.random() < config.randomness && viable.length > 1) {
    return viable[Math.floor(Math.random() * Math.min(2, viable.length))].index;
  }
  return viable[0].index;
}

function chooseAIEvolutionCard(cards, config) {
  if (!cards.length) return null;
  const highImpact = cards.filter(c => c.cost >= 4 || c.id === 'E35' || c.id === 'E36' || c.power >= 2500);
  const pool = highImpact.length ? highImpact : cards;
  return pool.slice().sort((a, b) => (b.power || 0) + (b.cost || 0) * 500 - ((a.power || 0) + (a.cost || 0) * 500))[0];
}

function attachAIDon(config) {
  if (!p2DonReserve.length || !p2Field.length) return;

  const readyAttackers = p2Field.filter(u => !u.summoningSickness && !u.hasAttacked);
  if (!readyAttackers.length) return;

  if (p1Field.length > 0 && config.smartTrades) {
    for (const attacker of readyAttackers) {
      if (!p2DonReserve.length) break;
      const ap = totalPower(attacker);
      const target = p1Field.find(d => {
        const tp = totalPower(d);
        const needed = tp - ap + 1000;
        const neededDons = Math.ceil(needed / 1000);
        return neededDons > 0 && neededDons <= Math.min(config.attachDon, p2DonReserve.length);
      });

      if (target) {
        const needed = Math.max(1, Math.ceil((totalPower(target) - ap + 1000) / 1000));
        const amount = Math.min(needed, p2DonReserve.length, config.attachDon);
        p2DonReserve.splice(0, amount);
        p2don = p2DonReserve.length;
        attacker.attached = (attacker.attached || 0) + amount;
        battleStats.donAttached += amount;
        log('🤖 IA táctica: adjuntó ' + amount + ' DON a ' + attacker.name + ' para superar a ' + target.name + '.');
        return;
      }
    }
  }

  const target = readyAttackers.sort((a, b) => totalPower(b) - totalPower(a))[0];
  if (!target) return;

  const amount = Math.min(config.attachDon, p2DonReserve.length);
  if (amount > 0) {
    p2DonReserve.splice(0, amount);
    p2don = p2DonReserve.length;
    target.attached = (target.attached || 0) + amount;
    battleStats.donAttached += amount;
    log('🤖 IA: adjuntó ' + amount + ' DON a ' + target.name + '.');
  }
}

function decideAIBlock(incomingPower, currentHp, currentShields, blockers) {
  if (!blockers || !blockers.length) return -1;

  if (currentShields === 0 && currentHp <= 2) {
    return 0;
  }

  const winningBlockerIdx = blockers.findIndex(b => totalPower(b) >= incomingPower);
  if (winningBlockerIdx >= 0) {
    return winningBlockerIdx;
  }

  if (currentShields <= 1 && blockers.some(b => totalPower(b) <= 1500)) {
    return blockers.findIndex(b => totalPower(b) <= 1500);
  }

  return currentShields > 1 ? -1 : 0;
}

GLTCG.ai = {
  difficulties: AI_DIFFICULTIES,
  getDifficulty: getAIDifficultyConfig,
  chooseCard: chooseAICard,
  chooseTarget: chooseAITarget,
  chooseEvolutionCard: chooseAIEvolutionCard,
  attachDon: attachAIDon,
  decideAIBlock: decideAIBlock
};
