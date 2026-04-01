-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles Table (linked to auth.users)
CREATE TABLE profiles (
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
CREATE TABLE customers (
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
CREATE TABLE vehicles (
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
CREATE TABLE items (
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
CREATE TABLE quotes (
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
CREATE TABLE quote_items (
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
CREATE TABLE timeline_events (
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
CREATE TABLE ncms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  description TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Company Settings Table
CREATE TABLE company_settings (
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
CREATE TABLE audit_logs (
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

-- Policies (Basic examples, can be refined)
CREATE POLICY "Public profiles are viewable by everyone." ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update their own profile." ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Authenticated users can read all data." ON customers FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert data." ON customers FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update data." ON customers FOR UPDATE USING (auth.role() = 'authenticated');

-- Repeat similar policies for other tables or use a more restrictive approach based on roles
-- For brevity, I'll apply a general "authenticated" policy to most tables
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN (SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name NOT IN ('profiles', 'customers')) LOOP
    EXECUTE format('CREATE POLICY "Authenticated users can read %I" ON %I FOR SELECT USING (auth.role() = ''authenticated'');', t, t);
    EXECUTE format('CREATE POLICY "Authenticated users can insert %I" ON %I FOR INSERT WITH CHECK (auth.role() = ''authenticated'');', t, t);
    EXECUTE format('CREATE POLICY "Authenticated users can update %I" ON %I FOR UPDATE USING (auth.role() = ''authenticated'');', t, t);
  END LOOP;
END $$;

-- Trigger to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, photo_url)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'photo_url');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
