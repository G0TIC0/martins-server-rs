import { useMemo } from 'react';
import { QuoteItem } from '../types';

interface Fees {
  shippingFee: number;
  urgencyFee: number;
  taxTotal: number;
}

export function useQuoteCalculations(items: QuoteItem[], fees: Fees) {
  const subtotal = useMemo(() => {
    return items.reduce((acc, item) => acc + (item.total || 0), 0);
  }, [items]);

  const discountTotal = useMemo(() => {
    return items.reduce((acc, item) => acc + (item.discount || 0), 0);
  }, [items]);

  const grandTotal = useMemo(() => {
    return (subtotal - discountTotal) + (fees.shippingFee || 0) + (fees.urgencyFee || 0) + (fees.taxTotal || 0);
  }, [subtotal, discountTotal, fees.shippingFee, fees.urgencyFee, fees.taxTotal]);

  return { subtotal, discountTotal, grandTotal };
}
