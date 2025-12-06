// src/App.js
import React, { useEffect, useState, useRef } from "react";
import {
  db,
  ref,
  set,
  onValue,
  update,
  get,
  runTransaction
} from "./firebase";
import {
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  Avatar,
  Grid,
  CircularProgress,
} from "@mui/material";

// Utility functions
function makeRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function readRoomFromUrl() {
  try {
    const params = new URLSearchParams(window.location.search);
    const q = params.get("room");
    if (q) return q.toUpperCase();
    const p = window.location.pathname.split("/").filter(Boolean);
    if (p.length >= 2 && p[0].toLowerCase() === "lobby") return p[1].toUpperCase();
    return null;
  } catch (e) {
    return null;
  }
}


const SAMPLE_WORDS = [
  // Agile / Project Management
  "SPRINT",
  "BACKLOG",
  "USERSTORY",
  "RETROSPECTIVE",
  "KANBAN",
  "SCRUM",
  "EPIC",
  "VELOCITY",
  "PRODUCTOWNER",
  "SCRUMMASTER",

  // IT / Tech Concepts
  "API",
  "DATABASE",
  "CLOUD",
  "DOCKER",
  "KUBERNETES",
  "GIT",
  "CI/CD",
  "JENKINS",
  "MICROSERVICES",
  "ALGORITHM"
];


export default function App() {
  const [mode, setMode] = useState(null);
  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [room, setRoom] = useState(null);
  const [playerId, setPlayerId] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [clueText, setClueText] = useState("");
  const [voteFor, setVoteFor] = useState("");
  const [timeLeft, setTimeLeft] = useState(60);
  const [timeLimit, setTimeLimit] = useState(60);
  const timerRef = useRef(null);
const [selectedVotePlayer, setSelectedVotePlayer] = useState(null);

  useEffect(() => {
    const r = readRoomFromUrl();
    if (r) {
      setRoomCode(r);
      setMode("join");
    }
  }, []);

  useEffect(() => {
    if (!roomCode) return setRoom(null);
    const roomRef = ref(db, `rooms/${roomCode}`);
    const unsub = onValue(roomRef, (snapshot) => {
      const val = snapshot.val();
      setRoom(val);
      if (val && playerId) setIsHost(val.hostId === playerId);
      if (val?.timeLimit) setTimeLimit(val.timeLimit);
    });
    return () => unsub();
  }, [roomCode, playerId]);

  // --- Lobby / Game Handlers ---
  async function handleCreate() {
    if (!name) return alert("Enter your name");
    const code = makeRoomCode();
    setRoomCode(code);
    const id = `${Date.now()}_${Math.floor(Math.random() * 9999)}`;
    setPlayerId(id);
    setIsHost(true);

    const initial = {
      code,
      hostId: id,
      state: "lobby",
      players: { [id]: { id, name } },
      createdAt: Date.now(),
      order: [],
      turnIndex: 0,
      targetWord: null,
      impostorId: null,
      clues: {},
      votes: {},
      turnStartedAt: null,
      timeLimit: timeLimit,
    };

    await set(ref(db, `rooms/${code}`), initial);
    const newUrl = `${window.location.origin}${window.location.pathname}?room=${code}`;
    window.history.replaceState(null, "", newUrl);
  }

  async function handleJoin() {
    if (!name || !roomCode) return alert("Enter your name and lobby code");
    const snap = await get(ref(db, `rooms/${roomCode}`));
    if (!snap.exists()) return alert("Room not found");
    const id = `${Date.now()}_${Math.floor(Math.random() * 9999)}`;
    setPlayerId(id);

    await runTransaction(ref(db, `rooms/${roomCode}/players`), (players) => {
      if (!players) players = {};
      players[id] = { id, name };
      return players;
    });

    const newUrl = `${window.location.origin}${window.location.pathname}?room=${roomCode}`;
    window.history.replaceState(null, "", newUrl);
  }

 function copyInvite() {
  if (!roomCode) return;
  const link = `${window.location.origin}${window.location.pathname}?room=${roomCode}`;
  navigator.clipboard.writeText(link)
    .then(() => alert("Invite link copied! ✅")) // simple alert
    .catch(() => alert("Failed to copy link"));
}

  async function startGame() {
    if (!isHost || !room) return;
    const playerIds = Object.keys(room.players || {});
    if (playerIds.length < 2 && !window.confirm("Less than 2 players. Continue?")) return;

    const target = SAMPLE_WORDS[Math.floor(Math.random() * SAMPLE_WORDS.length)];
    const impIndex = Math.floor(Math.random() * playerIds.length);
    const impostorId = playerIds[impIndex];
 
const crewIds = playerIds.filter(id => id !== impostorId);
// Shuffle crew only
const shuffledCrew = [...crewIds].sort(() => Math.random() - 0.5);

// Impostor always placed **after first 3 turns**
let order = [...shuffledCrew];
if (shuffledCrew.length >= 3) {
  const insertPos = Math.floor(Math.random() * (shuffledCrew.length - 2)) + 3; 
  // Impostor comes **after 3rd turn**
  order.splice(insertPos, 0, impostorId);
} else {
  // If less than 3 crew, just put impostor last
  order.push(impostorId);
}

    await update(ref(db, `rooms/${roomCode}`), {
      state: "playing",
      targetWord: target,
      impostorId,
      order,
      turnIndex: 0,
      clues: {},
      votes: {},
      turnStartedAt: Date.now(),
    });
  }

  function currentTurnPlayerId() {
    if (!room) return null;
    const idx = room.turnIndex ?? 0;
    if (!room.order || idx >= (room.order.length || 0)) return null;
    return room.order[idx];
  }

  useEffect(() => {
    if (!room || room.state !== "playing") {
      setTimeLeft(timeLimit);
      clearInterval(timerRef.current);
      return;
    }

    function tick() {
      const curId = currentTurnPlayerId();
      if (curId && playerId === curId && room.turnStartedAt) {
        const elapsed = Math.floor((Date.now() - room.turnStartedAt) / 1000);
        const remaining = Math.max(0, (room.timeLimit || 60) - elapsed);
        setTimeLeft(remaining);
        if (remaining <= 0) submitDone();
      } else setTimeLeft(room.timeLimit || 60);
    }

    tick();
    timerRef.current = setInterval(tick, 500);
    return () => clearInterval(timerRef.current);
  }, [room, roomCode, playerId]);

  async function submitDone() {
    if (!room) return;
    const curIndex = room.turnIndex || 0;
    const curPlayerId = currentTurnPlayerId();
    if (!curPlayerId) return alert("No current turn");
    if (playerId !== curPlayerId && !isHost) return;

    const text = clueText.trim() || "(no clue)";
    await update(ref(db, `rooms/${roomCode}/clues/${curIndex}/${playerId || "host"}`), {
      name,
      text,
      doneAt: Date.now(),
    });
    setClueText("");

    await runTransaction(ref(db, `rooms/${roomCode}/turnIndex`), (t) => (t === null ? 0 : t + 1));
    const newRoomSnap = await get(ref(db, `rooms/${roomCode}`));
    const newRoom = newRoomSnap.val();
    if (newRoom.turnIndex >= (newRoom.order || []).length) {
      await update(ref(db, `rooms/${roomCode}`), { state: "voting", turnStartedAt: null });
    } else await update(ref(db, `rooms/${roomCode}`), { turnStartedAt: Date.now() });
  }

  async function castVote(votedId) {
    if (!room || !playerId) return;
    if (votedId === playerId) return alert("Cannot vote for yourself");
    if (assignment === "IMPOSTOR") return;

    await update(ref(db, `rooms/${roomCode}/votes`), { [playerId]: votedId });
    setVoteFor(votedId);

    const snap = await get(ref(db, `rooms/${roomCode}/players`));
    const players = snap.val() || {};
    const crewCount = Object.values(players).filter((p) => p.id !== room.impostorId).length;
    const votesSnap = await get(ref(db, `rooms/${roomCode}/votes`));
    const votesCount = votesSnap.exists() ? Object.keys(votesSnap.val()).length : 0;

    if (votesCount >= crewCount) await update(ref(db, `rooms/${roomCode}`), { state: "reveal" });
  }

 async function forceReveal() {
  if (!isHost) return;

  // Optional: update Firebase to reset room state or remove room
  await update(ref(db, `rooms/${roomCode}`), { state: "finished" });

  // Reset local states to go back to initial selection
  setPlayerId(null);
  setIsHost(false);
  setRoom(null);
  setRoomCode("");
  setMode(null);

  // Reset browser URL
  window.history.replaceState(null, "", window.location.pathname);
}




  async function leaveRoom() {
    if (!roomCode || !playerId) return;
    await runTransaction(ref(db, `rooms/${roomCode}/players`), (players) => {
      if (!players) return {};
      delete players[playerId];
      return players;
    });
    setPlayerId(null);
    setIsHost(false);
    setRoom(null);
    setRoomCode("");
    setMode(null);
    window.history.replaceState(null, "", window.location.pathname);
  }

  const curPlayerId = currentTurnPlayerId();
  const displayPlayers = room ? Object.values(room.players || {}) : [];
  const assignment = room
    ? playerId === room.impostorId
      ? "IMPOSTOR"
      : "CREW"
    : null;

   return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        p: 2,
        background: "linear-gradient(135deg, #6a0dad 0%, #9c27b0 100%)",
        color: "#fff",
      }}
    >
      <Typography variant="h4" mb={3} sx={{ color: "#fff" }}>
        Imposter Game
      </Typography>

      {/* Initial Mode Selection */}
      {!playerId && !mode && !roomCode && (
        <Paper sx={{ p: 4, textAlign: "center", maxWidth: 400, width: "100%", mx: "auto" }}>
          <Typography variant="h6" mb={2}>
            Welcome to Imposter Game
          </Typography>
          <Button variant="contained" sx={{ m: 1 }} onClick={() => setMode("create")}>
            Create Lobby
          </Button>
          <Button variant="outlined" sx={{ m: 1 }} onClick={() => setMode("join")}>
            Join Lobby
          </Button>
        </Paper>
      )}

      {/* Create / Join Lobby */}
      {mode === "create" && !playerId && (
        <Paper sx={{ p: 4, textAlign: "center", maxWidth: 400, width: "100%", mx: "auto" }}>
          <Typography variant="h6" mb={2}>Create Lobby</Typography>
          <TextField fullWidth label="Your Name" value={name} onChange={(e) => setName(e.target.value)} sx={{ mb: 2 }} />
          <TextField fullWidth type="number" label="Time Limit (seconds)" value={timeLimit} onChange={(e) => setTimeLimit(Number(e.target.value))} sx={{ mb: 2 }} />
          <Button fullWidth variant="contained" onClick={handleCreate}>Create Lobby</Button>
        </Paper>
      )}

      {!playerId && roomCode && (
        <Paper sx={{ p: 4, textAlign: "center", maxWidth: 400, width: "100%", mx: "auto" }}>
          <Typography variant="h6" mb={2}>Join Lobby</Typography>
          <TextField fullWidth label="Your Name" value={name} onChange={(e) => setName(e.target.value)} sx={{ mb: 2 }} />
          <TextField fullWidth label="Lobby Code" value={roomCode} InputProps={{ readOnly: true }} sx={{ mb: 2 }} />
          <Button fullWidth variant="contained" onClick={handleJoin}>Join Lobby</Button>
        </Paper>
      )}

      {/* Lobby & Game */}
      {playerId && room && (
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Box sx={{ display: "flex", justifyContent: "space-between" }}>
              <Typography>{/* Room info */}</Typography>
            </Box>
          </Grid>

{/* Lobby Phase */}
{room.state === "lobby" && (
  <Grid item xs={12}>
    <Paper sx={{ p: 3, borderRadius: 3, boxShadow: 3, minHeight: "70vh", position: "relative", display: "flex", flexDirection: "column" }}>
      
      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 2 }}>
        <Typography variant="h6">Lobby</Typography>
        <Typography variant="h6">Room: {roomCode}</Typography>
      </Box>
      
      <Typography variant="subtitle1" sx={{ textAlign: "center", mb: 3 }}>
        {displayPlayers.length} players joined
      </Typography>

      <Grid container spacing={3} justifyContent="center">
        {displayPlayers.map((p) => (
          <Grid item xs={6} sm={3} key={p.id}>
            <Paper elevation={3} sx={{ p: 2, textAlign: "center", borderRadius: 2, bgcolor: p.id === room.hostId ? "#e3f2fd" : "#fff" }}>
              <Avatar sx={{ bgcolor: p.id === room.hostId ? "#1976d2" : "#9e9e9e", width: 70, height: 70, mx: "auto", fontSize: 24 }}>
                {p.name[0].toUpperCase()}
              </Avatar>
              <Typography variant="subtitle1" sx={{ mt: 1 }}>{p.name}</Typography>
              {p.id === room.hostId && <Typography variant="caption" color="primary">Host</Typography>}
            </Paper>
          </Grid>
        ))}
      </Grid>

      {/* Invite Link Section */}
{/* Invite Link Section */}
<Box sx={{ mt: 4, textAlign: "center" }}>
  <Button
    variant="contained"
    onClick={async () => {
      await copyInvite();
    }}
    sx={{
      bgcolor: "green",
      "&:hover": { bgcolor: "darkgreen" },
      px: 4,
      py: 1.5,
      fontSize: 16,
    }}
  >
    Copy Invite Link
  </Button>
</Box>


      {isHost && (
        <Box sx={{ mt: 4, textAlign: "center" }}>
          <Button variant="contained" color="primary" onClick={startGame} sx={{ px: 6, py: 1.5, fontSize: 16 }}>
            Start Game
          </Button>
        </Box>
      )}
    </Paper>
  </Grid>
)}


          {/* Playing Phase */}
          {room.state === "playing" && (
            <Grid item xs={12}>
              <Paper sx={{ p: 2, textAlign: "center", mb: 2 }}>
<Box sx={{ textAlign: "center", mb: 2 }}>
  <Typography variant="h5" sx={{ fontWeight: "bold", mb: 1 }}>
    Your Role:{" "}
    <span style={{ color: assignment === "IMPOSTOR" ? "#d32f2f" : "#1976d2" }}>
      {assignment}
    </span>
  </Typography>

  {assignment !== "IMPOSTOR" && (
    <Typography variant="h4" sx={{ fontWeight: "bold", color: "#d32f2f", mb: 1 }}>
      Target Word: {room.targetWord}
    </Typography>
  )}

  <Typography variant="h5" sx={{ fontWeight: "bold" }}>
    Current Turn: {room.players[curPlayerId]?.name || "Loading..."}
  </Typography>
</Box>

                {playerId === curPlayerId && <Box sx={{ mt: 2, display: "inline-block", px: 3, py: 1, bgcolor: "#f44336", color: "#fff", borderRadius: 2, fontWeight: "bold", fontSize: 24 }}>{timeLeft}s</Box>}
              </Paper>

              {/* Player Clues Grid */}
              <Grid container spacing={2} justifyContent="center">
                {displayPlayers.map((p) => {
                  const playerClues = [];
                  Object.values(room.clues || {}).forEach((turnMap) => {
                    if (turnMap[p.id]) playerClues.push(turnMap[p.id].text);
                  });
                  return (
                    <Grid item key={p.id} sx={{ textAlign: "center" }}>
                      {playerClues.map((c, idx) => (
                        <Box key={idx} sx={{ bgcolor: "green", color: "#fff", px: 2, py: 1, borderRadius: 2, mb: 1, fontWeight: 500, fontSize: 14, textAlign: "center", minWidth: 80 }}>{c}</Box>
                      ))}
                      <Avatar sx={{ bgcolor: "#ccc", width: 80, height: 80, mx: "auto", mt: 1, fontSize: 28 }}>{p.name[0].toUpperCase()}</Avatar>
                      <Typography variant="h6" sx={{ mt: 1 }}>{p.name}</Typography>
                    </Grid>
                  );
                })}
              </Grid>

              {/* Clue Input */}
              {playerId === curPlayerId && (
                <Box sx={{ mt: 2, maxWidth: 400, mx: "auto" }}>
                  <TextField
                    fullWidth multiline rows={3} value={clueText} onChange={(e) => setClueText(e.target.value)}
                    placeholder="Type your clue..."
                    sx={{
                      bgcolor: "#fff", borderRadius: 2,
                      "& .MuiInputBase-input": { color: "#000" },
                      "& .MuiOutlinedInput-root": { "& fieldset": { borderColor: "#ccc" }, "&:hover fieldset": { borderColor: "#1976d2" }, "&.Mui-focused fieldset": { borderColor: "#1976d2" } },
                    }}
                  />
                  <Button variant="contained" onClick={submitDone} sx={{ mt: 1 }}>Done</Button>
                </Box>
              )}
            </Grid>
          )}

   {/* Voting Phase */}
{/* Voting Phase */}
{room.state === "voting" && (
  <Grid item xs={12}>
    <Paper sx={{ p: 2 }}>
      <Typography variant="h6" align="center" sx={{ mb: 2 }}>Voting Phase</Typography>

      {assignment === "IMPOSTOR" && (
        <Typography variant="subtitle1" align="center" color="error" sx={{ mb: 2 }}>
          You are the impostor, cannot vote.
        </Typography>
      )}

      <Grid container spacing={2} justifyContent="center">
        {displayPlayers.map((p) => {
          const lastTurnIndex = Math.max(...Object.keys(room.clues || {}).map(Number), 0);
          const playerTurns = Object.values(room.clues || {}).map(turnMap => turnMap[p.id]?.text).filter(Boolean);
          const clueText = playerTurns.length > 0 ? playerTurns[playerTurns.length - 1] : "(no clue)";

          // Disable button for self, already voted, or impostor
          const disabled = p.id === playerId || Boolean(room.votes && room.votes[playerId]) || assignment === "IMPOSTOR";

          return (
            <Grid item key={p.id} sx={{ textAlign: "center" }}>
              <Box sx={{
                bgcolor: "green",
                color: "#fff",
                px: 2,
                py: 1,
                borderRadius: 2,
                mb: 1,
                fontWeight: 500,
                fontSize: 14,
                textAlign: "center",
                minWidth: 80
              }}>
                {clueText}
              </Box>
              <Avatar sx={{ bgcolor: "#ccc", width: 100, height: 100, mx: "auto", mt: 1, fontSize: 36 }}>
                {p.name[0].toUpperCase()}
              </Avatar>
              <Button
                variant="contained"
                sx={{
                  mt: 1,
                  fontSize: 16,
                  textTransform: "none",
                  bgcolor: "#1976d2", // solid blue color
                  "&:hover": { bgcolor: "#115293" },
                  minWidth: 100,
                }}
                disabled={disabled}
                onClick={() => !disabled && castVote(p.id)}
              >
                {p.name}
              </Button>

              {disabled && room.votes && room.votes[playerId] === p.id && (
                <Typography variant="caption" color="primary">Your Vote</Typography>
              )}
            </Grid>
          );
        })}
      </Grid>
    </Paper>
  </Grid>
)}


          {/* Reveal Phase */}
{/* Reveal Phase */}
{room.state === "reveal" && (
  <Grid item xs={12}>
    <Paper sx={{ p: 4, borderRadius: 3, boxShadow: 5, textAlign: "center", maxWidth: 600, mx: "auto" }}>
      <Typography variant="h4" gutterBottom>Reveal Phase</Typography>

      {/* Impostor & Target Word */}
      <Grid container spacing={4} justifyContent="center" sx={{ mb: 4 }}>
        <Grid item>
          <Paper sx={{ p: 2, borderRadius: 2, bgcolor: "#ffe6e6" }}>
            <Typography variant="subtitle1" color="error">Impostor</Typography>
            <Typography variant="h6">{room.players[room.impostorId]?.name}</Typography>
          </Paper>
        </Grid>
        <Grid item>
          <Paper sx={{ p: 2, borderRadius: 2, bgcolor: "#e6f7ff" }}>
            <Typography variant="subtitle1" color="primary">Target Word</Typography>
            <Typography variant="h6">{room.targetWord}</Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Votes Section */}
<Grid container spacing={2} justifyContent="center">
  {Object.values(room.players || {})
    .map((p) => ({
      id: p.id,
      name: p.name,
      votes: Object.entries(room.votes || {})
        .filter(([voterId, votedId]) => votedId === p.id)
        .map(([voterId]) => room.players[voterId]?.name || "Unknown"),
    }))
    .sort((a, b) => b.votes.length - a.votes.length)
    .map((p, idx) => (
      <Grid item key={p.id} xs={6} sm={4}>
        <Paper
          sx={{
            p: 2,
            borderRadius: 2,
            bgcolor: p.id === room.impostorId ? "#ffe6e6" : "#f0f0f0",
            border: idx === 0 ? "2px solid #4caf50" : "none",
            textAlign: "center",
            cursor: "pointer",
          }}
          elevation={3}
          onClick={() =>
            setSelectedVotePlayer(
              selectedVotePlayer === p.id ? null : p.id
            )
          }
        >
          <Avatar sx={{ width: 60, height: 60, mx: "auto", mb: 1, bgcolor: "#1976d2" }}>
            {p.name[0].toUpperCase()}
          </Avatar>
          <Typography variant="subtitle1">{p.name}</Typography>
          <Typography variant="h6" sx={{ mt: 1, color: "#333" }}>
            {p.votes.length} vote{p.votes.length !== 1 ? "s" : ""}
          </Typography>

          {/* Show who voted if selected */}
          {selectedVotePlayer === p.id && p.votes.length > 0 && (
            <Box sx={{ mt: 1, textAlign: "center" }}>
              <Typography variant="caption" sx={{ fontWeight: "bold" }}>Voted By:</Typography>
              {p.votes.map((voter, i) => (
                <Typography key={i} variant="body2">{voter}</Typography>
              ))}
            </Box>
          )}
        </Paper>
      </Grid>
    ))}
</Grid>
    
      {isHost && (
                  <Button variant="contained" onClick={forceReveal} sx={{ mt: 2 }}>
                    Next Round
                  </Button>
                )}
              </Paper>
            </Grid>
          )}
        </Grid>
      )}
    </Box>
  );
}