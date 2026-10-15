# VKEHI VPN - Official Web Platform

Modern, ultra-fast VPN and V2Ray tunneling subscription website tailored specifically for Sri Lanka ISPs (Dialog, Mobitel, Airtel, Hutch, SLT Mobitel).

Inspired by the design and architecture of TechSonic VIP, re-engineered for **VKEHI VPN**.

---

## ⚡ Features Included

- **Dark Cyber Glassmorphism UI**: Built with `Space Grotesk`, `Inter`, and `JetBrains Mono` fonts, glowing neon blue gradients, ambient lighting grids, and animated equalizer meters.
- **Sri Lankan ISP Backbone Integrations**: 
  - Dialog (TikTok 297/997, Zoom 724 Router, Work & Learn)
  - Mobitel (Unlimited, YouTube/Social 360, Work From Home)
  - Airtel (Zoom 215, YouTube 135/260, TikTok 297/997)
  - Hutch (Zoom 224, Social 140/330, Work & Study)
  - SLT Mobitel (Netflix Fibre/4G, Zoom Prepaid 235, Learn Anywhere)
- **Live System Simulator**: Dynamic load monitoring for Singapore Cluster Alpha/Beta and Sri Lanka Gamma residential nodes.
- **Interactive Pricing Architecture**:
  - Location Selector: `🇸🇬 SG IP (Default)` vs `🇱🇰 LK IP (Manual)`
  - Duration Selector: `30 Days` vs `60 Days (Best Value)`
  - 4 Tiers: Starter (100GB), Standard (200GB), Pro Gamer (400GB), Unlimited VIP.
- **3-Step Checkout Funnel**:
  1. Select plan and duration.
  2. Choose Carrier / ISP Package from filtered tabs.
  3. Secure Checkout with Dialog Genie / LANKAQR, Bank Transfer, or Binance Pay ID.
  4. Payment receipt screenshot upload with instant preview and pre-formatted WhatsApp activation message.
- **Connectivity Suite**: Direct links and guide modals for Android (NetMod, V2Box), Windows (NetMod PC, v2rayN), iOS (V2Box, NPV Tunnel), and macOS (V2Box Mac, FoXray).
- **Customer Dashboard**: Active connection display, live data consumption meter, and 1-click `vless://...` config clipboard copy.

---

## 🛠️ Configuration

Edit `config.js` to change:
- **WhatsApp Support Number & Direct Link**
- **Telegram Channel & Support Links**
- **Bank Transfer Details** (Commercial Bank, Sampath, BOC, etc.)
- **Binance Pay ID**
- **Supabase Credentials**

---

## 🚀 How to Run Locally

Double-click `index.html` or run with any local HTTP server:
```bash
# Python
py -m http.server 8080
```
Then visit `http://localhost:8080`.
