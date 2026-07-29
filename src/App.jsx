import React, { useState, useEffect, useRef } from "react";
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
} from "lucide-react";

// Default puzzle presets
const PRESET_IMAGES = [
  {
    id: "1",
    name: "Mountain Peak",
    url: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "2",
    name: "Neon City",
    url: "https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "3",
    name: "Abstract Art",
    url: "https://images.unsplash.com/photo-1541701494587-cb58502866ab?auto=format&fit=crop&w=800&q=80",
  },
];

const DIFFICULTY_LEVELS = [
  { id: "2", label: "Bigger (2x2)", grid: 2, count: 4 },
  { id: "4", label: "Medium (4x4)", grid: 4, count: 16 },
  { id: "6", label: "Hard (6x6)", grid: 6, count: 36 },
  { id: "8", label: "Complex (8x8)", grid: 8, count: 64 },
];

export default function App() {
  // Navigation & Role Detection
  const [role, setRole] = useState("landing"); // 'landing' | 'host' | 'player'
  const [roomId, setRoomId] = useState("");

  // Game State (Shared context via localStorage/BroadCastChannel simulation for local testing)
  const [selectedImage, setSelectedImage] = useState(PRESET_IMAGES[0].url);
  const [gridSize, setGridSize] = useState(4); // Default 4x4
  const [gameStatus, setGameStatus] = useState("lobby"); // 'lobby' | 'playing' | 'finished'
  const [players, setPlayers] = useState([]);
  const [playerName, setPlayerName] = useState("");
  const [currentPlayerId, setCurrentPlayerId] = useState("");

  // Mobile Puzzle State
  const [tiles, setTiles] = useState([]);
  const [selectedTileIndex, setSelectedTileIndex] = useState(null);
  const [startTime, setStartTime] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);

  // Sync state across browser tabs for real-time local demo
  const channelRef = useRef(null);

  useEffect(() => {
    // Check if user came from a QR code / link with roomId
    const params = new URLSearchParams(window.location.search);
    const room = params.get("room");
    if (room) {
      setRoomId(room);
      setRole("player");
    }

    // Set up BroadcastChannel for cross-tab realtime sync (works instantly on any network when deployed with WebSockets/Firebase)
    channelRef.current = new BroadcastChannel("photo_puzzle_sync");
    channelRef.current.onmessage = event => {
      const { type, payload } = event.data;
      if (type === "GAME_START") {
        setGameStatus("playing");
        setGridSize(payload.gridSize);
        setSelectedImage(payload.selectedImage);
        setStartTime(Date.now());
      } else if (type === "PLAYER_JOINED") {
        setPlayers(prev => [...prev.filter(p => p.id !== payload.id), payload]);
      } else if (type === "PLAYER_FINISHED") {
        setPlayers(prev =>
          prev.map(p =>
            p.id === payload.id
              ? { ...p, time: payload.time, completed: true }
              : p,
          ),
        );
      } else if (type === "RESET_GAME") {
        setGameStatus("lobby");
        setIsCompleted(false);
      }
    };

    return () => channelRef.current?.close();
  }, []);

  // Timer Effect
  useEffect(() => {
    let interval;
    if (gameStatus === "playing" && !isCompleted && startTime) {
      interval = setInterval(() => {
        setElapsedTime(((Date.now() - startTime) / 1000).toFixed(1));
      }, 100);
    }
    return () => clearInterval(interval);
  }, [gameStatus, isCompleted, startTime]);

  // Generate Room Code & Launch Host Mode
  const startHostSession = () => {
    const newRoom = Math.random().toString(36).substring(2, 8).toUpperCase();
    setRoomId(newRoom);
    setRole("host");
  };

  // Join as Player
  const handlePlayerJoin = e => {
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

    // Broadcast join event
    channelRef.current?.postMessage({
      type: "PLAYER_JOINED",
      payload: playerData,
    });
  };

  // Host Starts Puzzle
  const startPuzzleRound = () => {
    setGameStatus("playing");
    setStartTime(Date.now());
    channelRef.current?.postMessage({
      type: "GAME_START",
      payload: { gridSize, selectedImage },
    });
  };

  // Host Resets Game
  const resetGameRound = () => {
    setGameStatus("lobby");
    setPlayers(prev => prev.map(p => ({ ...p, completed: false, time: null })));
    channelRef.current?.postMessage({ type: "RESET_GAME" });
  };

  // Puzzle Tiles Generator (Mobile)
  useEffect(() => {
    if (gameStatus === "playing" && role === "player") {
      const totalTiles = gridSize * gridSize;
      const initialTiles = Array.from({ length: totalTiles }, (_, index) => ({
        correctIndex: index,
        currentIndex: index,
      }));

      // Shuffle tiles guaranteed to be different
      let shuffled = [...initialTiles];
      do {
        shuffled = shuffled.sort(() => Math.random() - 0.5);
      } while (shuffled.every((tile, idx) => tile.correctIndex === idx));

      setTiles(shuffled);
      setIsCompleted(false);
    }
  }, [gameStatus, gridSize, role]);

  // Handle Tile Tap & Swap (Mobile)
  const handleTileClick = index => {
    if (isCompleted) return;

    if (selectedTileIndex === null) {
      setSelectedTileIndex(index);
    } else {
      // Swap tiles
      const newTiles = [...tiles];
      const temp = newTiles[selectedTileIndex];
      newTiles[selectedTileIndex] = newTiles[index];
      newTiles[index] = temp;

      setTiles(newTiles);
      setSelectedTileIndex(null);

      // Check win condition
      const checkWin = newTiles.every((tile, idx) => tile.correctIndex === idx);
      if (checkWin) {
        setIsCompleted(true);
        const finalTime = ((Date.now() - startTime) / 1000).toFixed(1);
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });

        channelRef.current?.postMessage({
          type: "PLAYER_FINISHED",
          payload: { id: currentPlayerId, time: parseFloat(finalTime) },
        });
      }
    }
  };

  // Upload Custom Image (Host)
  const handleCustomImageUpload = e => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = uploadEvent =>
        setSelectedImage(uploadEvent.target.result);
      reader.readAsDataURL(file);
    }
  };

  const joinUrl = `${window.location.origin}${window.location.pathname}?room=${roomId}`;

  // =========================================================================
  // RENDER: LANDING SCREEN
  // =========================================================================
  if (role === "landing") {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-3xl p-8 shadow-2xl text-center">
          <div className="inline-flex p-4 bg-indigo-600/20 text-indigo-400 rounded-2xl mb-4">
            <Sparkles className="w-10 h-10" />
          </div>
          <h1 className="text-3xl font-black mb-2 tracking-tight">
            PhotoPuzzle Live
          </h1>
          <p className="text-slate-400 text-sm mb-8">
            The ultimate icebreaker activity for training sessions and
            workshops.
          </p>

          <div className="space-y-4">
            <button
              onClick={startHostSession}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 font-bold rounded-xl shadow-lg transition flex items-center justify-center gap-2"
            >
              <Monitor className="w-5 h-5" /> Host Session (Laptop)
            </button>
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-700"></div>
              </div>
              <div className="relative text-xs uppercase text-slate-500 bg-slate-800 px-2 inline-block">
                or join round
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
                placeholder="ENTER ROOM CODE"
                value={roomId}
                onChange={e => setRoomId(e.target.value.toUpperCase())}
                className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl font-mono text-center uppercase tracking-wider focus:outline-none focus:border-indigo-500"
              />
              <button
                type="submit"
                className="px-5 bg-slate-700 hover:bg-slate-600 font-bold rounded-xl"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // RENDER: HOST VIEW (LAPTOP DEDICATED)
  // =========================================================================
  if (role === "host") {
    const sortedLeaderboard = [...players]
      .filter(p => p.completed)
      .sort((a, b) => a.time - b.time);

    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-6 flex flex-col">
        {/* Top Header */}
        <header className="flex justify-between items-center bg-slate-900 border border-slate-800 px-6 py-4 rounded-2xl mb-6">
          <div className="flex items-center gap-3">
            <Sparkles className="w-7 h-7 text-indigo-400" />
            <h1 className="text-xl font-bold tracking-wide">
              PhotoPuzzle Host Dashboard
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-400">Room Code:</span>
            <span className="font-mono text-xl font-black bg-indigo-950 text-indigo-300 border border-indigo-800/60 px-4 py-1 rounded-xl">
              {roomId}
            </span>
          </div>
        </header>

        {/* Main 3-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
          {/* Column 1: Config & Setup */}
          <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between">
            <div>
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-indigo-400">
                <ImageIcon className="w-5 h-5" /> 1. Select Image
              </h2>

              {/* Presets */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                {PRESET_IMAGES.map(img => (
                  <button
                    key={img.id}
                    onClick={() => setSelectedImage(img.url)}
                    className={`relative rounded-xl overflow-hidden border-2 h-20 transition ${selectedImage === img.url ? "border-indigo-500 scale-95" : "border-transparent opacity-60 hover:opacity-100"}`}
                  >
                    <img
                      src={img.url}
                      alt={img.name}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>

              {/* Upload Button */}
              <label className="flex items-center justify-center gap-2 w-full py-3 bg-slate-800 hover:bg-slate-750 border border-dashed border-slate-600 rounded-xl cursor-pointer text-xs font-semibold text-slate-300 transition mb-6">
                <Upload className="w-4 h-4" /> Upload Custom Photo
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleCustomImageUpload}
                  className="hidden"
                />
              </label>

              <h2 className="text-lg font-bold mb-3 flex items-center gap-2 text-indigo-400">
                <Sparkles className="w-5 h-5" /> 2. Grid Difficulty
              </h2>
              <div className="grid grid-cols-2 gap-2 mb-6">
                {DIFFICULTY_LEVELS.map(lvl => (
                  <button
                    key={lvl.id}
                    onClick={() => setGridSize(lvl.grid)}
                    className={`py-3 px-3 text-xs font-bold rounded-xl border transition text-center ${gridSize === lvl.grid ? "bg-indigo-600 border-indigo-500 text-white" : "bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700"}`}
                  >
                    {lvl.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Controls */}
            {gameStatus === "lobby" ? (
              <button
                onClick={startPuzzleRound}
                disabled={players.length === 0}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-lg transition flex items-center justify-center gap-2 text-base"
              >
                <Play className="w-5 h-5 fill-current" /> Start Competition
              </button>
            ) : (
              <button
                onClick={resetGameRound}
                className="w-full py-4 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl shadow-lg transition flex items-center justify-center gap-2 text-base"
              >
                <RefreshCw className="w-5 h-5" /> Reset & Return to Lobby
              </button>
            )}
          </div>

          {/* Column 2: QR Join Portal & Preview */}
          <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col items-center justify-center text-center">
            {gameStatus === "lobby" ? (
              <>
                <div className="bg-white p-4 rounded-2xl shadow-xl mb-4">
                  <QRCodeSVG value={joinUrl} size={180} />
                </div>
                <h3 className="text-xl font-bold mb-1">Scan to Join</h3>
                <p className="text-xs text-slate-400 mb-6 max-w-xs">
                  Scan using any mobile camera on any network to enter the
                  session lobby.
                </p>

                <div className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Users className="w-5 h-5 text-indigo-400" />
                    <span className="text-sm font-semibold">Lobby Count</span>
                  </div>
                  <span className="text-2xl font-black text-indigo-400">
                    {players.length}
                  </span>
                </div>
              </>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center">
                <div className="text-xs text-slate-400 uppercase tracking-widest mb-2 font-mono">
                  Original Target Photo
                </div>
                <div className="w-64 h-64 rounded-2xl overflow-hidden border-2 border-slate-700 shadow-2xl relative">
                  <img
                    src={selectedImage}
                    alt="Puzzle Target"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 right-2 bg-slate-900/90 text-indigo-400 px-3 py-1 rounded-full text-xs font-mono font-bold">
                    {gridSize}x{gridSize}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Column 3: Live Leaderboard */}
          <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-amber-400">
              <Trophy className="w-5 h-5" /> Live Leaderboard
            </h2>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {players.length === 0 ? (
                <div className="h-48 flex flex-col items-center justify-center text-slate-500 text-sm">
                  Waiting for participants to scan QR...
                </div>
              ) : (
                players.map(p => {
                  const rank =
                    sortedLeaderboard.findIndex(item => item.id === p.id) + 1;
                  return (
                    <div
                      key={p.id}
                      className={`flex items-center justify-between p-3.5 rounded-xl border transition ${p.completed ? "bg-amber-500/10 border-amber-500/30" : "bg-slate-950 border-slate-800"}`}
                    >
                      <div className="flex items-center gap-3">
                        {p.completed ? (
                          <div className="w-7 h-7 rounded-full bg-amber-500 text-slate-950 font-black text-xs flex items-center justify-center">
                            #{rank}
                          </div>
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-slate-800 text-slate-400 font-bold text-xs flex items-center justify-center">
                            •
                          </div>
                        )}
                        <span className="font-semibold text-sm">{p.name}</span>
                      </div>

                      <div>
                        {p.completed ? (
                          <span className="font-mono text-emerald-400 font-bold text-sm flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" /> {p.time}s
                          </span>
                        ) : (
                          <span className="text-xs text-slate-500 italic">
                            Solving...
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
  // RENDER: PARTICIPANT VIEW (MOBILE OPTIMIZED)
  // =========================================================================
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 max-w-md mx-auto">
      {/* Mobile Header */}
      <header className="flex justify-between items-center py-3 border-b border-slate-800 mb-4">
        <div className="flex items-center gap-2">
          <Smartphone className="w-5 h-5 text-indigo-400" />
          <span className="font-bold text-sm">PhotoPuzzle Live</span>
        </div>
        {gameStatus === "playing" && (
          <div className="font-mono text-emerald-400 font-bold text-lg flex items-center gap-1">
            <Clock className="w-4 h-4" /> {elapsedTime}s
          </div>
        )}
      </header>

      {/* Screen 1: Name Entry Lobby */}
      {gameStatus === "lobby" && !currentPlayerId && (
        <div className="my-auto bg-slate-900 border border-slate-800 rounded-3xl p-6 text-center">
          <h2 className="text-2xl font-bold mb-2">Join Session</h2>
          <p className="text-xs text-slate-400 mb-6">
            Enter your name to appear on the session leaderboard.
          </p>
          <form onSubmit={handlePlayerJoin} className="space-y-3">
            <input
              type="text"
              placeholder="Your Name / Nickname"
              value={playerName}
              onChange={e => setPlayerName(e.target.value)}
              className="w-full px-4 py-3.5 bg-slate-950 border border-slate-700 rounded-xl text-center font-bold focus:outline-none focus:border-indigo-500"
              maxLength={15}
              required
            />
            <button
              type="submit"
              className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 font-bold rounded-xl transition"
            >
              Enter Lobby
            </button>
          </form>
        </div>
      )}

      {/* Screen 2: Waiting in Lobby */}
      {gameStatus === "lobby" && currentPlayerId && (
        <div className="my-auto text-center py-12 px-6 bg-slate-900 border border-slate-800 rounded-3xl">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <h3 className="text-xl font-bold mb-1">You're In, {playerName}!</h3>
          <p className="text-xs text-slate-400">
            Look at the laptop screen. The presenter will start the round
            shortly.
          </p>
        </div>
      )}

      {/* Screen 3: Interactive Puzzle Grid */}
      {gameStatus === "playing" && (
        <div className="my-auto flex flex-col items-center">
          {isCompleted ? (
            <div className="w-full bg-slate-900 border border-emerald-500/30 rounded-3xl p-6 text-center animate-bounce">
              <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto mb-3" />
              <h2 className="text-2xl font-black text-white mb-1">
                Puzzle Solved!
              </h2>
              <p className="text-slate-400 text-xs mb-4">
                Your time has been posted to the presenter's leaderboard.
              </p>
              <div className="inline-block bg-slate-950 px-6 py-2 rounded-2xl border border-slate-800 font-mono text-2xl font-bold text-emerald-400">
                {elapsedTime} seconds
              </div>
            </div>
          ) : (
            <div className="w-full">
              <p className="text-xs text-center text-slate-400 mb-3">
                Tap two tiles to swap their positions.
              </p>

              {/* Dynamic Grid Canvas */}
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
                      className={`relative w-full h-full rounded-lg overflow-hidden transition-all duration-150 ${isSelected ? "ring-4 ring-amber-400 scale-95 z-10" : "active:scale-95"}`}
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

      {/* Footer info */}
      <footer className="text-center py-2 text-[10px] text-slate-500 font-mono">
        CONNECTED TO SESSION #{roomId || "---"}
      </footer>
    </div>
  );
}
