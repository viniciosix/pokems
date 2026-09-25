import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import { JSONFilePreset } from 'lowdb/node';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8787);
const TOKEN = process.env.RADARMS_TOKEN || 'troque-este-token';
const TTL_MINUTES = Number(process.env.SPAWN_TTL_MINUTES || 20);
const dataDir = path.join(__dirname, 'data');

fs.mkdirSync(dataDir, { recursive: true });
const db = await JSONFilePreset(path.join(dataDir, 'db.json'), { spawns: [], scanner: {} });

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const nowIso = () => new Date().toISOString();

function cleanup() {
  const cutoff = Date.now() - TTL_MINUTES * 60_000;
  const before = db.data.spawns.length;
  db.data.spawns = db.data.spawns.filter(s => new Date(s.last_seen).getTime() >= cutoff);
  if (before !== db.data.spawns.length) db.write();
}

setInterval(() => {
  cleanup();
  io.emit('spawns', db.data.spawns);
}, 30_000).unref();

function auth(req, res, next) {
  const token =
    req.headers.authorization?.replace(/^Bearer\s+/i, '') ||
    req.headers['x-radarms-token'];
  if (token !== TOKEN) return res.status(401).json({ error: 'unauthorized' });
  next();
}

app.get('/api/health', (_req, res) => res.json({ ok: true, time: nowIso() }));

app.get('/api/spawns', (_req, res) => {
  cleanup();
  res.json(db.data.spawns);
});

app.get('/api/status', (_req, res) => res.json(db.data.scanner || {}));

app.post('/api/status', auth, async (req, res) => {
  db.data.scanner = { ...db.data.scanner, ...req.body, updated_at: nowIso() };
  await db.write();
  io.emit('status', db.data.scanner);
  res.json({ ok: true });
});

app.post('/api/detections', auth, async (req, res) => {
  const items = Array.isArray(req.body) ? req.body : [req.body];
  const accepted = [];

  for (const raw of items) {
    const species = String(raw.species || '').trim();
    const lat = Number(raw.lat);
    const lon = Number(raw.lon);

    if (!species || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;

    const confidence = Math.max(0, Math.min(1, Number(raw.confidence ?? 0.5)));
    const seen = raw.seen_at || nowIso();
    const roundedKey = `${species.toLowerCase()}|${lat.toFixed(4)}|${lon.toFixed(4)}`;

    let spawn = db.data.spawns.find(
      s => s.key === roundedKey &&
      Date.now() - new Date(s.last_seen).getTime() < 15 * 60_000
    );

    if (!spawn) {
      spawn = {
        id: crypto.randomUUID(),
        key: roundedKey,
        species,
        lat,
        lon,
        first_seen: seen,
        last_seen: seen,
        confidence,
        accuracy_m: Number(raw.accuracy_m || 120),
        source: raw.source || 'alt-scanner',
        count: 1,
      };
      db.data.spawns.push(spawn);
    } else {
      spawn.last_seen = seen;
      spawn.confidence = Math.max(spawn.confidence, confidence);
      spawn.count += 1;
      spawn.lat = (spawn.lat * (spawn.count - 1) + lat) / spawn.count;
      spawn.lon = (spawn.lon * (spawn.count - 1) + lon) / spawn.count;
    }

    accepted.push(spawn);
  }

  cleanup();
  await db.write();
  io.emit('spawns', db.data.spawns);
  res.json({ ok: true, accepted: accepted.length });
});

app.post('/api/clear', auth, async (_req, res) => {
  db.data.spawns = [];
  await db.write();
  io.emit('spawns', []);
  res.json({ ok: true });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`PokeMS em http://0.0.0.0:${PORT}`);
});
