import {
  gameExpiresAt,
  getBingoStore,
  json,
  readBody,
  tokenMatches,
  validIdentifier,
} from "../lib/shared.mjs";

function validMobilePath(value) {
  return typeof value === "string"
    && value.length <= 100_000
    && /^\/mobile\.html#game=[A-Za-z0-9._-]+$/.test(value);
}

export default async function saveGameLink(request) {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const body = await readBody(request);
  if (!validIdentifier(body?.gameId) || !validMobilePath(body?.mobilePath)) {
    return json({ error: "Invalid game link." }, 400);
  }

  const store = getBingoStore();
  const key = `games/${body.gameId}.json`;
  const game = await store.get(key, { type: "json", consistency: "strong" });
  if (!game) return json({ error: "Game not found." }, 404);
  if (Date.now() > gameExpiresAt(game)) return json({ error: "This game has expired." }, 410);
  if (!tokenMatches(body.writeKey, game.writeKeyHash)) return json({ error: "Invalid game key." }, 403);

  if (game.mobilePath && game.mobilePath !== body.mobilePath) {
    return json({ error: "This game already has a mobile link." }, 409);
  }

  await store.setJSON(key, { ...game, mobilePath: body.mobilePath });
  return json({ saved: true });
}

export const config = { path: "/api/save-game-link" };
