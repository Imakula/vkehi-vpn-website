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
