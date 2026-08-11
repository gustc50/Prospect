import Anthropic from "@anthropic-ai/sdk";

export interface CompanyProfile {
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
}

export interface AgentObjection {
  objection: string;
  response: string;
}

export interface AgentProfile {
  name: string;
  llm_provider: string;
  model: string;
  questions: string[];
  objections: AgentObjection[];
  extra_instructions: string;
}

export interface ChatMessage {
  role: "lead" | "assistant" | "system";
  content: string;
}

const anthropicClient = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";

function buildSystemPrompt(company: CompanyProfile, leadName: string, agent?: AgentProfile | null): string {
  let prompt = `Você é um agente de pré-vendas (SDR) que conversa em nome da empresa "${company.name}" via chat, sempre em português do Brasil, de forma natural e humana.

## Empresa que você representa
- Nome: ${company.name}
- Segmento: ${company.segment || "não informado"}
- Descrição: ${company.description || "não informado"}
- Produtos/serviços: ${company.products_services || "não informado"}
- Diferenciais competitivos: ${company.differentials || "não informado"}
- Público-alvo: ${company.target_audience || "não informado"}
- Tom de voz desejado: ${company.tone_of_voice || "consultivo e cordial"}
- Site: ${company.website || "não informado"}
- Contato para transferência/agendamento: ${company.contact_info || "não informado"}

## Critérios de qualificação do lead
${company.qualification_criteria || "Avalie se o lead tem interesse real, orçamento compatível e autoridade de decisão."}

## Objetivo da conversa
${company.goal}`;

  if (agent && agent.questions.length > 0) {
    prompt += `\n\n## Perguntas-guia para conduzir a conversa (use na ordem que fizer sentido, não precisa ser literal)\n`;
    prompt += agent.questions.map((q, i) => `${i + 1}. ${q}`).join("\n");
  }

  if (agent && agent.objections.length > 0) {
    prompt += `\n\n## Como lidar com objeções comuns\n`;
    prompt += agent.objections
      .map((o) => `- Objeção: "${o.objection}"\n  Resposta sugerida: ${o.response}`)
      .join("\n");
  }

  if (agent && agent.extra_instructions.trim()) {
    prompt += `\n\n## Instruções adicionais do roteiro (agente: ${agent.name})\n${agent.extra_instructions}`;
  }

  prompt += `\n\n## Regras de conduta
- Você está conversando com o lead "${leadName}". Trate-o pelo nome quando fizer sentido.
- Nunca invente informações sobre a empresa que não foram fornecidas acima; se não souber algo específico, seja honesto e ofereça encaminhar para um especialista humano.
- Faça perguntas para entender a necessidade do lead antes de apresentar soluções.
- Seja breve e direto, como em uma conversa real de chat/WhatsApp (poucas frases por mensagem).
- Não pareça um robô: evite repetir saudações e não se apresente novamente a cada mensagem.
- Quando o lead demonstrar sinais claros de qualificação (interesse + necessidade + condições), conduza para o próximo passo definido no objetivo da conversa.
- Se o lead pedir para falar com um humano, ou demonstrar irritação, respeite e informe o contato humano disponível.`;

  return prompt;
}

function toProviderMessages(history: ChatMessage[]) {
  return history
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: (m.role === "lead" ? "user" : "assistant") as "user" | "assistant",
      content: m.content,
    }));
}

async function generateReplyAnthropic(system: string, history: ChatMessage[], model?: string): Promise<string> {
  if (!anthropicClient) {
    throw new Error(
      "ANTHROPIC_API_KEY não configurada no servidor. Defina a variável de ambiente para habilitar as respostas automáticas da LLM."
    );
  }

  const response = await anthropicClient.messages.create({
    model: model || ANTHROPIC_MODEL,
    max_tokens: 500,
    system,
    messages: toProviderMessages(history),
  });

  const textBlock = response.content.find((block) => block.type === "text");
  return textBlock && textBlock.type === "text" ? textBlock.text : "";
}

async function generateReplyOpenRouter(system: string, history: ChatMessage[], model?: string): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENROUTER_API_KEY não configurada no servidor. Defina a variável de ambiente para usar agentes com OpenRouter."
    );
  }

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model || OPENROUTER_MODEL,
      messages: [{ role: "system", content: system }, ...toProviderMessages(history)],
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Falha ao chamar a OpenRouter (HTTP ${res.status}): ${text.slice(0, 300)}`);
  }

  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content ?? "";
}

export async function generateReply(
  company: CompanyProfile,
  leadName: string,
  history: ChatMessage[],
  agent?: AgentProfile | null
): Promise<string> {
  const system = buildSystemPrompt(company, leadName, agent);
  const provider = agent?.llm_provider || "anthropic";
  const model = agent?.model || undefined;

  if (provider === "openrouter") {
    return generateReplyOpenRouter(system, history, model);
  }
  return generateReplyAnthropic(system, history, model);
}
