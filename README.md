# Animal Kingdom 3D Chess 🦁

Interactive animated-animal 3D chess built with Three.js + chess.js. Auto-deployed to GitHub Pages via CI/CD.

## Animal pieces

- Pawns: rabbits
- Rooks: elephants
- Knights: horses
- Bishops: dogs
- Queens: peacocks
- Kings: lions

Every animal has lightweight procedural idle animation. Dawn and Dusk armies use
distinct palettes plus persistent cyan/violet base markers, so team identity is
not color-only. The in-game Animal Guide explains every role.

## Accessibility

- Focus the 3D board with `Tab`, navigate squares with the arrow keys, and use
  `Enter` or `Space` to select/move.
- The board announces square, team, animal, role, and move state.
- The Animal Guide closes with its button or `Escape` and restores focus.
- Operating-system reduced-motion preferences stop idle movement and remove the
  move hop.

## Local dev
```
npm install
npx vite
```

## Verification

```sh
npm test
npm run build
```

## Play
Live: https://brijesh029394.github.io/3d-chess-game/

## Computer opponent

The computer runs a bundled chess.js-based search in a module worker, with
one-, two-, and three-ply search for Easy, Medium, and Hard. It needs no external
engine download. This is a casual opponent, not Stockfish-strength play.
Resetting or switching game modes cancels pending searches.

Pawns can promote to any of the four legal roles. The promotion dialog can be
cancelled with Escape. A yellow marker identifies the keyboard's active square.

For browser regression checks, start `npx vite --host 0.0.0.0` in another terminal,
then run `npx playwright install chromium` and `npm run test:browser`.
Set `CHESS_URL` to check a production preview instead of the development server.

## Capture effects

Taking a piece plays a short synthesized impact sound and a 3D burst with an
expanding ring in the captured team's color. En passant effects appear on the
captured pawn's square. Quiet moves do not trigger the effect.
Use **Sound On / Sound Off** to toggle capture audio; the preference is saved
on this device. Audio starts after a keyboard or pointer interaction, according
to browser autoplay rules. Reduced motion skips the burst, while sound remains
independently controlled. Undo and New Game clear active visual effects.
