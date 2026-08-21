const elements = {
  title: document.getElementById("pageTitle"),
  subtitle: document.getElementById("pageSubtitle"),
  loginPanel: document.getElementById("loginPanel"),
  loginForm: document.getElementById("loginForm"),
  password: document.getElementById("adminPassword"),
  logout: document.getElementById("logoutBtn"),
  refresh: document.getElementById("refreshBtn"),
  error: document.getElementById("errorState"),
  catalog: document.getElementById("catalog"),
  gameRows: document.getElementById("gameRows"),
  emptyCatalog: document.getElementById("emptyCatalog"),
  gameCount: document.getElementById("gameCount"),
  totalPlayers: document.getElementById("totalPlayers"),
  totalEntries: document.getElementById("totalEntries"),
  totalBingos: document.getElementById("totalBingos"),
  detail: document.getElementById("gameDetail"),
  back: document.getElementById("backBtn"),
  download: document.getElementById("downloadBtn"),
  playerCount: document.getElementById("playerCount"),
  entryCount: document.getElementById("entryCount"),
  bingoCount: document.getElementById("bingoCount"),
  boardCount: document.getElementById("boardCount"),
  squareRanking: document.getElementById("squareRanking"),
  nameRanking: document.getElementById("nameRanking"),
  playerList: document.getElementById("playerList"),
  detailUpdated: document.getElementById("detailUpdated"),
};

let password = "";
let latestData = null;

function showError(message) {
  elements.error.textContent = message;
  elements.error.hidden = false;
}

function clearError() {
  elements.error.hidden = true;
  elements.error.textContent = "";
}

async function adminRequest(gameId = "") {
  const params = gameId ? `?${new URLSearchParams({ game: gameId })}` : "";
  const response = await fetch(`/api/admin-results${params}`, {
    cache: "no-store",
    headers: { Authorization: `Bearer ${encodeURIComponent(password)}` },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || "The dashboard could not be loaded.");
    error.status = response.status;
    throw error;
  }
  return data;
}

function allBoards(player) {
  return Array.isArray(player.boards) ? player.boards : [];
}

function allEntries(player) {
  return allBoards(player).flatMap((board) => board.entries || []);
}

function countValues(entries, property) {
  const counts = new Map();
  entries.forEach((entry) => {
    const display = String(entry[property] || "").trim();
    if (!display) return;
    const key = display.toLocaleLowerCase();
    const current = counts.get(key) || { display, count: 0 };
    current.count += 1;
    counts.set(key, current);
  });
  return [...counts.values()].sort((a, b) => b.count - a.count || a.display.localeCompare(b.display));
}

function renderRanking(container, values, emptyMessage, entryDetails = null) {
  container.replaceChildren();
  if (!values.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = emptyMessage;
    container.appendChild(empty);
    return;
  }
  values.slice(0, 15).forEach(({ display, count }, index) => {
    const row = document.createElement("div");
    row.className = "ranking-row";
    const label = document.createElement("span");
    label.className = "ranking-label";
    label.textContent = display;
    label.title = display;
    const total = entryDetails ? document.createElement("button") : document.createElement("span");
    total.className = "ranking-count";
    total.textContent = count;
    row.append(label, total);

    if (entryDetails) {
      total.type = "button";
      total.setAttribute("aria-expanded", "false");
      total.setAttribute("aria-label", `Show squares assigned to ${display}`);
      const details = document.createElement("div");
      details.className = "ranking-details";
      details.id = `admin-name-squares-${index}`;
      details.hidden = true;
      total.setAttribute("aria-controls", details.id);
      const heading = document.createElement("strong");
      heading.textContent = `Squares assigned to ${display}`;
      const list = document.createElement("ul");
      const matches = entryDetails.filter((entry) => (
        String(entry.name || "").trim().toLocaleLowerCase() === display.toLocaleLowerCase()
      ));
      countValues(matches, "prompt").forEach(({ display: prompt, count: promptCount }) => {
        const item = document.createElement("li");
        item.textContent = `${prompt}${promptCount > 1 ? ` (${promptCount})` : ""}`;
        list.appendChild(item);
      });
      details.append(heading, list);
      row.appendChild(details);
      total.addEventListener("click", () => {
        const willOpen = details.hidden;
        details.hidden = !willOpen;
        total.setAttribute("aria-expanded", String(willOpen));
      });
    }
    container.appendChild(row);
  });
}

function renderPlayers(players) {
  elements.playerList.replaceChildren();
  if (!players.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "No player activity yet.";
    elements.playerList.appendChild(empty);
    return;
  }
  players.forEach((player, index) => {
    const boards = allBoards(player);
    const entries = allEntries(player);
    const details = document.createElement("details");
    details.className = "player";
    const summary = document.createElement("summary");
    const label = document.createElement("strong");
    label.textContent = `Player ${index + 1} · ${player.playerId.slice(0, 8)}`;
    const names = document.createElement("span");
    names.textContent = `${entries.length} name${entries.length === 1 ? "" : "s"}`;
    const boardTotal = document.createElement("span");
    boardTotal.textContent = `${boards.length} board${boards.length === 1 ? "" : "s"}`;
    const activity = document.createElement("span");
    activity.textContent = new Date(player.updatedAt).toLocaleString();
    summary.append(label, names, boardTotal, activity);
    const boardWrap = document.createElement("div");
    boardWrap.className = "player-boards";
    boards.forEach((board) => {
      const section = document.createElement("section");
      section.className = "board";
      const heading = document.createElement("h3");
      heading.textContent = `Board ${board.number}${board.hadBingo ? " · Bingo" : ""} · ${board.theme}`;
      const list = document.createElement("ul");
      (board.entries || []).forEach((entry) => {
        const item = document.createElement("li");
        item.textContent = `${entry.prompt}: ${entry.name}`;
        list.appendChild(item);
      });
      if (!list.children.length) {
        const item = document.createElement("li");
        item.textContent = "No names entered yet.";
        list.appendChild(item);
      }
      section.append(heading, list);
      boardWrap.appendChild(section);
    });
    details.append(summary, boardWrap);
    elements.playerList.appendChild(details);
  });
}

function formatDate(timestamp) {
  return timestamp ? new Date(timestamp).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "—";
}

function renderCatalog(games) {
  latestData = null;
  elements.title.textContent = "Organizer Dashboard";
  elements.subtitle.textContent = "All mobile game instances in one place.";
  document.title = "Bingo Name-o Admin";
  elements.gameCount.textContent = games.length;
  elements.totalPlayers.textContent = games.reduce((total, game) => total + game.playerCount, 0);
  elements.totalEntries.textContent = games.reduce((total, game) => total + game.entryCount, 0);
  elements.totalBingos.textContent = games.reduce((total, game) => total + game.bingoCount, 0);
  elements.gameRows.replaceChildren();
  games.forEach((game) => {
    const row = document.createElement("tr");
    const titleCell = document.createElement("td");
    titleCell.className = "game-title-cell";
    const title = document.createElement("strong");
    title.textContent = game.title;
    const expiration = document.createElement("span");
    expiration.textContent = `${Date.now() > game.expiresAt ? "Expired" : "Expires"} ${formatDate(game.expiresAt)}`;
    titleCell.append(title, expiration);
    [formatDate(game.createdAt), game.playerCount, game.entryCount, game.bingoCount, formatDate(game.lastActivityAt)].forEach((value) => {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.appendChild(cell);
    });
    const actionCell = document.createElement("td");
    const view = document.createElement("button");
    view.className = "button secondary";
    view.type = "button";
    view.textContent = "View Results";
    view.addEventListener("click", () => openGame(game.id));
    actionCell.appendChild(view);
    row.prepend(titleCell);
    row.appendChild(actionCell);
    elements.gameRows.appendChild(row);
  });
  elements.emptyCatalog.hidden = Boolean(games.length);
  elements.detail.hidden = true;
  elements.catalog.hidden = false;
}

function renderGame(data) {
  latestData = data;
  const players = Array.isArray(data.players) ? data.players : [];
  const boards = players.flatMap(allBoards);
  const entries = players.flatMap(allEntries);
  elements.title.textContent = data.game.title;
  elements.subtitle.textContent = `Created ${formatDate(data.game.createdAt)} · Expires ${formatDate(data.game.expiresAt)}`;
  document.title = `${data.game.title} · Admin Results`;
  elements.playerCount.textContent = players.length;
  elements.entryCount.textContent = entries.length;
  elements.bingoCount.textContent = players.filter((player) => allBoards(player).some((board) => board.hadBingo)).length;
  elements.boardCount.textContent = boards.length;
  elements.detailUpdated.textContent = `Updated ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" })}`;
  renderRanking(elements.squareRanking, countValues(entries, "prompt"), "No squares have been selected yet.");
  renderRanking(elements.nameRanking, countValues(entries, "name"), "No names have been entered yet.", entries);
  renderPlayers(players);
  elements.download.disabled = !entries.length;
  elements.catalog.hidden = true;
  elements.detail.hidden = false;
}

async function loadCurrentView() {
  clearError();
  elements.refresh.disabled = true;
  try {
    const gameId = new URLSearchParams(window.location.search).get("game") || "";
    const data = await adminRequest(gameId);
    if (gameId) renderGame(data);
    else renderCatalog(Array.isArray(data.games) ? data.games : []);
    elements.loginPanel.hidden = true;
    elements.logout.hidden = false;
    elements.refresh.hidden = false;
  } catch (error) {
    if (error.status === 401) {
      password = "";
      elements.loginPanel.hidden = false;
      elements.logout.hidden = true;
      elements.refresh.hidden = true;
      elements.catalog.hidden = true;
      elements.detail.hidden = true;
      showError("That password did not work. Please try again.");
      elements.password.focus();
    } else {
      showError(error.message);
    }
  } finally {
    elements.refresh.disabled = false;
  }
}

function openGame(gameId) {
  const url = new URL(window.location.href);
  url.searchParams.set("game", gameId);
  window.history.pushState(null, "", url);
  loadCurrentView();
}

function openCatalog() {
  const url = new URL(window.location.href);
  url.searchParams.delete("game");
  window.history.pushState(null, "", url);
  loadCurrentView();
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadCsv() {
  if (!latestData) return;
  const rows = [["player_id", "board", "theme", "bingo", "square", "entered_name", "last_updated"]];
  latestData.players.forEach((player) => {
    allBoards(player).forEach((board) => {
      (board.entries || []).forEach((entry) => {
        rows.push([
          player.playerId,
          board.number,
          board.theme,
          board.hadBingo ? "yes" : "no",
          entry.prompt,
          entry.name,
          new Date(player.updatedAt).toISOString(),
        ]);
      });
    });
  });
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  link.download = `${latestData.game.title.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "bingo"}-results.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

elements.loginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  password = elements.password.value;
  loadCurrentView();
});
elements.logout.addEventListener("click", () => {
  password = "";
  elements.password.value = "";
  elements.loginPanel.hidden = false;
  elements.catalog.hidden = true;
  elements.detail.hidden = true;
  elements.logout.hidden = true;
  elements.refresh.hidden = true;
  clearError();
});
elements.refresh.addEventListener("click", loadCurrentView);
elements.back.addEventListener("click", openCatalog);
elements.download.addEventListener("click", downloadCsv);
window.addEventListener("popstate", () => password && loadCurrentView());
