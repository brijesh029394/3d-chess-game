import { chooseComputerMove } from './ai.js';
self.onmessage = ({ data }) => self.postMessage(chooseComputerMove(data.fen, data.difficulty));
