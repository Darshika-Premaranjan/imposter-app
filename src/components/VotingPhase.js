// src/components/VotingPhase.js
import { db, ref, update, get } from "../firebase";
import React from "react";

export default function VotingPhase({ room, roomCode, playerId }) {
  const displayPlayers = Object.values(room.players || {});
  const assignment = playerId === room.impostorId ? "IMPOSTOR" : "CREW";

  async function castVote(votedId) {
    if (votedId === playerId || assignment === "IMPOSTOR") return;
    await update(ref(db, `rooms/${roomCode}/votes`), { [playerId]: votedId });

    const snap = await get(ref(db, `rooms/${roomCode}/players`));
    const players = snap.val() || {};
    const crewCount = Object.values(players).filter(p => p.id !== room.impostorId).length;

    const votesSnap = await get(ref(db, `rooms/${roomCode}/votes`));
    const votesCount = votesSnap.exists() ? Object.keys(votesSnap.val()).length : 0;

    if (votesCount >= crewCount) await update(ref(db, `rooms/${roomCode}`), { state: "reveal" });
  }

  return (
    <div style={{ textAlign: "center" }}>
      {assignment === "IMPOSTOR" ? <div style={{ color: "red" }}>As Impostor, you cannot vote</div> :
        <>
          <div>Choose who you think is the impostor:</div>
          {displayPlayers.map(p => (
            <button key={p.id} onClick={() => castVote(p.id)} disabled={p.id === playerId || Boolean(room.votes && room.votes[playerId])}>{p.name}</button>
          ))}
        </>
      }
      <div>Votes so far: {room.votes ? Object.keys(room.votes).length : 0}/{displayPlayers.length - 1}</div>
    </div>
  );
}
