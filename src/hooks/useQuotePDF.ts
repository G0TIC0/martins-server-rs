import { useState } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Quote, CompanySettings, Customer, Item } from '../types';
import { formatCurrency } from '../lib/utils';

export function useQuotePDF(
  quote: Partial<Quote>, 
  companySettings: CompanySettings | null,
  customers: Customer[],
  catalogItems: Item[]
) {
  const [isPDFGenerating, setIsPDFGenerating] = useState(false);

  const generatePDF = async (quoteData?: Partial<Quote>) => {
    setIsPDFGenerating(true);
    try {
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
      const quotePhotos = currentQuote.photos || [];

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
    } finally {
      setIsPDFGenerating(false);
    }
  };

  return {
    generatePDF,
    isPDFGenerating,
  };
}
