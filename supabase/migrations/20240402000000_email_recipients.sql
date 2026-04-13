CREATE TABLE IF NOT EXISTS email_recipients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL UNIQUE,
  label TEXT, -- apelido/nome do destinatário (ex: "Financeiro", "Gerente")
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE email_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and Sales can manage email recipients" ON email_recipients
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'manager', 'sales')
    )
  );

CREATE POLICY "Staff can read email recipients" ON email_recipients
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'manager', 'sales', 'technician')
    )
  );
