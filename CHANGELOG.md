# Changelog

## Unreleased

- Add the accessible Animal Guide with all six animal-to-role mappings.
- Add persistent cyan/violet team base markers to every animal.
- Honor runtime `prefers-reduced-motion` changes for idle and move animation.
- Add arrow-key chessboard navigation and keyboard select/move controls.
- Reuse application-owned animal materials and dispose shared GPU resources on teardown.
- Serialize move transactions so input cannot overlap active movement.
- Add automated regression coverage for animal mappings, dog bishops, standard
  and special moves, accessible labels, and transaction locking.
