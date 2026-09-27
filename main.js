import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Chess } from 'chess.js';

// ========== STATE ==========
const chess = new Chess();
let mode = 'hvh';          // 'hvh' | 'hvai'
let difficulty = 'medium'; // easy | medium | hard
let aiThinking = false;
let selectedSquare = null;
let legalTargets = [];
let lastMove = null;       // { from, to }

// ========== SCENE ==========
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1e1e24);

const camera = new THREE.PerspectiveCamera(45, innerWidth/innerHeight, 0.1, 1000);
camera.position.set(0, 12, 12);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// Orbit controls (US-101)
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 6;
controls.maxDistance = 25;
controls.minPolarAngle = Math.PI * 0.08;
controls.maxPolarAngle = Math.PI * 0.48;
controls.target.set(0, 0, 0);
controls.update();

// Lights
scene.add(new THREE.AmbientLight(0xffffff, 0.65));
const dir = new THREE.DirectionalLight(0xffffff, 1.2);
dir.position.set(10, 20, 10);
dir.castShadow = true;
dir.shadow.mapSize.set(1024, 1024);
scene.add(dir);

// ========== BOARD ==========
const boardGroup = new THREE.Group();
scene.add(boardGroup);

const squares = {}; // key: 'a1'..'h8' -> mesh
const N = 8, S = 1, OFF = (N*S)/2 - S/2;
const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf0d9b5 });
const blackMat = new THREE.MeshStandardMaterial({ color: 0xb58863 });

function squareName(r, c) { return String.fromCharCode(97+c) + (8-r); }

for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
        const mat = ((r+c) % 2 === 0 ? whiteMat : blackMat).clone();
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(S, 0.2, S), mat);
        mesh.position.set(c*S - OFF, -0.1, r*S - OFF);
        mesh.receiveShadow = true;
        const name = squareName(r, c);
        mesh.userData = { square: name, baseColor: mat.color.getHex() };
        boardGroup.add(mesh);
        squares[name] = mesh;
    }
}

// ========== PIECES ==========
const piecesGroup = new THREE.Group();
scene.add(piecesGroup);

function pieceMesh(type, color) {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
        color: color === 'w' ? 0xffffff : 0x222222,
        roughness: 0.3, metalness: 0.25
    });
    let geom;
    if (type === 'p') geom = new THREE.CylinderGeometry(0.3, 0.4, 0.6, 20);
    else if (type === 'r') geom = new THREE.BoxGeometry(0.5, 0.8, 0.5);
    else if (type === 'n') { geom = new THREE.ConeGeometry(0.4, 0.95, 20); }
    else if (type === 'b') geom = new THREE.CylinderGeometry(0.2, 0.4, 1.05, 20);
    else if (type === 'q') geom = new THREE.SphereGeometry(0.42, 20, 20);
    else if (type === 'k') geom = new THREE.BoxGeometry(0.42, 1.25, 0.42);
    const m = new THREE.Mesh(geom, mat);
    m.position.y = 0.5;
    m.castShadow = true;
    g.add(m);
    return g;
}

function renderPieces() {
    while (piecesGroup.children.length) piecesGroup.remove(piecesGroup.children[0]);
    const board = chess.board();
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const p = board[r][c];
            if (!p) continue;
            const m = pieceMesh(p.type, p.color);
            m.position.set(c*S - OFF, 0, r*S - OFF);
            piecesGroup.add(m);
        }
    }
}

// ========== HIGHLIGHTS (US-102 + last-move + check) ==========
function clearHighlights() {
    for (const [name, mesh] of Object.entries(squares)) {
        mesh.material.emissive.setHex(0x000000);
    }
}
function paintHighlights() {
    clearHighlights();
    if (lastMove) {
        squares[lastMove.from]?.material.emissive.setHex(0x554422);
        squares[lastMove.to]?.material.emissive.setHex(0x554422);
    }
    if (selectedSquare) {
        squares[selectedSquare]?.material.emissive.setHex(0x886611);
    }
    for (const t of legalTargets) {
        squares[t]?.material.emissive.setHex(0x225533);
    }
    if (chess.inCheck()) {
        const turn = chess.turn();
        const board = chess.board();
        for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
            const p = board[r][c];
            if (p && p.type === 'k' && p.color === turn) {
                squares[squareName(r, c)]?.material.emissive.setHex(0x772233);
            }
        }
    }
}

// ========== UI ==========
const $status = document.getElementById('status');
const $undo = document.getElementById('undo-btn');
const $reset = document.getElementById('reset-btn');
const $mode = document.getElementById('mode-select');
const $diff = document.getElementById('difficulty-select');
const $historyList = document.getElementById('history-list');
const $historyPanel = document.getElementById('history-panel');
const $toggleHist = document.getElementById('toggle-history');
const $overlay = document.getElementById('overlay');
const $overlayTitle = document.getElementById('overlay-title');
const $overlayMsg = document.getElementById('overlay-msg');

function refreshUI() {
    if (aiThinking) {
        $status.textContent = 'AI thinking…';
        $status.className = 'thinking';
    } else if (chess.isGameOver()) {
        $status.textContent = 'Game Over';
        $status.className = '';
    } else if (chess.inCheck()) {
        $status.textContent = (chess.turn() === 'w' ? "White" : "Black") + " in Check!";
        $status.className = 'check';
    } else {
        $status.textContent = (chess.turn() === 'w' ? "White's" : "Black's") + " Turn";
        $status.className = '';
    }
    $undo.disabled = chess.history().length === 0 || aiThinking;

    const hist = chess.history();
    let html = '';
    for (let i = 0; i < hist.length; i += 2) {
        const num = (i/2) + 1;
        const w = hist[i] || '';
        const b = hist[i+1] || '';
        const isLast = i+1 === hist.length || i === hist.length-1;
        html += `<div class="num">${num}.</div>
                 <div class="move ${i === hist.length-1 ? 'last' : ''}">${w}</div>
                 <div class="move ${i+1 === hist.length-1 ? 'last' : ''}">${b}</div>`;
    }
    $historyList.innerHTML = html;
    $historyPanel.scrollTop = $historyPanel.scrollHeight;
}

function showGameOver() {
    if (!chess.isGameOver()) return;
    let title, msg;
    if (chess.isCheckmate()) {
        const winner = chess.turn() === 'w' ? 'Black' : 'White';
        title = '🏆 Checkmate!';
        msg = winner + ' wins by checkmate.';
    } else if (chess.isStalemate()) {
        title = '🤝 Stalemate';
        msg = 'Draw — no legal moves.';
    } else if (chess.isThreefoldRepetition()) {
        title = '🤝 Draw';
        msg = 'Threefold repetition.';
    } else if (chess.isInsufficientMaterial()) {
        title = '🤝 Draw';
        msg = 'Insufficient material.';
    } else {
        title = '🤝 Draw';
        msg = '50-move rule.';
    }
    $overlayTitle.textContent = title;
    $overlayMsg.textContent = msg;
    $overlay.classList.add('show');
}

// ========== INPUT ==========
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let dragStart = null;

renderer.domElement.addEventListener('pointerdown', e => {
    dragStart = { x: e.clientX, y: e.clientY };
});

renderer.domElement.addEventListener('pointerup', e => {
    if (!dragStart) return;
    const dx = Math.abs(e.clientX - dragStart.x);
    const dy = Math.abs(e.clientY - dragStart.y);
    dragStart = null;
    if (dx > 5 || dy > 5) return; // was a drag, not a click
    handleClick(e);
});

function handleClick(e) {
    if (aiThinking) return;
    if (mode === 'hvai' && chess.turn() === 'b') return;

    mouse.x = (e.clientX / innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(boardGroup.children);
    if (!hits.length) return;
    const sq = hits[0].object.userData.square;

    if (selectedSquare === sq) {
        selectedSquare = null;
        legalTargets = [];
    } else if (selectedSquare && legalTargets.includes(sq)) {
        doMove(selectedSquare, sq);
        selectedSquare = null;
        legalTargets = [];
    } else {
        // select if own piece
        const piece = chess.get(sq);
        if (piece && piece.color === chess.turn()) {
            selectedSquare = sq;
            legalTargets = chess.moves({ square: sq, verbose: true }).map(m => m.to);
        } else {
            selectedSquare = null;
            legalTargets = [];
        }
    }
    paintHighlights();
}

function doMove(from, to) {
    try {
        const r = chess.move({ from, to, promotion: 'q' });
        if (!r) return;
        lastMove = { from, to };
        renderPieces();
        paintHighlights();
        refreshUI();
        if (chess.isGameOver()) { showGameOver(); return; }
        if (mode === 'hvai' && chess.turn() === 'b') triggerAI();
    } catch (err) { console.debug('bad move', err); }
}

// ========== AI (US-104) ==========
let stockfish = null;
let aiResolve = null;

async function initAI() {
    if (stockfish) return;
    try {
        const workerCode = `
            importScripts('https://cdn.jsdelivr.net/npm/stockfish.js@10.0.2/stockfish.js');
            const engine = STOCKFISH();
            engine.onmessage = e => postMessage(e);
            onmessage = e => engine.postMessage(e.data);
        `;
        const blob = new Blob([workerCode], { type: 'application/javascript' });
        stockfish = new Worker(URL.createObjectURL(blob));
        stockfish.onmessage = (e) => {
            const line = typeof e.data === 'string' ? e.data : (e.data?.data || '');
            if (line.startsWith('bestmove') && aiResolve) {
                const m = line.split(' ')[1];
                const from = m.slice(0, 2), to = m.slice(2, 4);
                const promotion = m.length > 4 ? m[4] : undefined;
                const r = aiResolve; aiResolve = null;
                r({ from, to, promotion });
            }
        };
        stockfish.postMessage('uci');
        stockfish.postMessage('isready');
    } catch (e) {
        console.error('Stockfish init failed', e);
    }
}

function bestMove(fen) {
    return new Promise((resolve) => {
        aiResolve = resolve;
        const skill = difficulty === 'easy' ? 3 : difficulty === 'medium' ? 10 : 20;
        const movetime = difficulty === 'easy' ? 200 : difficulty === 'medium' ? 800 : 1800;
        stockfish.postMessage('ucinewgame');
        stockfish.postMessage(`setoption name Skill Level value ${skill}`);
        stockfish.postMessage(`position fen ${fen}`);
        stockfish.postMessage(`go movetime ${movetime}`);
    });
}

async function triggerAI() {
    aiThinking = true;
    refreshUI();
    if (!stockfish) await initAI();
    // small delay so UI updates
    await new Promise(r => setTimeout(r, 50));
    try {
        const mv = await bestMove(chess.fen());
        aiThinking = false;
        if (mv) doMove(mv.from, mv.to);
        else refreshUI();
    } catch (e) {
        aiThinking = false;
        refreshUI();
        console.error('AI error', e);
    }
}

// ========== CONTROL WIRING ==========
$reset.addEventListener('click', () => resetGame());
document.getElementById('overlay-new').addEventListener('click', () => { $overlay.classList.remove('show'); resetGame(); });
document.getElementById('overlay-close').addEventListener('click', () => $overlay.classList.remove('show'));

$undo.addEventListener('click', () => {
    if (aiThinking) return;
    chess.undo();
    if (mode === 'hvai' && chess.history().length > 0 && chess.turn() === 'b') chess.undo();
    lastMove = null;
    selectedSquare = null;
    legalTargets = [];
    renderPieces();
    paintHighlights();
    refreshUI();
});

$mode.addEventListener('change', e => {
    mode = e.target.value;
    $diff.style.display = mode === 'hvai' ? '' : 'none';
    if (mode === 'hvai') initAI();
    resetGame();
});
$diff.addEventListener('change', e => { difficulty = e.target.value; });

$toggleHist.addEventListener('click', () => {
    $historyPanel.classList.toggle('hidden');
    $toggleHist.textContent = $historyPanel.classList.contains('hidden') ? 'Show History' : 'Hide History';
});

function resetGame() {
    chess.reset();
    selectedSquare = null;
    legalTargets = [];
    lastMove = null;
    aiThinking = false;
    renderPieces();
    paintHighlights();
    refreshUI();
    controls.reset();
    camera.position.set(0, 12, 12);
    controls.update();
}

// ========== BOOT ==========
addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
});

function loop() {
    requestAnimationFrame(loop);
    controls.update();
    renderer.render(scene, camera);
}

renderPieces();
paintHighlights();
refreshUI();
loop();
