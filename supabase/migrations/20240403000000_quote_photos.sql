CREATE TABLE IF NOT EXISTS quote_photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_id UUID REFERENCES quotes(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL, -- base64 ou URL pública
  caption TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE quote_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage quote photos" ON quote_photos
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'sales', 'manager', 'technician')
    )
  );
