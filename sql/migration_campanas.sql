-- SQL Migration for YEOO OS: Campañas Publicitarias con Freepik
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS campana_publicitaria (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  agent_id TEXT NOT NULL, -- creative agent assigned (from agents table)
  context_extra TEXT DEFAULT '', -- commercial inputs from user
  ad_copy TEXT DEFAULT '', -- generated advertising text (title, body, hashtags)
  image_prompt TEXT DEFAULT '', -- visual prompt for Freepik
  image_style TEXT DEFAULT 'photo', -- photo, illustration, digital-art, 3d, etc.
  images_json JSONB DEFAULT '[]'::jsonb, -- array of generated images in base64 format
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE campana_publicitaria ENABLE ROW LEVEL SECURITY;

-- Allow all operations for anon role in dev mode
DROP POLICY IF EXISTS "Allow all on campana_publicitaria for anon" ON campana_publicitaria;
CREATE POLICY "Allow all on campana_publicitaria for anon" ON campana_publicitaria
  FOR ALL
  USING (true)
  WITH CHECK (true);
