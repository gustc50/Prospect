import { Router } from "express";
import db from "../db";

const router = Router();

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

export default router;
