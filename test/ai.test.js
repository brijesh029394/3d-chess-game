import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { chooseComputerMove } from '../ai.js';

test('each computer difficulty returns a legal move without changing input position', () => {
    const chess = new Chess();
    chess.move('e4');
    for (const difficulty of ['easy', 'medium', 'hard']) {
        const fen = chess.fen();
        const move = chooseComputerMove(fen, difficulty);
        assert.ok(new Chess(fen).move(move));
        assert.equal(chess.fen(), fen);
    }
});
test('computer finds mate and returns no move in finished games', () => {
    const chess = new Chess();
    ['f3', 'e5', 'g4'].forEach(move => chess.move(move));
    chess.move(chooseComputerMove(chess.fen(), 'medium'));
    assert.equal(chess.isCheckmate(), true);
    assert.equal(chooseComputerMove(chess.fen()), null);
});
test('computer preserves promotion choice', () => {
    const chess = new Chess('8/8/8/8/8/7K/p7/7k b - - 0 1');
    const move = chooseComputerMove(chess.fen(), 'easy');
    assert.equal(move.promotion, 'q');
    assert.ok(chess.move(move));
});
