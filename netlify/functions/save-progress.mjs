import {
  gameExpiresAt,
  cleanText,
  getBingoStore,
  json,
  readBody,
  tokenMatches,
  validIdentifier,
} from "../lib/shared.mjs";

const THEMES = new Set(["black", "red", "green", "blue", "yellow", "purple"]);

function cleanBoard(board, index) {
  if (!board || typeof board !== "object") return null;
  const boardId = validIdentifier(board.id, 6, 64) ? board.id : `board_${index + 1}`;
  const entries = Array.isArray(board.entries)
    ? board.entries.slice(0, 24).map((entry) => ({
      position: Math.max(0, Math.min(24, Number(entry?.position) || 0)),
      prompt: cleanText(entry?.prompt, 240),
      name: cleanText(entry?.name, 80),
    })).filter((entry) => entry.prompt && entry.name)
    : [];

  return {
    id: boardId,
    number: Math.max(1, Math.min(99, Number(board.number) || index + 1)),
    theme: THEMES.has(board.theme) ? board.theme : "purple",
    hadBingo: Boolean(board.hadBingo),
    entries,
  };
}

export default async function saveProgress(request) {
  if (request.method !== "POST" && request.method !== "PUT") {
    return json({ error: "Method not allowed" }, 405);
  }

  const body = await readBody(request);
  if (!validIdentifier(body?.gameId) || !validIdentifier(body?.playerId)) {
    return json({ error: "Invalid game or player ID." }, 400);
  }

  const store = getBingoStore();
  const game = await store.get(`games/${body.gameId}.json`, { type: "json", consistency: "strong" });
  if (!game) return json({ error: "Game not found." }, 404);
  if (Date.now() > gameExpiresAt(game)) return json({ error: "This game has expired." }, 410);
  if (!tokenMatches(body.writeKey, game.writeKeyHash)) return json({ error: "Invalid game key." }, 403);

  const boards = Array.isArray(body.boards)
    ? body.boards.slice(-12).map(cleanBoard).filter(Boolean)
    : [];
  if (!boards.length) return json({ error: "No board data was supplied." }, 400);

  const now = Date.now();
  const record = {
    gameId: body.gameId,
    playerId: body.playerId,
    startedAt: Math.min(now, Math.max(game.createdAt, Number(body.startedAt) || now)),
    updatedAt: now,
    boards,
  };

  await store.setJSON(`players/${body.gameId}/${body.playerId}.json`, record, {
    metadata: { gameId: body.gameId, updatedAt: now },
  });
  return json({ saved: true, updatedAt: now });
}

export const config = { path: "/api/save-progress" };
