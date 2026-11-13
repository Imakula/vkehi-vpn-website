-- Optional: lets the rejection reason be stored with the order (so Admin + Customer both see it).
-- Run once in Supabase -> SQL Editor. The site still works without it (reason is sent via messages).
alter table public.orders add column if not exists rejection_reason text;
