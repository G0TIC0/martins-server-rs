import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { UserProfile, UserRole, CompanySettings, EmailRecipient } from '../types';
import { useSupabase } from '../context/SupabaseContext';
import { mapProfile } from '../lib/utils';
import { Settings as SettingsIcon, User, Shield, Bell, Database, Save, CheckCircle, AlertCircle, FileText, Building2, Globe, Mail, Phone, MapPin, Image as ImageIcon, Plus, Trash2, ToggleLeft, ToggleRight, X } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

import { withRetry } from '../lib/supabase-retry';

import { toast } from 'sonner';

export const Settings: React.FC = () => {
  const { profile, isAdmin } = useSupabase();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [companySaving, setCompanySaving] = useState(false);
  const [emailRecipients, setEmailRecipients] = useState<EmailRecipient[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [newEmailLabel, setNewEmailLabel] = useState('');
  const [emailSaving, setEmailSaving] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);

  const [companyData, setCompanyData] = useState<CompanySettings>({
    id: '00000000-0000-0000-0000-000000000000',
    name: '',
    logoUrl: '',
    address: '',
    phone: '',
    email: '',
    website: '',
    updatedAt: new Date().toISOString(),
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log('[Settings] Fetching data...');
        if (isAdmin) {
          await fetchUsers();
        }
        await fetchCompanyData();
        await fetchEmailRecipients();
      } catch (error) {
        console.error('[Settings] Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();

    // Safety timeout
    const timeoutId = setTimeout(() => {
      setLoading(false);
    }, 5000);

    return () => clearTimeout(timeoutId);
  }, [isAdmin]);

  const fetchUsers = async () => {
    const { data, error } = await withRetry(async () => 
      await supabase.from('profiles').select('*').order('display_name')
    ) as { data: any[] | null; error: any };
    if (error) {
      console.error('Error fetching users:', error);
      return;
    }
    setUsers((data || []).map(mapProfile) as UserProfile[]);
  };

  const fetchCompanyData = async () => {
    const { data, error } = await withRetry(async () => 
      await supabase.from('company_settings').select('*').limit(1).single()
    ) as { data: any | null; error: any };
    if (error) {
      if (error.code !== 'PGRST116') { // Not found is okay for first time
        console.error('Error fetching company data:', error);
      }
      return;
    }
    if (data) {
      const company = data as any;
      setCompanyData({
        id: company.id,
        name: company.name,
        logoUrl: company.logo_url,
        address: company.address,
        phone: company.phone,
        email: company.email,
        website: company.website,
        updatedAt: company.updated_at,
      });
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 500000) { // 500KB limit for base64 in Firestore
        alert('A imagem é muito grande. Escolha uma imagem menor que 500KB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setCompanyData({ ...companyData, logoUrl: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCompanySave = async (e: React.FormEvent) => {
    e.preventDefault();
    setCompanySaving(true);
    try {
      const { error } = await withRetry(async () => 
        await supabase.from('company_settings').upsert({
          id: companyData.id,
          name: companyData.name,
          logo_url: companyData.logoUrl,
          address: companyData.address,
          phone: companyData.phone,
          email: companyData.email,
          website: companyData.website,
          updated_at: new Date().toISOString(),
        })
      ) as { error: any };
      if (error) throw error;
      alert('Dados da empresa salvos com sucesso!');
    } catch (error: any) {
      console.error('Error saving company data:', error);
      alert(`Erro ao salvar dados da empresa: ${error.message}`);
    } finally {
      setCompanySaving(false);
    }
  };

  const [tableMissing, setTableMissing] = useState(false);

  const fetchEmailRecipients = async () => {
    const { data, error } = await withRetry(async () => 
      await supabase.from('email_recipients').select('*').order('created_at')
    ) as { data: any[] | null; error: any };
    
    if (error) {
      if (error.code === 'PGRST204' || error.code === 'PGRST205' || error.message?.includes('not found')) {
        console.warn('[Settings] Table email_recipients not found. Database setup may be required.');
        setTableMissing(true);
        return;
      }
      console.error('Error fetching email recipients:', error);
      return;
    }
    setTableMissing(false);
    setEmailRecipients((data || []).map(r => ({
      id: r.id,
      email: r.email,
      label: r.label,
      active: r.active,
      createdAt: r.created_at
    })));
  };

  const copyMigrationSql = () => {
    const sql = `-- Criar tabela de E-mails Destinatários
CREATE TABLE IF NOT EXISTS email_recipients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL UNIQUE,
  label TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar Segurança (RLS)
ALTER TABLE email_recipients ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas se existirem para evitar erro de duplicidade
DROP POLICY IF EXISTS "Admin and Sales can manage email recipients" ON email_recipients;
DROP POLICY IF EXISTS "Staff can read email recipients" ON email_recipients;

-- Política para Administradores, Gestores e Vendedores gerenciarem e-mails
CREATE POLICY "Admin and Sales can manage email recipients" ON email_recipients
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'manager', 'sales')
    )
  );

-- Política para todos lerem os e-mails
CREATE POLICY "Staff can read email recipients" ON email_recipients
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'manager', 'sales', 'technician')
    )
  );`;
    
    navigator.clipboard.writeText(sql);
    toast.success('SQL de migração copiado para a área de transferência!');
  };

  const handleAddEmailRecipient = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = newEmail.trim();
    if (!email) {
      toast.error('O e-mail é obrigatório');
      return;
    }
    
    setEmailSaving(true);
    try {
      console.log('[Settings] Adding email recipient:', email);
      const { error } = await withRetry(async () => 
        await supabase.from('email_recipients').insert({
          email: email,
          label: newEmailLabel.trim(),
          active: true
        }).select()
      ) as { error: any };

      if (error) {
        console.error('[Settings] Supabase error adding email:', error);
        if (error.code === 'PGRST204' || error.code === 'PGRST205') {
          toast.error('Erro: A tabela de e-mails não foi encontrada no banco de dados. Por favor, execute as migrações SQL.');
          return;
        }
        throw error;
      }

      toast.success('E-mail cadastrado com sucesso!');
      setNewEmail('');
      setNewEmailLabel('');
      setShowEmailForm(false);
      await fetchEmailRecipients();
    } catch (error: any) {
      console.error('[Settings] Error adding email recipient:', error);
      toast.error(`Erro ao adicionar e-mail: ${error.message || 'Erro desconhecido'}`);
    } finally {
      setEmailSaving(false);
    }
  };

  const toggleEmailRecipient = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await withRetry(async () => 
        await supabase.from('email_recipients').update({ active: !currentStatus }).eq('id', id)
      ) as { error: any };
      if (error) throw error;
      await fetchEmailRecipients();
    } catch (error: any) {
      console.error('Error toggling email recipient:', error);
    }
  };

  const deleteEmailRecipient = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este e-mail?')) return;
    try {
      const { error } = await withRetry(async () => 
        await supabase.from('email_recipients').delete().eq('id', id)
      ) as { error: any };
      if (error) throw error;
      await fetchEmailRecipients();
    } catch (error: any) {
      console.error('Error deleting email recipient:', error);
    }
  };

  const updateUserRole = async (userId: string, newRole: UserRole) => {
    setSaving(true);
    try {
      const { error } = await withRetry(async () => 
        await supabase.from('profiles').update({ role: newRole }).eq('id', userId)
      ) as { error: any };
      if (error) throw error;
      fetchUsers();
      alert('Papel do usuário atualizado com sucesso!');
    } catch (error) {
      console.error('Error updating role:', error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-[#111827] border-t-transparent"></div></div>;

  return (
    <div className="max-w-4xl space-y-12 pb-12">
      {/* Company Data Section */}
      <section className="rounded-2xl border border-[#E5E7EB] bg-white p-8 shadow-sm">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3 text-[#111827]">
            <Building2 className="h-6 w-6" />
            <h2 className="text-xl font-bold">Dados da Empresa</h2>
          </div>
          <p className="text-xs text-[#6B7280]">Esses dados aparecerão nos seus orçamentos PDF.</p>
        </div>

        <form onSubmit={handleCompanySave} className="space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="col-span-full flex items-center gap-6 rounded-xl bg-[#F9FAFB] p-6">
              <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border-2 border-dashed border-[#E5E7EB] bg-white">
                {companyData.logoUrl ? (
                  <img src={companyData.logoUrl} alt="Logo" className="h-full w-full object-contain" referrerPolicy="no-referrer" />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center text-[#9CA3AF]">
                    <ImageIcon className="h-8 w-8" />
                    <span className="text-[10px] font-bold uppercase">Logo</span>
                  </div>
                )}
              </div>
              <div className="flex-1 space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-[#9CA3AF]">Carregar Logomarca</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="block w-full text-sm text-[#6B7280] file:mr-4 file:rounded-lg file:border-0 file:bg-[#111827] file:px-4 file:py-2 file:text-xs file:font-bold file:uppercase file:text-white hover:file:bg-black"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-[#9CA3AF]">OU URL da Logomarca</label>
                  <input
                    type="url"
                    placeholder="https://exemplo.com/logo.png"
                    value={companyData.logoUrl.startsWith('data:') ? '' : companyData.logoUrl}
                    onChange={(e) => setCompanyData({ ...companyData, logoUrl: e.target.value })}
                    className="h-10 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm focus:border-[#111827] focus:outline-none"
                  />
                  <p className="text-[10px] text-[#6B7280]">Insira a URL de uma imagem pública ou faça o upload acima.</p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-[#9CA3AF]">Nome da Empresa</label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
                <input
                  type="text"
                  required
                  value={companyData.name}
                  onChange={(e) => setCompanyData({ ...companyData, name: e.target.value })}
                  className="h-11 w-full rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] pl-10 pr-4 text-sm focus:border-[#111827] focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-[#9CA3AF]">Website</label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
                <input
                  type="url"
                  value={companyData.website}
                  onChange={(e) => setCompanyData({ ...companyData, website: e.target.value })}
                  className="h-11 w-full rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] pl-10 pr-4 text-sm focus:border-[#111827] focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-[#9CA3AF]">E-mail Comercial</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
                <input
                  type="email"
                  value={companyData.email}
                  onChange={(e) => setCompanyData({ ...companyData, email: e.target.value })}
                  className="h-11 w-full rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] pl-10 pr-4 text-sm focus:border-[#111827] focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-[#9CA3AF]">Telefone / WhatsApp</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
                <input
                  type="text"
                  value={companyData.phone}
                  onChange={(e) => setCompanyData({ ...companyData, phone: e.target.value })}
                  className="h-11 w-full rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] pl-10 pr-4 text-sm focus:border-[#111827] focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            <div className="col-span-full space-y-2">
              <label className="text-xs font-bold uppercase text-[#9CA3AF]">Endereço Completo</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
                <input
                  type="text"
                  value={companyData.address}
                  onChange={(e) => setCompanyData({ ...companyData, address: e.target.value })}
                  className="h-11 w-full rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] pl-10 pr-4 text-sm focus:border-[#111827] focus:bg-white focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={companySaving}
              className="flex items-center gap-2 rounded-xl bg-[#111827] px-8 py-3 text-sm font-bold text-white shadow-lg shadow-black/20 hover:bg-black disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {companySaving ? 'Salvando...' : 'Salvar Dados da Empresa'}
            </button>
          </div>
        </form>
      </section>

      {/* Profile Section */}
      <section className="rounded-2xl border border-[#E5E7EB] bg-white p-8 shadow-sm">
        <div className="mb-8 flex items-center gap-3 text-[#111827]">
          <User className="h-6 w-6" />
          <h2 className="text-xl font-bold">Meu Perfil</h2>
        </div>
        <div className="flex items-center gap-8">
          <img
            src={profile?.photoURL || 'https://picsum.photos/seed/user/100/100'}
            alt="Profile"
            className="h-24 w-24 rounded-2xl border-2 border-[#E5E7EB] object-cover"
            referrerPolicy="no-referrer"
          />
          <div className="space-y-1">
            <h3 className="text-2xl font-bold text-[#111827]">{profile?.displayName}</h3>
            <p className="text-[#6B7280]">{profile?.email}</p>
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-martins-blue px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#111827]">
              <Shield className="h-3 w-3" />
              {profile?.role}
            </div>
          </div>
        </div>
      </section>

      {/* User Management (Admin Only) */}
      {isAdmin && (
        <section className="rounded-2xl border border-[#E5E7EB] bg-white p-8 shadow-sm">
          <div className="mb-8 flex items-center gap-3 text-[#111827]">
            <Shield className="h-6 w-6" />
            <h2 className="text-xl font-bold">Gestão de Usuários</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#F3F4F6] text-xs font-semibold uppercase tracking-wider text-[#9CA3AF]">
                  <th className="pb-4 pl-2">Usuário</th>
                  <th className="pb-4">E-mail</th>
                  <th className="pb-4">Papel</th>
                  <th className="pb-4 pr-2 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {users.map((u, index) => (
                  <tr key={u.uid || index} className="group">
                    <td className="py-4 pl-2">
                      <div className="flex items-center gap-3">
                        <img src={u.photoURL} className="h-8 w-8 rounded-full" referrerPolicy="no-referrer" />
                        <span className="font-medium text-[#111827]">{u.displayName}</span>
                      </div>
                    </td>
                    <td className="py-4 text-sm text-[#6B7280]">{u.email}</td>
                    <td className="py-4">
                      <select
                        value={u.role}
                        onChange={(e) => updateUserRole(u.uid, e.target.value as UserRole)}
                        disabled={u.uid === profile?.uid}
                        className="rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-2 py-1 text-xs font-medium focus:outline-none disabled:opacity-50"
                      >
                        <option value="admin">Admin</option>
                        <option value="manager">Gestor</option>
                        <option value="sales">Vendedor</option>
                        <option value="finance">Financeiro</option>
                      </select>
                    </td>
                    <td className="py-4 pr-2 text-right">
                      {u.uid === profile?.uid && <span className="text-[10px] font-bold uppercase text-[#111827]">Você</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Email Recipients Section */}
      <section className="rounded-2xl border border-[#E5E7EB] bg-white p-8 shadow-sm">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3 text-[#111827]">
            <Mail className="h-6 w-6" />
            <h2 className="text-xl font-bold">E-mails para Envio de Orçamentos</h2>
          </div>
          <div className="flex items-center gap-4">
            <p className="hidden text-xs text-[#6B7280] sm:block">Destinatários fixos para novos envios.</p>
            {(profile?.role === 'admin' || profile?.role === 'manager' || profile?.role === 'sales') && !tableMissing && (
              <button
                onClick={() => setShowEmailForm(!showEmailForm)}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all",
                  showEmailForm 
                    ? "bg-[#F3F4F6] text-[#6B7280] hover:bg-[#E5E7EB]" 
                    : "bg-[#111827] text-white hover:bg-black shadow-md"
                )}
              >
                {showEmailForm ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                {showEmailForm ? 'Cancelar' : 'Cadastrar Novo'}
              </button>
            )}
          </div>
        </div>

        <div className="space-y-6">
          {tableMissing ? (
            <div className="rounded-2xl bg-amber-50 p-8 text-center border border-amber-100">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                <AlertCircle className="h-8 w-8" />
              </div>
              <h3 className="mb-2 text-lg font-bold text-amber-900">Banco de Dados não Configurado</h3>
              <p className="mb-6 text-sm text-amber-800 max-w-md mx-auto">
                A tabela de e-mails ainda não foi criada no seu Supabase. 
                Para corrigir isso, copie o código SQL abaixo e execute-o no **SQL Editor** do seu painel Supabase.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  onClick={copyMigrationSql}
                  className="flex items-center gap-2 rounded-xl bg-amber-600 px-6 py-3 text-sm font-bold text-white hover:bg-amber-700 transition-all shadow-md"
                >
                  <FileText className="h-4 w-4" />
                  Copiar SQL de Migração
                </button>
                <a 
                  href="https://app.supabase.com" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-xl bg-white border border-amber-200 px-6 py-3 text-sm font-bold text-amber-700 hover:bg-amber-100 transition-all"
                >
                  Abrir Supabase
                </a>
              </div>
            </div>
          ) : (profile?.role === 'admin' || profile?.role === 'manager' || profile?.role === 'sales') && showEmailForm && (
            <motion.form 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              onSubmit={handleAddEmailRecipient} 
              className="grid grid-cols-1 gap-4 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-6 sm:grid-cols-3"
            >
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase text-[#9CA3AF]">E-mail</label>
                <input
                  type="email"
                  required
                  placeholder="exemplo@email.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-4 text-sm focus:border-[#111827] focus:outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase text-[#9CA3AF]">Apelido (Opcional)</label>
                <input
                  type="text"
                  placeholder="Ex: Financeiro"
                  value={newEmailLabel}
                  onChange={(e) => setNewEmailLabel(e.target.value)}
                  className="h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-4 text-sm focus:border-[#111827] focus:outline-none"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={emailSaving}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#111827] text-sm font-bold text-white hover:bg-black disabled:opacity-50 transition-all active:scale-95"
                >
                  {emailSaving ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  {emailSaving ? 'Adicionando...' : 'Adicionar'}
                </button>
              </div>
            </motion.form>
          )}

          <div className="overflow-hidden rounded-xl border border-[#E5E7EB]">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-[#F9FAFB] text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF]">
                  <th className="px-6 py-3">E-mail</th>
                  <th className="px-6 py-3">Apelido</th>
                  <th className="px-6 py-3">Status</th>
                  {(profile?.role === 'admin' || profile?.role === 'manager' || profile?.role === 'sales') && (
                    <th className="px-6 py-3 text-right">Ações</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]">
                {emailRecipients.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <Mail className="h-8 w-8 text-[#E5E7EB]" />
                        <p className="text-sm text-[#6B7280]">Nenhum e-mail cadastrado.</p>
                        {(profile?.role === 'admin' || profile?.role === 'manager' || profile?.role === 'sales') && !showEmailForm && (
                          <button
                            onClick={() => setShowEmailForm(true)}
                            className="mt-2 rounded-lg border border-[#111827] px-4 py-2 text-xs font-bold text-[#111827] hover:bg-[#111827] hover:text-white transition-all"
                          >
                            Cadastrar Primeiro E-mail
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  emailRecipients.map((recipient) => (
                    <tr key={recipient.id} className="group hover:bg-[#F9FAFB]">
                      <td className="px-6 py-4 text-sm font-medium text-[#111827]">{recipient.email}</td>
                      <td className="px-6 py-4 text-sm text-[#6B7280]">{recipient.label || '-'}</td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => (profile?.role === 'admin' || profile?.role === 'manager' || profile?.role === 'sales') && toggleEmailRecipient(recipient.id, recipient.active)}
                          className={cn(
                            "flex items-center gap-1 text-xs font-bold uppercase",
                            recipient.active ? "text-green-600" : "text-gray-400",
                            (profile?.role === 'admin' || profile?.role === 'manager' || profile?.role === 'sales') ? "cursor-pointer" : "cursor-default"
                          )}
                        >
                          {recipient.active ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
                          {recipient.active ? 'Ativo' : 'Inativo'}
                        </button>
                      </td>
                      {(profile?.role === 'admin' || profile?.role === 'manager' || profile?.role === 'sales') && (
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => deleteEmailRecipient(recipient.id)}
                            className="text-red-500 opacity-0 transition-opacity hover:text-red-700 group-hover:opacity-100"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* System Info */}
      <section className="rounded-2xl border border-[#E5E7EB] bg-white p-8 shadow-sm">
        <div className="mb-8 flex items-center gap-3 text-[#111827]">
          <Database className="h-6 w-6" />
          <h2 className="text-xl font-bold">Informações do Sistema</h2>
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div className="rounded-xl bg-[#F9FAFB] p-4">
            <p className="text-xs font-bold uppercase text-[#9CA3AF]">Versão do App</p>
            <p className="mt-1 font-medium text-[#111827]">v1.0.0-MARTINS</p>
          </div>
          <div className="rounded-xl bg-[#F9FAFB] p-4">
            <p className="text-xs font-bold uppercase text-[#9CA3AF]">Status do Banco</p>
            <div className="mt-1 flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-[#10B981]"></div>
              <p className="font-medium text-[#111827]">Conectado (Supabase)</p>
            </div>
          </div>
          <div className="rounded-xl bg-[#F9FAFB] p-4">
            <p className="text-xs font-bold uppercase text-[#9CA3AF]">IA Engine</p>
            <p className="mt-1 font-medium text-[#111827]">Gemini 3 Flash</p>
          </div>
          <div className="rounded-xl bg-[#F9FAFB] p-4">
            <p className="text-xs font-bold uppercase text-[#9CA3AF]">Última Atualização</p>
            <p className="mt-1 font-medium text-[#111827]">29 de Março de 2026</p>
          </div>
        </div>
      </section>
    </div>
  );
};
