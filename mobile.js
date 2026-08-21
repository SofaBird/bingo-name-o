const elements = {
  loading: document.getElementById("loading"),
  errorState: document.getElementById("errorState"),
  errorMessage: document.getElementById("errorMessage"),
  game: document.getElementById("game"),
  themeColor: document.getElementById("themeColor"),
  gameTitle: document.getElementById("gameTitle"),
  rules: document.getElementById("rulesLine"),
  grid: document.getElementById("cardGrid"),
  reset: document.getElementById("resetBtn"),
  entryModal: document.getElementById("entryModal"),
  modalPrompt: document.getElementById("modalPrompt"),
  guestName: document.getElementById("guestNameInput"),
  cancelEntry: document.getElementById("cancelEntry"),
  saveEntry: document.getElementById("saveEntry"),
  winModal: document.getElementById("winModal"),
  winEmoji: document.getElementById("winEmoji"),
  winTitle: document.getElementById("winTitle"),
  winMessage: document.getElementById("winMessage"),
  winDigest: document.getElementById("winDigest"),
  closeWin: document.getElementById("closeWin"),
};

const ACTIVE_GAME_KEY = "bingo_active_mobile_game_v1";
const CLARITY_PROJECT_ID = "y5jtcx07fo";

let gameData = null;
let gameKey = "";
let state = null;
let activeCellIndex = null;
let lastFocusedCell = null;
let syncTimer = null;
let syncInFlight = false;
let syncAgain = false;

const THEMES = ["black", "red", "green", "blue", "yellow", "purple"];
const THEME_COLORS = {
  black: "#303030",
  red: "#7c1f31",
  green: "#246049",
  blue: "#28598d",
  yellow: "#c59a1a",
  purple: "#2c0f4a",
};

function randomTheme() {
  return THEMES[Math.floor(Math.random() * THEMES.length)];
}

function applyTheme(theme) {
  const selected = THEMES.includes(theme) ? theme : "purple";
  document.body.dataset.theme = selected;
  elements.themeColor.setAttribute("content", THEME_COLORS[selected]);
}

function getGameParameter() {
  const linkedGame = new URLSearchParams(window.location.hash.slice(1)).get("game");
  if (linkedGame) {
    try {
      sessionStorage.setItem(ACTIVE_GAME_KEY, linkedGame);
    } catch (error) {
      // The link still works when session storage is unavailable.
    }
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    return linkedGame;
  }
  try {
    return sessionStorage.getItem(ACTIVE_GAME_KEY);
  } catch (error) {
    return null;
  }
}

function startClarity(activeGameKey) {
  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") return;
  (function(c, l, a, r, i, t, y) {
    c[a] = c[a] || function clarityQueue() { (c[a].q = c[a].q || []).push(arguments); };
    t = l.createElement(r);
    t.async = 1;
    t.src = `https://www.clarity.ms/tag/${i}`;
    y = l.getElementsByTagName(r)[0];
    y.parentNode.insertBefore(t, y);
  })(window, document, "clarity", "script", CLARITY_PROJECT_ID);
  window.clarity("set", "page_type", "mobile_game");
  window.clarity("set", "game_id", activeGameKey);
  window.clarity("event", "game_opened");
}

function base64UrlToBytes(value) {
  let base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) base64 += "=";
  const binary = atob(base64);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function decodeGame(encoded) {
  const separator = encoded.indexOf(".");
  if (separator < 1) throw new Error("Invalid game format");
  const format = encoded.slice(0, separator);
  const bytes = base64UrlToBytes(encoded.slice(separator + 1));
  let jsonBytes = bytes;
  if (format === "z") {
    if (typeof DecompressionStream !== "function") throw new Error("This browser cannot open compressed game links");
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    jsonBytes = new Uint8Array(await new Response(stream).arrayBuffer());
  } else if (format !== "j") {
    throw new Error("Unknown game format");
  }
  return JSON.parse(new TextDecoder().decode(jsonBytes));
}

function hashString(value) {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) hash = (hash * 33) ^ value.charCodeAt(index);
  return (hash >>> 0).toString(16);
}

function shuffle(values) {
  const result = values.slice();
  for (let index = result.length - 1; index > 0; index -= 1) {
    const random = Math.floor(Math.random() * (index + 1));
    [result[index], result[random]] = [result[random], result[index]];
  }
  return result;
}

function randomId(bytes = 12) {
  const values = new Uint8Array(bytes);
  crypto.getRandomValues(values);
  return Array.from(values, (value) => value.toString(16).padStart(2, "0")).join("");
}

function buildBoard(previous = {}) {
  const choices = shuffle(gameData.phrases).slice(0, 24);
  const cells = [];
  let phraseIndex = 0;
  for (let index = 0; index < 25; index += 1) {
    if (index === 12) cells.push({ type: "free", prompt: "FREE", marked: true, guest: "" });
    else cells.push({ type: "phrase", prompt: choices[phraseIndex++], marked: false, guest: "" });
  }
  return {
    cells,
    celebratedLines: [],
    theme: randomTheme(),
    playerId: previous.playerId || randomId(),
    startedAt: previous.startedAt || Date.now(),
    boardId: randomId(8),
    boardNumber: previous.boardNumber || 1,
    history: Array.isArray(previous.history) ? previous.history.slice(-11) : [],
  };
}

function getStorageKey() {
  return `make_bingo_${gameKey}`;
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(getStorageKey()));
    return saved?.cells?.length === 25 ? saved : null;
  } catch (error) {
    return null;
  }
}

function saveState() {
  localStorage.setItem(getStorageKey(), JSON.stringify(state));
}

function boardSnapshot(source = state) {
  return {
    id: source.boardId,
    number: source.boardNumber,
    theme: source.theme,
    hadBingo: Array.isArray(source.celebratedLines) && source.celebratedLines.length > 0,
    entries: source.cells
      .map((cell, position) => ({ position, prompt: cell.prompt, name: cell.guest }))
      .filter((entry) => entry.prompt && entry.name),
  };
}

function progressPayload() {
  return {
    gameId: gameData.collection.gameId,
    writeKey: gameData.collection.writeKey,
    playerId: state.playerId,
    startedAt: state.startedAt,
    boards: [...state.history, boardSnapshot()],
  };
}

async function syncProgress() {
  if (!gameData?.collection?.gameId || !gameData?.collection?.writeKey || !state) return;
  if (syncInFlight) {
    syncAgain = true;
    return;
  }
  syncInFlight = true;
  try {
    const response = await fetch("/api/save-progress", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(progressPayload()),
      keepalive: true,
    });
    if (!response.ok) {
      const error = new Error("Progress sync failed");
      error.retry = response.status >= 500 || response.status === 429;
      throw error;
    }
  } catch (error) {
    syncAgain = error.retry !== false;
  } finally {
    syncInFlight = false;
    if (syncAgain) {
      syncAgain = false;
      clearTimeout(syncTimer);
      syncTimer = setTimeout(syncProgress, 4000);
    }
  }
}

function queueProgressSync(delay = 350) {
  if (!gameData?.collection) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(syncProgress, delay);
}

function renderBoard() {
  elements.grid.replaceChildren();
  state.cells.forEach((cell, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `card-cell${cell.type === "free" ? " free" : ""}${cell.marked && cell.type !== "free" ? " marked" : ""}`;
    if (cell.type === "free") {
      const emoji = document.createElement("span");
      emoji.className = "free-emoji";
      emoji.textContent = gameData.emoji || "✨";
      button.appendChild(emoji);
      button.setAttribute("aria-label", "Free space, marked");
      button.disabled = true;
    } else {
      const prompt = document.createElement("span");
      prompt.className = "prompt-text";
      prompt.textContent = cell.prompt;
      button.appendChild(prompt);
      if (cell.guest) {
        const guest = document.createElement("span");
        guest.className = "guest-name";
        guest.textContent = cell.guest;
        button.appendChild(guest);
      }
      button.setAttribute("aria-label", `${cell.prompt}${cell.guest ? `, marked with ${cell.guest}. Tap to edit.` : ". Tap to add a name."}`);
      button.addEventListener("click", () => openEntry(index, button));
    }
    elements.grid.appendChild(button);
  });
}

function openEntry(index, button) {
  activeCellIndex = index;
  lastFocusedCell = button;
  const cell = state.cells[index];
  elements.modalPrompt.textContent = cell.prompt;
  elements.guestName.value = cell.guest || "";
  elements.entryModal.classList.add("active");
  elements.entryModal.setAttribute("aria-hidden", "false");
  requestAnimationFrame(() => {
    elements.guestName.focus();
    elements.guestName.select();
  });
}

function closeEntry() {
  elements.entryModal.classList.remove("active");
  elements.entryModal.setAttribute("aria-hidden", "true");
  activeCellIndex = null;
  lastFocusedCell?.focus();
}

function saveEntry() {
  if (activeCellIndex === null) return;
  const name = elements.guestName.value.trim();
  if (!name) {
    elements.guestName.focus();
    return;
  }
  state.cells[activeCellIndex].guest = name;
  state.cells[activeCellIndex].marked = true;
  saveState();
  renderBoard();
  closeEntry();
  checkForBingo();
  queueProgressSync();
}

function winningLines() {
  const lines = [];
  for (let row = 0; row < 5; row += 1) lines.push([0, 1, 2, 3, 4].map((column) => row * 5 + column));
  for (let column = 0; column < 5; column += 1) lines.push([0, 1, 2, 3, 4].map((row) => row * 5 + column));
  lines.push([0, 6, 12, 18, 24], [4, 8, 12, 16, 20]);
  return lines;
}

function checkForBingo() {
  const newWin = winningLines().find((line) => {
    const signature = line.join("-");
    return line.every((index) => state.cells[index].marked) && !state.celebratedLines.includes(signature);
  });
  if (!newWin) return;
  state.celebratedLines.push(newWin.join("-"));
  saveState();
  window.clarity?.("event", "bingo_completed");
  renderWinDigest();
  elements.winModal.classList.add("active");
  elements.winModal.setAttribute("aria-hidden", "false");
  elements.closeWin.focus();
}

function renderWinDigest() {
  elements.winDigest.replaceChildren();
  state.cells
    .filter((cell) => cell.type === "phrase" && cell.marked && cell.guest)
    .forEach((cell) => {
      const line = document.createElement("p");
      line.textContent = `${cell.prompt}: ${cell.guest}`;
      elements.winDigest.appendChild(line);
    });
}

function closeWin() {
  elements.winModal.classList.remove("active");
  elements.winModal.setAttribute("aria-hidden", "true");
}

function showError(message) {
  elements.loading.hidden = true;
  elements.game.hidden = true;
  elements.errorMessage.textContent = message;
  elements.errorState.hidden = false;
}

async function initialize() {
  const gameParameter = getGameParameter();
  if (!gameParameter) {
    showError("This link is missing its game information. Ask the organizer for a new link.");
    return;
  }
  try {
    gameData = await decodeGame(gameParameter);
    if (!Array.isArray(gameData.phrases) || gameData.phrases.length < 30) throw new Error("Not enough items");
    if (gameData.expiresAt && Date.now() > gameData.expiresAt) {
      showError("This game expired after 30 days. Ask the organizer to create a fresh link.");
      return;
    }
    gameKey = hashString(gameParameter);
    startClarity(gameKey);
    state = loadState() || buildBoard();
    if (!Array.isArray(state.celebratedLines)) state.celebratedLines = [];
    if (!THEMES.includes(state.theme)) state.theme = randomTheme();
    if (!state.playerId) state.playerId = randomId();
    if (!state.startedAt) state.startedAt = Date.now();
    if (!state.boardId) state.boardId = randomId(8);
    if (!state.boardNumber) state.boardNumber = 1;
    if (!Array.isArray(state.history)) state.history = [];
    applyTheme(state.theme);
    window.clarity?.("set", "card_theme", state.theme);
    saveState();
    document.title = `${gameData.title} · Bingo`;
    elements.gameTitle.textContent = gameData.title;
    elements.rules.textContent = gameData.subtitle || "Find someone who matches each square and add their name.";
    elements.winEmoji.textContent = gameData.winEmoji || "🎉";
    elements.winTitle.textContent = gameData.winTitle || "Bingo!";
    elements.winMessage.textContent = gameData.winMessage || "You completed a row. Nicely done.";
    elements.closeWin.textContent = gameData.winButton || "Keep playing";
    elements.loading.hidden = true;
    elements.game.hidden = false;
    renderBoard();
    checkForBingo();
    queueProgressSync(100);
  } catch (error) {
    showError("This game link is invalid or cannot be opened in this browser.");
  }
}

elements.reset.addEventListener("click", () => {
  if (!window.confirm("Create a new randomized board? Your current names will be cleared.")) return;
  const history = [...state.history, boardSnapshot()].slice(-11);
  state = buildBoard({
    playerId: state.playerId,
    startedAt: state.startedAt,
    boardNumber: state.boardNumber + 1,
    history,
  });
  applyTheme(state.theme);
  saveState();
  renderBoard();
  queueProgressSync();
  window.clarity?.("event", "new_board");
});
elements.cancelEntry.addEventListener("click", closeEntry);
elements.saveEntry.addEventListener("click", saveEntry);
elements.guestName.addEventListener("keydown", (event) => {
  if (event.key === "Enter") saveEntry();
});
elements.entryModal.addEventListener("click", (event) => {
  if (event.target === elements.entryModal) closeEntry();
});
elements.closeWin.addEventListener("click", closeWin);
elements.winModal.addEventListener("click", (event) => {
  if (event.target === elements.winModal) closeWin();
});
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (elements.winModal.classList.contains("active")) closeWin();
  else if (elements.entryModal.classList.contains("active")) closeEntry();
});
window.addEventListener("online", () => queueProgressSync(50));
window.addEventListener("pagehide", () => {
  clearTimeout(syncTimer);
  syncProgress();
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") queueProgressSync(0);
});

initialize();
