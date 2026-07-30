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
  Maximize2,
  Minimize2,
  Loader2,
} from "lucide-react";

const INITIAL_PRESET_IMAGES = [
  {
    id: "1",
    name: "Mountain Peak",
    url: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1000&q=70",
  },
  {
    id: "2",
    name: "Neon City",
    url: "https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=1000&q=70",
  },
  {
    id: "3",
    name: "Abstract Art",
    url: "https://images.unsplash.com/photo-1541701494587-cb58502866ab?auto=format&fit=crop&w=1000&q=70",
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

  const [presetImages, setPresetImages] = useState(INITIAL_PRESET_IMAGES);
  const [selectedImage, setSelectedImage] = useState(
    INITIAL_PRESET_IMAGES[0].url,
  );
  const [sharedImage, setSharedImage] = useState(INITIAL_PRESET_IMAGES[0].url);
  const [gridSize, setGridSize] = useState(2);
  const [gameStatus, setGameStatus] = useState("lobby");
  const [players, setPlayers] = useState([]);
  const [playerName, setPlayerName] = useState("");
  const [currentPlayerId, setCurrentPlayerId] = useState("");

  const [tiles, setTiles] = useState([]);
  const [selectedTileIndex, setSelectedTileIndex] = useState(null);
  const [startTime, setStartTime] = useState(null);
  const [elapsedTime, setElapsedTime] = useState("0.0");
  const [finalSolveTime, setFinalSolveTime] = useState(null);
  const [isCompleted, setIsCompleted] = useState(false);

  // New state for Mobile Data Chunking (Loading screen)
  const [isLoadingGame, setIsLoadingGame] = useState(false);
  const chunkBufferRef = useRef({});

  // Explicit modal mode: 'qr' | 'image' | null
  const [modalType, setModalType] = useState(null);

  // Track natural image dimensions to preserve aspect ratio
  const [imageSize, setImageSize] = useState({ width: 1, height: 1 });

  useEffect(() => {
    if (!selectedImage) return;
    const img = new Image();
    img.src = selectedImage;
    img.onload = () => {
      setImageSize({ width: img.width || 1, height: img.height || 1 });
    };
    img.onerror = () => setImageSize({ width: 1, height: 1 });
  }, [selectedImage]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const room = params.get("room");
    if (room) {
      setRoomId(room);
      setRole("player");
    }
  }, []);

  // Configure Pusher Real-Time Events
  useEffect(() => {
    if (!roomId) return;

    const pusher = new Pusher(PUSHER_KEY, { cluster: PUSHER_CLUSTER });
    const channel = pusher.subscribe(`room-${roomId}`);

    channel.bind("PLAYER_JOINED", data => {
      setPlayers(prev => [...prev.filter(p => p.id !== data.id), data]);
    });

    // 1. Listen for prep signal (Triggers loading screen)
    channel.bind("PREPARE_GAME", () => {
      setIsLoadingGame(true);
      chunkBufferRef.current = {};
    });

    // 2. Reassemble image chunks bypasses the 10KB limit
    channel.bind("IMAGE_CHUNK", data => {
      chunkBufferRef.current[data.chunkIndex] = data.data;
      if (Object.keys(chunkBufferRef.current).length === data.totalChunks) {
        let fullImageStr = "";
        for (let i = 0; i < data.totalChunks; i++) {
          fullImageStr += chunkBufferRef.current[i];
        }
        setSelectedImage(fullImageStr);
      }
    });

    // 3. Start game once host fires the final start signal
    channel.bind("GAME_START", data => {
      setGameStatus("playing");
      setGridSize(data.gridSize);

      if (data.imageUrl) {
        // If it was a default URL, just use it
        setSelectedImage(data.imageUrl);
      }

      setStartTime(data.startTime);
      setModalType(null);
      setIsCompleted(false);
      setFinalSolveTime(null);
      setIsLoadingGame(false); // Remove loading screen
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
      setFinalSolveTime(null);
      setIsLoadingGame(false);
    });

    return () => pusher.unsubscribe(`room-${roomId}`);
  }, [roomId]);

  // Millisecond-accurate stopwatch
  useEffect(() => {
    let interval;
    if (gameStatus === "playing" && !isCompleted && startTime) {
      interval = setInterval(() => {
        const now = Date.now();
        setElapsedTime(((now - startTime) / 1000).toFixed(1));
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

  // Enterprise Chunking Transmission Function
  const startPuzzleRound = async () => {
    // If it's a default web image (Starts with HTTP)
    if (sharedImage.startsWith("http")) {
      const roundStart = Date.now();
      setGameStatus("playing");
      setStartTime(roundStart);
      await sendRoomEvent(roomId, "GAME_START", {
        gridSize,
        startTime: roundStart,
        imageUrl: sharedImage,
      });
    }
    // If it's a custom Base64 Upload -> Chunk it
    else {
      // Show loading spinner on mobiles
      await sendRoomEvent(roomId, "PREPARE_GAME", {});

      const CHUNK_SIZE = 7000; // 7KB limit easily bypasses Pusher's 10KB cap
      const totalChunks = Math.ceil(sharedImage.length / CHUNK_SIZE);

      // Fire chunks rapidly
      for (let i = 0; i < totalChunks; i++) {
        const chunkData = sharedImage.substring(
          i * CHUNK_SIZE,
          (i + 1) * CHUNK_SIZE,
        );
        await sendRoomEvent(roomId, "IMAGE_CHUNK", {
          chunkIndex: i,
          totalChunks: totalChunks,
          data: chunkData,
        });
        // Tiny 40ms delay to prevent network flood
        await new Promise(r => setTimeout(r, 40));
      }

      // After chunks are dispatched, start the timer
      const roundStart = Date.now();
      setGameStatus("playing");
      setStartTime(roundStart);
      await sendRoomEvent(roomId, "GAME_START", {
        gridSize,
        startTime: roundStart,
      });
    }
  };

  const resetGameRound = async () => {
    setGameStatus("lobby");
    setPlayers(prev => prev.map(p => ({ ...p, completed: false, time: null })));
    await sendRoomEvent(roomId, "RESET_GAME", {});
  };

  useEffect(() => {
    if (gameStatus === "playing" && role === "player" && !isLoadingGame) {
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
  }, [gameStatus, gridSize, role, isLoadingGame]);

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
        const finishTimestamp = Date.now();
        const exactTime = parseFloat(
          ((finishTimestamp - startTime) / 1000).toFixed(1),
        );

        setIsCompleted(true);
        setFinalSolveTime(exactTime);
        confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });

        await sendRoomEvent(roomId, "PLAYER_FINISHED", {
          id: currentPlayerId,
          time: exactTime,
        });
      }
    }
  };

  // High-Efficiency Dual Compressor
  const handleCustomImageUpload = e => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = uploadEvent => {
        const img = new Image();
        img.src = uploadEvent.target.result;
        img.onload = () => {
          const resizeToDataUrl = (maxDim, quality) => {
            const canvas = document.createElement("canvas");
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
            return canvas.toDataURL("image/jpeg", quality);
          };

          // High Resolution for Host display (1000px max)
          const highResUrl = resizeToDataUrl(1000, 0.85);

          // Network Optimized Resolution for Mobile pushing (Max 600px, 0.6 quality = ~50KB)
          const mobilePusherUrl = resizeToDataUrl(600, 0.6);

          const newCustomImage = {
            id: "custom_" + Date.now(),
            name: file.name || "Uploaded Photo",
            url: highResUrl,
            sharedUrl: mobilePusherUrl,
          };

          setPresetImages(prev => [...prev, newCustomImage]);
          setSelectedImage(highResUrl);
          setSharedImage(mobilePusherUrl);
          setModalType("image"); // Auto preview on host screen
        };
      };
      reader.readAsDataURL(file);
    }
  };

  const joinUrl = `${window.location.origin}${window.location.pathname}?room=${roomId}`;

  // =========================================================================
  // LANDING PAGE
  // =========================================================================
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

  // =========================================================================
  // HOST PRESENTER DASHBOARD
  // =========================================================================
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
        {/* Modal Overlay */}
        {modalType && (
          <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex flex-col items-center justify-center p-6">
            <button
              onClick={() => setModalType(null)}
              className="absolute top-6 right-6 p-3 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl flex items-center gap-2 font-bold transition shadow-xl"
            >
              <Minimize2 className="w-6 h-6" /> Exit Fullscreen Mode
            </button>

            {modalType === "qr" ? (
              <div className="flex flex-col items-center justify-center text-center">
                <h2 className="text-3xl font-black text-white mb-2">
                  Scan QR Code to Join Session
                </h2>
                <p className="text-slate-400 text-base mb-8">
                  Room Code:{" "}
                  <span className="font-mono text-indigo-400 font-bold">
                    {roomId}
                  </span>
                </p>
                <div className="bg-white p-8 rounded-3xl shadow-2xl border-8 border-slate-800">
                  <QRCodeSVG value={joinUrl} size={380} />
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center max-w-5xl w-full">
                <div className="w-full max-h-[80vh] min-h-[40vh] rounded-3xl overflow-hidden border-4 border-slate-800 shadow-2xl">
                  <img
                    src={selectedImage}
                    alt="Target Fullscreen"
                    className="w-full h-full object-contain bg-slate-950"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Top Header */}
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
          {/* Sidebar Controls */}
          <div className="lg:col-span-3 bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between shadow-xl">
            <div className="space-y-6">
              <div>
                <h2 className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-3 flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-indigo-400" /> Image
                  Selection
                </h2>

                <div className="grid grid-cols-3 gap-2 mb-3 max-h-48 overflow-y-auto pr-1">
                  {presetImages.map(img => (
                    <button
                      key={img.id}
                      onClick={() => {
                        setSelectedImage(img.url);
                        setSharedImage(img.sharedUrl || img.url);
                        setModalType("image");
                      }}
                      className={`relative rounded-lg overflow-hidden border-2 h-16 transition ${selectedImage === img.url ? "border-indigo-500 ring-2 ring-indigo-500/20" : "border-transparent opacity-50 hover:opacity-100"}`}
                      title="Click to select & preview full screen"
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

          {/* Center Projection Screen */}
          <div className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col items-center justify-center relative overflow-hidden shadow-xl">
            <button
              onClick={() =>
                setModalType(gameStatus === "lobby" ? "qr" : "image")
              }
              className="absolute top-4 right-4 p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl flex items-center gap-1.5 text-xs font-bold border border-slate-700 transition shadow-md z-10"
            >
              <Maximize2 className="w-4 h-4 text-indigo-400" /> Fullscreen Mode
            </button>

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

                <div
                  onClick={() => setModalType("qr")}
                  className="bg-white p-6 rounded-3xl shadow-2xl my-4 border-4 border-slate-800 cursor-pointer hover:scale-105 transition-transform"
                  title="Click to view QR code full screen"
                >
                  <QRCodeSVG value={joinUrl} size={220} />
                </div>

                <div className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300">
                    Selected Target Image
                  </span>
                  <img
                    src={selectedImage}
                    alt="Target Preview"
                    onClick={() => setModalType("image")}
                    className="w-14 h-14 object-cover rounded-xl border border-slate-700 cursor-pointer hover:scale-110 transition-transform"
                    title="Click to view Image full screen"
                  />
                </div>
              </div>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center">
                <div
                  onClick={() => setModalType("image")}
                  className="relative w-full max-w-md rounded-3xl overflow-hidden border-4 border-slate-800 shadow-2xl cursor-pointer hover:scale-[1.02] transition-transform"
                  style={{
                    paddingTop: `${(imageSize.height / imageSize.width) * 100}%`,
                  }}
                >
                  <div className="absolute inset-0">
                    <img
                      src={selectedImage}
                      alt="Puzzle Target"
                      className="absolute inset-0 w-full h-full object-contain"
                    />
                    <div className="absolute top-3 left-3 bg-slate-950/90 backdrop-blur text-indigo-400 border border-slate-800 px-3 py-1 rounded-xl text-xs font-mono font-bold">
                      {gridSize}x{gridSize}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Leaderboard Column */}
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
                  Waiting for participants...
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
  // MOBILE PARTICIPANT INTERFACE
  // =========================================================================
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 max-w-md mx-auto font-sans">
      <header className="flex justify-center items-center py-2 mb-2">
        {gameStatus === "playing" && !isLoadingGame && (
          <div className="font-mono text-emerald-400 font-black text-2xl flex items-center gap-2 bg-slate-900 border border-slate-800 px-6 py-2 rounded-2xl shadow-xl">
            <Clock className="w-5 h-5" />{" "}
            {isCompleted ? `${finalSolveTime}s` : `${elapsedTime}s`}
          </div>
        )}
      </header>

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

      {gameStatus === "lobby" && currentPlayerId && (
        <div className="my-auto text-center py-12 px-6 bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <h3 className="text-2xl font-black mb-1">You're In, {playerName}!</h3>
          <p className="text-xs text-slate-400 mt-2">
            Look at the presenter screen. The competition will begin shortly.
          </p>
        </div>
      )}

      {/* NEW LOADING SCREEN FOR CHUNKING */}
      {isLoadingGame && (
        <div className="my-auto text-center py-12 px-6 bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl">
          <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mx-auto mb-4" />
          <h3 className="text-2xl font-black mb-1 text-white">
            Preparing Puzzle...
          </h3>
          <p className="text-xs text-slate-400 mt-2 font-mono uppercase tracking-wider">
            Downloading Image Assets
          </p>
        </div>
      )}

      {gameStatus === "playing" && !isLoadingGame && (
        <div className="my-auto flex flex-col items-center w-full space-y-4">
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
                {finalSolveTime}s
              </div>
            </div>
          ) : (
            <div className="w-full space-y-4">
              <div
                className="relative w-full max-w-[350px] mx-auto"
                style={{
                  paddingTop: `${(imageSize.height / imageSize.width) * 100}%`,
                }}
              >
                <div
                  className="absolute inset-0 grid gap-1 bg-slate-900 p-2 rounded-2xl border border-slate-800 shadow-2xl"
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

              <div className="w-full max-w-[350px] mx-auto bg-slate-900 border border-slate-800 rounded-2xl p-2 shadow-xl flex items-center justify-center">
                <div className="w-full rounded-xl overflow-hidden border border-slate-800 shadow-inner">
                  <div
                    style={{
                      width: "100%",
                      paddingTop: `${(imageSize.height / imageSize.width) * 100}%`,
                      position: "relative",
                    }}
                  >
                    <img
                      src={selectedImage}
                      alt="Target Reference"
                      className="absolute inset-0 w-full h-full object-contain"
                      style={{ position: "absolute", top: 0, left: 0 }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <footer className="text-center py-2 text-[10px] text-slate-500 font-mono">
        CONNECTED TO SESSION #{roomId || "---"}
      </footer>
    </div>
  );
}
