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
