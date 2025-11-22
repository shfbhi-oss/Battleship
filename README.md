# Battleship
Battleship Game
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Battleship Game</title>
  <style>
    :root {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    body {
      margin: 0;
      padding: 20px;
      background: #101827;
      color: #f9fafb;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
    }
    h1 {
      margin: 0;
      font-size: 28px;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    #game {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 32px;
      max-width: 900px;
      width: 100%;
    }
    .board-wrapper {
      background: #111827;
      border-radius: 16px;
      padding: 16px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }
    .board-title {
      font-size: 16px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      opacity: 0.9;
    }
    .board-subtitle {
      font-size: 12px;
      opacity: 0.7;
    }
    .board {
      display: grid;
      grid-template-columns: repeat(10, 30px);
      grid-template-rows: repeat(10, 30px);
      gap: 3px;
      margin-top: 8px;
    }
    .cell {
      width: 30px;
      height: 30px;
      border-radius: 6px;
      background: #0f172a;
      box-shadow: inset 0 0 0 1px rgba(148, 163, 184, 0.25);
      cursor: pointer;
      transition: transform 0.08s ease, background 0.12s ease, box-shadow 0.12s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      user-select: none;
    }
    .cell:hover {
      transform: translateY(-1px);
      box-shadow: 0 0 0 1px rgba(96, 165, 250, 0.7), 0 6px 12px rgba(15, 23, 42, 0.8);
    }
    .cell.ship {
      background: #1f2937;
      box-shadow: inset 0 0 0 1px rgba(52, 211, 153, 0.4);
    }
    .cell.hit {
      background: #b91c1c;
      box-shadow: inset 0 0 0 1px rgba(248, 250, 252, 0.65);
      cursor: default;
    }
    .cell.miss {
      background: #1f2937;
      box-shadow: inset 0 0 0 1px rgba(148, 163, 184, 0.4);
      cursor: default;
    }
    .cell.hit::after {
      content: "✕";
    }
    .cell.miss::after {
      content: "•";
      font-size: 18px;
      opacity: 0.8;
    }
    .legend {
      margin-top: 6px;
      font-size: 11px;
      opacity: 0.8;
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      justify-content: center;
    }
    .legend span {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .legend-box {
      width: 12px;
      height: 12px;
      border-radius: 3px;
      background: #0f172a;
      box-shadow: inset 0 0 0 1px rgba(148, 163, 184, 0.6);
    }
    .legend-box.ship {
      background: #1f2937;
      box-shadow: inset 0 0 0 1px rgba(52, 211, 153, 0.7);
    }
    .legend-box.hit {
      background: #b91c1c;
      box-shadow: inset 0 0 0 1px rgba(248, 250, 252, 0.8);
    }
    .legend-box.miss {
      background: #1f2937;
      box-shadow: inset 0 0 0 1px rgba(148, 163, 184, 0.7);
    }
    #info-panel {
      max-width: 900px;
      width: 100%;
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
    }
    #status {
      font-size: 14px;
      min-height: 20px;
    }
    #scores {
      font-size: 13px;
      opacity: 0.8;
    }
    #controls {
      display: flex;
      gap: 8px;
      align-items: center;
    }
    button {
      padding: 8px 14px;
      border-radius: 999px;
      border: none;
      background: linear-gradient(135deg, #2563eb, #4f46e5);
      color: white;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      font-size: 11px;
      cursor: pointer;
      box-shadow: 0 10px 20px rgba(37, 99, 235, 0.45);
      transition: transform 0.1s ease, box-shadow 0.1s ease, filter 0.15s ease;
    }
    button:hover {
      transform: translateY(-1px);
      filter: brightness(1.05);
      box-shadow: 0 14px 26px rgba(37, 99, 235, 0.55);
    }
    button:active {
      transform: translateY(1px);
      box-shadow: 0 6px 12px rgba(15, 23, 42, 0.7);
    }
    #hint {
      font-size: 11px;
      opacity: 0.7;
    }
    @media (max-width: 700px) {
      .board {
        grid-template-columns: repeat(10, 26px);
        grid-template-rows: repeat(10, 26px);
      }
      .cell {
        width: 26px;
        height: 26px;
      }
    }
  </style>
</head>
<body>
  <h1>Battleship</h1>
  <div id="hint">Click on the Computer Board to fire. First to sink all ships wins.</div>

  <div id="game">
    <div class="board-wrapper">
      <div class="board-title">Your Board</div>
      <div class="board-subtitle">Your ships are visible. Computer fires here.</div>
      <div id="player-board" class="board"></div>
      <div class="legend">
        <span><span class="legend-box ship"></span> Ship</span>
        <span><span class="legend-box hit"></span> Hit</span>
        <span><span class="legend-box miss"></span> Miss</span>
      </div>
    </div>

    <div class="board-wrapper">
      <div class="board-title">Computer Board</div>
      <div class="board-subtitle">Ships are hidden. Fire by clicking cells.</div>
      <div id="enemy-board" class="board"></div>
      <div class="legend">
        <span><span class="legend-box hit"></span> Your Hit</span>
        <span><span class="legend-box miss"></span> Your Miss</span>
      </div>
    </div>
  </div>

  <div id="info-panel">
    <div id="status"></div>
    <div id="scores"></div>
    <div id="controls">
      <button id="reset-btn">New Game</button>
    </div>
  </div>

  <script>
    const BOARD_SIZE = 10;
    const SHIP_SIZES = [5, 4, 3, 3, 2]; // Classic Battleship fleet

    const gameState = {
      playerBoard: null,
      enemyBoard: null,
      playerShips: [],
      enemyShips: [],
      playerShots: null,
      enemyShots: null,
      playerHits: 0,
      enemyHits: 0,
      totalShipCells: SHIP_SIZES.reduce((a, b) => a + b, 0),
      gameOver: false
    };

    function createEmptyBoard(fillValue = null) {
      return Array.from({ length: BOARD_SIZE }, () =>
        Array.from({ length: BOARD_SIZE }, () => fillValue)
      );
    }

    function placeShipsRandomly(board) {
      const ships = [];
      for (const size of SHIP_SIZES) {
        let placed = false;
        while (!placed) {
          const horizontal = Math.random() < 0.5;
          const maxX = horizontal ? BOARD_SIZE - size : BOARD_SIZE - 1;
          const maxY = horizontal ? BOARD_SIZE - 1 : BOARD_SIZE - size;
          const startX = Math.floor(Math.random() * (maxX + 1));
          const startY = Math.floor(Math.random() * (maxY + 1));

          let canPlace = true;
          const positions = [];

          for (let i = 0; i < size; i++) {
            const x = horizontal ? startX + i : startX;
            const y = horizontal ? startY : startY + i;
            if (board[y][x] !== null) {
              canPlace = false;
              break;
            }
            positions.push({ x, y });
          }

          if (canPlace) {
            const shipIndex = ships.length;
            const ship = { size, positions, hits: 0 };
            ships.push(ship);
            for (const pos of positions) {
              board[pos.y][pos.x] = shipIndex;
            }
            placed = true;
          }
        }
      }
      return ships;
    }

    function renderBoard(containerId, isPlayerBoard) {
      const container = document.getElementById(containerId);
      container.innerHTML = "";
      const board = isPlayerBoard ? gameState.playerBoard : gameState.enemyBoard;

      for (let y = 0; y < BOARD_SIZE; y++) {
        for (let x = 0; x < BOARD_SIZE; x++) {
          const cell = document.createElement("div");
          cell.classList.add("cell");
          cell.dataset.x = x;
          cell.dataset.y = y;

          if (isPlayerBoard && board[y][x] !== null) {
            cell.classList.add("ship");
          }

          container.appendChild(cell);
        }
      }
    }

    function getCellElement(boardId, x, y) {
      const container = document.getElementById(boardId);
      const index = y * BOARD_SIZE + x;
      return container.children[index];
    }

    function updateStatus(msg) {
      document.getElementById("status").textContent = msg;
    }

    function updateScores() {
      document.getElementById("scores").textContent =
        `You: ${gameState.playerHits}/${gameState.totalShipCells} ` +
        `| Computer: ${gameState.enemyHits}/${gameState.totalShipCells}`;
    }

    function resetGame() {
      gameState.playerBoard = createEmptyBoard(null);
      gameState.enemyBoard = createEmptyBoard(null);
      gameState.playerShots = createEmptyBoard(null);
      gameState.enemyShots = createEmptyBoard(null);
      gameState.playerHits = 0;
      gameState.enemyHits = 0;
      gameState.gameOver = false;

      gameState.playerShips = placeShipsRandomly(gameState.playerBoard);
      gameState.enemyShips = placeShipsRandomly(gameState.enemyBoard);

      renderBoard("player-board", true);
      renderBoard("enemy-board", false);

      updateStatus("Game started. Fire at the computer's board!");
      updateScores();
    }

    function checkIfShipSunk(ship, isEnemy) {
      if (ship.hits === ship.size) {
        if (isEnemy) {
          updateStatus(`You sank a computer ship of length ${ship.size}!`);
        } else {
          updateStatus(`Computer sank one of your ships (length ${ship.size})!`);
        }
      }
    }

    function checkWin() {
      if (gameState.playerHits >= gameState.totalShipCells) {
        gameState.gameOver = true;
        updateStatus("You win! You sank all computer ships.");
        return true;
      }
      if (gameState.enemyHits >= gameState.totalShipCells) {
        gameState.gameOver = true;
        updateStatus("You lost. The computer sank all your ships.");
        return true;
      }
      return false;
    }

    function playerAttack(x, y, cellEl) {
      if (gameState.gameOver) return;
      if (gameState.playerShots[y][x] !== null) return; // already fired here

      const targetBoard = gameState.enemyBoard;
      const shipIndex = targetBoard[y][x];

      if (shipIndex !== null) {
        // Hit
        cellEl.classList.add("hit");
        gameState.playerShots[y][x] = "hit";
        const ship = gameState.enemyShips[shipIndex];
        ship.hits += 1;
        gameState.playerHits += 1;
        updateStatus("Hit!");
        checkIfShipSunk(ship, true);
      } else {
        // Miss
        cellEl.classList.add("miss");
        gameState.playerShots[y][x] = "miss";
        updateStatus("Miss.");
      }

      updateScores();
      if (!checkWin()) {
        setTimeout(computerTurn, 350);
      }
    }

    function computerTurn() {
      if (gameState.gameOver) return;

      let x, y;
      // Pick a random untargeted cell on your board
      while (true) {
        x = Math.floor(Math.random() * BOARD_SIZE);
        y = Math.floor(Math.random() * BOARD_SIZE);
        if (gameState.enemyShots[y][x] === null) break;
      }

      const shipIndex = gameState.playerBoard[y][x];
      const cellEl = getCellElement("player-board", x, y);

      if (shipIndex !== null) {
        // Hit
        cellEl.classList.add("hit");
        cellEl.classList.remove("ship"); // reveal ship as hit
        gameState.enemyShots[y][x] = "hit";
        const ship = gameState.playerShips[shipIndex];
        ship.hits += 1;
        gameState.enemyHits += 1;
        updateStatus("Computer hit one of your ships!");
        checkIfShipSunk(ship, false);
      } else {
        // Miss
        cellEl.classList.add("miss");
        gameState.enemyShots[y][x] = "miss";
        updateStatus("Computer missed.");
      }

      updateScores();
      checkWin();
    }

    document.addEventListener("DOMContentLoaded", () => {
      resetGame();

      const enemyBoardEl = document.getElementById("enemy-board");
      enemyBoardEl.addEventListener("click", (e) => {
        if (gameState.gameOver) return;
        const cell = e.target;
        if (!cell.classList.contains("cell")) return;
        const x = parseInt(cell.dataset.x, 10);
        const y = parseInt(cell.dataset.y, 10);
        playerAttack(x, y, cell);
      });

      document.getElementById("reset-btn").addEventListener("click", resetGame);
    });
  </script>
</body>
</html>
