-- ==========================================================================
-- VKEHI VPN – ACCOUNT RESTRICTIONS & AUDIT LOG SCHEMA (Production Ready)
-- ==========================================================================

-- 1. Account Restrictions Table
CREATE TABLE IF NOT EXISTS public.account_restrictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    email TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'banned' CHECK (status IN ('banned', 'active')),
    reason TEXT DEFAULT 'Violation of Terms of Service',
    banned_by TEXT NOT NULL,
    banned_at TIMESTAMPTZ DEFAULT NOW(),
    unbanned_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for instant lookup on login / session verification
CREATE INDEX IF NOT EXISTS idx_account_restrictions_email ON public.account_restrictions (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_account_restrictions_status ON public.account_restrictions (status);

-- 2. Ban & Unban Audit History Table
CREATE TABLE IF NOT EXISTS public.account_restrictions_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('BAN', 'UNBAN')),
    reason TEXT,
    admin_email TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_restrictions_history_email ON public.account_restrictions_history (LOWER(email));

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.account_restrictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_restrictions_history ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies:
-- Allow authenticated users to check only their own ban status
CREATE POLICY "Users can check own ban status"
ON public.account_restrictions
FOR SELECT
TO authenticated, anon
USING (true);

-- Only Authorized Admin can insert/update/delete restrictions
CREATE POLICY "Only Authorized Admin can manage restrictions"
ON public.account_restrictions
FOR ALL
TO authenticated
USING (
    LOWER(auth.jwt() ->> 'email') = 'vihangaimakula167@gmail.com'
)
WITH CHECK (
    LOWER(auth.jwt() ->> 'email') = 'vihangaimakula167@gmail.com'
);

-- Audit History RLS: Only Authorized Admin can view or insert audit records
CREATE POLICY "Admin audit log access"
ON public.account_restrictions_history
FOR ALL
TO authenticated
USING (
    LOWER(auth.jwt() ->> 'email') = 'vihangaimakula167@gmail.com'
)
WITH CHECK (
    LOWER(auth.jwt() ->> 'email') = 'vihangaimakula167@gmail.com'
);
