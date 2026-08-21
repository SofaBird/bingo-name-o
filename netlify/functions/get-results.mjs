import {
  getBingoStore,
  json,
  tokenMatches,
  validIdentifier,
} from "../lib/shared.mjs";

async function readPlayers(store, blobs) {
  const players = [];
  for (let index = 0; index < blobs.length; index += 25) {
    const batch = blobs.slice(index, index + 25);
    const records = await Promise.all(batch.map(({ key }) => (
      store.get(key, { type: "json", consistency: "strong" }).catch(() => null)
    )));
    records.filter(Boolean).forEach((record) => players.push(record));
  }
  return players;
}

export default async function getResults(request) {
  if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);
  const url = new URL(request.url);
  const gameId = url.searchParams.get("game");
  const readKey = url.searchParams.get("key");
  if (!validIdentifier(gameId)) return json({ error: "Invalid game ID." }, 400);

  const store = getBingoStore();
  const game = await store.get(`games/${gameId}.json`, { type: "json", consistency: "strong" });
  if (!game) return json({ error: "Game not found." }, 404);
  if (!tokenMatches(readKey, game.readKeyHash)) return json({ error: "Invalid results key." }, 403);
  if (Date.now() > game.expiresAt) return json({ error: "These results expired after 30 days." }, 410);

  const listed = await store.list({ prefix: `players/${gameId}/` });
  const players = await readPlayers(store, listed.blobs);
  players.sort((a, b) => b.updatedAt - a.updatedAt);

  return json({
    game: {
      id: game.id,
      title: game.title,
      createdAt: game.createdAt,
      expiresAt: game.expiresAt,
    },
    players,
  });
}

export const config = { path: "/api/results" };
