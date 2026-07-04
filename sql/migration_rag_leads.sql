-- SQL Migration for YEOO OS: Company RAG & Leads Prospección
-- Run this in your Supabase SQL Editor

-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Create company_knowledge table
CREATE TABLE IF NOT EXISTS company_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  embedding vector(768), -- text-embedding-004 produces 768 dimensions
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Create semantic search function (RPC)
CREATE OR REPLACE FUNCTION match_company_knowledge (
  query_embedding vector(768),
  match_threshold FLOAT,
  match_count INT
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  content TEXT,
  category TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    company_knowledge.id,
    company_knowledge.title,
    company_knowledge.content,
    company_knowledge.category,
    1 - (company_knowledge.embedding <=> query_embedding) AS similarity
  FROM company_knowledge
  WHERE 1 - (company_knowledge.embedding <=> query_embedding) > match_threshold
  ORDER BY company_knowledge.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 4. Create leads table for sales prospecting
CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  company_name TEXT NOT NULL,
  contact_name TEXT DEFAULT '',
  email TEXT DEFAULT '',
  website TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  industry TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  pain_points TEXT DEFAULT '',
  draft_proposal TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'interested', 'replied', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Enable Row Level Security (RLS)
ALTER TABLE company_knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- 6. Create policies to allow all operations for anon (simplifies dev environment)
DROP POLICY IF EXISTS "Allow all on company_knowledge for anon" ON company_knowledge;
CREATE POLICY "Allow all on company_knowledge for anon" ON company_knowledge
  FOR ALL
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on leads for anon" ON leads;
CREATE POLICY "Allow all on leads for anon" ON leads
  FOR ALL
  USING (true)
  WITH CHECK (true);
