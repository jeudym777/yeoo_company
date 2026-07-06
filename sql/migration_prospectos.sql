-- SQL Migration for YEOO OS: CRM Prospectos Follow-up
-- Run this in your Supabase SQL Editor

-- 1. Create prospecto table
CREATE TABLE IF NOT EXISTS prospecto (
  id TEXT PRIMARY KEY,
  company_name TEXT NOT NULL UNIQUE,
  contact_name TEXT DEFAULT '',
  email TEXT DEFAULT '',
  website TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  industry TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  pain_points TEXT DEFAULT '',
  draft_proposal TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'esperando' CHECK (status IN ('esperando', 'aceptado', 'rechazado')),
  feedback TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE prospecto ENABLE ROW LEVEL SECURITY;

-- 3. Create policies to allow all operations for anon (simplifies dev environment)
DROP POLICY IF EXISTS "Allow all on prospecto for anon" ON prospecto;
CREATE POLICY "Allow all on prospecto for anon" ON prospecto
  FOR ALL
  USING (true)
  WITH CHECK (true);
