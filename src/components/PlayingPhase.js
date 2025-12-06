// src/components/PlayingPhase.js
import { db, ref, update, runTransaction, get } from "../firebase";
import React, { useState, useEffect, useRef } from "react";

export default function PlayingPhase({ name, room, roomCode, playerId, isHost }) {
  const [clueText, setClueText] = useState("");
  const [timeLeft, setTimeLeft] = useState(60);
  const timerRef = useRef(null);

  const curPlayerId = room?.order?.[room.turnIndex] || null;
  const assignment = playerId === room.impostorId ? "IMPOSTOR" : "CREW";
  const displayPlayers = Object.values(room.players || {});

  // Timer logic
  useEffect(() => {
    function tick() {
      if (curPlayerId && playerId === curPlayerId && room.turnStartedAt) {
        const elapsed = Math.floor((Date.now() - room.turnStartedAt) / 1000);
        const remaining = Math.max(0, 60 - elapsed);
        setTimeLeft(remaining);
        if (remaining <= 0) submitDone();
      } else setTimeLeft(60);
    }
    tick();
    timerRef.current = setInterval(tick, 500);
    return () => clearInterval(timerRef.current);
  }, [room, curPlayerId, playerId]);

  async function submitDone() {
    if (!room) return;
    const curIndex = room.turnIndex || 0;
    if (!curPlayerId) return;
    const text = clueText.trim() || "(no clue)";

    await update(ref(db, `rooms/${roomCode}/clues/${curIndex}/${playerId}`), { name, text, doneAt: Date.now() });
    setClueText("");

    await runTransaction(ref(db, `rooms/${roomCode}/turnIndex`), t => t === null ? 0 : t + 1);
    const newRoom = (await get(ref(db, `rooms/${roomCode}`))).val();
    if (newRoom.turnIndex >= (newRoom.order || []).length) {
      await update(ref(db, `rooms/${roomCode}`), { state: "voting", turnStartedAt: null });
    } else {
      await update(ref(db, `rooms/${roomCode}`), { turnStartedAt: Date.now() });
    }
  }

  return (
    <div style={{ display: "flex", gap: 20 }}>
      <div style={{ width: 220, padding: 12, border: "1px solid #eee", borderRadius: 8 }}>
        <h3>Current Turn</h3>
        <div style={{ fontWeight: "bold", margin: "12px 0" }}>{displayPlayers.find(p => p.id === curPlayerId)?.name || "?"}</div>
        <h4>Timer</h4>
        <div style={{ fontSize: 24, fontWeight: "bold", color: "green" }}>{timeLeft}s</div>
        <div style={{ marginTop: 20 }}><b>Your Role:</b> {assignment}</div>
        {assignment !== "IMPOSTOR" && <div>Target Word: <b>{room.targetWord}</b></div>}
      </div>

      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center" }}>
          {displayPlayers.map(p => {
            const playerClues = [];
            Object.entries(room.clues || {}).forEach(([turnIdx, map]) => { if (map[p.id]) playerClues.push(map[p.id].text); });
            const isCurrent = p.id === curPlayerId;
            return (
              <div key={p.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 100 }}>
                <div style={{ minHeight: 40, textAlign: "center" }}>{playerClues.map((c, idx) => <div key={idx} style={{ fontSize: 12, backgroundColor: "#f0f0f0", padding: "2px 4px", borderRadius: 4, marginBottom: 2 }}>{c}</div>)}</div>
                <div style={{ width: 60, height: 60, borderRadius: "50%", backgroundColor: "#ddd", display: "flex", justifyContent: "center", alignItems: "center", fontWeight: "bold", fontSize: 24, border: isCurrent ? "3px solid green" : "2px solid #ccc" }}>{p.name[0]}</div>
                <div style={{ fontSize: 12 }}>{p.id === room.hostId ? `${p.name} (Host)` : p.name}</div>
              </div>
            );
          })}
        </div>

        {playerId === curPlayerId && <div style={{ marginTop: 16 }}>
          <textarea value={clueText} onChange={e => setClueText(e.target.value)} rows={3} style={{ width: "100%", padding: 8 }} placeholder="Type your clue..." />
          <button onClick={submitDone}>Done</button>
        </div>}
      </div>
    </div>
  );
}