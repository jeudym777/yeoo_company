-- SQL Migration for YEOO OS: Administración de Proyectos (Renombrado a projectcontinuos)
-- Run this in your Supabase SQL Editor

-- 1. Create projectcontinuos table
CREATE TABLE IF NOT EXISTS projectcontinuos (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  client_name TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'planificacion' CHECK (status IN ('planificacion', 'desarrollo', 'pruebas_qa', 'entregado')),
  budget TEXT DEFAULT '',
  deadline TEXT DEFAULT '',
  description TEXT DEFAULT '',
  assigned_agents JSONB DEFAULT '[]'::jsonb, -- array of agent IDs assigned to the project
  memory_bank TEXT DEFAULT '',
  weekly_report JSONB DEFAULT '{"completed": "", "next_steps": "", "blockers": ""}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create projectcontinuos_task table
CREATE TABLE IF NOT EXISTS projectcontinuos_task (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projectcontinuos(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  stage TEXT NOT NULL CHECK (stage IN ('planificacion', 'desarrollo', 'pruebas_qa', 'entregado')),
  assigned_agent_id TEXT DEFAULT NULL, -- optional agent ID assigned to this task
  completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE projectcontinuos ENABLE ROW LEVEL SECURITY;
ALTER TABLE projectcontinuos_task ENABLE ROW LEVEL SECURITY;

-- 4. Create policies to allow all operations for anon (simplifies dev environment)
DROP POLICY IF EXISTS "Allow all on projectcontinuos for anon" ON projectcontinuos;
CREATE POLICY "Allow all on projectcontinuos for anon" ON projectcontinuos
  FOR ALL
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on projectcontinuos_task for anon" ON projectcontinuos_task;
CREATE POLICY "Allow all on projectcontinuos_task for anon" ON projectcontinuos_task
  FOR ALL
  USING (true)
  WITH CHECK (true);
