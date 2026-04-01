import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { UserProfile, UserRole, CompanySettings } from '../types';
import { useSupabase } from '../context/SupabaseContext';
import { mapProfile } from '../lib/utils';
import { Settings as SettingsIcon, User, Shield, Bell, Database, Save, CheckCircle, AlertCircle, Building2, Globe, Mail, Phone, MapPin, Image as ImageIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

export const Settings: React.FC = () => {
  const { profile, isAdmin } = useSupabase();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [companySaving, setCompanySaving] = useState(false);

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
    const { data, error } = await supabase.from('profiles').select('*').order('display_name');
    if (error) {
      console.error('Error fetching users:', error);
      return;
    }
    setUsers((data || []).map(mapProfile));
  };

  const fetchCompanyData = async () => {
    const { data, error } = await supabase.from('company_settings').select('*').limit(1).single();
    if (error) {
      if (error.code !== 'PGRST116') { // Not found is okay for first time
        console.error('Error fetching company data:', error);
      }
      return;
    }
    if (data) {
      setCompanyData({
        id: data.id,
        name: data.name,
        logoUrl: data.logo_url,
        address: data.address,
        phone: data.phone,
        email: data.email,
        website: data.website,
        updatedAt: data.updated_at,
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
      const { error } = await supabase.from('company_settings').upsert({
        id: companyData.id,
        name: companyData.name,
        logo_url: companyData.logoUrl,
        address: companyData.address,
        phone: companyData.phone,
        email: companyData.email,
        website: companyData.website,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      alert('Dados da empresa salvos com sucesso!');
    } catch (error: any) {
      console.error('Error saving company data:', error);
      alert(`Erro ao salvar dados da empresa: ${error.message}`);
    } finally {
      setCompanySaving(false);
    }
  };

  const updateUserRole = async (userId: string, newRole: UserRole) => {
    setSaving(true);
    try {
      const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
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
                {users.map((u) => (
                  <tr key={u.uid} className="group">
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
