import { Router } from "express";
import db from "../db";
import { generateReply, ChatMessage, CompanyProfile } from "../services/llmService";

const router = Router();

router.get("/", (req, res) => {
  const leadId = req.query.lead_id;
  const conversations = leadId
    ? db.prepare("SELECT * FROM conversations WHERE lead_id = ? ORDER BY created_at DESC").all(leadId)
    : db.prepare("SELECT * FROM conversations ORDER BY created_at DESC").all();
  res.json(conversations);
});

router.post("/", (req, res) => {
  const { lead_id } = req.body || {};
  if (!lead_id) return res.status(400).json({ error: "lead_id é obrigatório." });

  const lead = db.prepare("SELECT * FROM leads WHERE id = ?").get(lead_id);
  if (!lead) return res.status(400).json({ error: "Lead informado não existe." });

  const info = db.prepare("INSERT INTO conversations (lead_id) VALUES (?)").run(lead_id);
  const conversation = db.prepare("SELECT * FROM conversations WHERE id = ?").get(info.lastInsertRowid);
  res.status(201).json(conversation);
});

router.get("/:id/messages", (req, res) => {
  const conversation = db.prepare("SELECT * FROM conversations WHERE id = ?").get(req.params.id);
  if (!conversation) return res.status(404).json({ error: "Conversa não encontrada." });

  const messages = db
    .prepare("SELECT * FROM messages WHERE conversation_id = ? ORDER BY id ASC")
    .all(req.params.id);
  res.json({ conversation, messages });
});

router.post("/:id/messages", async (req, res) => {
  const { content } = req.body || {};
  if (!content || !String(content).trim()) {
    return res.status(400).json({ error: "O conteúdo da mensagem é obrigatório." });
  }

  const conversation = db.prepare("SELECT * FROM conversations WHERE id = ?").get(req.params.id) as
    | { id: number; lead_id: number; status: string }
    | undefined;
  if (!conversation) return res.status(404).json({ error: "Conversa não encontrada." });

  const lead = db.prepare("SELECT * FROM leads WHERE id = ?").get(conversation.lead_id) as
    | { id: number; company_id: number; name: string }
    | undefined;
  if (!lead) return res.status(404).json({ error: "Lead associado não encontrado." });

  const company = db.prepare("SELECT * FROM companies WHERE id = ?").get(lead.company_id) as
    | (CompanyProfile & { id: number })
    | undefined;
  if (!company) {
    return res.status(400).json({ error: "Empresa associada ao lead não encontrada." });
  }

  db.prepare(
    "INSERT INTO messages (conversation_id, role, content) VALUES (?, 'lead', ?)"
  ).run(conversation.id, content);

  const history = db
    .prepare("SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY id ASC")
    .all(conversation.id) as ChatMessage[];

  try {
    const replyText = await generateReply(company, lead.name, history);

    db.prepare(
      "INSERT INTO messages (conversation_id, role, content) VALUES (?, 'assistant', ?)"
    ).run(conversation.id, replyText);

    db.prepare("UPDATE conversations SET updated_at = datetime('now') WHERE id = ?").run(conversation.id);

    const messages = db
      .prepare("SELECT * FROM messages WHERE conversation_id = ? ORDER BY id ASC")
      .all(conversation.id);
    res.status(201).json({ messages });
  } catch (err) {
    const messages = db
      .prepare("SELECT * FROM messages WHERE conversation_id = ? ORDER BY id ASC")
      .all(conversation.id);
    res.status(502).json({
      error: err instanceof Error ? err.message : "Falha ao gerar resposta da LLM.",
      messages,
    });
  }
});

router.put("/:id", (req, res) => {
  const existing = db.prepare("SELECT * FROM conversations WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Conversa não encontrada." });

  const { status } = req.body || {};
  if (status) {
    db.prepare("UPDATE conversations SET status = ?, updated_at = datetime('now') WHERE id = ?").run(
      status,
      req.params.id
    );
  }

  const conversation = db.prepare("SELECT * FROM conversations WHERE id = ?").get(req.params.id);
  res.json(conversation);
});

export default router;
