import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, Lead, Message } from "../lib/api";

export default function ConversationPage() {
  const { conversationId } = useParams();
  const id = Number(conversationId);

  const [messages, setMessages] = useState<Message[]>([]);
  const [lead, setLead] = useState<Lead | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    setError(null);
    try {
      const { conversation, messages } = await api.getMessages(id);
      setMessages(messages);
      const leadData = await api.getLead(conversation.lead_id);
      setLead(leadData);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    setSending(true);
    setError(null);
    const content = input;
    setInput("");
    try {
      const result = await api.sendMessage(id, content);
      setMessages(result.messages);
      if (result.error) setError(result.error);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <Link to="/" className="muted">
            ← voltar para leads
          </Link>
          <h2 style={{ marginTop: 4 }}>{lead ? lead.name : "Conversa"}</h2>
        </div>
      </div>

      <p className="muted">
        Simule mensagens recebidas do lead. A resposta é gerada automaticamente pela LLM, seguindo o perfil da
        empresa ativa configurada em "Configurações da empresa".
      </p>

      {error && <div className="error-banner">{error}</div>}

      <div className="chat-window">
        <div className="chat-messages" ref={scrollRef}>
          {messages.length === 0 && <div className="empty-state">Envie a primeira mensagem do lead para iniciar.</div>}
          {messages.map((m) => (
            <div key={m.id} className={`bubble ${m.role}`}>
              {m.content}
            </div>
          ))}
          {sending && <div className="bubble assistant muted">digitando...</div>}
        </div>
        <form className="chat-input" onSubmit={handleSend}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Mensagem do lead..."
            disabled={sending}
          />
          <button type="submit" disabled={sending || !input.trim()}>
            Enviar
          </button>
        </form>
      </div>
    </div>
  );
}
