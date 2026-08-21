import { getBingoStore } from "../lib/shared.mjs";

async function deleteInBatches(store, keys) {
  for (let index = 0; index < keys.length; index += 25) {
    await Promise.all(keys.slice(index, index + 25).map((key) => store.delete(key)));
  }
}

export default async function cleanupExpired() {
  const store = getBingoStore();
  const now = Date.now();
  let deletedGames = 0;
  let deletedPlayers = 0;

  for await (const page of store.list({ prefix: "games/", paginate: true })) {
    for (const blob of page.blobs) {
      const game = await store.get(blob.key, { type: "json", consistency: "strong" }).catch(() => null);
      if (!game || !game.expiresAt || now <= game.expiresAt) continue;
      const playerKeys = [];
      for await (const players of store.list({ prefix: `players/${game.id}/`, paginate: true })) {
        players.blobs.forEach(({ key }) => playerKeys.push(key));
      }
      await deleteInBatches(store, playerKeys);
      await store.delete(blob.key);
      deletedPlayers += playerKeys.length;
      deletedGames += 1;
    }
  }

  console.log(`Bingo cleanup removed ${deletedGames} expired games and ${deletedPlayers} player records.`);
}

export const config = { schedule: "@daily" };
