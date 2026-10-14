# VKEHI VPN Frontend (Preview)

A responsive, dark-themed landing page and UI preview for a VPN subscription website.

## Files
- `index.html` — page structure, plans, modals, demo order form
- `style.css` — responsive layout and visual styling
- `script.js` — plan duration switcher, modal interactions, demo form

## Preview locally
Open `index.html` in a browser.

## Deploy with Cloudflare Pages
1. Create a GitHub repository named `vkehi-vpn-website`.
2. Upload `index.html`, `style.css`, `script.js`, and `README.md` to the repository root.
3. In Cloudflare Pages, create a project connected to that GitHub repository.
4. Use these settings:
   - Framework preset: `None`
   - Build command: leave empty
   - Build output directory: `/` (or the root directory, depending on the UI)
5. Deploy. Add `shop.vkehi.store` through the Pages project's **Custom domains** screen after deployment.

## Important security notes
This is a **frontend preview only**. It does not perform real Google authentication, payment verification, file uploads, database writes, admin approvals, traffic tracking, or X-UI account creation. Those require a secure backend and persistent database/storage. Never put X-UI credentials, Cloudflare API tokens, or private keys in frontend files or GitHub.
Do not change existing X-UI DNS records when setting up the new `shop` subdomain.

## Demo prices
Edit the `prices` object at the top of `script.js` before publishing. The current values are sample prices and are not connected to any payment system.
