import express from "express";

const app = express();
app.use(express.json());

// Rota de saúde para o Vercel
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", environment: "vercel" });
});

// Você pode adicionar mais rotas de API aqui
// Elas estarão disponíveis em /api/*

export default app;
