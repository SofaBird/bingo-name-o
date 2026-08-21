import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { getStore } from "@netlify/blobs";

export const STORE_NAME = "bingo-player-data";
export const MAX_GAME_AGE_MS = 31 * 24 * 60 * 60 * 1000;

export function getBingoStore() {
  return getStore(STORE_NAME, { consistency: "strong" });
}

export function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

export function randomToken(bytes = 24) {
  return randomBytes(bytes).toString("base64url");
}

export function hashToken(value) {
  return createHash("sha256").update(String(value)).digest();
}

export function tokenMatches(value, expectedHex) {
  if (typeof value !== "string" || typeof expectedHex !== "string") return false;
  const actual = hashToken(value);
  const expected = Buffer.from(expectedHex, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function tokenHex(value) {
  return hashToken(value).toString("hex");
}

export function cleanText(value, maximum) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, maximum) : "";
}

export function validIdentifier(value, minimum = 8, maximum = 64) {
  return typeof value === "string"
    && value.length >= minimum
    && value.length <= maximum
    && /^[A-Za-z0-9_-]+$/.test(value);
}

export async function readBody(request) {
  try {
    return await request.json();
  } catch (error) {
    return null;
  }
}
