const elements = {
  title: document.getElementById("gameTitle"),
  updated: document.getElementById("lastUpdated"),
  refresh: document.getElementById("refreshBtn"),
  download: document.getElementById("downloadBtn"),
  error: document.getElementById("errorState"),
  dashboard: document.getElementById("dashboard"),
  playerCount: document.getElementById("playerCount"),
  entryCount: document.getElementById("entryCount"),
  bingoCount: document.getElementById("bingoCount"),
  boardCount: document.getElementById("boardCount"),
  squareRanking: document.getElementById("squareRanking"),
  nameRanking: document.getElementById("nameRanking"),
  playerList: document.getElementById("playerList"),
};

const ACCESS_KEY = "bingo_results_access_v1";
let access = null;
let latestData = null;

function readAccess() {
  const linked = new URLSearchParams(window.location.hash.slice(1));
  if (linked.get("game") && linked.get("key")) {
    const value = { game: linked.get("game"), key: linked.get("key") };
    try {
      sessionStorage.setItem(ACCESS_KEY, JSON.stringify(value));
    } catch (error) {
      // The open results page still works when session storage is unavailable.
    }
    window.history.replaceState(null, "", window.location.pathname);
    return value;
  }
  try {
    return JSON.parse(sessionStorage.getItem(ACCESS_KEY));
  } catch (error) {
    return null;
  }
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
      details.id = `name-squares-${index}`;
      details.hidden = true;
      total.setAttribute("aria-controls", details.id);

      const heading = document.createElement("strong");
      heading.textContent = `Squares assigned to ${display}`;
      const list = document.createElement("ul");
      const matchingEntries = entryDetails.filter((entry) => (
        String(entry.name || "").trim().toLocaleLowerCase() === display.toLocaleLowerCase()
      ));
      countValues(matchingEntries, "prompt").forEach(({ display: prompt, count: promptCount }) => {
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
    const bingos = boards.filter((board) => board.hadBingo).length;
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
    activity.textContent = new Date(player.updatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
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

function render(data) {
  latestData = data;
  const players = Array.isArray(data.players) ? data.players : [];
  const boards = players.flatMap(allBoards);
  const entries = players.flatMap(allEntries);
  elements.title.textContent = `${data.game.title} Results`;
  document.title = `${data.game.title} Results`;
  elements.updated.textContent = `Updated ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" })}`;
  elements.playerCount.textContent = players.length;
  elements.entryCount.textContent = entries.length;
  elements.bingoCount.textContent = players.filter((player) => allBoards(player).some((board) => board.hadBingo)).length;
  elements.boardCount.textContent = boards.length;
  renderRanking(elements.squareRanking, countValues(entries, "prompt"), "No squares have been selected yet.");
  renderRanking(elements.nameRanking, countValues(entries, "name"), "No names have been entered yet.", entries);
  renderPlayers(players);
  elements.error.hidden = true;
  elements.dashboard.hidden = false;
  elements.download.disabled = !entries.length;
}

async function loadResults() {
  if (!access?.game || !access?.key) {
    elements.error.textContent = "This private results link is incomplete. Return to the creator page and open the results link again.";
    elements.error.hidden = false;
    return;
  }
  elements.refresh.disabled = true;
  try {
    const params = new URLSearchParams({ game: access.game, key: access.key });
    const response = await fetch(`/api/results?${params}`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Results could not be loaded.");
    render(data);
  } catch (error) {
    elements.error.textContent = error.message;
    elements.error.hidden = false;
  } finally {
    elements.refresh.disabled = false;
  }
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

access = readAccess();
elements.refresh.addEventListener("click", loadResults);
elements.download.addEventListener("click", downloadCsv);
loadResults();
setInterval(loadResults, 15_000);
