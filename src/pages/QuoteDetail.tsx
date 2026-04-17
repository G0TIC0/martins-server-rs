// OTIMIZAÇÕES APLICADAS: #6a (lazy load), #6b (customer search), #6c (catalog search)
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Quote, Customer, Item, QuoteItem, QuoteStatus, CompanySettings, TimelineEvent, QuoteClassification, QuotePhoto, EmailRecipient } from '../types';
import { useSupabase } from '../context/SupabaseContext';
import { mapQuote, mapCustomer, mapItem, mapProfile, debounce } from '../lib/utils';
import { Plus, Trash2, Save, Send, CheckCircle, XCircle, X, Search, FileText, Sparkles, AlertCircle, ChevronLeft, Download, User, Package, Calculator, Clock, Check, Image as ImageIcon, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatCurrency, generateQuoteNumber } from '../lib/utils';
import { reviewQuoteItems, generateCommercialText } from '../services/geminiService';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

import { withRetry } from '../lib/supabase-retry';

export const QuoteDetail: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile, isSales, isManager, isAdmin, isTechnician, isCustomer } = useSupabase();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isAiReviewing, setIsAiReviewing] = useState(false);
  const [aiFeedback, setAiFeedback] = useState<string | null>(null);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [catalogItems, setCatalogItems] = useState<Item[]>([]);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [photos, setPhotos] = useState<Partial<QuotePhoto>[]>([]);
  const [itemSearchTerm, setItemSearchTerm] = useState('');
  const [showItemResults, setShowItemResults] = useState(false);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  
  const [customerSearch, setCustomerSearch] = useState('');
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false);
  const [showCustomerResults, setShowCustomerResults] = useState(false);

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
        setLoading(true);
        // Reset quote state to prevent duplication from previous views
        setQuote({
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
        setPhotos([]);

        const [settingsRes, quoteRes] = await Promise.all([
          withRetry(async () =>
            await supabase.from('company_settings').select('*').limit(1).single()
          ) as Promise<{ data: any | null; error: any }>,
          id && id !== 'new'
            ? withRetry(async () =>
                await supabase
                  .from('quotes')
                  .select('*, quote_items(*), timeline_events(*), quote_photos(*)')
                  .eq('id', id)
                  .single()
              ) as Promise<{ data: any | null; error: any }>
            : Promise.resolve({ data: null, error: null }),
        ]);
        
        if (settingsRes.data) {
          const data = settingsRes.data as any;
          setCompanySettings({
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

        if (quoteRes.data) {
          const mapped = mapQuote(quoteRes.data as any);
          setQuote(mapped);
          setCustomerSearch(mapped.customerName || '');
          
          if (mapped.photos) {
            setPhotos(mapped.photos);
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

  const searchCustomers = React.useCallback(
    debounce(async (term: string) => {
      if (term.length < 2) {
        setCustomers([]);
        return;
      }
      setIsLoadingCustomers(true);
      try {
        const { data } = await supabase
          .from('customers')
          .select('*')
          .ilike('name', `%${term}%`)
          .limit(15)
          .order('name');
        setCustomers((data || []).map(mapCustomer) as Customer[]);
      } catch (error) {
        console.error('[QuoteDetail] Error searching customers:', error);
      } finally {
        setIsLoadingCustomers(false);
      }
    }, 350),
    []
  );

  const searchCatalogItems = React.useCallback(
    debounce(async (term: string) => {
      if (term.length < 2) {
        setCatalogItems([]);
        return;
      }
      setIsLoadingItems(true);
      try {
        const { data } = await supabase
          .from('items')
          .select('*')
          .eq('active', true)
          .or(`name.ilike.%${term}%,part_codes.cs.{${term}}`)
          .limit(20)
          .order('name');
        setCatalogItems((data || []).map(mapItem) as Item[]);
      } catch (error) {
        console.error('[QuoteDetail] Error searching items:', error);
      } finally {
        setIsLoadingItems(false);
      }
    }, 350),
    []
  );

  useEffect(() => {
    searchCustomers(customerSearch);
  }, [customerSearch, searchCustomers]);

  useEffect(() => {
    searchCatalogItems(itemSearchTerm);
  }, [itemSearchTerm, searchCatalogItems]);

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
      unitPrice: catalogItem.basePrice || 0,
      discount: 0,
      total: catalogItem.basePrice || 0,
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

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const remainingSlots = 10 - photos.length;
    const filesToProcess = Array.from(files).slice(0, remainingSlots);

    filesToProcess.forEach(file => {
      const f = file as File;
      if (f.size > 2 * 1024 * 1024) {
        alert(`A foto ${f.name} excede o limite de 2MB.`);
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotos(prev => [...prev, {
          photoUrl: reader.result as string,
          caption: '',
          sortOrder: prev.length
        }]);
      };
      reader.readAsDataURL(f);
    });
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const updatePhotoCaption = (index: number, caption: string) => {
    setPhotos(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], caption };
      return updated;
    });
  };

  const handleSendEmail = async () => {
    try {
      if (!quote) return;

      // Buscar destinatários fixos
      const { data, error: emailError } = await withRetry(async () => 
        await supabase
          .from('email_recipients')
          .select('email')
          .eq('active', true)
      ) as { data: any[] | null; error: any };

      if (emailError) {
        console.warn('[QuoteDetail] Error fetching email recipients:', emailError);
      }

      // E-mails configurados vão para o CC
      const ccEmails = (data || [])
        .map((r: any) => r.email)
        .filter(email => email && email.trim() !== '');
      
      // Buscar e-mail do cliente (vai para o TO)
      const customer = customers.find(c => c.id === quote.customerId);
      const customerEmail = customer?.email || '';
      
      // Se o e-mail do cliente estiver na lista de CC, removemos do CC para não duplicar
      const filteredCc = ccEmails.filter(email => email !== customerEmail);

      if (!customerEmail && filteredCc.length === 0) {
        alert('Nenhum e-mail de destino encontrado. Verifique o cadastro do cliente ou os e-mails fixos em Configurações.');
        return;
      }

      // Extrair apenas o número final do orçamento se seguir o padrão ORC-YYYYMM-XXXX
      const displayQuoteNumber = quote.quoteNumber.includes('-') 
        ? quote.quoteNumber.split('-').pop() 
        : quote.quoteNumber;

      const subject = encodeURIComponent(`Orçamento nº ${displayQuoteNumber} - ${quote.title}`);
      
      // Construir a lista de itens para o corpo do e-mail
      const itemsList = (quote.items || []).map((item, index) => 
        `${index + 1}. ${item.name.toUpperCase()} – ${item.quantity} ${item.unit || 'un'} – ${formatCurrency(item.unitPrice)}`
      ).join('\n');

      const bodyText = `Prezados,

Conforme solicitado, segue o orçamento nº ${displayQuoteNumber} referente aos serviços de manutenção mecânica:

${itemsList}

Valor total: ${formatCurrency(quote.grandTotal || 0)}
Prazo estimado: 30 dias

Esta proposta é válida por 30 dias. O pagamento pode ser realizado via PIX ou transferência bancária. Favor responder a este e-mail para confirmação e agendamento do serviço.

Atenciosamente,
${companySettings?.name || 'S.F SERVIÇOS MECÂNICOS'}
${companySettings?.phone || ''} | ${companySettings?.email || ''}`;

      const body = encodeURIComponent(bodyText);

      // Usar o Gmail Web com destinatário principal e cópias configuradas
      const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(customerEmail)}&cc=${encodeURIComponent(filteredCc.join(','))}&su=${subject}&body=${body}`;
      
      // Abrir em nova aba de forma mais robusta
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
      console.error('Error sending email:', error);
      alert('Ocorreu um erro ao tentar abrir o e-mail. Verifique se o seu navegador permite pop-ups.');
    }
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
      const { error: statusError } = await withRetry(async () => 
        await supabase
          .from('quotes')
          .update({
            status: newStatus,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
      ) as { error: any };

      if (statusError) throw statusError;

      const { error: timelineError } = await withRetry(async () => 
        await supabase
          .from('timeline_events')
          .insert({
            quote_id: id,
            status: event.status,
            timestamp: event.timestamp,
            user_id: event.userId || null,
            user_name: event.userName,
            user_role: event.userRole,
            notes: event.notes,
          })
      ) as { error: any };

      if (timelineError) throw timelineError;

      setQuote(prev => ({ ...prev, status: newStatus, timeline: updatedTimeline }));
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Erro ao atualizar status.');
    }
  };

  const handleSave = async () => {
    if (!quote.customerId) {
      alert('Selecione um cliente.');
      return;
    }
    setSaving(true);
    try {
      const quoteData = {
        quote_number: quote.quoteNumber || generateQuoteNumber(),
        title: quote.title || 'Sem Título',
        customer_id: quote.customerId,
        customer_name: quote.customerName || 'Cliente não identificado',
        status: quote.status || 'received',
        classification: quote.classification,
        vehicle_plate: quote.vehiclePlate || '',
        vehicle_model: quote.vehicleModel || '',
        observations: quote.observations || '',
        subtotal: Number(quote.subtotal) || 0,
        discount_total: Number(quote.discountTotal) || 0,
        tax_total: Number(quote.taxTotal) || 0,
        shipping_fee: Number(quote.shippingFee) || 0,
        urgency_fee: Number(quote.urgencyFee) || 0,
        grand_total: Number(quote.grandTotal) || 0,
        valid_until: quote.validUntil || new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
        notes: quote.notes || '',
        terms: quote.terms || '',
        updated_at: new Date().toISOString(),
      };

      let quoteId = id;

      if (id === 'new') {
        const { data: newQuote, error: quoteError } = await withRetry(async () => 
          await supabase
            .from('quotes')
            .insert({
              ...quoteData,
              status: 'received',
              created_by: profile?.uid || null,
              created_at: new Date().toISOString(),
            })
            .select()
            .single()
        ) as { data: any | null; error: any };

        if (quoteError) throw new Error(`Erro ao criar orçamento: ${quoteError.message}`);
        if (!newQuote) throw new Error('Falha ao criar orçamento: Nenhum dado retornado.');
        quoteId = newQuote.id;

        const initialEvent = {
          quote_id: quoteId,
          status: 'received',
          timestamp: new Date().toISOString(),
          user_id: profile?.uid || null,
          user_name: profile?.displayName || 'Sistema',
          user_role: profile?.role || 'admin',
        };
        
        const { error: eventError } = await withRetry(async () => 
          await supabase.from('timeline_events').insert(initialEvent)
        ) as { error: any };

        if (eventError) console.warn('Erro ao criar evento inicial:', eventError);
      } else {
        const { error: quoteError } = await withRetry(async () => 
          await supabase
            .from('quotes')
            .update(quoteData)
            .eq('id', id!)
        ) as { error: any };
        
        if (quoteError) throw new Error(`Erro ao atualizar orçamento: ${quoteError.message}`);
      }

      // Save Items (Delete existing and insert new)
      if (quoteId && quoteId !== 'new') {
        const { error: deleteError } = await withRetry(async () => 
          await supabase.from('quote_items').delete().eq('quote_id', quoteId!)
        ) as { error: any };

        if (deleteError) throw new Error(`Erro ao limpar itens antigos: ${deleteError.message}`);

        if (quote.items && quote.items.length > 0) {
          const itemsToInsert = quote.items.map(item => ({
            quote_id: quoteId,
            item_id: item.itemId,
            item_code: item.itemCode || '',
            name: item.name || 'Item sem nome',
            ncm: item.ncm || '',
            type: item.type || 'product',
            quantity: Number(item.quantity) || 0,
            cost_price: Number(item.costPrice) || 0,
            unit_price: Number(item.unitPrice) || 0,
            discount: Number(item.discount) || 0,
            total: Number(item.total) || 0,
          }));

          const { error: itemsError } = await withRetry(async () => 
            await supabase.from('quote_items').insert(itemsToInsert)
          ) as { error: any };

          if (itemsError) throw new Error(`Erro ao salvar novos itens: ${itemsError.message}`);
        }

        // Save Photos
        const { error: deletePhotosError } = await withRetry(async () => 
          await supabase.from('quote_photos').delete().eq('quote_id', quoteId!)
        ) as { error: any };

        if (deletePhotosError) throw new Error(`Erro ao limpar fotos antigas: ${deletePhotosError.message}`);

        if (photos.length > 0) {
          const photosToInsert = photos.map((photo, index) => ({
            quote_id: quoteId,
            photo_url: photo.photoUrl,
            caption: photo.caption || '',
            sort_order: index,
          }));

          const { error: photosError } = await withRetry(async () => 
            await supabase.from('quote_photos').insert(photosToInsert)
          ) as { error: any };

          if (photosError) throw new Error(`Erro ao salvar fotos: ${photosError.message}`);
        }
      }
      
      // Generate PDF after saving but BEFORE navigation
      try {
        // Update quote state with photos for PDF generation
        const updatedQuote = { ...quote, photos: photos as QuotePhoto[] };
        await generatePDF(updatedQuote);
      } catch (pdfError) {
        console.error('Error generating PDF:', pdfError);
        alert('Orçamento salvo, mas houve um erro ao gerar o PDF. Você pode tentar baixar o PDF novamente na lista de orçamentos.');
      }
      
      // If it was a new quote, navigate to it
      if (id === 'new' && quoteId) {
        alert('Orçamento salvo com sucesso!');
        navigate(`/quotes/${quoteId}`, { replace: true });
      } else {
        // Refresh data if not navigating
        const { data: refreshedData } = await supabase
          .from('quotes')
          .select('*, quote_items(*), timeline_events(*), quote_photos(*)')
          .eq('id', quoteId!)
          .single();
        if (refreshedData) {
          const mapped = mapQuote(refreshedData);
          setQuote(mapped);
          if (mapped.photos) setPhotos(mapped.photos);
        }
        alert('Orçamento salvo com sucesso!');
      }
    } catch (error: any) {
      console.error('Error saving quote:', error);
      alert(`Erro ao salvar orçamento: ${error.message}`);
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

  const generatePDF = async (quoteData?: Partial<Quote>) => {
    const doc = new jsPDF();
    const currentQuote = quoteData || quote;
    const customer = customers.find(c => c.id === currentQuote.customerId);

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
      try {
        const base64Logo = await getBase64FromUrl(companySettings.logoUrl);
        if (base64Logo) {
          doc.addImage(base64Logo, 'JPEG', 20, 10, 30, 30);
        }
      } catch (e) {
        console.warn('Could not add logo to PDF:', e);
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
    doc.text(`Número: ${currentQuote.quoteNumber}`, 20, 55);
    
    let currentY = 60;
    if (currentQuote.classification) {
      const classificationLabels: Record<string, string> = {
        preventive: 'Preventivo',
        preventive_preview: 'Preventivo Prévio',
        corrective: 'Corretivo',
        corrective_preview: 'Corretivo Prévio',
        general_overhaul: 'Reforma Geral',
        general_overhaul_preview: 'Reforma Geral Prévio',
        complementary: 'Complementar'
      };
      doc.text(`Classificação: ${classificationLabels[currentQuote.classification]}`, 20, currentY);
      currentY += 5;
    }
    
    doc.text(`Data: ${new Date().toLocaleDateString()}`, 20, currentY);
    currentY += 5;
    
    const validUntilDate = currentQuote.validUntil ? new Date(currentQuote.validUntil) : null;
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

    doc.text(`Placa: ${currentQuote.vehiclePlate || '-'}`, 110, 92);
    doc.text(`Modelo: ${currentQuote.vehicleModel || '-'}`, 110, 97);

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
      body: (currentQuote.items || []).map(item => {
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
          formatCurrency(item.unitPrice || 0),
          formatCurrency(item.total || 0)
        ];
      }),
      theme: 'striped',
      headStyles: { fillColor: [17, 24, 39] } // #111827
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;

    // Totals
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    const totalValue = currentQuote.grandTotal || 0;
    doc.text(`TOTAL: ${formatCurrency(totalValue)}`, 140, finalY);

    // Footer
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Termos e Condições:', 20, finalY + 30);
    doc.setFontSize(8);
    doc.text(currentQuote.terms || '', 20, finalY + 37, { maxWidth: 170 });

    // Photos Section
    const quotePhotos = (currentQuote.photos && currentQuote.photos.length > 0) 
      ? currentQuote.photos 
      : (photos as QuotePhoto[]);

    if (quotePhotos.length > 0) {
      doc.addPage();
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('REGISTRO FOTOGRÁFICO', 105, 20, { align: 'center' });

      let photoX = 20;
      let photoY = 30;
      const photoWidth = 85;
      const photoHeight = 60;
      const marginBetween = 10;
      let col = 0;

      for (const photo of quotePhotos) {
        if (!photo.photoUrl) continue;
        
        const base64 = await getBase64FromUrl(photo.photoUrl);
        if (!base64) continue;

        if (photoY + photoHeight + 20 > doc.internal.pageSize.height - 20) {
          doc.addPage();
          photoX = 20;
          photoY = 30;
          col = 0;
        }

        try {
          // Detect format from base64 string
          let format = 'JPEG';
          if (base64.startsWith('data:image/png')) format = 'PNG';
          if (base64.startsWith('data:image/webp')) format = 'WEBP';
          
          doc.addImage(base64, format, photoX, photoY, photoWidth, photoHeight, undefined, 'FAST');
          
          if (photo.caption) {
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.text(photo.caption, photoX + photoWidth / 2, photoY + photoHeight + 5, { align: 'center' });
          }
        } catch (imgError) {
          console.warn('Error adding image to PDF:', imgError);
        }

        col++;
        if (col === 2) {
          col = 0;
          photoX = 20;
          photoY += photoHeight + marginBetween + 10;
        } else {
          photoX += photoWidth + marginBetween;
        }
      }
    }

    doc.save(`${currentQuote.quoteNumber}.pdf`);
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
        <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
          {canEdit && (
            <>
              <button
                onClick={handleSendEmail}
                className="flex h-11 items-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-4 text-sm font-semibold text-[#111827] shadow-sm transition-all hover:bg-[#F9FAFB] active:scale-95"
              >
                <Send className="h-4 w-4" />
                <span className="hidden xs:inline">Enviar por E-mail</span>
                <span className="xs:hidden">E-mail</span>
              </button>
              <button
                onClick={handleAiReview}
                disabled={isAiReviewing || (quote.items?.length || 0) === 0}
                className="flex h-11 items-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-4 text-sm font-semibold text-[#111827] shadow-sm transition-all hover:bg-[#F9FAFB] active:scale-95 disabled:opacity-50"
              >
                <Sparkles className={cn("h-4 w-4", isAiReviewing && "animate-pulse")} />
                <span className="hidden xs:inline">Revisão IA</span>
                <span className="xs:hidden">IA</span>
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex h-11 items-center gap-2 rounded-xl bg-[#111827] px-6 text-sm font-semibold text-white shadow-lg shadow-[#111827]/20 transition-all hover:bg-black active:scale-95 disabled:opacity-50"
              >
                {saving ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                <span>{saving ? 'Salvando...' : 'Salvar e Gerar PDF'}</span>
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
              <div className="space-y-2 relative">
                <label className="text-sm font-semibold text-[#374151]">Cliente</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
                  <input
                    type="text"
                    placeholder="Pesquisar cliente..."
                    disabled={!canEdit}
                    value={customerSearch}
                    onChange={(e) => {
                      setCustomerSearch(e.target.value);
                      setShowCustomerResults(true);
                    }}
                    onFocus={() => setShowCustomerResults(true)}
                    className="h-11 w-full rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] pl-10 pr-4 text-sm focus:border-[#111827] focus:outline-none disabled:opacity-50"
                  />
                  {isLoadingCustomers && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Loader2 className="h-4 w-4 animate-spin text-[#6B7280]" />
                    </div>
                  )}
                </div>

                <AnimatePresence>
                  {showCustomerResults && customerSearch.length >= 2 && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute left-0 top-full z-50 mt-2 w-full rounded-xl border border-[#E5E7EB] bg-white p-2 shadow-xl"
                    >
                      <div className="max-h-64 overflow-y-auto custom-scrollbar">
                        {customers.map(c => (
                          <button
                            key={c.id}
                            onClick={() => {
                              setQuote({ ...quote, customerId: c.id, customerName: c.name });
                              setCustomerSearch(c.name);
                              setShowCustomerResults(false);
                            }}
                            className="flex w-full items-center gap-3 rounded-lg p-3 text-left hover:bg-[#F3F4F6] transition-colors"
                          >
                            <User className="h-4 w-4 text-[#6B7280]" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-[#111827] truncate">{c.name}</p>
                              <p className="text-[10px] text-[#6B7280]">{c.document || 'Sem documento'}</p>
                            </div>
                          </button>
                        ))}
                        {customers.length === 0 && !isLoadingCustomers && (
                          <div className="py-8 text-center">
                            <User className="h-8 w-8 mx-auto mb-2 text-[#E5E7EB]" />
                            <p className="text-sm text-[#9CA3AF]">Nenhum cliente encontrado.</p>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                {showCustomerResults && (
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setShowCustomerResults(false)}
                  />
                )}
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
                        onClick={() => {
                          setItemSearchTerm('');
                          setCatalogItems([]);
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#EF4444]"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                    
                    <AnimatePresence>
                      {showItemResults && itemSearchTerm.length >= 2 && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 10 }}
                          className="absolute right-0 top-full z-50 mt-2 w-96 rounded-xl border border-[#E5E7EB] bg-white p-2 shadow-xl"
                        >
                          {isLoadingItems && (
                            <div className="flex items-center justify-center py-8">
                              <Loader2 className="h-6 w-6 animate-spin text-[#111827]" />
                            </div>
                          )}
                          {!isLoadingItems && (
                            <div className="max-h-64 overflow-y-auto custom-scrollbar">
                              {catalogItems.map(item => (
                                <button
                                  key={item.id}
                                  onClick={() => {
                                    addItem(item);
                                    setItemSearchTerm('');
                                    setCatalogItems([]);
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
                              {catalogItems.length === 0 && (
                                <div className="py-8 text-center">
                                  <Package className="h-8 w-8 mx-auto mb-2 text-[#E5E7EB]" />
                                  <p className="text-sm text-[#9CA3AF]">Nenhum item encontrado.</p>
                                </div>
                              )}
                            </div>
                          )}
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
          
          {/* Photos Section */}
          <section className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#111827]">
                <ImageIcon className="h-5 w-5" />
                <h2 className="font-bold">Fotos do Serviço / Veículo</h2>
              </div>
              {canEdit && (
                <div className="flex items-center gap-2">
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg bg-[#111827] px-3 py-1.5 text-xs font-bold text-white hover:bg-black transition-colors">
                    <Plus className="h-3 w-3" />
                    Adicionar Fotos
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                  </label>
                  <span className="text-[10px] text-[#6B7280]">{photos.length}/10 fotos</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {photos.map((photo, index) => (
                <div key={index} className="group relative overflow-hidden rounded-xl border border-[#E5E7EB] bg-[#F9FAFB]">
                  <div className="aspect-video w-full overflow-hidden">
                    <img
                      src={photo.photoUrl}
                      alt={`Foto ${index + 1}`}
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  {canEdit && (
                    <button
                      onClick={() => removePhoto(index)}
                      className="absolute right-2 top-2 rounded-full bg-white/90 p-1.5 text-red-500 shadow-sm hover:bg-red-50 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <div className="p-3">
                    <input
                      type="text"
                      placeholder="Legenda da foto..."
                      value={photo.caption || ''}
                      disabled={!canEdit}
                      onChange={(e) => updatePhotoCaption(index, e.target.value)}
                      className="w-full bg-transparent text-xs text-[#111827] focus:outline-none placeholder:text-[#9CA3AF] disabled:opacity-50"
                    />
                  </div>
                </div>
              ))}
              {photos.length === 0 && (
                <div className="col-span-full flex flex-col items-center justify-center py-12 text-[#9CA3AF]">
                  <ImageIcon className="h-12 w-12 mb-2 opacity-20" />
                  <p className="text-sm">Nenhuma foto anexada.</p>
                </div>
              )}
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
