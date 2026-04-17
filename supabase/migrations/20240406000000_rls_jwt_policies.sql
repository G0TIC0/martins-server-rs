-- Migration: substituir subqueries RLS por JWT claims
-- IMPORTANTE: execute APÓS configurar o custom JWT hook no Supabase

-- Função auxiliar para ler role do JWT (Movida para o public para evitar erro de permissão no schema auth)
CREATE OR REPLACE FUNCTION public.user_role()
RETURNS TEXT AS $$
  SELECT COALESCE(
    auth.jwt() ->> 'user_role',
    (SELECT role FROM public.profiles WHERE id = auth.uid())
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Remover policies antigas e recriar com JWT

-- QUOTES
DROP POLICY IF EXISTS "Staff can select quotes" ON quotes;
DROP POLICY IF EXISTS "Staff can insert quotes" ON quotes;
DROP POLICY IF EXISTS "Staff can update quotes" ON quotes;
DROP POLICY IF EXISTS "Admin, Manager and Sales can delete quotes" ON quotes;
DROP POLICY IF EXISTS "Customers can view their own quotes" ON quotes;

CREATE POLICY "Staff can select quotes" ON quotes
  FOR SELECT USING (
    public.user_role() IN ('admin', 'sales', 'manager', 'technician')
    OR auth.uid() = customer_id
  );

CREATE POLICY "Staff can insert quotes" ON quotes
  FOR INSERT WITH CHECK (
    public.user_role() IN ('admin', 'sales', 'manager', 'technician')
  );

CREATE POLICY "Staff can update quotes" ON quotes
  FOR UPDATE USING (
    public.user_role() IN ('admin', 'sales', 'manager', 'technician')
  ) WITH CHECK (
    public.user_role() IN ('admin', 'sales', 'manager', 'technician')
  );

CREATE POLICY "Admin, Manager and Sales can delete quotes" ON quotes
  FOR DELETE USING (
    public.user_role() IN ('admin', 'manager', 'sales')
  );

-- CUSTOMERS
DROP POLICY IF EXISTS "Staff can manage customers" ON customers;
CREATE POLICY "Staff can manage customers" ON customers
  FOR ALL USING (
    public.user_role() IN ('admin', 'sales', 'manager', 'technician')
  );

-- QUOTE_ITEMS
DROP POLICY IF EXISTS "Staff can manage quote items" ON quote_items;
CREATE POLICY "Staff can manage quote items" ON quote_items
  FOR ALL USING (
    public.user_role() IN ('admin', 'sales', 'manager', 'technician')
  );

-- TIMELINE_EVENTS
DROP POLICY IF EXISTS "Staff can manage timeline events" ON timeline_events;
CREATE POLICY "Staff can manage timeline events" ON timeline_events
  FOR ALL USING (
    public.user_role() IN ('admin', 'sales', 'manager', 'technician')
  );

-- ITEMS
DROP POLICY IF EXISTS "Admin and Manager can manage catalog" ON items;
CREATE POLICY "Admin and Manager can manage catalog" ON items
  FOR ALL USING (
    public.user_role() IN ('admin', 'manager')
  );

-- VEHICLES
DROP POLICY IF EXISTS "Staff can manage vehicles" ON vehicles;
CREATE POLICY "Staff can manage vehicles" ON vehicles
  FOR ALL USING (
    public.user_role() IN ('admin', 'sales', 'manager', 'technician')
  );

-- COMPANY_SETTINGS
DROP POLICY IF EXISTS "Admin and Manager can manage company settings" ON company_settings;
CREATE POLICY "Admin and Manager can manage company settings" ON company_settings
  FOR ALL USING (
    public.user_role() IN ('admin', 'manager')
  );
