
const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Security & CORS headers (Restricts origin to authorized domains)
app.use((req, res, next) => {
  const origin = req.headers.origin || '';
  const allowed = [
    'https://vpn.vkehi.store',
    'https://www.vpn.vkehi.store',
    'http://localhost:3000',
    'http://127.0.0.1:5500'
  ];
  if (allowed.includes(origin) || origin.endsWith('.github.io')) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

const required = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'PANEL_URL',
  'PANEL_API_TOKEN'
];

for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing environment variable: ${key}`);
    process.exit(1);
  }
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// PANEL_URL should end with /panel, without a trailing slash.
const panelBase = process.env.PANEL_URL.replace(/\/+$/, '');
const panelApiUrl = `${panelBase}/api/inbounds/list`;

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', brand: 'VKEHI VPN' });
});

app.get('/api/vpn/usage', async (req, res) => {
  try {
    const auth = req.headers.authorization || '';
    const tokenMatch = auth.match(/^Bearer\s+(.+)$/i);

    if (!tokenMatch) {
      return res.status(401).json({ error: 'Login required' });
    }

    const { data, error } = await supabase.auth.getUser(tokenMatch[1]);
    const userEmail = data?.user?.email?.trim().toLowerCase();

    if (error || !userEmail) {
      return res.status(401).json({ error: 'Invalid login session' });
    }

    const panelResponse = await fetch(panelApiUrl, {
      headers: {
        Authorization: `Bearer ${process.env.PANEL_API_TOKEN}`,
        Accept: 'application/json'
      },
      signal: AbortSignal.timeout(10000)
    });

    if (!panelResponse.ok) {
      console.error('3X-UI HTTP status:', panelResponse.status);
      return res.status(502).json({ error: 'VPN panel unavailable' });
    }

    const panelData = await panelResponse.json();

    if (panelData.success !== true || !Array.isArray(panelData.obj)) {
      return res.status(502).json({ error: 'Unexpected panel response' });
    }

    const found = [];

    for (const inbound of panelData.obj) {
      let settings;

      try {
        settings = typeof inbound.settings === 'string'
          ? JSON.parse(inbound.settings)
          : inbound.settings;
      } catch {
        continue;
      }

      const clients = Array.isArray(settings?.clients)
        ? settings.clients
        : [];
      const stats = Array.isArray(inbound.clientStats)
        ? inbound.clientStats
        : [];

      for (const client of clients) {
        if (
          typeof client.email !== 'string' ||
          client.email.trim().toLowerCase() !== userEmail
        ) {
          continue;
        }

        const stat = stats.find(item =>
          typeof item.email === 'string' &&
          item.email.trim().toLowerCase() === userEmail
        );

        const usedBytes = Math.max(
          0,
          Number(stat?.up || 0) + Number(stat?.down || 0)
        );

        // In common 3X-UI responses, client.totalGB stores the byte limit.
        // Do not guess if the field is absent or invalid.
        const totalBytes = Number(client.totalGB);
        const hasLimit = Number.isFinite(totalBytes) && totalBytes > 0;

        const expiryMs = Number(client.expiryTime || 0);
        const validExpiry = Number.isFinite(expiryMs) && expiryMs > 0;

        found.push({
          email: userEmail,
          usedBytes,
          totalBytes: hasLimit ? totalBytes : null,
          remainingBytes: hasLimit
            ? Math.max(0, totalBytes - usedBytes)
            : null,
          expiryDate: validExpiry
            ? new Date(expiryMs).toISOString()
            : null,
          enabled: client.enable === true
        });
      }
    }

    if (found.length === 0) {
      return res.status(404).json({
        error: 'No VPN client found for this login email'
      });
    }

    if (found.length > 1) {
      return res.status(409).json({
        error: 'Multiple clients use this email. Contact support.'
      });
    }

    return res.json(found[0]);
  } catch (err) {
    console.error('VPN usage request failed:', err.message);
    return res.status(500).json({ error: 'Unable to load VPN usage' });
  }
});

app.listen(PORT, () => {
  console.log(`VKEHI VPN API listening on port ${PORT}`);
});
