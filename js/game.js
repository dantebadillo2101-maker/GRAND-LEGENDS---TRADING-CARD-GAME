"use strict";

window.addEventListener("error", function(ev) {
  const box = document.getElementById("jsError");
  if (box) {
    box.style.display = "block";
    box.textContent = "⚠️ Error del juego: " + ev.message;
  }
});

/* ==========================================================================
   ESTADO GLOBAL DEL JUEGO Y BIBLIOTECA
   ========================================================================== */
const LIBRARY = GLTCG.CARD_LIBRARY;
const LEADERS = GLTCG.LEADERS;

let selectedLeader = LEADERS[0];
let aiLeader = LEADERS[1] || LEADERS[0];
let selectedLeaderP2 = LEADERS[1] || LEADERS[0];

let p1Deck = [], p2Deck = [], hand = [], aiHand = [], p1Field = [], p2Field = [], p1Grave = [], p2Grave = [];
let p1DonDeck = [], p2DonDeck = [], p1DonReserve = [], p2DonReserve = [];
let customDeck = [];

let p1hp = 5, p2hp = 5, p1shield = 3, p2shield = 3;
let p1max = 1, p2max = 2, p1don = 1, p2don = 2;
let p1leaderDon = 0, p2leaderDon = 0;
let p1DrawnThisTurn = false, p2DrawnThisTurn = false;

let active = 1, turn = 1, gameOver = false, aiBusy = false, boost = 0, p2Boost = 0;

let battleStats = {
  damageDealt: 0,
  damageTaken: 0,
  unitsDefeated: 0,
  cardsPlayed: 0,
  donAttached: 0,
  attacksMade: 0,
  leaderAttacks: 0,
  turns: 1,
  startTime: Date.now()
};

function resetBattleStats() {
  battleStats = {
    damageDealt: 0,
    damageTaken: 0,
    unitsDefeated: 0,
    cardsPlayed: 0,
    donAttached: 0,
    attacksMade: 0,
    leaderAttacks: 0,
    turns: 1,
    startTime: Date.now()
  };
}

function emitBattleEvent(type, data = {}) {
  battleEventHistory.push({ type, turn, active, timestamp: Date.now(), ...data });
  if (battleEventHistory.length > 2000) battleEventHistory.shift();
}

function getBattleHistory() {
  return battleEventHistory.map(event => ({ ...event }));
}

function exportBattleReplay() {
  const replay = { version: replayExportVersion, game: 'Grand Legends TCG', events: getBattleHistory() };
  const blob = new Blob([JSON.stringify(replay, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'gltcg-replay-' + Date.now() + '.json';
  link.click();
  URL.revokeObjectURL(url);
}

let localMode = "ai";
let attackSelection = null;
let p2AttackSelection = null;
let leaderAbilityUsed = false;
let leaderAbilityUsedP2 = false;
let leaderHasAttackedP1 = false;
let leaderHasAttackedP2 = false;
let shadowUsedP1 = false, shadowUsedP2 = false;
let awakenedThisTurnP1 = false, awakenedThisTurnP2 = false;
let rabbitHoleUsed = false;
let comboP1 = 0, comboP2 = 0;
let comboBonusP1 = 0, comboBonusP2 = 0;
let collisionLeaderUsedP1 = false, collisionLeaderUsedP2 = false;
let evolutionUsedThisTurnP1 = false, evolutionUsedThisTurnP2 = false;
let shadowsDisabledP1 = false, shadowsDisabledP2 = false;
let evolutionNextBoostP1 = false, evolutionNextBoostP2 = false;
let evolutionImmediateAttackUsedP1 = false, evolutionImmediateAttackUsedP2 = false;
let cantoUsedP1 = false, cantoUsedP2 = false;
let cantoModifierP1 = 0, cantoModifierP2 = 0;
let cantoTurnHistoryP1 = [], cantoTurnHistoryP2 = [];
let lastResolvedAbility = null;
let resolvingRepeatedAbility = false;
let battleEventHistory = [];
let replayExportVersion = 1;
let selectedDonIndex = null;
let deckBuilderOpenedFrom = 'menu';
let currentLeaderFilter = 'ALL';

// ==========================================================================
// TORNEO VS IA
// ==========================================================================
let tournamentState = {
  active: false,
  difficulty: 'normal',
  stage: 0,
  wins: 0,
  losses: 0,
  opponents: [],
  history: []
};
let tournamentCurrentOpponent = null;

function tournamentDifficultyLabel(key) {
  const cfg = GLTCG.ai?.difficulties?.[key];
  return cfg ? cfg.label : key;
}

function startTournamentMode() {
  closeLocalMode();
  const modal = document.getElementById('tournamentModal');
  if (modal) modal.classList.add('open');
  renderTournamentSetup();
}

function closeTournamentModal() {
  document.getElementById('tournamentModal')?.classList.remove('open');
}

function abandonTournament() {
  tournamentState.active = false;
  tournamentCurrentOpponent = null;
  closeTournamentModal();
  openMainMenu();
}

function chooseTournamentDifficulty(key) {
  if (!GLTCG.ai?.difficulties?.[key]) key = 'normal';
  setAIDifficulty(key);
  tournamentState = {
    active: true, difficulty: key, stage: 0, wins: 0, losses: 0,
    opponents: [], history: []
  };
  const pool = LEADERS.slice().sort(() => Math.random() - 0.5);
  const names = ['⚔️ Rival de Apertura','🌑 Maestro de las Sombras','💥 Estratega de Collision','🐇 Superviviente del Rabbit Hole','🧬 Evolucionista','🎤 Maestro del Fin','💀 Jefe del Torneo'];
  for (let i=0;i<7;i++) {
    const leader = pool[i % pool.length];
    tournamentState.opponents.push({
      id: 'TO_' + i + '_' + leader.id,
      name: names[i],
      leaderId: leader.id,
      leaderName: leader.name,
      leaderArt: leader.art,
      deck: makeAIDeck()
    });
  }
  tournamentCurrentOpponent = tournamentState.opponents[0];
  closeTournamentModal();
  localMode = 'ai';
  // El líder del jugador se elige una sola vez y se conserva durante todo el torneo.
  openLeaderForLocal();
}

function renderTournamentSetup() {
  const box = document.getElementById('tournamentSetup');
  if (!box) return;
  const current = tournamentState.difficulty || 'normal';
  box.innerHTML = ['baja','normal','dificil'].map(key => {
    const cfg = GLTCG.ai.difficulties[key];
    const selected = current === key ? ' selected' : '';
    return '<button class="tournament-difficulty' + selected + '" onclick="chooseTournamentDifficulty(\'' + key + '\')">' +
      (key==='baja'?'🟢':key==='normal'?'🟡':'🔴') + ' <b>' + cfg.label + '</b>' +
      '<span>' + (key==='baja'?'IA accesible para aprender':key==='normal'?'IA equilibrada y táctica':'IA agresiva y exigente') + '</span></button>';
  }).join('');
}

function tournamentStageName(stage) {
  return stage === 0 ? 'CUARTOS DE FINAL' : stage === 1 ? 'SEMIFINAL' : 'GRAN FINAL';
}

function renderTournamentBracket() {
  const box = document.getElementById('tournamentBracket');
  if (!box || !tournamentState.active) return;
  const names = tournamentState.opponents.map((o,i) => {
    const status = i < tournamentState.stage ? '✅' : i === tournamentState.stage ? '⚔️' : '🔒';
    return '<div class="tournament-opponent ' + (i===tournamentState.stage?'current':'') + '"><span>' + status + '</span><b>' + o.name + '</b><small>' + o.leaderArt + ' ' + o.leaderName + '</small></div>';
  }).join('');
  box.innerHTML = '<div class="tournament-progress"><b>🏆 Camino al campeonato</b><span>' + tournamentStageName(tournamentState.stage) + ' · ' + tournamentState.wins + '/3 victorias</span></div>' + names;
}

function openTournamentBracket(message='') {
  const modal = document.getElementById('tournamentModal');
  const setup = document.getElementById('tournamentSetup');
  const bracket = document.getElementById('tournamentBracket');
  const title = document.getElementById('tournamentModalTitle');
  const msg = document.getElementById('tournamentMessage');
  if (!modal) return;
  if (setup) setup.style.display='none';
  if (bracket) bracket.style.display='block';
  if (title) title.textContent='🏆 TORNEO VS IA';
  if (msg) msg.textContent=message || 'Supera a tres rivales de IA y conviértete en campeón.';
  const nextBtn=document.getElementById('tournamentNextBtn');
  if(nextBtn) nextBtn.style.display=tournamentState.active ? 'inline-block' : 'none';
  renderTournamentBracket();
  modal.classList.add('open');
}

function startTournamentMatch() {
  if (!tournamentState.active || tournamentState.stage > 2) return;
  tournamentCurrentOpponent = tournamentState.opponents[tournamentState.stage];
  aiLeader = LEADERS.find(l => l.id === tournamentCurrentOpponent.leaderId) || LEADERS[1] || LEADERS[0];
  closeTournamentModal();
  showGame();
  reset();
  log('🏆 TORNEO: ' + tournamentStageName(tournamentState.stage) + ' contra ' + tournamentCurrentOpponent.name + '.');
  log('🤖 Rival: ' + aiLeader.name + ' · Dificultad: ' + tournamentDifficultyLabel(tournamentState.difficulty) + '.');
  render();
}

function tournamentMatchFinished(won) {
  tournamentState.history.push({ stage:tournamentState.stage, won:!!won, opponent:tournamentCurrentOpponent?.name || 'Rival IA', leader:tournamentCurrentOpponent?.leaderName || aiLeader?.name || 'IA' });
  if (!won) {
    tournamentState.losses++;
    tournamentState.active = false;
    const msg='💀 Has sido eliminado del torneo. El rival fue ' + (tournamentCurrentOpponent?.name || 'la IA') + '.';
    setTimeout(() => {
      openTournamentBracket(msg);
      const btn=document.getElementById('tournamentNextBtn');
      if(btn){ btn.style.display='none'; }
    }, 500);
    return;
  }
  tournamentState.wins++;
  tournamentState.stage++;
  if (tournamentState.stage >= 3) {
    tournamentState.active = false;
    setTimeout(() => {
      const modal=document.getElementById('tournamentModal');
      const setup=document.getElementById('tournamentSetup');
      const bracket=document.getElementById('tournamentBracket');
      const title=document.getElementById('tournamentModalTitle');
      const msg=document.getElementById('tournamentMessage');
      if(setup) setup.style.display='none';
      if(bracket){ bracket.style.display='block'; bracket.innerHTML='<div class="tournament-champion">🏆<strong>¡CAMPEÓN DEL TORNEO!</strong><span>Has superado 3 rondas en dificultad ' + tournamentDifficultyLabel(tournamentState.difficulty) + '.</span></div>'; }
      if(title) title.textContent='🏆 ¡TORNEO COMPLETADO!';
      if(msg) msg.textContent='La arena ha sido conquistada. ¡Tu mazo ha sobrevivido al camino completo!';
      const btn=document.getElementById('tournamentNextBtn');
      if(btn) btn.style.display='none';
      if(modal) modal.classList.add('open');
    },500);
    return;
  }
  const next=tournamentState.opponents[tournamentState.stage];
  setTimeout(() => openTournamentBracket('🔥 ¡Victoria! Prepárate para ' + tournamentStageName(tournamentState.stage) + ': ' + next.name + '.'), 500);
}

const COLLECTION_KEY = "gltcg_collection_v21";
const PACK_KEY = "gltcg_pack_openings_v22";
const PROGRESS_KEY = "GLTCG_PROGRESS_V1";
const ACCOUNTS_KEY = "GLTCG_ACCOUNTS_V1";
const SESSION_KEY = "GLTCG_SESSION_V1";
const STORAGE_SCHEMA_VERSION = 3;
const SAVED_DECKS_KEY = "GLTCG_SAVED_DECKS_V1";
let savedDecks = [];
let activeDeckId = null;
const STORAGE_SCHEMA_KEY = "GLTCG_STORAGE_SCHEMA";

function loadStoredObject(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch (e) {
    return {};
  }
}

function migrateStorage() {
  const currentVersion = Number(localStorage.getItem(STORAGE_SCHEMA_KEY) || 1);
  const migrated = {
    collection: loadStoredObject(COLLECTION_KEY),
    packOpenings: Math.max(10, Number(localStorage.getItem(PACK_KEY) || 10) || 10),
    progress: loadStoredObject(PROGRESS_KEY),
    accounts: loadStoredObject(ACCOUNTS_KEY)
  };

  Object.keys(migrated.progress).forEach(username => {
    const progress = migrated.progress[username];
    if (!progress || typeof progress !== 'object') {
      delete migrated.progress[username];
      return;
    }
    progress.collection = progress.collection && typeof progress.collection === 'object' ? progress.collection : {};
    progress.customDeck = Array.isArray(progress.customDeck) ? progress.customDeck : [];
    progress.packOpenings = Math.max(10, Number(progress.packOpenings) || 10);
    progress.schemaVersion = STORAGE_SCHEMA_VERSION;
  });

  Object.keys(migrated.accounts).forEach(username => {
    const account = migrated.accounts[username];
    if (!account || typeof account !== 'object') {
      delete migrated.accounts[username];
      return;
    }
    account.collection = account.collection && typeof account.collection === 'object' ? account.collection : {};
    account.packOpenings = Math.max(10, Number(account.packOpenings) || 10);
    account.wins = Math.max(0, Number(account.wins) || 0);
    account.losses = Math.max(0, Number(account.losses) || 0);
    account.level = Math.max(1, Number(account.level) || 1);
    account.schemaVersion = STORAGE_SCHEMA_VERSION;
  });

  if (currentVersion < STORAGE_SCHEMA_VERSION) {
    localStorage.setItem(COLLECTION_KEY, JSON.stringify(migrated.collection));
    localStorage.setItem(PACK_KEY, String(migrated.packOpenings));
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(migrated.progress));
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(migrated.accounts));
    localStorage.setItem(STORAGE_SCHEMA_KEY, String(STORAGE_SCHEMA_VERSION));
  }
  return migrated;
}

const migratedStorage = migrateStorage();
let collection = migratedStorage.collection;
let packOpenings = migratedStorage.packOpenings;
savedDecks = loadSavedDecks();

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    let j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function cloneCard(c) {
  return { ...c, rarity: c.rarity || "Común" };
}

function validateCard(card) {
  return GLTCG.rules.validateCardData(card);
}

function validateCardLibrary() {
  const errors = [];
  const ids = new Set();
  LIBRARY.forEach(card => {
    const result = validateCard(card);
    if (!result.valid) errors.push(card?.id || 'carta desconocida', ...result.errors);
    if (card?.id && ids.has(card.id)) errors.push('Id de carta duplicado: ' + card.id);
    if (card?.id) ids.add(card.id);
  });
  if (errors.length) console.warn('Errores en el catálogo de cartas:', errors);
  return { valid: errors.length === 0, errors };
}

function validateCustomDeck(deckCards = customDeck) {
  return GLTCG.rules.validateDeckData(deckCards, LIBRARY);
}

function validateGameState() {
  if (localStorage.getItem('GLTCG_DEBUG_VALIDATION') !== '1') return { valid: true, errors: [] };
  const errors = [];
  const seen = new Set();
  const zones = [p1Deck, p2Deck, hand, aiHand, p1Field, p2Field, p1Grave, p2Grave];
  zones.forEach(zone => zone.forEach(card => {
    if (seen.has(card)) errors.push('La misma instancia de carta aparece en varias zonas.');
    seen.add(card);
  }));
  if (p1hp < 0 || p2hp < 0 || p1shield < 0 || p2shield < 0) errors.push('Vida o escudos negativos.');
  if (p1DonReserve.length > p1max || p2DonReserve.length > p2max) errors.push('Reserva DON por encima del máximo.');
  if (comboValue(1) < 0 || comboValue(2) < 0) errors.push('Combo negativo.');
  if (errors.length) console.warn('Estado de partida inválido:', errors);
  return { valid: errors.length === 0, errors };
}

window.addEventListener('DOMContentLoaded', validateCardLibrary);

function getAccounts() {
  try { return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || "{}"); } catch (e) { return {}; }
}

async function hashLocalPassword(password) {
  if (!crypto?.subtle) return 'legacy:' + password;
  const bytes = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return 'sha256:' + Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join('');
}

async function verifyLocalPassword(account, password) {
  if (account.passwordHash) return account.passwordHash === await hashLocalPassword(password);
  return account.password === password;
}

function saveAccounts(a) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(a));
}

function currentUser() {
  return localStorage.getItem(SESSION_KEY) || "";
}

function loadSavedDecks() {
  try {
    const raw = JSON.parse(localStorage.getItem(SAVED_DECKS_KEY) || "[]");
    return Array.isArray(raw) ? raw.filter(d => d && typeof d === "object" && Array.isArray(d.cards)) : [];
  } catch (e) { return []; }
}

function saveSavedDecks() {
  localStorage.setItem(SAVED_DECKS_KEY, JSON.stringify(savedDecks));
}

function getDeckLeader(deck) {
  return LEADERS.find(l => l.id === deck?.leaderId) || selectedLeader || LEADERS[0];
}

function saveCurrentDeckAs(nameArg) {
  if (typeof nameArg === 'string' && nameArg.trim()) {
    const validation = validateCustomDeck();
    if (!validation.valid) {
      alert('⚠️ No puedes guardar este mazo todavía.\n\n' + validation.errors.join('\n'));
      return;
    }
    const leader = selectedLeader || LEADERS[0];
    const deck = { id: 'deck_' + Date.now(), name: nameArg.trim().slice(0, 40), leaderId: leader.id, cards: customDeck.map(cloneCard), createdAt: Date.now(), updatedAt: Date.now() };
    savedDecks.push(deck);
    activeDeckId = deck.id;
    saveSavedDecks();
    saveCurrentProgress();
    renderDeckBuilder();
    log('💾 Mazo guardado: ' + deck.name + ' con líder ' + leader.name + '.');
    return;
  }
  openSaveDeckModal();
}

function overwriteActiveDeck() {
  if (!activeDeckId) return saveCurrentDeckAs();
  const deck = savedDecks.find(d => d.id === activeDeckId);
  if (!deck) return saveCurrentDeckAs();
  const validation = validateCustomDeck();
  if (!validation.valid) { alert('⚠️ El mazo no es válido.\n\n' + validation.errors.join('\n')); return; }
  deck.cards = customDeck.map(cloneCard);
  deck.leaderId = (selectedLeader || LEADERS[0]).id;
  deck.updatedAt = Date.now();
  saveSavedDecks();
  saveCurrentProgress();
  renderDeckBuilder();
}

function loadSavedDeck(id) {
  const deck = savedDecks.find(d => d.id === id);
  if (!deck) return;
  customDeck = deck.cards.map(cloneCard);
  activeDeckId = deck.id;
  const leader = getDeckLeader(deck);
  selectedLeader = leader;
  localStorage.setItem('GLTCG_SELECTED_LEADER', leader.id);
  saveCurrentProgress();
  renderDeckBuilder();
}

function duplicateSavedDeck(id) {
  const deck = savedDecks.find(d => d.id === id);
  if (!deck) return;
  const copy = { ...deck, id: 'deck_' + Date.now(), name: deck.name + ' (copia)', cards: deck.cards.map(cloneCard), createdAt: Date.now(), updatedAt: Date.now() };
  savedDecks.push(copy); activeDeckId = copy.id; saveSavedDecks(); renderDeckBuilder();
}

function deleteSavedDeck(id) {
  const deck = savedDecks.find(d => d.id === id);
  if (!deck) return;
  if (!confirm('¿Eliminar el mazo "' + deck.name + '"?')) return;
  savedDecks = savedDecks.filter(d => d.id !== id);
  if (activeDeckId === id) activeDeckId = null;
  saveSavedDecks(); renderDeckBuilder();
}

function useActiveDeck() {
  const validation = validateCustomDeck();
  if (!validation.valid) { alert('⚠️ El mazo no es válido.\n\n' + validation.errors.join('\n')); return; }
  saveCurrentProgress();
  closeDeckBuilder();
}

function saveCollection() {
  localStorage.setItem(COLLECTION_KEY, JSON.stringify(collection));
  localStorage.setItem(PACK_KEY, String(packOpenings));
  const cc = document.getElementById("collectionCount");
  const pc = document.getElementById("packCount");
  if (cc) cc.textContent = Object.values(collection).reduce((a, b) => a + b, 0);
  if (pc) pc.textContent = packOpenings;
  syncAccountProgress();
  saveCurrentProgress();
  if (typeof renderMainMenuState === 'function') renderMainMenuState();
}

function syncAccountProgress() {
  const k = currentUser(), a = getAccounts();
  if (k && a[k]) {
    a[k].collection = collection;
    a[k].packOpenings = Math.max(10, packOpenings);
    saveAccounts(a);
  }
}

function getProgressStore() {
  try { return JSON.parse(localStorage.getItem(PROGRESS_KEY) || "{}"); } catch (e) { return {}; }
}

function saveProgressStore(x) {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(x));
}

function captureProgress() {
  return {
    collection: collection,
    packOpenings: Math.max(10, Number(packOpenings) || 10),
    customDeck: customDeck,
    savedDecks: savedDecks,
    activeDeckId: activeDeckId,
    wins: 0, losses: 0, level: 1,
    savedAt: Date.now()
  };
}

function saveCurrentProgress() {
  const k = currentUser(); if (!k) return;
  const a = getAccounts(), u = a[k]; if (!u) return;
  const old = getProgressStore()[k] || {};
  const now = captureProgress();
  now.wins = Number(old.wins || u.wins || 0);
  now.losses = Number(old.losses || u.losses || 0);
  now.level = Number(old.level || u.level || 1);
  const all = getProgressStore();
  all[k] = now;
  saveProgressStore(all);
}

function loadCurrentProgress() {
  const k = currentUser(); if (!k) return;
  const a = getAccounts(), u = a[k];
  const p = getProgressStore()[k];
  if (p && p.collection) collection = p.collection;
  else if (u && u.collection) collection = u.collection;
  if (p && typeof p.packOpenings !== "undefined") packOpenings = Math.max(10, Number(p.packOpenings) || 10);
  else if (u && typeof u.packOpenings !== "undefined") packOpenings = Math.max(10, Number(u.packOpenings) || 10);
  if (p && Array.isArray(p.customDeck)) customDeck = p.customDeck;
  if (p && Array.isArray(p.savedDecks)) { savedDecks = p.savedDecks; saveSavedDecks(); }
  if (p && p.activeDeckId) activeDeckId = p.activeDeckId;
}

function rarityClass(r) {
  return r === "Ultra Rara" ? "ultra" : r === "Súper Rara" ? "super" : r === "Rara" ? "rare" : "";
}

function rarityWeight() {
  let x = Math.random();
  return x < .05 ? "Ultra Rara" : x < .15 ? "Súper Rara" : x < .40 ? "Rara" : "Común";
}

function boosterCard() {
  let wanted = rarityWeight(), pool = LIBRARY.filter(c => (c.rarity || "Común") === wanted);
  if (!pool.length) pool = LIBRARY;
  return cloneCard(pool[Math.floor(Math.random() * pool.length)]);
}

/* ==========================================================================
   NAVEGACIÓN Y CONTROL DE VISTAS (MODALES Y MENÚ)
   ========================================================================== */
function showGame() {
  const a = document.getElementById("gameApp"), h = document.getElementById("gameHeader");
  if (a) a.style.display = "block";
  if (h) h.style.display = "block";
}

function hideGame() {
  const a = document.getElementById("gameApp"), h = document.getElementById("gameHeader");
  if (a) a.style.display = "none";
  if (h) h.style.display = "none";
}

function renderMainMenuState() {
  const k = currentUser();
  const accounts = getAccounts();
  const user = accounts[k];
  const username = user ? user.username : (k ? k : 'Jugador Local');
  const wins = Number(user ? (user.wins || 0) : 0);
  const losses = Number(user ? (user.losses || 0) : 0);
  const uniqueCards = Object.keys(collection).filter(id => collection[id] > 0).length;

  // 1. Nivel, Rango y Barra de XP
  const totalXP = wins * 150 + losses * 30 + uniqueCards * 10;
  const level = Math.max(1, Math.floor(totalXP / 300) + 1);
  const currentLevelXP = totalXP % 300;
  const xpPct = Math.min(100, Math.round((currentLevelXP / 300) * 100));

  let rankName = 'Novato';
  if (level >= 10) rankName = 'Leyenda 👑';
  else if (level >= 6) rankName = 'Capitán ⚓';
  else if (level >= 3) rankName = 'Bucanero ⚔️';
  else rankName = 'Recluta 🌊';

  setText('menuUserName', username);
  setText('menuUserRankBadge', rankName);
  setText('menuUserLevel', level);
  const xpBar = document.getElementById('menuUserXpBar');
  if (xpBar) xpBar.style.width = xpPct + '%';

  // 2. Contadores y Píldoras
  setText('collectionCount', uniqueCards);
  setText('packCount', packOpenings);
  const readyBadge = document.getElementById('packReadyBadge');
  if (readyBadge) readyBadge.style.display = packOpenings > 0 ? 'inline-block' : 'none';

  // 3. Widget de Líder Activo
  const leader = selectedLeader || LEADERS[0];
  setText('menuLeaderArt', leader.art || '👑');
  setText('menuLeaderName', leader.name);
  setText('menuLeaderLife', leader.life || 5);
  setText('menuLeaderAbility', leader.ability || 'Sin habilidad especial.');

  // Estado del mazo
  const val = typeof validateCustomDeck === 'function' ? validateCustomDeck() : { valid: false };
  const deckBadge = document.getElementById('menuDeckStatusBadge');
  const modDeckBadge = document.getElementById('menuModDeckBadge');
  if (val.valid) {
    if (deckBadge) {
      deckBadge.className = 'deck-status-pill ready';
      deckBadge.textContent = '⚡ Mazo Listo (40/40)';
    }
    if (modDeckBadge) {
      modDeckBadge.className = 'card-badge badge-sapphire';
      modDeckBadge.textContent = '40/40 Válido';
    }
  } else {
    if (deckBadge) {
      deckBadge.className = 'deck-status-pill incomplete';
      deckBadge.textContent = '⚠️ ' + (customDeck ? customDeck.length : 0) + '/40 Cartas';
    }
    if (modDeckBadge) {
      modDeckBadge.className = 'card-badge badge-warning';
      modDeckBadge.textContent = (customDeck ? customDeck.length : 0) + '/40 Cartas';
    }
  }

  // Badges de módulos
  const modPack = document.getElementById('menuModPackBadge');
  if (modPack) {
    modPack.textContent = packOpenings > 0 ? packOpenings + ' Listos' : '0 Sobres';
  }
  const modWins = document.getElementById('menuModWinsBadge');
  if (modWins) {
    modWins.textContent = wins + (wins === 1 ? ' Victoria' : ' Victorias');
  }

  // 4. Tablón de Misiones
  // Misión 1: Batalla
  const totalBattles = wins + losses;
  const bBar = document.getElementById('questBattleBar');
  const bText = document.getElementById('questBattleText');
  if (totalBattles > 0) {
    if (bBar) bBar.style.width = '100%';
    if (bText) bText.textContent = '1 / 1 Completado ✔️';
  } else {
    if (bBar) bBar.style.width = '0%';
    if (bText) bText.textContent = '0 / 1 Partidas';
  }

  // Misión 2: Mazo
  const dBar = document.getElementById('questDeckBar');
  const dText = document.getElementById('questDeckText');
  if (val.valid) {
    if (dBar) dBar.style.width = '100%';
    if (dText) dText.textContent = '1 / 1 Completado ✔️';
  } else {
    const dPct = Math.min(100, Math.round(((customDeck ? customDeck.length : 0) / 40) * 100));
    if (dBar) dBar.style.width = dPct + '%';
    if (dText) dText.textContent = (customDeck ? customDeck.length : 0) + ' / 40 Cartas';
  }

  // Misión 3: Colección
  const cBar = document.getElementById('questColBar');
  const cText = document.getElementById('questColText');
  const colTarget = 10;
  const colCount = Math.min(colTarget, uniqueCards);
  const colPct = Math.min(100, Math.round((colCount / colTarget) * 100));
  if (cBar) cBar.style.width = colPct + '%';
  if (cText) cText.textContent = uniqueCards >= 10 ? uniqueCards + ' Cartas ✔️' : colCount + ' / 10 Cartas';
}
window.renderMainMenuState = renderMainMenuState;

function openMainMenu() {
  saveCollection();
  renderMainMenuState();
  const m = document.getElementById("mainMenu");
  if (m) m.classList.add("open");
}

function closeMainMenu() {
  const m = document.getElementById("mainMenu");
  if (m) m.classList.remove("open");
}

function openLocalMode() {
  closeMainMenu();
  document.getElementById("localModeModal")?.classList.add("open");
}

function closeLocalMode() {
  document.getElementById("localModeModal")?.classList.remove("open");
}

function startLocalAI() {
  localMode = "ai";
  closeLocalMode();
  openLeaderForLocal();
}

function startLocalPVP() {
  localMode = "pvp";
  closeLocalMode();
  openLeaderForLocal();
}

function openLeaderForLocal() {
  const lm = document.getElementById("leaderModal");
  if (lm) {
    renderLeaderChoices(1);
    lm.classList.add("open");
  } else {
    showGame();
    reset();
  }
}

function closeLeaderModal() {
  const lm = document.getElementById("leaderModal");
  if (lm) lm.classList.remove("open");
  openLocalMode();
}

function filterLeadersBySet(setName, btn) {
  currentLeaderFilter = setName;
  document.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderLeaderChoices(1);
}

function renderLeaderChoices(player = 1) {
  const box = document.getElementById('leaderChoices');
  if (!box) return;
  box.innerHTML = '';
  const filter = typeof currentLeaderFilter !== 'undefined' ? currentLeaderFilter : 'ALL';
  const list = LEADERS.filter(l => {
    if (filter === 'ALL') return true;
    const s = l.id.startsWith('A') ? 'AWAKENING' : l.id.startsWith('S') ? 'SHADOWS' : l.id.startsWith('C') ? 'COLLISION' : l.id.startsWith('R') ? 'RABBIT HOLE' : l.id.startsWith('E') ? 'EVOLUTION OF HOLE' : l.id.startsWith('T') ? 'LOS KOREANOS DEL FIN' : 'ORIGINS';
    return s === filter;
  });
  list.forEach(l => {
    const e = document.createElement('div');
    e.className = 'leader-choice';
    const leaderSet = l.id.startsWith('A') ? 'AWAKENING' : l.id.startsWith('S') ? 'SHADOWS' : l.id.startsWith('C') ? 'COLLISION' : l.id.startsWith('R') ? 'RABBIT HOLE' : l.id.startsWith('E') ? 'EVOLUTION OF HOLE' : l.id.startsWith('T') ? 'LOS KOREANOS DEL FIN' : 'ORIGINS';
    e.innerHTML = '<div class="leader-choice-art">' + l.art + '</div>' +
                  '<h2>' + l.name + '</h2>' +
                  '<div class="badge">' + leaderSet + ' · ' + l.color + '</div>' +
                  '<p>❤️ ' + l.life + ' vidas</p>' +
                  '<p>' + l.ability + '</p>' +
                  '<button type="button">👑 Elegir a ' + l.name + '</button>';
    e.querySelector('button').onclick = () => selectLeader(l.id, player);
    box.appendChild(e);
  });
  if (!list.length) {
    box.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:20px; opacity:0.7">No hay líderes en esta categoría.</div>';
  }
}

function selectLeader(id, player = 1) {
  const found = LEADERS.find(l => l.id === id) || LEADERS[0];
  if (player === 2) {
    selectedLeaderP2 = found;
    document.getElementById('leaderModal')?.classList.remove('open');
    showGame();
    reset();
    return;
  }
  selectedLeader = found;
  const others = LEADERS.filter(l => l.id !== found.id);
  if (!(tournamentState.active && tournamentCurrentOpponent)) { aiLeader = others[Math.floor(Math.random() * Math.max(1, others.length))] || LEADERS[0]; }
  localStorage.setItem('GLTCG_SELECTED_LEADER', selectedLeader.id);
  
  if (localMode === 'pvp') {
    selectedLeaderP2 = null;
    const lm = document.getElementById('leaderModal');
    if (lm) {
      const box = document.getElementById('leaderChoices');
      if (box) {
        box.innerHTML = '<h2 style="grid-column:1/-1; text-align:center;">👥 PLAYER 2: ELIGE TU LÍDER</h2>';
      }
      renderLeaderChoices(2);
      lm.classList.add('open');
    }
    return;
  }
  document.getElementById('leaderModal')?.classList.remove('open');
  showGame();
  reset();
}

function startGame() {
  startLocalAI();
}

function confirmExitToMenu() {
  if (!gameOver && (p1Field.length > 0 || turn > 1)) {
    if (confirm("¿Deseas salir al Menú Principal? Se pausará la partida actual.")) {
      openMainMenu();
    }
  } else {
    openMainMenu();
  }
}

/* ==========================================================================
   CONSTRUCTOR DE MAZOS (DECK BUILDER)
   ========================================================================== */
function openDeckBuilderFromMenu() {
  deckBuilderOpenedFrom = 'menu';
  closeMainMenu();
  showGame();
  openDeckBuilder();
  const backBtn = document.getElementById('btnBackFromDeck');
  if (backBtn) backBtn.textContent = '⬅️ Volver al Menú Principal';
}

function openDeckBuilder() {
  if (deckBuilderOpenedFrom !== 'menu') deckBuilderOpenedFrom = 'battle';
  const backBtn = document.getElementById('btnBackFromDeck');
  if (backBtn) {
    backBtn.textContent = (deckBuilderOpenedFrom === 'battle') ? '⬅️ Volver a la Batalla' : '⬅️ Volver al Menú Principal';
  }
  const m = document.getElementById('deckModal');
  if (m) m.classList.add('open');
  renderDeckBuilder();
}

function closeDeckBuilder() {
  const m = document.getElementById("deckModal");
  if (m) m.classList.remove("open");
}

function handleDeckBuilderBack() {
  closeDeckBuilder();
  if (deckBuilderOpenedFrom === 'menu') {
    openMainMenu();
  }
}

/* ==========================================================================
   ESTADO Y FILTROS TÁCTICOS DEL CONSTRUCTOR DE MAZOS
   ========================================================================== */
const deckFilterState = {
  search: '',
  set: 'ALL',
  sort: 'cost-asc',
  type: 'ALL',
  cost: 'ALL'
};

function onDeckSearchInput(val) {
  deckFilterState.search = (val || '').toLowerCase().trim();
  const btnClear = document.getElementById('btnClearSearch');
  if (btnClear) btnClear.style.display = deckFilterState.search ? 'block' : 'none';
  renderDeckLibrary();
}

function clearDeckSearch() {
  const input = document.getElementById('search');
  if (input) input.value = '';
  deckFilterState.search = '';
  const btnClear = document.getElementById('btnClearSearch');
  if (btnClear) btnClear.style.display = 'none';
  renderDeckLibrary();
}

function onDeckSetChange(val) {
  deckFilterState.set = val || 'ALL';
  renderDeckLibrary();
}

function onDeckSortChange(val) {
  deckFilterState.sort = val || 'cost-asc';
  renderDeckLibrary();
}

function setDeckTypeFilter(type, btn) {
  deckFilterState.type = type || 'ALL';
  const group = document.getElementById('deckTypeFilterGroup');
  if (group) {
    group.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
  }
  renderDeckLibrary();
}

function setDeckCostFilter(cost, btn) {
  deckFilterState.cost = cost;
  const group = document.getElementById('deckCostFilterGroup');
  if (group) {
    group.querySelectorAll('.cost-chip').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
  }
  renderDeckLibrary();
}

/* ==========================================================================
   SELECTOR DE LÍDER PARA EL MAZO
   ========================================================================== */
function openDeckLeaderPicker() {
  const modal = document.getElementById('deckLeaderPickerModal');
  const grid = document.getElementById('deckLeaderGrid');
  if (!modal || !grid) return;
  grid.innerHTML = '';
  const currentLeaderId = (selectedLeader || LEADERS[0]).id;
  LEADERS.forEach(l => {
    const isCurrent = l.id === currentLeaderId;
    const card = document.createElement('div');
    card.className = 'leader-choice-card' + (isCurrent ? ' selected' : '');
    card.style.cursor = 'pointer';
    card.innerHTML =
      '<div class="leader-badge-tag">' + (l.color || 'Líder') + ' · ❤️ ' + (l.life || 5) + ' Vida</div>' +
      '<div style="font-size:2.5rem; text-align:center; margin:6px 0;">' + (l.art || '👑') + '</div>' +
      '<div style="font-weight:800; font-size:1rem; color:#fde047; text-align:center; margin-bottom:4px;">' + l.name + '</div>' +
      '<div style="font-size:0.78rem; color:#cbd5e1; line-height:1.3; text-align:center; margin-bottom:8px;">' + (l.ability || 'Sin habilidad especial.') + '</div>' +
      '<button type="button" class="btn-primary-action" style="width:100%; font-size:0.8rem; padding:6px;">' + (isCurrent ? '✓ Líder Asignado' : 'Elegir este Líder') + '</button>';
    card.onclick = () => selectLeaderForCustomDeck(l.id);
    grid.appendChild(card);
  });
  modal.classList.add('open');
}

function closeDeckLeaderPicker() {
  const modal = document.getElementById('deckLeaderPickerModal');
  if (modal) modal.classList.remove('open');
}

function selectLeaderForCustomDeck(leaderId) {
  const found = LEADERS.find(l => l.id === leaderId);
  if (!found) return;
  selectedLeader = found;
  localStorage.setItem('GLTCG_SELECTED_LEADER', found.id);
  if (activeDeckId) {
    const active = savedDecks.find(d => d.id === activeDeckId);
    if (active) {
      active.leaderId = found.id;
      saveSavedDecks();
    }
  }
  saveCurrentProgress();
  closeDeckLeaderPicker();
  renderDeckTray();
  renderSavedDecksList();
  if (typeof renderMainMenuState === 'function') renderMainMenuState();
  log('👑 Líder asignado al mazo: ' + found.name);
}

/* ==========================================================================
   HERRAMIENTAS DE MAZO: VACIAR Y PLANTILLA INICIAL
   ========================================================================== */
function clearCustomDeck() {
  if (customDeck.length === 0) return;
  if (confirm('¿Estás seguro de vaciar todas las cartas del mazo?')) {
    customDeck = [];
    activeDeckId = null;
    saveCurrentProgress();
    renderDeckBuilder();
    log('🗑️ Mazo vaciado.');
  }
}

function loadStarterDeckPreset() {
  if (customDeck.length > 0 && !confirm('¿Cargar el mazo inicial predeterminado? Se reemplazará la selección actual no guardada.')) {
    return;
  }
  const chars = LIBRARY.filter(c => c.type === 'Personaje');
  const events = LIBRARY.filter(c => c.type === 'Evento');
  const resources = LIBRARY.filter(c => c.type === 'Recurso');

  const preset = [];
  function addCopies(card, count) {
    if (!card) return;
    for (let i = 0; i < count; i++) {
      if (preset.length < 40) preset.push(cloneCard(card));
    }
  }

  // Personajes de coste bajo (1-2)
  const lowChars = chars.filter(c => c.cost <= 2);
  if (lowChars.length >= 3) {
    addCopies(lowChars[0], 4);
    addCopies(lowChars[1], 4);
    addCopies(lowChars[2], 4);
  }
  // Personajes de coste medio (3-4)
  const midChars = chars.filter(c => c.cost >= 3 && c.cost <= 4);
  if (midChars.length >= 3) {
    addCopies(midChars[0], 4);
    addCopies(midChars[1], 3);
    addCopies(midChars[2], 3);
  }
  // Personajes jefes (5+)
  const highChars = chars.filter(c => c.cost >= 5);
  if (highChars.length >= 2) {
    addCopies(highChars[0], 2);
    addCopies(highChars[1], 2);
  }
  // Eventos tácticos
  if (events.length >= 3) {
    addCopies(events[0], 4);
    addCopies(events[1], 4);
    if (events[2]) addCopies(events[2], 2);
  }
  // Recursos estratégicos
  if (resources.length >= 1) {
    addCopies(resources[0], Math.min(4, 40 - preset.length));
  }
  if (preset.length < 40 && resources.length >= 2) {
    addCopies(resources[1], Math.min(4, 40 - preset.length));
  }
  // Rellenar hasta 40 respetando máx 4 copias
  if (preset.length < 40) {
    for (const c of LIBRARY) {
      const currentCount = preset.filter(x => x.name === c.name).length;
      const need = Math.min(4 - currentCount, 40 - preset.length);
      if (need > 0) addCopies(c, need);
      if (preset.length >= 40) break;
    }
  }

  customDeck = preset;
  activeDeckId = null;
  saveCurrentProgress();
  renderDeckBuilder();
  log('✨ Mazo Inicial de 40 cartas cargado con éxito.');
}

/* ==========================================================================
   MODAL AUXILIAR DE GUARDADO (SIN PROMPT NATIVO)
   ========================================================================== */
function openSaveDeckModal() {
  const validation = validateCustomDeck();
  if (!validation.valid) {
    alert('⚠️ No puedes guardar este mazo todavía:\n\n' + validation.errors.join('\n'));
    return;
  }
  const modal = document.getElementById('saveDeckModal');
  const input = document.getElementById('saveDeckNameInput');
  if (input) {
    let currentName = 'Mi Mazo Estratégico';
    if (activeDeckId) {
      const active = savedDecks.find(d => d.id === activeDeckId);
      if (active) currentName = active.name;
    }
    input.value = currentName;
  }
  if (modal) modal.classList.add('open');
  if (input) setTimeout(() => input.focus(), 100);
}

function closeSaveDeckModal() {
  const modal = document.getElementById('saveDeckModal');
  if (modal) modal.classList.remove('open');
}

function confirmSaveDeckModal() {
  const input = document.getElementById('saveDeckNameInput');
  const name = (input ? input.value : '').trim();
  if (!name) {
    alert('Por favor escribe un nombre para el mazo.');
    if (input) input.focus();
    return;
  }
  const validation = validateCustomDeck();
  if (!validation.valid) {
    alert('⚠️ El mazo no es válido:\n\n' + validation.errors.join('\n'));
    return;
  }
  const leader = selectedLeader || LEADERS[0];
  const deck = {
    id: 'deck_' + Date.now(),
    name: name.slice(0, 40),
    leaderId: leader.id,
    cards: customDeck.map(cloneCard),
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  savedDecks.push(deck);
  activeDeckId = deck.id;
  saveSavedDecks();
  saveCurrentProgress();
  closeSaveDeckModal();
  renderDeckBuilder();
  log('💾 Mazo guardado: "' + deck.name + '" con líder ' + leader.name + '.');
}

/* ==========================================================================
   MODAL AUXILIAR DE EXPORTACIÓN E IMPORTACIÓN POR CÓDIGO
   ========================================================================== */
function openDeckShareModal() {
  const modal = document.getElementById('deckShareModal');
  const textarea = document.getElementById('deckShareTextarea');
  const msg = document.getElementById('deckShareMsg');
  if (msg) msg.textContent = '';

  const activeDeck = savedDecks.find(d => d.id === activeDeckId);
  const shareData = {
    v: 1,
    name: activeDeck ? activeDeck.name : 'Mazo Personalizado',
    leader: (selectedLeader || LEADERS[0]).id,
    cards: customDeck.map(c => c.id || c.name)
  };

  if (textarea) {
    try {
      textarea.value = btoa(unescape(encodeURIComponent(JSON.stringify(shareData))));
    } catch (e) {
      textarea.value = JSON.stringify(shareData);
    }
  }
  if (modal) modal.classList.add('open');
}

function closeDeckShareModal() {
  const modal = document.getElementById('deckShareModal');
  if (modal) modal.classList.remove('open');
}

function copyDeckCodeToClipboard() {
  const textarea = document.getElementById('deckShareTextarea');
  const msg = document.getElementById('deckShareMsg');
  if (!textarea) return;

  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(textarea.value);
    } else {
      textarea.select();
      document.execCommand('copy');
    }
    if (msg) {
      msg.textContent = '✅ ¡Código copiado al portapapeles!';
      msg.style.color = '#34d399';
    }
  } catch (err) {
    if (msg) {
      msg.textContent = 'ℹ️ Selecciona el texto de arriba y presiona Ctrl+C.';
      msg.style.color = '#fde047';
    }
  }
}

function importDeckFromCode() {
  const textarea = document.getElementById('deckShareTextarea');
  const msg = document.getElementById('deckShareMsg');
  const raw = textarea ? textarea.value.trim() : '';
  if (!raw) {
    if (msg) { msg.textContent = '⚠️ Pega el código de un mazo en el cuadro.'; msg.style.color = '#f87171'; }
    return;
  }
  try {
    let parsed;
    try {
      parsed = JSON.parse(decodeURIComponent(escape(atob(raw))));
    } catch (e) {
      parsed = JSON.parse(raw);
    }
    if (!parsed || !Array.isArray(parsed.cards)) {
      throw new Error('Formato de código inválido');
    }
    const importedCards = [];
    for (const cid of parsed.cards) {
      const found = LIBRARY.find(c => c.id === cid) || LIBRARY.find(c => c.name === cid);
      if (found) {
        importedCards.push(cloneCard(found));
      }
    }
    if (importedCards.length === 0) {
      throw new Error('No se encontraron cartas válidas en el código');
    }
    customDeck = importedCards;
    if (parsed.leader) {
      const l = LEADERS.find(x => x.id === parsed.leader);
      if (l) {
        selectedLeader = l;
        localStorage.setItem('GLTCG_SELECTED_LEADER', l.id);
      }
    }
    activeDeckId = null;
    saveCurrentProgress();
    renderDeckBuilder();
    closeDeckShareModal();
    log('📥 Mazo importado con ' + importedCards.length + ' cartas.');
  } catch (err) {
    if (msg) {
      msg.textContent = '❌ Error al importar: código inválido o incompatible.';
      msg.style.color = '#f87171';
    }
  }
}

/* ==========================================================================
   PANEL Y GESTIÓN DE MAZOS GUARDADOS
   ========================================================================== */
function toggleSavedDecksPanel() {
  const panel = document.getElementById('savedDecksPanel');
  if (!panel) return;
  const isHidden = panel.style.display === 'none' || !panel.style.display;
  panel.style.display = isHidden ? 'block' : 'none';
  if (isHidden) {
    renderSavedDecksList();
  }
}

function renderSavedDecksList() {
  const savedBox = document.getElementById('savedDecksList');
  if (!savedBox) return;
  savedBox.innerHTML = '';
  if (!savedDecks.length) {
    savedBox.innerHTML = '<div class="saved-deck-empty">📭 No tienes mazos guardados todavía. Diseña uno y haz clic en <b>💾 Guardar</b>.</div>';
    return;
  }
  savedDecks.forEach(d => {
    const leader = getDeckLeader(d);
    const item = document.createElement('div');
    item.className = 'saved-deck-item' + (d.id === activeDeckId ? ' active' : '');
    item.innerHTML =
      '<div class="saved-deck-meta">' +
        '<b>🃏 ' + d.name.replace(/</g, '&lt;') + '</b>' +
        '<small>👑 ' + leader.name.replace(/</g, '&lt;') + ' · ' + d.cards.length + '/40 cartas</small>' +
      '</div>' +
      '<div class="saved-deck-actions">' +
        '<button type="button" class="small btn-primary-action" title="Cargar y usar en batalla">▶️ Usar</button>' +
        '<button type="button" class="small" title="Cargar en el constructor">✏️ Cargar</button>' +
        '<button type="button" class="small" title="Duplicar mazo">📋</button>' +
        '<button type="button" class="small btn-danger" title="Eliminar mazo">🗑️</button>' +
      '</div>';
    const bs = item.querySelectorAll('button');
    bs[0].onclick = () => { loadSavedDeck(d.id); useActiveDeck(); };
    bs[1].onclick = () => loadSavedDeck(d.id);
    bs[2].onclick = () => duplicateSavedDeck(d.id);
    bs[3].onclick = () => deleteSavedDeck(d.id);
    savedBox.appendChild(item);
  });
}

/* ==========================================================================
   RENDERIZADORES VISUALES DEL CONSTRUCTOR DE MAZOS
   ========================================================================== */
function renderDeckCostCurve() {
  const curveEl = document.getElementById('deckCostCurve');
  if (!curveEl) return;
  curveEl.innerHTML = '';

  const buckets = [
    { label: '1', count: 0, test: c => c.cost <= 1 },
    { label: '2', count: 0, test: c => c.cost === 2 },
    { label: '3', count: 0, test: c => c.cost === 3 },
    { label: '4', count: 0, test: c => c.cost === 4 },
    { label: '5', count: 0, test: c => c.cost === 5 },
    { label: '6+', count: 0, test: c => c.cost >= 6 }
  ];

  customDeck.forEach(c => {
    for (const b of buckets) {
      if (b.test(c)) {
        b.count++;
        break;
      }
    }
  });

  const maxCount = Math.max(1, ...buckets.map(b => b.count));

  buckets.forEach(b => {
    const col = document.createElement('div');
    col.className = 'cost-curve-col';
    const heightPercent = b.count > 0 ? Math.max(12, Math.round((b.count / maxCount) * 100)) : 4;
    col.innerHTML =
      '<span class="cost-curve-val">' + b.count + '</span>' +
      '<div class="cost-curve-bar" style="height:' + heightPercent + '%;"></div>' +
      '<span class="cost-curve-lbl">' + b.label + '</span>';
    curveEl.appendChild(col);
  });
}

function removeOneCardFromCustomDeck(cardName) {
  const ix = customDeck.findIndex(x => x.name === cardName);
  if (ix >= 0) {
    customDeck.splice(ix, 1);
    saveCurrentProgress();
    renderDeckBuilder();
  }
}

function renderDeckCardsList() {
  const listEl = document.getElementById('deckCardsList');
  const uniqueCountEl = document.getElementById('deckUniqueCount');
  if (!listEl) return;
  listEl.innerHTML = '';

  const map = new Map();
  customDeck.forEach(c => {
    if (!map.has(c.name)) {
      map.set(c.name, { card: c, count: 0 });
    }
    map.get(c.name).count++;
  });

  if (uniqueCountEl) uniqueCountEl.textContent = map.size;

  if (map.size === 0) {
    listEl.innerHTML = '<div class="saved-deck-empty" style="text-align:center; padding:18px 8px; color:#64748b; font-size:0.8rem;">📭 Tu baraja está vacía.<br>Añade cartas desde el catálogo.</div>';
    return;
  }

  const grouped = Array.from(map.values()).sort((a, b) => {
    if (a.card.cost !== b.card.cost) return a.card.cost - b.card.cost;
    return a.card.name.localeCompare(b.card.name);
  });

  grouped.forEach(({ card, count }) => {
    const row = document.createElement('div');
    row.className = 'deck-card-row';
    row.title = card.name + ' (Coste ' + card.cost + ') - Clic para quitar una copia';
    row.innerHTML =
      '<span class="row-cost">' + card.cost + '</span>' +
      '<span class="row-art">' + (card.art || '🃏') + '</span>' +
      '<span class="row-name">' + card.name + '</span>' +
      '<span class="row-count">' + count + 'x</span>' +
      '<button type="button" class="row-remove-btn" title="Quitar 1 copia">✕</button>';
    row.onclick = () => removeOneCardFromCustomDeck(card.name);
    listEl.appendChild(row);
  });
}

function renderDeckTray() {
  const leaderCardEl = document.getElementById('deckCurrentLeaderCard');
  if (leaderCardEl) {
    const leader = selectedLeader || LEADERS[0];
    leaderCardEl.innerHTML =
      '<div class="leader-current-art">' + (leader.art || '👑') + '</div>' +
      '<div class="leader-current-info">' +
        '<div class="leader-current-name">' + leader.name + '</div>' +
        '<div class="leader-current-traits">' + (leader.color || 'Líder') + ' · ❤️ ' + (leader.life || 5) + ' Vida</div>' +
        '<div class="leader-current-desc">' + (leader.ability || 'Sin habilidad especial.') + '</div>' +
      '</div>';
  }

  const dc = document.getElementById("deckCount");
  if (dc) dc.textContent = customDeck.length;

  const badge = document.getElementById("deckCounterBadge");
  if (badge) {
    badge.innerHTML = '<b id="deckCount">' + customDeck.length + '</b> / 40';
    if (customDeck.length === 40) {
      badge.style.color = '#34d399';
    } else if (customDeck.length > 40) {
      badge.style.color = '#f87171';
    } else {
      badge.style.color = '#fde047';
    }
  }

  const fill = document.getElementById("deckProgressFill");
  if (fill) {
    const pct = Math.min(100, Math.round((customDeck.length / 40) * 100));
    fill.style.width = pct + '%';
    if (customDeck.length === 40) {
      fill.classList.add('full');
    } else {
      fill.classList.remove('full');
    }
  }

  const deckValidation = validateCustomDeck();
  const validationMessage = document.getElementById('deckValidationMessage');
  if (validationMessage) {
    if (customDeck.length === 0) {
      validationMessage.textContent = 'Mazo predeterminado disponible.';
      validationMessage.className = 'deck-validation valid';
    } else if (deckValidation.valid) {
      validationMessage.textContent = '✓ Mazo válido: 40 cartas listas para jugar.';
      validationMessage.className = 'deck-validation valid';
    } else {
      validationMessage.textContent = '⚠️ ' + (deckValidation.errors[0] || 'Mazo incompleto');
      validationMessage.className = 'deck-validation invalid';
    }
  }

  let charsCount = 0, eventsCount = 0, resourcesCount = 0;
  customDeck.forEach(c => {
    if (c.type === 'Personaje') charsCount++;
    else if (c.type === 'Evento') eventsCount++;
    else if (c.type === 'Recurso') resourcesCount++;
  });
  const elChars = document.getElementById('deckCharsCount');
  const elEvents = document.getElementById('deckEventsCount');
  const elResources = document.getElementById('deckResourcesCount');
  if (elChars) elChars.textContent = charsCount;
  if (elEvents) elEvents.textContent = eventsCount;
  if (elResources) elResources.textContent = resourcesCount;

  const savedBadge = document.getElementById('savedDecksCountBadge');
  if (savedBadge) savedBadge.textContent = savedDecks.length;
}

function renderDeckLibrary() {
  const g = document.getElementById("deckGrid");
  if (!g) return;
  g.innerHTML = "";

  const q = deckFilterState.search;
  const sv = deckFilterState.set;
  const tv = deckFilterState.type;
  const cv = deckFilterState.cost;

  let filtered = LIBRARY.filter(c => {
    if (q) {
      const matchName = c.name && c.name.toLowerCase().includes(q);
      const matchAbility = c.ability && c.ability.toLowerCase().includes(q);
      const matchType = c.type && c.type.toLowerCase().includes(q);
      const matchTraits = Array.isArray(c.traits) && c.traits.some(t => t.toLowerCase().includes(q));
      if (!matchName && !matchAbility && !matchType && !matchTraits) return false;
    }
    if (sv !== 'ALL' && setOfCard(c) !== sv) return false;
    if (tv !== 'ALL' && c.type !== tv) return false;
    if (cv !== 'ALL') {
      if (cv === 6) {
        if (c.cost < 6) return false;
      } else {
        if (c.cost !== cv) return false;
      }
    }
    return true;
  });

  const rarityRank = { 'Común': 1, 'Rara': 2, 'Súper Rara': 3, 'Ultra Rara': 4, 'Legendaria': 5 };
  filtered.sort((a, b) => {
    switch (deckFilterState.sort) {
      case 'cost-asc':
        return a.cost - b.cost || a.name.localeCompare(b.name);
      case 'cost-desc':
        return b.cost - a.cost || a.name.localeCompare(b.name);
      case 'power-desc':
        return (b.power || 0) - (a.power || 0) || a.cost - b.cost;
      case 'name-asc':
        return a.name.localeCompare(b.name);
      case 'rarity-desc':
        return (rarityRank[b.rarity] || 0) - (rarityRank[a.rarity] || 0) || a.cost - b.cost;
      default:
        return a.cost - b.cost;
    }
  });

  const countEl = document.getElementById('libraryFilteredCount');
  if (countEl) countEl.textContent = filtered.length;

  if (filtered.length === 0) {
    g.innerHTML = '<div class="saved-deck-empty" style="grid-column: 1/-1; text-align:center; padding: 40px 10px; color:#94a3b8;">🔍 No se encontraron cartas con los filtros seleccionados.<br><button type="button" class="btn-primary-action" style="margin-top:12px;" onclick="clearDeckSearch();onDeckSetChange(\'ALL\');setDeckTypeFilter(\'ALL\');setDeckCostFilter(\'ALL\');">Limpiar Filtros</button></div>';
    return;
  }

  filtered.forEach(c => {
    const count = customDeck.filter(x => x.name === c.name).length;
    const typeClass = c.type === 'Personaje' ? 'type-personaje' : c.type === 'Evento' ? 'type-evento' : 'type-recurso';
    const typeIcon = c.type === 'Personaje' ? '⚔️' : c.type === 'Evento' ? '📜' : '💎';
    const tile = document.createElement("div");
    tile.className = "deck-card-tile " + typeClass + (count > 0 ? " in-deck" : "");
    const cannotAdd = count >= 4 || customDeck.length >= 40;

    tile.innerHTML =
      '<div class="tile-top-row">' +
        '<span class="tile-cost-badge">⚡ ' + c.cost + '</span>' +
        '<span class="tile-type-badge ' + typeClass + '">' + typeIcon + ' ' + c.type + '</span>' +
      '</div>' +
      '<div class="tile-art">' + (c.art || '🃏') + '</div>' +
      '<div class="tile-name" title="' + c.name + '">' + c.name + '</div>' +
      (c.type === 'Personaje' ? '<div class="tile-power">💥 ' + c.power + ' PODER</div>' : '') +
      '<div class="tile-ability">' + (c.ability || 'Sin efecto especial.') + '</div>' +
      '<div class="tile-footer">' +
        '<span class="tile-rarity">⭐ ' + (c.rarity || 'Común') + '</span>' +
        '<span class="tile-copies-badge ' + (count >= 4 ? 'max' : '') + '">' + count + ' / 4 copias</span>' +
      '</div>' +
      '<div class="tile-actions">' +
        '<button type="button" class="btn-tile-add" ' + (cannotAdd ? 'disabled' : '') + '>＋ Añadir</button>' +
        '<button type="button" class="btn-tile-remove" ' + (count <= 0 ? 'disabled' : '') + '>－ Quitar</button>' +
      '</div>';

    const btns = tile.querySelectorAll("button");
    btns[0].onclick = (e) => {
      e.stopPropagation();
      if (customDeck.length < 40 && count < 4) {
        customDeck.push(cloneCard(c));
        saveCurrentProgress();
        renderDeckBuilder();
      }
    };
    btns[1].onclick = (e) => {
      e.stopPropagation();
      const ix = customDeck.findIndex(x => x.name === c.name);
      if (ix >= 0) {
        customDeck.splice(ix, 1);
        saveCurrentProgress();
        renderDeckBuilder();
      }
    };

    g.appendChild(tile);
  });
}

function renderDeckBuilder() {
  renderDeckLibrary();
  renderDeckTray();
  renderDeckCostCurve();
  renderDeckCardsList();
  renderSavedDecksList();
}

/* ==========================================================================
   CATÁLOGO DE SETS Y APERTURA DE SOBRES
   ========================================================================== */
let setsFilterState = {
  set: 'ALL',
  type: 'ALL',
  search: ''
};

function openSets() {
  closeMainMenu();
  const modal = document.getElementById('setsModal');
  if (!modal) return;
  modal.classList.add('open');
  renderSetsCatalog();
}

function closeSets() {
  document.getElementById('setsModal')?.classList.remove('open');
  openMainMenu();
}

function filterSetsBySet(setName, btn) {
  setsFilterState.set = setName;
  const container = document.getElementById('setsExpansionTabs');
  if (container) {
    container.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
  }
  if (btn) btn.classList.add('active');
  renderSetsCatalog();
}

function filterSetsByType(typeName, btn) {
  setsFilterState.type = typeName;
  const container = document.getElementById('setsTypeFilterGroup');
  if (container) {
    container.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
  }
  if (btn) btn.classList.add('active');
  renderSetsCatalog();
}

function onSetsSearch(val) {
  setsFilterState.search = val || '';
  const btnClear = document.getElementById('btnClearSetsSearch');
  if (btnClear) {
    btnClear.style.display = setsFilterState.search ? 'block' : 'none';
  }
  renderSetsCatalog();
}

function clearSetsSearch() {
  const input = document.getElementById('setsSearchInput');
  if (input) input.value = '';
  onSetsSearch('');
}

function renderSetsCatalog() {
  const grid = document.getElementById('setsGrid');
  const countEl = document.getElementById('setsTotalCount');
  if (!grid) return;
  grid.innerHTML = '';

  const catalog = (GLTCG && GLTCG.SETS) ? GLTCG.SETS : {};
  const q = (setsFilterState.search || '').trim().toLowerCase();
  const targetSet = setsFilterState.set;
  const targetType = setsFilterState.type;

  let allItems = [];

  Object.values(catalog).forEach(setData => {
    if (targetSet !== 'ALL' && setData.id !== targetSet) return;

    // Leaders
    if (Array.isArray(setData.leaders)) {
      setData.leaders.forEach(ldr => {
        allItems.push({
          ...ldr,
          type: 'Líder',
          setId: setData.id,
          setName: setData.name
        });
      });
    }

    // Cards
    if (Array.isArray(setData.cards)) {
      setData.cards.forEach(c => {
        allItems.push({
          ...c,
          setId: setData.id,
          setName: setData.name
        });
      });
    }
  });

  // Filter by search & type
  let filtered = allItems.filter(item => {
    if (targetType !== 'ALL' && item.type !== targetType) return false;
    if (q) {
      const matchName = item.name && item.name.toLowerCase().includes(q);
      const matchAbility = item.ability && item.ability.toLowerCase().includes(q);
      const matchTraits = Array.isArray(item.traits) && item.traits.some(t => t.toLowerCase().includes(q));
      const matchId = item.id && item.id.toLowerCase().includes(q);
      if (!matchName && !matchAbility && !matchTraits && !matchId) return false;
    }
    return true;
  });

  if (countEl) countEl.textContent = filtered.length;

  if (filtered.length === 0) {
    grid.innerHTML = '<div class="saved-deck-empty" style="grid-column: 1/-1; text-align:center; padding: 40px 10px; color:#94a3b8;">🔍 No se encontraron cartas o líderes con los filtros seleccionados.<br><button type="button" class="btn-primary-action" style="margin-top:12px; max-width:240px;" onclick="clearSetsSearch();filterSetsBySet(\'ALL\');filterSetsByType(\'ALL\');">Restablecer Filtros</button></div>';
    return;
  }

  filtered.forEach(item => {
    const isLeader = item.type === 'Líder';
    const cardEl = document.createElement('div');
    const typeClass = isLeader ? 'type-lider' : (item.type === 'Personaje' ? 'type-personaje' : (item.type === 'Evento' ? 'type-evento' : 'type-recurso'));
    cardEl.className = 'catalog-card-tile ' + typeClass;

    const typeIcon = isLeader ? '👑' : (item.type === 'Personaje' ? '⚔️' : (item.type === 'Evento' ? '📜' : '💎'));
    const topStat = isLeader ? ('<span class="tile-life-badge" title="Vida del Líder">❤️ ' + (item.life || 5) + '</span>') : ('<span class="tile-cost-badge" title="Coste de DON">⚡ ' + (item.cost || 0) + '</span>');
    const powerStat = isLeader ? ('<div class="tile-power tile-power-leader">💥 5000 PODER BASE</div>') : (item.type === 'Personaje' ? ('<div class="tile-power">💥 ' + (item.power || 0) + ' PODER</div>') : '');
    const metaRarity = isLeader ? ('<span class="tile-rarity">👑 ' + (item.color || 'Líder') + '</span>') : ('<span class="tile-rarity">⭐ ' + (item.rarity || 'Común') + '</span>');

    cardEl.innerHTML =
      '<div class="tile-top-row">' +
        topStat +
        '<span class="tile-type-badge ' + typeClass + '">' + typeIcon + ' ' + item.type + '</span>' +
        '<span class="tile-set-code">' + (item.id || '') + '</span>' +
      '</div>' +
      '<div class="tile-art">' + (item.art || '🃏') + '</div>' +
      '<div class="tile-name" title="' + item.name + '">' + item.name + '</div>' +
      powerStat +
      '<div class="tile-ability">' + (item.ability || 'Sin efecto especial.') + '</div>' +
      '<div class="tile-footer">' +
        metaRarity +
        '<span class="tile-set-name" title="' + item.setName + '">' + item.setId + '</span>' +
      '</div>';

    grid.appendChild(cardEl);
  });
}

function setOfCard(c) {
  if (c && c.id) {
    if (c.id.startsWith('A')) return 'AWAKENING';
    if (c.id.startsWith('S')) return 'SHADOWS';
    if (c.id.startsWith('R')) return 'RABBIT_HOLE';
    if (c.id.startsWith('E')) return 'EVOLUTION_OF_HOLE';
    if (c.id.startsWith('T')) return 'LOS_KOREANOS_DEL_FIN';
    if (c.id.startsWith('C')) {
      const num = parseInt(c.id.slice(1), 10);
      if (!isNaN(num) && num >= 41) return 'COLLISION';
      return 'ORIGINS';
    }
  }
  return 'ORIGINS';
}

function openPack() {
  saveCollection();
  if (document.getElementById("packResult")) document.getElementById("packResult").innerHTML = "";
  document.getElementById("packModal")?.classList.add("open");
  updatePackButton();
}

function closePack() {
  document.getElementById("packModal")?.classList.remove("open");
}

function updatePackButton() {
  const b = document.getElementById("openPackBtn");
  if (!b) return;
  b.textContent = packOpenings > 0 ? "✨ ABRIR SOBRE" : "🔒 SIN APERTURAS";
  b.disabled = packOpenings <= 0;
}

function openBooster() {
  if (packOpenings <= 0) {
    log("🔒 No tienes aperturas de sobres disponibles. Gana una partida para conseguir 10.");
    updatePackButton();
    return;
  }
  packOpenings--;
  let cards = Array.from({ length: 5 }, boosterCard), box = document.getElementById("packResult");
  if (box) box.innerHTML = "";
  cards.forEach(c => {
    collection[c.name] = (collection[c.name] || 0) + 1;
    let e = document.createElement("div");
    e.className = "card packcard " + rarityClass(c.rarity);
    e.innerHTML = "<div class='art'>" + (c.art || '🃏') + "</div><h3>" + c.name + "</h3><div>⚡ " + c.cost + " · 💥 " + c.power + "</div><div class='rarity'>✨ " + c.rarity + "</div><div class='ability'>" + (c.ability || '') + "</div>";
    if (box) box.appendChild(e);
  });
  saveCollection();
  updatePackButton();
  log("🎁 Abriste 1 sobre. Te quedan " + packOpenings + " aperturas.");
}

/* ==========================================================================
   CENTRO INFORMATIVO Y PERFIL PRE-BATALLA (SISTEMA DE PESTAÑAS)
   ========================================================================== */
function openPlayerHub(tab = 'profile') {
  const modal = document.getElementById('playerHubModal');
  if (modal) {
    modal.classList.add('open');
    switchHubTab(tab);
    renderHubProfile();
    setTimeout(() => modal.querySelector('button, input, select')?.focus(), 0);
  }
}

function closePlayerHub() {
  const modal = document.getElementById('playerHubModal');
  if (modal) modal.classList.remove('open');
}

function switchHubTab(tabName) {
  const tabs = ['profile', 'account', 'online', 'tactics'];
  tabs.forEach(t => {
    const btn = document.getElementById('hubTabBtn' + t.charAt(0).toUpperCase() + t.slice(1));
    const panel = document.getElementById('hubPanel' + t.charAt(0).toUpperCase() + t.slice(1));
    if (btn) btn.classList.toggle('active', t === tabName);
    if (panel) {
      if (t === tabName) {
        panel.style.display = 'block';
        panel.classList.add('active');
      } else {
        panel.style.display = 'none';
        panel.classList.remove('active');
      }
    }
  });

  const pMsg = document.getElementById('hubProfileMsg');
  const aMsg = document.getElementById('hubAccountMsg');
  const oMsg = document.getElementById('hubOnlineMsg');
  if (pMsg) pMsg.textContent = '';
  if (aMsg) aMsg.textContent = '';
  if (oMsg) oMsg.textContent = '';

  if (tabName === 'profile') {
    renderHubProfile();
  }
}

function renderHubProfile() {
  const k = currentUser();
  const accounts = getAccounts();
  const user = accounts[k];
  const username = user ? user.username : (k ? k : 'Jugador Local');

  setText('menuUserName', username);
  setText('hubProfileUsername', '🏴‍☠️ ' + username);
  
  const wins = user ? (user.wins || 0) : 0;
  const losses = user ? (user.losses || 0) : 0;
  const level = user ? (user.level || 1) : 1;
  const totalCards = Object.values(collection).reduce((a, b) => a + b, 0);

  setText('hubStatWins', wins);
  setText('hubStatLosses', losses);
  setText('hubStatLevel', level);
  setText('hubStatCollection', totalCards);
  setText('hubStatPacks', packOpenings);

  const logoutBtn = document.getElementById('hubLogoutBtn');
  if (logoutBtn) {
    logoutBtn.style.display = user ? 'inline-flex' : 'none';
  }
}

function showHubAccountMode(mode) {
  const loginBox = document.getElementById('hubLoginBox');
  const registerBox = document.getElementById('hubRegisterBox');
  const loginTab = document.getElementById('hubLoginSubTab');
  const registerTab = document.getElementById('hubRegisterSubTab');

  if (loginBox) loginBox.style.display = mode === 'login' ? 'block' : 'none';
  if (registerBox) registerBox.style.display = mode === 'register' ? 'block' : 'none';
  if (loginTab) loginTab.classList.toggle('active', mode === 'login');
  if (registerTab) registerTab.classList.toggle('active', mode === 'register');
  
  const msg = document.getElementById('hubAccountMsg');
  if (msg) msg.textContent = '';
}

async function submitHubLogin() {
  const userEl = document.getElementById('hubLoginUser');
  const passEl = document.getElementById('hubLoginPass');
  const u = (userEl ? userEl.value : '').trim();
  const p = passEl ? passEl.value : '';
  const msg = document.getElementById('hubAccountMsg');

  if (!u || !p) {
    if (msg) msg.textContent = '⚠️ Por favor ingresa tu usuario y contraseña.';
    return;
  }

  const a = getAccounts();
  const k = u.toLowerCase();
  if (!a[k] || !await verifyLocalPassword(a[k], p)) {
    if (msg) msg.textContent = '⚠️ Usuario o contraseña incorrectos.';
    return;
  }

  if (a[k].password && !a[k].passwordHash) {
    a[k].passwordHash = await hashLocalPassword(p);
    delete a[k].password;
    saveAccounts(a);
  }

  localStorage.setItem(SESSION_KEY, k);
  collection = a[k].collection || {};
  packOpenings = Math.max(10, Number(a[k].packOpenings) || 10);
  loadCurrentProgress();
  saveCollection();

  if (msg) msg.textContent = '✅ ¡Bienvenido de nuevo, ' + u + '!';
  setTimeout(() => { switchHubTab('profile'); }, 400);
}

async function submitHubRegister() {
  const userEl = document.getElementById('hubRegisterUser');
  const passEl = document.getElementById('hubRegisterPass');
  const pass2El = document.getElementById('hubRegisterPass2');
  const u = (userEl ? userEl.value : '').trim();
  const p = passEl ? passEl.value : '';
  const p2 = pass2El ? pass2El.value : '';
  const msg = document.getElementById('hubAccountMsg');

  if (u.length < 3) {
    if (msg) msg.textContent = '⚠️ El usuario debe tener al menos 3 caracteres.';
    return;
  }
  if (!/^[a-zA-Z0-9_]+$/.test(u)) {
    if (msg) msg.textContent = '⚠️ Usa solo letras, números y guión bajo (_).';
    return;
  }
  if (p.length < 4) {
    if (msg) msg.textContent = '⚠️ La contraseña debe tener al menos 4 caracteres.';
    return;
  }
  if (p !== p2) {
    if (msg) msg.textContent = '⚠️ Las contraseñas no coinciden.';
    return;
  }

  const a = getAccounts();
  const k = u.toLowerCase();
  if (a[k]) {
    if (msg) msg.textContent = '⚠️ Ese nombre de usuario ya está registrado.';
    return;
  }

  a[k] = { username: u, passwordHash: await hashLocalPassword(p), wins: 0, losses: 0, level: 1, collection: {}, packOpenings: 10 };
  saveAccounts(a);
  localStorage.setItem(SESSION_KEY, k);
  collection = a[k].collection;
  packOpenings = 10;
  loadCurrentProgress();
  saveCollection();

  if (msg) msg.textContent = '✅ ¡Cuenta creada exitosamente! Has recibido 10 sobres de bienvenida.';
  setTimeout(() => { switchHubTab('profile'); }, 600);
}

function saveHubProfile() {
  syncAccountProgress();
  saveCollection();
  const msg = document.getElementById('hubProfileMsg');
  if (msg) msg.textContent = '💾 ¡Progreso, colección y sobres guardados con éxito!';
  setTimeout(() => { if (msg) msg.textContent = ''; }, 3000);
}

function logoutAccount() {
  localStorage.removeItem(SESSION_KEY);
  renderHubProfile();
  const msg = document.getElementById('hubProfileMsg');
  if (msg) msg.textContent = '🚪 Sesión cerrada.';
  setTimeout(() => { if (msg) msg.textContent = ''; }, 2000);
}

function saveHubServerUrl() {
  const input = document.getElementById('hubServerUrl');
  const msg = document.getElementById('hubOnlineMsg');
  if (input) {
    localStorage.setItem('GLTCG_SERVER_URL', input.value.trim());
    if (msg) msg.textContent = '💾 Servidor guardado: ' + input.value.trim();
  }
}

let hubCurrentRoomCode = '';
function createHubRoom() {
  const code = 'GL-' + Math.floor(1000 + Math.random() * 9000);
  hubCurrentRoomCode = code;
  const display = document.getElementById('hubOnlineRoomDisplay');
  const codeEl = document.getElementById('hubRoomCode');
  const statusEl = document.getElementById('hubRoomStatus');
  const startBtn = document.getElementById('hubOnlineStartBtn');

  if (codeEl) codeEl.textContent = code;
  if (statusEl) statusEl.textContent = '🟡 Sala creada. Esperando conexión del segundo jugador...';
  if (display) display.style.display = 'block';
  if (startBtn) startBtn.disabled = false;
}

function joinHubRoom() {
  const input = document.getElementById('hubJoinCode');
  const code = (input ? input.value : '').trim().toUpperCase();
  const msg = document.getElementById('hubOnlineMsg');
  if (!code || code.length < 4) {
    if (msg) msg.textContent = '⚠️ Por favor ingresa un código de sala válido.';
    return;
  }
  if (msg) msg.textContent = '🔗 Conectando a la sala ' + code + '...';
  setTimeout(() => {
    if (msg) msg.textContent = '✅ Conectado a la sala ' + code + '. Preparando combate.';
    setTimeout(() => {
      closePlayerHub();
      startLocalPVP();
    }, 800);
  }, 600);
}

function copyHubRoomCode() {
  if (!hubCurrentRoomCode) return;
  navigator.clipboard.writeText(hubCurrentRoomCode).then(() => {
    const statusEl = document.getElementById('hubRoomStatus');
    if (statusEl) statusEl.textContent = '📋 ¡Código copiado al portapapeles!';
  }).catch(() => {});
}

function startHubOnlineMatch() {
  closePlayerHub();
  startLocalPVP();
}

function openProfile() { openPlayerHub('profile'); }
function closeProfile() { closePlayerHub(); }
function openAccount() { openPlayerHub('account'); }
function closeAccount() { closePlayerHub(); }
function openOnline() { openPlayerHub('online'); }
function closeOnline() { closePlayerHub(); }
function openTutorial() { openPlayerHub('tactics'); }
function closeTutorial() { closePlayerHub(); }
function skipTutorial() { closePlayerHub(); }
function tutorialNext() { closePlayerHub(); startGame(); }

/* ==========================================================================
   LÓGICA DEL MOTOR DE BATALLA Y COMBATE JUSTO
   ========================================================================== */
function makeDeck() {
  const customDeckValidation = customDeck.length ? validateCustomDeck() : { valid: true };
  let source = customDeck.length && customDeckValidation.valid ? customDeck : LIBRARY;
  if (customDeck.length && !customDeckValidation.valid) log('⚠️ Tu mazo personalizado no es válido. Se usará el mazo predeterminado.');
  const d = [];
  if (source === customDeck) {
    source.forEach(c => d.push(cloneCard(c)));
    while (d.length < 40) d.push(cloneCard(LIBRARY[d.length % LIBRARY.length]));
    return shuffle(d.slice(0, 40));
  }
  return makeAIDeck();
}

function makeAIDeck() {
  const chars = LIBRARY.filter(c => c.type === 'Personaje' && !c.onlyEvolution);
  const events = LIBRARY.filter(c => c.type === 'Evento' && !c.onlyEvolution);
  const resources = LIBRARY.filter(c => c.type === 'Recurso' && !c.onlyEvolution);
  const d=[];
  const addPool=(pool,n)=>{
    for(let i=0;i<n;i++){
      const c=pool[Math.floor(Math.random()*pool.length)];
      d.push(cloneCard(c));
    }
  };
  addPool(chars,26); addPool(events,10); addPool(resources,4);
  // Limitar copias a 4 sin convertir el mazo en una colección de recursos.
  const counts={};
  for(let i=d.length-1;i>=0;i--){
    const id=d[i].id; counts[id]=(counts[id]||0)+1;
    if(counts[id]>4){
      const replacement=chars.concat(events).find(c=>(counts[c.id]||0)<4);
      if(replacement){ d[i]=cloneCard(replacement); counts[replacement.id]=(counts[replacement.id]||0)+1; }
    }
  }
  return shuffle(d.slice(0,40));
}

function makeDonDeck() {
  return shuffle(Array.from({ length: 20 }, (_, i) => ({ id: i + 1, name: "DON!", type: "DON" })));
}

function log(t) {
  emitBattleEvent('LOG', { message: String(t) });
  const x = document.getElementById("log");
  if (x) {
    const entry = document.createElement('div');
    entry.textContent = '• ' + t;
    x.prepend(entry);
  }
  arenaLog(t);
}

function arenaLog(t) {
  const x = document.getElementById("arenaLog");
  if (x) {
    const d = document.createElement("div");
    d.textContent = "• " + t;
    x.prepend(d);
  }
}

function setAIRealtime(t) {
  const x = document.getElementById("aiRealtime");
  if (x) {
    x.textContent = '🤖 ' + t;
    x.className = 'center ai-thinking';
  }
}

function clearAIRealtime() {
  const x = document.getElementById("aiRealtime");
  if (x) x.innerHTML = "";
}

function flashAttack() {
  const a = document.getElementById("battleArena");
  if (!a) return;
  const l = document.createElement("div");
  l.style.cssText = "position:absolute;left:25%;right:25%;top:50%;height:4px;background:#ffd65d;box-shadow:0 0 16px #ffd65d;z-index:5";
  a.appendChild(l);
  setTimeout(() => l.remove(), 500);
}

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function canPlay() {
  return !gameOver && !aiBusy && (localMode === "pvp" || active === 1);
}

function drawP1() {
  if (p1Deck.length) hand.push(p1Deck.pop());
}

function drawP2() {
  if (p2Deck.length) aiHand.push(p2Deck.pop());
}

/* ==========================================================================
   SET 07 — CANTO INFERNAL
   Par  -> el jugador roba 1 carta aleatoria de la mano rival.
   Impar -> el rival roba 1 carta aleatoria de la mano del jugador.
   El modificador +1 afecta solo al siguiente Canto de ese jugador.
   ========================================================================== */
function randomIndex(length) {
  return length > 0 ? Math.floor(Math.random() * length) : -1;
}

function stealRandomHandCard(thief, victim) {
  const thiefHand = thief === 1 ? hand : aiHand;
  const victimHand = victim === 1 ? hand : aiHand;
  if (!victimHand.length) return null;
  const index = randomIndex(victimHand.length);
  if (index < 0) return null;
  const card = victimHand.splice(index, 1)[0];
  thiefHand.push(card);

  // Set 07 — cartas que reaccionan al robo del rival.
  const thiefField = thief === 1 ? p1Field : p2Field;
  thiefField.forEach(unit => {
    if (unit && unit.onOpponentSteal === 'draw2') {
      if (thief === 1) { drawP1(); drawP1(); }
      else { drawP2(); drawP2(); }
      log('🪞 ' + unit.name + ': robaste una carta, así que robas 2 más.');
    }
  });

  return card;
}

function resolveCantoRoll(player, options = {}) {
  const modifier = player === 1 ? cantoModifierP1 : cantoModifierP2;
  const rawRoll = Math.floor(Math.random() * 6) + 1;
  const roll = Math.min(6, Math.max(1, rawRoll + modifier));

  if (player === 1) cantoModifierP1 = 0;
  else cantoModifierP2 = 0;

  const ownHand = player === 1 ? hand : aiHand;
  const enemyHand = player === 1 ? aiHand : hand;
  const forceSteal = !!options.forceSteal;
  const even = roll % 2 === 0;
  let stolen = null;

  log('🎤 Canto Infernal: salió ' + roll + (modifier ? ' (dado modificado).' : '.'));

  if (forceSteal || even) {
    stolen = stealRandomHandCard(player, player === 1 ? 2 : 1);
    if (stolen) log('🎴 ¡Robo Infernal! ' + (player === 1 ? 'Robaste' : 'La IA robó') + ' una carta aleatoria de la mano rival.');
    else log('🎴 El resultado era favorable, pero la mano rival estaba vacía.');
  } else {
    stolen = stealRandomHandCard(player === 1 ? 2 : 1, player);
    if (stolen) log('😈 ¡El canto se volvió contra ti! ' + (player === 1 ? 'El rival robó' : 'Tú robaste') + ' una carta de la mano.');
    else log('😈 El resultado era desfavorable, pero tu mano estaba vacía.');
  }

  const history = player === 1 ? cantoTurnHistoryP1 : cantoTurnHistoryP2;
  history.push({ turn, roll, rawRoll, modifier, favorable: forceSteal || even, stolenId: stolen?.id || null });
  if (history.length > 30) history.shift();

  return roll;
}

function useCantoInfernal(player = 1, options = {}) {
  if (gameOver) return null;
  const isP1 = player === 1;
  const leader = isP1 ? selectedLeader : aiLeader;
  if (!leader?.id?.startsWith('T')) {
    log('⚠️ Canto Infernal solo está disponible con un Líder de Set 07.');
    return null;
  }

  // La habilidad del Líder es una vez por turno. Las cartas pueden llamar
  // directamente a resolveCantoRoll sin consumir este indicador.
  if (!options.fromCard && !options.fromAI && ((isP1 && cantoUsedP1) || (!isP1 && cantoUsedP2))) {
    log('🎤 ' + leader.name + ': Canto Infernal ya fue usado este turno.');
    return null;
  }

  if (!options.fromCard && !options.fromAI) {
    if (isP1 && !canPlay()) return null;
    if (!isP1 && localMode === 'pvp' && active !== 2) return null;
    if (isP1) cantoUsedP1 = true;
    else cantoUsedP2 = true;
  }

  const roll = resolveCantoRoll(player, options);

  // Efectos específicos de los 7 líderes.
  if (leader.id === 'T01') {
    if (isP1) { const top = hand.length ? hand[hand.length - 1] : null; if (top) log('🟣 RM: revisas tu carta superior de la mano: ' + top.name + '.'); }
    else { const top = aiHand.length ? aiHand[aiHand.length - 1] : null; if (top) log('🟣 RM (IA): reorganiza su mano tras el Canto.'); }
  } else if (leader.id === 'T02') {
    if (roll === 6) recoverUsedDon(player, 1);
    if (roll % 2 === 1) {
      const field = isP1 ? p1Field : p2Field;
      const unit = field[field.length - 1];
      if (unit) unit.tempBoost = (unit.tempBoost || 0) + 500;
    }
  } else if (leader.id === 'T03') {
    const field = isP1 ? p1Field : p2Field;
    if (roll % 2 === 0) {
      const unit = field[field.length - 1];
      if (unit) unit.tempBoost = (unit.tempBoost || 0) + 500;
    } else {
      if (isP1) boost += 1000; else p2Boost += 1000;
    }
  } else if (leader.id === 'T04') {
    recoverUsedDon(player, 1);
  } else if (leader.id === 'T05') {
    if (roll % 2 === 0) {
      // El robo ya fue resuelto por el núcleo del Canto. Coloca opcionalmente
      // una carta de tu mano en el mazo como parte del efecto del líder.
      const ownHandNow = isP1 ? hand : aiHand;
      if (ownHandNow.length) {
        const card = ownHandNow.pop();
        const deck = isP1 ? p1Deck : p2Deck;
        deck.push(card);
        log('🩷 Jimin: una carta de tu mano volvió al fondo de tu mazo.');
      }
    } else {
      if (isP1) drawP1(); else drawP2();
    }
  } else if (leader.id === 'T06') {
    const grave = isP1 ? p1Grave : p2Grave;
    if (roll % 2 === 1 && grave.length) {
      const card = grave.pop();
      if (isP1) hand.push(card); else aiHand.push(card);
      log('⚫ V: recuperó ' + card.name + ' del cementerio.');
    }
  } else if (leader.id === 'T07') {
    if (roll % 2 === 0) {
      if (roll === 6) { if (isP1) drawP1(); else drawP2(); }
      // El robo principal ya ocurrió; el 6 añade una carta adicional.
      const field = isP1 ? p1Field : p2Field;
      const unit = field[field.length - 1];
      if (roll === 6 && unit) unit.tempBoost = (unit.tempBoost || 0) + 1000;
    }
  }

  if (!options.silent) render();
  return roll;
}

// DON reglamentario: Límite estricto de 10 DON (regla oficial TCG).
function drawDon(p, amount = 1) {
  const maxCap = GLTCG.rules?.MAX_DON || 10;
  const n = Math.max(0, Number(amount) || 0);
  if (p === 1) {
    const toAdd = Math.min(n, Math.max(0, maxCap - p1DonReserve.length));
    for (let i = 0; i < toAdd; i++) p1DonReserve.push({ id: 'DON_P1_' + Date.now() + '_' + i, name: 'DON!!', cost: 0, power: 0, type: 'Recurso', art: '🪙' });
    p1don = p1DonReserve.length;
    return toAdd;
  }
  if (p === 2) {
    const toAdd = Math.min(n, Math.max(0, maxCap - p2DonReserve.length));
    for (let i = 0; i < toAdd; i++) p2DonReserve.push({ id: 'DON_P2_' + Date.now() + '_' + i, name: 'DON!!', cost: 0, power: 0, type: 'Recurso', art: '🪙' });
    p2don = p2DonReserve.length;
    return toAdd;
  }
  return 0;
}

function recoverUsedDon(player = 1, amount = 1) {
  // El motor recupera hasta `amount` DON a la reserva, respetando
  // el límite máximo de 10 DON del TCG estándar.
  const isP1 = player === 1;
  const reserve = isP1 ? p1DonReserve : p2DonReserve;
  const maxAllowed = Math.min(GLTCG.rules?.MAX_DON || 10, isP1 ? p1max : p2max);
  const wanted = Math.max(0, Number(amount) || 0);
  const canRecover = Math.max(0, maxAllowed - reserve.length);
  const toRecover = Math.min(wanted, canRecover);
  for (let i = 0; i < toRecover; i++) {
    reserve.push({ id: 'DON_RECOVER_' + player + '_' + Date.now() + '_' + i, name: 'DON!!', cost: 0, power: 0, type: 'Recurso', art: '🪙' });
  }
  if (isP1) { p1don = reserve.length; }
  else { p2don = reserve.length; }
  if (toRecover) log('🪙 ' + (isP1 ? 'Recuperaste ' : 'La IA recuperó ') + toRecover + ' DON.');
  return toRecover;
}

function payP1(n) {
  if (p1DonReserve.length < n) return false;
  for (let i = 0; i < n; i++) p1DonReserve.pop();
  p1don = p1DonReserve.length;
  return true;
}

function payP2(n) {
  if (p2DonReserve.length < n) return false;
  for (let i = 0; i < n; i++) p2DonReserve.pop();
  p2don = p2DonReserve.length;
  return true;
}

function refreshTurnResources(player) {
  const isP1 = player === 1;
  const field = isP1 ? p1Field : p2Field;
  
  field.forEach(GLTCG.rules.resetUnitForTurn);
  const maxCap = GLTCG.rules?.MAX_DON || 10;
  if (isP1) {
    p1leaderDon = 0;
    leaderHasAttackedP1 = false;
    p1max = Math.min(maxCap, p1max + 2);
    p1DonReserve.length = 0;
    for (let i = 0; i < p1max; i++) {
      p1DonReserve.push({ id: 'DON_REFRESH_P1_' + Date.now() + '_' + i, name: 'DON!!', cost: 0, power: 0, type: 'Recurso', art: '🪙' });
    }
    p1don = p1DonReserve.length;
    p1DrawnThisTurn = true;
    drawP1();
    log("🎴 Turno de PLAYER 1: robaste 1 carta y recibiste +2 DON!! (Total: " + p1max + "/10).");
  } else {
    p2leaderDon = 0;
    leaderHasAttackedP2 = false;
    p2max = Math.min(maxCap, p2max + 2);
    p2DonReserve.length = 0;
    for (let i = 0; i < p2max; i++) {
      p2DonReserve.push({ id: 'DON_REFRESH_P2_' + Date.now() + '_' + i, name: 'DON!!', cost: 0, power: 0, type: 'Recurso', art: '🪙' });
    }
    p2don = p2DonReserve.length;
    p2DrawnThisTurn = true;
    drawP2();
    log("🎴 Turno de " + (localMode === 'pvp' ? 'PLAYER 2' : 'la IA') + ": robó 1 carta y recibió +2 DON!! (Total: " + p2max + "/10).");
  }
}

function totalPower(c) {
  let n = c.power + (c.attached || 0) * 1000 + (c.tempBoost || 0);
  const p2Leader = localMode === 'pvp' && selectedLeaderP2 ? selectedLeaderP2 : aiLeader;
  if (selectedLeader?.id === 'L03' && (c.attached || 0) >= 2) n += 300;
  if (p2Leader?.id === 'L03' && p2Field.includes(c) && (c.attached || 0) >= 2) n += 300;
  if (p2Leader?.id === 'S04' && c._returnedFromGrave) n += 300;
  if (selectedLeader?.id === 'S04' && c._returnedFromGrave) n += 300;
  if (selectedLeader?.id === 'C43' && (c.attached || 0) >= 2) n += 300;
  if (p2Leader?.id === 'C43' && p2Field.includes(c) && (c.attached || 0) >= 2) n += 300;
  return n;
}

function showShadowStatus() {
  const e = document.getElementById('shadowStatus');
  if (e) e.textContent = 'P1: ' + (shadowsDisabledP1 ? '🚫 bloqueada por Evolución' : (shadowUsedP1 ? '✅ usada' : '🟢 disponible')) + ' · P2: ' + (shadowsDisabledP2 ? '🚫 bloqueada por Evolución' : (shadowUsedP2 ? '✅ usada' : '🟢 disponible')) + ' · Evolución Alarmante bloquea Sombras para el resto de la partida.';
}

function comboValue(player) {
  return (player === 1 ? comboP1 : comboP2) + (player === 1 ? comboBonusP1 : comboBonusP2);
}

function addCombo(player, n = 1) {
  if (player === 1) comboP1 += n;
  else comboP2 += n;
  showComboStatus();
}

function comboHas(player, n) {
  return comboValue(player) >= n;
}

function showComboStatus() {
  const e = document.getElementById('comboStatus');
  if (e) e.textContent = 'P1: ' + comboValue(1) + ' · P2: ' + comboValue(2) + ' · Se reinicia al comenzar el siguiente turno.';
}

function applyCollisionCombo(c, player = 1, force = false) {
  if (!c || (!force && (!c.combo || !comboHas(player, c.combo)))) return;
  const field = player === 1 ? p1Field : p2Field;
  const handRef = player === 1 ? hand : aiHand;
  
  if (c.comboBoost) {
    const u = field.find(x => x === c) || field.find(x => x.id === c.id) || field[0];
    if (u) u.tempBoost = (u.tempBoost || 0) + c.comboBoost + (c.combo5Boost && comboHas(player, 5) ? c.combo5Boost : 0);
  }
  switch (c.comboEffect) {
    case 'draw1': player === 1 ? drawP1() : drawP2(); break;
    case 'draw2Discard': player === 1 ? (drawP1(), drawP1()) : (drawP2(), drawP2()); if (handRef.length) handRef.shift(); break;
    case 'ready': { const u = field.find(x => x.id === c.id) || field[0]; if (u) u.summoningSickness = false; break; }
    case 'debuff500': { const f = player === 1 ? p2Field : p1Field; if (f[0]) f[0].tempBoost = (f[0].tempBoost || 0) - 500; break; }
    case 'donRecover': { drawDon(player, 1); break; }
    case 'boostOther500': { const u = field.find(x => x.id !== c.id) || field[0]; if (u) u.tempBoost = (u.tempBoost || 0) + 500; break; }
    case 'peekTop': { const d = player === 1 ? p1Deck : p2Deck; if (d.length) log('🔭 Combo: ' + d[d.length - 1].name + ' está arriba del mazo.'); break; }
    case 'peekHand': log('👀 Combo: mira una carta de la mano rival.'); break;
  }
  log('💥 ' + c.name + ' activó Combo ' + c.combo + '.');
}

function makeDonToken(i) {
  const d = document.createElement("div");
  d.className = "doncard";
  d.textContent = "🪙";
  d.draggable = true;
  d.tabIndex = 0;
  d.setAttribute('role', 'button');
  d.setAttribute('aria-label', 'DON disponible. Arrastra esta moneda a una unidad o lider.');
  d.title = "Arrastra este DON a una carta o a tu Líder (+1000 poder)";
  d.addEventListener("dragstart", e => {
    e.dataTransfer.setData("text/plain", String(i));
    e.dataTransfer.effectAllowed = "move";
    d.classList.add("dragging");
  });
  d.addEventListener("dragend", () => d.classList.remove("dragging"));
  d.addEventListener('click', () => {
    selectedDonIndex = selectedDonIndex === i ? null : i;
    d.classList.toggle('selected', selectedDonIndex === i);
  });
  d.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      d.click();
    }
  });
  return d;
}

function setupDropZone(el, kind, index) {
  if (!el || el.dataset.donDropReady) return;
  el.dataset.donDropReady = "1";
  el.addEventListener('click', event => {
    if (event.target !== el || selectedDonIndex === null || !canPlay()) return;
    const donIndex = selectedDonIndex;
    if (!p1DonReserve[donIndex]) return;
    p1DonReserve.splice(donIndex, 1);
    selectedDonIndex = null;
    p1don = p1DonReserve.length;
    if (kind === 'leader') {
      p1leaderDon++;
      log('🪙 DON adjuntado al Líder: +1000 poder.');
    } else if (p1Field[index]) {
      p1Field[index].attached = (p1Field[index].attached || 0) + 1;
      log('🪙 DON adjuntado a ' + p1Field[index].name + ': +1000 poder.');
    }
    render();
  });
  el.addEventListener("dragover", e => {
    if (canPlay() && p1DonReserve.length) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      el.classList.add("dragover");
    }
  });
  el.addEventListener("dragleave", () => el.classList.remove("dragover"));
  el.addEventListener("drop", e => {
    e.preventDefault();
    el.classList.remove("dragover");
    if (!canPlay() || !p1DonReserve.length) return;
    let i = Number(e.dataTransfer.getData("text/plain"));
    if (!p1DonReserve[i]) return;
    if (p1Field[index]?.noDonThisTurn) return;
    p1DonReserve.splice(i, 1);
    p1don = p1DonReserve.length;
    if (kind === "leader") {
      p1leaderDon++;
      log("🪙 DON adjuntado al Líder: +1000 poder.");
    } else {
      p1Field[index].attached = (p1Field[index].attached || 0) + 1;
      log("🪙 DON adjuntado a " + p1Field[index].name + ": +1000 poder.");
    }
    render();
  });
}

/* ==========================================================================
   SELECCIÓN DE ATAQUES Y CONDICIÓN DE GUARDIA DE CAMPO
   ========================================================================== */
function clearTargets() {
  document.querySelectorAll(".targetable").forEach(e => e.classList.remove("targetable"));
  if (window.GLTCG?.visuals?.stopTargeting) window.GLTCG.visuals.stopTargeting();
}

function chooseArenaAttack(i) {
  if (!canPlay() || !p1Field[i]) return;
  if (attackSelection === i) {
    attackSelection = null;
    clearTargets();
    arenaLog("✖️ Selección de ataque cancelada.");
    return;
  }
  const c = p1Field[i];
  
  // REGLA 1: Cartas recién puestas no pueden atacar hasta su siguiente turno
  if (c.summoningSickness) {
    log('⏳ ' + c.name + ' acaba de entrar al campo. Debe esperar hasta tu próximo turno para atacar.');
    return;
  }
  
  // REGLA 2: Evitar ataques infinitos (máximo 1 ataque por turno)
  if (c.hasAttacked) {
    log('❌ ' + c.name + ' ya ha realizado su ataque este turno.');
    return;
  }
  
  attackSelection = i;
  clearTargets();

  const attackerEl = document.querySelector('#arenaP1Field .arena-unit[data-index="' + i + '"]');
  if (window.GLTCG?.visuals?.startTargeting && attackerEl) {
    window.GLTCG.visuals.startTargeting(attackerEl);
  }
  
  // REGLA 3: Si hay cartas del oponente en el campo, NO pueden atacar lifepoints o shield directamente
  if (p2Field.length === 0 || c.canAttackLeader) {
    const rivalLeader = document.getElementById("arenaP2Leader");
    if (rivalLeader) {
      rivalLeader.classList.add("targetable");
      rivalLeader.onmouseenter = () => { if (window.GLTCG?.visuals?.updateTargetingToElement) window.GLTCG.visuals.updateTargetingToElement(rivalLeader); };
    }
    arenaLog("🎯 " + c.name + " puede atacar directamente al Líder rival o sus escudos.");
  } else {
    arenaLog("🛡️ Hay personajes en el campo enemigo. " + c.name + " debe atacar a los defensores antes de dañar al Líder.");
  }
  
  p2Field.forEach((_, j) => {
    const e = document.querySelector('#arenaP2Field .arena-unit[data-index="' + j + '"]');
    if (e) {
      e.classList.add("targetable");
      e.onmouseenter = () => { if (window.GLTCG?.visuals?.updateTargetingToElement) window.GLTCG.visuals.updateTargetingToElement(e); };
    }
  });
}

function selectLeaderTarget(p) {
  // P1 ataca al Líder de P2 / IA
  if (p === 2 && attackSelection !== null && canPlay()) {
    if (attackSelection === 'leader') {
      if (p2Field.length > 0) {
        log('🛡️ ¡GUARDIA DE CAMPO! Tu Líder no puede atacar directamente al Líder rival mientras haya defensores.');
        return;
      }
      clearTargets();
      flashAttack();
      attackLeaderWithLeader(1);
      attackSelection = null;
      return;
    }
    if (!GLTCG.rules.canAttackLeaderThroughField(p1Field[attackSelection], p2Field)) {
      log('🛡️ ¡GUARDIA DE CAMPO! No puedes atacar directamente los escudos o vidas del Líder mientras haya personajes enemigos en juego.');
      return;
    }
    clearTargets();
    flashAttack();
    attackLeader();
    attackSelection = null;
    return;
  }
  
  // P2 ataca al Líder de P1 (PVP Local)
  if (p === 1 && localMode === "pvp" && p2AttackSelection !== null && active === 2) {
    if (p2AttackSelection === 'leader') {
      if (p1Field.length > 0) {
        log('🛡️ ¡GUARDIA DE CAMPO! El Líder no puede atacar directamente mientras haya defensores.');
        return;
      }
      clearTargets();
      flashAttack();
      attackLeaderWithLeader(2);
      p2AttackSelection = null;
      return;
    }
    if (!GLTCG.rules.canAttackLeaderThroughField(p2Field[p2AttackSelection], p1Field)) {
      log('🛡️ ¡GUARDIA DE CAMPO! No puedes atacar directamente los escudos o vidas del Líder mientras haya personajes de PLAYER 1 en juego.');
      return;
    }
    clearTargets();
    flashAttack();
    attackLeaderP2();
    p2AttackSelection = null;
    return;
  }
}

function chooseArenaCharacter(j) {
  if (localMode === "pvp" && active === 2 && p2AttackSelection !== null) {
    if (p2AttackSelection === 'leader') {
      clearTargets();
      flashAttack();
      attackCharacterWithLeader(2, j);
      p2AttackSelection = null;
      return;
    }
    const i = p2AttackSelection;
    clearTargets();
    flashAttack();
    attackCharacterP2(i, j);
    p2AttackSelection = null;
    return;
  }
  if (attackSelection === null || !canPlay()) return;
  if (attackSelection === 'leader') {
    clearTargets();
    flashAttack();
    attackCharacterWithLeader(1, j);
    attackSelection = null;
    return;
  }
  const i = attackSelection;
  clearTargets();
  flashAttack();
  attackCharacter(i, j);
  attackSelection = null;
}

function resolveBlockerTarget(field, targetIndex, defenderName, attackerPower = 0) {
  const target = targetIndex >= 0 ? field[targetIndex] : null;
  if (target && target.blocker) return targetIndex;

  const blockerIndices = [];
  field.forEach((card, idx) => { if (card.blocker) blockerIndices.push(idx); });
  if (!blockerIndices.length) return targetIndex;

  // Si el defensor es la IA (P2 en modo no PVP)
  if (defenderName === "PLAYER 2" && localMode !== "pvp") {
    const blockers = blockerIndices.map(idx => field[idx]);
    const decision = GLTCG.ai.decideAIBlock(attackerPower, p2hp, p2shield, blockers);
    if (decision >= 0 && decision < blockerIndices.length) {
      const chosenIdx = blockerIndices[decision];
      log("🛡️ " + defenderName + " (IA) activó a " + field[chosenIdx].name + " como BLOCKER.");
      return chosenIdx;
    }
    return targetIndex;
  }

  // Si el defensor es un humano
  const firstBlocker = field[blockerIndices[0]];
  const useBlocker = confirm("🛡️ " + firstBlocker.name + " puede interceptar el ataque. ¿Redirigirlo a BLOCKER?");
  if (!useBlocker) return targetIndex;
  log("🛡️ " + defenderName + " redirigió el ataque hacia " + firstBlocker.name + ".");
  return blockerIndices[0];
}

function chooseArenaAttackP2(i) {
  if (localMode !== "pvp" || active !== 2 || !p2Field[i]) return;
  if (p2AttackSelection === i) {
    p2AttackSelection = null;
    clearTargets();
    arenaLog("✖️ Selección de ataque cancelada.");
    return;
  }
  const c = p2Field[i];
  
  if (c.summoningSickness) {
    log('⏳ ' + c.name + ' acaba de entrar al campo. No puede atacar hasta el próximo turno de PLAYER 2.');
    return;
  }
  if (c.hasAttacked) {
    log('❌ ' + c.name + ' ya ha realizado su ataque este turno.');
    return;
  }
  
  p2AttackSelection = i;
  clearTargets();
  
  if (p1Field.length === 0 || c.canAttackLeader) {
    document.getElementById("arenaP1Leader")?.classList.add("targetable");
    arenaLog("🎯 PLAYER 2: " + c.name + " puede atacar directamente al Líder de PLAYER 1.");
  } else {
    arenaLog("🛡️ Hay defensores en el campo de PLAYER 1. PLAYER 2 debe atacar primero a los personajes.");
  }
  
  p1Field.forEach((_, j) => {
    const e = document.querySelector('#arenaP1Field .arena-unit[data-index="' + j + '"]');
    if (e) e.classList.add("targetable");
  });
}

function attackCharacter(i, j) {
  let a = p1Field[i];
  if (!a) return;
  j = resolveBlockerTarget(p2Field, j, "PLAYER 2");
  let t = p2Field[j];
  if (!t) return;
  if (a.summoningSickness) {
    log('⏳ Este personaje acaba de entrar y no puede atacar todavía.');
    return;
  }
  if (a.hasAttacked && !a.secondAttackBoost) {
    log('❌ Este personaje ya atacó este turno.');
    return;
  }
  
  const targetEl = document.querySelector('#arenaP2Field .arena-unit[data-index="' + j + '"]');
  if (window.GLTCG?.visuals && targetEl) {
    window.GLTCG.visuals.triggerSlash(targetEl);
    window.GLTCG.visuals.triggerScreenShake(totalPower(a) >= 3000 ? 'heavy' : 'medium');
  }

  a.hasAttacked = true;
  battleStats.attacksMade++;
  addCombo(1, 1);
  if (selectedLeader.id === 'L01' && !leaderAbilityUsed) {
    a.tempBoost = (a.tempBoost || 0) + 500;
    leaderAbilityUsed = true;
    log('🌅 Kael activa su habilidad: +500 poder este combate.');
  }
  if (selectedLeader.id === 'C41' && comboHas(1, 2) && !collisionLeaderUsedP1) {
    a.tempBoost = (a.tempBoost || 0) + 500;
    collisionLeaderUsedP1 = true;
    log('💥 Raze: +500 por Combo 2.');
  }
  
  let ap = totalPower(a) + (a.secondAttackBoost || 0), tp = totalPower(t);
  a.secondAttackBoost = 0;
  if (a.attackBoost) ap += a.attackBoost;
  log('⚔️ ' + a.name + ' (' + ap + ') ataca a ' + t.name + ' (' + tp + ').');
  
  if (ap > tp) {
    const defeated = p2Field.splice(j, 1)[0];
    p2Grave.push(defeated);
    log('💥 ' + t.name + ' fue KO. ' + a.name + ' sobrevive.');
    if (window.GLTCG?.visuals && targetEl) window.GLTCG.visuals.spawnFloatingCombatText(targetEl, '💀 ¡K.O.!', 'ko');
    notifyDefeat(defeated, 2);
    if (selectedLeader.id === 'S03' && !leaderAbilityUsed) {
      a.tempBoost = (a.tempBoost || 0) + 700;
      leaderAbilityUsed = true;
      log('🔥 Drazek: +700 por derrotar un personaje.');
    }
  } else if (ap < tp) {
    const defeated = p1Field.splice(i, 1)[0];
    p1Grave.push(defeated);
    log('💀 ' + a.name + ' fue KO. ' + t.name + ' sobrevive.');
    if (window.GLTCG?.visuals && targetEl) window.GLTCG.visuals.spawnFloatingCombatText(targetEl, '🛡️ ¡RESISTIDO!', 'blocked');
    notifyDefeat(defeated, 1);
  } else {
    const d2 = p2Field.splice(j, 1)[0], d1 = p1Field.splice(i, 1)[0];
    p2Grave.push(d2);
    p1Grave.push(d1);
    log('💥 Empate: ambos personajes fueron KO.');
    if (window.GLTCG?.visuals && targetEl) window.GLTCG.visuals.spawnFloatingCombatText(targetEl, '💥 ¡DOBLE K.O.!', 'ko');
    notifyDefeat(d2, 2);
    notifyDefeat(d1, 1);
  }
  checkWin();
  render();
}

function attackLeader() {
  if (!canPlay() || attackSelection === null || !p1Field[attackSelection]) return;
  const a = p1Field[attackSelection];
  
  if (a.summoningSickness) {
    log('⏳ Este personaje acaba de entrar y no puede atacar todavía.');
    return;
  }
  if (a.hasAttacked) {
    log('❌ Este personaje ya atacó este turno.');
    return;
  }
  
  if (!GLTCG.rules.canAttackLeaderThroughField(a, p2Field)) {
    log('🛡️ ¡No puedes atacar directamente al Líder rival mientras tenga personajes defendiendo el campo!');
    return;
  }
  
  const ap = totalPower(a);
  const blockerIdx = resolveBlockerTarget(p2Field, -1, "PLAYER 2", ap);
  if (blockerIdx >= 0) {
    attackCharacter(attackSelection, blockerIdx);
    return;
  }

  const leaderEl = document.getElementById('arenaP2Leader');
  if (window.GLTCG?.visuals && leaderEl) {
    window.GLTCG.visuals.triggerSlash(leaderEl);
    window.GLTCG.visuals.triggerScreenShake('heavy');
  }

  a.hasAttacked = true;
  a.canAttackLeader = false;
  battleStats.attacksMade++;
  battleStats.leaderAttacks++;
  addCombo(1, 1);
  
  if (p2shield > 0) {
    p2shield--;
    log("👑 ¡Ataque al Líder rival! Rompiste 1 🛡️.");
    if (window.GLTCG?.visuals && leaderEl) window.GLTCG.visuals.spawnFloatingCombatText(leaderEl, '🛡️ ¡ESCUDO ROTO!', 'shield');
  } else if (p2hp <= 0 && tryRabbitHole(2)) {
    log("🐇 RABBIT HOLE: el Líder rival estaba en 0 ❤️ y evitó el golpe final.");
    if (window.GLTCG?.visuals && leaderEl) window.GLTCG.visuals.spawnFloatingCombatText(leaderEl, '🐇 ¡RABBIT HOLE!', 'rabbithole');
  } else {
    p2hp = Math.max(0, p2hp - 1);
    log("👑 ¡Ataque directo al Líder rival! Perdió 1 ❤️.");
    if (window.GLTCG?.visuals && leaderEl) window.GLTCG.visuals.spawnFloatingCombatText(leaderEl, '💥 -1 ❤️', 'damage');
  }
  checkWin();
  render();
}

function attackLeaderWithLeader(player) {
  const isP1 = player === 1;
  const power = 5000 + (isP1 ? p1leaderDon : p2leaderDon) * 1000;
  const enemyField = isP1 ? p2Field : p1Field;
  
  const blockerIdx = resolveBlockerTarget(enemyField, -1, isP1 ? "PLAYER 2" : "PLAYER 1", power);
  if (blockerIdx >= 0) {
    attackCharacterWithLeader(player, blockerIdx);
    return;
  }

  const targetLeaderEl = isP1 ? document.getElementById('arenaP2Leader') : document.getElementById('arenaP1Leader');
  if (window.GLTCG?.visuals && targetLeaderEl) {
    window.GLTCG.visuals.triggerSlash(targetLeaderEl);
    window.GLTCG.visuals.triggerScreenShake('heavy');
  }

  if (isP1) {
    leaderHasAttackedP1 = true;
    battleStats.attacksMade++;
    battleStats.leaderAttacks++;
    addCombo(1, 1);
    if (p2shield > 0) {
      p2shield--;
      log("👑 ¡Tu Líder atacó (" + power + ")! Rompiste 1 🛡️.");
      if (window.GLTCG?.visuals && targetLeaderEl) window.GLTCG.visuals.spawnFloatingCombatText(targetLeaderEl, '🛡️ ¡ESCUDO ROTO!', 'shield');
    } else if (p2hp <= 0 && tryRabbitHole(2)) {
      log("🐇 RABBIT HOLE: el Líder rival estaba en 0 ❤️ y evitó el golpe final.");
      if (window.GLTCG?.visuals && targetLeaderEl) window.GLTCG.visuals.spawnFloatingCombatText(targetLeaderEl, '🐇 ¡RABBIT HOLE!', 'rabbithole');
    } else {
      p2hp = Math.max(0, p2hp - 1);
      log("👑 ¡Tu Líder infligió daño directo (" + power + ")! Rival perdió 1 ❤️.");
      if (window.GLTCG?.visuals && targetLeaderEl) window.GLTCG.visuals.spawnFloatingCombatText(targetLeaderEl, '💥 -1 ❤️', 'damage');
    }
  } else {
    leaderHasAttackedP2 = true;
    battleStats.attacksMade++;
    battleStats.leaderAttacks++;
    addCombo(2, 1);
    if (p1shield > 0) {
      p1shield--;
      log("👑 Líder de PLAYER 2 atacó (" + power + ") y rompió 1 🛡️.");
      if (window.GLTCG?.visuals && targetLeaderEl) window.GLTCG.visuals.spawnFloatingCombatText(targetLeaderEl, '🛡️ ¡ESCUDO ROTO!', 'shield');
    } else if (p1hp <= 0 && tryRabbitHole(1)) {
      log("🐇 RABBIT HOLE: PLAYER 1 estaba en 0 ❤️ y evitó el golpe final.");
      if (window.GLTCG?.visuals && targetLeaderEl) window.GLTCG.visuals.spawnFloatingCombatText(targetLeaderEl, '🐇 ¡RABBIT HOLE!', 'rabbithole');
    } else {
      p1hp = Math.max(0, p1hp - 1);
      log("👑 Líder de PLAYER 2 infligió daño directo (" + power + ") por 1 ❤️.");
      if (window.GLTCG?.visuals && targetLeaderEl) window.GLTCG.visuals.spawnFloatingCombatText(targetLeaderEl, '💥 -1 ❤️', 'damage');
    }
  }
  checkWin();
  render();
}

function attackCharacterWithLeader(player, targetIndex) {
  const isP1 = player === 1;
  const enemyField = isP1 ? p2Field : p1Field;
  const enemyGrave = isP1 ? p2Grave : p1Grave;
  const enemyPlayer = isP1 ? 2 : 1;
  const defenderName = isP1 ? "PLAYER 2" : "PLAYER 1";
  const power = 5000 + (isP1 ? p1leaderDon : p2leaderDon) * 1000;

  targetIndex = resolveBlockerTarget(enemyField, targetIndex, defenderName, power);
  const target = enemyField[targetIndex];
  if (!target) return;
  const tPower = totalPower(target);

  const targetEl = isP1
    ? document.querySelector('#arenaP2Field .arena-unit[data-index="' + targetIndex + '"]')
    : document.querySelector('#arenaP1Field .arena-unit[data-index="' + targetIndex + '"]');
  if (window.GLTCG?.visuals && targetEl) {
    window.GLTCG.visuals.triggerSlash(targetEl);
    window.GLTCG.visuals.triggerScreenShake(power >= 6000 ? 'heavy' : 'medium');
  }

  if (isP1) {
    leaderHasAttackedP1 = true;
    battleStats.attacksMade++;
    battleStats.leaderAttacks++;
    addCombo(1, 1);
  } else {
    leaderHasAttackedP2 = true;
    battleStats.attacksMade++;
    battleStats.leaderAttacks++;
    addCombo(2, 1);
  }

  log("👑 Líder de " + (isP1 ? "PLAYER 1" : "PLAYER 2") + " (" + power + ") ataca a " + target.name + " (" + tPower + ").");

  if (power > tPower) {
    enemyField.splice(targetIndex, 1);
    enemyGrave.push(target);
    log("💥 " + target.name + " fue derrotado por el Líder.");
    if (window.GLTCG?.visuals && targetEl) window.GLTCG.visuals.spawnFloatingCombatText(targetEl, '💀 ¡K.O. POR LÍDER!', 'ko');
    notifyDefeat(target, enemyPlayer);
  } else if (power < tPower) {
    log("🛡️ " + target.name + " resistió el ataque del Líder.");
    if (window.GLTCG?.visuals && targetEl) window.GLTCG.visuals.spawnFloatingCombatText(targetEl, '🛡️ ¡RESISTIDO!', 'blocked');
  } else {
    enemyField.splice(targetIndex, 1);
    enemyGrave.push(target);
    log("💥 " + target.name + " cayó ante el ataque del Líder.");
    if (window.GLTCG?.visuals && targetEl) window.GLTCG.visuals.spawnFloatingCombatText(targetEl, '💥 ¡DOBLE K.O.!', 'ko');
    notifyDefeat(target, enemyPlayer);
  }
  checkWin();
  render();
}

function attackCharacterP2(i, j) {
  let a = p2Field[i];
  if (!a) return;
  j = resolveBlockerTarget(p1Field, j, "PLAYER 1", totalPower(a));
  let t = p1Field[j];
  if (!t || a.summoningSickness || (a.hasAttacked && !a.secondAttackBoost)) return;
  
  a.hasAttacked = true;
  addCombo(2, 1);
  if (selectedLeaderP2?.id === 'C41' && comboHas(2, 2) && !collisionLeaderUsedP2) {
    a.tempBoost = (a.tempBoost || 0) + 500;
    collisionLeaderUsedP2 = true;
  }
  let ap = totalPower(a) + (a.attackBoost || 0) + (a.secondAttackBoost || 0), tp = totalPower(t);
  a.secondAttackBoost = 0;
  log('⚔️ PLAYER 2: ' + a.name + ' (' + ap + ') ataca a ' + t.name + ' (' + tp + ').');
  
  if (ap > tp) {
    const d = p1Field.splice(j, 1)[0];
    p1Grave.push(d);
    log('💥 ' + d.name + ' fue KO.');
    notifyDefeat(d, 1);
    if (selectedLeaderP2?.id === 'S03' && !leaderAbilityUsedP2) {
      a.tempBoost = (a.tempBoost || 0) + 700;
      leaderAbilityUsedP2 = true;
    }
  } else if (ap < tp) {
    const d = p2Field.splice(i, 1)[0];
    p2Grave.push(d);
    log('💥 ' + d.name + ' fue KO.');
    notifyDefeat(d, 2);
  } else {
    const d1 = p1Field.splice(j, 1)[0], d2 = p2Field.splice(i, 1)[0];
    p1Grave.push(d1);
    p2Grave.push(d2);
    log('💥 Empate: ambos personajes fueron KO.');
    notifyDefeat(d1, 1);
    notifyDefeat(d2, 2);
  }
  checkWin();
  render();
}

function attackLeaderP2() {
  if (localMode !== "pvp" || active !== 2 || gameOver || p2AttackSelection === null || !p2Field[p2AttackSelection]) return;
  const a = p2Field[p2AttackSelection];
  if (a.summoningSickness || a.hasAttacked) return;
  
  if (!GLTCG.rules.canAttackLeaderThroughField(a, p1Field)) {
    log('🛡️ ¡PLAYER 2 no puede atacar directamente al Líder mientras haya personajes defendiendo el campo!');
    return;
  }
  
  const ap = totalPower(a);
  const blockerIdx = resolveBlockerTarget(p1Field, -1, "PLAYER 1", ap);
  if (blockerIdx >= 0) {
    attackCharacterP2(p2AttackSelection, blockerIdx);
    return;
  }

  a.hasAttacked = true;
  a.canAttackLeader = false;
  addCombo(2, 1);
  if (selectedLeaderP2?.id === 'C41' && comboHas(2, 2) && !collisionLeaderUsedP2) {
    a.tempBoost = (a.tempBoost || 0) + 500;
    collisionLeaderUsedP2 = true;
  }
  if (p1shield > 0) {
    p1shield--;
    log("👑 PLAYER 2 atacó al Líder y rompió 1 🛡️.");
  } else if (p1hp <= 0 && tryRabbitHole(1)) {
    log("🐇 RABBIT HOLE: PLAYER 1 estaba en 0 ❤️ y evitó el golpe final.");
  } else {
    p1hp = Math.max(0, p1hp - 1);
    log("👑 PLAYER 2 dañó al Líder por 1 ❤️.");
  }
  checkWin();
  render();
}

function damageShield(player, n) {
  emitBattleEvent('SHIELD_DAMAGE', { player, amount: n });
  if (player === 1) {
    let k = Math.min(n, p1shield);
    p1shield -= k;
    log("💥 P1 perdió " + k + " escudo(s).");
    const overflow = n - k;
    if (overflow > 0 && p1Field.length === 0) {
      p1hp = Math.max(0, p1hp - overflow);
      log("💥 El impacto restante dañó directamente al Líder de P1 por " + overflow + " ❤️.");
    }
  } else {
    let k = Math.min(n, p2shield);
    p2shield -= k;
    log("💥 P2 perdió " + k + " escudo(s).");
    const overflow = n - k;
    if (overflow > 0 && p2Field.length === 0) {
      p2hp = Math.max(0, p2hp - overflow);
      log("💥 El impacto restante dañó directamente al Líder de P2 por " + overflow + " ❤️.");
    }
  }
}

function chooseEnemyIndex(maxPower = Infinity, player = 1) {
  const field = player === 1 ? p2Field : p1Field;
  if (!field.length) return -1;
  let candidates = field.map((c, i) => ({ c, i })).filter(x => totalPower(x.c) <= maxPower);
  if (!candidates.length) return -1;
  return candidates.sort((a, b) => totalPower(a.c) - totalPower(b.c))[0]?.i ?? -1;
}

function playCardForPlayer(player, index, fromAI = false) {
  battleStats.cardsPlayed++;
  if (gameOver || (player === 1 && !canPlay()) || (player === 2 && !fromAI && (localMode !== 'pvp' || active !== 2))) return false;

  const ownHand = player === 1 ? hand : aiHand;
  const ownField = player === 1 ? p1Field : p2Field;
  const card = ownHand[index];
  const pay = player === 1 ? payP1 : payP2;
  if (!card) return false;
  if (card.type !== 'Evento' && card.type !== 'Recurso' && !GLTCG.rules.canSummonCharacter(ownField)) {
    log('🚫 ¡CAMPO LLENO! El límite oficial es de 5 personajes en el campo de batalla.');
    return false;
  }
  if (card.onlyEvolution === true) {
    log('🧬 ' + card.name + ' solo puede ser invocada mediante Evolución Alarmante.');
    return false;
  }
  if (!pay(card.cost)) {
    log('❌ ' + (player === 1 ? 'No tienes' : 'PLAYER 2 no tiene') + ' suficientes DON en reserva.');
    return false;
  }

  ownHand.splice(index, 1);
  emitBattleEvent('PLAY_CARD', { player, cardId: card.id, cardName: card.name });
  addCombo(player, 1);
  log('🎴 ' + (player === 1 ? 'Jugaste ' : 'PLAYER 2 jugó ') + card.name + '.');

  if (player === 1 && selectedLeader.id === 'L02' && card.type === 'Evento' && !leaderAbilityUsed) {
    drawP1();
    leaderAbilityUsed = true;
    log('🌌 Lyra: robaste 1 carta por jugar un Evento.');
  }

  if (card.type === 'Evento' || card.type === 'Recurso') {
    applyCardEffect(card, player);
    applyCollisionCombo(card, player);
  } else {
    const unit = cloneCard(card);
    Object.assign(unit, GLTCG.rules.createUnitState(card, player === 1 ? boost : p2Boost));
    unit.tempBoost += cardPowerBonus(unit, player);
    ownField.push(unit);
    applyCardEffect(card, player);
    if (unit.awakening) triggerAwakening(unit, player, false);
    applyCollisionCombo(unit, player);
  }
  checkWin();
  render();
  return true;
}

function playCard(i) {
  playCardForPlayer(1, i);
}

function playCardP2(i) {
  playCardForPlayer(2, i);
}

function applyCardEffect(c, player = 1, context = {}) {
  const e = c.effect || c.onPlay;
  if (e !== 'reuseAbility' && !resolvingRepeatedAbility) lastResolvedAbility = { card: c, player: player };
  const ownHand = player === 1 ? hand : aiHand;
  const enemyHand = player === 1 ? aiHand : hand;
  const ownDeck = player === 1 ? p1Deck : p2Deck;
  const ownField = player === 1 ? p1Field : p2Field;
  const ownGrave = player === 1 ? p1Grave : p2Grave;
  const enemyField = player === 1 ? p2Field : p1Field;
  const enemyGrave = player === 1 ? p2Grave : p1Grave;
  const draw = player === 1 ? drawP1 : drawP2;
  const enemyPlayer = player === 1 ? 2 : 1;

  if (e === 'draw' || e === 'draw1') { draw(); log('🎴 ' + (player === 1 ? 'Robaste' : 'La IA robó') + ' 1 carta.'); }
  else if (e === 'draw2') { draw(); draw(); log('🎴 ' + (player === 1 ? 'Robaste' : 'La IA robó') + ' 2 cartas.'); }
  else if (e === 'draw3') { draw(); draw(); draw(); log('🎴 ' + (player === 1 ? 'Robaste' : 'La IA robó') + ' 3 cartas.'); }
  else if (e === 'drawDiscard') { draw(); if (ownHand.length) ownHand.shift(); }
  else if (e === 'draw2Discard') { draw(); draw(); if (ownHand.length) ownHand.shift(); }
  else if (e === 'peek2') {
    if (ownDeck.length) {
      const first = ownDeck.pop();
      const second = ownDeck.length ? ownDeck.pop() : null;
      ownHand.push(first);
      if (second) ownDeck.push(second);
      log('🔭 ' + (player === 1 ? 'Exploraste' : 'La IA exploró') + ' las primeras cartas.');
    }
  }
  else if (e === 'healshield') { if (player === 1 && p1shield < 5) p1shield++; if (player === 2 && p2shield < 5) p2shield++; }
  else if (e === 'shield') damageShield(enemyPlayer, 1);
  else if (e === 'boost700' || e === 'charge') {
    if (ownField.length > 0) {
      const target = ownField.find(x => !x.hasAttacked && !x.summoningSickness) || ownField[0];
      target.tempBoost = (target.tempBoost || 0) + 700;
      log('☀️ ' + c.name + ': ' + target.name + ' gana +700 poder este turno.');
    } else {
      if (player === 1) boost += 700; else p2Boost += 700;
    }
  }
  else if (e === 'debuff700' || e === 'debuff300') {
    const targetIndex = chooseEnemyIndex(Infinity, player);
    const target = targetIndex >= 0 ? enemyField[targetIndex] : null;
    if (target) target.tempBoost = (target.tempBoost || 0) - (e === 'debuff700' ? 700 : 300);
  }
  else if (e === 'break2') damageShield(enemyPlayer, 2);
  else if (e === 'recover') { if (ownGrave.length) ownHand.push(ownGrave.pop()); }
  else if (e === 'ko1500') {
    const i = chooseEnemyIndex(1500, player);
    if (i >= 0) { const defeated = enemyField.splice(i, 1)[0]; enemyGrave.push(defeated); notifyDefeat(defeated, enemyPlayer); }
  }
  else if (e === 'bounce1000') { const i = chooseEnemyIndex(1000, player); if (i >= 0) enemyHand.push(enemyField.splice(i, 1)[0]); }
  else if (e === 'ready') { if (ownField.length) ownField[0].summoningSickness = false; }
  else if (e === 'prevent') window['_preventLeaderDamageP' + player] = true;
  else if (e === 'team300') ownField.forEach(x => x.tempBoost = (x.tempBoost || 0) + 300);
  else if (e === 'donRecover') { drawDon(player, 1); }
  else if (e === 'comboPlus1' || e === 'comboPlus2' || e === 'comboPlus3') addCombo(player, Number(e.slice(-1)));
  else if (e === 'comboPlus3Temp') { if (player === 1) comboBonusP1 += 3; else comboBonusP2 += 3; }
  else if (e === 'collisionDraw') { draw(); if (comboHas(player, 3)) { draw(); if (ownHand.length) ownHand.shift(); } }
  else if (e === 'draw3Discard') { draw(); draw(); draw(); if (ownHand.length) ownHand.shift(); }
  else if (e === 'boost500' || e === 'collisionBoost800' || e === 'collisionBoostReady' || e === 'collisionBoostLeader' || e === 'legendCombo') {
    const target = ownField[0];
    if (target) {
      const amount = e === 'boost500' ? 500 : e === 'collisionBoost800' ? (comboHas(player, 2) ? 800 : 500) : e === 'collisionBoostReady' ? 1000 : e === 'collisionBoostLeader' ? 1500 : 2000;
      target.tempBoost = (target.tempBoost || 0) + amount;
      if ((e === 'collisionBoostReady' && comboHas(player, 3)) || (e === 'legendCombo' && comboHas(player, 5))) target.summoningSickness = false;
      if (e === 'collisionBoostLeader' && comboHas(player, 4)) target.canAttackLeader = true;
      if (e === 'legendCombo' && comboHas(player, 5)) target.hasAttacked = false;
    }
  }
  else if (e === 'secondAttack') {
    const target = ownField[0];
    if (target) {
      target.hasAttacked = false;
      target.secondAttackBoost = comboHas(player, 4) ? 500 : 0;
    }
  }
  else if (e === 'clearEnemyTemp' || e === 'stormCollision') {
    enemyField.forEach(target => target.tempBoost = (target.tempBoost || 0) - (e === 'stormCollision' ? 700 : target.tempBoost || 0));
  }
  else if (e === 'bounceCost4') {
    const i = enemyField.map((target, index) => ({ target, index })).filter(x => x.target.cost <= 4).sort((a, b) => totalPower(a.target) - totalPower(b.target))[0]?.index;
    if (typeof i === 'number') enemyHand.push(enemyField.splice(i, 1)[0]);
  }
  else if (e === 'koCollision' || e === 'impactFinal') {
    const limit = e === 'koCollision' ? (comboHas(player, 5) ? 2500 : 1800) : 1500;
    const i = chooseEnemyIndex(limit, player);
    if (i >= 0) {
      if (e === 'impactFinal') enemyField[i].tempBoost = (enemyField[i].tempBoost || 0) - 1500;
      if (e === 'koCollision' || (comboHas(player, 4) && totalPower(enemyField[i]) <= 1500)) {
        const defeated = enemyField.splice(i, 1)[0];
        enemyGrave.push(defeated);
        notifyDefeat(defeated, enemyPlayer);
      }
    }
  }
  else if (e === 'donRecover2' || e === 'legendCore') {
    const amount = 2;
    drawDon(player, amount);
    if (e === 'legendCore') { draw(); draw(); draw(); draw(); }
  }
  else if (e === 'lowLifeBoost') { if ((player === 1 ? p1hp : p2hp) <= 2) { const u = ownField[ownField.length - 1]; if (u) u.tempBoost = (u.tempBoost || 0) + 300; } if ((player === 1 ? p1hp : p2hp) <= 1) draw(); }
  else if (e === 'scry2') { const d = ownDeck.slice(-2).reverse(); if (d.length) log('🔭 ' + c.name + ': ' + d.map(x => x.name).join(' · ') + '.'); }
  else if (e === 'evolutionBoost500' || e === 'evolutionBoost700' || e === 'evolutionBoost300' || e === 'evolutionTitan' || e === 'evolutionLegend') { const u = ownField[ownField.length - 1]; if (u && context.evolved) u.tempBoost = (u.tempBoost || 0) + ({evolutionBoost500:500,evolutionBoost700:700,evolutionBoost300:300,evolutionTitan:800,evolutionLegend:1000}[e]); }
  else if (e === 'searchEvolution') { const found = ownDeck.slice(-5).reverse().find(x => x.id && (x.id.startsWith('R') || x.id.startsWith('E'))); if (found) { const ix = ownDeck.indexOf(found); ownDeck.splice(ix,1); ownHand.push(found); log('🧬 ' + c.name + ': añadiste ' + found.name + ' a tu mano.'); } }
  else if (e === 'blockerLowLife') { const u = ownField[ownField.length - 1]; if (u && (player === 1 ? p1hp : p2hp) <= 0) u.tempBoost = (u.tempBoost || 0) + 500; }
  else if (e === 'rabbitSynergy') { const u = ownField[ownField.length - 1]; if (u && ownField.some(x => x.id && x.id.startsWith('R'))) u.tempBoost = (u.tempBoost || 0) + 300; }
  else if (e === 'recoverEvolutionCard') { const found = [...ownGrave].reverse().find(x => x.id && (x.id.startsWith('R') || x.id.startsWith('E'))); if (found) { ownGrave.splice(ownGrave.indexOf(found),1); ownHand.push(found); } }
  else if (e === 'evolutionSupport') { ownField.forEach(u => { if (u.invokedByEvolution) u.tempBoost = (u.tempBoost || 0) + 500; }); }
  else if (e === 'evolutionRush' || e === 'evolutionAttackReady' || e === 'evolutionLeaderAttack') { const u = ownField[ownField.length - 1]; if (u && context.evolved) { u.summoningSickness = false; if (e === 'evolutionLeaderAttack') u.canAttackLeader = true; } }
  else if (e === 'evolutionKing') { if (context.evolved) { drawDon(player, 1); draw(); draw(); } }
  else if (e === 'evolutionEntity') { /* activo por botón, ver activateUnitAbility */ }
  else if (e === 'evolutionNextBoost') { if (player === 1) evolutionNextBoostP1 = true; else evolutionNextBoostP2 = true; }
  else if (e === 'bounceTwo') { let count = 0; for (let i = enemyField.length - 1; i >= 0 && count < 2; i--) if (enemyField[i].cost <= 4) { enemyHand.push(enemyField.splice(i,1)[0]); count++; } }
  else if (e === 'perfectEvolution') { const u = ownField[ownField.length - 1]; if (u && context.evolved) u.tempBoost = (u.tempBoost || 0) + 1000; if (context.evolved) { draw(); draw(); const d = player === 1 ? p1DonDeck : p2DonDeck, r = player === 1 ? p1DonReserve : p2DonReserve; if (d.length) r.push(d.pop()); } }
  else if (e === 'finalEvolution') { const u = ownField[ownField.length - 1]; if (u && context.evolved) u.summoningSickness = false; }
  else if (e === 'scry1') { const d = ownDeck.slice(-1); if (d.length) log('🔭 ' + c.name + ': ' + d[0].name + '.'); }
  else if (e === 'scry3') { const d = ownDeck.slice(-3).reverse(); if (d.length) log('🔭 ' + c.name + ': ' + d.map(x => x.name).join(' · ') + '.'); }
  else if (e === 'evolutionBlockerKO' || e === 'evolutionHunter') { if (context.evolved && e === 'evolutionHunter') draw(); }
  else if (e === 'activateEvolution' || e === 'forcedEvolution' || e === 'uncontrolledEvolution' || e === 'supremeEvolution' || e === 'impossibleForm' || e === 'ultimateForm' || e === 'beyondRabbitHole') {
    const options = { extraBoost: e === 'forcedEvolution' ? 500 : e === 'supremeEvolution' ? 1500 : e === 'ultimateForm' ? 2000 : 0, immediateAttack: e === 'uncontrolledEvolution' || e === 'ultimateForm', noDonThisTurn: e === 'uncontrolledEvolution', leaderAttack: e === 'ultimateForm', fromAI: player === 2 };
    if (e === 'impossibleForm') options.minCost = 7;
    if (e === 'beyondRabbitHole') options.maxCost = 10;
    evolutionFromEvent(player, options);
    if (e === 'activateEvolution') addCombo(player,1); else if (e === 'uncontrolledEvolution') addCombo(player,2); else if (e === 'supremeEvolution') addCombo(player,2); else if (e === 'impossibleForm') addCombo(player,2); else if (e === 'ultimateForm') addCombo(player,2); else if (e === 'beyondRabbitHole') addCombo(player,3);
  }
  else if (e === 'secondForm') { const u = ownField[ownField.length - 1]; if (u) { u.tempBoost = (u.tempBoost || 0) + 1000; if (u.invokedByEvolution) u.summoningSickness = false; } }
  else if (e === 'unexpectedMutation') { const ix = ownField.findIndex(isEvolutionEligible); if (ix >= 0) { ownHand.push(ownField.splice(ix,1)[0]); evolutionFromEvent(player); } }
  else if (e === 'evolutionJump') { const u = ownField.find(x => x.invokedByEvolution) || ownField[ownField.length - 1]; if (u) u.tempBoost = (u.tempBoost || 0) + 1000; }
  else if (e === 'abyssForm') { const i = chooseEnemyIndex(Infinity, player); if (i >= 0) { enemyField[i].tempBoost = (enemyField[i].tempBoost || 0) - 1000; enemyField[i].abilitiesDisabled = true; } }
  else if (e === 'recoverSet05') { const found = [...ownGrave].reverse().find(x => x.id && x.id.startsWith('R')); if (found) { ownGrave.splice(ownGrave.indexOf(found),1); ownHand.push(found); } addCombo(player,1); }
  else if (e === 'evolutionKO') { const limit = (player === 1 ? evolutionUsedThisTurnP1 : evolutionUsedThisTurnP2) ? 2300 : 1800; const i = chooseEnemyIndex(limit, player); if (i >= 0) { const defeated = enemyField.splice(i,1)[0]; enemyGrave.push(defeated); notifyDefeat(defeated, enemyPlayer); } addCombo(player,1); }
  else if (e === 'rewriteDestiny') { for (let i=0;i<2 && ownField.length;i++) ownHand.push(ownField.pop()); draw(); draw(); draw(); addCombo(player,1); }
  else if (e === 'voidEvolution') { enemyField.forEach(u => u.tempBoost = (u.tempBoost || 0) - 1000); addCombo(player,2); }
  else if (e === 'draw2Discard1') { draw(); draw(); if (ownHand.length) ownHand.shift(); }
  else if (e === 'recoverDon1' || e === 'recoverDon2') { const d = player === 1 ? p1DonDeck : p2DonDeck, r = player === 1 ? p1DonReserve : p2DonReserve; const n = e === 'recoverDon2' ? 2 : 1; for(let i=0;i<n && d.length;i++) r.push(d.pop()); }
  else if (e === 'draw3RecoverEvolution') { draw(); draw(); draw(); const found = [...ownGrave].reverse().find(x => x.id && (x.id.startsWith('R') || x.id.startsWith('E'))); if (found) { ownGrave.splice(ownGrave.indexOf(found),1); ownHand.push(found); } }
  else if (e === 'perfectEvolutionResource') { const d = player === 1 ? p1DonDeck : p2DonDeck, r = player === 1 ? p1DonReserve : p2DonReserve; for(let i=0;i<2 && d.length;i++) r.push(d.pop()); draw(); draw(); const top=ownDeck.slice(-5).reverse(); if(top.length) log('🔭 Núcleo de la Evolución Perfecta: '+top.map(x=>x.name).join(' · ')+'.'); }

  else if (e === 'cantoInfernal') resolveCantoRoll(player);
  else if (e === 'cantoDrawEven' || e === 'cantoDrawOdd') { const r = resolveCantoRoll(player); if ((e === 'cantoDrawEven' && r % 2 === 0) || (e === 'cantoDrawOdd' && r % 2 === 1)) draw(); }
  else if (e === 'cantoSixDon') { const r = resolveCantoRoll(player); if (r === 6) recoverUsedDon(player, 1); }
  else if (e === 'doubleCanto') { resolveCantoRoll(player); resolveCantoRoll(player); }
  else if (e === 'tripleCantoDraw2') { resolveCantoRoll(player); resolveCantoRoll(player); resolveCantoRoll(player); draw(); draw(); }
  else if (e === 'doubleCantoDraw') { resolveCantoRoll(player); resolveCantoRoll(player); draw(); }
  else if (e === 'cantoDebuffAll') { resolveCantoRoll(player); enemyField.forEach(u => u.tempBoost = (u.tempBoost || 0) - 700); }
  else if (e === 'ultimateConcert') { draw(); draw(); draw(); recoverUsedDon(player,2); resolveCantoRoll(player); }
  else if (e === 'stealRandom') randomHandSteal(player === 1 ? 2 : 1, player);
  else if (e === 'cantoPlusOne') { if (player === 1) cantoModifierP1 = 1; else cantoModifierP2 = 1; }
  else if (e === 'drawConditional') { draw(); if (ownHand.length < (player === 1 ? aiHand.length : hand.length)) draw(); }
  else if (e === 'debuff700Combo') { const i = chooseEnemyIndex(Infinity, player); if (i >= 0) enemyField[i].tempBoost = (enemyField[i].tempBoost || 0) - 700; addCombo(player,1); }
  else if (e === 'donRecoverDraw') { recoverUsedDon(player,1); draw(); }
  else if (e === 'cantoStealOnly') resolveCantoRoll(player, {forceSteal:true});
  else if (e === 'draw2Shield') { draw(); draw(); if (player === 1 && p1shield < 3) p1shield++; if (player === 2 && p2shield < 3) p2shield++; }
  else if (e === 'donRecover2Draw') { recoverUsedDon(player,2); draw(); }
  else if (e === 'team300Combo') { ownField.forEach(u => u.tempBoost = (u.tempBoost || 0) + 300); addCombo(player,1); }
  else if (e === 'readyBoost1000') { const u = ownField[0]; if (u) { u.summoningSickness=false; u.tempBoost=(u.tempBoost||0)+1000; } }
  else if (e === 'debuffAll500') enemyField.forEach(u => u.tempBoost = (u.tempBoost || 0) - 500);
  else if (e === 'searchTop5') { if (ownDeck.length) { const take=Math.min(5,ownDeck.length), top=ownDeck.splice(ownDeck.length-take,take); const chosen=top.pop(); ownHand.push(chosen); ownDeck.push(...top); log('🔎 ' + c.name + ': añadiste 1 carta de las primeras ' + take + '.'); } }
  else if (e === 'draw3Canto') { draw(); draw(); draw(); resolveCantoRoll(player); }
  else if (e === 'ko2200' || e === 'ko1800') { const limit=e==='ko2200'?2200:1800; const i=chooseEnemyIndex(limit,player); if(i>=0){const defeated=enemyField.splice(i,1)[0];enemyGrave.push(defeated);notifyDefeat(defeated,enemyPlayer);} }
  else if (e === 'bounce1500') { const i=chooseEnemyIndex(1500,player); if(i>=0) enemyHand.push(enemyField.splice(i,1)[0]); }
  else if (e === 'lowLife500') { if ((player===1?p1hp:p2hp)<=2) { const u=ownField[ownField.length-1]; if(u)u.tempBoost=(u.tempBoost||0)+500; } }
  else if (e === 'graveThisTurn500') { if (p1Grave.length+p2Grave.length>0) { const u=ownField[ownField.length-1]; if(u)u.tempBoost=(u.tempBoost||0)+500; } }
  else if (e === 'draw1Ready') { draw(); const u=ownField[ownField.length-1]; if(u)u.summoningSickness=false; }
  else if (e === 'team200') ownField.filter((_,i)=>i<ownField.length-1).forEach(u=>u.tempBoost=(u.tempBoost||0)+200);
  else if (e === 'handGap700') { if (ownHand.length < (player===1?aiHand.length:hand.length)) { const u=ownField[ownField.length-1]; if(u)u.tempBoost=(u.tempBoost||0)+700; } }
  else if (e === 'draw2Don') { draw(); draw(); recoverUsedDon(player,1); }
  else if (e === 'shieldDraw') { if(player===1&&p1shield<3)p1shield++; if(player===2&&p2shield<3)p2shield++; draw(); }
  else if (e === 'debuffAll700') enemyField.forEach(u=>u.tempBoost=(u.tempBoost||0)-700);
  else if (e === 'drawlessReadyBoost') { const u=ownField[ownField.length-1]; if(u){u.summoningSickness=false;u.tempBoost=(u.tempBoost||0)+500;} }
  else if (e === 'reuseAbility') {
    if (lastResolvedAbility && !resolvingRepeatedAbility) {
      resolvingRepeatedAbility = true;
      applyCardEffect(lastResolvedAbility.card, lastResolvedAbility.player);
      resolvingRepeatedAbility = false;
    } else {
      log('⏳ No hay una habilidad anterior que reutilizar este turno.');
    }
  }
}

function activateUnitAbility(index, player = 1, fromAI = false) {
  const field = player === 1 ? p1Field : p2Field;
  const unit = field[index];
  if (!unit || !unit.active || unit.used || gameOver) return false;
  if (player === 1 && !canPlay()) return false;
  if (player === 2 && !fromAI && (localMode !== 'pvp' || active !== 2)) return false;

  if (unit.active === 'evolutionEntity') {
    if (!unit.invokedByEvolution) { log('🧬 Esta Entidad no fue invocada mediante Evolución.'); return false; }
    const enemyField = player === 1 ? p2Field : p1Field;
    const enemyHand = player === 1 ? aiHand : hand;
    if (!enemyField.length) { log('🧬 No hay personaje enemigo para devolver.'); return false; }
    enemyHand.push(enemyField.pop());
    unit.used = true;
    log('🧬 ' + unit.name + ': un personaje enemigo volvió a la mano.');
  } else if (unit.active === 'cantoStealOnly') {
    resolveCantoRoll(player, {forceSteal:true});
  } else if (unit.active === 'doubleCanto') {
    if (unit.doubleCantoUsed) { log('🎤 ' + unit.name + ': ya usó su doble Canto Infernal en esta partida.'); return false; }
    resolveCantoRoll(player); resolveCantoRoll(player); unit.doubleCantoUsed = true;
  } else if (unit.active === 'evolutionNextBoost') {
    if (player === 1) evolutionNextBoostP1 = true; else evolutionNextBoostP2 = true;
    unit.used = true;
    log('🧬 ' + unit.name + ': tu próxima Evolución obtiene +500 adicional.');
  } else if (unit.active === 'scry1') {
    const deckRef = player === 1 ? p1Deck : p2Deck;
    const preview = deckRef.slice(-1);
    if (preview.length) log('🔭 ' + unit.name + ': ' + preview[0].name + '.');
  } else if (unit.active === 'repeatCombo') {
    const comboUnit = field.find(card => card !== unit && card.combo && card.combo <= 3 && (card.comboBoost || card.comboEffect));
    if (!comboUnit) {
      log('⏳ No hay un efecto Combo 3 o inferior disponible para repetir.');
      return false;
    }
    applyCollisionCombo(comboUnit, player, true);
    log('💥 ' + unit.name + ' repitió el efecto Combo de ' + comboUnit.name + '.');
  } else if (unit.active === 'peek3') {
    const deckRef = player === 1 ? p1Deck : p2Deck;
    const preview = deckRef.slice(-3).reverse().map(card => card.name);
    log('🔭 ' + unit.name + ': ' + (preview.length ? preview.join(', ') : 'el mazo está vacío') + '.');
  } else {
    return false;
  }

  unit.used = true;
  render();
  return true;
}

function cardPowerBonus(c, player = 1) {
  const ownField = player === 1 ? p1Field : p2Field;
  const ownHand = player === 1 ? hand : aiHand;
  const ownGrave = player === 1 ? p1Grave : p2Grave;
  const enemyGrave = player === 1 ? p2Grave : p1Grave;
  const ownShield = player === 1 ? p1shield : p2shield;
  const ownDon = player === 1 ? p1DonReserve : p2DonReserve;
  let n = 0;
  if (c.onPlay === 'beastBonus' && (c.attached || 0) >= 2) n += 300;
  if (c.onPlay === 'kingBonus' && ownField.length >= 1) n += 500;
  if (c.onPlay === 'legendBonus' && ownShield <= 1) n += 700;
  if (c.onPlay === 'legendFieldBonus' && ownField.length >= 2) n += 600;
  if (c.onPlay === 'graveBonus300' && ownGrave.length >= 3) n += 300;
  if (c.onPlay === 'graveBonus500' && ownGrave.length >= 7) n += 500;
  if (c.onPlay === 'handGap500' && ownHand.length < (player === 1 ? aiHand.length : hand.length)) n += 500;
  if (c.onPlay === 'deathBoost700' && (ownGrave.length + enemyGrave.length) > 0) n += 700;
  if (c.onPlay === 'donPower500' && ownDon.length >= 3) n += 500;
  if (c.onPlay === 'awakenedBonus' && ownField.some(x => x.awakened)) n += 200;
  return n;
}

function triggerAwakening(c, player = 1, force = false) {
  if (!c || !c.awakening || c.awakened) return false;
  const info = c.awakening;
  const don = (player === 1 ? p1DonReserve : p2DonReserve).length;
  let ok = force || info.kind === 'self' || (info.kind === 'don' && don >= info.value);
  if (!ok) return false;
  c.awakened = true;
  if (player === 1) awakenedThisTurnP1 = true; else awakenedThisTurnP2 = true;
  log('✨ ' + c.name + ' DESPERTÓ.');
  if (info.boost) c.tempBoost = (c.tempBoost || 0) + info.boost;
  if (info.draw) { for (let i = 0; i < info.draw; i++) player === 1 ? drawP1() : drawP2(); }
  return true;
}

function notifyDefeat(card, ownerPlayer) {
  if (!card) return;
  const ownHand = ownerPlayer === 1 ? hand : aiHand;
  const ownDeck = ownerPlayer === 1 ? p1Deck : p2Deck;
  const ownGrave = ownerPlayer === 1 ? p1Grave : p2Grave;
  const ownField = ownerPlayer === 1 ? p1Field : p2Field;
  const ownLife = ownerPlayer === 1 ? p1hp : p2hp;
  const draw = ownerPlayer === 1 ? drawP1 : drawP2;
  battleStats.unitsDefeated++;

  if (card.onKO === 'draw2') { draw(); draw(); log('💀 ' + card.name + ': robaste 2 cartas.'); }
  else if (card.onKO === 'healshield') {
    if (ownerPlayer === 1 && p1shield < 5) p1shield++;
    if (ownerPlayer === 2 && p2shield < 5) p2shield++;
  }
  else if (card.onKO === 'donRecover') {
    const donDeck = ownerPlayer === 1 ? p1DonDeck : p2DonDeck;
    const donReserve = ownerPlayer === 1 ? p1DonReserve : p2DonReserve;
    if (donDeck.length) donReserve.push(donDeck.pop());
  }
  else if (card.onKO === 'peekTop') {
    if (ownDeck.length) log('🔭 ' + card.name + ': la carta superior es ' + ownDeck[ownDeck.length - 1].name + '.');
  }
  else if (card.onKO === 'recover2') {
    for (let i = 0; i < 2 && ownGrave.length; i++) ownHand.push(ownGrave.pop());
  }
  else if (card.onKO === 'returnSelf' || (card.onKO === 'returnSelfIfAwakened' && card.awakened) || (card.onKO === 'rabbitReturn' && ownLife <= 1)) {
    const index = ownGrave.indexOf(card);
    if (index >= 0) ownHand.push(ownGrave.splice(index, 1)[0]);
  }
  else if (card.onKO === 'rabbitDraw' && ownLife <= 1) draw();
  else if (card.onKO === 'hunterDraw' && ownLife <= 0) draw();

  ownField.forEach(ally => {
    if (ally.onAllyKO) ally.tempBoost = (ally.tempBoost || 0) + ally.onAllyKO;
    if (ally.onAllyKOPermanent) ally.power += ally.onAllyKOPermanent;
  });
  if (ownerPlayer === 1) rollShadows(1, card.name);
  if (ownerPlayer === 2) rollShadows(2, card.name);
}

function rollShadows(player, defeatedName) {
  const used = player === 1 ? shadowUsedP1 : shadowUsedP2;
  const disabled = player === 1 ? shadowsDisabledP1 : shadowsDisabledP2;
  if (used || disabled || gameOver) return;
  const aiShouldUse = player === 2 && localMode === 'ai' && p2Grave.length > 0 && (p2Grave.length >= 3 || aiHand.length <= 2 || p2Field.length === 0);
  const wants = aiShouldUse || (player !== 2 || localMode !== 'ai') && confirm((player === 1 ? '🌑 PLAYER 1' : '🌑 PLAYER 2') + ' puede activar SOMBRAS DEL INFIERNO porque ' + defeatedName + ' fue derrotado. ¿Lanzar el dado?');
  if (!wants) return;
  if (player === 1) shadowUsedP1 = true; else shadowUsedP2 = true;
  const roll = 1 + Math.floor(Math.random() * 6);
  log('🎲 Sombras del Infierno — ' + (player === 1 ? 'P1' : 'P2') + ' sacó ' + roll + '.');
  if (roll % 2 === 1) { log('🌑 No ocurre nada.'); showShadowStatus(); return; }
  let gr = player === 1 ? p1Grave : p2Grave, hd = player === 1 ? hand : aiHand;
  if (gr.length) {
    let c = gr.pop();
    hd.push(c);
    log('🌑 Sombras del Infierno: ' + c.name + ' vuelve a la mano.');
  }
  showShadowStatus();
  render();
}

function tryRabbitHole(player) {
  if (rabbitHoleUsed) return false;
  const source = player === 1 ? hand : aiHand;
  const ix = source.findIndex(c => c.effect === 'rabbitHole' || c.name === 'Leyendas Inmortales');
  if (ix < 0) return false;
  const card = source.splice(ix, 1)[0];
  rabbitHoleUsed = true;
  log((player === 1 ? '🐇 RABBIT HOLE: ' : '🤖 🐇 RABBIT HOLE: ') + card.name + ' ignoró el ataque final.');
  return true;
}


function isEvolutionEligible(card) {
  return !!card && typeof card.id === 'string' && (card.id.startsWith('R') || card.id.startsWith('E'));
}

function evolutionState(player) {
  return {
    hand: player === 1 ? hand : aiHand,
    field: player === 1 ? p1Field : p2Field,
    grave: player === 1 ? p1Grave : p2Grave,
    donReserve: player === 1 ? p1DonReserve : p2DonReserve
  };
}

function showEvolutionStatus() {
  const el = document.getElementById('evolutionStatus');
  if (!el) return;
  el.textContent = 'P1: ' + (evolutionUsedThisTurnP1 ? '✅ usada este turno' : '🧬 disponible') +
    ' · P2: ' + (evolutionUsedThisTurnP2 ? '✅ usada este turno' : '🧬 disponible') +
    ' · Sombras: ' + (shadowsDisabledP1 ? 'P1 🚫' : 'P1 🟢') + ' / ' + (shadowsDisabledP2 ? 'P2 🚫' : 'P2 🟢');
}

function triggerEvolutionLeaderEffects(player, invoked) {
  const leader = player === 1 ? selectedLeader : (localMode === 'pvp' && selectedLeaderP2 ? selectedLeaderP2 : aiLeader);
  if (!leader || !invoked) return;
  const field = player === 1 ? p1Field : p2Field;
  if (leader.id === 'E01') {
    const unit = field.find(c => c === invoked);
    if (unit) unit.tempBoost = (unit.tempBoost || 0) + 500;
  } else if (leader.id === 'E02') {
    const deck = player === 1 ? p1Deck : p2Deck;
    log('🔭 Lyra, Forma Evolucionada: mira las 3 primeras cartas. ' + (deck.slice(-3).reverse().map(c => c.name).join(' · ') || 'Mazo vacío') + '.');
  } else if (leader.id === 'E03') {
    const unit = field.find(c => (c.attached || 0) >= 2);
    if (unit) unit.tempBoost = (unit.tempBoost || 0) + 500;
  } else if (leader.id === 'E04') {
    const d = player === 1 ? p1DonDeck : p2DonDeck;
    const r = player === 1 ? p1DonReserve : p2DonReserve;
    if (d.length) r.push(d.pop());
  } else if (leader.id === 'E05') {
    if ((player === 1 ? p1hp : p2hp) <= 2) {
      if (player === 1 && p1shield < 3) p1shield++;
      if (player === 2 && p2shield < 3) p2shield++;
    }
  } else if (leader.id === 'E06') {
    const usedFlag = player === 1 ? evolutionImmediateAttackUsedP1 : evolutionImmediateAttackUsedP2;
    if (!usedFlag) {
      const unit = field.find(c => c === invoked) || field.find(c => !c.summoningSickness);
      if (unit) {
        unit.summoningSickness = false;
        unit.canAttackLeader = true;
        unit.tempBoost = (unit.tempBoost || 0) + 1000;
        if (player === 1) evolutionImmediateAttackUsedP1 = true; else evolutionImmediateAttackUsedP2 = true;
        log('🌌 EON: ' + unit.name + ' puede atacar inmediatamente y recibe +1000 este ataque.');
      }
    }
  }
  log('🧬 ' + leader.name + ' reaccionó a la Evolución Alarmante.');
}

function invokeCardFree(player, card, extraBoost = 0, immediateAttack = false) {
  const state = evolutionState(player);
  if (!card) return null;
  if (card.onlyEvolution === true || card.type === 'Personaje') {
    if (card.type === 'Personaje') {
      const unit = cloneCard(card);
      Object.assign(unit, GLTCG.rules.createUnitState(card));
      unit.invokedByEvolution = true;
      unit.summoningSickness = !immediateAttack;
      unit.tempBoost = (unit.tempBoost || 0) + extraBoost;
      state.field.push(unit);
      applyCardEffect(card, player, { evolved: true, unit });
      if (unit.awakening) triggerAwakening(unit, player, false);
      return unit;
    }
  }
  applyCardEffect(card, player, { evolved: true });
  state.grave.push(card);
  return card;
}

function activateEvolution(player = 1, sourceIndex = null, handIndex = null, options = {}) {
  if (gameOver) return false;
  if (player === 1 && !canPlay()) return false;
  if (player === 2 && !options.fromAI && (localMode !== 'pvp' || active !== 2)) return false;
  const usedThisTurn = player === 1 ? evolutionUsedThisTurnP1 : evolutionUsedThisTurnP2;
  if (usedThisTurn) {
    log('❌ Evolución Alarmante ya fue usada este turno.');
    return false;
  }
  const state = evolutionState(player);
  let source = Number.isInteger(sourceIndex) ? state.field[sourceIndex] : null;
  if (!source || !isEvolutionEligible(source)) {
    log('🧬 Debes elegir un personaje de Set 05 o Set 06 como sacrificio de Evolución.');
    return false;
  }
  let targetIndex = Number.isInteger(handIndex) ? handIndex : -1;
  if (targetIndex < 0 || !state.hand[targetIndex]) {
    const choices = state.hand.map((c, i) => i + ': ' + c.name + ' [' + c.type + ' · coste ' + c.cost + ']').join('\n');
    const answer = prompt('🧬 ELEGIR CARTA PARA EVOLUCIÓN\n\n' + choices + '\n\nEscribe el número de la carta que quieres invocar GRATIS:');
    if (answer === null) return false;
    targetIndex = Number(answer);
  }
  const target = state.hand[targetIndex];
  if (!target) return false;
  const leader = player === 1 ? selectedLeader : (localMode === 'pvp' && selectedLeaderP2 ? selectedLeaderP2 : aiLeader);
  if (target.onlyEvolution !== true && target.type === 'Personaje' && target.id === 'E36' && !isEvolutionEligible(source)) return false;
  const attached = source.attached || 0;
  if (attached) {
    for (let i = 0; i < attached; i++) state.donReserve.push({ id: 'DON_RETURN_' + Date.now() + '_' + i, name: 'DON!!', cost: 0, power: 0, type: 'Recurso', art: '🪙' });
  }
  state.field.splice(sourceIndex, 1);
  state.grave.push(source);
  state.hand.splice(targetIndex, 1);
  if (player === 1) evolutionUsedThisTurnP1 = true; else evolutionUsedThisTurnP2 = true;
  if (player === 1) shadowsDisabledP1 = true; else shadowsDisabledP2 = true;
  let extraBoost = options.extraBoost || 0;
  if (player === 1 && evolutionNextBoostP1) { extraBoost += 500; evolutionNextBoostP1 = false; }
  if (player === 2 && evolutionNextBoostP2) { extraBoost += 500; evolutionNextBoostP2 = false; }
  const immediate = !!options.immediateAttack;
  const invoked = invokeCardFree(player, target, extraBoost, immediate);
  if (invoked && invoked.type === 'Personaje') {
    invoked.invokedByEvolution = true;
    if (options.noDonThisTurn) invoked.noDonThisTurn = true;
    if (options.leaderAttack) invoked.canAttackLeader = true;
    if (options.immediateAttack) invoked.summoningSickness = false;
  }
  triggerEvolutionLeaderEffects(player, invoked && invoked.type === 'Personaje' ? invoked : null);
  log('🧬 EVOLUCIÓN ALARMANTE: ' + source.name + ' fue al cementerio y ' + target.name + ' fue invocado GRATIS. 🌑 Sombras del Infierno queda bloqueada para ' + (player === 1 ? 'P1' : 'P2') + '.');
  showEvolutionStatus();
  render();
  return true;
}

function evolutionFromEvent(player, options = {}) {
  const state = evolutionState(player);
  const sourceIndex = state.field.findIndex(isEvolutionEligible);
  if (sourceIndex < 0) {
    log('🧬 No hay un personaje de Set 05/06 disponible para evolucionar.');
    return false;
  }
  let candidates = state.hand.filter(c => c && (c.type === 'Personaje' || options.allowAny));
  if (options.minCost != null) candidates = candidates.filter(c => c.cost >= options.minCost);
  if (options.maxCost != null) candidates = candidates.filter(c => c.cost <= options.maxCost);
  if (!candidates.length) {
    log('🧬 No hay una carta válida en tu mano para esa evolución.');
    return false;
  }
  let target = options.targetId ? candidates.find(c => c.id === options.targetId) : null;
  if (!target) target = candidates.slice().sort((a,b) => (b.power || 0) - (a.power || 0) || b.cost - a.cost)[0];
  const handIndex = state.hand.indexOf(target);
  return activateEvolution(player, sourceIndex, handIndex, options);
}

function checkWin() {
  if (gameOver) return;
  if (p1hp <= 0) {
    gameOver = true;
    log("💀 PLAYER 1 perdió la partida.");
    if (document.getElementById("aiStatus")) document.getElementById("aiStatus").textContent = "🏆 P2 ganó.";
    render();
    setTimeout(() => {
      if (tournamentState.active) tournamentMatchFinished(false);
      else showSoloPostGame({ won: false, winner: 2 });
    }, 700);
  }
  if (p2hp <= 0) {
    gameOver = true;
    packOpenings += 10;
    saveCollection();
    log("🏆 ¡PLAYER 1 GANÓ! +10 aperturas de sobres de recompensa 🎁");
    if (document.getElementById("aiStatus")) document.getElementById("aiStatus").textContent = "💀 P2 perdió.";
    render();
    setTimeout(() => {
      if (tournamentState.active) tournamentMatchFinished(true);
      else showSoloPostGame({ won: true, winner: 1 });
    }, 700);
  }
}

/* ==========================================================================
   INTELIGENCIA ARTIFICIAL Y FLUJO DE TURNOS
   ========================================================================== */
async function aiTurn() {
  if (localMode === "pvp") return;
  const aiPolicy = GLTCG.ai.difficulties[tournamentState.active ? tournamentState.difficulty : undefined] || GLTCG.ai.getDifficulty();
  aiBusy = true;
  try {
  if (document.getElementById("aiStatus")) document.getElementById("aiStatus").textContent = "🟡 Robando carta...";
  setAIRealtime("Robando carta...");
  render();
  await delay(900);
  
  refreshTurnResources(2);
  
  if (document.getElementById("aiStatus")) document.getElementById("aiStatus").textContent = "🟡 Analizando...";
  setAIRealtime("Evaluando jugadas posibles...");
  render();
  await delay(1000);

  if (!cantoUsedP2 && aiLeader?.id?.startsWith('T')) {
    setAIRealtime('Activando Canto Infernal...');
    try {
      cantoUsedP2 = true;
      useCantoInfernal(2, {fromAI:true});
    } catch (error) {
      console.error('AI Canto error:', error);
      // El error queda en consola; la IA continúa sin ensuciar el registro de combate.
    }
    render();
    await delay(700);
  }

  // Set 06: la IA evalúa Evolución Alarmante como una jugada de alto impacto.
  if (!evolutionUsedThisTurnP2 && p2Field.some(isEvolutionEligible) && aiHand.length) {
    const evoTarget = GLTCG.ai.chooseEvolutionCard(aiHand, aiPolicy);
    const sourceIndex = p2Field.findIndex(isEvolutionEligible);
    const targetIndex = evoTarget ? aiHand.indexOf(evoTarget) : -1;
    const shouldEvolve = evoTarget && targetIndex >= 0 && (evoTarget.cost >= 5 || evoTarget.id === 'E35' || evoTarget.id === 'E36' || aiPolicy.label === 'Difícil');
    if (shouldEvolve) {
      setAIRealtime('Activando Evolución Alarmante...');
      render();
      await delay(700);
      try {
        activateEvolution(2, sourceIndex, targetIndex, { fromAI: true });
      } catch (error) {
        console.error('AI evolution error:', error);
      }
      render();
      await delay(700);
    }
  }

  // Asignación táctica de DON antes de invocar si hay intercambios críticos pendientes
  if (aiPolicy.smartTrades && p1Field.length > 0 && p2DonReserve.length > 0) {
    try {
      GLTCG.ai.attachDon(aiPolicy);
    } catch (error) {
      console.error('AI pre-play DON error:', error);
    }
  }
  
  let choices = aiHand.filter(c => c.cost <= p2DonReserve.length);
  if (p2Field.length >= (GLTCG.rules?.MAX_FIELD_UNITS || 5)) {
    choices = choices.filter(c => c.type === 'Evento' || c.type === 'Recurso');
  }
  let plays = 0;
  while (choices.length > 0 && plays < aiPolicy.maxPlays) {
    let c = GLTCG.ai.chooseCard(choices, aiPolicy), idx = aiHand.indexOf(c);
    if (idx < 0) break;
    if (document.getElementById("aiStatus")) document.getElementById("aiStatus").textContent = "🟠 Invocando " + c.name + "...";
    setAIRealtime("Jugando " + c.name + "...");
    let played = false;
    try {
      played = playCardForPlayer(2, idx, true);
    } catch (error) {
      console.error('AI card play error:', error);
      // Carta incompatible: se descarta de este plan y se intenta otra sin aviso visual.
      // Remove the failing choice from this planning pass so the loop cannot
      // get stuck repeatedly selecting the same card.
      choices = choices.filter(card => card !== c);
      continue;
    }
    if (!played) {
      choices = choices.filter(card => card !== c);
      continue;
    }
    plays++;
    render();
    await delay(800);
    choices = aiHand.filter(c => c.cost <= p2DonReserve.length);
    if (p2Field.length >= (GLTCG.rules?.MAX_FIELD_UNITS || 5)) {
      choices = choices.filter(c => c.type === 'Evento' || c.type === 'Recurso');
    }
  }

  try {
    GLTCG.ai.attachDon(aiPolicy);
  } catch (error) {
    console.error('AI DON attachment error:', error);
  }
  p2Field.forEach((unit, index) => {
    if (!unit.active || unit.used) return;
    try {
      activateUnitAbility(index, 2, true);
    } catch (error) {
      console.error('AI ability error:', error);
      // Habilidad incompatible: se marca como usada y se continúa.
      if (p2Field[index]) p2Field[index].used = true;
    }
  });
  
  const readyAttackers = p2Field.filter(u => !u.summoningSickness && !u.hasAttacked);
  let attacks = 0;
  for (let attacker of readyAttackers) {
    if (gameOver || attacks >= aiPolicy.maxAttacks) break;
    try {
      if (!attacker || !p2Field.includes(attacker)) continue;
      attacker.hasAttacked = true;
    battleStats.attacksMade++;
    attacks++;
    addCombo(2, 1);
    if (aiLeader?.id === 'C41' && comboHas(2, 2) && !collisionLeaderUsedP2) {
      attacker.tempBoost = (attacker.tempBoost || 0) + 500;
      collisionLeaderUsedP2 = true;
    }
    
    if (document.getElementById("aiStatus")) document.getElementById("aiStatus").textContent = "🔴 Atacando con " + attacker.name + "...";
    setAIRealtime(attacker.name + " está atacando...");
    render();
    await delay(1100);
    
    let power = totalPower(attacker) + (attacker.secondAttackBoost || 0);
    const canAttackLeader = !!attacker.canAttackLeader;
    attacker.secondAttackBoost = 0;
    attacker.canAttackLeader = false;
    
    if (!GLTCG.rules.canAttackLeaderThroughField({ canAttackLeader: canAttackLeader }, p1Field)) {
      let targetIdx = GLTCG.ai.chooseTarget(attacker, aiPolicy);
      if (targetIdx < 0 || targetIdx >= p1Field.length) {
        log('🤖 IA: no encontró un objetivo favorable; conserva a ' + attacker.name + ' sin arriesgarlo.');
        continue;
      }
      targetIdx = resolveBlockerTarget(p1Field, targetIdx, "PLAYER 1", power);
      let target = p1Field[targetIdx];
      if (!target) continue;
      let tPower = totalPower(target);
      
      log('⚔️ IA: ' + attacker.name + ' (' + power + ') ataca a tu ' + target.name + ' (' + tPower + ').');
      
      if (power > tPower) {
        p1Field.splice(targetIdx, 1);
        p1Grave.push(target);
        log("💥 Tu " + target.name + " fue derrotado. " + attacker.name + " sobrevive.");
        notifyDefeat(target, 1);
      } else if (power < tPower) {
        let attIdx = p2Field.indexOf(attacker);
        if (attIdx >= 0) p2Field.splice(attIdx, 1);
        p2Grave.push(attacker);
        log("💥 " + attacker.name + " de la IA fue derrotado.");
        notifyDefeat(attacker, 2);
      } else {
        p1Field.splice(targetIdx, 1);
        p1Grave.push(target);
        let attIdx = p2Field.indexOf(attacker);
        if (attIdx >= 0) p2Field.splice(attIdx, 1);
        p2Grave.push(attacker);
        log("💥 Empate: ambos personajes cayeron en combate.");
        notifyDefeat(target, 1);
        notifyDefeat(attacker, 2);
      }
    } else {
      const blockerIdx = resolveBlockerTarget(p1Field, -1, "PLAYER 1", power);
      if (blockerIdx >= 0) {
        let blocker = p1Field[blockerIdx];
        let bPower = totalPower(blocker);
        log('🛡️ PLAYER 1 bloqueó con ' + blocker.name + ' (' + bPower + ').');
        if (power > bPower) {
          p1Field.splice(blockerIdx, 1);
          p1Grave.push(blocker);
          log("💥 " + blocker.name + " fue derrotado defendiendo. " + attacker.name + " sobrevive.");
          notifyDefeat(blocker, 1);
        } else if (power < bPower) {
          let attIdx = p2Field.indexOf(attacker);
          if (attIdx >= 0) p2Field.splice(attIdx, 1);
          p2Grave.push(attacker);
          log("💥 " + attacker.name + " de la IA fue derrotado por el defensor.");
          notifyDefeat(attacker, 2);
        } else {
          p1Field.splice(blockerIdx, 1);
          p1Grave.push(blocker);
          let attIdx = p2Field.indexOf(attacker);
          if (attIdx >= 0) p2Field.splice(attIdx, 1);
          p2Grave.push(attacker);
          log("💥 Empate: ambos personajes cayeron en combate.");
          notifyDefeat(blocker, 1);
          notifyDefeat(attacker, 2);
        }
      } else {
        log("👑 Campo despejado: " + attacker.name + " ataca directamente a tu Líder.");
        if (p1shield > 0) {
          p1shield--;
          log("🛡️ ¡Tu escudo absorbió el golpe! Te quedan " + p1shield + " escudos.");
        } else if (p1hp <= 0 && tryRabbitHole(1)) {
          log("🐇 RABBIT HOLE: Tu Líder estaba en 0 ❤️ y evitó el golpe final.");
        } else {
          p1hp = Math.max(0, p1hp - 1);
          log("💥 ¡Daño directo a tu Líder! Vidas restantes: " + p1hp);
        }
      }
    }
    checkWin();
    render();
    await delay(700);
    } catch (error) {
      console.error('AI attack error:', error);
      // No abortar todo el turno por un atacante concreto.
      continue;
    }
  }

  // La IA también usa a su Líder: si el campo está despejado, presiona directamente.
  if (!gameOver && p1Field.length === 0 && !window._preventLeaderDamageP2 && p2leaderDon >= 0 && !leaderHasAttackedP2) {
    leaderHasAttackedP2 = true;
    battleStats.attacksMade++;
    battleStats.leaderAttacks++;
    log('👑 IA: su Líder ' + (aiLeader?.name || 'rival') + ' ataca directamente.');
    if (p1shield > 0) { p1shield--; log('🛡️ Tu escudo absorbió el ataque del Líder de la IA.'); }
    else if (p1hp <= 0 && tryRabbitHole(1)) { log('🐇 RABBIT HOLE: evitaste el golpe final del Líder de la IA.'); }
    else { p1hp = Math.max(0, p1hp - 1); log('💥 El Líder de la IA te hizo 1 ❤️ de daño.'); }
    checkWin();
    render();
    await delay(700);
  }
  
  checkWin();
  if (!gameOver) {
    p1Field.forEach(GLTCG.rules.resetUnitForTurn);
    p2Field.forEach(GLTCG.rules.resetUnitForTurn);
    leaderAbilityUsed = false;
    leaderAbilityUsedP2 = false;
    awakenedThisTurnP1 = false;
    awakenedThisTurnP2 = false;
    comboP2 = 0;
    comboBonusP2 = 0;
    collisionLeaderUsedP2 = false;
    evolutionUsedThisTurnP2 = false;
    evolutionNextBoostP2 = false;
    cantoUsedP2 = false; cantoModifierP2 = 0; cantoTurnHistoryP2 = [];
    comboP1 = 0;
    comboBonusP1 = 0;
    collisionLeaderUsedP1 = false;
    evolutionUsedThisTurnP1 = false;
    evolutionNextBoostP1 = false;
    cantoUsedP1 = false; cantoModifierP1 = 0; cantoTurnHistoryP1 = [];
    lastResolvedAbility = null;
    active = 1;
    turn++;
    refreshTurnResources(1);
    if (window.GLTCG?.visuals) window.GLTCG.visuals.showPhaseBanner("⚔️ TU TURNO", "¡Robaste carta y recargaste DON!!");
    if (document.getElementById("aiStatus")) document.getElementById("aiStatus").textContent = "🟢 Esperando";
    log("🔄 Comienza tu turno: recursos y personajes refrescados.");
  }
  } catch (error) {
    console.error('Error durante el turno de la IA:', error);
    // Último cortafuegos: nunca dejes al jugador atrapado en el turno de la IA.
    // El detalle queda en consola para depuración y no ensucia el registro de batalla.
    if (!gameOver) {
      p1Field.forEach(GLTCG.rules.resetUnitForTurn);
      p2Field.forEach(GLTCG.rules.resetUnitForTurn);
      cantoUsedP2 = false; cantoModifierP2 = 0; cantoTurnHistoryP2 = [];
      evolutionUsedThisTurnP2 = false; evolutionNextBoostP2 = false;
      active = 1;
      turn++;
      refreshTurnResources(1);
      if (window.GLTCG?.visuals) window.GLTCG.visuals.showPhaseBanner("⚔️ TU TURNO", "¡Recursos refrescados!");
      log('🔄 Comienza tu turno: recursos refrescados.');
    }
  } finally {
    aiBusy = false;
    render();
  }
}

function endTurn() {
  if (gameOver) return;
  emitBattleEvent('END_TURN', { player: active });
  if (localMode === "pvp") {
    if (active === 1) {
      active = 2;
      comboP1 = 0;
      comboBonusP1 = 0;
      collisionLeaderUsedP1 = false;
      evolutionUsedThisTurnP1 = false;
      evolutionNextBoostP1 = false;
      lastResolvedAbility = null;
      refreshTurnResources(2);
      if (window.GLTCG?.visuals) window.GLTCG.visuals.showPhaseBanner("⚔️ TURNO DE PLAYER 2", "¡Prepara tus defensas!");
      log("🔄 Turno de PLAYER 2: recursos refrescados.");
    } else {
      active = 1;
      comboP2 = 0;
      comboBonusP2 = 0;
      collisionLeaderUsedP2 = false;
      evolutionUsedThisTurnP2 = false;
      evolutionNextBoostP2 = false;
      lastResolvedAbility = null;
      refreshTurnResources(1);
      if (window.GLTCG?.visuals) window.GLTCG.visuals.showPhaseBanner("⚔️ TURNO DE PLAYER 1", "¡Comienza tu ofensiva!");
      log("🔄 Turno de PLAYER 1: recursos refrescados.");
    }
    render();
    return;
  }
  if (active !== 1 || aiBusy) return;
  active = 2;
  log("⏭️ Terminaste tu turno.");
  if (window.GLTCG?.visuals) window.GLTCG.visuals.showPhaseBanner("🤖 TURNO DE LA IA", "¡Defiende tu campo!");
  render();
  aiTurn();
}

function drawCard() {
  if (gameOver) return;
  const isP2 = localMode === "pvp" && active === 2;
  const alreadyDrawn = isP2 ? p2DrawnThisTurn : p1DrawnThisTurn;
  if (alreadyDrawn) {
    log("⚠️ Ya has recibido tu robo de carta automático de este turno.");
    return;
  }
  if (isP2) {
    p2DrawnThisTurn = true;
    drawP2();
    log("🎴 PLAYER 2 robó 1 carta.");
    render();
  } else if (canPlay()) {
    p1DrawnThisTurn = true;
    drawP1();
    log("🎴 Robaste 1 carta.");
    render();
  }
}

function reset() {
  const saved = localStorage.getItem('GLTCG_SELECTED_LEADER');
  if (saved) {
    const found = LEADERS.find(l => l.id === saved);
    if (found) selectedLeader = found;
  }
  leaderAbilityUsed = false;
  leaderAbilityUsedP2 = false;
  shadowUsedP1 = false;
  shadowUsedP2 = false;
  awakenedThisTurnP1 = false;
  awakenedThisTurnP2 = false;
  comboP1 = 0; comboP2 = 0; comboBonusP1 = 0; comboBonusP2 = 0;
  collisionLeaderUsedP1 = false; collisionLeaderUsedP2 = false;
  evolutionUsedThisTurnP1 = false; evolutionUsedThisTurnP2 = false;
  shadowsDisabledP1 = false; shadowsDisabledP2 = false;
  evolutionNextBoostP1 = false; evolutionNextBoostP2 = false;
  evolutionImmediateAttackUsedP1 = false; evolutionImmediateAttackUsedP2 = false;
  cantoUsedP1 = false; cantoUsedP2 = false; cantoModifierP1 = 0; cantoModifierP2 = 0; cantoTurnHistoryP1 = []; cantoTurnHistoryP2 = [];
  lastResolvedAbility = null;
  resolvingRepeatedAbility = false;
  
  p1Deck = makeDeck();
  p2Deck = (tournamentState.active && tournamentCurrentOpponent?.deck?.length) ? tournamentCurrentOpponent.deck.slice() : makeAIDeck();
  hand = []; aiHand = []; p1Field = []; p2Field = []; p1Grave = []; p2Grave = [];
  p1DonDeck = makeDonDeck(); p2DonDeck = makeDonDeck();
  p1DonReserve = []; p2DonReserve = [];
  
  p1hp = 5; p2hp = 5; p1shield = 3; p2shield = 3;
  p1max = 1; p2max = 2; p1don = 1; p2don = 2;
  p1leaderDon = 0; p2leaderDon = 0;
  leaderHasAttackedP1 = false; leaderHasAttackedP2 = false;
  active = 1; turn = 1; gameOver = false; aiBusy = false; boost = 0; p2Boost = 0;
  p1DrawnThisTurn = false; p2DrawnThisTurn = false;
  resetBattleStats();
  battleEventHistory = [];
  emitBattleEvent('GAME_START', { mode: localMode, leader1: selectedLeader.id, leader2: (localMode === 'pvp' ? selectedLeaderP2 : aiLeader).id });
  rabbitHoleUsed = false;
  
  for (let i = 0; i < 5; i++) { drawP1(); drawP2(); }
  drawP1();
  p1DrawnThisTurn = true;

  p1DonReserve = [{ id: 'DON_INIT_P1_' + Date.now() + '_0', name: 'DON!!', cost: 0, power: 0, type: 'Recurso', art: '🪙' }];
  p2DonReserve = [
    { id: 'DON_INIT_P2_' + Date.now() + '_0', name: 'DON!!', cost: 0, power: 0, type: 'Recurso', art: '🪙' },
    { id: 'DON_INIT_P2_' + Date.now() + '_1', name: 'DON!!', cost: 0, power: 0, type: 'Recurso', art: '🪙' }
  ];
  p1don = p1DonReserve.length; p2don = p2DonReserve.length;
  if (document.getElementById("log")) document.getElementById("log").innerHTML = "";
  log("🏴‍☠️ ¡Nueva partida iniciada! Robaste 1 carta reglamentaria.");
  render();
}

/* ==========================================================================
   RENDERIZADO DE LA ARENA Y ELEMENTOS VISUALES
   ========================================================================== */
function setText(id, value) {
  const e = document.getElementById(id);
  if (e) e.textContent = value;
}

function renderShields(id, n) {
  let b = document.getElementById(id);
  if (!b) return;
  b.innerHTML = "";
  for (let i = 0; i < n; i++) {
    let s = document.createElement("span");
    s.className = "shield";
    s.textContent = "🛡️";
    b.appendChild(s);
  }
}

function renderDon() {
  let a = document.getElementById("arenaP1DonPool");
  if (a) {
    a.innerHTML = "";
    p1DonReserve.forEach((_, i) => a.appendChild(makeDonToken(i)));
  }
  let b = document.getElementById("arenaP2DonPool");
  if (b) {
    b.innerHTML = "";
    p2DonReserve.forEach(() => {
      let d = document.createElement("div");
      d.className = "doncard";
      d.textContent = "🪙";
      b.appendChild(d);
    });
  }
  const leader = document.getElementById("arenaP1Leader");
  if (leader) setupDropZone(leader, "leader", 0);
}

function renderArena() {
  const vals = {
    p1hpArena: p1hp,
    p2hpArena: p2hp,
    p1shieldArena: p1shield,
    p2shieldArena: p2shield,
    p1donArena: p1DonReserve.length,
    p2donArena: p2DonReserve.length,
    arenaP1Power: 5000 + p1leaderDon * 1000
  };
  for (const [id, v] of Object.entries(vals)) {
    const e = document.getElementById(id);
    if (e) e.textContent = v;
  }
  
  const t = document.getElementById("arenaTurn");
  if (t) t.textContent = gameOver ? "🏁 PARTIDA TERMINADA" : localMode === "pvp" ? (active === 1 ? "⚔️ TURNO DE PLAYER 1" : "⚔️ TURNO DE PLAYER 2") : (active === 1 ? "⚔️ TU TURNO" : "🤖 TURNO DE LA IA");
  const s = document.getElementById("aiStatus");
  if (s) s.textContent = aiBusy ? "🤖 Actuando..." : "Esperando";
  
  const arenaLeader = document.getElementById("arenaP1Leader");
  if (arenaLeader) {
    setupDropZone(arenaLeader, "leader", 0);
    arenaLeader.onclick = (ev) => {
      if (ev.target && ev.target.classList.contains('btn-leader-canto')) return;
      if (!canPlay() || active !== 1) return;
      if (leaderHasAttackedP1) {
        log('❌ Tu Líder ya ha realizado su ataque este turno.');
        return;
      }
      attackSelection = 'leader';
      clearTargets();
      if (window.GLTCG?.visuals?.startTargeting) {
        window.GLTCG.visuals.startTargeting(arenaLeader);
      }
      const pwr = 5000 + p1leaderDon * 1000;
      if (p2Field.length === 0) {
        const rivalLeader = document.getElementById("arenaP2Leader");
        if (rivalLeader) {
          rivalLeader.classList.add("targetable");
          rivalLeader.onmouseenter = () => { if (window.GLTCG?.visuals?.updateTargetingToElement) window.GLTCG.visuals.updateTargetingToElement(rivalLeader); };
        }
        arenaLog("🎯 Tu Líder (💥 " + pwr + ") puede atacar directamente al Líder rival o sus escudos.");
      } else {
        arenaLog("🛡️ Tu Líder (💥 " + pwr + ") debe atacar a los defensores del campo enemigo.");
      }
      p2Field.forEach((_, j) => {
        const el = document.querySelector('#arenaP2Field .arena-unit[data-index="' + j + '"]');
        if (el) {
          el.classList.add("targetable");
          el.onmouseenter = () => { if (window.GLTCG?.visuals?.updateTargetingToElement) window.GLTCG.visuals.updateTargetingToElement(el); };
        }
      });
    };
  }
  
  const p1 = document.getElementById("arenaP1Field"), p2 = document.getElementById("arenaP2Field");
  
  // SET 07 — botón de Canto Infernal del Líder
  const leaderBox = document.getElementById('arenaP1Leader');
  if (leaderBox) {
    let cb = leaderBox.querySelector('.btn-leader-canto');
    if (selectedLeader.id && selectedLeader.id.startsWith('T')) {
      if (!cb) { cb = document.createElement('button'); cb.className='btn-leader-canto'; cb.textContent='🎤 Canto Infernal'; cb.onclick=(ev)=>{ev.stopPropagation();useCantoInfernal(1);render();}; leaderBox.appendChild(cb); }
      cb.disabled = !canPlay() || cantoUsedP1;
    } else if (cb) cb.remove();
  }
  // RENDER P1 FIELD UNITS
  if (p1) {
    p1.innerHTML = "";
    p1Field.forEach((c, i) => {
      const e = document.createElement("div");
      const isSick = !!c.summoningSickness;
      const isExhausted = !!c.hasAttacked;
      const canAttack = !isSick && !isExhausted && canPlay();
      const hasDon = (c.attached || 0) > 0;
      const abilityReady = !!c.active && !c.used;
      
      e.className = "arena-unit" + (isExhausted ? " exhausted" : "") + (isSick ? " summoning-sick" : "") + (canAttack ? " attack-ready" : "") + (hasDon ? " has-don" : "") + (abilityReady ? " ability-ready" : "");
      e.dataset.donCount = c.attached || 0;
      e.dataset.index = i;
      e.dataset.blocker = c.blocker ? "true" : "false";
      
      let statusBadge = '';
      if (isSick) statusBadge = '<div class="unit-status-badge status-sick" title="No puede atacar el turno en que entra">⏳ Invocado</div>';
      else if (isExhausted) statusBadge = '<div class="unit-status-badge status-exhausted" title="Ya atacó este turno">💤 Agotado</div>';
      else statusBadge = '<div class="unit-status-badge status-ready" title="Listo para atacar">⚔️ Listo</div>';
      
      e.innerHTML = '<div class="arena-art">' + (c.art || '🃏') + '</div>' +
                    '<h4>' + c.name + '</h4>' +
                    '<div class="arena-power">💥 ' + totalPower(c) + '</div>' +
                    '<div class="arena-dons">🪙 ' + (c.attached || 0) + ' DON' + (c.blocker ? ' · 🛡️' : '') + '</div>' +
                    statusBadge;
                    
      e.onclick = () => (attackSelection !== null && localMode === "pvp" && active === 2) ? chooseArenaCharacter(i) : null;
      setupDropZone(e, "unit", i);
      
      if ((localMode === "pvp" && active === 1) || localMode === "ai") {
        const b = document.createElement("button");
        b.className = "btn-unit-attack" + (canAttack ? "" : " disabled");
        b.textContent = "⚔️ Atacar";
        b.setAttribute('aria-label', 'Atacar con ' + c.name);
        b.disabled = !canAttack;
        b.onclick = ev => {
          ev.stopPropagation();
          chooseArenaAttack(i);
        };
        e.appendChild(b);
      }
      if (isEvolutionEligible(c) && !evolutionUsedThisTurnP1 && ((localMode === "pvp" && active === 1) || localMode === "ai")) {
        const evoButton = document.createElement("button");
        evoButton.className = "btn-unit-evolution";
        evoButton.textContent = "🧬 Evolucionar";
        evoButton.onclick = ev => { ev.stopPropagation(); activateEvolution(1, i); };
        e.appendChild(evoButton);
      }
      if (c.active && !c.used && ((localMode === "pvp" && active === 1) || localMode === "ai")) {
        const abilityButton = document.createElement("button");
        abilityButton.className = "btn-unit-ability";
        abilityButton.textContent = "✨ Activar";
        abilityButton.setAttribute('aria-label', 'Activar habilidad de ' + c.name);
        abilityButton.onclick = ev => {
          ev.stopPropagation();
          activateUnitAbility(i, 1);
        };
        e.appendChild(abilityButton);
      }
      p1.appendChild(e);
    });
  }
  
  // RENDER P2 FIELD UNITS
  if (p2) {
    p2.innerHTML = "";
    p2Field.forEach((c, i) => {
      const e = document.createElement("div");
      const isSick = !!c.summoningSickness;
      const isExhausted = !!c.hasAttacked;
      const canAttack = !isSick && !isExhausted && localMode === "pvp" && active === 2 && !gameOver;
      const hasDon = (c.attached || 0) > 0;
      const abilityReady = !!c.active && !c.used;
      
      e.className = "arena-unit enemy" + (isExhausted ? " exhausted" : "") + (isSick ? " summoning-sick" : "") + (canAttack ? " attack-ready" : "") + (hasDon ? " has-don" : "") + (abilityReady ? " ability-ready" : "");
      e.dataset.donCount = c.attached || 0;
      e.dataset.index = i;
      e.dataset.blocker = c.blocker ? "true" : "false";
      
      let statusBadge = '';
      if (isSick) statusBadge = '<div class="unit-status-badge status-sick">⏳ Invocado</div>';
      else if (isExhausted) statusBadge = '<div class="unit-status-badge status-exhausted">💤 Agotado</div>';
      else statusBadge = '<div class="unit-status-badge status-ready">⚔️ Listo</div>';
      
      e.innerHTML = '<div class="arena-art">' + (c.art || '🃏') + '</div>' +
                    '<h4>' + c.name + '</h4>' +
                    '<div class="arena-power">💥 ' + totalPower(c) + '</div>' +
                    '<div class="arena-dons">🪙 ' + (c.attached || 0) + ' DON' + (c.blocker ? ' · 🛡️' : '') + '</div>' +
                    statusBadge;
                    
      e.onclick = () => {
        if (localMode === "pvp" && p2AttackSelection !== null) chooseArenaCharacter(i);
        else if (attackSelection !== null) chooseArenaCharacter(i);
      };
      
      if (localMode === "pvp" && active === 2) {
        const b = document.createElement("button");
        b.className = "btn-unit-attack" + (canAttack ? "" : " disabled");
        b.textContent = "⚔️ Atacar";
        b.setAttribute('aria-label', 'Atacar con ' + c.name);
        b.disabled = !canAttack;
        b.onclick = ev => {
          ev.stopPropagation();
          chooseArenaAttackP2(i);
        };
        e.appendChild(b);
        if (isEvolutionEligible(c) && !evolutionUsedThisTurnP2) {
          const evoButton = document.createElement("button");
          evoButton.className = "btn-unit-evolution";
          evoButton.textContent = "🧬 Evolucionar";
          evoButton.onclick = ev => { ev.stopPropagation(); activateEvolution(2, i); };
          e.appendChild(evoButton);
        }
        if (c.active && !c.used) {
          const abilityButton = document.createElement("button");
          abilityButton.className = "btn-unit-ability";
          abilityButton.textContent = "✨ Activar";
          abilityButton.setAttribute('aria-label', 'Activar habilidad de ' + c.name);
          abilityButton.onclick = ev => {
            ev.stopPropagation();
            activateUnitAbility(i, 2);
          };
          e.appendChild(abilityButton);
        }
      }
      p2.appendChild(e);
    });
  }
  
  const enemyLeaderBox = document.getElementById('arenaP2Leader');
  if (enemyLeaderBox) {
    let cb2 = enemyLeaderBox.querySelector('.btn-leader-canto');
    if (localMode === 'pvp' && selectedLeaderP2?.id?.startsWith('T')) {
      if (!cb2) { cb2=document.createElement('button'); cb2.className='btn-leader-canto'; cb2.textContent='🎤 Canto Infernal'; cb2.onclick=(ev)=>{ev.stopPropagation();useCantoInfernal(2);render();}; enemyLeaderBox.appendChild(cb2); }
      cb2.disabled = active !== 2 || cantoUsedP2 || gameOver;
    } else if (cb2) cb2.remove();
  }

  // RENDER PLAYER HAND
  const h = document.getElementById("arenaHand");
  if (h) {
    h.innerHTML = "";
    const source = (localMode === "pvp" && active === 2) ? aiHand : hand;
    const who = (localMode === "pvp" && active === 2) ? "PLAYER 2" : "PLAYER 1";
    const lab = document.getElementById("activeHandLabel");
    if (lab) lab.textContent = gameOver ? "" : ("🃏 Mano de " + who);
    source.forEach((c, i) => {
      const e = document.createElement("div");
      const ownField = (localMode === "pvp" && active === 2) ? p2Field : p1Field;
      const isFieldFull = (c.type !== 'Evento' && c.type !== 'Recurso') && (ownField.length >= (GLTCG.rules?.MAX_FIELD_UNITS || 5));
      const canAfford = (c.cost || 0) <= (localMode === "pvp" && active === 2 ? p2DonReserve.length : p1DonReserve.length);
      const cardPlayable = canPlay() && canAfford && !isFieldFull;
      e.className = "card " + rarityClass(c.rarity) + (cardPlayable ? " card-playable" : " card-unavailable");
      e.setAttribute('aria-label', c.name + (cardPlayable ? ', carta jugable' : ', carta no disponible'));
      const rarityBadge = c.rarity ? '<span class="badge ' + rarityClass(c.rarity) + '">' + c.rarity + '</span>' : '';
      const typeBadge = c.type ? '<span class="badge badge-cyan">' + c.type + '</span>' : '';
      const fieldFullBadge = isFieldFull ? '<span class="badge" style="background:#dc2626;color:#fff;">🚫 CAMPO LLENO (5/5)</span>' : '';
      const abilityDesc = c.ability || c.description || (c.type === 'Personaje' ? 'Sin habilidad especial' : 'Efecto al jugar');
      
      e.innerHTML = '<div class="art">' + (c.art || '🃏') + '</div>' +
                    '<h3>' + c.name + '</h3>' +
                    '<div class="card-stats">⚡ Coste ' + c.cost + ' · 💥 Poder ' + c.power + '</div>' +
                    '<div class="card-badges">' + typeBadge + ' ' + rarityBadge + ' ' + fieldFullBadge + '</div>' +
                    '<div class="ability">' + abilityDesc + '</div>' +
                    '<button type="button" class="btn-play-card" aria-label="Jugar ' + c.name + '"' + (isFieldFull ? ' disabled' : '') + '>🃏 JUGAR</button>';
                    
      e.querySelector("button").onclick = (ev) => {
        ev.stopPropagation();
        localMode === "pvp" && active === 2 ? playCardP2(i) : playCard(i);
      };
      e.onclick = () => {
        localMode === "pvp" && active === 2 ? playCardP2(i) : playCard(i);
      };
      h.appendChild(e);
    });
  }
}

function render() {
  setText('arenaP1LeaderName', selectedLeader.name);
  setText('arenaP1LeaderAbility', selectedLeader.ability);
  setText('arenaP2LeaderName', (localMode === "pvp" && selectedLeaderP2) ? selectedLeaderP2.name : aiLeader.name);
  setText('arenaP2LeaderAbility', (localMode === "pvp" && selectedLeaderP2) ? selectedLeaderP2.ability : aiLeader.ability);
  setText('arenaP1LeaderArt', selectedLeader.art);
  setText('arenaP2LeaderArt', (localMode === "pvp" && selectedLeaderP2) ? selectedLeaderP2.art : aiLeader.art);
  
  setText("p1hp", p1hp);
  setText("p2hp", p2hp);
  setText("p1shield", p1shield);
  setText("p2shield", p2shield);
  setText("p1don", p1DonReserve.length);
  setText("p2don", p2DonReserve.length);
  setText("p1max", p1max);
  setText("p2max", p2max);
  setText("p1hand", hand.length);
  setText("p2hand", aiHand.length);
  setText("p1deck", p1Deck.length);
  setText("p2deck", p2Deck.length);
  setText("turn", turn);
  
  const p2t = document.getElementById("p2Title");
  if (p2t) p2t.textContent = localMode === "pvp" ? "👥 PLAYER 2 — LOCAL" : "🤖 PLAYER 2 — IA";
  
  setText("p1grave", p1Grave.length);
  setText("p2grave", p2Grave.length);
  showComboStatus();
  showShadowStatus();
  showEvolutionStatus();
  
  setText("pStatus", localMode === "pvp" ? (active === 1 ? "🟢 Turno de PLAYER 1" : "🔴 Turno de PLAYER 2") : (active === 1 ? "🟢 Puedes jugar" : "🔴 Esperando a la IA"));
  
  const db = document.getElementById("drawBtn"), eb = document.getElementById("endBtn");
  if (db) {
    const isP2 = localMode === "pvp" && active === 2;
    const drawn = isP2 ? p2DrawnThisTurn : p1DrawnThisTurn;
    db.disabled = !canPlay() || drawn;
    db.title = drawn ? "Ya has recibido tu robo de carta automático de este turno" : "Robar carta";
  }
  if (eb) eb.disabled = !canPlay();
  
  renderDon();
  renderArena();
  validateGameState();
}


/* ==========================================================================
   SISTEMA DE RESUMEN POST-PARTIDA ESTILO SOLO LEVELING (NOTIFICACIÓN DEL SISTEMA)
   ========================================================================== */
function animateSoloCounter(elementId, targetValue, duration = 1000) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const start = 0;
  const target = Math.max(0, Number(targetValue) || 0);
  const startTime = performance.now();
  
  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easeOut = 1 - Math.pow(1 - progress, 3);
    const current = Math.floor(start + (target - start) * easeOut);
    el.textContent = current.toLocaleString();
    if (progress < 1) {
      requestAnimationFrame(update);
    } else {
      el.textContent = target.toLocaleString();
    }
  }
  requestAnimationFrame(update);
}

function showSoloPostGame(result) {
  const modal = document.getElementById("soloPostGameModal");
  if (!modal) return;
  
  const won = !!result.won;
  battleStats.turns = Math.max(battleStats.turns, turn);
  
  // 1. Determinar Rango de Cazador
  let rank = 'C';
  let rankClass = 'rank-c';
  let rankDesc = 'RANGO CAZADOR';
  
  if (won) {
    if (p1hp >= 4 && battleStats.turns <= 7) {
      rank = 'S';
      rankClass = 'rank-s';
      rankDesc = 'GRAN LEYENDA';
    } else if (p1hp >= 3) {
      rank = 'A';
      rankClass = 'rank-a';
      rankDesc = 'DUELISTA MAESTRO';
    } else if (p1hp >= 2) {
      rank = 'B';
      rankClass = 'rank-b';
      rankDesc = 'DUELISTA ÉLITE';
    } else {
      rank = 'C';
      rankClass = 'rank-c';
      rankDesc = 'DUELISTA VETERANO';
    }
  } else {
    rank = 'E';
    rankClass = 'rank-e';
    rankDesc = 'DUELISTA APRENDIZ';
  }
  
  // 2. Banner de Resultado
  const banner = document.getElementById("soloResultBanner");
  const icon = document.getElementById("soloBannerIcon");
  const title = document.getElementById("soloResultTitle");
  const subtitle = document.getElementById("soloResultSubtitle");
  
  if (banner) {
    banner.className = "solo-result-banner" + (won ? "" : " defeat");
  }
  if (icon) icon.textContent = won ? "🏆" : "💀";
  if (title) title.textContent = won ? "¡VICTORIA EN EL DUELO!" : "DERROTA EN EL DUELO";
  if (subtitle) {
    subtitle.textContent = won
      ? "Has dominado el campo de batalla con tu mazo y estrategia"
      : "Tus defensas han caído. Ajusta tu mazo y vuelve a desafiar a tu rival.";
  }
  
  // 3. Badge de Rango con animación de estampa
  const badge = document.getElementById("soloRankBadge");
  const rankLetter = document.getElementById("soloRankLetter");
  const rankDescEl = document.getElementById("soloRankDesc");
  
  if (badge) {
    badge.className = "solo-rank-badge " + rankClass;
    badge.style.animation = "none";
    badge.offsetHeight; // Forzar reflow para reiniciar animación
    badge.style.animation = "";
  }
  if (rankLetter) rankLetter.textContent = rank;
  if (rankDescEl) rankDescEl.textContent = rankDesc;
  
  // 4. Calcular y Actualizar EXP, Nivel y Recompensas del Perfil
  const gainedExp = won ? (rank === 'S' ? 650 : rank === 'A' ? 500 : 400) : 150;
  const packsGained = won ? 10 : 2;
  const goldGained = won ? (rank === 'S' ? 800 : 500) : 100;
  
  let currentLevel = 1;
  let totalExp = 0;
  let hasLeveledUp = false;
  
  const k = currentUser();
  if (k) {
    const all = getAccounts();
    const u = all[k];
    if (u) {
      if (won) u.wins = (u.wins || 0) + 1;
      else u.losses = (u.losses || 0) + 1;
      
      const oldLevel = Number(u.level || 1);
      u.exp = (u.exp || 0) + gainedExp;
      totalExp = u.exp;
      const newLevel = Math.max(1, Math.floor(totalExp / 500) + 1);
      if (newLevel > oldLevel) {
        hasLeveledUp = true;
        u.level = newLevel;
      }
      currentLevel = u.level;
      u.packOpenings = (u.packOpenings || 0) + packsGained;
      saveAccounts(all);
    }
  } else {
    // Modo invitado / sin usuario registrado
    currentLevel = 1;
    totalExp = gainedExp;
  }
  
  // Guardar apertura de sobres
  packOpenings += packsGained;
  saveCollection();
  
  // 5. Renderizar Recompensas
  const lvlEl = document.getElementById("soloHunterLevel");
  const expEl = document.getElementById("soloExpGained");
  const barEl = document.getElementById("soloExpBarFill");
  const lvlUpAlert = document.getElementById("soloLevelUpAlert");
  
  if (lvlEl) lvlEl.textContent = "👑 Duelista Nivel " + currentLevel;
  if (expEl) expEl.textContent = "+" + gainedExp + " EXP";
  if (lvlUpAlert) lvlUpAlert.style.display = hasLeveledUp ? "block" : "none";
  
  if (barEl) {
    barEl.style.width = "0%";
    const expInCurrentLevel = (totalExp % 500);
    const expPct = Math.min(100, Math.max(10, Math.round((expInCurrentLevel / 500) * 100)));
    setTimeout(() => {
      barEl.style.width = expPct + "%";
    }, 200);
  }
  
  const lootPacksEl = document.getElementById("soloLootPacks");
  const lootGoldEl = document.getElementById("soloLootGold");
  if (lootPacksEl) lootPacksEl.textContent = "+" + packsGained + " Sobres";
  if (lootGoldEl) lootGoldEl.textContent = "+" + goldGained + " Monedas de Oro";
  
  // 6. Animar Contadores de Estadísticas
  animateSoloCounter("soloStatDamage", battleStats.damageDealt, 900);
  animateSoloCounter("soloStatKills", battleStats.unitsDefeated, 700);
  animateSoloCounter("soloStatDon", battleStats.donAttached, 700);
  animateSoloCounter("soloStatTurns", battleStats.turns, 600);

  const historyBox = document.getElementById('soloBattleHistory');
  if (historyBox) {
    historyBox.innerHTML = '';
    const events = battleEventHistory.filter(e => e.type === 'LOG' && e.message);
    if (!events.length) historyBox.innerHTML = '<div class="solo-history-entry">Sin eventos registrados.</div>';
    else events.slice().reverse().forEach((e, i) => {
      const row = document.createElement('div');
      row.className = 'solo-history-entry';
      row.textContent = '[' + String(e.turn || '?') + '] ' + e.message;
      historyBox.appendChild(row);
    });
  }
  
  // 7. Abrir Modal
  modal.classList.add("open");
}

function closeSoloPostGame() {
  const modal = document.getElementById("soloPostGameModal");
  if (modal) modal.classList.remove("open");
}

function claimSoloRewardsAndOpenPacks() {
  closeSoloPostGame();
  hideGame();
  openMainMenu();
  openPack();
}

function retrySoloBattle() {
  closeSoloPostGame();
  if (tournamentState.active) { startTournamentMatch(); return; }
  reset();
}

function exitSoloToMenu() {
  closeSoloPostGame();
  openMainMenu();
}

/* ==========================================================================
   EXPOSICIÓN EXPLÍCITA DE FUNCIONES USADAS POR onclick
   ========================================================================== */
// GitHub Pages/cachés pueden conservar una combinación antigua de index.html
// y game.js. Estas asignaciones garantizan que los botones inline encuentren
// las funciones del sistema de mazos en window.
window.handleDeckBuilderBack = handleDeckBuilderBack;
window.openDeckBuilder = openDeckBuilder;
window.openDeckBuilderFromMenu = openDeckBuilderFromMenu;
window.closeDeckBuilder = closeDeckBuilder;
window.closeDeck = closeDeckBuilder;
window.renderDeckBuilder = renderDeckBuilder;
window.renderDeckLibrary = renderDeckLibrary;
window.renderDeckTray = renderDeckTray;
window.renderDeckCostCurve = renderDeckCostCurve;
window.renderDeckCardsList = renderDeckCardsList;
window.saveCurrentDeckAs = saveCurrentDeckAs;
window.overwriteActiveDeck = overwriteActiveDeck;
window.loadSavedDeck = loadSavedDeck;
window.duplicateSavedDeck = duplicateSavedDeck;
window.useActiveDeck = useActiveDeck;
window.deleteSavedDeck = deleteSavedDeck;
window.clearCustomDeck = clearCustomDeck;
window.loadStarterDeckPreset = loadStarterDeckPreset;
window.openSaveDeckModal = openSaveDeckModal;
window.closeSaveDeckModal = closeSaveDeckModal;
window.confirmSaveDeckModal = confirmSaveDeckModal;
window.openDeckShareModal = openDeckShareModal;
window.closeDeckShareModal = closeDeckShareModal;
window.copyDeckCodeToClipboard = copyDeckCodeToClipboard;
window.importDeckFromCode = importDeckFromCode;
window.toggleSavedDecksPanel = toggleSavedDecksPanel;
window.onDeckSearchInput = onDeckSearchInput;
window.clearDeckSearch = clearDeckSearch;
window.onDeckSetChange = onDeckSetChange;
window.onDeckSortChange = onDeckSortChange;
window.setDeckTypeFilter = setDeckTypeFilter;
window.setDeckCostFilter = setDeckCostFilter;
window.openDeckLeaderPicker = openDeckLeaderPicker;
window.closeDeckLeaderPicker = closeDeckLeaderPicker;
window.selectLeaderForCustomDeck = selectLeaderForCustomDeck;
window.removeOneCardFromCustomDeck = removeOneCardFromCustomDeck;
window.openSets = openSets;
window.closeSets = closeSets;
window.filterSetsBySet = filterSetsBySet;
window.filterSetsByType = filterSetsByType;
window.onSetsSearch = onSetsSearch;
window.clearSetsSearch = clearSetsSearch;
window.renderSetsCatalog = renderSetsCatalog;

/* ==========================================================================
   EVENT LISTENERS Y ATADURAS GLOBALES
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
  const drawBtn = document.getElementById("drawBtn");
  const endBtn = document.getElementById("endBtn");
  const resetBtn = document.getElementById("resetBtn");
  
  if (drawBtn) drawBtn.onclick = drawCard;
  if (endBtn) endBtn.onclick = endTurn;
  if (resetBtn) resetBtn.onclick = reset;

  const arenaEl = document.getElementById("battleArena");
  if (arenaEl) {
    arenaEl.addEventListener("click", (e) => {
      // Si el clic fue en un área vacía del tablero y no en un objetivo interactivo:
      if (e.target.id === "battleArena" || e.target.id === "arenaFloor3D" || e.target.classList.contains("arena-zone")) {
        if (attackSelection !== null || p2AttackSelection !== null) {
          attackSelection = null;
          p2AttackSelection = null;
          clearTargets();
          arenaLog("✖️ Selección de objetivo cancelada.");
        }
      }
    });
  }
  
  saveCollection();
  hideGame();
});

// Tecla Escape para retroceso universal y cancelación de ataque
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (attackSelection !== null || p2AttackSelection !== null) {
      attackSelection = null;
      p2AttackSelection = null;
      clearTargets();
      arenaLog("✖️ Selección de objetivo cancelada.");
      return;
    }
    const deckModal = document.getElementById('deckModal');
    if (deckModal && deckModal.classList.contains('open')) {
      handleDeckBuilderBack();
      return;
    }
    const packModal = document.getElementById('packModal');
    if (packModal && packModal.classList.contains('open')) {
      closePack();
      openMainMenu();
      return;
    }
    const setsModal = document.getElementById('setsModal');
    if (setsModal && setsModal.classList.contains('open')) {
      closeSets();
      return;
    }
    const leaderModal = document.getElementById('leaderModal');
    if (leaderModal && leaderModal.classList.contains('open')) {
      closeLeaderModal();
      return;
    }
    const tournamentModal = document.getElementById('tournamentModal');
    if (tournamentModal && tournamentModal.classList.contains('open')) {
      closeTournamentModal();
      openMainMenu();
      return;
    }
    const localModal = document.getElementById('localModeModal');
    if (localModal && localModal.classList.contains('open')) {
      closeLocalMode();
      openMainMenu();
      return;
    }
    const hubModal = document.getElementById('playerHubModal');
    if (hubModal && hubModal.classList.contains('open')) {
      closePlayerHub();
      return;
    }
  }
});