import { UserRole, ParsedQuote } from "../types";

export const suggestServiceDescription = async (serviceName: string, context: string, role?: UserRole): Promise<string> => {
  const response = await fetch('/api/ai/suggest-description', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ serviceName, context, role }),
  });
  const data = await response.json();
  return data.text;
};

export const reviewQuoteItems = async (items: any[], role?: UserRole): Promise<string> => {
  const response = await fetch('/api/ai/review-items', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items, role }),
  });
  const data = await response.json();
  return data.text;
};

export const generateCommercialText = async (quoteData: any, role?: UserRole): Promise<string> => {
  const response = await fetch('/api/ai/commercial-text', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quoteData, role }),
  });
  const data = await response.json();
  return data.text;
};

export const parseUnstructuredQuote = async (text: string): Promise<ParsedQuote> => {
  const response = await fetch('/api/ai/parse-quote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  const jsonResponse = await response.json();
  return jsonResponse.data;
};
