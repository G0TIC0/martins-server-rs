import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI, Type } from "@google/genai";
import "dotenv/config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

const getSystemInstruction = (role: string = 'sales') => {
  const base = "Você é um assistente virtual da Oficina Mecânica Martins, especialista em gestão de orçamentos e atendimento ao cliente.";
  if (role === 'customer') {
    return `${base} REGRA CRÍTICA: Você está conversando com o CLIENTE FINAL. NUNCA mencione margens de lucro, custos internos de peças, preços de custo ou qualquer dado financeiro sensível da oficina. Foque apenas no status do serviço, prazos e valor final aprovado.`;
  }
  return `${base} Você está conversando com um colaborador interno (Admin/Vendedor/Técnico). Pode discutir margens, custos e detalhes técnicos da operação para otimizar o resultado comercial.`;
};

export async function createServer() {
  const app = express();

  // Allow embedding in iframes
  app.use((req, res, next) => {
    res.setHeader('Content-Security-Policy', "frame-ancestors *");
    res.removeHeader('X-Frame-Options');
    next();
  });

  app.use(express.json());

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Gemini AI Endpoints
  app.post("/api/ai/suggest-description", async (req, res) => {
    try {
      const { serviceName, context, role } = req.body;
      const response = await genAI.models.generateContent({
        model: "gemini-1.5-flash",
        contents: `Sugira uma descrição profissional e comercialmente atraente para o serviço: "${serviceName}". Contexto: ${context}. Responda em Português do Brasil.`,
        config: {
          systemInstruction: getSystemInstruction(role),
        },
      });
      res.json({ text: response.text });
    } catch (error) {
      console.error("AI Error:", error);
      res.status(500).json({ error: "Failed to generate AI content" });
    }
  });

  app.post("/api/ai/review-items", async (req, res) => {
    try {
      const { items, role } = req.body;
      const filteredItems = role === 'customer' 
        ? items.map(({ costPrice, ...rest }: any) => rest)
        : items;
      
      const response = await genAI.models.generateContent({
        model: "gemini-1.5-flash",
        contents: `Revise os seguintes itens de um orçamento e identifique possíveis inconsistências ou sugestões de melhoria: ${JSON.stringify(filteredItems)}. Responda em Português do Brasil.`,
        config: {
          systemInstruction: getSystemInstruction(role),
        },
      });
      res.json({ text: response.text });
    } catch (error) {
      console.error("AI Error:", error);
      res.status(500).json({ error: "Failed to review items" });
    }
  });

  app.post("/api/ai/commercial-text", async (req, res) => {
    try {
      const { quoteData, role } = req.body;
      const filteredData = role === 'customer'
        ? { ...quoteData, items: quoteData.items?.map(({ costPrice, ...rest }: any) => rest) }
        : quoteData;

      const response = await genAI.models.generateContent({
        model: "gemini-1.5-flash",
        contents: `Gere um texto de introdução executiva para uma proposta comercial com os seguintes dados: ${JSON.stringify(filteredData)}. O tom deve ser profissional e persuasivo. Responda em Português do Brasil.`,
        config: {
          systemInstruction: getSystemInstruction(role),
        },
      });
      res.json({ text: response.text });
    } catch (error) {
      console.error("AI Error:", error);
      res.status(500).json({ error: "Failed to generate commercial text" });
    }
  });

  app.post("/api/ai/parse-quote", async (req, res) => {
    try {
      const { text } = req.body;
      const response = await genAI.models.generateContent({
        model: "gemini-1.5-flash",
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
      res.json({ data: JSON.parse(response.text) });
    } catch (error) {
      console.error("AI Error:", error);
      res.status(500).json({ error: "Failed to parse quote" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  return app;
}

const isMainModule = fileURLToPath(import.meta.url) === process.argv[1] || process.argv[1]?.endsWith('server.ts');

if (isMainModule) {
  createServer().then(app => {
    const PORT = 3000;
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  });
}


