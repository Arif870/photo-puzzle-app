import fs from "fs";
import path from "path";

export default async function handler(req, res) {
  // Allow CORS (mobile web clients)
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
    const { dataUrl, filename } = req.body || {};
    if (!dataUrl || typeof dataUrl !== "string") {
      return res.status(400).json({ error: "Missing dataUrl" });
    }

    const matches = dataUrl.match(/^data:(image\/(png|jpeg|jpg|webp));base64,(.+)$/);
    if (!matches) {
      return res.status(400).json({ error: "Invalid data URL" });
    }

    const mime = matches[1];
    const ext = matches[2] === "jpeg" || matches[2] === "jpg" ? "jpg" : matches[2];
    const base64Data = matches[3];

    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const safeName = filename ? filename.replace(/[^a-z0-9.-_]/gi, "_") : "image";
    const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}.${ext}`;
    const filePath = path.join(uploadsDir, uniqueName);

    const buffer = Buffer.from(base64Data, "base64");
    fs.writeFileSync(filePath, buffer);

    // Return public path; client will prepend origin
    return res.status(200).json({ path: `/uploads/${uniqueName}` });
  } catch (error) {
    console.error("/api/upload error:", error);
    return res.status(500).json({ error: error.message });
  }
}
