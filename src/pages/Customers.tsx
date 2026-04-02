import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Customer } from '../types';
import { useSupabase } from '../context/SupabaseContext';
import { Plus, Search, Edit2, Trash2, X, User, Mail, Phone, FileText, MapPin } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, mapCustomer } from '../lib/utils';

export const Customers: React.FC = () => {
  const { profile } = useSupabase();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    document: '',
    email: '',
    phone: '',
    address: '',
    observations: '',
  });

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      const mappedData = (data || []).map(mapCustomer);
      setCustomers(mappedData);
    } catch (error) {
      console.error('Error fetching customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    const performSave = async (retryCount = 0): Promise<void> => {
      try {
        if (editingCustomer) {
          const { error } = await supabase
            .from('customers')
            .update({
              ...formData,
              updated_at: new Date().toISOString(),
            })
            .eq('id', editingCustomer.id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('customers')
            .insert({
              ...formData,
              created_by: profile?.uid,
            });
          if (error) throw error;
        }
        
        setIsModalOpen(false);
        setEditingCustomer(null);
        setFormData({ name: '', document: '', email: '', phone: '', address: '', observations: '' });
        fetchCustomers();
      } catch (error: any) {
        // Handle the specific "stolen lock" error by retrying once after a short delay
        if (error.message?.includes('stole it') && retryCount < 2) {
          console.warn(`[Customers] Auth lock stolen, retrying save (attempt ${retryCount + 1})...`);
          await new Promise(resolve => setTimeout(resolve, 500));
          return performSave(retryCount + 1);
        }
        
        console.error('Error saving customer:', error);
        alert(`Erro ao salvar cliente: ${error.message || 'Verifique se o CPF/CNPJ já está cadastrado.'}`);
      } finally {
        setSaving(false);
      }
    };

    await performSave();
  };

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      document: customer.document,
      email: customer.email || '',
      phone: customer.phone || '',
      address: customer.address,
      observations: customer.observations,
    });
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    setDeleteConfirmId(id);
  };

  const confirmDelete = async () => {
    if (!deleteConfirmId) return;
    try {
      const { error } = await supabase.from('customers').delete().eq('id', deleteConfirmId);
      if (error) throw error;
      fetchCustomers();
    } catch (error) {
      console.error('Error deleting customer:', error);
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const filteredCustomers = React.useMemo(() => 
    customers.filter(c =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.document.includes(searchTerm) ||
      c.email.toLowerCase().includes(searchTerm.toLowerCase())
    ),
    [customers, searchTerm]
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#9CA3AF]" />
          <input
            type="text"
            placeholder="Buscar clientes por nome, CPF/CNPJ ou e-mail..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-11 w-full rounded-xl border border-[#E5E7EB] bg-white pl-10 pr-4 text-sm shadow-sm focus:border-[#111827] focus:outline-none focus:ring-1 focus:ring-[#111827]"
          />
        </div>
        <button
          onClick={() => {
            setEditingCustomer(null);
            setFormData({ name: '', document: '', email: '', phone: '', address: '', observations: '' });
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 rounded-xl bg-[#111827] px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#111827]/20 transition-all hover:bg-black hover:shadow-xl active:scale-95"
        >
          <Plus className="h-5 w-5" />
          Novo Cliente
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredCustomers.map((customer) => (
          <motion.div
            key={customer.id}
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="group relative rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm transition-all hover:shadow-md"
          >
            <div className="mb-4 flex items-start justify-between">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-martins-blue text-[#111827]">
                <User className="h-6 w-6" />
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleEdit(customer)}
                  className="rounded-lg p-2 text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827]"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDelete(customer.id)}
                  className="rounded-lg p-2 text-[#6B7280] hover:bg-[#FEF2F2] hover:text-[#EF4444]"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            <h3 className="text-lg font-bold text-[#111827]">{customer.name}</h3>
            <p className="text-sm text-[#6B7280]">{customer.document}</p>

            <div className="mt-4 space-y-2">
              {customer.email && (
                <div className="flex items-center gap-2 text-sm text-[#4B5563]">
                  <Mail className="h-4 w-4 text-[#9CA3AF]" />
                  {customer.email}
                </div>
              )}
              {customer.phone && (
                <div className="flex items-center gap-2 text-sm text-[#4B5563]">
                  <Phone className="h-4 w-4 text-[#9CA3AF]" />
                  {customer.phone}
                </div>
              )}
              <div className="flex items-center gap-2 text-sm text-[#4B5563]">
                <MapPin className="h-4 w-4 text-[#9CA3AF]" />
                <span className="truncate">{customer.address}</span>
              </div>
            </div>
          </motion.div>
        ))}
        {filteredCustomers.length === 0 && !loading && (
          <div className="col-span-full py-12 text-center text-[#9CA3AF]">Nenhum cliente encontrado.</div>
        )}
      </div>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-2xl rounded-2xl bg-white p-8 shadow-2xl"
            >
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-[#111827]">
                  {editingCustomer ? 'Editar Cliente' : 'Novo Cliente'}
                </h2>
                <button onClick={() => setIsModalOpen(false)} className="rounded-lg p-2 hover:bg-[#F3F4F6]">
                  <X className="h-6 w-6 text-[#6B7280]" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-[#374151]">Nome Completo / Razão Social</label>
                    <input
                      required
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="h-11 w-full rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 text-sm focus:border-[#111827] focus:outline-none focus:ring-1 focus:ring-[#111827]"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-[#374151]">CPF / CNPJ</label>
                    <input
                      required
                      type="text"
                      value={formData.document}
                      onChange={(e) => setFormData({ ...formData, document: e.target.value })}
                      className="h-11 w-full rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 text-sm focus:border-[#111827] focus:outline-none focus:ring-1 focus:ring-[#111827]"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-[#374151]">E-mail</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="h-11 w-full rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 text-sm focus:border-[#111827] focus:outline-none focus:ring-1 focus:ring-[#111827]"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-[#374151]">Telefone</label>
                    <input
                      type="text"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="h-11 w-full rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 text-sm focus:border-[#111827] focus:outline-none focus:ring-1 focus:ring-[#111827]"
                    />
                  </div>
                  <div className="col-span-full space-y-2">
                    <label className="text-sm font-semibold text-[#374151]">Endereço Completo</label>
                    <input
                      type="text"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="h-11 w-full rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 text-sm focus:border-[#111827] focus:outline-none focus:ring-1 focus:ring-[#111827]"
                    />
                  </div>
                  <div className="col-span-full space-y-2">
                    <label className="text-sm font-semibold text-[#374151]">Observações</label>
                    <textarea
                      rows={3}
                      value={formData.observations}
                      onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
                      className="w-full rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-4 text-sm focus:border-[#111827] focus:outline-none focus:ring-1 focus:ring-[#111827]"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="rounded-xl px-6 py-2.5 text-sm font-semibold text-[#6B7280] hover:bg-[#F3F4F6]"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-xl bg-[#111827] px-8 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#111827]/20 hover:bg-black disabled:opacity-50"
                  >
                    {saving ? 'Salvando...' : 'Salvar Cliente'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirmId && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl"
            >
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[#FEF2F2] text-[#EF4444]">
                <Trash2 className="h-8 w-8" />
              </div>
              <h2 className="mb-2 text-xl font-bold text-[#111827]">Excluir Cliente</h2>
              <p className="mb-8 text-[#6B7280]">
                Tem certeza que deseja excluir este cliente? Esta ação não pode ser desfeita e pode afetar orçamentos vinculados.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setDeleteConfirmId(null)}
                  className="rounded-xl px-6 py-2.5 text-sm font-semibold text-[#6B7280] hover:bg-[#F3F4F6]"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmDelete}
                  className="rounded-xl bg-[#EF4444] px-8 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#EF4444]/20 hover:bg-[#DC2626]"
                >
                  Excluir
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
