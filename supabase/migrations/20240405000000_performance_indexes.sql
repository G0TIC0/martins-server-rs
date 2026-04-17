-- Migration: adicionar índices de performance
-- Execute no Supabase SQL Editor

-- Índices para a tabela quotes (mais consultada)
CREATE INDEX IF NOT EXISTS idx_quotes_customer_id ON quotes(customer_id);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status);
CREATE INDEX IF NOT EXISTS idx_quotes_created_at ON quotes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quotes_created_by ON quotes(created_by);

-- Índices para quote_items (JOIN frequente com quotes)
CREATE INDEX IF NOT EXISTS idx_quote_items_quote_id ON quote_items(quote_id);

-- Índices para timeline_events (JOIN frequente com quotes)
CREATE INDEX IF NOT EXISTS idx_timeline_events_quote_id ON timeline_events(quote_id);

-- Índices para vehicles
CREATE INDEX IF NOT EXISTS idx_vehicles_customer_id ON vehicles(customer_id);

-- Índice para profiles (usado em subqueries RLS)
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
