# VKEHI VPN - Official Web Platform & Admin Management

Modern, ultra-fast VPN and V2Ray tunneling subscription website tailored specifically for Sri Lanka ISPs (Dialog, Mobitel, Airtel, Hutch, SLT Mobitel) with manual 3x-UI config delivery and free cloud database integration.

---

## 🇱🇰 සිංහල සම්පූර්ණ මාර්ගෝපදේශය (Full Sinhala Guide)

### 1. 100% නොමිලේ GitHub Pages Host කරන්නේ කෙසේද? (Free Front-end Hosting)
1. ඔබේ GitHub ගිණුමට මේ repository එක push කරන්න:
   ```bash
   git add .
   git commit -m "VKEHI VPN System Updated"
   git push origin main
   ```
2. GitHub Repository එකේ **Settings** -> **Pages** වෙත යන්න.
3. **Branch** එක `main` ලෙස තෝරා **Save** කරන්න.
4. විනාඩි 1-2කින් ඔබේ site එක `https://<username>.github.io/<repo-name>/` හරහා නොමිලේම live වේ!

---

### 2. 100% නොමිලේ Cloud Database එකක් හදාගන්නේ කෙසේද? (Free Database Setup)
GitHub Pages static නිසා customer කෙනෙක් phone එකෙන් order එකක් දාලා slip එක upload කළාම Admin PC එකට ඒක real-time එන්න නොමිලේ **Supabase** (PostgreSQL) භාවිතා කළ හැක ($0/month forever).

1. [https://supabase.com](https://supabase.com) වෙත ගොස් නොමිලේ ගිණුමක් (Free Account) සාදන්න.
2. **New Project** එකක් සාදන්න (නම: `vkehi-vpn`).
3. Project Settings -> **API** වෙත ගොස්:
   - **Project URL**
   - **anon / public key**
   දෙක කොපි කරගෙන ඔබේ `config.js` ගොනුවේ දමන්න:
   ```javascript
   supabaseUrl: "ඔබේ_SUPABASE_PROJECT_URL",
   supabaseAnonKey: "ඔබේ_SUPABASE_ANON_KEY"
   ```
4. Supabase dashboard එකේ වම් පැත්තේ ඇති **SQL Editor** වෙත ගොස් පහත SQL query එක paste කර **Run** කරන්න:

```sql
-- 1. Orders table
create table if not exists orders (
  id text primary key,
  user_email text,
  plan_id text,
  plan_name text,
  duration int,
  location text,
  isp text,
  amount numeric,
  whatsapp text,
  telegram text,
  payment_method text,
  slip_url text,
  status text default 'pending',
  config text,
  expiry_date text,
  created_at text
);

-- 2. Registered Users table
create table if not exists users (
  email text primary key,
  name text,
  join_date text,
  total_orders int default 0,
  status text default 'Registered Customer',
  updated_at text
);

-- Enable public read/write access for web client
alter table orders enable row level security;
create policy "Allow all public actions on orders" on orders for all using (true) with check (true);

alter table users enable row level security;
create policy "Allow all public actions on users" on users for all using (true) with check (true);
```
> **සටහන:** ඔබට දැනට database එකක් සකස් කිරීමට නොහැකි වුවත්, site එකේ **LocalStorage** හරහාද සියලුම Orders, Users සහ Approvals සාර්ථකව ක්‍රියාත්මක වේ!

---

### 3. Admin Portal එක භාවිතා කරන ආකාරය (Admin Access & Workflow)
- **Login වෙන ආකාරය**: Navbar එකේ ඉහළ දකුණු කෙළවරේ ඇති `🛡️ Admin` button එක ඔබන්න.
- **Default Username**: `vk`
- **Default Password**: `vk`
- **Active Users බැලීම**: Admin Panel එකේ **"👥 Registered Users"** tab එකට ගිය විට Register වූ සියලුම users, join date, orders ගණන සහ Active තත්ත්වය පෙනේ.
- **Manual Config Upload & Approve කිරීම**:
  1. Admin Panel එකේ **"📦 Customer Orders & Slips"** tab එකට යන්න.
  2. Customer විසින් upload කළ Bank Slip එක thumbnail එකක් ලෙස පෙනේ. **"🔍 Zoom Slip"** ක්ලික් කර slip එක විශාල කර බලන්න.
  3. ඔබේ 3x-UI Panel එකට ([https://paidsv2ray.vkehi.store:2414/ckEaV7r01qQG2AQEUg/](https://paidsv2ray.vkehi.store:2414/ckEaV7r01qQG2AQEUg/)) ගොස් customer සඳහා සෑදූ `vless://...` හෝ `vmess://...` config එක copy කරගන්න.
  4. Admin Panel එකේ ඇති text box එකට එම config එක **Paste** කරන්න.
  5. **"✓ Approve & Deliver Config to User"** button එක ක්ලික් කරන්න.
  6. එසැනින් order එක approve වී, customer ගේ dashboard එකට config එක සහ සැබෑ QR Code එක යැවේ!

---

### 4. User Dashboard එකේ ක්‍රියාකාරිත්වය (Customer Experience)
- Guest user කෙනෙකුට Cart, Notification, Dashboard පෙනෙන්නේ නැත.
- Plan එකක් තෝරාගත් විට Google Sign In හෝ Email ඇතුළත් කිරීමට අසයි.
- Login වූ පසු:
  - Navbar එකේ Cart, Notifications Bell සහ Profile Avatar පෙනේ.
  - Bank slip upload කළ පසු Dashboard එකේ **"⏳ Payment Verification Pending"** ලෙස පෙනේ.
  - Admin විසින් config එක approve කළ සැනින් Dashboard එක **"● Active Connection"** (Bright Green) බවට පත්වේ.
  - Expiry Date ගණනය වී පෙන්වයි.
  - Live Data Usage Meter (GB පරිභෝජනය) පෙන්වයි.
  - 1-Click Copy Config button සහ Mobile Apps සඳහා genuine Scannable **QR Code** ජනනය වේ.


### 5. Google Sign-In setup (required once)

The website now uses real Supabase Google OAuth instead of asking users to type a Gmail address.

1. In Supabase, open **Authentication → Sign In / Providers → Google** and enable Google.
2. Create a Google OAuth client in Google Cloud Console. Add the Supabase callback URL shown on the Supabase Google provider page as an **Authorized redirect URI**. It normally looks like:
   `https://xkyuuhivuqdkixidkaio.supabase.co/auth/v1/callback`
3. Copy the Google OAuth **Client ID** and **Client Secret** into the Supabase Google provider settings and save.
4. In Supabase, open **Authentication → URL Configuration**. Set the Site URL to your live website and add the exact live website URLs (including both `https://www.vpn.vkehi.store` and `https://vpn.vkehi.store`, if you use both) to the Redirect URLs allowlist.
5. Deploy the updated `config.js` and `script.js` files to GitHub Pages, then test the **Sign In → Google** button.

**Security warning:** This project currently contains permissive database policies that allow public access to the `orders` and `users` tables. Google Sign-In alone does not protect those tables. Before using this for real customers, replace those policies with proper authenticated, per-user policies and secure admin-only access. Never put a Supabase `secret` or legacy `service_role` key in `config.js`.


## Important production status (patched build)

This build removes the fake customer sign-in paths: entering an email or using a prompt no longer creates a logged-in account. The Google button now only starts real Supabase Google OAuth and displays an error if it is not configured. The hard-coded client-side admin password check is disabled because it was not secure.

**This does not mean the whole subscription service is production-ready yet.** Before taking real payments, complete all of the following:
1. Confirm the correct Supabase project and use its project URL + public/publishable key in `config.js`. Do not mix project credentials.
2. Enable Google under Supabase Authentication → Sign In / Providers → Google; configure Google OAuth Client ID/Secret in Supabase.
3. Set the Supabase Site URL and Redirect URLs to the exact production domain(s), and test OAuth on the deployed HTTPS site.
4. Add proper Row Level Security policies: customers may only read their own profile/orders/subscriptions; admin operations must be authorized server-side. Do not expose `service_role`/secret keys in browser files.
5. Replace sample bank/account/contact details in `config.js` with the real business details before publishing.
6. Receipt uploads, secure admin approval, automatic X-UI client creation, and subscription activation must be implemented and tested end-to-end. The current `server.js` creates a VLESS-looking URI but does not actually create a client in 3x-UI; do not sell subscriptions based on this endpoint yet.
7. Deploy the static frontend to Cloudflare Pages. The Node `server.js` requires a separate Node-capable host and is not run by static Cloudflare Pages.

Never use the current project to accept real payments until these items are complete.
