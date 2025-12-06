// src/components/RevealPhase.js
import React from "react";
import { db, ref, update } from "../firebase";
import { PieChart, Pie, Cell, Tooltip, Legend } from "recharts";

export default function RevealPhase({ room, roomCode, isHost }) {
  const computeVoteResult = () => {
    if (!room.votes) return { winnerId: null };
    const counts = {};
    Object.values(room.votes).forEach(v => counts[v] = (counts[v] || 0) + 1);
    let winnerId = null, max = -1;
    Object.entries(counts).forEach(([id, c]) => { if (c > max) { max = c; winnerId = id; } });
    return { winnerId, counts };
  };

  const { winnerId } = computeVoteResult();
  const impostorCaught = winnerId === room.impostorId;

  async function forceReveal() {
    await update(ref(db, `rooms/${roomCode}`), { state: "reveal" });
  }

  return (
    <div style={{ padding: 20, border: "1px solid #eee", borderRadius: 8, backgroundColor: "#f9f9f9" }}>
      <h2>Reveal</h2>
      <div style={{ display: "flex", justifyContent: "space-around" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ color: "red" }}>Impostor</div>
          <div>{room.players[room.impostorId]?.name}</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ color: "blue" }}>Target Word</div>
          <div>{room.targetWord}</div>
        </div>
      </div>

      <h3>Result</h3>
      <div style={{ color: impostorCaught ? "green" : "red", fontWeight: "bold" }}>
        {impostorCaught ? "Crew wins! Impostor caught." : "Impostor wins! Crew failed."}
      </div>

      <h3>Votes</h3>
      {room.votes && Object.keys(room.votes).length > 0 ? (
        <PieChart width={400} height={300}>
          <Pie data={Object.entries(room.votes).map(([voter, voted]) => ({ name: room.players[voted]?.name, value: 1 }))}
               dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
            {Object.entries(room.votes).map((_, idx) => <Cell key={idx} fill={["#0088FE","#00C49F","#FFBB28","#FF8042"][idx%4]} />)}
          </Pie>
          <Tooltip /><Legend verticalAlign="bottom" />
        </PieChart>
      ) : <div>No votes yet</div>}

      {isHost && <button onClick={forceReveal}>Force Reveal</button>}
    </div>
  );
}