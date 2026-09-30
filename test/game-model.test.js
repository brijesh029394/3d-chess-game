import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { readFile } from 'node:fs/promises';
import { ANIMAL_ROLES, MoveLock, boardPresentation, describeSquare } from '../game-model.js';

test('all six roles have one stable animal mapping and bishops are dogs', () => {
    assert.deepEqual(Object.keys(ANIMAL_ROLES).sort(), ['b', 'k', 'n', 'p', 'q', 'r']);
    assert.equal(ANIMAL_ROLES.b.animal, 'Dog');
    assert.equal(new Set(Object.values(ANIMAL_ROLES).map(({ animal }) => animal)).size, 6);
});

test('starting presentation has 32 animals and four dog bishops', () => {
    const presentation = boardPresentation(new Chess());
    assert.equal(presentation.size, 32);
    assert.deepEqual(['c1', 'f1', 'c8', 'f8'].map(square => presentation.get(square).animal),
        ['Dog', 'Dog', 'Dog', 'Dog']);
});

test('presentation follows captures, castling, en passant, promotion, undo, and reset', () => {
    const capture = new Chess();
    ['e4', 'd5', 'exd5'].forEach(move => capture.move(move));
    assert.equal(boardPresentation(capture).get('d5').color, 'w');
    assert.equal(boardPresentation(capture).size, 31);

    const castle = new Chess('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
    castle.move('O-O');
    assert.equal(boardPresentation(castle).get('g1').type, 'k');
    assert.equal(boardPresentation(castle).get('f1').type, 'r');

    const passant = new Chess('8/8/8/3pP3/8/8/8/4K2k w - d6 0 1');
    passant.move({ from: 'e5', to: 'd6' });
    assert.equal(boardPresentation(passant).has('d5'), false);
    assert.equal(boardPresentation(passant).get('d6').type, 'p');

    const promotion = new Chess('8/P7/8/8/8/8/8/4K2k w - - 0 1');
    promotion.move({ from: 'a7', to: 'a8', promotion: 'q' });
    assert.equal(boardPresentation(promotion).get('a8').animal, 'Peacock');
    promotion.undo();
    assert.equal(boardPresentation(promotion).get('a7').animal, 'Rabbit');
    promotion.reset();
    assert.equal(boardPresentation(promotion).size, 32);
});

test('accessible labels include team, animal, role, square, and state', () => {
    assert.equal(describeSquare('c1', { type: 'b', color: 'w' }, 'selected'),
        'c1, Dawn Dog Bishop, selected');
    assert.equal(describeSquare('e4', null, 'legal target'), 'e4, empty, legal target');
});

test('move lock rejects overlapping transactions and releases after completion', async () => {
    const lock = new MoveLock();
    let release;
    const first = lock.run(() => new Promise(resolve => { release = resolve; }));
    assert.equal(lock.locked, true);
    assert.equal(await lock.run(async () => {}), false);
    release();
    assert.equal(await first, true);
    assert.equal(lock.locked, false);
});

test('UI source retains guide, keyboard, reduced-motion, and shared-resource contracts', async () => {
    const [html, main] = await Promise.all([
        readFile(new URL('../index.html', import.meta.url), 'utf8'),
        readFile(new URL('../main.js', import.meta.url), 'utf8')
    ]);
    assert.match(html, /aria-controls="animal-guide"/);
    assert.match(html, />Dog<\/strong><span>Bishop</);
    assert.match(main, /prefers-reduced-motion: reduce/);
    assert.match(main, /renderer\.domElement\.addEventListener\('keydown'/);
    assert.match(main, /const animalPalettes = Object\.freeze/);
    assert.match(main, /const moveLock = new MoveLock/);
});
