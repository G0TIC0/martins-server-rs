import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Item, ItemType, Ncm } from '../types';
import { useSupabase } from '../context/SupabaseContext';
import { Plus, Search, Edit2, Trash2, X, Package, Tag, DollarSign, Box, Layers, Sparkles, User, Info, Hash, PlusCircle, ChevronDown, Save, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatCurrency, mapItem, mapNcm } from '../lib/utils';
import { suggestServiceDescription } from '../services/geminiService';

import { withRetry } from '../lib/supabase-retry';

export const Items: React.FC = () => {
  const { isManager, profile } = useSupabase();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [ncms, setNcms] = useState<Ncm[]>([]);
  const [ncmSuggestions, setNcmSuggestions] = useState<Ncm[]>([]);
  const [showNcmSuggestions, setShowNcmSuggestions] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'product' as ItemType,
    basePrice: 0,
    unit: 'un',
    active: true,
    ncm: '',
    ncmDescription: '',
    fci: '',
    partCodes: [] as string[],
    observations: '',
  });

  const [newPartCode, setNewPartCode] = useState('');

  useEffect(() => {
    fetchItems();
    fetchNcms();
  }, []);

  const fetchNcms = async () => {
    try {
      const { data, error } = await withRetry(async () => 
        await supabase
          .from('ncms')
          .select('*')
          .order('code', { ascending: true })
      ) as { data: any[] | null; error: any };

      if (error) throw error;
      const mappedData = (data || []).map(mapNcm);
      setNcms(mappedData as Ncm[]);
    } catch (error) {
      console.error('Error fetching NCMs:', error);
    }
  };

  const fetchItems = async () => {
    try {
      const { data, error } = await withRetry(async () => 
        await supabase
          .from('items')
          .select('*')
          .order('name', { ascending: true })
      ) as { data: any[] | null; error: any };

      if (error) throw error;
      const mappedData = (data || []).map(mapItem);
      setItems(mappedData as Item[]);
    } catch (error) {
      console.error('Error fetching items:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isManager) return;
    setSaving(true);

    try {
      // Save or update NCM in the ncms collection
      if (formData.ncm && formData.ncmDescription) {
        const { error: ncmError } = await withRetry(async () => 
          await supabase
            .from('ncms')
            .upsert({
              code: formData.ncm,
              description: formData.ncmDescription,
              updated_at: new Date().toISOString(),
            }, { onConflict: 'code' })
        ) as { error: any };
        
        if (ncmError) throw ncmError;
        fetchNcms();
      }

      const itemData = {
        name: formData.name,
        description: formData.description,
        type: formData.type,
        base_price: formData.basePrice,
        unit: formData.unit,
        active: formData.active,
        ncm: formData.ncm,
        ncm_description: formData.ncmDescription,
        fci: formData.fci,
        part_codes: formData.partCodes,
        observations: formData.observations,
        updated_at: new Date().toISOString(),
      };

      if (editingId) {
        const { error } = await withRetry(async () => 
          await supabase
            .from('items')
            .update(itemData)
            .eq('id', editingId)
        ) as { error: any };
        if (error) throw error;
      } else {
        const { error } = await withRetry(async () => 
          await supabase
            .from('items')
            .insert({
              ...itemData,
              created_by: profile?.uid,
            })
        ) as { error: any };
        if (error) throw error;
      }
      resetForm();
      fetchItems();
      setIsModalOpen(false);
    } catch (error: any) {
      console.error('Error saving item:', error);
      alert(`Erro ao salvar item: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      name: '',
      description: '',
      type: 'product',
      basePrice: 0,
      unit: 'un',
      active: true,
      ncm: '',
      ncmDescription: '',
      fci: '',
      partCodes: [],
      observations: '',
    });
    setNewPartCode('');
  };

  const openCreateModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleEdit = (item: Item) => {
    setEditingId(item.id);
    setFormData({
      name: item.name,
      description: item.description || '',
      type: item.type,
      basePrice: item.basePrice,
      unit: item.unit,
      active: item.active,
      ncm: item.ncm || '',
      ncmDescription: item.ncmDescription || '',
      fci: item.fci || '',
      partCodes: item.partCodes || [],
      observations: item.observations || '',
    });
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    if (!isManager) return;
    setDeleteConfirmId(id);
  };

  const confirmDelete = async () => {
    if (!deleteConfirmId) return;
    try {
      const { error } = await supabase.from('items').delete().eq('id', deleteConfirmId);
      if (error) throw error;
      fetchItems();
    } catch (error) {
      console.error('Error deleting item:', error);
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const handleAiSuggest = async () => {
    if (!formData.name) return;
    setIsAiLoading(true);
    try {
      const suggestion = await suggestServiceDescription(formData.name, formData.type);
      setFormData({ ...formData, description: suggestion || '' });
    } catch (error) {
      console.error('AI error:', error);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleNcmChange = (value: string) => {
    setFormData({ ...formData, ncm: value });
    if (value.length > 0) {
      const searchTerm = value.toLowerCase();
      const filtered = ncms.filter(n => 
        n.code.toLowerCase().includes(searchTerm) || 
        n.description.toLowerCase().includes(searchTerm)
      );
      setNcmSuggestions(filtered);
      setShowNcmSuggestions(true);
    } else {
      setShowNcmSuggestions(false);
    }
  };

  const selectNcm = (ncm: Ncm) => {
    setFormData({ 
      ...formData, 
      ncm: ncm.code, 
      ncmDescription: ncm.description 
    });
    setShowNcmSuggestions(false);
  };

  const addPartCode = () => {
    if (newPartCode && !formData.partCodes.includes(newPartCode)) {
      setFormData({ ...formData, partCodes: [...formData.partCodes, newPartCode] });
      setNewPartCode('');
    }
  };

  const removePartCode = (code: string) => {
    setFormData({ ...formData, partCodes: formData.partCodes.filter(c => c !== code) });
  };

  const filteredItems = React.useMemo(() => 
    items.filter(i =>
      i.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (i.ncm && i.ncm.includes(searchTerm)) ||
      (i.partCodes && i.partCodes.some(c => c.toLowerCase().includes(searchTerm.toLowerCase())))
    ),
    [items, searchTerm]
  );

  const typeConfig: Record<ItemType, { label: string; icon: any; color: string }> = {
    service: { label: 'Serviço', icon: Sparkles, color: 'text-[#111827] bg-martins-blue' },
    product: { label: 'Produto', icon: Box, color: 'text-emerald-600 bg-emerald-50' },
    package: { label: 'Pacote', icon: Layers, color: 'text-purple-600 bg-purple-50' },
    labor: { label: 'Mão de Obra', icon: User, color: 'text-amber-600 bg-amber-50' },
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-martins-blue text-[#111827]">
            <Package className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#111827]">Catálogo de Itens</h1>
            <p className="text-sm text-[#6B7280]">Gerencie seus produtos e serviços.</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
            <input
              type="text"
              placeholder="Buscar item ou NCM..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-11 w-full rounded-xl border border-[#E5E7EB] bg-white pl-10 pr-4 text-sm shadow-sm focus:border-[#111827] focus:outline-none transition-all"
            />
          </div>
          {isManager && (
            <button
              onClick={openCreateModal}
              className="flex items-center gap-2 rounded-xl bg-[#111827] px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-black/20 hover:bg-black transition-all active:scale-95"
            >
              <Plus className="h-5 w-5" />
              Cadastrar Item
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <AnimatePresence mode="popLayout">
          {filteredItems.map((item) => {
            const Icon = typeConfig[item.type].icon;
            const config = typeConfig[item.type];

            return (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="group relative flex flex-col rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm transition-all hover:shadow-md"
              >
                <div className="mb-4 flex items-start justify-between">
                  <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", config.color)}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex items-center gap-1">
                    <span className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                      item.active ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                    )}>
                      {item.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                </div>

                <div className="mb-4 flex-1">
                  <h3 className="text-sm font-bold text-[#111827] uppercase line-clamp-2 mb-1">{item.name}</h3>
                  <p className="text-xs text-[#6B7280] line-clamp-2">{item.description}</p>
                </div>

                  <div className="mb-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase text-[#9CA3AF]">Preço Base</span>
                      <span className="text-sm font-black text-[#111827]">{formatCurrency(item.basePrice)}</span>
                    </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase text-[#9CA3AF]">Unidade</span>
                    <span className="text-xs font-medium text-[#4B5563] uppercase">{item.unit}</span>
                  </div>
                  {item.ncm && (
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase text-[#9CA3AF]">NCM</span>
                      <span className="text-xs font-medium text-[#111827] bg-martins-blue px-1.5 py-0.5 rounded">{item.ncm}</span>
                    </div>
                  )}
                </div>

                {item.partCodes && item.partCodes.length > 0 && (
                  <div className="mb-4 flex flex-wrap gap-1">
                    {item.partCodes.slice(0, 2).map(code => (
                      <span key={code} className="inline-flex items-center gap-1 rounded bg-gray-50 px-1.5 py-0.5 text-[9px] font-medium text-gray-500 border border-gray-100">
                        <Tag className="h-2.5 w-2.5" />
                        {code}
                      </span>
                    ))}
                    {item.partCodes.length > 2 && (
                      <span className="text-[9px] text-gray-400 font-medium">+{item.partCodes.length - 2}</span>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-4 border-t border-[#F3F4F6]">
                  {isManager && (
                    <>
                      <button
                        onClick={() => handleEdit(item)}
                        className="rounded-lg p-2 text-[#6B7280] hover:bg-martins-blue hover:text-[#111827] transition-colors"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="rounded-lg p-2 text-[#6B7280] hover:bg-red-50 hover:text-[#EF4444] transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Registration Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-3xl bg-white shadow-2xl flex flex-col"
            >
              <div className="flex items-center justify-between border-b border-[#E5E7EB] px-8 py-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-martins-blue text-[#111827]">
                    {editingId ? <Edit2 className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-[#111827]">
                      {editingId ? 'Editar Item' : 'Cadastrar Novo Item'}
                    </h2>
                    <p className="text-xs text-[#6B7280]">Preencha os dados técnicos do item.</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl p-2 text-[#9CA3AF] hover:bg-[#F3F4F6] hover:text-[#111827] transition-colors"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div className="space-y-1.5 md:col-span-2">
                      <label className="text-sm font-bold text-[#111827]">Nome/Descrição do Item</label>
                      <input
                        required
                        type="text"
                        placeholder="Ex: Serviço de instalação de ar condicionado"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="h-12 w-full rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 text-sm focus:border-[#111827] focus:bg-white focus:outline-none transition-all"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-bold text-[#111827]">Tipo de Item</label>
                      <div className="relative">
                        <select
                          value={formData.type}
                          onChange={(e) => setFormData({ ...formData, type: e.target.value as ItemType })}
                          className="h-12 w-full rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 text-sm focus:border-[#111827] focus:bg-white focus:outline-none transition-all appearance-none"
                        >
                          <option value="product">Produto</option>
                          <option value="service">Serviço</option>
                          <option value="package">Pacote</option>
                          <option value="labor">Mão de Obra</option>
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF] pointer-events-none" />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-bold text-[#111827]">Unidade de Medida</label>
                      <div className="relative">
                        <select
                          value={formData.unit}
                          onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                          className="h-12 w-full rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 text-sm focus:border-[#111827] focus:bg-white focus:outline-none transition-all appearance-none"
                        >
                          <option value="un">Unidade (un)</option>
                          <option value="pc">Peça (pc)</option>
                          <option value="kg">Quilograma (kg)</option>
                          <option value="mt">Metro (mt)</option>
                          <option value="hr">Hora (hr)</option>
                          <option value="serv">Serviço (serv)</option>
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF] pointer-events-none" />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-bold text-[#111827]">Valor Unitário (R$)</label>
                      <div className="relative">
                        <DollarSign className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
                        <input
                          required
                          type="number"
                          step="0.01"
                          placeholder="0,00"
                          value={formData.basePrice || ''}
                          onChange={(e) => setFormData({ ...formData, basePrice: parseFloat(e.target.value) || 0 })}
                          className="h-12 w-full rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] pl-10 pr-4 text-sm focus:border-[#111827] focus:bg-white focus:outline-none transition-all"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5 relative">
                      <label className="text-sm font-bold text-[#111827]">NCM (Fiscal)</label>
                      <div className="relative">
                        <Hash className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
                        <input
                          type="text"
                          placeholder="Ex: 84719012"
                          value={formData.ncm}
                          onChange={(e) => handleNcmChange(e.target.value)}
                          onFocus={() => formData.ncm.length > 1 && setShowNcmSuggestions(true)}
                          className="h-12 w-full rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] pl-10 pr-4 text-sm focus:border-[#111827] focus:bg-white focus:outline-none transition-all"
                        />
                      </div>
                      
                      <AnimatePresence>
                        {showNcmSuggestions && (
                          <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="absolute z-[70] left-0 right-0 mt-1 max-h-60 overflow-y-auto rounded-xl border border-[#E5E7EB] bg-white shadow-xl custom-scrollbar"
                          >
                            {ncmSuggestions.length > 0 ? (
                              ncmSuggestions.map((ncm) => (
                                <button
                                  key={ncm.id}
                                  type="button"
                                  onClick={() => selectNcm(ncm)}
                                  className="flex w-full flex-col px-4 py-3 text-left hover:bg-[#F9FAFB] transition-colors border-b border-[#F3F4F6] last:border-0"
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm font-bold text-[#111827]">{ncm.code}</span>
                                    {formData.ncm === ncm.code && <Check className="h-4 w-4 text-emerald-500" />}
                                  </div>
                                  <span className="text-xs text-[#6B7280] line-clamp-1">{ncm.description}</span>
                                </button>
                              ))
                            ) : (
                              <div className="px-4 py-3 text-xs text-[#9CA3AF] italic">
                                Nenhum NCM encontrado.
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                      {showNcmSuggestions && (
                        <div 
                          className="fixed inset-0 z-[65]" 
                          onClick={() => setShowNcmSuggestions(false)} 
                        />
                      )}
                    </div>

                    <div className="space-y-1.5 md:col-span-2">
                      <label className="text-sm font-bold text-[#111827]">Descrição NCM</label>
                      <input
                        type="text"
                        placeholder="Ex: Partes de máquinas automáticas para processamento de dados"
                        value={formData.ncmDescription}
                        onChange={(e) => setFormData({ ...formData, ncmDescription: e.target.value })}
                        className="h-12 w-full rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 text-sm focus:border-[#111827] focus:bg-white focus:outline-none transition-all"
                      />
                    </div>

                    <div className="space-y-1.5 md:col-span-2">
                      <label className="text-sm font-bold text-[#111827]">FCI (Opcional)</label>
                      <input
                        type="text"
                        placeholder="Ex: 19F8FF0E-A8C2-4718-A35D-D3F5FE247173"
                        value={formData.fci}
                        onChange={(e) => setFormData({ ...formData, fci: e.target.value })}
                        className="h-12 w-full rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 text-sm focus:border-[#111827] focus:bg-white focus:outline-none transition-all"
                      />
                    </div>

                    <div className="space-y-3 md:col-span-2 rounded-2xl border border-[#E5E7EB] bg-[#F9FAFB] p-5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-[#111827]">
                          <Tag className="h-4 w-4" />
                          <span className="text-sm font-bold">Códigos de Peça (Part Codes)</span>
                        </div>
                        <span className="text-[10px] font-bold text-[#9CA3AF] uppercase">Vincule múltiplos códigos</span>
                      </div>
                      
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Digite um código e clique em +"
                          value={newPartCode}
                          onChange={(e) => setNewPartCode(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addPartCode())}
                          className="h-11 flex-1 rounded-xl border border-[#E5E7EB] bg-white px-4 text-sm focus:border-[#111827] focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={addPartCode}
                          className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#111827] text-white hover:bg-black transition-colors shadow-md shadow-black/20"
                        >
                          <Plus className="h-5 w-5" />
                        </button>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {formData.partCodes.map((code) => (
                          <span
                            key={code}
                            className="flex items-center gap-2 rounded-lg bg-white border border-[#E5E7EB] px-3 py-1.5 text-xs font-bold text-[#374151] shadow-sm"
                          >
                            <Tag className="h-3 w-3 text-[#111827]" />
                            {code}
                            <button
                              type="button"
                              onClick={() => removePartCode(code)}
                              className="ml-1 text-[#9CA3AF] hover:text-[#EF4444] transition-colors"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </span>
                        ))}
                        {formData.partCodes.length === 0 && (
                          <p className="text-xs text-[#9CA3AF] italic">Nenhum código vinculado.</p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1.5 md:col-span-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-bold text-[#111827]">Descrição Técnica / Observações</label>
                        <button
                          type="button"
                          onClick={handleAiSuggest}
                          disabled={isAiLoading || !formData.name}
                          className="flex items-center gap-1.5 rounded-lg bg-martins-blue px-3 py-1.5 text-[10px] font-bold text-[#111827] hover:bg-white transition-colors disabled:opacity-50"
                        >
                          <Sparkles className={cn("h-3 w-3", isAiLoading && "animate-pulse")} />
                          {isAiLoading ? 'Analisando...' : 'Sugerir com IA'}
                        </button>
                      </div>
                      <textarea
                        rows={4}
                        placeholder="Detalhes técnicos, especificações ou notas internas..."
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        className="w-full rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-4 text-sm focus:border-[#111827] focus:bg-white focus:outline-none transition-all"
                      />
                    </div>

                    <div className="flex items-center gap-3 md:col-span-2">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, active: !formData.active })}
                        className={cn(
                          "flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
                          formData.active ? "bg-[#10B981]" : "bg-[#D1D5DB]"
                        )}
                      >
                        <div className={cn(
                          "h-4 w-4 transform rounded-full bg-white transition-transform",
                          formData.active ? "translate-x-6" : "translate-x-1"
                        )} />
                      </button>
                      <span className="text-sm font-medium text-[#374151]">
                        Item {formData.active ? 'Ativo' : 'Inativo'} no Catálogo
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 pt-6 border-t border-[#F3F4F6]">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="flex-1 h-12 rounded-xl border border-[#E5E7EB] text-sm font-bold text-[#6B7280] hover:bg-[#F9FAFB] transition-all"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="flex-[2] h-12 flex items-center justify-center gap-2 rounded-xl bg-[#111827] text-sm font-bold text-white shadow-lg shadow-black/20 hover:bg-black transition-all active:scale-[0.98] disabled:opacity-50"
                    >
                      <Save className="h-5 w-5" />
                      {saving ? 'Salvando...' : (editingId ? 'Salvar Alterações' : 'Finalizar Cadastro')}
                    </button>
                  </div>
                </form>
              </div>
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
              <h2 className="mb-2 text-xl font-bold text-[#111827]">Excluir Item</h2>
              <p className="mb-8 text-[#6B7280]">
                Tem certeza que deseja excluir este item do catálogo? Esta ação não pode ser desfeita.
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

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #E5E7EB;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #D1D5DB;
        }
      `}</style>
    </div>
  );
};
