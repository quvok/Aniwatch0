const http = require("http");
const { WebSocketServer, WebSocket } = require("ws");

const PORT = Number(process.env.PORT) || 8080;
const MAX_MEMBERS = 8;
const rooms = new Map();
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "").split(",").map(x => x.trim()).filter(Boolean);

const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
    res.end(JSON.stringify({ ok: true, service: "aniwatch-room-server", rooms: rooms.size }));
    return;
  }
  res.writeHead(404, { "content-type": "text/plain" });
  res.end("Not found");
});

const wss = new WebSocketServer({ noServer: true, maxPayload: 8192 });

server.on("upgrade", (req, socket, head) => {
  const origin = req.headers.origin || "";
  if (allowedOrigins.length && !allowedOrigins.includes(origin)) {
    socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, ws => wss.emit("connection", ws, req));
});

function send(ws, payload) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
}
function broadcast(room, payload, except) {
  for (const client of room.clients) if (client !== except) send(client, payload);
}
function cleanRoom(code) {
  const room = rooms.get(code);
  if (room && room.clients.size === 0) rooms.delete(code);
}
function leave(ws) {
  if (!ws.roomCode) return;
  const code = ws.roomCode;
  const room = rooms.get(code);
  ws.roomCode = "";
  if (!room) return;
  room.clients.delete(ws);
  broadcast(room, { type: "presence", members: room.clients.size });
  cleanRoom(code);
}
function fail(ws, message) {
  send(ws, { type: "error", message });
}

wss.on("connection", ws => {
  ws.roomCode = "";
  ws.displayName = "Гость";
  ws.lastChatAt = 0;

  ws.on("message", raw => {
    let data;
    try { data = JSON.parse(raw.toString()); } catch { return fail(ws, "Некорректное сообщение"); }
    if (!data || typeof data.type !== "string") return;

    if (data.type === "join") {
      const code = String(data.room || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
      if (code.length !== 6) return fail(ws, "Код комнаты должен состоять из 6 символов");
      leave(ws);
      let room = rooms.get(code);
      if (!room) {
        room = { clients: new Set(), state: null };
        rooms.set(code, room);
      }
      if (room.clients.size >= MAX_MEMBERS) return fail(ws, "Комната заполнена");
      ws.roomCode = code;
      ws.displayName = String(data.name || "Гость").replace(/[<>\r\n]/g, "").slice(0, 20) || "Гость";
      room.clients.add(ws);
      send(ws, { type: "joined", room: code, members: room.clients.size, state: room.state });
      broadcast(room, { type: "presence", members: room.clients.size }, ws);
      return;
    }

    const code = ws.roomCode;
    const room = code && rooms.get(code);
    if (!room) return fail(ws, "Сначала войдите в комнату");

    if (data.type === "chat") {
      const now = Date.now();
      if (now - ws.lastChatAt < 350) return;
      ws.lastChatAt = now;
      const text = String(data.text || "").trim().slice(0, 500);
      if (!text) return;
      broadcast(room, { type: "chat", name: ws.displayName, text, at: now });
      send(ws, { type: "chat", name: ws.displayName, text, at: now });
      return;
    }

    if (data.type === "sync") {
      const s = data.state || {};
      const animeId = Number(s.animeId);
      const episode = Number(s.episode);
      const time = Number(s.time);
      if (!Number.isSafeInteger(animeId) || animeId <= 0 || !Number.isSafeInteger(episode) || episode < 1) return;
      room.state = {
        animeId,
        episode,
        time: Number.isFinite(time) ? Math.max(0, Math.min(86400, time)) : 0,
        playing: !!s.playing
      };
      broadcast(room, { type: "sync", state: room.state }, ws);
      return;
    }

    if (data.type === "leave") leave(ws);
  });

  ws.on("close", () => leave(ws));
  ws.on("error", () => leave(ws));
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("AniWatch room server listening on " + PORT);
});
