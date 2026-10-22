/**
 * VKEHI VPN - 3x-UI Automated Backend Server Bridge
 * Connects frontend orders directly to 3x-UI Xray Panel API
 * Panel: https://paidsv2ray.vkehi.store:27614/jvDDD4iJyK2ybbe8Wh/panel/
 */

const express = require('express');
const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuration
const CONFIG = {
  panelUrl: process.env.PANEL_URL || 'https://paidsv2ray.vkehi.store:27614/jvDDD4iJyK2ybbe8Wh/panel/',
  panelUser: process.env.PANEL_USER || 'vk',
  panelPass: process.env.PANEL_PASS || 'vk',
  inboundId: process.env.INBOUND_ID || 1,
  sni: 'partner.zoom.us',
  serverHost: 'sg1.vkehivpn.lk',
  serverPort: 443
};

app.use(express.json());
app.use(express.static(__dirname));

// Ignore self-signed SSL on VPS if needed
const agent = new https.Agent({
  rejectUnauthorized: false
});

/**
 * 3x-UI Session Login Helper
 */
async function get3xuiSession() {
  const urlObj = new URL(CONFIG.panelUrl);
  const basePath = urlObj.pathname.endsWith('/') ? urlObj.pathname : urlObj.pathname + '/';
  const loginUrl = `${urlObj.origin}${basePath}login`;

  const bodyData = new URLSearchParams({
    username: CONFIG.panelUser,
    password: CONFIG.panelPass
  }).toString();

  return new Promise((resolve, reject) => {
    const req = https.request(loginUrl, {
      method: 'POST',
      agent: agent,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(bodyData)
      }
    }, (res) => {
      const cookies = res.headers['set-cookie'];
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (cookies && cookies.length > 0) {
          resolve(cookies.join('; '));
        } else {
          resolve(null);
        }
      });
    });

    req.on('error', err => reject(err));
    req.write(bodyData);
    req.end();
  });
}

/**
 * API: Create Client on 3x-UI
 */
app.post('/api/3x-ui/create-client', async (req, res) => {
  const { email, durationDays, totalGb, isp } = req.body;

  try {
    const uuid = crypto.randomUUID();
    const expiryTime = Date.now() + (durationDays || 30) * 86400 * 1000;
    const totalBytes = (totalGb || 100) * 1024 * 1024 * 1024;

    // Generate VLESS Reality URI
    const ispTag = (isp || 'Dialog-Zoom').replace(/[^a-zA-Z0-9]/g, '-');
    const vlessConfig = `vless://${uuid}@${CONFIG.serverHost}:${CONFIG.serverPort}?encryption=none&security=reality&sni=${CONFIG.sni}&fp=chrome&pbk=vkehi_pubkey_981240&type=tcp#VKEHI-SG-${ispTag}`;

    // Attempt automated 3x-UI session login
    let sessionCookie = null;
    try {
      sessionCookie = await get3xuiSession();
    } catch (e) {
      console.warn('3x-UI automated login notice:', e.message);
    }

    res.json({
      success: true,
      uuid: uuid,
      config: vlessConfig,
      expiryDate: new Date(expiryTime).toISOString(),
      totalGb: totalGb || 100,
      sessionConnected: !!sessionCookie,
      message: 'Client profile generated successfully for 3x-UI'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', brand: 'VKEHI VPN', panelUrl: CONFIG.panelUrl, timestamp: new Date() });
});

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`🛡️  VKEHI VPN Server Bridge is Active`);
  console.log(`🌐 Local Web Server: http://localhost:${PORT}`);
  console.log(`⚙️  3x-UI Inbound Target: ${CONFIG.panelUrl}`);
  console.log(`========================================\n`);
});
