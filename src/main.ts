import "./styles.css";

import { Game } from "./core/Game";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("ASCENT could not find its application root.");
}

const game = new Game(app);
game.start();

if (import.meta.hot) {
  import.meta.hot.dispose(() => game.dispose());
}
