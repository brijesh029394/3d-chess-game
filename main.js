import * as THREE from 'three';
import { Chess } from 'chess.js';

const chess = new Chess();
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1e1e24);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 14, 12);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
dirLight.position.set(10, 20, 10);
dirLight.castShadow = true;
scene.add(dirLight);

const boardGroup = new THREE.Group();
scene.add(boardGroup);

const squares = [];
const boardSize = 8;
const squareSize = 1;
const offset = (boardSize * squareSize) / 2 - squareSize / 2;

const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf0d9b5 });
const blackMat = new THREE.MeshStandardMaterial({ color: 0xb58863 });

for (let r = 0; r < boardSize; r++) {
    squares[r] = [];
    for (let c = 0; c < boardSize; c++) {
        const mat = (r + c) % 2 === 0 ? whiteMat : blackMat;
        const geom = new THREE.BoxGeometry(squareSize, 0.2, squareSize);
        const mesh = new THREE.Mesh(geom, mat);
        mesh.position.set(c * squareSize - offset, -0.1, r * squareSize - offset);
        mesh.receiveShadow = true;
        mesh.userData = { row: r, col: c };
        boardGroup.add(mesh);
        squares[r][c] = mesh;
    }
}

function createPieceMesh(type, color) {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ 
        color: color === 'w' ? 0xffffff : 0x222222,
        roughness: 0.3,
        metalness: 0.2
    });

    let geom;
    if (type === 'p') geom = new THREE.CylinderGeometry(0.3, 0.4, 0.6, 16);
    else if (type === 'r') geom = new THREE.BoxGeometry(0.5, 0.8, 0.5);
    else if (type === 'n') geom = new THREE.ConeGeometry(0.4, 0.9, 16);
    else if (type === 'b') geom = new THREE.CylinderGeometry(0.2, 0.4, 1.0, 16);
    else if (type === 'q') geom = new THREE.SphereGeometry(0.4, 16, 16);
    else if (type === 'k') geom = new THREE.BoxGeometry(0.4, 1.2, 0.4);

    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.y = 0.5;
    mesh.castShadow = true;
    group.add(mesh);
    return group;
}

const piecesGroup = new THREE.Group();
scene.add(piecesGroup);

function updateBoard() {
    while(piecesGroup.children.length > 0) {
        piecesGroup.remove(piecesGroup.children[0]);
    }

    const board = chess.board();
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            if (piece) {
                const mesh = createPieceMesh(piece.type, piece.color);
                mesh.position.set(c * squareSize - offset, 0, r * squareSize - offset);
                piecesGroup.add(mesh);
            }
        }
    }
    document.getElementById('status').innerText = chess.turn() === 'w' ? "White's Turn" : "Black's Turn";
    if (chess.isGameOver()) {
        document.getElementById('status').innerText = "Game Over!";
    }
}

updateBoard();

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let selectedSquare = null;

window.addEventListener('click', (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(boardGroup.children);

    if (intersects.length > 0) {
        const hit = intersects[0].object;
        const { row, col } = hit.userData;
        const squareName = String.fromCharCode(97 + col) + (8 - row);

        if (!selectedSquare) {
            selectedSquare = squareName;
            hit.material.emissive.setHex(0x555522);
        } else {
            try {
                const result = chess.move({ from: selectedSquare, to: squareName, promotion: 'q' });
                if (result) updateBoard();
            } catch (err) {
                console.log("Invalid move");
            }
            boardGroup.children.forEach(s => s.material.emissive.setHex(0x000000));
            selectedSquare = null;
        }
    }
});

document.getElementById('reset').addEventListener('click', () => {
    chess.reset();
    updateBoard();
});

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}
animate();