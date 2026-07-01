-- Table for access control codes
CREATE TABLE IF NOT EXISTS temporalcode (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE temporalcode ENABLE ROW LEVEL SECURITY;

-- Allow anyone to SELECT (read) — needed for verification
CREATE POLICY "Allow SELECT on temporalcode" ON temporalcode FOR SELECT USING (true);

-- Insert default access code: 2030
INSERT INTO temporalcode (code) VALUES ('2030')
ON CONFLICT (code) DO NOTHING;