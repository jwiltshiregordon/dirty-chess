function parseUCI(uciString) {
  const result = {};

  const matches = {
    depth: /depth (\d+)/,
    seldepth: /seldepth (\d+)/,
    multipv: /multipv (\d+)/,
    scoreCp: /score cp (-?\d+)/,
    scoreMate: /score mate (-?\d+)/, // New regex for mating prediction
    nodes: /nodes (\d+)/,
    nps: /nps (\d+)/,
    time: /time (\d+)/,
    pv: /pv ((?:[a-h][1-8][a-h][1-8]\s?)+)/,
    bmc: /bmc (\d+\.\d+)/,
  };

  for (const key in matches) {
    const match = uciString.match(matches[key]);
    if (match) {
      if (key === "pv") {
        result[key] = match[1].trim().split(/\s+/);
      } else if (key === "bmc") {
        result[key] = parseFloat(match[1]);
      } else if (key === "scoreMate") {
        result["score"] = { mate: parseInt(match[1], 10) };
      } else if (key === "scoreCp") {
        result["score"] = { cp: parseInt(match[1], 10) };
      } else {
        result[key] = parseInt(match[1], 10);
      }
    }
  }

  return result;
}

function getMainLineFens(game) {
  const fens = [];
  do {
    fens.push(game.fen());
  } while (game.undo()); // Move one step at a time until the end
  return fens.reverse();
}

function getClocks(text) {
  const regex = /\[%clk\s?(\d+:\d{2}:\d{2}(?:\.\d)?)\]/gm;

  let secondsArray = [];
  let match;

  // While there are matches, push the captured group (time format) to the snippets array
  while ((match = regex.exec(text)) !== null) {
    const timeParts = match[1].split(":");

    // Convert hours and minutes to seconds, and add them to the seconds value
    let totalSeconds =
      parseInt(timeParts[0], 10) * 3600 + // hours to seconds
      parseInt(timeParts[1], 10) * 60 + // minutes to seconds
      parseFloat(timeParts[2]); // seconds (as float)

    secondsArray.push(totalSeconds);
  }

  return secondsArray;
}

function detectPremoves(t) {
  const tolerance = 1e-4;
  const premoveIndices = [];

  for (let i = 2; i < t.length; i++) {
    const difference = t[i - 2] - t[i];
    if (Math.abs(difference - 0.1) < tolerance) {
      premoveIndices.push(i);
    }
  }

  return premoveIndices;
}

function loadPGN() {
  const pgn = document.getElementById("pgnInput").value.replace("\n", "");

  const clock = getClocks(pgn);
  const premoves = detectPremoves(clock);

  const chess = new Chess();

  // Load the PGN into the chess instance
  if (!chess.load_pgn(pgn)) {
    console.error("Invalid PGN data");
    return;
  } else {
    console.log("PGN loaded successfully into chess.js");
  }
  return {
    moves: chess.history(),
    fens: getMainLineFens(chess),
    premoves,
    clock,
    header: pgn.slice(0, pgn.indexOf("\n1.")),
  };
}

function moveName(moveIndex, moveAlgebra) {
  if (moveIndex % 2 === 0) {
    return `${moveIndex / 2 + 1}. ${moveAlgebra}`;
  } else {
    return `${(moveIndex - 1) / 2 + 1}... ${moveAlgebra}`;
  }
}

async function loadRandomGame() {
  const user = document.getElementById("chess-com-user").value;
  const year = document.getElementById("yearSelect").value;
  const month = document.getElementById("monthSelect").value;
  const pgnInput = document.getElementById("pgnInput");
  pgnInput.value = "Loading a random game...";

  try {
    const response = await fetch(
      `https://api.chess.com/pub/player/${user}/games/${year}/${month}`
    );
    const data = await response.json();

    const games = data.games.filter(
      (game) => game.time_class === "bullet"// || game.time_class === "blitz"
    );

    const randomGame = games[Math.floor(Math.random() * games.length)];

    pgnInput.value = randomGame
      ? randomGame.pgn
      : "No bullet or blitz games found for the selected user, month, and year.";
  } catch (error) {
    console.error("Error fetching games:", error);
    pgnInput.value = "Error fetching games. Please try again later.";
  }
}
