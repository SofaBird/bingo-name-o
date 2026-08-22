const MINIMUM_ITEMS = 30;
const GAME_LIFETIME_MS = 90 * 24 * 60 * 60 * 1000;
const SAVED_LISTS_KEY = "make_bingo_saved_lists_v1";
const LATEST_MOBILE_GAME_KEY = "bingo_latest_mobile_game_v1";

const elements = {
  form: document.getElementById("bingoForm"),
  title: document.getElementById("cardTitle"),
  subtitle: document.getElementById("cardSubtitle"),
  emoji: document.getElementById("freeEmoji"),
  winEmoji: document.getElementById("winEmoji"),
  winTitle: document.getElementById("winTitle"),
  winMessage: document.getElementById("winMessage"),
  winButton: document.getElementById("winButton"),
  openWinEmoji: document.getElementById("openWinEmojiPicker"),
  cardCount: document.getElementById("cardCount"),
  listName: document.getElementById("listName"),
  saveList: document.getElementById("saveListBtn"),
  savedLists: document.getElementById("savedLists"),
  loadList: document.getElementById("loadListBtn"),
  listStatus: document.getElementById("listStatus"),
  csvFile: document.getElementById("csvFile"),
  fileName: document.getElementById("fileName"),
  items: document.getElementById("phrasesInput"),
  lineNumbers: document.getElementById("lineNumbers"),
  phraseCounter: document.getElementById("phraseCounter"),
  duplicateMessage: document.getElementById("duplicateMessage"),
  generatePrint: document.getElementById("generatePrintBtn"),
  print: document.getElementById("printBtn"),
  clearCards: document.getElementById("clearCardsBtn"),
  cards: document.getElementById("cards"),
  preview: document.getElementById("previewSection"),
  createMobile: document.getElementById("createMobileBtn"),
  mobileInteractions: document.querySelectorAll('input[name="mobileInteraction"]'),
  mobileResult: document.getElementById("mobileResult"),
  mobileLink: document.getElementById("mobileLink"),
  copyLink: document.getElementById("copyLinkBtn"),
  openGame: document.getElementById("openGameBtn"),
  status: document.getElementById("status"),
  emojiModal: document.getElementById("emojiModal"),
  openEmoji: document.getElementById("openEmojiPicker"),
  closeEmoji: document.getElementById("closeEmojiPicker"),
  emojiSearch: document.getElementById("emojiSearch"),
  emojiGrid: document.getElementById("emojiGrid"),
  emojiCount: document.getElementById("emojiCount"),
};

const EMOJIS = [
  ["✨", "sparkles star"], ["⭐", "star"], ["🌟", "glowing star"], ["🎉", "party celebration"],
  ["🎊", "confetti party"], ["🎈", "balloon party"], ["🎯", "target"], ["🏆", "trophy winner"],
  ["💜", "purple heart"], ["❤️", "red heart love"], ["🧡", "orange heart"], ["💛", "yellow heart"],
  ["💚", "green heart"], ["💙", "blue heart"], ["🩷", "pink heart"], ["🌈", "rainbow"],
  ["🌸", "flower blossom"], ["🌻", "sunflower"], ["🌿", "leaf plant"], ["🍀", "clover lucky"],
  ["☀️", "sun"], ["🌙", "moon"], ["⚡", "lightning energy"], ["🔥", "fire"],
  ["💫", "dizzy star"], ["🪩", "disco ball"], ["🎵", "music note"], ["🎸", "guitar music"],
  ["☕", "coffee"], ["🍕", "pizza"], ["🍰", "cake"], ["🧁", "cupcake"],
  ["🍓", "strawberry"], ["🍋", "lemon"], ["🥑", "avocado"], ["🌮", "taco"],
  ["🐶", "dog"], ["🐱", "cat"], ["🦄", "unicorn"], ["🦋", "butterfly"],
  ["🐝", "bee"], ["🐙", "octopus"], ["🦖", "dinosaur"], ["🐸", "frog"],
  ["😊", "smile happy"], ["😎", "cool sunglasses"], ["🤩", "star eyes"], ["🥳", "party face"],
  ["🙌", "hands celebrate"], ["👏", "clap"], ["💡", "idea light bulb"], ["🚀", "rocket"],
  ["✈️", "airplane travel"], ["🏖️", "beach"], ["🏕️", "camping"], ["🏠", "house home"],
  ["🎓", "graduation"], ["💍", "ring wedding"], ["🎁", "gift present"], ["👑", "crown"],
];

let lastFocusedElement = null;
let emojiTarget = elements.emoji;

function getMobileInteraction() {
  return [...elements.mobileInteractions].find((input) => input.checked)?.value === "mark" ? "mark" : "name";
}

function setMobileInteraction(value) {
  const selected = value === "mark" ? "mark" : "name";
  elements.mobileInteractions.forEach((input) => { input.checked = input.value === selected; });
}

function setStatus(message, isError = false) {
  elements.status.textContent = message;
  elements.status.classList.toggle("error", isError);
}

function setListStatus(message, isError = false) {
  elements.listStatus.textContent = message;
  elements.listStatus.classList.toggle("error", isError);
}

function readSavedLists() {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVED_LISTS_KEY));
    return saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
  } catch (error) {
    return {};
  }
}

function renderSavedLists(selectedName = "") {
  const names = Object.keys(readSavedLists()).sort((a, b) => a.localeCompare(b));
  elements.savedLists.replaceChildren();
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = names.length ? "Choose a saved list" : "No saved lists";
  elements.savedLists.appendChild(placeholder);
  names.forEach((name) => {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    elements.savedLists.appendChild(option);
  });
  elements.savedLists.value = names.includes(selectedName) ? selectedName : "";
}

function saveCurrentList() {
  const name = elements.listName.value.trim();
  if (!name) {
    setListStatus("Enter a name before saving the list.", true);
    elements.listName.focus();
    return;
  }
  const lists = readSavedLists();
  const existed = Boolean(lists[name]);
  lists[name] = {
    title: elements.title.value,
    subtitle: elements.subtitle.value,
    emoji: elements.emoji.value,
    winEmoji: elements.winEmoji.value,
    winTitle: elements.winTitle.value,
    winMessage: elements.winMessage.value,
    winButton: elements.winButton.value,
    items: elements.items.value,
    cardCount: elements.cardCount.value,
    mobileInteraction: getMobileInteraction(),
    savedAt: Date.now(),
  };
  try {
    localStorage.setItem(SAVED_LISTS_KEY, JSON.stringify(lists));
    renderSavedLists(name);
    setListStatus(`${existed ? "Updated" : "Saved"} “${name}” in this browser.`);
  } catch (error) {
    setListStatus("This browser could not save the list.", true);
  }
}

function loadSelectedList() {
  const name = elements.savedLists.value;
  const saved = readSavedLists()[name];
  if (!name || !saved) {
    setListStatus("Choose a saved list to load.", true);
    return;
  }
  elements.title.value = saved.title || "Bingo";
  elements.subtitle.value = saved.subtitle || "";
  elements.emoji.value = saved.emoji || "✨";
  elements.winEmoji.value = saved.winEmoji || "🎉";
  elements.winTitle.value = saved.winTitle || "Bingo!";
  elements.winMessage.value = saved.winMessage || "You completed a row. Nicely done.";
  elements.winButton.value = saved.winButton || "Keep playing";
  elements.items.value = saved.items || "";
  elements.cardCount.value = saved.cardCount || "4";
  setMobileInteraction(saved.mobileInteraction);
  elements.listName.value = name;
  elements.csvFile.value = "";
  elements.fileName.textContent = "No file selected";
  updateItemSummary();
  setListStatus(`Loaded “${name}”.`);
}

function normalizeItem(value) {
  return value.trim().replace(/\s+/g, " ");
}

function getItemSummary() {
  const seen = new Set();
  const unique = [];
  let duplicates = 0;

  elements.items.value.split(/\r?\n/).forEach((line) => {
    const item = normalizeItem(line);
    if (!item) return;
    const key = item.toLocaleLowerCase();
    if (seen.has(key)) {
      duplicates += 1;
      return;
    }
    seen.add(key);
    unique.push(item);
  });

  return { unique, duplicates };
}

function updateItemSummary() {
  const { unique, duplicates } = getItemSummary();
  updateLineNumbers();
  const ready = unique.length >= MINIMUM_ITEMS;
  elements.phraseCounter.textContent = `${unique.length} of ${MINIMUM_ITEMS} unique items`;
  elements.phraseCounter.classList.toggle("ready", ready);
  elements.duplicateMessage.textContent = duplicates
    ? `${duplicates} duplicate${duplicates === 1 ? "" : "s"} will be ignored.`
    : "";
  elements.mobileResult.hidden = true;
  return { unique, duplicates, ready };
}

function updateLineNumbers() {
  const lineCount = Math.max(MINIMUM_ITEMS, elements.items.value.split(/\r?\n/).length);
  elements.lineNumbers.textContent = Array.from({ length: lineCount }, (_, index) => index + 1).join("\n");
}

function syncLineNumberScroll() {
  elements.lineNumbers.scrollTop = elements.items.scrollTop;
}

function validateGame() {
  const summary = updateItemSummary();
  if (!elements.title.value.trim()) {
    setStatus("Add a title for your bingo game.", true);
    elements.title.focus();
    return null;
  }
  if (!summary.ready) {
    const needed = MINIMUM_ITEMS - summary.unique.length;
    setStatus(`Add ${needed} more unique item${needed === 1 ? "" : "s"} to continue.`, true);
    elements.items.focus();
    return null;
  }
  return {
    title: elements.title.value.trim(),
    subtitle: elements.subtitle.value.trim(),
    emoji: elements.emoji.value.trim() || "✨",
    winEmoji: elements.winEmoji.value.trim() || "🎉",
    winTitle: elements.winTitle.value.trim() || "Bingo!",
    winMessage: elements.winMessage.value.trim() || "You completed a row. Nicely done.",
    winButton: elements.winButton.value.trim() || "Keep playing",
    phrases: summary.unique,
    interactionMode: getMobileInteraction(),
  };
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];
    if (quoted) {
      if (character === '"' && next === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        cell += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(cell);
      cell = "";
    } else if (character === "\n") {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }
  if (cell.length || row.length) {
    row.push(cell.replace(/\r$/, ""));
    rows.push(row);
  }

  const headers = (rows[0] || []).map((value) => normalizeItem(value).toLowerCase());
  const knownHeaders = ["item", "items", "phrase", "phrases", "prompt", "prompts", "square", "squares"];
  const headerIndex = headers.findIndex((value) => knownHeaders.includes(value));
  const dataRows = headerIndex >= 0 ? rows.slice(1) : rows;
  const columnIndex = headerIndex >= 0 ? headerIndex : 0;

  return dataRows
    .map((values) => normalizeItem(values[columnIndex] || ""))
    .filter(Boolean);
}

async function importCsv(file) {
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) {
    setStatus("Choose a CSV smaller than 2 MB.", true);
    elements.csvFile.value = "";
    return;
  }
  try {
    const items = parseCsv(await file.text());
    if (!items.length) throw new Error("No items found");
    elements.items.value = items.join("\n");
    elements.fileName.textContent = file.name;
    const { unique, duplicates } = updateItemSummary();
    setStatus(`Loaded ${unique.length} unique items from ${file.name}${duplicates ? `; ${duplicates} duplicates were found` : ""}.`);
  } catch (error) {
    setStatus("We couldn’t find a usable first column in that CSV.", true);
    elements.csvFile.value = "";
  }
}

function shuffle(values) {
  const result = values.slice();
  for (let index = result.length - 1; index > 0; index -= 1) {
    const random = Math.floor(Math.random() * (index + 1));
    [result[index], result[random]] = [result[random], result[index]];
  }
  return result;
}

function createGrid(phrases) {
  const choices = shuffle(phrases).slice(0, 24);
  const cells = [];
  let phraseIndex = 0;
  for (let index = 0; index < 25; index += 1) {
    if (index === 12) cells.push({ type: "free" });
    else cells.push({ type: "phrase", value: choices[phraseIndex++] });
  }
  return cells;
}

function renderCard(game, grid) {
  const card = document.createElement("article");
  card.className = "bingo-card";
  const heading = document.createElement("h3");
  heading.className = "card-title";
  heading.textContent = game.title;
  const subtitle = document.createElement("p");
  subtitle.className = "card-subtitle";
  subtitle.textContent = game.subtitle;
  const board = document.createElement("div");
  board.className = "bingo-grid";

  "BINGO".split("").forEach((letter) => {
    const cell = document.createElement("div");
    cell.className = "bingo-cell header";
    cell.textContent = letter;
    board.appendChild(cell);
  });

  grid.forEach((item) => {
    const cell = document.createElement("div");
    cell.className = `bingo-cell${item.type === "free" ? " free" : ""}`;
    if (item.type === "free") {
      const emoji = document.createElement("span");
      emoji.className = "free-emoji";
      emoji.textContent = game.emoji;
      const label = document.createElement("span");
      label.className = "free-text";
      label.textContent = "FREE";
      cell.append(emoji, label);
    } else {
      cell.textContent = item.value;
    }
    board.appendChild(cell);
  });

  card.append(heading, subtitle, board);
  return card;
}

function generatePrintCards() {
  const game = validateGame();
  if (!game) return;
  const count = Math.max(1, Math.min(200, Number(elements.cardCount.value) || 4));
  elements.cardCount.value = count;
  elements.cards.replaceChildren();
  const signatures = new Set();
  let page = null;
  let attempts = 0;

  while (signatures.size < count && attempts < count * 50) {
    const grid = createGrid(game.phrases);
    const signature = grid.map((item) => item.value || "FREE").join("|");
    attempts += 1;
    if (signatures.has(signature)) continue;
    signatures.add(signature);
    if (!page || page.children.length === 4) {
      page = document.createElement("div");
      page.className = "print-page";
      elements.cards.appendChild(page);
    }
    page.appendChild(renderCard(game, grid));
  }

  elements.preview.hidden = false;
  elements.preview.scrollIntoView({ behavior: "smooth", block: "start" });
  setStatus(`Created ${signatures.size} unique printable card${signatures.size === 1 ? "" : "s"}.`);
}

function bytesToBase64Url(bytes) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function encodeGame(game) {
  const jsonBytes = new TextEncoder().encode(JSON.stringify(game));
  if (typeof CompressionStream === "function") {
    const stream = new Blob([jsonBytes]).stream().pipeThrough(new CompressionStream("deflate-raw"));
    const compressed = new Uint8Array(await new Response(stream).arrayBuffer());
    return `z.${bytesToBase64Url(compressed)}`;
  }
  return `j.${bytesToBase64Url(jsonBytes)}`;
}

function getMobilePageUrl() {
  if (window.location.protocol === "file:") return new URL("https://bingo-game-o.netlify.app/mobile.html");
  return new URL("mobile.html", window.location.href);
}

function rememberMobileGame(gameUrl, expiresAt) {
  try {
    localStorage.setItem(LATEST_MOBILE_GAME_KEY, JSON.stringify({ gameUrl, expiresAt }));
  } catch (error) {
    // The generated links still work if local storage is unavailable.
  }
}

function restoreLatestMobileGame() {
  try {
    const saved = JSON.parse(localStorage.getItem(LATEST_MOBILE_GAME_KEY));
    if (!saved?.gameUrl || Date.now() > saved.expiresAt) return;
    elements.mobileLink.value = saved.gameUrl;
    elements.mobileResult.hidden = false;
    setStatus("Your most recent game link was restored.");
  } catch (error) {
    // Ignore unavailable or invalid local storage data.
  }
}

async function createMobileGame() {
  const game = validateGame();
  if (!game) return;
  elements.createMobile.disabled = true;
  setStatus("Creating your mobile game…");
  try {
    const createdAt = Date.now();
    const expiresAt = createdAt + GAME_LIFETIME_MS;
    const registrationResponse = await fetch("/api/create-game", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: game.title, expiresAt }),
    });
    const registration = await registrationResponse.json().catch(() => ({}));
    if (!registrationResponse.ok) {
      throw new Error(registration.error || "Player-data collection could not be created.");
    }
    const payload = {
      ...game,
      version: 2,
      createdAt,
      expiresAt,
      collection: {
        gameId: registration.gameId,
        writeKey: registration.writeKey,
      },
    };
    const encoded = await encodeGame(payload);
    const url = getMobilePageUrl();
    url.hash = `game=${encoded}`;
    const linkRegistrationResponse = await fetch("/api/save-game-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gameId: registration.gameId,
        writeKey: registration.writeKey,
        mobilePath: `${url.pathname}${url.search}${url.hash}`,
      }),
    });
    if (!linkRegistrationResponse.ok) {
      const linkError = await linkRegistrationResponse.json().catch(() => ({}));
      throw new Error(linkError.error || "The mobile link could not be added to the organizer dashboard.");
    }
    elements.mobileLink.value = url.toString();
    rememberMobileGame(elements.mobileLink.value, expiresAt);
    elements.mobileResult.hidden = false;
    setStatus("Game link created.");
  } catch (error) {
    const localHint = ["localhost", "127.0.0.1"].includes(window.location.hostname)
      ? " Open this project through Netlify Dev to test data collection locally."
      : "";
    setStatus(`${error.message || "The mobile game could not be created."}${localHint}`, true);
  } finally {
    elements.createMobile.disabled = false;
  }
}

async function copyMobileLink() {
  try {
    await navigator.clipboard.writeText(elements.mobileLink.value);
    setStatus("Mobile game link copied.");
  } catch (error) {
    elements.mobileLink.select();
    document.execCommand("copy");
    setStatus("Mobile game link copied.");
  }
}

async function copyTextField(field, successMessage) {
  try {
    await navigator.clipboard.writeText(field.value);
  } catch (error) {
    field.select();
    document.execCommand("copy");
  }
  setStatus(successMessage);
}

function renderEmojiGrid(search = "") {
  const term = search.trim().toLocaleLowerCase();
  const matches = EMOJIS.filter(([emoji, names]) => !term || emoji.includes(term) || names.includes(term));
  elements.emojiGrid.replaceChildren();
  matches.forEach(([emoji, names]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "emoji-item";
    button.textContent = emoji;
    button.setAttribute("aria-label", names);
    button.addEventListener("click", () => {
      emojiTarget.value = emoji;
      closeEmojiPicker();
    });
    elements.emojiGrid.appendChild(button);
  });
  elements.emojiCount.textContent = `${matches.length} emoji${matches.length === 1 ? "" : "s"}`;
}

function openEmojiPicker(target = elements.emoji) {
  emojiTarget = target;
  lastFocusedElement = document.activeElement;
  elements.emojiModal.classList.add("active");
  elements.emojiModal.setAttribute("aria-hidden", "false");
  elements.emojiSearch.value = "";
  renderEmojiGrid();
  elements.emojiSearch.focus();
}

function closeEmojiPicker() {
  elements.emojiModal.classList.remove("active");
  elements.emojiModal.setAttribute("aria-hidden", "true");
  lastFocusedElement?.focus();
}

elements.form.addEventListener("submit", (event) => event.preventDefault());
elements.saveList.addEventListener("click", saveCurrentList);
elements.loadList.addEventListener("click", loadSelectedList);
elements.items.addEventListener("input", updateItemSummary);
elements.items.addEventListener("scroll", syncLineNumberScroll);
elements.csvFile.addEventListener("change", () => importCsv(elements.csvFile.files[0]));
elements.generatePrint.addEventListener("click", generatePrintCards);
elements.print.addEventListener("click", () => {
  if (elements.preview.hidden || !elements.cards.children.length) {
    setStatus("Generate the print preview first.", true);
    return;
  }
  window.print();
});
elements.clearCards.addEventListener("click", () => {
  elements.cards.replaceChildren();
  elements.preview.hidden = true;
  setStatus("Print preview cleared.");
});
elements.createMobile.addEventListener("click", createMobileGame);
elements.mobileInteractions.forEach((input) => input.addEventListener("change", () => {
  elements.mobileResult.hidden = true;
  setStatus("");
}));
elements.copyLink.addEventListener("click", copyMobileLink);
elements.openGame.addEventListener("click", () => {
  if (!elements.mobileLink.value) return;
  window.open(elements.mobileLink.value, "_blank", "noopener");
});
elements.openEmoji.addEventListener("click", () => openEmojiPicker(elements.emoji));
elements.openWinEmoji.addEventListener("click", () => openEmojiPicker(elements.winEmoji));
elements.closeEmoji.addEventListener("click", closeEmojiPicker);
elements.emojiSearch.addEventListener("input", () => renderEmojiGrid(elements.emojiSearch.value));
elements.emojiModal.addEventListener("click", (event) => {
  if (event.target === elements.emojiModal) closeEmojiPicker();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && elements.emojiModal.classList.contains("active")) closeEmojiPicker();
});

updateItemSummary();
renderEmojiGrid();
renderSavedLists();
restoreLatestMobileGame();
