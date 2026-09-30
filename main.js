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

// ========== ANIMATED ANIMAL CHESS ARMY ==========
const animalGeometries = {
    sphere: new THREE.SphereGeometry(1, 20, 16),
    eye: new THREE.SphereGeometry(0.045, 10, 8),
    nose: new THREE.SphereGeometry(0.06, 10, 8),
    ear: new THREE.ConeGeometry(0.10, 0.38, 10),
    leg: new THREE.CapsuleGeometry(0.065, 0.18, 4, 8),
    tusk: new THREE.ConeGeometry(0.035, 0.24, 10),
    mane: new THREE.TorusGeometry(0.25, 0.09, 8, 20),
    crown: new THREE.ConeGeometry(0.20, 0.20, 5),
    feather: new THREE.SphereGeometry(0.11, 12, 8)
};

function animalMaterial(hex, roughness=0.72) {
    return new THREE.MeshStandardMaterial({ color: hex, roughness, metalness: 0.02 });
}

function addPart(parent, geometry, material, position, scale=[1,1,1], rotation=[0,0,0], name='') {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    mesh.scale.set(...scale);
    mesh.rotation.set(...rotation);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = name;
    parent.add(mesh);
    return mesh;
}

function addFace(parent, y, z, mats, wide=0.12) {
    addPart(parent, animalGeometries.eye, mats.eye, [-wide,y,z]);
    addPart(parent, animalGeometries.eye, mats.eye, [ wide,y,z]);
    addPart(parent, animalGeometries.nose, mats.nose, [0,y-0.09,z+0.025], [1.15,0.75,0.75]);
}

function addFourLegs(parent, mats, y=0.26, spreadX=0.18, spreadZ=0.18) {
    const legs = [];
    for (const x of [-spreadX, spreadX]) for (const z of [-spreadZ, spreadZ]) {
        legs.push(addPart(parent, animalGeometries.leg, mats.body, [x,y,z], [1,1,1], [0,0,0], 'leg'));
    }
    return legs;
}

function makeRabbit(g, mats) {
    addPart(g, animalGeometries.sphere, mats.body, [0,0.44,0], [0.25,0.32,0.24]);
    const head = addPart(g, animalGeometries.sphere, mats.body, [0,0.72,0.06], [0.22,0.22,0.21], [0,0,0], 'head');
    addPart(g, animalGeometries.ear, mats.body, [-0.10,1.00,0.04], [0.72,1,0.60], [0,0,-0.10], 'ear');
    addPart(g, animalGeometries.ear, mats.body, [ 0.10,1.00,0.04], [0.72,1,0.60], [0,0, 0.10], 'ear');
    addFace(g, 0.75, 0.24, mats, 0.08);
    addPart(g, animalGeometries.sphere, mats.accent, [0,0.43,-0.23], [0.11,0.11,0.11], [0,0,0], 'tail');
    g.userData.animParts = { head, ears: g.children.filter(x=>x.name==='ear') };
}

function makeElephant(g, mats) {
    addPart(g, animalGeometries.sphere, mats.body, [0,0.48,0], [0.34,0.36,0.35]);
    const head = addPart(g, animalGeometries.sphere, mats.body, [0,0.72,0.15], [0.31,0.29,0.28], [0,0,0], 'head');
    addPart(g, animalGeometries.sphere, mats.inner, [-0.29,0.75,0.12], [0.17,0.24,0.08], [0,0,0.12], 'ear');
    addPart(g, animalGeometries.sphere, mats.inner, [ 0.29,0.75,0.12], [0.17,0.24,0.08], [0,0,-0.12], 'ear');
    const trunk = addPart(g, animalGeometries.leg, mats.body, [0,0.48,0.38], [0.8,1.35,0.8], [Math.PI/2,0,0], 'trunk');
    for (const x of [-0.13,0.13]) addPart(g, animalGeometries.tusk, mats.ivory, [x,0.58,0.39], [1,1,1], [Math.PI/2,0,0]);
    addFourLegs(g, mats, 0.20, 0.21, 0.20);
    addFace(g, 0.77, 0.40, mats, 0.12);
    g.userData.animParts = { head, trunk };
}

function makeHorse(g, mats) {
    addPart(g, animalGeometries.sphere, mats.body, [0,0.48,0], [0.28,0.34,0.39]);
    addPart(g, animalGeometries.leg, mats.body, [0,0.72,0.12], [1.25,1.35,1.25], [0.28,0,0]);
    const head = addPart(g, animalGeometries.sphere, mats.body, [0,0.94,0.21], [0.23,0.24,0.30], [0.18,0,0], 'head');
    for (const x of [-0.11,0.11]) addPart(g, animalGeometries.ear, mats.body, [x,1.22,0.14], [0.58,0.72,0.52], [0,0,x*0.8], 'ear');
    addPart(g, animalGeometries.sphere, mats.mane, [0,0.86,-0.09], [0.25,0.42,0.08], [0,0,0], 'mane');
    addFourLegs(g, mats, 0.20, 0.18, 0.22);
    addFace(g, 0.99, 0.49, mats, 0.09);
    g.userData.animParts = { head };
}

function makeDog(g, mats) {
    addPart(g, animalGeometries.sphere, mats.body, [0,0.45,0], [0.28,0.34,0.31]);
    const head = addPart(g, animalGeometries.sphere, mats.body, [0,0.78,0.12], [0.28,0.27,0.25], [0,0,0], 'head');
    for (const x of [-0.16,0.16]) {
        addPart(g, animalGeometries.sphere, mats.mane, [x,0.84,0.10], [0.10,0.21,0.07], [0,0,x*1.7], 'ear');
    }
    addPart(g, animalGeometries.sphere, mats.ivory, [0,0.72,0.32], [0.18,0.13,0.17]);
    addFace(g, 0.82, 0.37, mats, 0.10);
    addPart(g, animalGeometries.sphere, mats.accent, [0,0.58,0.25], [0.22,0.06,0.06], [0,0,0], 'collar');
    const tail = addPart(g, animalGeometries.leg, mats.body, [0,0.48,-0.31], [0.75,1.45,0.75], [0.90,0,0], 'tail');
    addFourLegs(g, mats, 0.19, 0.18, 0.17);
    g.userData.animParts = { head, tail, ears: g.children.filter(x=>x.name==='ear') };
}

function makePeacock(g, mats) {
    addPart(g, animalGeometries.sphere, mats.body, [0,0.49,0.02], [0.23,0.38,0.25]);
    addPart(g, animalGeometries.leg, mats.accent, [0,0.74,0.08], [0.85,1.2,0.85]);
    const head = addPart(g, animalGeometries.sphere, mats.accent, [0,1.02,0.10], [0.18,0.19,0.18], [0,0,0], 'head');
    addFace(g, 1.05, 0.27, mats, 0.07);
    const tail = new THREE.Group();
    tail.position.set(0,0.64,-0.18);
    tail.name = 'tail';
    for (let i=0;i<7;i++) {
        const a = -1.05 + i*0.35;
        const feather = addPart(tail, animalGeometries.feather, i%2 ? mats.feather : mats.accent,
            [Math.sin(a)*0.45, Math.cos(a)*0.36, -0.03], [0.85,1.65,0.40], [0,0,-a]);
        addPart(feather, animalGeometries.eye, mats.gold, [0,0.55,0.72], [1.25,1.25,0.7]);
    }
    g.add(tail);
    for (const x of [-0.07,0.07]) addPart(g, animalGeometries.leg, mats.gold, [x,0.18,0.02], [0.48,0.75,0.48]);
    g.userData.animParts = { head, tail };
}

function makeLion(g, mats) {
    addPart(g, animalGeometries.sphere, mats.body, [0,0.47,0], [0.31,0.36,0.33]);
    addPart(g, animalGeometries.mane, mats.mane, [0,0.83,0.09], [1.25,1.25,1], [Math.PI/2,0,0]);
    const head = addPart(g, animalGeometries.sphere, mats.body, [0,0.84,0.13], [0.25,0.25,0.23], [0,0,0], 'head');
    for (const x of [-0.19,0.19]) addPart(g, animalGeometries.sphere, mats.body, [x,1.02,0.10], [0.10,0.12,0.07]);
    addFace(g, 0.88, 0.34, mats, 0.10);
    addPart(g, animalGeometries.crown, mats.gold, [0,1.18,0.09], [0.9,0.9,0.9]);
    addFourLegs(g, mats, 0.19, 0.20, 0.18);
    const tail = addPart(g, animalGeometries.leg, mats.body, [0,0.48,-0.34], [0.68,1.45,0.68], [0.9,0,0], 'tail');
    addPart(tail, animalGeometries.sphere, mats.mane, [0,-0.25,0], [1.25,1.25,1.25]);
    g.userData.animParts = { head, tail };
}

function pieceMesh(type, color) {
    const g = new THREE.Group();
    const light = color === 'w';
    const mats = {
        body: animalMaterial(light ? 0xf0d8a8 : 0x59677f),
        inner: animalMaterial(light ? 0xe8a9a2 : 0x8695ad),
        accent: animalMaterial(light ? 0x35a7c9 : 0x8e5ad7),
        mane: animalMaterial(light ? 0xb66b2d : 0x252b38),
        feather: animalMaterial(light ? 0x39c67a : 0xb64d72),
        ivory: animalMaterial(0xfff2d2),
        gold: animalMaterial(0xf5c84c, 0.42),
        eye: animalMaterial(0x11151a, 0.35),
        nose: animalMaterial(light ? 0x5b352c : 0x1a1d25, 0.55)
    };

    if (type === 'p') makeRabbit(g, mats);
    else if (type === 'r') makeElephant(g, mats);
    else if (type === 'n') makeHorse(g, mats);
    else if (type === 'b') makeDog(g, mats);
    else if (type === 'q') makePeacock(g, mats);
    else if (type === 'k') makeLion(g, mats);

    g.rotation.y = light ? 0 : Math.PI;
    g.userData.pieceType = type;
    g.userData.phase = Math.random() * Math.PI * 2;
    g.userData.baseY = 0;
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

function animateAnimals(now){
    const time = now * 0.001;
    for (const animal of pieceMap.values()) {
        const phase = animal.userData.phase || 0;
        const parts = animal.userData.animParts || {};
        const breath = Math.sin(time * 2.2 + phase);
        animal.scale.y = 1 + breath * 0.018;
        animal.rotation.z = Math.sin(time * 1.4 + phase) * 0.018;

        if (parts.head) {
            parts.head.rotation.y = Math.sin(time * 1.15 + phase) * 0.12;
            parts.head.rotation.z = Math.sin(time * 1.8 + phase) * 0.035;
        }
        if (parts.ears) {
            parts.ears.forEach((ear, i) => {
                ear.rotation.x = Math.sin(time * 3.1 + phase + i * 0.8) * 0.10;
            });
        }
        if (parts.tail) {
            parts.tail.rotation.y = Math.sin(time * 2.6 + phase) * 0.18;
        }
        if (parts.trunk) {
            parts.trunk.rotation.z = Math.sin(time * 1.9 + phase) * 0.12;
        }
    }
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
    animateAnimals(now);
    controls.update();
    renderer.render(scene, camera);
}

rebuildAllPieces();
paintHL();
refreshUI();
loop();
