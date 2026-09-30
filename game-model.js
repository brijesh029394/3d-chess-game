export const ANIMAL_ROLES = Object.freeze({
    p: Object.freeze({ animal: 'Rabbit', role: 'Pawn', symbol: 'P' }),
    r: Object.freeze({ animal: 'Elephant', role: 'Rook', symbol: 'R' }),
    n: Object.freeze({ animal: 'Horse', role: 'Knight', symbol: 'N' }),
    b: Object.freeze({ animal: 'Dog', role: 'Bishop', symbol: 'B' }),
    q: Object.freeze({ animal: 'Peacock', role: 'Queen', symbol: 'Q' }),
    k: Object.freeze({ animal: 'Lion', role: 'King', symbol: 'K' })
});

export const TEAM_NAMES = Object.freeze({ w: 'Dawn', b: 'Dusk' });

export function describeSquare(square, piece, state = '') {
    const suffix = state ? `, ${state}` : '';
    if (!piece) return `${square}, empty${suffix}`;
    const definition = ANIMAL_ROLES[piece.type];
    return `${square}, ${TEAM_NAMES[piece.color]} ${definition.animal} ${definition.role}${suffix}`;
}

export function boardPresentation(chess) {
    const result = new Map();
    const board = chess.board();
    for (let rankIndex = 0; rankIndex < 8; rankIndex += 1) {
        for (let fileIndex = 0; fileIndex < 8; fileIndex += 1) {
            const piece = board[rankIndex][fileIndex];
            if (!piece) continue;
            const square = `${String.fromCharCode(97 + fileIndex)}${8 - rankIndex}`;
            result.set(square, { ...piece, ...ANIMAL_ROLES[piece.type] });
        }
    }
    return result;
}

export class MoveLock {
    #locked = false;

    get locked() { return this.#locked; }

    async run(operation) {
        if (this.#locked) return false;
        this.#locked = true;
        try {
            await operation();
            return true;
        } finally {
            this.#locked = false;
        }
    }
}
