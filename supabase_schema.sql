-- ==============================================================================
-- PEERDESK: SUPABASE DATABASE SETUP SCHEMA
-- Copy and run this script in the Supabase Dashboard -> SQL Editor
-- ==============================================================================

-- 1. Create the subjects table (stores subjects, units 1-5, checklists, and contents)
CREATE TABLE IF NOT EXISTS public.subjects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  semester TEXT,
  created_by JSONB NOT NULL DEFAULT '{"name": "Anonymous", "timestamp": 0}',
  units JSONB NOT NULL DEFAULT '{
    "1": {"checklist": [], "contents": []},
    "2": {"checklist": [], "contents": []},
    "3": {"checklist": [], "contents": []},
    "4": {"checklist": [], "contents": []},
    "5": {"checklist": [], "contents": []}
  }',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Create the members table (stores community study peers)
CREATE TABLE IF NOT EXISTS public.members (
  name TEXT PRIMARY KEY,
  joined_at BIGINT NOT NULL,
  last_active BIGINT NOT NULL
);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;

-- 4. Create open access policies so all peer students can read and contribute
-- Subjects policies
DROP POLICY IF EXISTS "Public select on subjects" ON public.subjects;
CREATE POLICY "Public select on subjects" ON public.subjects FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public insert on subjects" ON public.subjects;
CREATE POLICY "Public insert on subjects" ON public.subjects FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Public update on subjects" ON public.subjects;
CREATE POLICY "Public update on subjects" ON public.subjects FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Public delete on subjects" ON public.subjects;
CREATE POLICY "Public delete on subjects" ON public.subjects FOR DELETE USING (true);

-- Members policies
DROP POLICY IF EXISTS "Public select on members" ON public.members;
CREATE POLICY "Public select on members" ON public.members FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public insert on members" ON public.members;
CREATE POLICY "Public insert on members" ON public.members FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Public update on members" ON public.members;
CREATE POLICY "Public update on members" ON public.members FOR UPDATE USING (true);

-- 5. Enable Supabase Realtime (optional, allows live peer syncing)
ALTER PUBLICATION supabase_realtime ADD TABLE public.subjects;
ALTER PUBLICATION supabase_realtime ADD TABLE public.members;
