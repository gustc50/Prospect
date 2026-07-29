export interface Company {
  id: number;
  name: string;
  segment: string;
  description: string;
  products_services: string;
  differentials: string;
  target_audience: string;
  tone_of_voice: string;
  website: string;
  contact_info: string;
  qualification_criteria: string;
  goal: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface Lead {
  id: number;
  company_id: number;
  name: string;
  phone: string;
  email: string;
  source: string;
  status: string;
  notes: string;
  created_at: string;
}

export interface Conversation {
  id: number;
  lead_id: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: number;
  conversation_id: number;
  role: "lead" | "assistant" | "system";
  content: string;
  created_at: string;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error((data && data.error) || `Erro na requisição: ${res.status}`);
  }
  return data as T;
}

export const api = {
  health: () => request<{ ok: boolean; llmConfigured: boolean }>("/health"),

  listCompanies: () => request<Company[]>("/companies"),
  getCompany: (id: number) => request<Company>(`/companies/${id}`),
  createCompany: (payload: Partial<Company>) =>
    request<Company>("/companies", { method: "POST", body: JSON.stringify(payload) }),
  updateCompany: (id: number, payload: Partial<Company>) =>
    request<Company>(`/companies/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  activateCompany: (id: number) => request<Company>(`/companies/${id}/activate`, { method: "POST" }),
  deleteCompany: (id: number) => request<void>(`/companies/${id}`, { method: "DELETE" }),

  listLeads: (companyId?: number) =>
    request<Lead[]>(`/leads${companyId ? `?company_id=${companyId}` : ""}`),
  getLead: (id: number) => request<Lead>(`/leads/${id}`),
  createLead: (payload: Partial<Lead>) =>
    request<Lead>("/leads", { method: "POST", body: JSON.stringify(payload) }),
  updateLead: (id: number, payload: Partial<Lead>) =>
    request<Lead>(`/leads/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteLead: (id: number) => request<void>(`/leads/${id}`, { method: "DELETE" }),

  listConversations: (leadId?: number) =>
    request<Conversation[]>(`/conversations${leadId ? `?lead_id=${leadId}` : ""}`),
  createConversation: (leadId: number) =>
    request<Conversation>("/conversations", { method: "POST", body: JSON.stringify({ lead_id: leadId }) }),
  getMessages: (conversationId: number) =>
    request<{ conversation: Conversation; messages: Message[] }>(`/conversations/${conversationId}/messages`),
  sendMessage: async (conversationId: number, content: string) => {
    const res = await fetch(`/api/conversations/${conversationId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    const data = (await res.json().catch(() => ({}))) as { messages?: Message[]; error?: string };
    return { messages: data.messages ?? [], error: res.ok ? undefined : data.error || "Falha ao enviar mensagem." };
  },
};
