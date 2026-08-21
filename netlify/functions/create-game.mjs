import {
  MAX_GAME_AGE_MS,
  cleanText,
  getBingoStore,
  json,
  randomToken,
  readBody,
  tokenHex,
} from "../lib/shared.mjs";

export default async function createGame(request) {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const body = await readBody(request);
  const title = cleanText(body?.title, 80);
  if (!title) return json({ error: "A game title is required." }, 400);

  const now = Date.now();
  const requestedExpiry = Number(body?.expiresAt);
  const expiresAt = Number.isFinite(requestedExpiry)
    ? Math.min(Math.max(requestedExpiry, now + 60_000), now + MAX_GAME_AGE_MS)
    : now + (30 * 24 * 60 * 60 * 1000);

  const gameId = randomToken(9);
  const writeKey = randomToken();
  const readKey = randomToken();
  const game = {
    id: gameId,
    title,
    createdAt: now,
    expiresAt,
    writeKeyHash: tokenHex(writeKey),
    readKeyHash: tokenHex(readKey),
    version: 1,
  };

  const store = getBingoStore();
  const result = await store.setJSON(`games/${gameId}.json`, game, { onlyIfNew: true });
  if (!result.modified) return json({ error: "Could not allocate a game ID. Please try again." }, 503);

  return json({ gameId, writeKey, readKey, expiresAt }, 201);
}

export const config = { path: "/api/create-game" };
