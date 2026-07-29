import Pusher from "pusher";

// Initialize Pusher Server with your credentials
const pusher = new Pusher({
  appId: "2181214",
  key: "e73ccec76d7cca0328b8",
  secret: "6a51b4dfcaeee49a94aa",
  cluster: "ap2",
  useTLS: true,
});

export default async function handler(req, res) {
  // Enable CORS so mobile web can access it
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { room, event, data } = req.body;

    // Broadcast message via Pusher Server API
    await pusher.trigger(`room-${room}`, event, data);

    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
