const fs = require("fs");
const path = require("path");
const express = require("express");
const QRCode = require("qrcode");
const baileys = require("@whiskeysockets/baileys");
const { useMultiFileAuthState, DisconnectReason, downloadMediaMessage } = baileys;
const makeWASocket = baileys.default || baileys.makeWASocket;

const PORT = process.env.PORT || 3001;
const DJANGO = process.env.DJANGO_URL || "http://127.0.0.1:8000";
const SESSIONS = path.join(__dirname, "sessions");
const sessions = {};
const starts = {};
const seen = new Set();

async function resolveImageMedia(item) {
  if (!item) return null;
  const rawUrl = typeof item === "string" ? item : (item.url || item.image || "");
  const caption = (typeof item === "object" && item.caption) ? String(item.caption) : "";
  if (!rawUrl) return null;

  if (rawUrl.startsWith("/media/")) {
    const localPath = path.join(__dirname, "..", "backend", rawUrl);
    if (fs.existsSync(localPath)) {
      return { image: fs.readFileSync(localPath), caption };
    }
    try {
      const resp = await fetch(`${DJANGO}${rawUrl}`);
      if (resp.ok) {
        const buf = Buffer.from(await resp.arrayBuffer());
        return { image: buf, caption };
      }
    } catch (e) {}
  }

  if (rawUrl.startsWith("http://") || rawUrl.startsWith("https://")) {
    try {
      const resp = await fetch(rawUrl);
      if (resp.ok) {
        const buf = Buffer.from(await resp.arrayBuffer());
        return { image: buf, caption };
      }
    } catch (e) {}
    return { image: { url: rawUrl }, caption };
  }

  if (fs.existsSync(rawUrl)) {
    return { image: fs.readFileSync(rawUrl), caption };
  }

  return null;
}

async function sendMediaMessage(sock, jid, item) {
  const mediaObj = await resolveImageMedia(item);
  if (!mediaObj) return false;
  await sock.sendMessage(jid, mediaObj);
  return true;
}

async function _start(tid) {
  const dir = path.join(SESSIONS, tid);
  fs.mkdirSync(dir, { recursive: true });
  const { state, saveCreds } = await useMultiFileAuthState(dir);
  const sock = makeWASocket({ auth: state, printQRInTerminal: false });
  const s = (sessions[tid] = { sock, status: "CONNECTING", qr: null });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", ({ connection, qr, lastDisconnect }) => {
    if (qr) {
      s.qr = qr;
      s.status = "QR_READY";
    }
    if (connection === "open") {
      s.qr = null;
      s.status = "CONNECTED";
    }
    if (connection === "close") {
      const loggedOut =
        lastDisconnect?.error?.output?.statusCode === DisconnectReason.loggedOut;
      delete sessions[tid];
      if (!loggedOut) setTimeout(() => startSession(tid).catch(() => {}), 2000);
    }
  });

  sock.ev.on("messages.upsert", async ({ messages }) => {
    for (const m of messages) {
      if (!m.message || m.key.fromMe || !m.key.remoteJid) continue;
      if (m.key.remoteJid.endsWith("@g.us") || seen.has(m.key.id)) continue;
      seen.add(m.key.id);
      if (seen.size > 2000) seen.clear();

      // Normalize JID (removes companion device suffixes like :1 or :2 that cause sending failures)
      const rawJid = m.key.remoteJid;
      const cleanJid = baileys.jidNormalizedUser ? baileys.jidNormalizedUser(rawJid) : rawJid;
      const phone = cleanJid.split("@")[0].replace(/\D/g, "");

      // Unwrap messages that might be wrapped inside ephemeral or view-once containers
      const unwrap = (msg) => {
        if (!msg) return {};
        if (msg.ephemeralMessage?.message) return unwrap(msg.ephemeralMessage.message);
        if (msg.viewOnceMessage?.message) return unwrap(msg.viewOnceMessage.message);
        if (msg.viewOnceMessageV2?.message) return unwrap(msg.viewOnceMessageV2.message);
        if (msg.documentWithCaptionMessage?.message) return unwrap(msg.documentWithCaptionMessage.message);
        return msg;
      };
      const inner = unwrap(m.message);

      const img = inner.imageMessage;
      const text =
        inner.conversation ||
        inner.extendedTextMessage?.text ||
        img?.caption ||
        inner.videoMessage?.caption ||
        "";

      console.log(`[wa:${tid}] 📩 Received from ${phone} (${cleanJid}): "${text.slice(0, 70)}"`);

      let image = null;
      if (img) {
        try {
          const buf = await downloadMediaMessage(m, "buffer", {});
          image = { mime: img.mimetype || "image/jpeg", b64: buf.toString("base64") };
        } catch (e) {
          console.error(`[wa:${tid}] media error: ${e.message}`);
        }
      }

      try {
        console.log(`[wa:${tid}] 🤖 Calling Django webhook (${DJANGO}/api/webhook/wa/)...`);
        const r = await fetch(`${DJANGO}/api/webhook/wa/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tenant_id: tid, phone, text, image }),
        });
        if (!r.ok) {
          const errText = await r.text();
          console.error(`[wa:${tid}] ❌ Django webhook returned HTTP ${r.status}: ${errText.slice(0, 160)}`);
          continue;
        }
        const data = await r.json();
        console.log(`[wa:${tid}] 💬 AI reply ready: "${(data.reply || "").slice(0, 70)}" (media: ${data.media?.length || 0})`);

        if (data.media && Array.isArray(data.media) && data.media.length > 0) {
          for (const item of data.media) {
            try {
              await sendMediaMessage(sock, cleanJid, item);
              console.log(`[wa:${tid}] 📸 Sent media to ${cleanJid}`);
            } catch (err) {
              console.error(`[wa:${tid}] ❌ Failed to send media: ${err.message}`);
            }
          }
        }
        if (data.reply) {
          try {
            await sock.sendMessage(cleanJid, { text: data.reply });
            console.log(`[wa:${tid}] ✅ Sent reply to ${cleanJid}`);
          } catch (sendErr) {
            console.error(`[wa:${tid}] ❌ Failed to send WhatsApp message: ${sendErr.message}`);
          }
        } else {
          console.warn(`[wa:${tid}] ⚠️ Django returned no reply text.`);
        }
      } catch (e) {
        console.error(`[wa:${tid}] ❌ Webhook error: ${e.message}`);
      }
    }
  });

  return s;
}

function startSession(tid) {
  if (sessions[tid]) return Promise.resolve(sessions[tid]);
  if (!starts[tid]) starts[tid] = _start(tid).finally(() => delete starts[tid]);
  return starts[tid];
}

const app = express();
app.use((req, res, next) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Headers", "Content-Type");
  res.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});
app.use(express.json({ limit: "30mb" }));

app.param("tid", (req, res, next, tid) => {
  if (!/^\d+$/.test(tid)) return res.status(400).json({ error: "invalid tenant id" });
  next();
});

app.get("/wa/:tid/status", async (req, res) => {
  try {
    const s = await startSession(req.params.tid);
    res.json({
      status: s.status,
      qr: s.qr ? await QRCode.toDataURL(s.qr, { width: 320 }) : null,
    });
  } catch (e) {
    res.status(500).json({ status: "ERROR", error: e.message });
  }
});

app.post("/wa/:tid/send", async (req, res) => {
  try {
    const { phone, text, image, caption } = req.body || {};
    const s = await startSession(req.params.tid);
    const jid = `${String(phone).replace(/\D/g, "")}@s.whatsapp.net`;
    if (image) {
      await sendMediaMessage(s.sock, jid, { url: image, caption: caption || text || "" });
    } else {
      await s.sock.sendMessage(jid, { text: String(text || "") });
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post("/wa/:tid/reset", async (req, res) => {
  try {
    const tid = req.params.tid;
    if (sessions[tid]) {
      try {
        sessions[tid].sock.end(undefined);
      } catch {}
      delete sessions[tid];
    }
    fs.rmSync(path.join(SESSIONS, tid), { recursive: true, force: true });
    await startSession(tid);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`wa_bridge listening on :${PORT}`);
  // Automatically resume previously authenticated WhatsApp sessions
  if (fs.existsSync(SESSIONS)) {
    try {
      const dirs = fs.readdirSync(SESSIONS);
      for (const d of dirs) {
        if (/^\d+$/.test(d) && fs.existsSync(path.join(SESSIONS, d, "creds.json"))) {
          console.log(`[wa_bridge] Auto-resuming saved WhatsApp session for tenant ${d}...`);
          startSession(d).catch((e) => console.error(`[wa_bridge] Failed to auto-resume session ${d}: ${e.message}`));
        }
      }
    } catch (e) {
      console.error(`[wa_bridge] Error reading sessions directory: ${e.message}`);
    }
  }
});
