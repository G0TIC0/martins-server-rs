import { GoogleGenAI, Type } from "@google/genai";
import { UserRole } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const getSystemInstruction = (role: UserRole = 'sales') => {
  const base = "Você é um assistente virtual da Oficina Mecânica Martins, especialista em gestão de orçamentos e atendimento ao cliente.";
  if (role === 'customer') {
    return `${base} REGRA CRÍTICA: Você está conversando com o CLIENTE FINAL. NUNCA mencione margens de lucro, custos internos de peças, preços de custo ou qualquer dado financeiro sensível da oficina. Foque apenas no status do serviço, prazos e valor final aprovado.`;
  }
  return `${base} Você está conversando com um colaborador interno (Admin/Vendedor/Técnico). Pode discutir margens, custos e detalhes técnicos da operação para otimizar o resultado comercial.`;
};

export const suggestServiceDescription = async (serviceName: string, context: string, role?: UserRole) => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Sugira uma descrição profissional e comercialmente atraente para o serviço: "${serviceName}". Contexto: ${context}. Responda em Português do Brasil.`,
    config: {
      systemInstruction: getSystemInstruction(role),
    },
  });
  return response.text;
};

export const reviewQuoteItems = async (items: any[], role?: UserRole) => {
  // Filter out sensitive data if customer
  const filteredItems = role === 'customer' 
    ? items.map(({ costPrice, ...rest }) => rest)
    : items;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Revise os seguintes itens de um orçamento e identifique possíveis inconsistências ou sugestões de melhoria: ${JSON.stringify(filteredItems)}. Responda em Português do Brasil.`,
    config: {
      systemInstruction: getSystemInstruction(role),
    },
  });
  return response.text;
};

export const generateCommercialText = async (quoteData: any, role?: UserRole) => {
  // Filter out sensitive data if customer
  const filteredData = role === 'customer'
    ? { ...quoteData, items: quoteData.items?.map(({ costPrice, ...rest }: any) => rest) }
    : quoteData;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Gere um texto de introdução executiva para uma proposta comercial com os seguintes dados: ${JSON.stringify(filteredData)}. O tom deve ser profissional e persuasivo. Responda em Português do Brasil.`,
    config: {
      systemInstruction: getSystemInstruction(role),
    },
  });
  return response.text;
};

export const parseUnstructuredQuote = async (text: string) => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Extraia os dados de orçamento deste texto: "${text}". Retorne um JSON estruturado com: cliente, itens (nome, quantidade, preco), descontos, observacoes.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          customer: { type: Type.STRING },
          items: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                quantity: { type: Type.NUMBER },
                price: { type: Type.NUMBER }
              }
            }
          },
          discounts: { type: Type.NUMBER },
          observations: { type: Type.STRING }
        }
      }
    }
  });
  return JSON.parse(response.text);
};
