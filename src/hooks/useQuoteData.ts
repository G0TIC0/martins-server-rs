import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { withRetry } from '../lib/supabase-retry';
import { 
  Quote, 
  Customer, 
  Item, 
  CompanySettings, 
  QuoteStatus, 
  TimelineEvent, 
  QuotePhoto 
} from '../types';
import { 
  mapQuote, 
  mapCustomer, 
  mapItem, 
  generateQuoteNumber 
} from '../lib/utils';
import { useSupabase } from '../context/SupabaseContext';

export function useQuoteData(id: string | undefined) {
  const { profile } = useSupabase();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [catalogItems, setCatalogItems] = useState<Item[]>([]);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [photos, setPhotos] = useState<Partial<QuotePhoto>[]>([]);
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

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      // Reset state for new quote
      if (id === 'new') {
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
      }

      const [custRes, itemRes, settingsRes] = await Promise.all([
        withRetry(async () => await supabase.from('customers').select('*').order('name')) as Promise<{ data: any[] | null; error: any }>,
        withRetry(async () => await supabase.from('items').select('*').order('name')) as Promise<{ data: any[] | null; error: any }>,
        withRetry(async () => await supabase.from('company_settings').select('*').limit(1).single()) as Promise<{ data: any | null; error: any }>,
      ]);

      if (custRes.error) throw custRes.error;
      if (itemRes.error) throw itemRes.error;

      setCustomers((custRes.data || []).map(mapCustomer) as Customer[]);
      setCatalogItems((itemRes.data || []).map(mapItem) as Item[]);
      
      if (settingsRes.data) {
        const data = settingsRes.data;
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

      if (id && id !== 'new') {
        const { data: quoteData, error: quoteError } = await withRetry(async () => 
          await supabase
            .from('quotes')
            .select('*, quote_items(*), timeline_events(*), quote_photos(*)')
            .eq('id', id)
            .single()
        ) as { data: any | null; error: any };
        
        if (quoteError) throw quoteError;
        if (quoteData) {
          const mapped = mapQuote(quoteData);
          setQuote(mapped);
          if (mapped.photos) {
            setPhotos(mapped.photos);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
      return true;
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Erro ao atualizar status.');
      return false;
    }
  };

  const saveQuote = async () => {
    if (!quote.customerId) {
      alert('Selecione um cliente.');
      return null;
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

      // Save Items
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
      
      // Refresh local state
      const { data: refreshedData } = await supabase
        .from('quotes')
        .select('*, quote_items(*), timeline_events(*), quote_photos(*)')
        .eq('id', quoteId!)
        .single();
      
      if (refreshedData) {
        const mapped = mapQuote(refreshedData);
        setQuote(mapped);
        if (mapped.photos) setPhotos(mapped.photos);
        return mapped;
      }
      
      return null;
    } catch (error: any) {
      console.error('Error saving quote:', error);
      alert(`Erro ao salvar orçamento: ${error.message}`);
      return null;
    } finally {
      setSaving(false);
    }
  };

  return {
    quote, setQuote,
    customers,
    catalogItems,
    companySettings,
    photos, setPhotos,
    loading,
    saving,
    saveQuote,
    handleStatusChange,
  };
}
