import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Chess } from 'chess.js';

// ========== STATE ==========
const chess = new Chess();
let mode = 'hvh';
let difficulty = 'medium';
let aiThinking = false;
let selectedSquare = null;
let legalTargets = [];
let lastMove = null;

// ========== SCENE ==========
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x141418);

const camera = new THREE.PerspectiveCamera(40, innerWidth/innerHeight, 0.1, 1000);
camera.position.set(0, 11, 11);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

// Environment for PBR reflections
const pmremGen = new THREE.PMREMGenerator(renderer);
scene.environment = pmremGen.fromScene(new RoomEnvironment(), 0.04).texture;

// Orbit controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 7;
controls.maxDistance = 22;
controls.minPolarAngle = Math.PI * 0.08;
controls.maxPolarAngle = Math.PI * 0.48;
controls.target.set(0, 0, 0);
controls.update();

// Lights
scene.add(new THREE.AmbientLight(0xffffff, 0.35));
const key = new THREE.DirectionalLight(0xffffff, 2.2);
key.position.set(6, 14, 8);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left = -12;
key.shadow.camera.right = 12;
key.shadow.camera.top = 12;
key.shadow.camera.bottom = -12;
key.shadow.camera.near = 1;
key.shadow.camera.far = 40;
key.shadow.bias = -0.0004;
key.shadow.radius = 6;
scene.add(key);
const fill = new THREE.DirectionalLight(0xa0c8ff, 0.4);
fill.position.set(-8, 6, -4);
scene.add(fill);

// ========== BOARD ==========
const N = 8, S = 1, OFF = (N*S)/2 - S/2;

function makeWoodTexture(baseHex, streakHex) {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#' + baseHex.toString(16).padStart(6,'0');
    ctx.fillRect(0,0,256,256);
    for (let i=0;i<180;i++){
        ctx.strokeStyle = 'rgba(' + ((streakHex>>16)&255) + ',' + ((streakHex>>8)&255) + ',' + (streakHex&255) + ',' + (Math.random()*0.18) + ')';
        ctx.lineWidth = Math.random()*2;
        ctx.beginPath();
        const y = Math.random()*256;
        ctx.moveTo(0, y);
        ctx.bezierCurveTo(64, y+Math.random()*8-4, 192, y+Math.random()*8-4, 256, y+Math.random()*8-4);
        ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
}

const lightWoodTex = makeWoodTexture(0xe8c99b, 0xa87848);
const darkWoodTex  = makeWoodTexture(0x6b4324, 0x2a1508);
const frameWoodTex = makeWoodTexture(0x3e2410, 0x180a02);

const boardGroup = new THREE.Group();
scene.add(boardGroup);

// Frame / border
const frameW = 0.9;
const frameThickness = 0.35;
const frameSize = N*S + frameW*2;
const frameMat = new THREE.MeshStandardMaterial({ map: frameWoodTex, roughness: 0.55, metalness: 0.05 });
const frame = new THREE.Mesh(new THREE.BoxGeometry(frameSize, frameThickness, frameSize), frameMat);
frame.position.y = -0.28;
frame.receiveShadow = true;
frame.castShadow = true;
boardGroup.add(frame);

// Squares
const squares = {};
const lightMat = new THREE.MeshStandardMaterial({ map: lightWoodTex, roughness: 0.5, metalness: 0.05 });
const darkMat  = new THREE.MeshStandardMaterial({ map: darkWoodTex,  roughness: 0.5, metalness: 0.05 });
function sqName(r,c){ return String.fromCharCode(97+c)+(8-r); }

for (let r=0; r<N; r++){
    for (let c=0; c<N; c++){
        const mat = ((r+c)%2===0 ? lightMat : darkMat).clone();
        mat.emissive = new THREE.Color(0x000000);
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(S, 0.1, S), mat);
        mesh.position.set(c*S-OFF, -0.05, r*S-OFF);
        mesh.receiveShadow = true;
        const name = sqName(r,c);
        mesh.userData = { square: name };
        boardGroup.add(mesh);
        squares[name] = mesh;
    }
}

// Coordinate labels (a-h, 1-8)
function makeLabel(text, size=0.5){
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#e8d9b8';
    ctx.font = 'bold 44px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 32, 34);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
    plane.rotation.x = -Math.PI/2;
    return plane;
}
for (let i=0;i<8;i++){
    const file = String.fromCharCode(97+i);
    const rank = (i+1).toString();
    // Files bottom + top
    const lf = makeLabel(file); lf.position.set(i-OFF, -0.09, OFF + 0.6); boardGroup.add(lf);
    const lf2 = makeLabel(file); lf2.position.set(i-OFF, -0.09, -OFF - 0.6); lf2.rotation.z = Math.PI; boardGroup.add(lf2);
    // Ranks left + right
    const lr = makeLabel(rank); lr.position.set(-OFF - 0.6, -0.09, (7-i)-OFF); boardGroup.add(lr);
    const lr2 = makeLabel(rank); lr2.position.set(OFF + 0.6, -0.09, (7-i)-OFF); boardGroup.add(lr2);
}

// ========== REALISTIC PIECES (LatheGeometry Staunton-style) ==========
function latheProfile(points, seg=48){
    const pts = points.map(p => new THREE.Vector2(p[0], p[1]));
    return new THREE.LatheGeometry(pts, seg);
}

function pawnGeom() {
    return latheProfile([
        [0.00,0.00],[0.36,0.00],[0.36,0.05],[0.28,0.08],[0.20,0.14],
        [0.12,0.22],[0.10,0.40],[0.14,0.52],[0.20,0.58],[0.15,0.62],
        [0.15,0.70],[0.22,0.74],[0.22,0.82],[0.00,0.86]
    ]);
}
function rookGeom() {
    // body via lathe, battlements via boxes on top
    const body = latheProfile([
        [0.00,0.00],[0.40,0.00],[0.40,0.06],[0.32,0.10],[0.28,0.16],
        [0.24,0.30],[0.24,0.90],[0.30,0.94],[0.30,1.02],[0.00,1.02]
    ]);
    return body;
}
function bishopGeom() {
    return latheProfile([
        [0.00,0.00],[0.40,0.00],[0.40,0.06],[0.32,0.10],[0.28,0.18],
        [0.22,0.40],[0.18,0.62],[0.14,0.74],[0.20,0.80],[0.20,0.86],
        [0.15,0.90],[0.15,1.00],[0.18,1.06],[0.14,1.14],[0.08,1.22],
        [0.00,1.28]
    ]);
}
function queenGeom() {
    return latheProfile([
        [0.00,0.00],[0.42,0.00],[0.42,0.06],[0.34,0.10],[0.30,0.18],
        [0.24,0.45],[0.20,0.72],[0.15,0.86],[0.22,0.92],[0.22,1.00],
        [0.16,1.04],[0.16,1.12],[0.22,1.18],[0.22,1.26],[0.00,1.30]
    ]);
}
function kingBodyGeom() {
    return latheProfile([
        [0.00,0.00],[0.44,0.00],[0.44,0.06],[0.36,0.10],[0.32,0.18],
        [0.26,0.50],[0.22,0.80],[0.16,0.94],[0.24,1.00],[0.24,1.10],
        [0.18,1.14],[0.18,1.24],[0.24,1.28],[0.24,1.34],[0.00,1.36]
    ]);
}
function knightGeom(){
    // Composite: pedestal (lathe) + a stylized horse silhouette (extrude)
    const pedestal = latheProfile([
        [0.00,0.00],[0.40,0.00],[0.40,0.06],[0.32,0.10],[0.28,0.18],
        [0.24,0.32],[0.24,0.42],[0.00,0.42]
    ]);
    // Horse head silhouette (2D shape, extruded)
    const shape = new THREE.Shape();
    // rough Staunton knight silhouette (side profile)
    shape.moveTo(-0.05, 0.42);
    shape.lineTo(0.25, 0.42);
    shape.bezierCurveTo(0.30, 0.55, 0.15, 0.60, 0.10, 0.68);
    shape.bezierCurveTo(0.30, 0.72, 0.40, 0.85, 0.36, 1.05);
    shape.bezierCurveTo(0.34, 1.15, 0.25, 1.20, 0.18, 1.20);
    shape.bezierCurveTo(0.05, 1.20, -0.06, 1.15, -0.20, 1.20);
    shape.bezierCurveTo(-0.30, 1.18, -0.30, 1.05, -0.22, 0.95);
    shape.bezierCurveTo(-0.12, 0.85, -0.10, 0.75, -0.15, 0.62);
    shape.bezierCurveTo(-0.20, 0.55, -0.15, 0.48, -0.05, 0.42);
    const head = new THREE.ExtrudeGeometry(shape, { depth: 0.22, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 4, curveSegments: 24 });
    head.translate(0, 0, -0.11);
    // merge is not available without BufferGeometryUtils; return group instead
    return { pedestal, head };
}

const rookTopGeom = new THREE.BoxGeometry(0.14, 0.16, 0.14);
const kingCrossVGeom = new THREE.BoxGeometry(0.10, 0.32, 0.10);
const kingCrossHGeom = new THREE.BoxGeometry(0.24, 0.10, 0.10);
const queenPointGeom = new THREE.ConeGeometry(0.05, 0.14, 8);

function pieceMaterial(color) {
    return new THREE.MeshPhysicalMaterial({
        color: color === 'w' ? 0xf5f2e8 : 0x1a1a1a,
        roughness: color === 'w' ? 0.35 : 0.28,
        metalness: 0.02,
        clearcoat: 0.35,
        clearcoatRoughness: 0.25,
        sheen: 0.15,
        sheenColor: color === 'w' ? 0xffffff : 0x111111
    });
}

function pieceMesh(type, color) {
    const g = new THREE.Group();
    const mat = pieceMaterial(color);

    if (type === 'n') {
        const kn = knightGeom();
        const p = new THREE.Mesh(kn.pedestal, mat);
        p.castShadow = true; p.receiveShadow = true;
        g.add(p);
        const h = new THREE.Mesh(kn.head, mat);
        h.castShadow = true; h.receiveShadow = true;
        h.position.y = 0;
        // face the correct way based on color (knights face opponent)
        h.rotation.y = color === 'w' ? -Math.PI/2 : Math.PI/2;
        g.add(h);
    } else {
        let geom;
        if (type === 'p') geom = pawnGeom();
        else if (type === 'r') geom = rookGeom();
        else if (type === 'b') geom = bishopGeom();
        else if (type === 'q') geom = queenGeom();
        else if (type === 'k') geom = kingBodyGeom();
        const body = new THREE.Mesh(geom, mat);
        body.castShadow = true; body.receiveShadow = true;
        g.add(body);

        if (type === 'r') {
            // 4 battlements
            for (let i=0;i<4;i++){
                const b = new THREE.Mesh(rookTopGeom, mat);
                const ang = (i*Math.PI/2) + Math.PI/4;
                b.position.set(Math.cos(ang)*0.20, 1.08, Math.sin(ang)*0.20);
                b.castShadow = true;
                g.add(b);
            }
        }
        if (type === 'k') {
            const cv = new THREE.Mesh(kingCrossVGeom, mat);
            cv.position.y = 1.50;
            cv.castShadow = true;
            g.add(cv);
            const ch = new THREE.Mesh(kingCrossHGeom, mat);
            ch.position.y = 1.48;
            ch.castShadow = true;
            g.add(ch);
        }
        if (type === 'q') {
            // crown of 5 small points
            for (let i=0;i<5;i++){
                const ang = (i/5)*Math.PI*2;
                const pt = new THREE.Mesh(queenPointGeom, mat);
                pt.position.set(Math.cos(ang)*0.14, 1.36, Math.sin(ang)*0.14);
                pt.castShadow = true;
                g.add(pt);
            }
            const orb = new THREE.Mesh(new THREE.SphereGeometry(0.06,12,12), mat);
            orb.position.y = 1.32;
            orb.castShadow = true;
            g.add(orb);
        }
    }

    // Scale so tallest (king) ~ 1.4 units. Everything below is auto-shorter from geometry.
    return g;
}

// ========== PIECE MANAGEMENT ==========
const piecesGroup = new THREE.Group();
scene.add(piecesGroup);

// Map square -> mesh so we can animate moves
const pieceMap = new Map();

function squareToWorld(sq){
    const file = sq.charCodeAt(0)-97;
    const rank = parseInt(sq[1],10);
    const r = 8-rank, c = file;
    return new THREE.Vector3(c*S-OFF, 0, r*S-OFF);
}

function rebuildAllPieces(){
    for (const [, mesh] of pieceMap) piecesGroup.remove(mesh);
    pieceMap.clear();
    const board = chess.board();
    for (let r=0;r<8;r++) for (let c=0;c<8;c++){
        const p = board[r][c];
        if (!p) continue;
        const sq = sqName(r,c);
        const m = pieceMesh(p.type, p.color);
        m.position.copy(squareToWorld(sq));
        piecesGroup.add(m);
        pieceMap.set(sq, m);
    }
}

// Simple move animation
const animations = [];
function animateMove(from, to, captured){
    const mesh = pieceMap.get(from);
    if (!mesh) return;
    const start = mesh.position.clone();
    const end = squareToWorld(to);
    const dur = 260;
    const t0 = performance.now();
    animations.push({
        update: (now) => {
            const t = Math.min(1, (now-t0)/dur);
            const ease = t<0.5 ? 2*t*t : 1 - Math.pow(-2*t+2,2)/2;
            mesh.position.lerpVectors(start, end, ease);
            mesh.position.y = Math.sin(t*Math.PI)*0.4; // little hop
            return t >= 1;
        }
    });
    pieceMap.delete(from);
    if (captured){
        const capMesh = pieceMap.get(to);
        if (capMesh) piecesGroup.remove(capMesh);
    }
    pieceMap.set(to, mesh);
}

// ========== HIGHLIGHTS ==========
function clearHL(){ for (const n in squares) squares[n].material.emissive?.setHex(0x000000); }
function paintHL(){
    clearHL();
    if (lastMove){
        squares[lastMove.from]?.material.emissive.setHex(0x3a2a10);
        squares[lastMove.to]?.material.emissive.setHex(0x3a2a10);
    }
    if (selectedSquare) squares[selectedSquare]?.material.emissive.setHex(0x6a4a12);
    for (const t of legalTargets) squares[t]?.material.emissive.setHex(0x1a3a20);
    if (chess.inCheck()){
        const turn = chess.turn();
        const board = chess.board();
        for (let r=0;r<8;r++) for (let c=0;c<8;c++){
            const p = board[r][c];
            if (p && p.type==='k' && p.color===turn) squares[sqName(r,c)]?.material.emissive.setHex(0x5a1220);
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

function refreshUI(){
    if (aiThinking){ $status.textContent='AI thinking…'; $status.className='thinking'; }
    else if (chess.isGameOver()){ $status.textContent='Game Over'; $status.className=''; }
    else if (chess.inCheck()){ $status.textContent=(chess.turn()==='w'?"White":"Black")+" in Check!"; $status.className='check'; }
    else { $status.textContent=(chess.turn()==='w'?"White's":"Black's")+" Turn"; $status.className=''; }
    $undo.disabled = chess.history().length===0 || aiThinking;
    const h = chess.history();
    let html='';
    for (let i=0;i<h.length;i+=2){
        const num=(i/2)+1, w=h[i]||'', b=h[i+1]||'';
        html += `<div class="num">${num}.</div><div class="move ${i===h.length-1?'last':''}">${w}</div><div class="move ${i+1===h.length-1?'last':''}">${b}</div>`;
    }
    $historyList.innerHTML = html;
    $historyPanel.scrollTop = $historyPanel.scrollHeight;
}

function showGameOver(){
    if (!chess.isGameOver()) return;
    let title, msg;
    if (chess.isCheckmate()){ const w = chess.turn()==='w'?'Black':'White'; title='🏆 Checkmate!'; msg=w+' wins by checkmate.'; }
    else if (chess.isStalemate()){ title='🤝 Stalemate'; msg='Draw — no legal moves.'; }
    else if (chess.isThreefoldRepetition()){ title='🤝 Draw'; msg='Threefold repetition.'; }
    else if (chess.isInsufficientMaterial()){ title='🤝 Draw'; msg='Insufficient material.'; }
    else { title='🤝 Draw'; msg='50-move rule.'; }
    $overlayTitle.textContent=title; $overlayMsg.textContent=msg;
    $overlay.classList.add('show');
}

// ========== INPUT ==========
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let dragStart=null;
renderer.domElement.addEventListener('pointerdown', e => { dragStart = { x:e.clientX, y:e.clientY }; });
renderer.domElement.addEventListener('pointerup', e => {
    if (!dragStart) return;
    const dx=Math.abs(e.clientX-dragStart.x), dy=Math.abs(e.clientY-dragStart.y);
    dragStart=null;
    if (dx>5||dy>5) return;
    handleClick(e);
});

function handleClick(e){
    if (aiThinking) return;
    if (mode==='hvai' && chess.turn()==='b') return;
    mouse.x=(e.clientX/innerWidth)*2-1;
    mouse.y=-(e.clientY/innerHeight)*2+1;
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(boardGroup.children, false);
    const sqHit = hits.find(h => h.object.userData?.square);
    if (!sqHit) return;
    const sq = sqHit.object.userData.square;
    if (selectedSquare===sq){ selectedSquare=null; legalTargets=[]; }
    else if (selectedSquare && legalTargets.includes(sq)){
        doMove(selectedSquare, sq);
        selectedSquare=null; legalTargets=[];
    } else {
        const p = chess.get(sq);
        if (p && p.color===chess.turn()){
            selectedSquare=sq;
            legalTargets=chess.moves({square:sq, verbose:true}).map(m=>m.to);
        } else { selectedSquare=null; legalTargets=[]; }
    }
    paintHL();
}

function doMove(from, to){
    try {
        const captured = !!chess.get(to) || (chess.get(from)?.type==='p' && from[0]!==to[0]);
        const r = chess.move({ from, to, promotion:'q' });
        if (!r) return;
        lastMove = { from, to };
        // for promotion / castling / en passant we simplify with a full rebuild after animation
        const isSpecial = r.flags.includes('e') || r.flags.includes('k') || r.flags.includes('q') || r.flags.includes('p');
        if (isSpecial){
            rebuildAllPieces();
        } else {
            animateMove(from, to, captured);
        }
        paintHL();
        refreshUI();
        if (chess.isGameOver()){ setTimeout(showGameOver, 350); return; }
        if (mode==='hvai' && chess.turn()==='b') setTimeout(triggerAI, 300);
    } catch(err){ console.debug('move err', err); }
}

// ========== AI ==========
let stockfish=null, aiResolve=null;
async function initAI(){
    if (stockfish) return;
    const workerCode = `
        importScripts('https://cdn.jsdelivr.net/npm/stockfish.js@10.0.2/stockfish.js');
        const engine = STOCKFISH();
        engine.onmessage = e => postMessage(e);
        onmessage = e => engine.postMessage(e.data);
    `;
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    stockfish = new Worker(URL.createObjectURL(blob));
    stockfish.onmessage = (e) => {
        const line = typeof e.data==='string' ? e.data : (e.data?.data||'');
        if (line.startsWith('bestmove') && aiResolve){
            const m = line.split(' ')[1];
            const from = m.slice(0,2), to = m.slice(2,4);
            const promotion = m.length>4 ? m[4] : undefined;
            const r=aiResolve; aiResolve=null;
            r({from,to,promotion});
        }
    };
    stockfish.postMessage('uci');
    stockfish.postMessage('isready');
}
function bestMove(fen){
    return new Promise(res=>{
        aiResolve = res;
        const skill = difficulty==='easy'?3 : difficulty==='medium'?10 : 20;
        const movetime = difficulty==='easy'?250 : difficulty==='medium'?800 : 1800;
        stockfish.postMessage('ucinewgame');
        stockfish.postMessage(`setoption name Skill Level value ${skill}`);
        stockfish.postMessage(`position fen ${fen}`);
        stockfish.postMessage(`go movetime ${movetime}`);
    });
}
async function triggerAI(){
    aiThinking = true; refreshUI();
    if (!stockfish) await initAI();
    await new Promise(r=>setTimeout(r,50));
    try {
        const mv = await bestMove(chess.fen());
        aiThinking = false;
        if (mv) doMove(mv.from, mv.to); else refreshUI();
    } catch(e){ aiThinking=false; refreshUI(); console.error(e); }
}

// ========== CONTROLS ==========
$reset.addEventListener('click', resetGame);
document.getElementById('overlay-new').addEventListener('click', ()=>{ $overlay.classList.remove('show'); resetGame(); });
document.getElementById('overlay-close').addEventListener('click', ()=> $overlay.classList.remove('show'));
$undo.addEventListener('click', ()=>{
    if (aiThinking) return;
    chess.undo();
    if (mode==='hvai' && chess.history().length>0 && chess.turn()==='b') chess.undo();
    lastMove=null; selectedSquare=null; legalTargets=[];
    rebuildAllPieces(); paintHL(); refreshUI();
});
$mode.addEventListener('change', e=>{
    mode=e.target.value;
    $diff.style.display = mode==='hvai'?'':'none';
    if (mode==='hvai') initAI();
    resetGame();
});
$diff.addEventListener('change', e=>{ difficulty=e.target.value; });
$toggleHist.addEventListener('click', ()=>{
    $historyPanel.classList.toggle('hidden');
    $toggleHist.textContent = $historyPanel.classList.contains('hidden')?'Show History':'Hide History';
});

function resetGame(){
    chess.reset();
    selectedSquare=null; legalTargets=[]; lastMove=null; aiThinking=false;
    rebuildAllPieces(); paintHL(); refreshUI();
    controls.reset();
    camera.position.set(0,11,11);
    controls.update();
}

// ========== BOOT ==========
addEventListener('resize', ()=>{
    camera.aspect = innerWidth/innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
});

function loop(){
    requestAnimationFrame(loop);
    const now = performance.now();
    for (let i=animations.length-1;i>=0;i--){
        if (animations[i].update(now)) animations.splice(i,1);
    }
    controls.update();
    renderer.render(scene, camera);
}

rebuildAllPieces();
paintHL();
refreshUI();
loop();
