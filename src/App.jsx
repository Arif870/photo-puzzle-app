import React, { useState, useEffect, useRef } from "react";
import Pusher from "pusher-js";
import { QRCodeSVG } from "qrcode.react";
import confetti from "canvas-confetti";
import {
  Trophy,
  Users,
  Play,
  RefreshCw,
  Upload,
  Image as ImageIcon,
  Sparkles,
  CheckCircle2,
  Clock,
  Smartphone,
  Monitor,
  ChevronRight,
  Eye,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

const PRESET_IMAGES = [
  {
    id: "1",
    name: "Mountain Peak",
    url: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "2",
    name: "Neon City",
    url: "https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "3",
    name: "Abstract Art",
    url: "https://images.unsplash.com/photo-1541701494587-cb58502866ab?auto=format&fit=crop&w=1200&q=80",
  },
];

const DIFFICULTY_LEVELS = [
  { id: "2", label: "Bigger (2x2)", grid: 2 },
  { id: "3", label: "Medium (3x3)", grid: 3 },
  { id: "4", label: "Hard (4x4)", grid: 4 },
  { id: "6", label: "Complex (6x6)", grid: 6 },
];

const PUSHER_KEY = "e73ccec76d7cca0328b8";
const PUSHER_CLUSTER = "ap2";

async function sendRoomEvent(room, event, data) {
  try {
    await fetch("/api/pusher", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ room, event, data }),
    });
  } catch (err) {
    console.error("Failed to trigger room event:", err);
  }
}

export default function App() {
  const [role, setRole] = useState("landing");
  const [roomId, setRoomId] = useState("");

  const [selectedImage, setSelectedImage] = useState(PRESET_IMAGES[0].url);
  const [gridSize, setGridSize] = useState(2);
  const [gameStatus, setGameStatus] = useState("lobby");
  const [players, setPlayers] = useState([]);
  const [playerName, setPlayerName] = useState("");
  const [currentPlayerId, setCurrentPlayerId] = useState("");

  const [tiles, setTiles] = useState([]);
  const [selectedTileIndex, setSelectedTileIndex] = useState(null);
  const [startTime, setStartTime] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [showMobilePreview, setShowMobilePreview] = useState(true); // Toggle reference preview

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const room = params.get("room");
    if (room) {
      setRoomId(room);
      setRole("player");
    }
  }, []);

  useEffect(() => {
    if (!roomId) return;

    const pusher = new Pusher(PUSHER_KEY, { cluster: PUSHER_CLUSTER });
    const channel = pusher.subscribe(`room-${roomId}`);

    channel.bind("PLAYER_JOINED", data => {
      setPlayers(prev => [...prev.filter(p => p.id !== data.id), data]);
    });

    channel.bind("GAME_START", data => {
      setGameStatus("playing");
      setGridSize(data.gridSize);
      setSelectedImage(data.selectedImage);
      setStartTime(Date.now());
    });

    channel.bind("PLAYER_FINISHED", data => {
      setPlayers(prev =>
        prev.map(p =>
          p.id === data.id ? { ...p, time: data.time, completed: true } : p,
        ),
      );
    });

    channel.bind("RESET_GAME", () => {
      setGameStatus("lobby");
      setIsCompleted(false);
    });

    return () => pusher.unsubscribe(`room-${roomId}`);
  }, [roomId]);

  useEffect(() => {
    let interval;
    if (gameStatus === "playing" && !isCompleted && startTime) {
      interval = setInterval(() => {
        setElapsedTime(((Date.now() - startTime) / 1000).toFixed(1));
      }, 100);
    }
    return () => clearInterval(interval);
  }, [gameStatus, isCompleted, startTime]);

  const startHostSession = () => {
    const newRoom = Math.random().toString(36).substring(2, 8).toUpperCase();
    setRoomId(newRoom);
    setRole("host");
  };

  const handlePlayerJoin = async e => {
    e.preventDefault();
    if (!playerName.trim()) return;
    const newId = "player_" + Math.random().toString(36).substring(2, 7);
    setCurrentPlayerId(newId);

    const playerData = {
      id: newId,
      name: playerName,
      completed: false,
      time: null,
    };
    setPlayers(prev => [...prev, playerData]);
    await sendRoomEvent(roomId, "PLAYER_JOINED", playerData);
  };

  const startPuzzleRound = async () => {
    setGameStatus("playing");
    setStartTime(Date.now());
    await sendRoomEvent(roomId, "GAME_START", { gridSize, selectedImage });
  };

  const resetGameRound = async () => {
    setGameStatus("lobby");
    setPlayers(prev => prev.map(p => ({ ...p, completed: false, time: null })));
    await sendRoomEvent(roomId, "RESET_GAME", {});
  };

  useEffect(() => {
    if (gameStatus === "playing" && role === "player") {
      const totalTiles = gridSize * gridSize;
      const initialTiles = Array.from({ length: totalTiles }, (_, index) => ({
        correctIndex: index,
        currentIndex: index,
      }));

      let shuffled = [...initialTiles];
      do {
        shuffled = shuffled.sort(() => Math.random() - 0.5);
      } while (shuffled.every((tile, idx) => tile.correctIndex === idx));

      setTiles(shuffled);
      setIsCompleted(false);
    }
  }, [gameStatus, gridSize, role]);

  const handleTileClick = async index => {
    if (isCompleted) return;

    if (selectedTileIndex === null) {
      setSelectedTileIndex(index);
    } else {
      const newTiles = [...tiles];
      const temp = newTiles[selectedTileIndex];
      newTiles[selectedTileIndex] = newTiles[index];
      newTiles[index] = temp;

      setTiles(newTiles);
      setSelectedTileIndex(null);

      const checkWin = newTiles.every((tile, idx) => tile.correctIndex === idx);
      if (checkWin) {
        setIsCompleted(true);
        const finalTime = parseFloat(
          ((Date.now() - startTime) / 1000).toFixed(1),
        );
        confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });

        await sendRoomEvent(roomId, "PLAYER_FINISHED", {
          id: currentPlayerId,
          time: finalTime,
        });
      }
    }
  };

  const handleCustomImageUpload = e => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = uploadEvent => {
        const img = new Image();
        img.src = uploadEvent.target.result;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const maxDim = 1000;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxDim) {
              height *= maxDim / width;
              width = maxDim;
            }
          } else {
            if (height > maxDim) {
              width *= maxDim / height;
              height = maxDim;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);
          setSelectedImage(canvas.toDataURL("image/jpeg", 0.85));
        };
      };
      reader.readAsDataURL(file);
    }
  };

  const joinUrl = `${window.location.origin}${window.location.pathname}?room=${roomId}`;

  if (role === "landing") {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 antialiased">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl text-center">
          <div className="inline-flex p-4 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-2xl mb-4">
            <Sparkles className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-black mb-2 tracking-tight">
            PhotoPuzzle Live
          </h1>
          <p className="text-slate-400 text-sm mb-8">
            Enterprise real-time icebreaker app for sessions & workshops.
          </p>

          <div className="space-y-4">
            <button
              onClick={startHostSession}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 font-bold rounded-xl shadow-lg transition flex items-center justify-center gap-2"
            >
              <Monitor className="w-5 h-5" /> Host Session (Presenter)
            </button>
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-800"></div>
              </div>
              <div className="relative text-xs uppercase text-slate-500 bg-slate-900 px-3 inline-block font-mono">
                or enter code
              </div>
            </div>
            <form
              onSubmit={e => {
                e.preventDefault();
                if (roomId) setRole("player");
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                placeholder="ROOM CODE"
                value={roomId}
                onChange={e => setRoomId(e.target.value.toUpperCase())}
                className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl font-mono text-center uppercase tracking-widest focus:outline-none focus:border-indigo-500"
              />
              <button
                type="submit"
                className="px-5 bg-slate-800 hover:bg-slate-700 font-bold rounded-xl"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  if (role === "host") {
    const sortedPlayers = [...players].sort((a, b) => {
      if (a.completed && b.completed) return a.time - b.time;
      if (a.completed) return -1;
      if (b.completed) return 1;
      return 0;
    });

    const completedPlayers = sortedPlayers.filter(p => p.completed);

    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-6 flex flex-col font-sans">
        <header className="flex justify-between items-center bg-slate-900/80 backdrop-blur border border-slate-800 px-6 py-4 rounded-2xl mb-6 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">
                PhotoPuzzle Presenter Dashboard
              </h1>
              <p className="text-xs text-slate-400">Live Training Activity</p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-slate-950 border border-slate-800 px-4 py-2 rounded-xl">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              Room Code
            </span>
            <span className="font-mono text-lg font-black text-indigo-400 tracking-wider">
              {roomId}
            </span>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
          <div className="lg:col-span-3 bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between shadow-xl">
            <div className="space-y-6">
              <div>
                <h2 className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-3 flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-indigo-400" /> Image
                  Selection
                </h2>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {PRESET_IMAGES.map(img => (
                    <button
                      key={img.id}
                      onClick={() => setSelectedImage(img.url)}
                      className={`relative rounded-lg overflow-hidden border-2 h-16 transition ${selectedImage === img.url ? "border-indigo-500 ring-2 ring-indigo-500/20" : "border-transparent opacity-50 hover:opacity-100"}`}
                    >
                      <img
                        src={img.url}
                        alt={img.name}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>

                <label className="flex items-center justify-center gap-2 w-full py-2.5 bg-slate-800 hover:bg-slate-750 border border-dashed border-slate-700 rounded-xl cursor-pointer text-xs font-semibold text-slate-300 transition">
                  <Upload className="w-4 h-4 text-indigo-400" /> Upload Local
                  Image
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleCustomImageUpload}
                    className="hidden"
                  />
                </label>
              </div>

              <div>
                <h2 className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-3 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-400" /> Grid
                  Complexity
                </h2>
                <div className="grid grid-cols-2 gap-2">
                  {DIFFICULTY_LEVELS.map(lvl => (
                    <button
                      key={lvl.id}
                      onClick={() => setGridSize(lvl.grid)}
                      className={`py-2.5 px-3 text-xs font-bold rounded-xl border transition ${gridSize === lvl.grid ? "bg-indigo-600 border-indigo-500 text-white shadow-lg" : "bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800"}`}
                    >
                      {lvl.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-slate-800">
              {gameStatus === "lobby" ? (
                <button
                  onClick={startPuzzleRound}
                  disabled={players.length === 0}
                  className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-xl transition flex items-center justify-center gap-2 text-sm uppercase tracking-wide"
                >
                  <Play className="w-5 h-5 fill-current" /> Start Competition
                </button>
              ) : (
                <button
                  onClick={resetGameRound}
                  className="w-full py-4 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl shadow-xl transition flex items-center justify-center gap-2 text-sm uppercase tracking-wide"
                >
                  <RefreshCw className="w-5 h-5" /> Reset & Return to Lobby
                </button>
              )}
            </div>
          </div>

          <div className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col items-center justify-center relative overflow-hidden shadow-xl">
            {gameStatus === "lobby" ? (
              <div className="w-full h-full flex flex-col items-center justify-between py-4">
                <div className="text-center">
                  <span className="text-xs font-mono text-indigo-400 uppercase tracking-widest bg-indigo-950/60 border border-indigo-800/50 px-3 py-1 rounded-full">
                    Step 1: Join Session
                  </span>
                  <h2 className="text-2xl font-black mt-2">
                    Scan QR Code to Enter Lobby
                  </h2>
                </div>

                <div className="bg-white p-6 rounded-3xl shadow-2xl my-4 border-4 border-slate-800">
                  <QRCodeSVG value={joinUrl} size={220} />
                </div>

                <div className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Eye className="w-5 h-5 text-indigo-400" />
                    <div>
                      <div className="text-xs font-bold">
                        Selected Image Target
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {gridSize}x{gridSize} Tiles Grid
                      </div>
                    </div>
                  </div>
                  <img
                    src={selectedImage}
                    alt="Target Preview"
                    className="w-14 h-14 object-cover rounded-xl border border-slate-700"
                  />
                </div>
              </div>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center">
                <span className="text-xs font-mono text-amber-400 uppercase tracking-widest mb-3 bg-amber-950/60 border border-amber-800/50 px-3 py-1 rounded-full">
                  Target Puzzle Reference
                </span>
                <div className="relative w-full max-w-md aspect-square rounded-3xl overflow-hidden border-4 border-slate-800 shadow-2xl">
                  <img
                    src={selectedImage}
                    alt="Puzzle Target"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-3 right-3 bg-slate-950/90 backdrop-blur text-indigo-400 border border-slate-800 px-3 py-1 rounded-xl text-xs font-mono font-bold">
                    {gridSize}x{gridSize}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-3 bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col shadow-xl">
            <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold flex items-center gap-2 text-amber-400 uppercase tracking-wider">
                <Trophy className="w-4 h-4" />{" "}
                {gameStatus === "playing"
                  ? "Live Leaderboard"
                  : "Waiting Lobby"}
              </h2>
              <span className="text-xs font-mono font-bold bg-slate-950 border border-slate-800 px-2.5 py-1 rounded-lg text-indigo-400">
                {players.length} {players.length === 1 ? "Player" : "Players"}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
              {sortedPlayers.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-slate-500 text-xs text-center p-4">
                  <Users className="w-8 h-8 mb-2 opacity-30" />
                  Waiting for participants to scan the QR code...
                </div>
              ) : (
                sortedPlayers.map(p => {
                  const rank = p.completed
                    ? completedPlayers.findIndex(item => item.id === p.id) + 1
                    : null;
                  return (
                    <div
                      key={p.id}
                      className={`flex items-center justify-between p-3 rounded-xl border transition ${p.completed ? "bg-amber-500/10 border-amber-500/30" : "bg-slate-950 border-slate-800"}`}
                    >
                      <div className="flex items-center gap-3">
                        {p.completed ? (
                          <div
                            className={`w-7 h-7 rounded-full font-black text-xs flex items-center justify-center ${rank === 1 ? "bg-amber-400 text-slate-950 shadow-lg" : rank === 2 ? "bg-slate-300 text-slate-950" : rank === 3 ? "bg-amber-700 text-white" : "bg-slate-800 text-slate-300"}`}
                          >
                            #{rank}
                          </div>
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-xs flex items-center justify-center">
                            ✓
                          </div>
                        )}
                        <span className="font-semibold text-sm truncate max-w-[100px]">
                          {p.name}
                        </span>
                      </div>

                      <div>
                        {p.completed ? (
                          <span className="font-mono text-emerald-400 font-bold text-xs flex items-center gap-1 bg-emerald-950/60 border border-emerald-800/50 px-2.5 py-1 rounded-full">
                            <Clock className="w-3 h-3" /> {p.time}s
                          </span>
                        ) : (
                          <span className="text-[10px] text-emerald-400 bg-emerald-950/60 border border-emerald-800/50 px-2.5 py-1 rounded-full font-mono uppercase">
                            {gameStatus === "playing"
                              ? "Solving..."
                              : "In Lobby"}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // MOBILE PARTICIPANT INTERFACE WITH MINI IMAGE REFERENCE
  // =========================================================================
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 max-w-md mx-auto font-sans">
      <header className="flex justify-between items-center py-3 border-b border-slate-800 mb-2">
        <div className="flex items-center gap-2">
          <Smartphone className="w-5 h-5 text-indigo-400" />
          <span className="font-bold text-sm">PhotoPuzzle Live</span>
        </div>
        {gameStatus === "playing" && (
          <div className="font-mono text-emerald-400 font-bold text-base flex items-center gap-1 bg-slate-900 border border-slate-800 px-3 py-1 rounded-full">
            <Clock className="w-4 h-4" /> {elapsedTime}s
          </div>
        )}
      </header>

      {/* Screen 1: Name Entry */}
      {gameStatus === "lobby" && !currentPlayerId && (
        <div className="my-auto bg-slate-900 border border-slate-800 rounded-3xl p-6 text-center shadow-2xl">
          <h2 className="text-2xl font-black mb-1">Join Session Lobby</h2>
          <p className="text-xs text-slate-400 mb-6">
            Enter your name to register on the presenter screen.
          </p>
          <form onSubmit={handlePlayerJoin} className="space-y-3">
            <input
              type="text"
              placeholder="Your Name / Nickname"
              value={playerName}
              onChange={e => setPlayerName(e.target.value)}
              className="w-full px-4 py-4 bg-slate-950 border border-slate-800 rounded-2xl text-center font-bold text-lg focus:outline-none focus:border-indigo-500"
              maxLength={15}
              required
            />
            <button
              type="submit"
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 font-bold rounded-2xl transition shadow-lg text-base"
            >
              Enter Lobby
            </button>
          </form>
        </div>
      )}

      {/* Screen 2: Waiting in Lobby */}
      {gameStatus === "lobby" && currentPlayerId && (
        <div className="my-auto text-center py-12 px-6 bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <h3 className="text-2xl font-black mb-1">You're In, {playerName}!</h3>
          <p className="text-xs text-slate-400 mt-2">
            Look at the presenter screen. The competition will begin shortly.
          </p>
        </div>
      )}

      {/* Screen 3: Interactive Dynamic Grid Slicer with Mini Image Preview */}
      {gameStatus === "playing" && (
        <div className="my-auto flex flex-col items-center w-full space-y-3">
          {/* 👈 MINI TARGET IMAGE REFERENCE CARD FOR MOBILE */}
          {!isCompleted && (
            <div className="w-full max-w-[350px] bg-slate-900 border border-slate-800 rounded-2xl p-2.5 shadow-md flex flex-col transition-all">
              <button
                onClick={() => setShowMobilePreview(!showMobilePreview)}
                className="flex items-center justify-between w-full text-xs font-bold text-slate-300 px-1"
              >
                <span className="flex items-center gap-1.5 text-indigo-400">
                  <Eye className="w-3.5 h-3.5" /> Target Photo Reference
                </span>
                {showMobilePreview ? (
                  <ChevronUp className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                )}
              </button>

              {showMobilePreview && (
                <div className="mt-2 flex items-center gap-3 bg-slate-950 p-2 rounded-xl border border-slate-800">
                  <img
                    src={selectedImage}
                    alt="Target Mini"
                    className="w-16 h-16 object-cover rounded-lg border border-slate-700 shadow-inner"
                  />
                  <div className="text-[11px] text-slate-400">
                    <p className="text-slate-200 font-semibold mb-0.5">
                      Match this image
                    </p>
                    <p>
                      Grid:{" "}
                      <span className="font-mono text-indigo-400 font-bold">
                        {gridSize}x{gridSize}
                      </span>{" "}
                      ({gridSize * gridSize} tiles)
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {isCompleted ? (
            <div className="w-full bg-slate-900 border border-emerald-500/30 rounded-3xl p-6 text-center shadow-2xl">
              <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto mb-3" />
              <h2 className="text-2xl font-black text-white mb-1">
                Puzzle Solved!
              </h2>
              <p className="text-slate-400 text-xs mb-4">
                Your time has been recorded on the presenter leaderboard.
              </p>
              <div className="inline-block bg-slate-950 px-6 py-3 rounded-2xl border border-slate-800 font-mono text-3xl font-black text-emerald-400 shadow-inner">
                {elapsedTime}s
              </div>
            </div>
          ) : (
            <div className="w-full">
              <p className="text-[11px] font-semibold text-center text-slate-400 mb-2">
                Tap two tiles to swap positions
              </p>
              <div
                className="grid gap-1 bg-slate-900 p-2 rounded-2xl border border-slate-800 shadow-2xl w-full aspect-square max-w-[350px] mx-auto"
                style={{
                  gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))`,
                  gridTemplateRows: `repeat(${gridSize}, minmax(0, 1fr))`,
                }}
              >
                {tiles.map((tile, index) => {
                  const correctRow = Math.floor(tile.correctIndex / gridSize);
                  const correctCol = tile.correctIndex % gridSize;
                  const isSelected = selectedTileIndex === index;

                  return (
                    <button
                      key={index}
                      onClick={() => handleTileClick(index)}
                      className={`relative w-full h-full rounded-lg overflow-hidden transition-all duration-150 ${isSelected ? "ring-4 ring-amber-400 scale-95 z-10 shadow-2xl" : "active:scale-95"}`}
                      style={{
                        backgroundImage: `url(${selectedImage})`,
                        backgroundSize: `${gridSize * 100}% ${gridSize * 100}%`,
                        backgroundPosition: `${(correctCol / (gridSize - 1)) * 100}% ${(correctRow / (gridSize - 1)) * 100}%`,
                      }}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <footer className="text-center py-2 text-[10px] text-slate-500 font-mono">
        ENTERPRISE SESSION #{roomId || "---"}
      </footer>
    </div>
  );
}
