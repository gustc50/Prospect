import "dotenv/config";
import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { initDb } from "./db";
import createCompaniesRouter from "./routes/companies";
import createLeadsRouter from "./routes/leads";
import createConversationsRouter from "./routes/conversations";

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;

async function main() {
  const db = await initDb();

  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, llmConfigured: Boolean(process.env.ANTHROPIC_API_KEY) });
  });

  app.use("/api/companies", createCompaniesRouter(db));
  app.use("/api/leads", createLeadsRouter(db));
  app.use("/api/conversations", createConversationsRouter(db));

  // Serve o painel (build de produção do client) a partir do mesmo servidor/porta da API,
  // para que o sistema inteiro seja acessado em um único endereço.
  const clientDist = path.join(__dirname, "..", "..", "client", "dist");
  const clientIndexHtml = path.join(clientDist, "index.html");

  if (fs.existsSync(clientIndexHtml)) {
    app.use(express.static(clientDist));
    app.get(/^(?!\/api).*/, (_req, res) => {
      res.sendFile(clientIndexHtml);
    });
  } else {
    app.get(/^(?!\/api).*/, (_req, res) => {
      res
        .status(503)
        .send(
          "O painel ainda não foi compilado. Rode 'npm run build' na pasta client, ou use o iniciar.bat na raiz do projeto."
        );
    });
  }

  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    res.status(500).json({ error: "Erro interno do servidor." });
  });

  app.listen(PORT, () => {
    console.log(`Prospect rodando em http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error("Falha ao iniciar o servidor:", err);
  process.exit(1);
});
