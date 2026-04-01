import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, serverTimestamp, addDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Quote, Customer, Item, QuoteItem, QuoteStatus, CompanySettings, TimelineEvent, QuoteClassification } from '../types';
import { useFirebase } from '../context/FirebaseContext';
import { Plus, Trash2, Save, Send, CheckCircle, XCircle, X, Search, FileText, Sparkles, AlertCircle, ChevronLeft, Download, User, Package, Calculator, Clock, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatCurrency, generateQuoteNumber } from '../lib/utils';
import { reviewQuoteItems, generateCommercialText } from '../services/geminiService';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export const QuoteDetail: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile, isSales, isManager, isAdmin, isTechnician, isCustomer } = useFirebase();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isAiReviewing, setIsAiReviewing] = useState(false);
  const [aiFeedback, setAiFeedback] = useState<string | null>(null);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [catalogItems, setCatalogItems] = useState<Item[]>([]);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [itemSearchTerm, setItemSearchTerm] = useState('');
  const [showItemResults, setShowItemResults] = useState(false);

  const [quote, setQuote] = useState<Partial<Quote>>({
    quoteNumber: generateQuoteNumber(),
    title: '',
    status: 'received',
    items: [],
    timeline: [],
    subtotal: 0,
    discountTotal: 0,
    taxTotal: 0,
    shippingFee: 0,
    urgencyFee: 0,
    grandTotal: 0,
    validUntil: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    notes: '',
    terms: 'Pagamento em 30 dias após aprovação.',
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [custSnap, itemSnap, companySnap] = await Promise.all([
          getDocs(collection(db, 'customers')),
          getDocs(collection(db, 'items')),
          getDoc(doc(db, 'settings', 'company')),
        ]);
        setCustomers(custSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)));
        setCatalogItems(itemSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Item)));
        
        if (companySnap.exists()) {
          setCompanySettings(companySnap.data() as CompanySettings);
        }

        if (id && id !== 'new') {
          const quoteDoc = await getDoc(doc(db, 'quotes', id));
          if (quoteDoc.exists()) {
            setQuote({ id: quoteDoc.id, ...quoteDoc.data() } as Quote);
          }
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  const calculateTotals = (items: QuoteItem[]) => {
    const subtotal = items.reduce((acc, item) => acc + item.total, 0);
    const grandTotal = subtotal;

    setQuote(prev => ({
      ...prev,
      items,
      subtotal,
      discountTotal: 0,
      taxTotal: 0,
      shippingFee: 0,
      urgencyFee: 0,
      grandTotal,
    }));
  };

  const addItem = (catalogItem: Item) => {
    const newItem: QuoteItem = {
      itemId: catalogItem.id,
      itemCode: catalogItem.partCodes && catalogItem.partCodes.length > 0 ? catalogItem.partCodes[0] : '',
      name: catalogItem.name,
      ncm: catalogItem.ncm || '',
      type: catalogItem.type,
      quantity: 1,
      costPrice: catalogItem.costPrice || 0,
      unitPrice: catalogItem.basePrice,
      discount: 0,
      total: catalogItem.basePrice,
    };
    const updatedItems = [...(quote.items || []), newItem];
    calculateTotals(updatedItems);
  };

  const updateItem = (index: number, updates: Partial<QuoteItem>) => {
    const updatedItems = [...(quote.items || [])];
    const item = { ...updatedItems[index], ...updates };
    item.total = (item.quantity * item.unitPrice);
    updatedItems[index] = item;
    calculateTotals(updatedItems);
  };

  const removeItem = (index: number) => {
    const updatedItems = (quote.items || []).filter((_, i) => i !== index);
    calculateTotals(updatedItems);
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
    const newTerms = getTermsByClassification(classification, quote.vehiclePlate || '');
    setQuote(prev => ({
      ...prev,
      classification,
      terms: newTerms
    }));
  };

  const handleFirestoreError = (error: any, operationType: string, path: string | null) => {
    const errInfo = {
      error: error instanceof Error ? error.message : String(error),
      authInfo: {
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email,
        emailVerified: auth.currentUser?.emailVerified,
        isAnonymous: auth.currentUser?.isAnonymous,
        tenantId: auth.currentUser?.tenantId,
        providerInfo: auth.currentUser?.providerData.map(provider => ({
          providerId: provider.providerId,
          displayName: provider.displayName,
          email: provider.email,
          photoUrl: provider.photoURL
        })) || []
      },
      operationType,
      path
    };
    console.error('Firestore Error Detail:', JSON.stringify(errInfo));
    throw new Error(JSON.stringify(errInfo));
  };

  const handleStatusChange = async (newStatus: QuoteStatus) => {
    if (!id || id === 'new') return;
    
    const event: TimelineEvent = {
      status: newStatus,
      timestamp: new Date().toISOString(),
      userId: profile?.uid || '',
      userName: profile?.displayName || 'Sistema',
      userRole: profile?.role || 'admin',
    };

    const updatedTimeline = [...(quote.timeline || []), event];
    
    try {
      await updateDoc(doc(db, 'quotes', id), {
        status: newStatus,
        timeline: updatedTimeline,
        updatedAt: serverTimestamp(),
      });
      setQuote(prev => ({ ...prev, status: newStatus, timeline: updatedTimeline }));
    } catch (error) {
      handleFirestoreError(error, 'update', `quotes/${id}`);
    }
  };

  const handleSave = async () => {
    if (!quote.customerId) {
      alert('Selecione um cliente.');
      return;
    }
    setSaving(true);
    try {
      const data = {
        ...quote,
        updatedAt: serverTimestamp(),
      };

      let finalId = id;
      if (id === 'new') {
        const initialEvent: TimelineEvent = {
          status: 'received',
          timestamp: new Date().toISOString(),
          userId: profile?.uid || '',
          userName: profile?.displayName || 'Sistema',
          userRole: profile?.role || 'admin',
        };
        try {
          const docRef = await addDoc(collection(db, 'quotes'), {
            ...data,
            status: 'received',
            timeline: [initialEvent],
            createdBy: profile?.uid,
            createdAt: serverTimestamp(),
          });
          finalId = docRef.id;
          navigate(`/quotes/${docRef.id}`, { replace: true });
        } catch (error) {
          handleFirestoreError(error, 'create', 'quotes');
        }
      } else {
        try {
          await updateDoc(doc(db, 'quotes', id!), data);
        } catch (error) {
          handleFirestoreError(error, 'update', `quotes/${id}`);
        }
      }
      
      // Generate PDF after saving
      generatePDF();
      
      alert('Orçamento salvo e PDF gerado com sucesso!');
    } catch (error) {
      console.error('Error saving quote:', error);
    } finally {
      setSaving(false);
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

  const generatePDF = async () => {
    const doc = new jsPDF();
    const customer = customers.find(c => c.id === quote.customerId);

    // Helper to get base64 from URL
    const getBase64FromUrl = async (url: string): Promise<string | null> => {
      try {
        if (url.startsWith('data:')) return url;
        const response = await fetch(url);
        const blob = await response.blob();
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      } catch (e) {
        console.warn('Could not convert image to base64:', e);
        return null;
      }
    };

    // Company Logo
    if (companySettings?.logoUrl) {
      const base64Logo = await getBase64FromUrl(companySettings.logoUrl);
      if (base64Logo) {
        try {
          doc.addImage(base64Logo, 'PNG', 20, 10, 30, 30);
        } catch (e) {
          console.warn('Could not add logo to PDF:', e);
        }
      }
    }

    // Header
    doc.setFontSize(22);
    doc.setTextColor(17, 24, 39); // #111827
    doc.text('PROPOSTA COMERCIAL', 105, 25, { align: 'center' });

    // Company Info
    doc.setFontSize(10);
    doc.setTextColor(0);
    const companyName = companySettings?.name || 'Sua Empresa';
    doc.text(companyName, 105, 35, { align: 'center' });
    
    let companyDetails = [];
    if (companySettings?.address) companyDetails.push(companySettings.address);
    if (companySettings?.phone) companyDetails.push(`Tel: ${companySettings.phone}`);
    if (companySettings?.email) companyDetails.push(`Email: ${companySettings.email}`);
    
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text(companyDetails.join(' | '), 105, 40, { align: 'center' });

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Número: ${quote.quoteNumber}`, 20, 55);
    
    let currentY = 60;
    if (quote.classification) {
      const classificationLabels: Record<string, string> = {
        preventive: 'Preventivo',
        preventive_preview: 'Preventivo Prévio',
        corrective: 'Corretivo',
        corrective_preview: 'Corretivo Prévio',
        general_overhaul: 'Reforma Geral',
        general_overhaul_preview: 'Reforma Geral Prévio',
        complementary: 'Complementar'
      };
      doc.text(`Classificação: ${classificationLabels[quote.classification]}`, 20, currentY);
      currentY += 5;
    }
    
    doc.text(`Data: ${new Date().toLocaleDateString()}`, 20, currentY);
    currentY += 5;
    
    const validUntilDate = quote.validUntil ? new Date(quote.validUntil) : null;
    const validUntilStr = validUntilDate && !isNaN(validUntilDate.getTime()) 
      ? validUntilDate.toLocaleDateString() 
      : '-';
    doc.text(`Validade: ${validUntilStr}`, 20, currentY);

    // Customer & Vehicle Info
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text('CLIENTE', 20, 85);
    doc.text('VEÍCULO', 110, 85);
    
    doc.setFontSize(10);
    doc.text(`${customer?.name || '-'}`, 20, 92);
    doc.text(`Doc: ${customer?.document || '-'}`, 20, 97);
    if (customer?.email) {
      doc.text(`Email: ${customer.email}`, 20, 102);
    }
    if (customer?.phone) {
      doc.text(`Tel: ${customer.phone}`, 20, 107);
    }

    doc.text(`Placa: ${quote.vehiclePlate || '-'}`, 110, 92);
    doc.text(`Modelo: ${quote.vehicleModel || '-'}`, 110, 97);

    // Items Table
    const typeLabels: Record<string, string> = {
      service: 'Serviço',
      product: 'Produto',
      package: 'Pacote',
      labor: 'Mão de Obra'
    };

    autoTable(doc, {
      startY: 110,
      head: [['Cód', 'Item', 'NCM', 'Tipo', 'Qtd', 'Unitário', 'Total']],
      body: quote.items?.map(item => {
        // Try to find missing data in catalog if needed
        const catalogItem = catalogItems.find(i => i.id === item.itemId);
        const itemCode = item.itemCode || (catalogItem?.partCodes?.[0] || '');
        const ncm = item.ncm || (catalogItem?.ncm || '-');
        const typeLabel = typeLabels[item.type] || item.type;

        return [
          itemCode,
          item.name,
          ncm,
          typeLabel,
          item.quantity,
          formatCurrency(item.unitPrice),
          formatCurrency(item.total)
        ];
      }),
      theme: 'striped',
      headStyles: { fillColor: [17, 24, 39] } // #111827
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;

    // Totals
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`TOTAL: ${formatCurrency(quote.grandTotal!)}`, 140, finalY);

    // Footer
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Termos e Condições:', 20, finalY + 30);
    doc.setFontSize(8);
    doc.text(quote.terms || '', 20, finalY + 37, { maxWidth: 170 });

    doc.save(`${quote.quoteNumber}.pdf`);
  };

  const canEdit = !isCustomer && (isSales || isManager || isAdmin);
  const canUpdateStatus = !isCustomer && (isTechnician || isSales || isManager || isAdmin);

  if (loading) return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-[#111827] border-t-transparent"></div></div>;

  return (
    <div className="space-y-8 pb-12">
      {/* Header Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/quotes')} className="rounded-lg p-2 hover:bg-[#F3F4F6]">
            <ChevronLeft className="h-6 w-6 text-[#6B7280]" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-[#111827]">{id === 'new' ? 'Novo Orçamento' : quote.quoteNumber}</h1>
            <p className="text-sm text-[#6B7280]">Gerencie os detalhes e itens da proposta comercial.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          {canEdit && (
            <>
              <button
                onClick={handleAiReview}
                disabled={isAiReviewing || quote.items?.length === 0}
                className="flex items-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-4 py-2.5 text-sm font-semibold text-[#111827] shadow-sm hover:bg-[#F9FAFB] disabled:opacity-50"
              >
                <Sparkles className={cn("h-4 w-4", isAiReviewing && "animate-pulse")} />
                Revisão IA
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 rounded-xl bg-[#111827] px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#111827]/20 hover:bg-black disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {saving ? 'Salvando...' : 'Salvar e Gerar PDF'}
              </button>
            </>
          )}
          {isCustomer && (
            <button
              onClick={generatePDF}
              className="flex items-center gap-2 rounded-xl bg-[#111827] px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#111827]/20 hover:bg-black"
            >
              <Download className="h-4 w-4" />
              Baixar PDF
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Left Column: Details & Items */}
        <div className="lg:col-span-2 space-y-8">
          {/* Active Timeline */}
          <section className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#111827]">
                <Clock className="h-5 w-5" />
                <h2 className="font-bold">Linha do Tempo Ativa</h2>
              </div>
              <div className="text-xs font-medium text-[#6B7280]">
                Status Atual: <span className="font-bold text-[#111827] uppercase">{
                  quote.status === 'received' ? 'Recebido' :
                  quote.status === 'analyzing' ? 'Em Análise' :
                  quote.status === 'negotiating' ? 'Em Tratativa' :
                  quote.status === 'awaiting_approval' ? 'Aguardando Aprovação' :
                  quote.status === 'executing' ? 'Execução' :
                  quote.status === 'finished' ? 'Finalizado' : quote.status
                }</span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="relative mb-12 px-4">
              <div className="absolute left-4 right-4 top-1/2 h-0.5 -translate-y-1/2 bg-[#F3F4F6]"></div>
              <div 
                className="absolute left-4 top-1/2 h-0.5 -translate-y-1/2 bg-[#111827] transition-all duration-500"
                style={{ 
                  width: `${
                    quote.status === 'received' ? '0%' :
                    quote.status === 'analyzing' ? '20%' :
                    quote.status === 'negotiating' ? '40%' :
                    quote.status === 'awaiting_approval' ? '60%' :
                    quote.status === 'executing' ? '80%' :
                    quote.status === 'finished' ? '100%' : '0%'
                  }`
                }}
              ></div>
              <div className="relative flex justify-between">
                {(['received', 'analyzing', 'negotiating', 'awaiting_approval', 'executing', 'finished'] as QuoteStatus[]).map((s, i) => {
                  const isActive = quote.status === s;
                  const isCompleted = [
                    'received', 'analyzing', 'negotiating', 'awaiting_approval', 'executing', 'finished'
                  ].indexOf(quote.status || 'received') >= i;

                  return (
                    <div key={s} className="flex flex-col items-center gap-2">
                      <button
                        disabled={!canUpdateStatus || id === 'new'}
                        onClick={() => handleStatusChange(s)}
                        className={cn(
                          "z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all",
                          isCompleted ? "border-[#111827] bg-[#111827] text-white" : "border-[#E5E7EB] bg-white text-[#9CA3AF]",
                          isActive && "ring-4 ring-[#111827]/10"
                        )}
                      >
                        {isCompleted ? <Check className="h-4 w-4" /> : <span className="text-[10px] font-bold">{i + 1}</span>}
                      </button>
                      <span className={cn(
                        "absolute -bottom-8 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap",
                        isCompleted ? "text-[#111827]" : "text-[#9CA3AF]"
                      )}>
                        {s === 'received' ? 'Recebido' :
                         s === 'analyzing' ? 'Análise' :
                         s === 'negotiating' ? 'Tratativa' :
                         s === 'awaiting_approval' ? 'Aprovação' :
                         s === 'executing' ? 'Execução' : 'Finalizado'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Timeline History */}
            <div className="mt-16 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#9CA3AF]">Histórico de Alterações</h3>
              <div className="space-y-3">
                {quote.timeline?.slice().reverse().map((event, idx) => (
                  <div key={idx} className="flex items-start gap-3 rounded-xl bg-[#F9FAFB] p-3 text-sm">
                    <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white shadow-sm">
                      <Clock className="h-3 w-3 text-[#6B7280]" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-[#111827]">
                        {event.userName} moveu para <span className="font-bold uppercase">{
                          event.status === 'received' ? 'Recebido' :
                          event.status === 'analyzing' ? 'Em Análise' :
                          event.status === 'negotiating' ? 'Em Tratativa' :
                          event.status === 'awaiting_approval' ? 'Aguardando Aprovação' :
                          event.status === 'executing' ? 'Execução' : 'Finalizado'
                        }</span>
                      </p>
                      <p className="text-[10px] text-[#6B7280]">
                        {new Date(event.timestamp).toLocaleString('pt-BR')} • {
                          event.userRole === 'admin' ? 'Administrador' :
                          event.userRole === 'manager' ? 'Gerente' :
                          event.userRole === 'sales' ? 'Vendedor' :
                          event.userRole === 'technician' ? 'Técnico' : 'Cliente'
                        }
                      </p>
                    </div>
                  </div>
                ))}
                {(!quote.timeline || quote.timeline.length === 0) && (
                  <p className="text-center text-xs text-[#9CA3AF]">Nenhum registro no histórico.</p>
                )}
              </div>
            </div>
          </section>

          {/* Customer Selection */}
          <section className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2 text-[#111827]">
              <User className="h-5 w-5" />
              <h2 className="font-bold">Informações do Cliente</h2>
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-semibold text-[#374151]">Numero do Orçamento</label>
                <input
                  type="text"
                  placeholder="Ex: 2024-001"
                  value={quote.quoteNumber || ''}
                  disabled={!canEdit}
                  onChange={(e) => setQuote({ ...quote, quoteNumber: e.target.value })}
                  className="h-11 w-full rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 text-sm focus:border-[#111827] focus:outline-none disabled:opacity-50"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-semibold text-[#374151]">Classificação do Orçamento</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'preventive', label: 'Preventivo' },
                    { id: 'preventive_preview', label: 'Preventivo Prévio' },
                    { id: 'corrective', label: 'Corretivo' },
                    { id: 'corrective_preview', label: 'Corretivo Prévio' },
                    { id: 'general_overhaul', label: 'Reforma Geral' },
                    { id: 'general_overhaul_preview', label: 'Reforma Geral Prévio' },
                    { id: 'complementary', label: 'Complementar' }
                  ].map((cls) => (
                    <button
                      key={cls.id}
                      type="button"
                      disabled={!canEdit}
                      onClick={() => handleClassificationChange(cls.id as QuoteClassification)}
                      className={cn(
                        "rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
                        quote.classification === cls.id
                          ? "bg-[#111827] text-white shadow-md"
                          : "bg-[#F3F4F6] text-[#6B7280] hover:bg-[#E5E7EB]"
                      )}
                    >
                      {cls.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-[#374151]">Cliente</label>
                <select
                  value={quote.customerId}
                  disabled={!canEdit}
                  onChange={(e) => {
                    const c = customers.find(cust => cust.id === e.target.value);
                    setQuote({ ...quote, customerId: e.target.value, customerName: c?.name });
                  }}
                  className="h-11 w-full rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 text-sm focus:border-[#111827] focus:outline-none disabled:opacity-50"
                >
                  <option value="">Selecione um cliente...</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-[#374151]">Validade</label>
                <input
                  type="date"
                  disabled={!canEdit}
                  value={quote.validUntil?.split('T')[0]}
                  onChange={(e) => setQuote({ ...quote, validUntil: e.target.value })}
                  className="h-11 w-full rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 text-sm focus:border-[#111827] focus:outline-none disabled:opacity-50"
                />
              </div>
            </div>
          </section>

          {/* Vehicle Information */}
          <section className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2 text-[#111827]">
              <Package className="h-5 w-5" />
              <h2 className="font-bold">Informações do Veículo</h2>
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-[#374151]">Placa</label>
                <input
                  type="text"
                  placeholder="ABC-1234"
                  disabled={!canEdit}
                  value={quote.vehiclePlate || ''}
                  onChange={(e) => {
                    const upperPlate = e.target.value.toUpperCase();
                    setQuote(prev => {
                      const updates: any = { vehiclePlate: upperPlate };
                      if (prev.classification) {
                        updates.terms = getTermsByClassification(prev.classification, upperPlate);
                      }
                      return { ...prev, ...updates };
                    });
                  }}
                  className="h-11 w-full rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 text-sm focus:border-[#111827] focus:outline-none disabled:opacity-50"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-semibold text-[#374151]">Modelo / Marca</label>
                <input
                  type="text"
                  placeholder="Ex: Toyota Corolla"
                  disabled={!canEdit}
                  value={quote.vehicleModel || ''}
                  onChange={(e) => setQuote({ ...quote, vehicleModel: e.target.value })}
                  className="h-11 w-full rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 text-sm focus:border-[#111827] focus:outline-none disabled:opacity-50"
                />
              </div>
              <div className="space-y-2 md:col-span-3">
                <label className="text-sm font-semibold text-[#374151]">Observações do Veículo</label>
                <textarea
                  placeholder="Ex: Riscos na porta esquerda, pneu careca..."
                  disabled={!canEdit}
                  value={quote.observations || ''}
                  onChange={(e) => setQuote({ ...quote, observations: e.target.value })}
                  className="w-full rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-4 text-sm focus:border-[#111827] focus:outline-none disabled:opacity-50"
                  rows={2}
                />
              </div>
            </div>
          </section>

          {/* Items Table */}
          <section className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#111827]">
                <Package className="h-5 w-5" />
                <h2 className="font-bold">Itens do Orçamento</h2>
              </div>
              {canEdit && (
                <div className="relative">
                  <div className="relative w-72">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
                    <input
                      type="text"
                      placeholder="Pesquisar no catálogo..."
                      value={itemSearchTerm}
                      onChange={(e) => {
                        setItemSearchTerm(e.target.value);
                        setShowItemResults(true);
                      }}
                      onFocus={() => setShowItemResults(true)}
                      className="h-10 w-full rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] pl-10 pr-10 text-sm focus:border-[#111827] focus:bg-white focus:outline-none transition-all"
                    />
                    {itemSearchTerm && (
                      <button
                        onClick={() => setItemSearchTerm('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#EF4444]"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                    
                    <AnimatePresence>
                      {showItemResults && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 10 }}
                          className="absolute right-0 top-full z-50 mt-2 w-96 rounded-xl border border-[#E5E7EB] bg-white p-2 shadow-xl"
                        >
                          <div className="max-h-64 overflow-y-auto custom-scrollbar">
                            {catalogItems
                              .filter(i => 
                                i.active && 
                                (itemSearchTerm === '' || 
                                 i.name.toLowerCase().includes(itemSearchTerm.toLowerCase()) || 
                                 i.ncm?.includes(itemSearchTerm) ||
                                 i.partCodes?.some(pc => pc.toLowerCase().includes(itemSearchTerm.toLowerCase())))
                              )
                              .map(item => (
                                <button
                                  key={item.id}
                                  onClick={() => {
                                    addItem(item);
                                    setItemSearchTerm('');
                                    setShowItemResults(false);
                                  }}
                                  className="flex w-full items-center gap-3 rounded-lg p-3 text-left hover:bg-[#F3F4F6] transition-colors"
                                >
                                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-martins-blue text-[#111827]">
                                    <Package className="h-4 w-4" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-[#111827] truncate uppercase">{item.name}</p>
                                    <div className="flex items-center gap-2 text-[10px] text-[#6B7280]">
                                      <span>{item.unit}</span>
                                      <span>•</span>
                                      <span className="font-bold text-[#111827]">{formatCurrency(item.basePrice)}</span>
                                      {item.ncm && (
                                        <>
                                          <span>•</span>
                                          <span>NCM: {item.ncm}</span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                  <Plus className="h-4 w-4 text-[#9CA3AF]" />
                                </button>
                              ))}
                            {catalogItems.filter(i => 
                              i.active && 
                              (itemSearchTerm === '' || 
                               i.name.toLowerCase().includes(itemSearchTerm.toLowerCase()) || 
                               i.ncm?.includes(itemSearchTerm) ||
                               i.partCodes?.some(pc => pc.toLowerCase().includes(itemSearchTerm.toLowerCase())))
                            ).length === 0 && (
                              <div className="py-8 text-center">
                                <Package className="h-8 w-8 mx-auto mb-2 text-[#E5E7EB]" />
                                <p className="text-sm text-[#9CA3AF]">Nenhum item encontrado.</p>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  {showItemResults && (
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setShowItemResults(false)}
                    />
                  )}
                </div>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[#F3F4F6] text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF]">
                    <th className="pb-4 pl-2">Cód</th>
                    <th className="pb-4">Item</th>
                    <th className="pb-4">NCM</th>
                    <th className="pb-4">Tipo</th>
                    <th className="pb-4 w-24">Qtd</th>
                    <th className="pb-4 w-32">Unitário</th>
                    <th className="pb-4 w-32">Total</th>
                    <th className="pb-4 pr-2 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3F4F6]">
                  {quote.items?.map((item, index) => {
                    const catalogItem = catalogItems.find(i => i.id === item.itemId);
                    const itemCode = item.itemCode || (catalogItem?.partCodes?.[0] || '');
                    const ncm = item.ncm || (catalogItem?.ncm || '-');
                    const typeLabels: Record<string, string> = {
                      service: 'Serviço',
                      product: 'Produto',
                      package: 'Pacote',
                      labor: 'Mão de Obra'
                    };
                    const typeLabel = typeLabels[item.type] || item.type;

                    return (
                      <tr key={index} className="group">
                        <td className="py-4 pl-2">
                          <p className="text-xs text-[#6B7280]">{itemCode}</p>
                        </td>
                        <td className="py-4">
                          <p className="font-bold text-[#111827]">{item.name}</p>
                        </td>
                        <td className="py-4">
                          <p className="text-xs text-[#6B7280]">{ncm}</p>
                        </td>
                        <td className="py-4">
                          <span className="rounded-full bg-[#F3F4F6] px-2 py-0.5 text-[10px] font-bold uppercase text-[#6B7280]">
                            {typeLabel}
                          </span>
                        </td>
                        <td className="py-4">
                          <input
                            type="number"
                            value={item.quantity}
                            disabled={!canEdit}
                            onChange={(e) => updateItem(index, { quantity: parseFloat(e.target.value) || 0 })}
                            className="h-9 w-20 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-2 text-sm focus:outline-none disabled:opacity-50"
                          />
                        </td>
                        <td className="py-4">
                          <input
                            type="number"
                            value={item.unitPrice}
                            disabled={!canEdit}
                            onChange={(e) => updateItem(index, { unitPrice: parseFloat(e.target.value) || 0 })}
                            className="h-9 w-28 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-2 text-sm focus:outline-none disabled:opacity-50"
                          />
                        </td>
                        <td className="py-4 font-bold text-[#111827]">{formatCurrency(item.total)}</td>
                        <td className="py-4 pr-2 text-right">
                          {canEdit && (
                            <button onClick={() => removeItem(index)} className="rounded-lg p-2 text-[#9CA3AF] hover:bg-[#FEF2F2] hover:text-[#EF4444]">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {quote.items?.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-[#9CA3AF]">Nenhum item adicionado.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* AI Feedback */}
          <AnimatePresence>
            {aiFeedback && (
              <motion.section
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="rounded-2xl border border-martins-blue bg-martins-blue/10 p-6"
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[#111827]">
                    <Sparkles className="h-5 w-5" />
                    <h2 className="font-bold">Análise Inteligente Gemini</h2>
                  </div>
                  <button onClick={() => setAiFeedback(null)} className="text-[#6B7280] hover:text-[#111827]">
                    <XCircle className="h-5 w-5" />
                  </button>
                </div>
                <div className="prose prose-sm text-[#111827]">
                  <p className="whitespace-pre-wrap">{aiFeedback}</p>
                </div>
              </motion.section>
            )}
          </AnimatePresence>
        </div>

        {/* Right Column: Totals & Notes */}
        <div className="space-y-8">
          <section className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-center gap-2 text-[#111827]">
              <Calculator className="h-5 w-5" />
              <h2 className="font-bold">Resumo de Valores</h2>
            </div>
            <div className="space-y-4">
              <div className="flex justify-between text-sm text-[#6B7280]">
                <span>Subtotal dos Itens</span>
                <span className="font-medium text-[#111827]">{formatCurrency(quote.subtotal || 0)}</span>
              </div>
              <div className="border-t border-[#F3F4F6] pt-4">
                <div className="flex justify-between">
                  <span className="text-lg font-bold text-[#111827]">Total Final</span>
                  <span className="text-2xl font-black text-[#111827]">{formatCurrency(quote.grandTotal || 0)}</span>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
            <h2 className="mb-4 font-bold text-[#111827]">Notas e Termos</h2>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-[#9CA3AF]">Observações Internas</label>
                <textarea
                  rows={3}
                  value={quote.notes}
                  onChange={(e) => setQuote({ ...quote, notes: e.target.value })}
                  className="w-full rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] p-3 text-sm focus:outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-[#9CA3AF]">Condições Comerciais (PDF)</label>
                <textarea
                  rows={3}
                  value={quote.terms}
                  onChange={(e) => setQuote({ ...quote, terms: e.target.value })}
                  className="w-full rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] p-3 text-sm focus:outline-none"
                />
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
