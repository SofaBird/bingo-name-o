import {
  gameExpiresAt,
  getBingoStore,
  json,
  tokenHex,
  tokenMatches,
  validIdentifier,
} from "../lib/shared.mjs";

function authorized(request) {
  const configuredPassword = process.env.BINGO_ADMIN_PASSWORD;
  const authorization = request.headers.get("authorization") || "";
  let suppliedPassword = "";
  try {
    suppliedPassword = authorization.startsWith("Bearer ")
      ? decodeURIComponent(authorization.slice(7))
      : "";
  } catch (error) {
    return false;
  }
  return Boolean(configuredPassword)
    && tokenMatches(suppliedPassword, tokenHex(configuredPassword));
}

async function listBlobs(store, prefix) {
  const blobs = [];
  for await (const page of store.list({ prefix, paginate: true })) {
    blobs.push(...page.blobs);
  }
  return blobs;
}

async function readRecords(store, blobs) {
  const records = [];
  for (let index = 0; index < blobs.length; index += 25) {
    const batch = blobs.slice(index, index + 25);
    const loaded = await Promise.all(batch.map(({ key }) => (
      store.get(key, { type: "json", consistency: "strong" }).catch(() => null)
    )));
    loaded.filter(Boolean).forEach((record) => records.push(record));
  }
  return records;
}

function boardsFor(player) {
  return Array.isArray(player?.boards) ? player.boards : [];
}

function summarize(game, players) {
  const boards = players.flatMap(boardsFor);
  return {
    id: game.id,
    title: game.title,
    createdAt: game.createdAt,
    expiresAt: gameExpiresAt(game),
    playerCount: players.length,
    entryCount: boards.reduce((total, board) => total + (Array.isArray(board.entries) ? board.entries.length : 0), 0),
    bingoCount: players.filter((player) => boardsFor(player).some((board) => board.hadBingo)).length,
    boardCount: boards.length,
    lastActivityAt: players.reduce((latest, player) => Math.max(latest, Number(player.updatedAt) || 0), 0),
  };
}

async function loadPlayers(store, gameId) {
  const blobs = await listBlobs(store, `players/${gameId}/`);
  const players = await readRecords(store, blobs);
  players.sort((a, b) => b.updatedAt - a.updatedAt);
  return players;
}

export default async function adminResults(request) {
  if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);
  if (!process.env.BINGO_ADMIN_PASSWORD) {
    return json({ error: "Admin access has not been configured." }, 503);
  }
  if (!authorized(request)) return json({ error: "Incorrect admin password." }, 401);

  const store = getBingoStore();
  const url = new URL(request.url);
  const requestedGameId = url.searchParams.get("game");

  if (requestedGameId) {
    if (!validIdentifier(requestedGameId)) return json({ error: "Invalid game ID." }, 400);
    const game = await store.get(`games/${requestedGameId}.json`, { type: "json", consistency: "strong" });
    if (!game) return json({ error: "Game not found." }, 404);
    const players = await loadPlayers(store, requestedGameId);
    return json({
      game: {
        id: game.id,
        title: game.title,
        createdAt: game.createdAt,
        expiresAt: gameExpiresAt(game),
      },
      players,
    });
  }

  const gameBlobs = await listBlobs(store, "games/");
  const games = await readRecords(store, gameBlobs);
  const summaries = [];
  for (const game of games) {
    const players = await loadPlayers(store, game.id);
    summaries.push(summarize(game, players));
  }
  summaries.sort((a, b) => b.createdAt - a.createdAt);

  return json({ games: summaries });
}

export const config = { path: "/api/admin-results" };
