let stockfish = new Worker("js/stockfish.js");

const infoMessage = function (event) {
  console.log("Stockfish says:", event.data);
};
stockfish.onmessage = infoMessage;

// Ask stockfish for UCI mode
stockfish.postMessage("uci");

function logMessage(message) {
  const messagesDiv = document.getElementById("messages");
  const newLine = document.createElement("div");
  newLine.textContent = message;
  messagesDiv.appendChild(newLine);
}

function clearMessages() {
  const messagesDiv = document.getElementById("messages");
  messagesDiv.innerHTML = "";
}

async function getStockfishEvaluation(fen) {
  return new Promise((resolve, reject) => {
    const depth = document.getElementById("stockfishDepth").value;
    let scores = [];
    stockfish.onmessage = function (event) {
      if (event.data.startsWith("info")) {
        const result = parseUCI(event.data);
        const score =
          result.score.mate === undefined
            ? result.score.cp
            : result.score.mate > 0
            ? 10000
            : -10000;
        scores.push(score);
      } else if (event.data.startsWith("bestmove")) {
        stockfish.onmessage = infoMessage;

        const loCp = Math.min(...scores);
        const hiCp = Math.max(...scores);

        const lo = { depth: scores.indexOf(loCp), cp: loCp };
        const hi = { depth: scores.indexOf(hiCp), cp: hiCp };
        resolve({ cp: scores[scores.length - 1], lo, hi });
      }
    };

    stockfish.postMessage(`position fen ${fen}`);
    stockfish.postMessage(`go depth ${depth}`);
  });
}

async function getReasonableMoves(fen, depth) {
  const start = await getStockfishEvaluation(fen, depth);
  const legalMoves = Chess(fen).moves();
  const reasonableMoves = [];

  for (const move of legalMoves) {
    const game = Chess(fen);
    game.move(move);
    const option = await getStockfishEvaluation(game.fen(), depth);
    console.log(
      `considering ${move}. I'm currently at least ${
        start.lo.cp
      } and this move is best-case moving me to ${-option.lo.cp}`
    );
    console.log(option);
    if (start.lo.cp < -option.lo.cp) {
      reasonableMoves.push(move);
    }
  }
  return reasonableMoves;
}

async function exploitPremove(fen, expected, premove) {
  const game = new Chess(fen);
  const legalMoves = game.moves();

  let bestEval = { cp: -Infinity };
  let bestMove = null;
  let expectedEval = null;

  for (const move of legalMoves) {
    game.move(move);

    // Check if the premove is still legal
    if (game.move(premove)) {
      const evaluation = await getStockfishEvaluation(game.fen());
      if (move === expected) {
        expectedEval = evaluation;
      }

      // Adjust evaluation based on the player's perspective

      if (evaluation.cp > bestEval.cp) {
        bestEval = evaluation;
        bestMove = move;
      }
    }

    // Reset the position for the next iteration
    game.load(fen);
  }

  game.move(bestMove);
  const riskedEvaluation = await getStockfishEvaluation(game.fen());

  return {
    move: bestMove,
    evaluation: bestEval,
    expected: expected === bestMove,
    expectedEvaluation: expectedEval,
    riskedEvaluation: riskedEvaluation,
  };
}

async function analyze() {
  const pgnInfo = loadPGN();
  const { moves, fens, premoves } = pgnInfo;
  const resultsTable = document.getElementById("#resultsTable");
  resultsTable.style = "";
  const tableBody = document.querySelector("#resultsTable tbody");

  // Clear previous results
  tableBody.innerHTML = "";

  const skipOpening = document.getElementById("skipOpening").checked;
  clearMessages();
  logMessage(`Detected ${premoves.length} pre-moves`);
  for (let j = 0; j < premoves.length; j++) {
    logMessage(`Considering ${j + 1}/${premoves.length}`);
    const i = premoves[j];
    if (skipOpening && i < 10) {
      continue;
    }
    const fen = fens[i - 1];
    const premove = moves[i];
    const expected = moves[i - 1];
    const exploitation = await exploitPremove(fen, expected, premove);

    if (!exploitation.expected) {
      const risked =
        exploitation.expectedEvaluation.cp + exploitation.riskedEvaluation.cp;
      const advantage =
        exploitation.evaluation.cp - exploitation.expectedEvaluation.cp;
      const message = [
        `pre-move ${moveName(i, premove)} was vulnerable to `,
        `${moveName(i - 1, exploitation.move)}. `,
        `This ploy risks ${risked} centipawns to extract a ${advantage} `,
        `centipawn advantage.`,
      ].join("");

      // Add a new row to the table
      const newRow = tableBody.insertRow();
      newRow.insertCell().textContent = moveName(i, premove);
      newRow.insertCell().textContent = moveName(i - 1, exploitation.move);
      newRow.insertCell().textContent = risked;
      newRow.insertCell().textContent = advantage;
      newRow.insertCell().textContent = message;
    }
  }
  clearMessages();
  logMessage("Analysis complete");
}
