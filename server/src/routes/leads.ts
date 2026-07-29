import { Router } from "express";
import multer from "multer";
import { CompatDb } from "../db";
import { parseLeadsFile } from "../services/leadImport";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

export default function createLeadsRouter(db: CompatDb) {
  const router = Router();

  router.get("/template", (_req, res) => {
    const header = ["Nome", "Telefone", "Email", "Origem", "Observações"];
    const example = [
      "João da Silva",
      "11999999999",
      "joao@example.com",
      "Site",
      "Pediu contato via WhatsApp",
    ];
    const csv = [header, example]
      .map((cols) => cols.map((c) => `"${c.replace(/"/g, '""')}"`).join(";"))
      .join("\r\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="modelo-leads.csv"');
    res.send("﻿" + csv);
  });

  router.post("/import", (req, res, next) => {
    upload.single("file")(req, res, (err) => {
      if (err) return res.status(400).json({ error: "Falha ao enviar o arquivo (verifique o tamanho/formato)." });
      next();
    });
  }, async (req, res) => {
    const { company_id } = req.body || {};
    if (!company_id) return res.status(400).json({ error: "company_id é obrigatório." });

    const company = db.prepare("SELECT id FROM companies WHERE id = ?").get(company_id);
    if (!company) return res.status(400).json({ error: "Empresa informada não existe." });

    const file = req.file;
    if (!file) return res.status(400).json({ error: "Nenhum arquivo enviado." });

    const isSupported = /\.(xlsx|xls|csv)$/i.test(file.originalname);
    if (!isSupported) {
      return res.status(400).json({ error: "Formato não suportado. Envie um arquivo .xlsx, .xls ou .csv." });
    }

    let result;
    try {
      result = await parseLeadsFile(file.buffer, file.originalname);
    } catch (err) {
      return res.status(400).json({
        error: err instanceof Error ? err.message : "Não foi possível ler a planilha enviada.",
      });
    }

    const insert = db.prepare(
      "INSERT INTO leads (company_id, name, phone, email, source, notes) VALUES (@company_id, @name, @phone, @email, @source, @notes)"
    );

    for (const lead of result.rows) {
      insert.run({
        company_id,
        name: lead.name,
        phone: lead.phone,
        email: lead.email,
        source: lead.source,
        notes: lead.notes,
      });
    }

    res.status(201).json({ imported: result.rows.length, skipped: result.skipped });
  });

  router.get("/", (req, res) => {
    const companyId = req.query.company_id;
    const leads = companyId
      ? db.prepare("SELECT * FROM leads WHERE company_id = ? ORDER BY created_at DESC").all(companyId)
      : db.prepare("SELECT * FROM leads ORDER BY created_at DESC").all();
    res.json(leads);
  });

  router.get("/:id", (req, res) => {
    const lead = db.prepare("SELECT * FROM leads WHERE id = ?").get(req.params.id);
    if (!lead) return res.status(404).json({ error: "Lead não encontrado." });
    res.json(lead);
  });

  router.post("/", (req, res) => {
    const { company_id, name, phone, email, source, notes } = req.body || {};

    if (!company_id) return res.status(400).json({ error: "company_id é obrigatório." });
    if (!name || !String(name).trim()) return res.status(400).json({ error: "O nome do lead é obrigatório." });

    const company = db.prepare("SELECT id FROM companies WHERE id = ?").get(company_id);
    if (!company) return res.status(400).json({ error: "Empresa informada não existe." });

    const info = db
      .prepare(
        "INSERT INTO leads (company_id, name, phone, email, source, notes) VALUES (@company_id, @name, @phone, @email, @source, @notes)"
      )
      .run({
        company_id,
        name,
        phone: phone ?? "",
        email: email ?? "",
        source: source ?? "",
        notes: notes ?? "",
      });

    const lead = db.prepare("SELECT * FROM leads WHERE id = ?").get(info.lastInsertRowid);
    res.status(201).json(lead);
  });

  router.put("/:id", (req, res) => {
    const existing = db.prepare("SELECT * FROM leads WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ error: "Lead não encontrado." });

    const fields = ["name", "phone", "email", "source", "status", "notes"];
    const body = req.body || {};
    const setClauses = fields.filter((f) => body[f] !== undefined).map((f) => `${f} = @${f}`).join(", ");

    if (setClauses) {
      const params: Record<string, string | number> = { id: req.params.id };
      for (const f of fields) if (body[f] !== undefined) params[f] = body[f];
      db.prepare(`UPDATE leads SET ${setClauses} WHERE id = @id`).run(params);
    }

    const lead = db.prepare("SELECT * FROM leads WHERE id = ?").get(req.params.id);
    res.json(lead);
  });

  router.delete("/:id", (req, res) => {
    const existing = db.prepare("SELECT * FROM leads WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ error: "Lead não encontrado." });

    db.prepare("DELETE FROM leads WHERE id = ?").run(req.params.id);
    res.status(204).send();
  });

  return router;
}
