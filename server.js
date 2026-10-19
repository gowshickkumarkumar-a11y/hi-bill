const http = require('http');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@libsql/client');

// Load environment variables from .env
const ENV_FILE = path.join(__dirname, '.env');
if (fs.existsSync(ENV_FILE)) {
  const envContent = fs.readFileSync(ENV_FILE, 'utf-8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  });
}

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = __dirname;
const DB_FILE = path.join(__dirname, 'database.json');

const TURSO_URL = process.env.TURSO_DATABASE_URL || 'libsql://bill-gowshick.aws-ap-south-1.turso.io';
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN || '';

let tursoClient = null;
let tursoConnected = false;

if (TURSO_URL && TURSO_AUTH_TOKEN) {
  try {
    tursoClient = createClient({
      url: TURSO_URL,
      authToken: TURSO_AUTH_TOKEN
    });
  } catch (e) {
    console.error('Failed to initialize Turso client:', e.message);
  }
}

// Initialize Turso table and initial data sync
async function initTurso() {
  if (!tursoClient) return;
  try {
    await tursoClient.execute(`
      CREATE TABLE IF NOT EXISTS tracker_store (
        key TEXT PRIMARY KEY,
        data TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    tursoConnected = true;
    console.log('✅ Connected to Turso Cloud Database: ' + TURSO_URL);

    // Check if cloud database already has data
    const res = await tursoClient.execute({
      sql: 'SELECT data FROM tracker_store WHERE key = ? LIMIT 1',
      args: ['main']
    });

    if (res.rows.length === 0 && fs.existsSync(DB_FILE)) {
      // Seed cloud database from local database.json
      const localData = fs.readFileSync(DB_FILE, 'utf-8');
      await tursoClient.execute({
        sql: 'INSERT OR REPLACE INTO tracker_store (key, data, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
        args: ['main', localData]
      });
      console.log('✅ Initialized Turso cloud data from local database.json');
    }
  } catch (err) {
    console.error('⚠️ Turso cloud connection warning:', err.message);
    tursoConnected = false;
  }
}

initTurso();

// Ensure local fallback database file exists
if (!fs.existsSync(DB_FILE)) {
  const defaultData = {
    settings: { currency: '₹', dayAmount: 350, halfDayAmount: 150, title: 'Member Attendance & Count Tracker' },
    members: [],
    dailyEntries: {}
  };
  fs.writeFileSync(DB_FILE, JSON.stringify(defaultData, null, 2), 'utf-8');
}

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.apk': 'application/vnd.android.package-archive'
};

const server = http.createServer(async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // API Route: GET /api/data -> Read Database (Turso Cloud first, local fallback)
  if (req.method === 'GET' && req.url === '/api/data') {
    if (tursoClient && tursoConnected) {
      try {
        const queryRes = await tursoClient.execute({
          sql: 'SELECT data FROM tracker_store WHERE key = ? LIMIT 1',
          args: ['main']
        });

        if (queryRes.rows.length > 0 && queryRes.rows[0].data) {
          const raw = queryRes.rows[0].data;
          // Keep local backup in sync
          try { fs.writeFileSync(DB_FILE, raw, 'utf-8'); } catch (e) {}

          res.writeHead(200, {
            'Content-Type': 'application/json',
            'X-Database-Provider': 'turso'
          });
          res.end(raw);
          return;
        }
      } catch (cloudErr) {
        console.error('Turso read error, falling back to local file:', cloudErr.message);
      }
    }

    // Local file fallback
    fs.readFile(DB_FILE, 'utf-8', (err, data) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to read database' }));
        return;
      }
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'X-Database-Provider': 'local'
      });
      res.end(data);
    });
    return;
  }

  // API Route: POST /api/data -> Save Database (Turso Cloud AND local file)
  if (req.method === 'POST' && req.url === '/api/data') {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
    });

    req.on('end', async () => {
      try {
        const parsed = JSON.parse(body);
        const jsonStr = JSON.stringify(parsed, null, 2);

        // Always save local backup
        fs.writeFile(DB_FILE, jsonStr, 'utf-8', () => {});

        // Save to Turso Cloud
        if (tursoClient) {
          try {
            await tursoClient.execute({
              sql: 'INSERT OR REPLACE INTO tracker_store (key, data, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
              args: ['main', jsonStr]
            });
            tursoConnected = true;
          } catch (cloudErr) {
            console.error('Turso save error:', cloudErr.message);
          }
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          provider: tursoConnected ? 'turso' : 'local',
          message: tursoConnected ? 'Saved to Turso Cloud Database' : 'Saved to local database.json'
        }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
      }
    });
    return;
  }

  // Static File Serving
  let filePath = path.join(PUBLIC_DIR, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('404 Not Found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('500 Server Error: ' + err.code);
      }
    } else {
      const headers = { 'Content-Type': contentType };
      if (ext === '.apk') {
        headers['Content-Disposition'] = 'attachment; filename="MemberTracker.apk"';
      }
      res.writeHead(200, headers);
      res.end(content);
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const os = require('os');
  const nets = os.networkInterfaces();
  let localIP = 'localhost';
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        localIP = net.address;
      }
    }
  }
  console.log(`======================================================`);
  console.log(` Member & Monthly Bill Tracker running at:`);
  console.log(``);
  console.log(`   Local:    http://localhost:${PORT}`);
  console.log(`   Network:  http://${localIP}:${PORT}`);
  console.log(``);
  console.log(` 🌐 Turso Cloud DB: ${TURSO_URL}`);
  console.log(` 📁 Local Backup:   ${DB_FILE}`);
  console.log(` 📱 Mobile APK:     http://${localIP}:${PORT}/MemberTracker.apk`);
  console.log(`======================================================`);
});
