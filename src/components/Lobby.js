// src/components/Lobby.js
import React from "react";
import { makeRoomCode, SAMPLE_WORDS } from "../utils";
import { db, ref, set, get, runTransaction, update } from "../firebase";

export default function Lobby({
  name, setName, roomCode, setRoomCode,
  playerId, setPlayerId, isHost, setIsHost, room
}) {

  async function handleCreate() {
    if (!name) return alert("Enter your name");
    const code = makeRoomCode();
    setRoomCode(code);
    const id = `${Date.now()}_${Math.floor(Math.random() * 9999)}`;
    setPlayerId(id);
    setIsHost(true);

    const initial = {
      code, hostId: id, state: "lobby",
      players: { [id]: { id, name } }, createdAt: Date.now(),
      order: [], turnIndex: 0, targetWord: null, impostorId: null,
      clues: {}, votes: {}, turnStartedAt: null
    };

    await set(ref(db, `rooms/${code}`), initial);
    window.history.replaceState(null, "", `${window.location.origin}?room=${code}`);
    alert(`Lobby created. Share code: ${code}`);
  }

  async function handleJoin() {
    if (!name) return alert("Enter your name");
    if (!roomCode) return alert("Enter lobby code");
    const snap = await get(ref(db, `rooms/${roomCode}`));
    if (!snap.exists()) return alert("Room not found");
    const id = `${Date.now()}_${Math.floor(Math.random() * 9999)}`;
    setPlayerId(id);

    await runTransaction(ref(db, `rooms/${roomCode}/players`), (players) => {
      if (!players) players = {};
      players[id] = { id, name };
      return players;
    });

    window.history.replaceState(null, "", `${window.location.origin}?room=${roomCode}`);
    alert(`Joined lobby ${roomCode}`);
  }

  return (
    <div style={{ marginTop: 12, padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
      {!playerId ? (
        <>
          <div><label>Name</label><input value={name} onChange={e => setName(e.target.value)} /></div>
          <div>
            <button onClick={handleCreate}>Create Lobby</button>
            <input value={roomCode} onChange={e => setRoomCode(e.target.value.toUpperCase())} placeholder="Lobby code" />
            <button onClick={handleJoin}>Join Lobby</button>
          </div>
        </>
      ) : (
        <div>
          <h3>Players</h3>
          <ul>{room && Object.values(room.players || {}).map(p => <li key={p.id}>{p.name}{p.id===room.hostId?" (Host)":""}</li>)}</ul>
        </div>
      )}
    </div>
  );
}
