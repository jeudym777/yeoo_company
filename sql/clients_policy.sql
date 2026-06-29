-- SQL para permitir lectura de tabla clients con la anon key
-- Ejecuta esto en Supabase SQL Editor

-- 1. Verificar cuántos registros hay
SELECT COUNT(*) as total_clientes FROM clients;

-- 2. Crear políticas para la tabla clients (SELECT y ALL)
DROP POLICY IF EXISTS "Enable read access for anon" ON clients;
CREATE POLICY "Enable read access for anon" ON clients
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Enable insert for anon" ON clients;
CREATE POLICY "Enable insert for anon" ON clients
  FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Enable update for anon" ON clients;
CREATE POLICY "Enable update for anon" ON clients
  FOR UPDATE
  USING (true);

DROP POLICY IF EXISTS "Enable delete for anon" ON clients;
CREATE POLICY "Enable delete for anon" ON clients
  FOR DELETE
  USING (true);

-- 3. Verificar que las políticas están activas
SELECT tablename, policyname, permissive, cmd, qual
FROM pg_policies
WHERE tablename = 'clients';