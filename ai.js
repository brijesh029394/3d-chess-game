import { Chess } from 'chess.js';

const values = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
function evaluate(chess) {
    if (chess.isCheckmate()) return -100000;
    if (chess.isDraw()) return 0;
    const turn = chess.turn();
    return chess.board().flat().reduce((score, piece) => {
        if (!piece) return score;
        const center = 3.5 - Math.abs(3.5 - (piece.square.charCodeAt(0) - 97));
        return score + (piece.color === turn ? 1 : -1) * (values[piece.type] + center * 5);
    }, 0);
}
function search(chess, depth, alpha, beta, deadline) {
    if (depth === 0 || chess.isGameOver() || performance.now() > deadline) return evaluate(chess);
    let best = -Infinity;
    const moves = chess.moves({ verbose: true }).sort((a, b) => (values[b.captured] || 0) - (values[a.captured] || 0));
    for (const move of moves) {
        chess.move(move);
        const score = -search(chess, depth - 1, -beta, -alpha, deadline);
        chess.undo();
        best = Math.max(best, score);
        alpha = Math.max(alpha, score);
        if (alpha >= beta) break;
    }
    return best;
}
export function chooseComputerMove(fen, difficulty = 'medium') {
    const chess = new Chess(fen);
    if (chess.isGameOver()) return null;
    const moves = chess.moves({ verbose: true });
    const depth = { easy: 1, medium: 2, hard: 3 }[difficulty] || 2;
    const deadline = performance.now() + 1500;
    let best = moves[0], bestScore = -Infinity;
    for (const move of moves) {
        if (performance.now() > deadline) break;
        chess.move(move);
        const score = -search(chess, depth - 1, -Infinity, Infinity, deadline);
        chess.undo();
        if (score > bestScore) { best = move; bestScore = score; }
    }
    return { from: best.from, to: best.to, ...(best.promotion ? { promotion: best.promotion } : {}) };
}
