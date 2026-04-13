import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Quote, QuoteStatus } from '../types';
import { useSupabase } from '../context/SupabaseContext';
import { Plus, Search, Eye, Trash2, FileText, Clock, CheckCircle, AlertCircle, X, TrendingUp, Users, ArrowUpRight, Copy, Mail, Edit2, Loader2, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatCurrency, formatDateTime, generateQuoteNumber, mapQuote } from '../lib/utils';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { withRetry } from '../lib/supabase-retry';

export const Quotes: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAdmin, isManager, isSales, isCustomer, profile, refreshProfile } = useSupabase();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<QuoteStatus | 'all'>('all');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    console.log('[Quotes] Perfil atual:', profile);
    fetchQuotes();
  }, [isCustomer, profile]);

  const fixPermissions = async () => {
    if (!user) {
      toast.error('Usuário não autenticado.');
      return;
    }

    try {
      setLoading(true);
      console.log('[Quotes] Iniciando fixPermissions para:', user.id);
      console.log('[Quotes] Email do usuário:', user.email);
      
      // 1. Check if profile exists
      const { data: existingProfile, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (fetchError) {
        console.error('[Quotes] Erro ao buscar perfil:', fetchError);
        throw fetchError;
      }

      console.log('[Quotes] Perfil existente encontrado:', existingProfile);

      if (!existingProfile) {
        console.log('[Quotes] Perfil não encontrado, tentando inserir...');
        const payload = {
          id: user.id,
          email: user.email || '',
          display_name: user.user_metadata?.display_name || user.email?.split('@')[0] || 'Usuário',
          role: 'admin'
        };
        console.log('[Quotes] Payload de inserção:', payload);
        
        const { error: insertError } = await supabase
          .from('profiles')
          .insert(payload);
          
        if (insertError) {
          console.error('[Quotes] Erro ao inserir perfil (RLS?):', insertError);
          throw insertError;
        }
        toast.success('Perfil criado com sucesso!');
      } else if (existingProfile.role !== 'admin') {
        console.log('[Quotes] Perfil encontrado com role:', existingProfile.role, '. Atualizando para admin...');
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ role: 'admin' })
          .eq('id', user.id);
          
        if (updateError) {
          console.error('[Quotes] Erro ao atualizar perfil (RLS?):', updateError);
          throw updateError;
        }
        toast.success('Permissões atualizadas para Administrador!');
      } else {
        console.log('[Quotes] Usuário já é administrador no banco de dados.');
        toast.success('Você já possui permissões de Administrador.');
      }

      console.log('[Quotes] Atualizando contexto...');
      await refreshProfile();
      
      // Re-fetch quotes now that we have admin role
      await fetchQuotes();
    } catch (error: any) {
      console.error('Error fixing permissions:', error);
      toast.error(`Erro ao ajustar permissões: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchQuotes = async () => {
    console.log('[Quotes] Buscando orçamentos... Role:', profile?.role);
    
    // Safety timeout for fetching
    const fetchTimeout = setTimeout(() => {
      if (loading) {
        setLoading(false);
        console.warn('[Quotes] Busca de orçamentos demorou demais.');
      }
    }, 8000);

    try {
      setLoading(true);
      const { data, error } = await withRetry(async () => {
        let query = supabase.from('quotes').select('*').order('created_at', { ascending: false });
        if (isCustomer && profile) {
          query = query.eq('customer_id', profile.uid);
        }
        return await query;
      }) as { data: any[] | null; error: any };

      clearTimeout(fetchTimeout);
      if (error) throw error;

      console.log(`[Quotes] Buscados ${data?.length || 0} orçamentos`);
      const mappedData = (data || []).map(mapQuote);
      setQuotes(mappedData as Quote[]);
    } catch (error) {
      clearTimeout(fetchTimeout);
      console.error('Error fetching quotes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (id: string) => {
    setDeleteConfirmId(id);
  };

  const confirmDelete = async () => {
    if (!deleteConfirmId) return;
    const idToDelete = deleteConfirmId;
    setDeleting(true);
    console.log(`[Quotes] Tentando excluir orçamento: ${idToDelete}`);
    try {
      const { data, error } = await withRetry(async () => 
        await supabase.from('quotes').delete().eq('id', idToDelete).select()
      ) as { data: any[] | null; error: any };
      
      if (error) throw error;
      
      if (!data || data.length === 0) {
        console.warn(`[Quotes] Nenhum orçamento foi excluído. Verifique permissões ou se o ID ${idToDelete} existe.`);
        toast.error('Não foi possível excluir o orçamento. Verifique se você tem permissão ou se ele já foi removido.');
      } else {
        console.log(`[Quotes] Orçamento ${idToDelete} excluído com sucesso.`);
        toast.success('Orçamento excluído com sucesso!');
      }
      
      // Re-fetch data to ensure the UI is in sync with the database
      await fetchQuotes();
    } catch (error: any) {
      console.error('Error deleting quote:', error);
      toast.error(`Erro ao excluir orçamento: ${error.message}`);
    } finally {
      setDeleting(false);
      setDeleteConfirmId(null);
    }
  };

  const handleDuplicate = async (quote: Quote) => {
    try {
      const { id, createdAt, updatedAt, items, timeline, ...rest } = quote;
      const newQuote = {
        quote_number: generateQuoteNumber(),
        title: rest.title,
        classification: rest.classification,
        customer_id: rest.customerId,
        customer_name: rest.customerName,
        vehicle_id: rest.vehicleId,
        vehicle_plate: rest.vehiclePlate,
        vehicle_model: rest.vehicleModel,
        current_km: rest.currentKm,
        status: 'received',
        service_status: rest.serviceStatus,
        subtotal: rest.subtotal,
        discount_total: rest.discountTotal,
        tax_total: rest.taxTotal,
        shipping_fee: rest.shippingFee,
        urgency_fee: rest.urgencyFee,
        grand_total: rest.grandTotal,
        valid_until: rest.validUntil,
        notes: rest.notes,
        terms: rest.terms,
        observations: rest.observations,
        created_by: profile?.uid,
      };

      const { data, error } = await supabase.from('quotes').insert(newQuote).select().single();
      if (error) throw error;

      // Duplicate items if they exist
      if (items && items.length > 0) {
        const newItems = items.map(item => ({
          quote_id: data.id,
          item_id: item.itemId,
          item_code: item.itemCode,
          name: item.name,
          ncm: item.ncm,
          type: item.type,
          quantity: item.quantity,
          cost_price: item.costPrice,
          unit_price: item.unitPrice,
          discount: item.discount,
          total: item.total,
        }));
        await supabase.from('quote_items').insert(newItems);
      }

      fetchQuotes();
      alert('Orçamento duplicado com sucesso!');
    } catch (error) {
      console.error('Error duplicating quote:', error);
    }
  };

  const handleGenerateEmail = async (quote: Quote) => {
    try {
      // 1. Buscar itens do orçamento
      const { data: itemsData, error: itemsError } = await withRetry(async () => 
        await supabase.from('quote_items').select('*').eq('quote_id', quote.id)
      ) as { data: any[] | null; error: any };

      if (itemsError) throw itemsError;
      const quoteItems = (itemsData || []).map(i => ({
        name: i.name,
        quantity: Number(i.quantity),
        unit: i.unit || 'un',
        unitPrice: Number(i.unit_price)
      }));

      // 2. Buscar e-mail do cliente
      const { data: customerData, error: customerError } = await withRetry(async () => 
        await supabase.from('customers').select('email').eq('id', quote.customerId).single()
      ) as { data: any | null; error: any };

      const customerEmail = customerData?.email || '';

      // 3. Buscar e-mails fixos (CC)
      const { data: recipientsData } = await withRetry(async () => 
        await supabase.from('email_recipients').select('email').eq('active', true)
      ) as { data: any[] | null; error: any };

      const ccEmails = (recipientsData || [])
        .map((r: any) => r.email)
        .filter(email => email && email.trim() !== '' && email !== customerEmail);

      // 4. Buscar dados da empresa
      const { data: settingsData } = await withRetry(async () => 
        await supabase.from('company_settings').select('*').limit(1).single()
      ) as { data: any | null; error: any };

      // 5. Formatar o número do orçamento (apenas o final)
      const displayQuoteNumber = quote.quoteNumber.includes('-') 
        ? quote.quoteNumber.split('-').pop() 
        : quote.quoteNumber;

      const subject = encodeURIComponent(`Orçamento nº ${displayQuoteNumber} - ${quote.title}`);
      
      // Construir a lista de itens
      const itemsList = quoteItems.map((item, index) => 
        `${index + 1}. ${item.name.toUpperCase()} – ${item.quantity} ${item.unit} – ${formatCurrency(item.unitPrice)}`
      ).join('\n');

      const bodyText = `Prezados,

Conforme solicitado, segue o orçamento nº ${displayQuoteNumber} referente aos serviços de manutenção mecânica:

${itemsList}

Valor total: ${formatCurrency(quote.grandTotal || 0)}
Prazo estimado: 30 dias

Esta proposta é válida por 30 dias. O pagamento pode ser realizado via PIX ou transferência bancária. Favor responder a este e-mail para confirmação e agendamento do serviço.

Atenciosamente,
${settingsData?.name || 'S.F SERVIÇOS MECÂNICOS'}
${settingsData?.phone || ''} | ${settingsData?.email || ''}`;

      const body = encodeURIComponent(bodyText);
      const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(customerEmail)}&cc=${encodeURIComponent(ccEmails.join(','))}&su=${subject}&body=${body}`;
      
      const newWindow = window.open(gmailUrl, '_blank');
      if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
        const link = document.createElement('a');
        link.href = gmailUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (error) {
      console.error('Error generating email:', error);
      alert('Erro ao gerar e-mail. Verifique sua conexão.');
    }
  };

  const filteredQuotes = quotes.filter(q => {
    const matchesSearch = q.quoteNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          q.customerName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || q.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-4">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#9CA3AF]" />
            <input
              type="text"
              placeholder="Buscar por número ou cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-11 w-full rounded-xl border border-[#E5E7EB] bg-white pl-10 pr-4 text-sm shadow-sm focus:border-[#111827] focus:outline-none focus:ring-1 focus:ring-[#111827]"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="h-11 rounded-xl border border-[#E5E7EB] bg-white px-4 text-sm shadow-sm focus:border-[#111827] focus:outline-none"
          >
            <option value="all">Todos os Status</option>
            <option value="received">Recebido</option>
            <option value="analyzing">Em Análise</option>
            <option value="negotiating">Em Tratativa</option>
            <option value="awaiting_approval">Aguardando Aprovação</option>
            <option value="executing">Execução</option>
            <option value="finished">Finalizado</option>
          </select>
        </div>
        {!isCustomer && isSales && (
          <div className="flex items-center gap-2">
            <button
              onClick={fixPermissions}
              disabled={loading}
              className="p-2.5 text-orange-500 hover:text-orange-600 hover:bg-orange-50 rounded-xl transition-all active:scale-95 disabled:opacity-50"
              title="Ajustar Permissões"
            >
              <Users className="h-5 w-5" />
            </button>
            <button
              onClick={() => fetchQuotes()}
              disabled={loading}
              className="p-2.5 text-gray-500 hover:text-[#111827] hover:bg-gray-100 rounded-xl transition-all active:scale-95 disabled:opacity-50"
              title="Atualizar Lista"
            >
              <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => navigate('/quotes/new')}
              className="flex items-center gap-2 rounded-xl bg-[#111827] px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#111827]/20 transition-all hover:bg-black hover:shadow-xl active:scale-95"
            >
              <Plus className="h-5 w-5" />
              Novo Orçamento
            </button>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-[#E5E7EB] bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[#F3F4F6] bg-[#F9FAFB] text-xs font-semibold uppercase tracking-wider text-[#9CA3AF]">
                <th className="px-6 py-4">Número</th>
                <th className="px-6 py-4">Cliente</th>
                <th className="px-6 py-4">Data de Criação</th>
                <th className="px-6 py-4">Total</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3F4F6]">
              {filteredQuotes.map((quote) => (
                <tr key={quote.id} className="group hover:bg-[#F9FAFB] transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-martins-blue text-[#111827]">
                        <FileText className="h-4 w-4" />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-bold text-[#111827]">{quote.quoteNumber}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-[#4B5563]">{quote.customerName}</td>
                  <td className="px-6 py-4 text-sm text-[#6B7280]">{formatDateTime(quote.createdAt)}</td>
                  <td className="px-6 py-4 font-bold text-[#111827]">{formatCurrency(quote.grandTotal)}</td>
                  <td className="px-6 py-4">
                    <StatusBadge status={quote.status} />
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => navigate(`/quotes/${quote.id}`)}
                        title={isCustomer ? "Visualizar" : "Editar"}
                        className="rounded-lg p-2 text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827]"
                      >
                        {isCustomer ? <Eye className="h-4 w-4" /> : <Edit2 className="h-4 w-4" />}
                      </button>
                      {!isCustomer && (
                        <>
                          <button
                            onClick={() => handleDuplicate(quote)}
                            title="Duplicar"
                            className="rounded-lg p-2 text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827]"
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleGenerateEmail(quote)}
                            title="Gerar E-mail"
                            className="rounded-lg p-2 text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827]"
                          >
                            <Mail className="h-4 w-4" />
                          </button>
                        </>
                      )}
                      {(isAdmin || isManager || isSales) && (
                        <button
                          onClick={() => handleDelete(quote.id)}
                          title="Excluir"
                          className="rounded-lg p-2 text-[#6B7280] hover:bg-[#FEF2F2] hover:text-[#EF4444]"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredQuotes.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-[#9CA3AF]">Nenhum orçamento encontrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
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
              <h2 className="mb-2 text-xl font-bold text-[#111827]">Excluir Orçamento</h2>
              <p className="mb-8 text-[#6B7280]">
                Tem certeza que deseja excluir este orçamento? Esta ação não pode ser desfeita.
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
                  disabled={deleting}
                  className="flex items-center justify-center gap-2 rounded-xl bg-[#EF4444] px-8 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#EF4444]/20 hover:bg-[#DC2626] disabled:opacity-50"
                >
                  {deleting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Excluindo...
                    </>
                  ) : (
                    'Excluir'
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const StatusBadge: React.FC<{ status: QuoteStatus }> = ({ status }) => {
  const config: Record<string, { label: string; classes: string; icon: any }> = {
    received: { label: 'Recebido', classes: 'bg-gray-100 text-gray-700', icon: Clock },
    analyzing: { label: 'Em Análise', classes: 'bg-martins-blue text-[#111827]', icon: AlertCircle },
    negotiating: { label: 'Em Tratativa', classes: 'bg-indigo-100 text-indigo-700', icon: FileText },
    awaiting_approval: { label: 'Aguardando Aprovação', classes: 'bg-purple-100 text-purple-700', icon: Users },
    executing: { label: 'Execução', classes: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
    finished: { label: 'Finalizado', classes: 'bg-amber-100 text-amber-700', icon: TrendingUp },
    // Fallbacks for old status values
    draft: { label: 'Rascunho', classes: 'bg-gray-100 text-gray-700', icon: Clock },
    review: { label: 'Revisão', classes: 'bg-martins-blue text-[#111827]', icon: AlertCircle },
    sent: { label: 'Enviado', classes: 'bg-indigo-100 text-indigo-700', icon: FileText },
    viewed: { label: 'Visualizado', classes: 'bg-purple-100 text-purple-700', icon: Users },
    approved: { label: 'Aprovado', classes: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
    rejected: { label: 'Rejeitado', classes: 'bg-rose-100 text-rose-700', icon: X },
    converted: { label: 'Convertido', classes: 'bg-amber-100 text-amber-700', icon: TrendingUp },
  };

  const badgeConfig = config[status] || { label: status, classes: 'bg-gray-100 text-gray-700', icon: Clock };
  const { label, classes, icon: Icon } = badgeConfig;

  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wider", classes)}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
};
