# 📋 Martins Orçamentos

Sistema inteligente de criação e gestão de orçamentos, com geração assistida por IA (Google Gemini).

🔗 **Demo ao vivo:** [martins-server-rs.vercel.app](https://martins-server-rs.vercel.app)

---

## ✨ Funcionalidades

- ✅ Criação e gestão de orçamentos
- 🤖 Assistência por IA via Google Gemini
- 💾 Persistência de dados com Supabase (PostgreSQL)
- ⚡ Interface rápida com Vite + TypeScript
- ☁️ Deploy automático no Vercel

---

## 🛠️ Stack Tecnológica

| Tecnologia | Uso |
|---|---|
| TypeScript | Linguagem principal |
| Vite | Build e dev server |
| Supabase | Banco de dados (PostgreSQL) |
| Google Gemini API | Geração assistida por IA |
| Vercel | Hospedagem e deploy |

---

## 🚀 Como Rodar Localmente

**Pré-requisitos:** Node.js 18+

```bash
# 1. Clone o repositório
git clone https://github.com/G0TIC0/martins-server-rs.git
cd martins-server-rs

# 2. Instale as dependências
npm install

# 3. Configure as variáveis de ambiente
cp .env.example .env.local
# Preencha GEMINI_API_KEY e as credenciais do Supabase

# 4. Inicie o servidor de desenvolvimento
npm run dev
```

---

## ⚙️ Variáveis de Ambiente

```env
GEMINI_API_KEY=sua_chave_aqui
SUPABASE_URL=sua_url_aqui
SUPABASE_ANON_KEY=sua_chave_aqui
```

---

## 📁 Estrutura do Projeto
├── api/          # Endpoints serverless (Vercel)
├── src/          # Frontend (Vite + TypeScript)
├── supabase/     # Migrations do banco de dados
├── server.ts     # Servidor principal
└── vite.config.ts

---

## 👤 Autor

**Miguel Martins** · [github.com/G0TIC0](https://github.com/G0TIC0)
