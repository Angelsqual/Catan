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

const rows = [3, 4, 5, 4, 3];
const size = 86;
const hexW = Math.sqrt(3) * size;
const stepY = 1.5 * size;
const cx = 640;
const topY = 130;

const types = [
  'wood', 'brick', 'sheep',
  'wheat', 'ore', 'wood', 'wheat',
  'sheep', 'ore', 'desert', 'brick', 'sheep',
  'wheat', 'wood', 'brick', 'ore',
  'sheep', 'wheat', 'wood'
];
const numbers = [5, 2, 6, 3, 8, 10, 9, 12, 11, 4, 8, 10, 9, 4, 5, 6, 3, 11];

const players = [
  { id: 0, name: 'Tú (Rojo)', color: '#d44b45', cpu: false },
  { id: 1, name: 'CPU Azul', color: '#3d79d6', cpu: true },
  { id: 2, name: 'CPU Verde', color: '#2f9b59', cpu: true },
  { id: 3, name: 'CPU Naranja', color: '#d98a30', cpu: true }
].map((p) => ({
  ...p,
  res: { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 },
  roads: new Set(),
  settlements: new Set(),
  cities: new Set(),
  points: 0
}));

const state = {
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
  tiles: [],
  vertices: [],
  edges: [],
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
  return players[state.current].cpu;
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

function buildBoardGraph() {
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
        type: types[tIndex],
        number: types[tIndex] === 'desert' ? null : numbers[nIndex++],
        vertices: cornerIds
      });
      tIndex += 1;
    }
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
  Object.entries(cost).forEach(([k, v]) => {
    player.res[k] -= v;
  });
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
  return state.vertices
    .map((v) => v.id)
    .filter((vId) => canBuildSettlementAt(vId))
    .sort((a, b) => vertexProductionScore(b) - vertexProductionScore(a));
}

function getEdgesTouchingVertex(vId) {
  return state.edges.filter((e) => (e.a === vId || e.b === vId) && !state.edgeOwner.has(e.key));
}

function cpuChooseSetupSettlement() {
  const options = getCandidateSetupSettlements();
  return options[0] ?? null;
}

function cpuChooseSetupRoad(settlementVertex) {
  const edges = getEdgesTouchingVertex(settlementVertex);
  if (edges.length === 0) return null;
  return edges.sort((e1, e2) => {
    const far1 = e1.a === settlementVertex ? e1.b : e1.a;
    const far2 = e2.a === settlementVertex ? e2.b : e2.a;
    return vertexProductionScore(far2) - vertexProductionScore(far1);
  })[0];
}

function advanceSetup() {
  state.setupStep += 1;
  if (state.setupStep >= state.setupOrder.length) {
    state.phase = 'main';
    state.current = HUMAN_ID;
    state.mode = 'none';
    state.cpuThinking = false;
    log('✅ Colocación inicial terminada. Empieza la partida normal: tira dados.');
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

  if (p.settlements.size === 2) {
    grantSecondSettlementResources(p, vId);
  }

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

  if (state.mode !== 'road') return;
  if (state.awaitingRobberPlacement) return log('Primero coloca el ladrón en una loseta.');

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

  if (state.mode !== 'settlement') return;
  if (state.awaitingRobberPlacement) return log('Primero coloca el ladrón en una loseta.');

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
  if (state.gameOver || state.phase !== 'main' || state.mode !== 'city') return;
  if (state.awaitingRobberPlacement) return log('Primero coloca el ladrón en una loseta.');

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
    if (player.res[maxK] > 0) {
      player.res[maxK] -= 1;
      discards -= 1;
    } else {
      break;
    }
  }
  log(`${player.name} descarta la mitad de sus cartas por sacar 7.`);
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

  if (victims.size > 0) {
    const victimId = [...victims][Math.floor(Math.random() * victims.size)];
    const victim = players[victimId];
    const available = Object.entries(victim.res).filter(([, value]) => value > 0);
    if (available.length > 0) {
      const [resource] = available[Math.floor(Math.random() * available.length)];
      victim.res[resource] -= 1;
      current.res[resource] += 1;
      log(`${current.name} mueve el ladrón y roba 1 ${RES[resource].name} a ${victim.name}.`);
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
      const p = players[owner];
      gain(p, t.type, p.cities.has(vId) ? 2 : 1);
    });
  });
}

function rollDice() {
  if (state.gameOver) return;
  if (state.phase !== 'main') return log('Primero termina la colocación inicial (2 pueblos + 2 carreteras por jugador).');
  if (state.rolled) return log('Ya tiraste en este turno.');

  const a = Math.floor(Math.random() * 6) + 1;
  const b = Math.floor(Math.random() * 6) + 1;
  const total = a + b;

  state.rolled = true;
  diceInfo.textContent = `Resultado: ${a} + ${b} = ${total}`;

  if (total === 7) {
    players.forEach(discardHalf);
    state.awaitingRobberPlacement = true;
    log('Salió 7: haz click en una loseta para mover el ladrón.');
  } else {
    distributeResources(total);
    log(`Se reparten recursos para el ${total}.`);
  }
  refresh();
}

function endTurn() {
  if (state.gameOver) return;
  if (state.phase !== 'main') return log('En colocación inicial no hay botón de finalizar turno.');
  if (!state.rolled) return log('Primero debes tirar dados.');
  if (state.awaitingRobberPlacement) return log('Aún falta colocar el ladrón en una loseta.');

  state.current = (state.current + 1) % players.length;
  state.rolled = false;
  state.mode = 'none';
  diceInfo.textContent = 'Sin tirada aún.';
  log(`Turno para ${players[state.current].name}.`);
  refresh();
  maybeScheduleCpuTurn();
}

function setMode(mode) {
  if (state.phase !== 'main') {
    state.mode = state.phase === 'setup_settlement' ? 'settlement' : 'road';
  } else {
    state.mode = mode;
  }
  modeInfo.textContent = `Modo actual: ${state.mode === 'none' ? 'seleccionar' : state.mode}.`;
  document.querySelectorAll('.mode-btn').forEach((b) => b.classList.toggle('active', b.dataset.mode === state.mode));
}

function renderBoard() {
  boardEl.innerHTML = '';

  state.tiles.forEach((t) => {
    const polyPts = points(t.x, t.y, size)
      .map(([x, y]) => `${x},${y}`)
      .join(' ');
    const poly = svg('polygon', {
      points: polyPts,
      fill: RES[t.type].color,
      stroke: '#00000070',
      'stroke-width': '3'
    });
    poly.style.cursor = state.awaitingRobberPlacement && !isCpuTurn() ? 'pointer' : 'default';
    poly.addEventListener('click', () => {
      if (!isCpuTurn()) moveRobberToTile(t.id);
    });
    boardEl.appendChild(poly);

    const icon = svg('text', { x: t.x, y: t.y - 18, 'text-anchor': 'middle', 'font-size': '30' });
    icon.textContent = RES[t.type].icon;
    boardEl.appendChild(icon);

    const token = svg('circle', { cx: t.x, cy: t.y + 22, r: 25, fill: '#f4ebd8', stroke: '#8f6f43', 'stroke-width': '4' });
    boardEl.appendChild(token);

    const num = svg('text', {
      x: t.x,
      y: t.y + 32,
      'text-anchor': 'middle',
      'font-size': '30',
      class: 'tile-number',
      fill: t.number === 6 || t.number === 8 ? '#c51414' : '#222'
    });
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
    const line = svg('line', {
      x1: a.x,
      y1: a.y,
      x2: b.x,
      y2: b.y,
      stroke: owner == null ? '#ffffff55' : players[owner].color,
      'stroke-width': owner == null ? 7 : 10,
      'stroke-linecap': 'round'
    });
    line.style.cursor = isCpuTurn() ? 'not-allowed' : 'pointer';
    line.addEventListener('click', () => {
      if (!isCpuTurn()) tryBuildRoad(e);
    });
    boardEl.appendChild(line);
  });

  state.vertices.forEach((v) => {
    const owner = state.vertexOwner.get(v.id);
    const isCity = owner != null && players[owner].cities.has(v.id);
    const node = svg('circle', {
      cx: v.x,
      cy: v.y,
      r: owner == null ? 8 : isCity ? 16 : 12,
      fill: owner == null ? '#f7f7f7aa' : players[owner].color,
      stroke: '#1b2125',
      'stroke-width': '2'
    });
    node.style.cursor = isCpuTurn() ? 'not-allowed' : 'pointer';
    node.addEventListener('click', () => {
      if (isCpuTurn()) return;
      if (state.mode === 'settlement') tryBuildSettlement(v.id);
      if (state.mode === 'city') tryBuildCity(v.id);
    });
    boardEl.appendChild(node);
  });
}

function renderPlayers() {
  playersEl.innerHTML = '';
  players.forEach((p, idx) => {
    const totalCards = Object.values(p.res).reduce((s, n) => s + n, 0);
    const card = document.createElement('div');
    card.className = `player-card ${idx === state.current ? 'active' : ''}`;
    card.style.borderLeftColor = p.color;
    card.innerHTML = `<strong>${p.name}</strong> · ${p.points} pts · ${totalCards} cartas<br>
      🌲${p.res.wood} 🧱${p.res.brick} 🐑${p.res.sheep} 🌾${p.res.wheat} ⛰️${p.res.ore}<br>
      Carreteras: ${p.roads.size} · Pueblos: ${p.settlements.size} · Ciudades: ${p.cities.size}`;
    playersEl.appendChild(card);
  });

  if (state.phase === 'main') {
    turnInfo.textContent = `Fase: partida normal · Turno: ${players[state.current].name}${isCpuTurn() ? ' (pensando...)' : ''}`;
  } else {
    const detail = state.phase === 'setup_settlement' ? 'coloca pueblo inicial' : 'coloca carretera inicial';
    turnInfo.textContent = `Fase inicial · ${players[state.current].name}: ${detail}${isCpuTurn() ? ' (CPU)' : ''}`;
  }
}

function checkWin(player) {
  if (player.points >= 10) {
    state.gameOver = true;
    state.cpuThinking = false;
    log(`🏆 ${player.name} gana la partida con ${player.points} puntos.`);
    alert(`🏆 ${player.name} gana la partida con ${player.points} puntos.`);
  }
}

function fillTradeSelects() {
  Object.entries(RES)
    .filter(([k]) => k !== 'desert')
    .forEach(([k, v]) => {
      const a = document.createElement('option');
      a.value = k;
      a.textContent = v.name;
      const b = a.cloneNode(true);
      tradeGive.appendChild(a);
      tradeGet.appendChild(b);
    });
  tradeGet.selectedIndex = 1;
}

function doTrade() {
  if (state.gameOver) return;
  if (state.phase !== 'main') return log('El comercio se habilita después de la colocación inicial.');
  if (state.awaitingRobberPlacement) return log('Primero coloca el ladrón en una loseta.');
  if (isCpuTurn()) return;

  const give = tradeGive.value;
  const get = tradeGet.value;
  const p = players[state.current];

  if (!state.rolled) return log('Debes tirar antes de comerciar.');
  if (give === get) return log('El recurso a dar y recibir debe ser distinto.');
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
    if (score > bestScore) {
      bestScore = score;
      bestTile = tile.id;
    }
  });
  return bestTile;
}

function cpuBuildCity(player) {
  if (!hasResources(player, COSTS.city)) return false;
  const candidates = [...player.settlements].sort((a, b) => vertexProductionScore(b) - vertexProductionScore(a));
  if (candidates.length === 0) return false;
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
  if (candidates.length === 0) return false;
  setMode('settlement');
  tryBuildSettlement(candidates[0]);
  return true;
}

function cpuBuildRoad(player) {
  if (!hasResources(player, COSTS.road)) return false;
  const edges = state.edges
    .filter((e) => !state.edgeOwner.has(e.key) && canAttachRoad(player, e))
    .sort((e1, e2) => {
      const score1 = vertexProductionScore(e1.a) + vertexProductionScore(e1.b);
      const score2 = vertexProductionScore(e2.a) + vertexProductionScore(e2.b);
      return score2 - score1;
    });
  if (edges.length === 0) return false;
  setMode('road');
  tryBuildRoad(edges[0]);
  return true;
}

function cpuTryTradeFor(targetCost, player) {
  const resources = ['wood', 'brick', 'sheep', 'wheat', 'ore'];
  let traded = false;

  resources.forEach((want) => {
    const need = (targetCost[want] || 0) - player.res[want];
    if (need <= 0) return;

    const giver = resources
      .filter((r) => r !== want && player.res[r] >= 4)
      .sort((a, b) => player.res[b] - player.res[a])[0];

    if (giver) {
      player.res[giver] -= 4;
      player.res[want] += 1;
      traded = true;
      log(`${player.name} comercia 4 ${RES[giver].name} por 1 ${RES[want].name}.`);
    }
  });

  if (traded) refresh();
  return traded;
}

function runCpuSetupAction() {
  if (!isCpuTurn() || state.gameOver) return;
  const cpu = players[state.current];

  if (state.phase === 'setup_settlement') {
    const chosen = cpuChooseSetupSettlement();
    if (chosen != null) {
      handleSetupSettlement(chosen);
    }
    return;
  }

  if (state.phase === 'setup_road') {
    const edge = cpuChooseSetupRoad(state.setupSettlementVertex);
    if (edge) handleSetupRoad(edge);
  }
}

function runCpuMainTurn() {
  if (!isCpuTurn() || state.gameOver || state.phase !== 'main') return;
  const cpu = players[state.current];

  if (!state.rolled) rollDice();
  if (state.awaitingRobberPlacement) moveRobberToTile(cpuSelectRobberTile());

  for (let i = 0; i < 5; i++) {
    if (cpuBuildCity(cpu)) continue;
    if (cpuBuildSettlement(cpu)) continue;
    if (cpuBuildRoad(cpu)) continue;

    const traded = cpuTryTradeFor(COSTS.settlement, cpu) || cpuTryTradeFor(COSTS.city, cpu) || cpuTryTradeFor(COSTS.road, cpu);
    if (!traded) break;
  }

  if (!state.gameOver) endTurn();
}

function maybeScheduleCpuTurn() {
  if (state.gameOver || !isCpuTurn() || state.cpuThinking) return;
  state.cpuThinking = true;
  refresh();

  setTimeout(() => {
    if (state.gameOver || !isCpuTurn()) {
      state.cpuThinking = false;
      refresh();
      return;
    }

    if (state.phase === 'main') runCpuMainTurn();
    else runCpuSetupAction();

    state.cpuThinking = false;
    refresh();
  }, 650);
}

function refresh() {
  setMode(state.mode);
  renderBoard();
  renderPlayers();

  const lockHuman = isCpuTurn() || state.cpuThinking;
  rollBtn.disabled = state.phase !== 'main' || state.rolled || state.gameOver || lockHuman;
  endTurnBtn.disabled = state.phase !== 'main' || !state.rolled || state.awaitingRobberPlacement || state.gameOver || lockHuman;
  tradeBtn.disabled = state.phase !== 'main' || state.gameOver || lockHuman;
}

rollBtn.addEventListener('click', rollDice);
endTurnBtn.addEventListener('click', endTurn);
tradeBtn.addEventListener('click', doTrade);
document.querySelectorAll('.mode-btn').forEach((b) =>
  b.addEventListener('click', () => {
    if (!isCpuTurn()) setMode(b.dataset.mode);
  })
);

buildBoardGraph();
fillTradeSelects();
state.mode = 'settlement';
log('Partida: tú (rojo) contra 3 CPUs.');
log('Fase inicial: cada jugador coloca 2 pueblos y 2 carreteras (orden 1-2-3-4-4-3-2-1).');
log(`Empieza ${players[state.current].name}: coloca tu pueblo inicial.`);
refresh();
maybeScheduleCpuTurn();
