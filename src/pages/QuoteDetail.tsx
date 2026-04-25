import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { QuoteItem, QuoteStatus, QuoteClassification, QuotePhoto } from '../types';
import { useSupabase } from '../context/SupabaseContext';
import { 
  Plus, Trash2, Save, Send, CheckCircle, XCircle, X, Search, 
  FileText, Sparkles, AlertCircle, ChevronLeft, Download, 
  User, Package, Calculator, Clock, Check, Image as ImageIcon 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatCurrency } from '../lib/utils';
import { reviewQuoteItems } from '../services/geminiService';
import { useQuoteData } from '../hooks/useQuoteData';
import { useQuotePDF } from '../hooks/useQuotePDF';
import { useQuoteEmail } from '../hooks/useQuoteEmail';
import { useQuoteCalculations } from '../hooks/useQuoteCalculations';

export const QuoteDetail: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile, isSales, isManager, isAdmin, isTechnician, isCustomer } = useSupabase();

  const {
    quote, setQuote,
    customers,
    catalogItems,
    companySettings,
    photos, setPhotos,
    loading,
    saving,
    saveQuote,
    handleStatusChange,
  } = useQuoteData(id);

  const { subtotal, discountTotal, grandTotal } = useQuoteCalculations(
    (quote.items || []), 
    { 
      shippingFee: quote.shippingFee || 0, 
      urgencyFee: quote.urgencyFee || 0, 
      taxTotal: quote.taxTotal || 0 
    }
  );

  const { generatePDF, isPDFGenerating } = useQuotePDF(quote, companySettings, customers, catalogItems);
  const { sendEmail, isSendingEmail } = useQuoteEmail(quote, customers, companySettings);

  const [isAiReviewing, setIsAiReviewing] = useState(false);
  const [aiFeedback, setAiFeedback] = useState<string | null>(null);
  const [itemSearchTerm, setItemSearchTerm] = useState('');
  const [showItemResults, setShowItemResults] = useState(false);

  // Update quote totals whenever subtotal or grandTotal from hook changes
  React.useEffect(() => {
    setQuote(prev => ({
      ...prev,
      subtotal,
      discountTotal,
      grandTotal
    }));
  }, [subtotal, discountTotal, grandTotal, setQuote]);

  const addItem = (catalogItem: any) => {
    const newItem: QuoteItem = {
      itemId: catalogItem.id,
      itemCode: catalogItem.partCodes?.[0] || '',
      name: catalogItem.name,
      ncm: catalogItem.ncm || '',
      type: catalogItem.type,
      unit: catalogItem.unit || '',
      quantity: 1,
      costPrice: catalogItem.costPrice || 0,
      unitPrice: catalogItem.basePrice || 0,
      discount: 0,
      total: catalogItem.basePrice || 0,
    };
    setQuote(prev => ({ ...prev, items: [...(prev.items || []), newItem] }));
  };

  const updateItem = (index: number, updates: Partial<QuoteItem>) => {
    const updatedItems = [...(quote.items || [])];
    const item = { ...updatedItems[index], ...updates };
    item.total = (item.quantity * item.unitPrice);
    updatedItems[index] = item;
    setQuote(prev => ({ ...prev, items: updatedItems }));
  };

  const removeItem = (index: number) => {
    setQuote(prev => ({ ...prev, items: (prev.items || []).filter((_, i) => i !== index) }));
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const remainingSlots = 10 - photos.length;
    const filesToProcess = Array.from(files).slice(0, remainingSlots);

    filesToProcess.forEach(f => {
      const file = f as File;
      if (file.size > 2 * 1024 * 1024) {
        alert(`A foto ${file.name} excede o limite de 2MB.`);
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotos(prev => [...prev, { photoUrl: reader.result as string, caption: '', sortOrder: prev.length }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const updatePhotoCaption = (index: number, caption: string) => {
    setPhotos(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], caption };
      return updated;
    });
  };

  const getTermsByClassification = (classification: QuoteClassification, plate: string) => {
    const plateStr = plate || 'XPT0123';
    if (['general_overhaul_preview', 'corrective_preview', 'preventive_preview'].includes(classification)) {
      return `Orçamento prévio referente à placa ${plateStr}. Este orçamento apresenta os valores brutos, podendo sofrer alterações caso, durante a desmontagem, sejam identificadas peças frágeis ou danificadas, a fim de garantir o melhor rendimento do equipamento. O desconto de 10% será aplicado somente no momento da emissão do pedido de compra, conforme procedimento interno.`;
    }
    if (['complementary', 'corrective', 'preventive'].includes(classification)) {
      return `Orçamento referente à placa ${plateStr}. O desconto de 10% será aplicado somente no momento da emissão do pedido de compra, conforme procedimento interno.`;
    }
    if (classification === 'general_overhaul') {
      return `Este é um orçamento prévio referente a placa ${plateStr}, sujeito a alterações conforme ajustes ou necessidades adicionais identificadas durante a execução do serviço.\n\nTodos os serviços e valores referentes a "Revisão" já incluem os materiais necessários para a execução do serviço.\n\nO serviço será iniciado mediante pagamento de 50% do valor total acordado entre o prestador e o cliente.\n\nO saldo restante (50%) será quitado em duas parcelas iguais de 25% cada, sendo:\n\n25% no término do trabalho;\n\n25% em até 30 dias após a conclusão, mediante boleto bancário e emissão de nota fiscal (NF).`;
    }
    return quote.terms || 'Pagamento em 30 dias após aprovação.';
  };

  const handleClassificationChange = (classification: QuoteClassification) => {
    setQuote(prev => ({
      ...prev,
      classification,
      terms: getTermsByClassification(classification, prev.vehiclePlate || '')
    }));
  };

  const onSave = async () => {
    const result = await saveQuote();
    if (result) {
      await generatePDF(result);
      if (id === 'new') navigate(`/quotes/${result.id}`, { replace: true });
      alert('Orçamento salvo com sucesso!');
    }
  };

  const handleAiReview = async () => {
    if (!quote.items || quote.items.length === 0) return;
    setIsAiReviewing(true);
    try {
      const feedback = await reviewQuoteItems(quote.items, profile?.role);
      setAiFeedback(feedback);
    } catch (error) {
      console.error('AI Review error:', error);
    } finally {
      setIsAiReviewing(false);
    }
  };

  const canEdit = !isCustomer && (isSales || isManager || isAdmin);
  const canUpdateStatus = !isCustomer && (isTechnician || isSales || isManager || isAdmin);

  if (loading) return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-[#111827] border-t-transparent"></div></div>;

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/quotes')} className="rounded-lg p-2 hover:bg-[#F3F4F6]"><ChevronLeft className="h-6 w-6 text-[#6B7280]" /></button>
          <div>
            <h1 className="text-2xl font-bold text-[#111827]">{id === 'new' ? 'Novo Orçamento' : quote.quoteNumber}</h1>
            <p className="text-sm text-[#6B7280]">Gerencie os detalhes e itens da proposta comercial.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
          {canEdit && (
            <>
              <button onClick={sendEmail} disabled={isSendingEmail} className="flex h-11 items-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-4 text-sm font-semibold text-[#111827] shadow-sm transition-all hover:bg-[#F9FAFB] active:scale-95">
                <Send className="h-4 w-4" /> <span className="hidden xs:inline">Enviar por E-mail</span> <span className="xs:hidden">E-mail</span>
              </button>
              <button onClick={handleAiReview} disabled={isAiReviewing || (quote.items?.length || 0) === 0} className="flex h-11 items-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-4 text-sm font-semibold text-[#111827] shadow-sm transition-all hover:bg-[#F9FAFB] active:scale-95 disabled:opacity-50">
                <Sparkles className={cn("h-4 w-4", isAiReviewing && "animate-pulse")} /> <span className="hidden xs:inline">Revisão IA</span> <span className="xs:hidden">IA</span>
              </button>
              <button onClick={onSave} disabled={saving} className="flex h-11 items-center gap-2 rounded-xl bg-[#111827] px-6 text-sm font-semibold text-white shadow-lg shadow-[#111827]/20 transition-all hover:bg-black active:scale-95 disabled:opacity-50">
                {saving ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Save className="h-4 w-4" />}
                <span>{saving ? 'Salvando...' : 'Salvar e Gerar PDF'}</span>
              </button>
            </>
          )}
          {isCustomer && <button onClick={() => generatePDF()} disabled={isPDFGenerating} className="flex items-center gap-2 rounded-xl bg-[#111827] px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#111827]/20 hover:bg-black"><Download className="h-4 w-4" /> Baixar PDF</button>}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-8">
          <section className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#111827]"><Clock className="h-5 w-5" /><h2 className="font-bold">Linha do Tempo Ativa</h2></div>
              <div className="text-xs font-medium text-[#6B7280]">Status Atual: <span className="font-bold text-[#111827] uppercase">{quote.status}</span></div>
            </div>
            <div className="relative mb-12 px-4">
              <div className="absolute left-4 right-4 top-1/2 h-0.5 -translate-y-1/2 bg-[#F3F4F6]"></div>
              <div className="absolute left-4 top-1/2 h-0.5 -translate-y-1/2 bg-[#111827] transition-all duration-500" style={{ width: `${['received', 'analyzing', 'negotiating', 'awaiting_approval', 'executing', 'finished'].indexOf(quote.status || 'received') * 20}%` }}></div>
              <div className="relative flex justify-between">
                {(['received', 'analyzing', 'negotiating', 'awaiting_approval', 'executing', 'finished'] as QuoteStatus[]).map((s, i) => (
                  <div key={s} className="flex flex-col items-center gap-2">
                    <button disabled={!canUpdateStatus || id === 'new'} onClick={() => handleStatusChange(s)} className={cn("z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all", [ 'received', 'analyzing', 'negotiating', 'awaiting_approval', 'executing', 'finished' ].indexOf(quote.status || 'received') >= i ? "border-[#111827] bg-[#111827] text-white" : "border-[#E5E7EB] bg-white text-[#9CA3AF]", quote.status === s && "ring-4 ring-[#111827]/10")}>{['received', 'analyzing', 'negotiating', 'awaiting_approval', 'executing', 'finished'].indexOf(quote.status || 'received') >= i ? <Check className="h-4 w-4" /> : <span className="text-[10px] font-bold">{i + 1}</span>}</button>
                    <span className={cn("absolute -bottom-8 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap", [ 'received', 'analyzing', 'negotiating', 'awaiting_approval', 'executing', 'finished' ].indexOf(quote.status || 'received') >= i ? "text-[#111827]" : "text-[#9CA3AF]")}>{s}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-16 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#9CA3AF]">Histórico</h3>
              <div className="space-y-3">
                {quote.timeline?.slice().reverse().map((event, idx) => (
                  <div key={idx} className="flex items-start gap-3 rounded-xl bg-[#F9FAFB] p-3 text-sm">
                    <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white shadow-sm"><Clock className="h-3 w-3 text-[#6B7280]" /></div>
                    <div className="flex-1">
                      <p className="font-medium text-[#111827]">{event.userName} moveu para <span className="font-bold uppercase">{event.status}</span></p>
                      <p className="text-[10px] text-[#6B7280]">{new Date(event.timestamp).toLocaleString('pt-BR')} • {event.userRole}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2 text-[#111827]"><User className="h-5 w-5" /><h2 className="font-bold">Cliente</h2></div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2"><label className="text-sm font-semibold text-[#374151]">Nº Orçamento</label><input type="text" value={quote.quoteNumber || ''} disabled={!canEdit} onChange={(e) => setQuote({ ...quote, quoteNumber: e.target.value })} className="h-11 w-full rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 text-sm focus:border-[#111827] focus:outline-none" /></div>
              <div className="space-y-2 md:col-span-2"><label className="text-sm font-semibold text-[#374151]">Classificação</label>
                <div className="flex flex-wrap gap-2">
                  {['preventive', 'preventive_preview', 'corrective', 'corrective_preview', 'general_overhaul', 'general_overhaul_preview', 'complementary'].map((cls) => (
                    <button key={cls} type="button" disabled={!canEdit} onClick={() => handleClassificationChange(cls as QuoteClassification)} className={cn("rounded-lg px-3 py-1.5 text-xs font-medium transition-all", quote.classification === cls ? "bg-[#111827] text-white shadow-md" : "bg-[#F3F4F6] text-[#6B7280] hover:bg-[#E5E7EB]")}>{cls}</button>
                  ))}
                </div>
              </div>
              <div className="space-y-2"><label className="text-sm font-semibold text-[#374151]">Cliente</label><select value={quote.customerId} disabled={!canEdit} onChange={(e) => { const c = customers.find(cust => cust.id === e.target.value); setQuote({ ...quote, customerId: e.target.value, customerName: c?.name }); }} className="h-11 w-full rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 text-sm focus:border-[#111827] focus:outline-none"><option value="">Selecione...</option>{customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
              <div className="space-y-2"><label className="text-sm font-semibold text-[#374151]">Validade</label><input type="date" disabled={!canEdit} value={quote.validUntil?.split('T')[0]} onChange={(e) => setQuote({ ...quote, validUntil: e.target.value })} className="h-11 w-full rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 text-sm focus:border-[#111827] focus:outline-none" /></div>
            </div>
          </section>

          <section className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2 text-[#111827]"><Package className="h-5 w-5" /><h2 className="font-bold">Veículo</h2></div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <div className="space-y-2"><label className="text-sm font-semibold text-[#374151]">Placa</label><input type="text" placeholder="ABC-1234" disabled={!canEdit} value={quote.vehiclePlate || ''} onChange={(e) => { const upper = e.target.value.toUpperCase(); setQuote(prev => ({ ...prev, vehiclePlate: upper, terms: prev.classification ? getTermsByClassification(prev.classification, upper) : prev.terms })); }} className="h-11 w-full rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 text-sm focus:border-[#111827] focus:outline-none" /></div>
              <div className="space-y-2 md:col-span-2"><label className="text-sm font-semibold text-[#374151]">Modelo</label><input type="text" disabled={!canEdit} value={quote.vehicleModel || ''} onChange={(e) => setQuote({ ...quote, vehicleModel: e.target.value })} className="h-11 w-full rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 text-sm focus:border-[#111827] focus:outline-none" /></div>
              <div className="space-y-2 md:col-span-3"><label className="text-sm font-semibold text-[#374151]">Observações</label><textarea disabled={!canEdit} value={quote.observations || ''} onChange={(e) => setQuote({ ...quote, observations: e.target.value })} className="w-full rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-4 text-sm focus:border-[#111827] focus:outline-none" rows={2} /></div>
            </div>
          </section>

          <section className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#111827]"><Package className="h-5 w-5" /><h2 className="font-bold">Itens</h2></div>
              {canEdit && (
                <div className="relative">
                  <div className="relative w-72"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" /><input type="text" placeholder="Pesquisar..." value={itemSearchTerm} onChange={(e) => { setItemSearchTerm(e.target.value); setShowItemResults(true); }} onFocus={() => setShowItemResults(true)} className="h-10 w-full rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] pl-10 pr-10 text-sm focus:border-[#111827] focus:bg-white focus:outline-none" />{itemSearchTerm && <button onClick={() => setItemSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#EF4444]"><X className="h-4 w-4" /></button>}</div>
                  <AnimatePresence>{showItemResults && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute right-0 top-full z-50 mt-2 w-96 rounded-xl border border-[#E5E7EB] bg-white p-2 shadow-xl"><div className="max-h-64 overflow-y-auto custom-scrollbar">
                      {catalogItems.filter(i => i.active && (itemSearchTerm === '' || i.name.toLowerCase().includes(itemSearchTerm.toLowerCase()) || i.ncm?.includes(itemSearchTerm) || i.partCodes?.some(pc => pc.toLowerCase().includes(itemSearchTerm.toLowerCase())))).map(item => (
                        <button key={item.id} onClick={() => { addItem(item); setItemSearchTerm(''); setShowItemResults(false); }} className="flex w-full items-center gap-3 rounded-lg p-3 text-left hover:bg-[#F3F4F6] transition-colors"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-martins-blue text-[#111827]"><Package className="h-4 w-4" /></div><div className="flex-1 min-w-0"><p className="text-sm font-bold text-[#111827] truncate uppercase">{item.name}</p><div className="flex items-center gap-2 text-[10px] text-[#6B7280]"><span>{item.unit}</span><span>•</span><span className="font-bold text-[#111827]">{formatCurrency(item.basePrice)}</span></div></div><Plus className="h-4 w-4 text-[#9CA3AF]" /></button>
                      ))}
                    </div></motion.div>
                  )}</AnimatePresence>
                </div>
              )}
            </div>
            <div className="overflow-x-auto"><table className="w-full text-left"><thead><tr className="border-b border-[#F3F4F6] text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF]"><th className="pb-4 pl-2">Cód</th><th className="pb-4">Item</th><th className="pb-4">NCM</th><th className="pb-4">Tipo</th><th className="pb-4 w-24">Qtd</th><th className="pb-4 w-32">Unitário</th><th className="pb-4 w-32">Total</th><th className="pb-4 pr-2 text-right"></th></tr></thead><tbody className="divide-y divide-[#F3F4F6]">
              {quote.items?.map((item, index) => (
                <tr key={index} className="group"><td className="py-4 pl-2 text-xs text-[#6B7280]">{item.itemCode}</td><td className="py-4 font-bold text-[#111827]">{item.name}</td><td className="py-4 text-xs text-[#6B7280]">{item.ncm}</td><td className="py-4"><span className="rounded-full bg-[#F3F4F6] px-2 py-0.5 text-[10px] font-bold uppercase text-[#6B7280]">{item.type}</span></td><td className="py-4"><input type="number" value={item.quantity} disabled={!canEdit} onChange={(e) => updateItem(index, { quantity: parseFloat(e.target.value) || 0 })} className="h-9 w-20 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-2 text-sm focus:outline-none" /></td><td className="py-4"><input type="number" value={item.unitPrice} disabled={!canEdit} onChange={(e) => updateItem(index, { unitPrice: parseFloat(e.target.value) || 0 })} className="h-9 w-28 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-2 text-sm focus:outline-none" /></td><td className="py-4 font-bold text-[#111827]">{formatCurrency(item.total)}</td><td className="py-4 pr-2 text-right">{canEdit && <button onClick={() => removeItem(index)} className="rounded-lg p-2 text-[#9CA3AF] hover:bg-[#FEF2F2] hover:text-[#EF4444]"><Trash2 className="h-4 w-4" /></button>}</td></tr>
              ))}
            </tbody></table></div>
          </section>
          
          <section className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-center justify-between"><div className="flex items-center gap-2 text-[#111827]"><ImageIcon className="h-5 w-5" /><h2 className="font-bold">Fotos</h2></div>{canEdit && <label className="flex cursor-pointer items-center gap-2 rounded-lg bg-[#111827] px-3 py-1.5 text-xs font-bold text-white hover:bg-black"><Plus className="h-3 w-3" />Adicionar<input type="file" multiple accept="image/*" onChange={handlePhotoUpload} className="hidden" /></label>}</div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {photos.map((photo, index) => (
                <div key={index} className="group relative overflow-hidden rounded-xl border border-[#E5E7EB] bg-[#F9FAFB]">
                  <div className="aspect-video w-full"><img src={photo.photoUrl} className="h-full w-full object-cover" referrerPolicy="no-referrer" /></div>
                  {canEdit && <button onClick={() => setPhotos(prev => prev.filter((_, i) => i !== index))} className="absolute right-2 top-2 rounded-full bg-white/90 p-1.5 text-red-500 opacity-0 group-hover:opacity-100"><Trash2 className="h-3.5 w-3.5" /></button>}
                  <div className="p-3"><input type="text" placeholder="Legenda..." value={photo.caption || ''} disabled={!canEdit} onChange={(e) => updatePhotoCaption(index, e.target.value)} className="w-full bg-transparent text-xs focus:outline-none" /></div>
                </div>
              ))}
            </div>
          </section>

          <AnimatePresence>
            {aiFeedback && (
              <motion.section initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="rounded-2xl border border-martins-blue bg-martins-blue/10 p-6">
                <div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-2 text-[#111827]"><Sparkles className="h-5 w-5" /><h2 className="font-bold">Análise IA</h2></div><button onClick={() => setAiFeedback(null)} className="text-[#6B7280] hover:text-[#111827]"><XCircle className="h-5 w-5" /></button></div>
                <div className="prose prose-sm text-[#111827]"><p className="whitespace-pre-wrap">{aiFeedback}</p></div>
              </motion.section>
            )}
          </AnimatePresence>
        </div>

        <div className="space-y-8">
          <section className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-center gap-2 text-[#111827]"><Calculator className="h-5 w-5" /><h2 className="font-bold">Resumo</h2></div>
            <div className="space-y-4">
              <div className="flex justify-between text-sm text-[#6B7280]"><span>Subtotal</span><span className="font-medium text-[#111827]">{formatCurrency(quote.subtotal || 0)}</span></div>
              <div className="border-t border-[#F3F4F6] pt-4"><div className="flex justify-between"><span className="text-lg font-bold text-[#111827]">Total</span><span className="text-2xl font-black text-[#111827]">{formatCurrency(quote.grandTotal || 0)}</span></div></div>
            </div>
          </section>
          <section className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
            <h2 className="mb-4 font-bold text-[#111827]">Notas e Termos</h2>
            <div className="space-y-4">
              <div className="space-y-2"><label className="text-xs font-bold uppercase text-[#9CA3AF]">Observações Internas</label><textarea rows={3} value={quote.notes} onChange={(e) => setQuote({ ...quote, notes: e.target.value })} className="w-full rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] p-3 text-sm focus:outline-none" /></div>
              <div className="space-y-2"><label className="text-xs font-bold uppercase text-[#9CA3AF]">Condições Comerciais (PDF)</label><textarea rows={3} value={quote.terms} onChange={(e) => setQuote({ ...quote, terms: e.target.value })} className="w-full rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] p-3 text-sm focus:outline-none" /></div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
