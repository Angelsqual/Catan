const NS = 'http://www.w3.org/2000/svg';
const HUMAN_ID = 0;

const RES = {
  wood: { name: 'Madera', color: '#2f7a42', icon: '🌲' },
  brick: { name: 'Arcilla', color: '#b8643a', icon: '🧱' },
  sheep: { name: 'Lana', color: '#8abf49', icon: '🐑' },
  wheat: { name: 'Trigo', color: '#dfb93f', icon: '🌾' },
  ore: { name: 'Mineral', color: '#8f98a0', icon: '⛰️' },
  desert: { name: 'Desierto', color: '#d8bf86', icon: '🏜️' }
};

const THEMES = {
  red: { color: '#d44b45', badge: '🔥', pokemon: 'Charmander', settlementIcon: '🦎', cityIcon: '🐲', roadIcon: '🔥' },
  blue: { color: '#3d79d6', badge: '💧', pokemon: 'Squirtle', settlementIcon: '🐢', cityIcon: '🐢💦', roadIcon: '💧' },
  green: { color: '#2f9b59', badge: '🌿', pokemon: 'Bulbasaur', settlementIcon: '🦖', cityIcon: '🌺', roadIcon: '🌿' },
  yellow: { color: '#d9c72f', badge: '⚡', pokemon: 'Pikachu', settlementIcon: '🐭', cityIcon: '⚡🐭', roadIcon: '⚡' }
};

const COSTS = {
  road: { wood: 1, brick: 1 },
  settlement: { wood: 1, brick: 1, sheep: 1, wheat: 1 },
  city: { ore: 3, wheat: 2 }
};

const TOKEN_WEIGHT = { 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 8: 5, 9: 4, 10: 3, 11: 2, 12: 1 };

const boardEl = document.getElementById('board');
const turnInfo = document.getElementById('turnInfo');
const diceInfo = document.getElementById('diceInfo');
const playersEl = document.getElementById('players');
const logEl = document.getElementById('log');
const rollBtn = document.getElementById('rollBtn');
const endTurnBtn = document.getElementById('endTurnBtn');
const modeInfo = document.getElementById('modeInfo');
const tradeGive = document.getElementById('tradeGive');
const tradeGet = document.getElementById('tradeGet');
const tradeBtn = document.getElementById('tradeBtn');
const setupOverlay = document.getElementById('setupOverlay');
const playerThemeSelect = document.getElementById('playerThemeSelect');
const startGameBtn = document.getElementById('startGameBtn');
const die1 = document.getElementById('die1');
const die2 = document.getElementById('die2');

const rows = [3, 4, 5, 4, 3];
const size = 86;
const hexW = Math.sqrt(3) * size;
const stepY = 1.5 * size;
const cx = 640;
const topY = 130;

const BASE_TILE_TYPES = [
  'wood', 'wood', 'wood', 'wood',
  'brick', 'brick', 'brick',
  'sheep', 'sheep', 'sheep', 'sheep',
  'wheat', 'wheat', 'wheat', 'wheat',
  'ore', 'ore', 'ore',
  'desert'
];
const BASE_TOKEN_NUMBERS = [5, 2, 6, 3, 8, 10, 9, 12, 11, 4, 8, 10, 9, 4, 5, 6, 3, 11];

let players = [];

const state = {
  started: false,
  current: 0,
  rolled: false,
  mode: 'none',
  gameOver: false,
  phase: 'setup_settlement',
  robberTile: 9,
  awaitingRobberPlacement: false,
  setupOrder: [0, 1, 2, 3, 3, 2, 1, 0],
  setupStep: 0,
  setupSettlementVertex: null,
  cpuThinking: false,
  rollingDice: false,
  tiles: [],
  vertices: [],
  edges: [],
  boardTypes: [],
  boardNumbers: [],
  vertexOwner: new Map(),
  edgeOwner: new Map()
};

function log(msg) {
  const item = document.createElement('div');
  item.className = 'log-item';
  item.textContent = msg;
  logEl.prepend(item);
}

function isCpuTurn() {
  return state.started && players[state.current]?.cpu;
}

function points(cxArg, cyArg, r) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const ang = ((60 * i - 30) * Math.PI) / 180;
    pts.push([cxArg + r * Math.cos(ang), cyArg + r * Math.sin(ang)]);
  }
  return pts;
}

function key(x, y) {
  return `${Math.round(x)}:${Math.round(y)}`;
}

function edgeKey(a, b) {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

function svg(tag, attrs = {}) {
  const e = document.createElementNS(NS, tag);
  Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
  return e;
}

function shuffle(list) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function generateRandomBoardSetup() {
  state.boardTypes = shuffle(BASE_TILE_TYPES);
  state.boardNumbers = shuffle(BASE_TOKEN_NUMBERS);
}

function buildBoardGraph() {
  state.tiles = [];
  state.vertices = [];
  state.edges = [];
  const vMap = new Map();
  const eMap = new Map();
  let tIndex = 0;
  let nIndex = 0;

  rows.forEach((count, r) => {
    const y = topY + r * stepY;
    const startX = cx - ((count - 1) * hexW) / 2;
    for (let i = 0; i < count; i++) {
      const x = startX + i * hexW;
      const corners = points(x, y, size);
      const cornerIds = corners.map(([vx, vy]) => {
        const k = key(vx, vy);
        if (!vMap.has(k)) {
          const id = state.vertices.length;
          vMap.set(k, id);
          state.vertices.push({ id, x: vx, y: vy, adj: new Set(), tiles: [] });
        }
        return vMap.get(k);
      });

      for (let c = 0; c < 6; c++) {
        const a = cornerIds[c];
        const b = cornerIds[(c + 1) % 6];
        const k = edgeKey(a, b);
        if (!eMap.has(k)) {
          const edge = { key: k, a, b };
          eMap.set(k, edge);
          state.edges.push(edge);
        }
        state.vertices[a].adj.add(b);
        state.vertices[b].adj.add(a);
      }

      cornerIds.forEach((id) => state.vertices[id].tiles.push(tIndex));
      state.tiles.push({
        id: tIndex,
        x,
        y,
        type: state.boardTypes[tIndex],
        number: state.boardTypes[tIndex] === 'desert' ? null : state.boardNumbers[nIndex++],
        vertices: cornerIds
      });
      tIndex += 1;
    }
  });
}

function resetStateForNewGame() {
  state.current = 0;
  state.rolled = false;
  state.mode = 'settlement';
  state.gameOver = false;
  state.phase = 'setup_settlement';
  state.robberTile = 0;
  state.awaitingRobberPlacement = false;
  state.setupStep = 0;
  state.setupSettlementVertex = null;
  state.cpuThinking = false;
  state.rollingDice = false;
  state.vertexOwner = new Map();
  state.edgeOwner = new Map();
  diceInfo.textContent = 'Sin tirada aún.';
  die1.textContent = '1';
  die2.textContent = '1';
  logEl.innerHTML = '';
}

function configurePlayers(humanThemeKey) {
  const order = [humanThemeKey, ...Object.keys(THEMES).filter((k) => k !== humanThemeKey)];
  players = order.map((themeKey, idx) => {
    const t = THEMES[themeKey];
    return {
      id: idx,
      themeKey,
      color: t.color,
      badge: t.badge,
      pokemon: t.pokemon,
      cpu: idx !== HUMAN_ID,
      name: idx === HUMAN_ID ? `Tú (${t.pokemon})` : `CPU ${t.pokemon}`,
      res: { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 },
      roads: new Set(),
      settlements: new Set(),
      cities: new Set(),
      points: 0
    };
  });
}

function canBuildSettlementAt(vId) {
  if (state.vertexOwner.has(vId)) return false;
  for (const n of state.vertices[vId].adj) {
    if (state.vertexOwner.has(n)) return false;
  }
  return true;
}

function connectedToPlayer(vId, player) {
  for (const e of player.roads) {
    const [a, b] = e.split('-').map(Number);
    if (a === vId || b === vId) return true;
  }
  return false;
}

function canAttachRoad(player, edge) {
  if ([...player.settlements, ...player.cities].some((v) => edge.a === v || edge.b === v)) return true;
  for (const r of player.roads) {
    const [a, b] = r.split('-').map(Number);
    if ([a, b].includes(edge.a) || [a, b].includes(edge.b)) return true;
  }
  return false;
}

function hasResources(player, cost) {
  return Object.entries(cost).every(([k, v]) => (player.res[k] || 0) >= v);
}

function spend(player, cost) {
  Object.entries(cost).forEach(([k, v]) => { player.res[k] -= v; });
}

function gain(player, resource, amount = 1) {
  player.res[resource] += amount;
}

function vertexProductionScore(vId) {
  return state.vertices[vId].tiles.reduce((acc, tileId) => {
    const tile = state.tiles[tileId];
    if (!tile.number || tile.type === 'desert') return acc;
    return acc + (TOKEN_WEIGHT[tile.number] || 0);
  }, 0);
}

function grantSecondSettlementResources(player, vId) {
  state.vertices[vId].tiles.forEach((tileId) => {
    const tile = state.tiles[tileId];
    if (tile.type !== 'desert') gain(player, tile.type, 1);
  });
  log(`${player.name} recibe recursos por su 2º pueblo inicial.`);
}

function getCandidateSetupSettlements() {
  return state.vertices.map((v) => v.id).filter(canBuildSettlementAt).sort((a, b) => vertexProductionScore(b) - vertexProductionScore(a));
}

function getEdgesTouchingVertex(vId) {
  return state.edges.filter((e) => (e.a === vId || e.b === vId) && !state.edgeOwner.has(e.key));
}

function cpuChooseSetupSettlement() {
  return getCandidateSetupSettlements()[0] ?? null;
}

function cpuChooseSetupRoad(settlementVertex) {
  const edges = getEdgesTouchingVertex(settlementVertex);
  return edges.sort((e1, e2) => {
    const far1 = e1.a === settlementVertex ? e1.b : e1.a;
    const far2 = e2.a === settlementVertex ? e2.b : e2.a;
    return vertexProductionScore(far2) - vertexProductionScore(far1);
  })[0] ?? null;
}

function advanceSetup() {
  state.setupStep += 1;
  if (state.setupStep >= state.setupOrder.length) {
    state.phase = 'main';
    state.current = HUMAN_ID;
    state.mode = 'none';
    log('✅ Colocación inicial terminada. Empieza la partida normal.');
    refresh();
    return;
  }
  state.current = state.setupOrder[state.setupStep];
  state.phase = 'setup_settlement';
  state.setupSettlementVertex = null;
  state.mode = 'settlement';
  log(`Colocación inicial: ${players[state.current].name} coloca pueblo.`);
  refresh();
  maybeScheduleCpuTurn();
}

function handleSetupSettlement(vId) {
  const p = players[state.current];
  if (!canBuildSettlementAt(vId)) return log('Regla de distancia: aquí no cabe pueblo inicial.');

  state.vertexOwner.set(vId, p.id);
  p.settlements.add(vId);
  p.points += 1;
  state.setupSettlementVertex = vId;
  state.phase = 'setup_road';
  state.mode = 'road';

  if (p.settlements.size === 2) grantSecondSettlementResources(p, vId);

  log(`${p.name} coloca pueblo inicial. Ahora coloca carretera conectada.`);
  refresh();
  maybeScheduleCpuTurn();
}

function handleSetupRoad(edge) {
  const p = players[state.current];
  if (state.edgeOwner.has(edge.key)) return log('Esa carretera ya existe.');
  const s = state.setupSettlementVertex;
  if (s == null || (edge.a !== s && edge.b !== s)) return log('La carretera inicial debe tocar tu pueblo recién colocado.');

  state.edgeOwner.set(edge.key, p.id);
  p.roads.add(edge.key);
  log(`${p.name} coloca carretera inicial.`);
  advanceSetup();
}

function tryBuildRoad(edge) {
  if (state.gameOver) return;

  if (state.phase !== 'main') {
    if (state.phase === 'setup_road') handleSetupRoad(edge);
    return;
  }

  if (state.mode !== 'road' || state.awaitingRobberPlacement) return;
  const p = players[state.current];
  if (!state.rolled) return log('Debes tirar dados antes de construir.');
  if (state.edgeOwner.has(edge.key)) return log('Esa carretera ya existe.');
  if (!hasResources(p, COSTS.road)) return log('No tienes recursos para carretera.');
  if (!canAttachRoad(p, edge)) return log('La carretera debe conectar con tu red.');

  spend(p, COSTS.road);
  state.edgeOwner.set(edge.key, p.id);
  p.roads.add(edge.key);
  log(`${p.name} construye una carretera.`);
  refresh();
}

function tryBuildSettlement(vId) {
  if (state.gameOver) return;

  if (state.phase !== 'main') {
    if (state.phase === 'setup_settlement') handleSetupSettlement(vId);
    return;
  }

  if (state.mode !== 'settlement' || state.awaitingRobberPlacement) return;
  const p = players[state.current];
  if (!state.rolled) return log('Debes tirar dados antes de construir.');
  if (!canBuildSettlementAt(vId)) return log('Regla de distancia: aquí no cabe pueblo.');
  if (!connectedToPlayer(vId, p)) return log('Debes conectar el pueblo a tu red.');
  if (!hasResources(p, COSTS.settlement)) return log('No tienes recursos para pueblo.');

  spend(p, COSTS.settlement);
  state.vertexOwner.set(vId, p.id);
  p.settlements.add(vId);
  p.points += 1;
  log(`${p.name} construye un pueblo (+1 punto).`);
  checkWin(p);
  refresh();
}

function tryBuildCity(vId) {
  if (state.gameOver || state.phase !== 'main' || state.mode !== 'city' || state.awaitingRobberPlacement) return;
  const p = players[state.current];
  if (!state.rolled) return log('Debes tirar dados antes de construir.');
  if (!p.settlements.has(vId)) return log('Solo puedes mejorar tu propio pueblo.');
  if (!hasResources(p, COSTS.city)) return log('No tienes recursos para ciudad.');

  spend(p, COSTS.city);
  p.settlements.delete(vId);
  p.cities.add(vId);
  p.points += 1;
  log(`${p.name} mejora a ciudad (+1 punto).`);
  checkWin(p);
  refresh();
}

function discardHalf(player) {
  const keys = ['wood', 'brick', 'sheep', 'wheat', 'ore'];
  const total = keys.reduce((s, k) => s + player.res[k], 0);
  if (total <= 7) return;
  let discards = Math.floor(total / 2);
  while (discards > 0) {
    const maxK = [...keys].sort((a, b) => player.res[b] - player.res[a])[0];
    if (player.res[maxK] > 0) { player.res[maxK] -= 1; discards -= 1; } else break;
  }
  log(`${player.name} descarta la mitad por sacar 7.`);
}

function moveRobberToTile(tileId) {
  if (!state.awaitingRobberPlacement) return;
  state.robberTile = tileId;
  state.awaitingRobberPlacement = false;

  const current = players[state.current];
  const victims = new Set();
  state.tiles[tileId].vertices.forEach((vId) => {
    const owner = state.vertexOwner.get(vId);
    if (owner != null && owner !== current.id) victims.add(owner);
  });

  if (victims.size) {
    const victim = players[[...victims][Math.floor(Math.random() * victims.size)]];
    const avail = Object.entries(victim.res).filter(([, value]) => value > 0);
    if (avail.length) {
      const [resource] = avail[Math.floor(Math.random() * avail.length)];
      victim.res[resource] -= 1;
      current.res[resource] += 1;
      log(`${current.name} roba 1 ${RES[resource].name} a ${victim.name} con el ladrón.`);
    }
  }

  refresh();
}

function distributeResources(total) {
  state.tiles.forEach((t) => {
    if (t.number !== total || t.id === state.robberTile || t.type === 'desert') return;
    t.vertices.forEach((vId) => {
      const owner = state.vertexOwner.get(vId);
      if (owner == null) return;
      gain(players[owner], t.type, players[owner].cities.has(vId) ? 2 : 1);
    });
  });
}

function animateDice(a, b) {
  state.rollingDice = true;
  die1.classList.add('rolling');
  die2.classList.add('rolling');

  return new Promise((resolve) => {
    let ticks = 0;
    const timer = setInterval(() => {
      die1.textContent = String(Math.floor(Math.random() * 6) + 1);
      die2.textContent = String(Math.floor(Math.random() * 6) + 1);
      ticks += 1;
      if (ticks >= 10) {
        clearInterval(timer);
        die1.classList.remove('rolling');
        die2.classList.remove('rolling');
        die1.textContent = String(a);
        die2.textContent = String(b);
        state.rollingDice = false;
        resolve();
      }
    }, 70);
  });
}

async function rollDice() {
  if (state.gameOver || state.phase !== 'main' || state.rolled || state.rollingDice) return;

  const a = Math.floor(Math.random() * 6) + 1;
  const b = Math.floor(Math.random() * 6) + 1;
  const total = a + b;

  await animateDice(a, b);

  state.rolled = true;
  diceInfo.textContent = `Resultado: ${a} + ${b} = ${total}`;

  if (total === 7) {
    players.forEach(discardHalf);
    state.awaitingRobberPlacement = true;
    log('Salió 7: mueve el ladrón (la CPU lo hace sola en su turno).');
  } else {
    distributeResources(total);
    log(`Se reparten recursos para el ${total}.`);
  }
  refresh();
}

function endTurn() {
  if (state.gameOver || state.phase !== 'main' || !state.rolled || state.awaitingRobberPlacement) return;
  state.current = (state.current + 1) % players.length;
  state.rolled = false;
  state.mode = 'none';
  diceInfo.textContent = 'Sin tirada aún.';
  log(`Turno para ${players[state.current].name}.`);
  refresh();
  maybeScheduleCpuTurn();
}

function setMode(mode) {
  state.mode = state.phase !== 'main' ? (state.phase === 'setup_settlement' ? 'settlement' : 'road') : mode;
  modeInfo.textContent = `Modo actual: ${state.mode === 'none' ? 'seleccionar' : state.mode}.`;
  document.querySelectorAll('.mode-btn').forEach((b) => b.classList.toggle('active', b.dataset.mode === state.mode));
}

function renderBoard() {
  boardEl.innerHTML = '';

  state.tiles.forEach((t) => {
    const polyPts = points(t.x, t.y, size).map(([x, y]) => `${x},${y}`).join(' ');
    const poly = svg('polygon', { points: polyPts, fill: RES[t.type].color, stroke: '#00000070', 'stroke-width': '3' });
    poly.style.cursor = state.awaitingRobberPlacement && !isCpuTurn() ? 'pointer' : 'default';
    poly.addEventListener('click', () => { if (!isCpuTurn()) moveRobberToTile(t.id); });
    boardEl.appendChild(poly);

    const icon = svg('text', { x: t.x, y: t.y - 18, 'text-anchor': 'middle', 'font-size': '30' });
    icon.textContent = RES[t.type].icon;
    boardEl.appendChild(icon);

    boardEl.appendChild(svg('circle', { cx: t.x, cy: t.y + 22, r: 25, fill: '#f4ebd8', stroke: '#8f6f43', 'stroke-width': '4' }));
    const num = svg('text', { x: t.x, y: t.y + 32, 'text-anchor': 'middle', 'font-size': '30', class: 'tile-number', fill: t.number === 6 || t.number === 8 ? '#c51414' : '#222' });
    num.textContent = t.number ?? '🦹';
    boardEl.appendChild(num);

    if (state.robberTile === t.id) {
      const rb = svg('text', { x: t.x + 35, y: t.y - 8, 'font-size': '28', class: 'robber' });
      rb.textContent = '🦹';
      boardEl.appendChild(rb);
    }
  });

  state.edges.forEach((e) => {
    const a = state.vertices[e.a];
    const b = state.vertices[e.b];
    const owner = state.edgeOwner.get(e.key);

    const baseLine = svg('line', {
      x1: a.x, y1: a.y, x2: b.x, y2: b.y,
      stroke: owner == null ? '#ffffff55' : players[owner].color,
      'stroke-width': owner == null ? 7 : 10,
      'stroke-linecap': 'round'
    });
    baseLine.style.cursor = isCpuTurn() ? 'not-allowed' : 'pointer';
    baseLine.addEventListener('click', () => { if (!isCpuTurn()) tryBuildRoad(e); });
    boardEl.appendChild(baseLine);

    if (owner != null) {
      const p = players[owner];
      const shine = svg('line', {
        x1: a.x, y1: a.y, x2: b.x, y2: b.y,
        stroke: '#ffffff88',
        'stroke-width': '2.5',
        'stroke-linecap': 'round',
        'stroke-dasharray': '8 8'
      });
      boardEl.appendChild(shine);

      const midX = (a.x + b.x) / 2;
      const midY = (a.y + b.y) / 2;
      const roadMark = svg('text', { x: midX, y: midY + 4, 'text-anchor': 'middle', 'font-size': '12' });
      roadMark.textContent = p.badge;
      boardEl.appendChild(roadMark);
    }
  });

  state.vertices.forEach((v) => {
    const owner = state.vertexOwner.get(v.id);
    if (owner == null) {
      const node = svg('circle', { cx: v.x, cy: v.y, r: 8, fill: '#f7f7f7aa', stroke: '#1b2125', 'stroke-width': '2' });
      node.style.cursor = isCpuTurn() ? 'not-allowed' : 'pointer';
      node.addEventListener('click', () => {
        if (isCpuTurn()) return;
        if (state.mode === 'settlement') tryBuildSettlement(v.id);
      });
      boardEl.appendChild(node);
    } else {
      const p = players[owner];
      const isCity = p.cities.has(v.id);
      const bg = svg('circle', { cx: v.x, cy: v.y, r: isCity ? 17 : 13, fill: p.color, stroke: '#1b2125', 'stroke-width': '2' });
      boardEl.appendChild(bg);

      const txt = svg('text', { x: v.x, y: v.y + 5, 'text-anchor': 'middle', 'font-size': isCity ? '16' : '14', fill: '#0f1a21' });
      txt.textContent = isCity ? p.cityIcon : p.settlementIcon;
      boardEl.appendChild(txt);

      const poke = svg('text', { x: v.x, y: v.y - (isCity ? 15 : 12), 'text-anchor': 'middle', 'font-size': '12' });
      poke.textContent = p.badge;
      boardEl.appendChild(poke);

      if (!isCpuTurn()) {
        bg.style.cursor = 'pointer';
        bg.addEventListener('click', () => {
          if (state.mode === 'city') tryBuildCity(v.id);
        });
      }
    }
  });
}

function renderPlayers() {
  playersEl.innerHTML = '';
  players.forEach((p, idx) => {
    const totalCards = Object.values(p.res).reduce((s, n) => s + n, 0);
    const card = document.createElement('div');
    card.className = `player-card ${idx === state.current ? 'active' : ''}`;
    card.style.borderLeftColor = p.color;
    card.innerHTML = `<strong>${p.badge} ${p.name}</strong> · ${p.points} pts · ${totalCards} cartas<br>
      🌲${p.res.wood} 🧱${p.res.brick} 🐑${p.res.sheep} 🌾${p.res.wheat} ⛰️${p.res.ore}<br>
      Carreteras: ${p.roads.size} · Pueblos: ${p.settlements.size} · Ciudades: ${p.cities.size}`;
    playersEl.appendChild(card);
  });

  if (state.phase === 'main') turnInfo.textContent = `Partida normal · Turno: ${players[state.current].name}${isCpuTurn() ? ' (CPU pensando...)' : ''}`;
  else turnInfo.textContent = `Fase inicial · ${players[state.current].name}${isCpuTurn() ? ' (CPU)' : ''}`;
}

function checkWin(player) {
  if (player.points >= 10) {
    state.gameOver = true;
    state.cpuThinking = false;
    log(`🏆 ${player.name} gana con ${player.points} puntos.`);
    alert(`🏆 ${player.name} gana con ${player.points} puntos.`);
  }
}

function fillTradeSelects() {
  tradeGive.innerHTML = '';
  tradeGet.innerHTML = '';
  Object.entries(RES).filter(([k]) => k !== 'desert').forEach(([k, v]) => {
    const a = document.createElement('option');
    a.value = k; a.textContent = v.name;
    const b = a.cloneNode(true);
    tradeGive.appendChild(a);
    tradeGet.appendChild(b);
  });
  tradeGet.selectedIndex = 1;
}

function doTrade() {
  if (state.gameOver || state.phase !== 'main' || state.awaitingRobberPlacement || isCpuTurn()) return;
  const p = players[state.current];
  const give = tradeGive.value;
  const get = tradeGet.value;
  if (!state.rolled) return log('Debes tirar antes de comerciar.');
  if (give === get) return log('Debes intercambiar por un recurso distinto.');
  if (p.res[give] < 4) return log(`Necesitas 4 ${RES[give].name} para comerciar.`);
  p.res[give] -= 4;
  p.res[get] += 1;
  log(`${p.name} comercia 4 ${RES[give].name} por 1 ${RES[get].name}.`);
  refresh();
}

function cpuSelectRobberTile() {
  let bestTile = state.robberTile;
  let bestScore = -1;
  state.tiles.forEach((tile) => {
    if (tile.type === 'desert') return;
    let score = 0;
    tile.vertices.forEach((vId) => {
      const owner = state.vertexOwner.get(vId);
      if (owner == null || owner === state.current) return;
      score += players[owner].cities.has(vId) ? 2 : 1;
    });
    if (score > bestScore) { bestScore = score; bestTile = tile.id; }
  });
  return bestTile;
}

function cpuBuildCity(player) {
  if (!hasResources(player, COSTS.city)) return false;
  const candidates = [...player.settlements].sort((a, b) => vertexProductionScore(b) - vertexProductionScore(a));
  if (!candidates.length) return false;
  setMode('city');
  tryBuildCity(candidates[0]);
  return true;
}

function cpuBuildSettlement(player) {
  if (!hasResources(player, COSTS.settlement)) return false;
  const candidates = state.vertices
    .map((v) => v.id)
    .filter((vId) => canBuildSettlementAt(vId) && connectedToPlayer(vId, player))
    .sort((a, b) => vertexProductionScore(b) - vertexProductionScore(a));
  if (!candidates.length) return false;
  setMode('settlement');
  tryBuildSettlement(candidates[0]);
  return true;
}

function roadExpansionScore(player, edge) {
  const ownedVerts = new Set([...player.settlements, ...player.cities]);
  player.roads.forEach((r) => {
    const [a, b] = r.split('-').map(Number);
    ownedVerts.add(a); ownedVerts.add(b);
  });
  const far = ownedVerts.has(edge.a) ? edge.b : edge.a;
  let score = vertexProductionScore(edge.a) + vertexProductionScore(edge.b);
  if (canBuildSettlementAt(far)) score += 20;
  return score;
}

function cpuBuildRoad(player) {
  if (!hasResources(player, COSTS.road)) return false;
  const edges = state.edges
    .filter((e) => !state.edgeOwner.has(e.key) && canAttachRoad(player, e))
    .sort((e1, e2) => roadExpansionScore(player, e2) - roadExpansionScore(player, e1));
  if (!edges.length) return false;
  setMode('road');
  tryBuildRoad(edges[0]);
  return true;
}

function cpuTryTradeFor(targetCost, player) {
  const resources = ['wood', 'brick', 'sheep', 'wheat', 'ore'];
  let traded = false;
  resources.forEach((want) => {
    if ((targetCost[want] || 0) <= player.res[want]) return;
    const giver = resources.filter((r) => r !== want && player.res[r] >= 4).sort((a, b) => player.res[b] - player.res[a])[0];
    if (!giver) return;
    player.res[giver] -= 4;
    player.res[want] += 1;
    traded = true;
    log(`${player.name} comercia 4 ${RES[giver].name} por 1 ${RES[want].name}.`);
  });
  if (traded) refresh();
  return traded;
}

function runCpuSetupAction() {
  if (!isCpuTurn() || state.gameOver) return;
  if (state.phase === 'setup_settlement') {
    const chosen = cpuChooseSetupSettlement();
    if (chosen != null) handleSetupSettlement(chosen);
    return;
  }
  if (state.phase === 'setup_road') {
    const edge = cpuChooseSetupRoad(state.setupSettlementVertex);
    if (edge) handleSetupRoad(edge);
  }
}

async function runCpuMainTurn() {
  if (!isCpuTurn() || state.gameOver || state.phase !== 'main') return;
  const cpu = players[state.current];

  if (!state.rolled) await rollDice();
  if (state.awaitingRobberPlacement) moveRobberToTile(cpuSelectRobberTile());

  for (let i = 0; i < 6; i++) {
    if (cpuBuildSettlement(cpu)) continue;
    if (cpuBuildCity(cpu)) continue;
    if (cpuBuildRoad(cpu)) continue;
    const traded = cpuTryTradeFor(COSTS.settlement, cpu) || cpuTryTradeFor(COSTS.city, cpu) || cpuTryTradeFor(COSTS.road, cpu);
    if (!traded) break;
  }

  if (!state.gameOver) endTurn();
}

function maybeScheduleCpuTurn() {
  if (!state.started || state.gameOver || !isCpuTurn() || state.cpuThinking) return;
  state.cpuThinking = true;
  refresh();

  setTimeout(async () => {
    if (state.gameOver || !isCpuTurn()) { state.cpuThinking = false; refresh(); return; }
    state.cpuThinking = false;
    if (state.phase === 'main') await runCpuMainTurn();
    else runCpuSetupAction();
    refresh();
    maybeScheduleCpuTurn();
  }, 650);
}

function refresh() {
  setMode(state.mode);
  renderBoard();
  renderPlayers();
  const lockHuman = isCpuTurn() || state.cpuThinking || state.rollingDice || !state.started;
  rollBtn.disabled = state.phase !== 'main' || state.rolled || state.gameOver || lockHuman;
  endTurnBtn.disabled = state.phase !== 'main' || !state.rolled || state.awaitingRobberPlacement || state.gameOver || lockHuman;
  tradeBtn.disabled = state.phase !== 'main' || state.gameOver || lockHuman;
}

function populateThemeSelect() {
  playerThemeSelect.innerHTML = '';
  Object.entries(THEMES).forEach(([key, t]) => {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = `${t.pokemon} ${t.badge}`;
    playerThemeSelect.appendChild(opt);
  });
}

function startGame() {
  configurePlayers(playerThemeSelect.value || 'red');
  resetStateForNewGame();
  generateRandomBoardSetup();
  buildBoardGraph();
  state.robberTile = state.tiles.find((t) => t.type === 'desert')?.id ?? 0;
  fillTradeSelects();
  setupOverlay.classList.add('hidden');
  state.started = true;

  log(`Partida: ${players[HUMAN_ID].name} vs 3 CPUs Pokémon.`);
  log('Fase inicial: cada jugador coloca 2 pueblos y 2 carreteras (1-2-3-4-4-3-2-1).');
  log(`Empieza ${players[state.current].name}: coloca tu pueblo inicial.`);
  refresh();
  maybeScheduleCpuTurn();
}

rollBtn.addEventListener('click', () => { rollDice(); });
endTurnBtn.addEventListener('click', endTurn);
tradeBtn.addEventListener('click', doTrade);
document.querySelectorAll('.mode-btn').forEach((b) => b.addEventListener('click', () => { if (!isCpuTurn()) setMode(b.dataset.mode); }));
startGameBtn.addEventListener('click', startGame);

generateRandomBoardSetup();
buildBoardGraph();
populateThemeSelect();
configurePlayers('red');
fillTradeSelects();
refresh();
