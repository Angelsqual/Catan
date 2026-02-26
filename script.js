const resources = {
  bosque: { color: '#2f7a42', symbol: '🌲', name: 'Bosque (madera)' },
  colina: { color: '#b8643a', symbol: '🧱', name: 'Colina (arcilla)' },
  pasto: { color: '#8abf49', symbol: '🐑', name: 'Pasto (lana)' },
  campo: { color: '#e0ba3e', symbol: '🌾', name: 'Campo (trigo)' },
  montana: { color: '#8f98a0', symbol: '⛰️', name: 'Montaña (mineral)' },
  desierto: { color: '#d9bf82', symbol: '🏜️', name: 'Desierto' }
};

// Distribución fiel al juego base (1 desierto + 18 recursos)
const tiles = [
  'bosque', 'colina', 'pasto',
  'campo', 'montana', 'bosque', 'campo',
  'pasto', 'montana', 'desierto', 'colina', 'pasto',
  'campo', 'bosque', 'colina', 'montana',
  'pasto', 'campo', 'bosque'
];

// Números estándar sin el 7 (para 18 casillas no desierto)
const tokenNumbers = [5, 2, 6, 3, 8, 10, 9, 12, 11, 4, 8, 10, 9, 4, 5, 6, 3, 11];

const rows = [3, 4, 5, 4, 3];
const size = 88;
const hexWidth = Math.sqrt(3) * size;
const vertStep = 1.5 * size;
const centerX = 600;
const topY = 140;

const board = document.getElementById('board');
const legend = document.getElementById('resourceLegend');
const rollBtn = document.getElementById('rollDice');
const diceResult = document.getElementById('diceResult');

function hexPoints(cx, cy, r) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    pts.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
  }
  return pts.join(' ');
}

function addPorts() {
  const portLabels = ['3:1', 'Madera', 'Arcilla', 'Lana', 'Trigo', 'Mineral', '3:1', '3:1', '3:1'];
  const coords = [
    [225, 160], [380, 70], [565, 55], [760, 75], [930, 165],
    [935, 715], [760, 835], [420, 835], [230, 715]
  ];

  coords.forEach(([x, y], i) => {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');

    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', x);
    circle.setAttribute('cy', y);
    circle.setAttribute('r', 42);
    circle.setAttribute('fill', '#f5f7fa');
    circle.setAttribute('stroke', '#2f4052');
    circle.setAttribute('stroke-width', '4');

    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', x);
    text.setAttribute('y', y + 8);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('font-size', '22');
    text.setAttribute('font-weight', '700');
    text.setAttribute('fill', '#293847');
    text.textContent = portLabels[i];

    g.append(circle, text);
    board.appendChild(g);
  });
}

function renderBoard() {
  let tileIndex = 0;
  let tokenIndex = 0;

  rows.forEach((count, rowIndex) => {
    const y = topY + rowIndex * vertStep;
    const startX = centerX - ((count - 1) * hexWidth) / 2;

    for (let i = 0; i < count; i++) {
      const x = startX + i * hexWidth;
      const type = tiles[tileIndex++];
      const data = resources[type];

      const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      poly.setAttribute('points', hexPoints(x, y, size));
      poly.setAttribute('fill', data.color);
      poly.setAttribute('stroke', 'rgba(0,0,0,0.35)');
      poly.setAttribute('stroke-width', '4');

      const icon = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      icon.setAttribute('x', x);
      icon.setAttribute('y', y - 20);
      icon.setAttribute('text-anchor', 'middle');
      icon.setAttribute('font-size', '32');
      icon.textContent = data.symbol;

      const badge = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      badge.setAttribute('cx', x);
      badge.setAttribute('cy', y + 24);
      badge.setAttribute('r', 27);
      badge.setAttribute('fill', '#f7edd7');
      badge.setAttribute('stroke', '#8e6f3e');
      badge.setAttribute('stroke-width', '4');

      const number = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      number.setAttribute('x', x);
      number.setAttribute('y', y + 33);
      number.setAttribute('text-anchor', 'middle');
      number.setAttribute('font-size', '34');
      number.setAttribute('font-weight', '700');

      if (type === 'desierto') {
        number.textContent = '🦹';
        number.setAttribute('font-size', '24');
      } else {
        const value = tokenNumbers[tokenIndex++];
        number.textContent = value;
        number.setAttribute('fill', value === 6 || value === 8 ? '#bb1010' : '#2a2a2a');
      }

      board.append(poly, icon, badge, number);
    }
  });

  addPorts();
}

function renderLegend() {
  Object.values(resources).forEach((item) => {
    const li = document.createElement('li');
    li.innerHTML = `<span class="legend-chip" style="background:${item.color}"></span>${item.symbol} ${item.name}`;
    legend.appendChild(li);
  });
}

function rollDice() {
  const d1 = Math.floor(Math.random() * 6) + 1;
  const d2 = Math.floor(Math.random() * 6) + 1;
  const total = d1 + d2;
  diceResult.textContent = `Resultado: ${d1} + ${d2} = ${total}`;
}

rollBtn.addEventListener('click', rollDice);
renderBoard();
renderLegend();
