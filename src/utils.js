// src/utils.js
export const SAMPLE_WORDS = [
  "PIZZA", "OCEAN", "ROBOT", "BICYCLE", "MOUNTAIN",
  "GUITAR", "SUNFLOWER", "AIRPLANE", "LIBRARY", "PYJAMAS",
];

export function makeRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export function readRoomFromUrl() {
  try {
    const params = new URLSearchParams(window.location.search);
    const q = params.get("room");
    if (q) return q.toUpperCase();
    const p = window.location.pathname.split("/").filter(Boolean);
    if (p.length >= 2 && p[0].toLowerCase() === "lobby") return p[1].toUpperCase();
    return null;
  } catch {
    return null;
  }
}