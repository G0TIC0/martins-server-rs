-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles Table (linked to auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  photo_url TEXT,
  role TEXT DEFAULT 'sales',
  cpf TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Customers Table
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  document TEXT NOT NULL UNIQUE,
  email TEXT,
  phone TEXT,
  address TEXT,
  observations TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vehicles Table
CREATE TABLE IF NOT EXISTS vehicles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  plate TEXT NOT NULL UNIQUE,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER NOT NULL,
  color TEXT,
  vin TEXT,
  observations TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Items Table (Catalog)
CREATE TABLE IF NOT EXISTS items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL, -- service, product, package, labor
  cost_price DECIMAL(12, 2) DEFAULT 0,
  base_price DECIMAL(12, 2) DEFAULT 0,
  unit TEXT DEFAULT 'un',
  active BOOLEAN DEFAULT TRUE,
  ncm TEXT,
  ncm_description TEXT,
  fci TEXT,
  part_codes TEXT[], -- Array of strings
  observations TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Quotes Table
CREATE TABLE IF NOT EXISTS quotes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_number TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  classification TEXT,
  customer_id UUID REFERENCES customers(id),
  customer_name TEXT,
  vehicle_id UUID REFERENCES vehicles(id),
  vehicle_plate TEXT,
  vehicle_model TEXT,
  current_km INTEGER,
  status TEXT DEFAULT 'received',
  service_status TEXT,
  subtotal DECIMAL(12, 2) DEFAULT 0,
  discount_total DECIMAL(12, 2) DEFAULT 0,
  tax_total DECIMAL(12, 2) DEFAULT 0,
  shipping_fee DECIMAL(12, 2) DEFAULT 0,
  urgency_fee DECIMAL(12, 2) DEFAULT 0,
  grand_total DECIMAL(12, 2) DEFAULT 0,
  valid_until TIMESTAMPTZ,
  notes TEXT,
  terms TEXT,
  observations TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id)
);

-- Quote Items Table
CREATE TABLE IF NOT EXISTS quote_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_id UUID REFERENCES quotes(id) ON DELETE CASCADE,
  item_id UUID REFERENCES items(id),
  item_code TEXT,
  name TEXT NOT NULL,
  ncm TEXT,
  type TEXT NOT NULL,
  quantity DECIMAL(12, 3) DEFAULT 1,
  cost_price DECIMAL(12, 2) DEFAULT 0,
  unit_price DECIMAL(12, 2) DEFAULT 0,
  discount DECIMAL(12, 2) DEFAULT 0,
  total DECIMAL(12, 2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Timeline Events Table
CREATE TABLE IF NOT EXISTS timeline_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_id UUID REFERENCES quotes(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id),
  user_name TEXT,
  user_role TEXT,
  notes TEXT
);

-- NCMs Table
CREATE TABLE IF NOT EXISTS ncms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  description TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Company Settings Table
CREATE TABLE IF NOT EXISTS company_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  logo_url TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  user_name TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  details TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE timeline_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ncms ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Policies (Enterprise Grade RBAC)
-- Profiles: Users can read all profiles (for collaboration) but only update their own
CREATE POLICY "Profiles are viewable by authenticated users" ON profiles 
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can update their own profile" ON profiles 
  FOR UPDATE USING (auth.uid() = id);

-- Customers: Only staff can manage customers. Customers can't see other customers.
CREATE POLICY "Staff can manage customers" ON customers
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'sales', 'manager', 'technician')
    )
  );

-- Quotes: Staff can see all. Customers can only see their own.
CREATE POLICY "Staff can manage all quotes" ON quotes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'sales', 'manager', 'technician')
    )
  );

CREATE POLICY "Customers can view their own quotes" ON quotes
  FOR SELECT USING (
    auth.uid() = customer_id OR 
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'sales', 'manager', 'technician')
    )
  );

-- Items (Catalog): Everyone authenticated can read. Only admin/manager can modify.
CREATE POLICY "Authenticated users can read catalog" ON items
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admin and Manager can manage catalog" ON items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

-- Apply similar logic to other tables
CREATE POLICY "Staff can manage quote items" ON quote_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'sales', 'manager', 'technician')
    )
  );

CREATE POLICY "Staff can manage timeline events" ON timeline_events
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'sales', 'manager', 'technician')
    )
  );

-- Company Settings: Read for everyone, Manage for Admin/Manager
CREATE POLICY "Anyone can read company settings" ON company_settings
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admin and Manager can manage company settings" ON company_settings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

-- NCMs: Read for everyone, Manage for Admin/Manager
CREATE POLICY "Anyone can read ncms" ON ncms
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admin and Manager can manage ncms" ON ncms
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

-- Vehicles: Staff can manage
CREATE POLICY "Staff can manage vehicles" ON vehicles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'sales', 'manager', 'technician')
    )
  );

-- Audit Logs: Admin and Manager can read
CREATE POLICY "Admin and Manager can read audit logs" ON audit_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

-- Trigger to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, photo_url)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'photo_url');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
