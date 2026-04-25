import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { withRetry } from '../lib/supabase-retry';
import { Quote, Customer, CompanySettings } from '../types';
import { formatCurrency } from '../lib/utils';

export function useQuoteEmail(
  quote: Partial<Quote>, 
  customers: Customer[], 
  companySettings: CompanySettings | null
) {
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  const sendEmail = async () => {
    setIsSendingEmail(true);
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
        console.warn('[useQuoteEmail] Error fetching email recipients:', emailError);
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
      const displayQuoteNumber = quote.quoteNumber?.includes('-') 
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
    } finally {
      setIsSendingEmail(false);
    }
  };

  return {
    sendEmail,
    isSendingEmail,
  };
}
