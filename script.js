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
  red: { color: '#d44b45', badge: '🔥', pokemon: 'Charmander' },
  blue: { color: '#3d79d6', badge: '💧', pokemon: 'Squirtle' },
  green: { color: '#2f9b59', badge: '🌿', pokemon: 'Bulbasaur' },
  yellow: { color: '#d9c72f', badge: '⚡', pokemon: 'Pikachu' }
};

const COSTS = {
  road: { wood: 1, brick: 1 },
  settlement: { wood: 1, brick: 1, sheep: 1, wheat: 1 },
  city: { ore: 3, wheat: 2 },
  development: { sheep: 1, wheat: 1, ore: 1 }
};

const TOKEN_WEIGHT = { 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 8: 5, 9: 4, 10: 3, 11: 2, 12: 1 };
const BASE_TILE_TYPES = ['wood','wood','wood','wood','brick','brick','brick','sheep','sheep','sheep','sheep','wheat','wheat','wheat','wheat','ore','ore','ore','desert'];
const BASE_TOKEN_NUMBERS = [5, 2, 6, 3, 8, 10, 9, 12, 11, 4, 8, 10, 9, 4, 5, 6, 3, 11];
const DEV_BASE_DECK = ['knight','knight','knight','knight','knight','knight','knight','knight','knight','knight','knight','knight','knight','knight','victory','victory','victory','victory','victory','road_building','road_building','year_plenty','year_plenty','monopoly','monopoly'];
const PORT_POOL = ['three','three','three','three','wood','brick','sheep','wheat','ore'];

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
const tradeHint = document.getElementById('tradeHint');
const setupOverlay = document.getElementById('setupOverlay');
const playerThemeSelect = document.getElementById('playerThemeSelect');
const startGameBtn = document.getElementById('startGameBtn');
const die1 = document.getElementById('die1');
const die2 = document.getElementById('die2');
const buyDevBtn = document.getElementById('buyDevBtn');
const useKnightBtn = document.getElementById('useKnightBtn');
const useRoadBuildingBtn = document.getElementById('useRoadBuildingBtn');
const useYearPlentyBtn = document.getElementById('useYearPlentyBtn');
const useMonopolyBtn = document.getElementById('useMonopolyBtn');

const rows = [3, 4, 5, 4, 3];
const size = 86;
const hexW = Math.sqrt(3) * size;
const stepY = 1.5 * size;
const cx = 640;
const topY = 130;

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
  setupOrder: [0,1,2,3,3,2,1,0],
  setupStep: 0,
  setupSettlementVertex: null,
  cpuThinking: false,
  rollingDice: false,
  freeRoadBuilds: 0,
  longestRoadOwner: null,
  largestArmyOwner: null,
  tiles: [],
  vertices: [],
  edges: [],
  boardTypes: [],
  boardNumbers: [],
  ports: new Map(),
  devDeck: [],
  vertexOwner: new Map(),
  edgeOwner: new Map()
};

function log(msg) { const item = document.createElement('div'); item.className='log-item'; item.textContent = msg; logEl.prepend(item); }
const isCpuTurn = () => state.started && players[state.current]?.cpu;

function points(cxArg, cyArg, r) { const pts=[]; for (let i=0;i<6;i++){const ang=((60*i-30)*Math.PI)/180; pts.push([cxArg+r*Math.cos(ang), cyArg+r*Math.sin(ang)]);} return pts; }
const key=(x,y)=>`${Math.round(x)}:${Math.round(y)}`;
const edgeKey=(a,b)=>(a<b?`${a}-${b}`:`${b}-${a}`);
function svg(tag, attrs={}) { const e=document.createElementNS(NS,tag); Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,v)); return e; }
function shuffle(list){const arr=[...list]; for(let i=arr.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]];} return arr;}

function generateRandomBoardSetup(){ state.boardTypes=shuffle(BASE_TILE_TYPES); state.boardNumbers=shuffle(BASE_TOKEN_NUMBERS); }

function buildBoardGraph(){
  state.tiles=[]; state.vertices=[]; state.edges=[]; state.ports=new Map();
  const vMap=new Map(); const eMap=new Map(); let tIndex=0; let nIndex=0;

  rows.forEach((count,r)=>{
    const y=topY+r*stepY; const startX=cx-((count-1)*hexW)/2;
    for(let i=0;i<count;i++){
      const x=startX+i*hexW; const corners=points(x,y,size);
      const cornerIds=corners.map(([vx,vy])=>{const k=key(vx,vy); if(!vMap.has(k)){const id=state.vertices.length; vMap.set(k,id); state.vertices.push({id,x:vx,y:vy,adj:new Set(),tiles:[]});} return vMap.get(k);});
      for(let c=0;c<6;c++){const a=cornerIds[c]; const b=cornerIds[(c+1)%6]; const k=edgeKey(a,b); if(!eMap.has(k)){const edge={key:k,a,b}; eMap.set(k,edge); state.edges.push(edge);} state.vertices[a].adj.add(b); state.vertices[b].adj.add(a);}
      cornerIds.forEach((id)=>state.vertices[id].tiles.push(tIndex));
      const type=state.boardTypes[tIndex];
      state.tiles.push({id:tIndex,x,y,type,number:type==='desert'?null:state.boardNumbers[nIndex++],vertices:cornerIds});
      tIndex+=1;
    }
  });

  const coast = state.vertices.map(v=>v.id).filter(vId=>state.vertices[vId].tiles.length<3);
  const ports = shuffle(PORT_POOL);
  const chosen = shuffle(coast).slice(0, Math.min(ports.length, coast.length));
  chosen.forEach((vId, idx)=>state.ports.set(vId, ports[idx]));
}

function resetStateForNewGame(){
  Object.assign(state,{current:0,rolled:false,mode:'settlement',gameOver:false,phase:'setup_settlement',robberTile:0,awaitingRobberPlacement:false,setupStep:0,setupSettlementVertex:null,cpuThinking:false,rollingDice:false,freeRoadBuilds:0,longestRoadOwner:null,largestArmyOwner:null,vertexOwner:new Map(),edgeOwner:new Map(),devDeck:shuffle(DEV_BASE_DECK)});
  diceInfo.textContent='Sin tirada aún.'; die1.textContent='1'; die2.textContent='1'; logEl.innerHTML='';
}

function configurePlayers(humanThemeKey){
  const order=[humanThemeKey,...Object.keys(THEMES).filter(k=>k!==humanThemeKey)];
  players=order.map((themeKey,idx)=>{const t=THEMES[themeKey]; return {id:idx,themeKey,color:t.color,badge:t.badge,pokemon:t.pokemon,cpu:idx!==HUMAN_ID,name:idx===HUMAN_ID?`Tú (${t.pokemon})`:`CPU ${t.pokemon}`,res:{wood:0,brick:0,sheep:0,wheat:0,ore:0},roads:new Set(),settlements:new Set(),cities:new Set(),points:0,playedKnights:0,dev:{knight:0,victory:0,road_building:0,year_plenty:0,monopoly:0}};});
}

function canBuildSettlementAt(vId){ if(state.vertexOwner.has(vId)) return false; for(const n of state.vertices[vId].adj){ if(state.vertexOwner.has(n)) return false; } return true; }
function connectedToPlayer(vId, player){ for(const e of player.roads){const [a,b]=e.split('-').map(Number); if(a===vId||b===vId) return true;} return false; }
function canAttachRoad(player, edge){ if([...player.settlements,...player.cities].some(v=>edge.a===v||edge.b===v)) return true; for(const r of player.roads){const [a,b]=r.split('-').map(Number); if([a,b].includes(edge.a)||[a,b].includes(edge.b)) return true;} return false; }
function hasResources(player,cost){ return Object.entries(cost).every(([k,v])=>(player.res[k]||0)>=v); }
function spend(player,cost){ Object.entries(cost).forEach(([k,v])=>{player.res[k]-=v;}); }
function gain(player,res,amt=1){ player.res[res]+=amt; }

function playerTradeRatio(player, giveRes){
  let best=4;
  const owned=[...player.settlements,...player.cities];
  for(const vId of owned){
    const port=state.ports.get(vId);
    if(!port) continue;
    if(port===giveRes) best=Math.min(best,2);
    else if(port==='three') best=Math.min(best,3);
  }
  return best;
}

function vertexProductionScore(vId){ return state.vertices[vId].tiles.reduce((acc,tileId)=>{const tile=state.tiles[tileId]; if(!tile.number||tile.type==='desert') return acc; return acc+(TOKEN_WEIGHT[tile.number]||0);},0); }
function grantSecondSettlementResources(player,vId){ state.vertices[vId].tiles.forEach(tileId=>{const tile=state.tiles[tileId]; if(tile.type!=='desert') gain(player,tile.type,1);}); log(`${player.name} recibe recursos por su 2º pueblo inicial.`); }

function getCandidateSetupSettlements(){ return state.vertices.map(v=>v.id).filter(canBuildSettlementAt).sort((a,b)=>vertexProductionScore(b)-vertexProductionScore(a)); }
function getEdgesTouchingVertex(vId){ return state.edges.filter(e=>(e.a===vId||e.b===vId)&&!state.edgeOwner.has(e.key)); }
const cpuChooseSetupSettlement=()=>getCandidateSetupSettlements()[0]??null;
function cpuChooseSetupRoad(v){ const edges=getEdgesTouchingVertex(v); return edges.sort((e1,e2)=>{const f1=e1.a===v?e1.b:e1.a; const f2=e2.a===v?e2.b:e2.a; return vertexProductionScore(f2)-vertexProductionScore(f1);})[0]??null; }

function updateLargestArmy(){
  let bestOwner=null; let best=2;
  players.forEach(p=>{ if(p.playedKnights>best){best=p.playedKnights; bestOwner=p.id;} });
  if(bestOwner!==state.largestArmyOwner){
    if(state.largestArmyOwner!=null){ players[state.largestArmyOwner].points-=2; }
    state.largestArmyOwner=bestOwner;
    if(bestOwner!=null){ players[bestOwner].points+=2; log(`${players[bestOwner].name} consigue Gran Ejército (+2).`); }
  }
}

function longestRoadLen(player){
  const adj=new Map();
  player.roads.forEach(k=>{const [a,b]=k.split('-').map(Number); if(!adj.has(a)) adj.set(a,[]); if(!adj.has(b)) adj.set(b,[]); adj.get(a).push([b,k]); adj.get(b).push([a,k]);});
  let best=0;
  const dfs=(node, used)=>{ best=Math.max(best, used.size); for(const [next,ek] of (adj.get(node)||[])){ if(used.has(ek)) continue; used.add(ek); dfs(next, used); used.delete(ek);} };
  [...adj.keys()].forEach(start=>dfs(start,new Set()));
  return best;
}

function updateLongestRoad(){
  let owner=null; let best=4;
  players.forEach(p=>{const l=longestRoadLen(p); if(l>best){best=l; owner=p.id;}});
  if(owner!==state.longestRoadOwner){
    if(state.longestRoadOwner!=null) players[state.longestRoadOwner].points-=2;
    state.longestRoadOwner=owner;
    if(owner!=null){ players[owner].points+=2; log(`${players[owner].name} consigue Ruta Comercial (+2).`); }
  }
}

function checkWin(player){ if(player.points>=10){state.gameOver=true; state.cpuThinking=false; log(`🏆 ${player.name} gana con ${player.points} puntos.`); alert(`🏆 ${player.name} gana con ${player.points} puntos.`);} }

function advanceSetup(){
  state.setupStep+=1;
  if(state.setupStep>=state.setupOrder.length){ state.phase='main'; state.current=HUMAN_ID; state.mode='none'; log('✅ Colocación inicial terminada.'); refresh(); return; }
  state.current=state.setupOrder[state.setupStep]; state.phase='setup_settlement'; state.setupSettlementVertex=null; state.mode='settlement'; log(`Colocación inicial: ${players[state.current].name} coloca pueblo.`); refresh(); maybeScheduleCpuTurn();
}

function handleSetupSettlement(vId){ const p=players[state.current]; if(!canBuildSettlementAt(vId)) return; state.vertexOwner.set(vId,p.id); p.settlements.add(vId); p.points+=1; state.setupSettlementVertex=vId; state.phase='setup_road'; state.mode='road'; if(p.settlements.size===2) grantSecondSettlementResources(p,vId); log(`${p.name} coloca pueblo inicial. Ahora carretera.`); refresh(); maybeScheduleCpuTurn(); }
function handleSetupRoad(edge){ const p=players[state.current]; const s=state.setupSettlementVertex; if(state.edgeOwner.has(edge.key)||s==null||(edge.a!==s&&edge.b!==s)) return; state.edgeOwner.set(edge.key,p.id); p.roads.add(edge.key); log(`${p.name} coloca carretera inicial.`); advanceSetup(); }

function tryBuildRoad(edge){
  if(state.gameOver) return;
  const p=players[state.current];
  if(state.phase!=='main'){ if(state.phase==='setup_road') handleSetupRoad(edge); return; }
  if(state.mode!=='road'||state.awaitingRobberPlacement||!state.rolled) return;
  if(state.edgeOwner.has(edge.key)||!canAttachRoad(p,edge)) return;
  if(state.freeRoadBuilds>0){ state.freeRoadBuilds-=1; }
  else { if(!hasResources(p,COSTS.road)) return; spend(p,COSTS.road); }
  state.edgeOwner.set(edge.key,p.id); p.roads.add(edge.key); updateLongestRoad(); log(`${p.name} construye una carretera.`); checkWin(p); refresh();
}

function tryBuildSettlement(vId){
  if(state.gameOver) return;
  const p=players[state.current];
  if(state.phase!=='main'){ if(state.phase==='setup_settlement') handleSetupSettlement(vId); return; }
  if(state.mode!=='settlement'||state.awaitingRobberPlacement||!state.rolled) return;
  if(!canBuildSettlementAt(vId)||!connectedToPlayer(vId,p)||!hasResources(p,COSTS.settlement)) return;
  spend(p,COSTS.settlement); state.vertexOwner.set(vId,p.id); p.settlements.add(vId); p.points+=1; log(`${p.name} construye un pueblo (+1).`); checkWin(p); refresh();
}

function tryBuildCity(vId){
  if(state.gameOver||state.phase!=='main'||state.mode!=='city'||state.awaitingRobberPlacement) return;
  const p=players[state.current];
  if(!state.rolled||!p.settlements.has(vId)||!hasResources(p,COSTS.city)) return;
  spend(p,COSTS.city); p.settlements.delete(vId); p.cities.add(vId); p.points+=1; log(`${p.name} mejora a ciudad (+1).`); checkWin(p); refresh();
}

function discardHalf(player){ const keys=['wood','brick','sheep','wheat','ore']; const total=keys.reduce((s,k)=>s+player.res[k],0); if(total<=7) return; let disc=Math.floor(total/2); while(disc>0){const k=[...keys].sort((a,b)=>player.res[b]-player.res[a])[0]; if(player.res[k]>0){player.res[k]-=1; disc-=1;} else break;} }

function moveRobberToTile(tileId){
  if(!state.awaitingRobberPlacement) return;
  state.robberTile=tileId; state.awaitingRobberPlacement=false;
  const cur=players[state.current];
  const victims=new Set();
  state.tiles[tileId].vertices.forEach(vId=>{const o=state.vertexOwner.get(vId); if(o!=null && o!==cur.id) victims.add(o);});
  if(victims.size){ const victim=players[[...victims][Math.floor(Math.random()*victims.size)]]; const avail=Object.entries(victim.res).filter(([,v])=>v>0); if(avail.length){const [r]=avail[Math.floor(Math.random()*avail.length)]; victim.res[r]-=1; cur.res[r]+=1;}}
  refresh();
}

function distributeResources(total){ state.tiles.forEach(t=>{ if(t.number!==total||t.id===state.robberTile||t.type==='desert') return; t.vertices.forEach(vId=>{const o=state.vertexOwner.get(vId); if(o==null) return; gain(players[o],t.type,players[o].cities.has(vId)?2:1);});}); }

function animateDice(a,b){ state.rollingDice=true; die1.classList.add('rolling'); die2.classList.add('rolling'); return new Promise((res)=>{let ticks=0; const t=setInterval(()=>{die1.textContent=String(Math.floor(Math.random()*6)+1); die2.textContent=String(Math.floor(Math.random()*6)+1); ticks+=1; if(ticks>=10){clearInterval(t); die1.classList.remove('rolling'); die2.classList.remove('rolling'); die1.textContent=String(a); die2.textContent=String(b); state.rollingDice=false; res();}},70);}); }

async function rollDice(){
  if(state.gameOver||state.phase!=='main'||state.rolled||state.rollingDice) return;
  const a=Math.floor(Math.random()*6)+1; const b=Math.floor(Math.random()*6)+1; const total=a+b;
  await animateDice(a,b);
  state.rolled=true; diceInfo.textContent=`Resultado: ${a} + ${b} = ${total}`;
  if(total===7){ players.forEach(discardHalf); state.awaitingRobberPlacement=true; log('Salió 7: mueve el ladrón.'); }
  else { distributeResources(total); log(`Se reparten recursos para el ${total}.`); }
  refresh();
}

function endTurn(){ if(state.gameOver||state.phase!=='main'||!state.rolled||state.awaitingRobberPlacement) return; state.current=(state.current+1)%players.length; state.rolled=false; state.mode='none'; diceInfo.textContent='Sin tirada aún.'; log(`Turno para ${players[state.current].name}.`); refresh(); maybeScheduleCpuTurn(); }
function setMode(mode){ state.mode=state.phase!=='main'?(state.phase==='setup_settlement'?'settlement':'road'):mode; modeInfo.textContent=`Modo actual: ${state.mode==='none'?'seleccionar':state.mode}.`; document.querySelectorAll('.mode-btn').forEach(b=>b.classList.toggle('active', b.dataset.mode===state.mode)); }

function buyDevelopmentCard(){
  if(state.gameOver||state.phase!=='main'||isCpuTurn()||!state.rolled) return;
  const p=players[state.current];
  if(!state.devDeck.length) return log('No quedan cartas de desarrollo.');
  if(!hasResources(p,COSTS.development)) return log('No tienes recursos para carta de desarrollo.');
  spend(p,COSTS.development);
  const card=state.devDeck.pop();
  p.dev[card]+=1;
  if(card==='victory'){ p.points+=1; log(`${p.name} roba Punto de Victoria (+1 oculto).`); checkWin(p); }
  else log(`${p.name} roba carta de desarrollo: ${card}.`);
  refresh();
}

function useKnight(){
  const p=players[state.current];
  if(state.gameOver||state.phase!=='main'||isCpuTurn()||!state.rolled||state.awaitingRobberPlacement||p.dev.knight<1) return;
  p.dev.knight-=1; p.playedKnights+=1; state.awaitingRobberPlacement=true; updateLargestArmy(); checkWin(p); log(`${p.name} usa Caballero.`); refresh();
}

function useRoadBuilding(){
  const p=players[state.current];
  if(state.gameOver||state.phase!=='main'||isCpuTurn()||!state.rolled||p.dev.road_building<1) return;
  p.dev.road_building-=1; state.freeRoadBuilds+=2; state.mode='road'; log(`${p.name} usa Construcción de Carreteras (2 gratis).`); refresh();
}

function useYearPlenty(){
  const p=players[state.current];
  if(state.gameOver||state.phase!=='main'||isCpuTurn()||!state.rolled||p.dev.year_plenty<1) return;
  p.dev.year_plenty-=1;
  const r1=tradeGive.value||'wood'; const r2=tradeGet.value||'brick';
  p.res[r1]+=1; p.res[r2]+=1;
  log(`${p.name} usa Año de Abundancia y recibe ${RES[r1].name} + ${RES[r2].name}.`);
  refresh();
}

function useMonopoly(){
  const p=players[state.current];
  if(state.gameOver||state.phase!=='main'||isCpuTurn()||!state.rolled||p.dev.monopoly<1) return;
  p.dev.monopoly-=1;
  const resName=tradeGive.value||'wheat';
  let total=0;
  players.forEach(other=>{ if(other.id===p.id) return; total+=other.res[resName]; other.res[resName]=0; });
  p.res[resName]+=total;
  log(`${p.name} usa Monopolio y roba ${total} de ${RES[resName].name}.`);
  refresh();
}

function doTrade(){
  if(state.gameOver||state.phase!=='main'||state.awaitingRobberPlacement||isCpuTurn()) return;
  const p=players[state.current], give=tradeGive.value, get=tradeGet.value;
  if(!state.rolled||give===get) return;
  const ratio=playerTradeRatio(p,give);
  if(p.res[give]<ratio) return log(`Necesitas ${ratio} ${RES[give].name} para comerciar.`);
  p.res[give]-=ratio; p.res[get]+=1; log(`${p.name} comercia ${ratio}:1 (${RES[give].name} -> ${RES[get].name}).`); refresh();
}

function cpuSelectRobberTile(){ let best=state.robberTile,score=-1; state.tiles.forEach(tile=>{if(tile.type==='desert') return; let s=0; tile.vertices.forEach(vId=>{const o=state.vertexOwner.get(vId); if(o!=null&&o!==state.current) s+=players[o].cities.has(vId)?2:1;}); if(s>score){score=s; best=tile.id;}}); return best; }
function cpuBuildSettlement(p){ if(!hasResources(p,COSTS.settlement)) return false; const c=state.vertices.map(v=>v.id).filter(vId=>canBuildSettlementAt(vId)&&connectedToPlayer(vId,p)).sort((a,b)=>vertexProductionScore(b)-vertexProductionScore(a)); if(!c.length) return false; state.mode='settlement'; tryBuildSettlement(c[0]); return true; }
function cpuBuildCity(p){ if(!hasResources(p,COSTS.city)) return false; const c=[...p.settlements].sort((a,b)=>vertexProductionScore(b)-vertexProductionScore(a)); if(!c.length) return false; state.mode='city'; tryBuildCity(c[0]); return true; }
function cpuBuildRoad(p){ if(!hasResources(p,COSTS.road)&&state.freeRoadBuilds<=0) return false; const e=state.edges.filter(ed=>!state.edgeOwner.has(ed.key)&&canAttachRoad(p,ed)).sort((x,y)=>(vertexProductionScore(y.a)+vertexProductionScore(y.b))-(vertexProductionScore(x.a)+vertexProductionScore(x.b))); if(!e.length) return false; state.mode='road'; tryBuildRoad(e[0]); return true; }
function cpuTryTradeFor(target,p){ const keys=['wood','brick','sheep','wheat','ore']; let tr=false; keys.forEach(w=>{if((target[w]||0)<=p.res[w]) return; const g=keys.filter(r=>r!==w&&p.res[r]>=4).sort((a,b)=>p.res[b]-p.res[a])[0]; if(!g) return; p.res[g]-=4; p.res[w]+=1; tr=true;}); if(tr) refresh(); return tr; }

function runCpuSetupAction(){ if(!isCpuTurn()||state.gameOver) return; if(state.phase==='setup_settlement'){const c=cpuChooseSetupSettlement(); if(c!=null) handleSetupSettlement(c); return;} if(state.phase==='setup_road'){const e=cpuChooseSetupRoad(state.setupSettlementVertex); if(e) handleSetupRoad(e);} }

async function runCpuMainTurn(){
  if(!isCpuTurn()||state.gameOver||state.phase!=='main') return;
  const cpu=players[state.current];
  if(!state.rolled) await rollDice();
  if(state.awaitingRobberPlacement) moveRobberToTile(cpuSelectRobberTile());

  if(cpu.dev.knight>0 && !state.awaitingRobberPlacement){ cpu.dev.knight-=1; cpu.playedKnights+=1; state.awaitingRobberPlacement=true; updateLargestArmy(); moveRobberToTile(cpuSelectRobberTile()); }
  if(cpu.dev.road_building>0){ cpu.dev.road_building-=1; state.freeRoadBuilds+=2; cpuBuildRoad(cpu); cpuBuildRoad(cpu); }

  for(let i=0;i<6;i++){
    if(cpuBuildSettlement(cpu)) continue;
    if(cpuBuildCity(cpu)) continue;
    if(cpuBuildRoad(cpu)) continue;
    if(cpuTryTradeFor(COSTS.settlement,cpu)||cpuTryTradeFor(COSTS.city,cpu)||cpuTryTradeFor(COSTS.road,cpu)) continue;
    break;
  }

  if(hasResources(cpu,COSTS.development)&&state.devDeck.length){ spend(cpu,COSTS.development); const c=state.devDeck.pop(); cpu.dev[c]+=1; if(c==='victory'){cpu.points+=1; checkWin(cpu);} }
  if(!state.gameOver) endTurn();
}

function maybeScheduleCpuTurn(){ if(!state.started||state.gameOver||!isCpuTurn()||state.cpuThinking) return; state.cpuThinking=true; refresh(); setTimeout(async()=>{ if(state.gameOver||!isCpuTurn()){state.cpuThinking=false; refresh(); return;} state.cpuThinking=false; if(state.phase==='main') await runCpuMainTurn(); else runCpuSetupAction(); refresh(); maybeScheduleCpuTurn(); },650); }

function renderBoard(){
  boardEl.innerHTML='';
  state.tiles.forEach(t=>{
    const polyPts=points(t.x,t.y,size).map(([x,y])=>`${x},${y}`).join(' ');
    const poly=svg('polygon',{points:polyPts,fill:RES[t.type].color,stroke:'#00000070','stroke-width':'3'});
    poly.style.cursor=state.awaitingRobberPlacement&&!isCpuTurn()?'pointer':'default';
    poly.addEventListener('click',()=>{if(!isCpuTurn()) moveRobberToTile(t.id);});
    boardEl.appendChild(poly);
    const icon=svg('text',{x:t.x,y:t.y-18,'text-anchor':'middle','font-size':'30'}); icon.textContent=RES[t.type].icon; boardEl.appendChild(icon);
    boardEl.appendChild(svg('circle',{cx:t.x,cy:t.y+22,r:25,fill:'#f4ebd8',stroke:'#8f6f43','stroke-width':'4'}));
    const num=svg('text',{x:t.x,y:t.y+32,'text-anchor':'middle','font-size':'30',class:'tile-number',fill:t.number===6||t.number===8?'#c51414':'#222'}); num.textContent=t.number??'🦹'; boardEl.appendChild(num);
    if(state.robberTile===t.id){const rb=svg('text',{x:t.x+35,y:t.y-8,'font-size':'28',class:'robber'}); rb.textContent='🦹'; boardEl.appendChild(rb);} 
  });

  state.edges.forEach(e=>{
    const a=state.vertices[e.a], b=state.vertices[e.b], owner=state.edgeOwner.get(e.key);
    const line=svg('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,stroke:owner==null?'#ffffff55':players[owner].color,'stroke-width':owner==null?7:10,'stroke-linecap':'round'});
    line.style.cursor=isCpuTurn()?'not-allowed':'pointer';
    line.addEventListener('click',()=>{if(!isCpuTurn()) tryBuildRoad(e);});
    boardEl.appendChild(line);
    if(owner!=null){
      const p=players[owner];
      const mid=svg('text',{x:(a.x+b.x)/2,y:(a.y+b.y)/2+4,'text-anchor':'middle','font-size':'11'});
      mid.textContent=p.badge;
      boardEl.appendChild(mid);
    }
  });

  state.vertices.forEach(v=>{
    const owner=state.vertexOwner.get(v.id);
    if(owner==null){
      const node=svg('circle',{cx:v.x,cy:v.y,r:8,fill:'#f7f7f7aa',stroke:'#1b2125','stroke-width':'2'});
      node.style.cursor=isCpuTurn()?'not-allowed':'pointer';
      node.addEventListener('click',()=>{if(isCpuTurn()) return; if(state.mode==='settlement') tryBuildSettlement(v.id);});
      boardEl.appendChild(node);
    } else {
      const p=players[owner];
      const isCity=p.cities.has(v.id);
      const txt=svg('text',{x:v.x,y:v.y+4,'text-anchor':'middle','font-size':isCity?'18':'16'});
      txt.textContent=isCity?'🐉':'🦎'; // ciudad=charizard, pueblo=charmander
      boardEl.appendChild(txt);
      const badge=svg('text',{x:v.x,y:v.y-12,'text-anchor':'middle','font-size':'11'}); badge.textContent=p.badge; boardEl.appendChild(badge);
      if(!isCpuTurn()){ txt.style.cursor='pointer'; txt.addEventListener('click',()=>{if(state.mode==='city') tryBuildCity(v.id);}); }
    }

    const port=state.ports.get(v.id);
    if(port){
      const label=svg('text',{x:v.x+11,y:v.y-8,class:'port-label'});
      label.textContent = port==='three' ? '3:1' : (port==='wood'?'🌲2:1':port==='brick'?'🧱2:1':port==='sheep'?'🐑2:1':port==='wheat'?'🌾2:1':'⛰️2:1');
      boardEl.appendChild(label);
    }
  });
}

function renderPlayers(){
  playersEl.innerHTML='';
  players.forEach((p,idx)=>{
    const totalCards=Object.values(p.res).reduce((s,n)=>s+n,0);
    const d=document.createElement('div'); d.className=`player-card ${idx===state.current?'active':''}`; d.style.borderLeftColor=p.color;
    d.innerHTML=`<strong>${p.badge} ${p.name}</strong> · ${p.points} pts · ${totalCards} cartas<br>🌲${p.res.wood} 🧱${p.res.brick} 🐑${p.res.sheep} 🌾${p.res.wheat} ⛰️${p.res.ore}<br>Carreteras: ${p.roads.size} · Pueblos: ${p.settlements.size} · Ciudades: ${p.cities.size}<br>Desarrollo: 🛡️${p.dev.knight} ⭐${p.dev.victory} 🛣️${p.dev.road_building} 🎁${p.dev.year_plenty} 📦${p.dev.monopoly} · Caballeros jugados: ${p.playedKnights}`;
    playersEl.appendChild(d);
  });
  if(state.phase==='main') turnInfo.textContent=`Partida normal · Turno: ${players[state.current].name}${isCpuTurn()?' (CPU pensando...)':''}`;
  else turnInfo.textContent=`Fase inicial · ${players[state.current].name}${isCpuTurn()?' (CPU)':''}`;

  const me=players[HUMAN_ID];
  if(me){ const ratio=playerTradeRatio(me, tradeGive.value||'wood'); tradeHint.textContent=`Ratio actual para ${RES[tradeGive.value||'wood'].name}: ${ratio}:1`; }
}

function refresh(){
  setMode(state.mode); renderBoard(); renderPlayers();
  const lock=isCpuTurn()||state.cpuThinking||state.rollingDice||!state.started;
  rollBtn.disabled=state.phase!=='main'||state.rolled||state.gameOver||lock;
  endTurnBtn.disabled=state.phase!=='main'||!state.rolled||state.awaitingRobberPlacement||state.gameOver||lock;
  tradeBtn.disabled=state.phase!=='main'||state.gameOver||lock;
  [buyDevBtn,useKnightBtn,useRoadBuildingBtn,useYearPlentyBtn,useMonopolyBtn].forEach(b=>{b.disabled=state.phase!=='main'||state.gameOver||lock||!state.rolled;});
}

function populateThemeSelect(){ playerThemeSelect.innerHTML=''; Object.entries(THEMES).forEach(([k,t])=>{const o=document.createElement('option'); o.value=k; o.textContent=`${t.pokemon} ${t.badge}`; playerThemeSelect.appendChild(o);}); }
function fillTradeSelects(){ tradeGive.innerHTML=''; tradeGet.innerHTML=''; Object.entries(RES).filter(([k])=>k!=='desert').forEach(([k,v])=>{const a=document.createElement('option'); a.value=k; a.textContent=v.name; const b=a.cloneNode(true); tradeGive.appendChild(a); tradeGet.appendChild(b);}); tradeGet.selectedIndex=1; }

function startGame(){
  configurePlayers(playerThemeSelect.value||'red');
  resetStateForNewGame();
  generateRandomBoardSetup();
  buildBoardGraph();
  state.robberTile=state.tiles.find(t=>t.type==='desert')?.id??0;
  fillTradeSelects();
  setupOverlay.classList.add('hidden');
  state.started=true;
  log(`Partida: ${players[HUMAN_ID].name} vs 3 CPUs.`);
  log('Fase inicial: 2 pueblos + 2 carreteras.');
  refresh();
  maybeScheduleCpuTurn();
}

rollBtn.addEventListener('click', ()=>{ rollDice(); });
endTurnBtn.addEventListener('click', endTurn);
tradeBtn.addEventListener('click', doTrade);
tradeGive.addEventListener('change', refresh);
buyDevBtn.addEventListener('click', buyDevelopmentCard);
useKnightBtn.addEventListener('click', useKnight);
useRoadBuildingBtn.addEventListener('click', useRoadBuilding);
useYearPlentyBtn.addEventListener('click', useYearPlenty);
useMonopolyBtn.addEventListener('click', useMonopoly);
document.querySelectorAll('.mode-btn').forEach((b)=>b.addEventListener('click',()=>{ if(!isCpuTurn()) setMode(b.dataset.mode); }));
startGameBtn.addEventListener('click', startGame);

generateRandomBoardSetup();
buildBoardGraph();
populateThemeSelect();
configurePlayers('red');
fillTradeSelects();
refresh();
