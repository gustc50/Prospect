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

export interface ChatMessage {
  role: "lead" | "assistant" | "system";
  content: string;
}

const client = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";

function buildSystemPrompt(company: CompanyProfile, leadName: string): string {
  return `Você é um agente de pré-vendas (SDR) que conversa em nome da empresa "${company.name}" via chat, sempre em português do Brasil, de forma natural e humana.

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
${company.goal}

## Regras de conduta
- Você está conversando com o lead "${leadName}". Trate-o pelo nome quando fizer sentido.
- Nunca invente informações sobre a empresa que não foram fornecidas acima; se não souber algo específico, seja honesto e ofereça encaminhar para um especialista humano.
- Faça perguntas para entender a necessidade do lead antes de apresentar soluções.
- Seja breve e direto, como em uma conversa real de chat/WhatsApp (poucas frases por mensagem).
- Não pareça um robô: evite repetir saudações e não se apresente novamente a cada mensagem.
- Quando o lead demonstrar sinais claros de qualificação (interesse + necessidade + condições), conduza para o próximo passo definido no objetivo da conversa.
- Se o lead pedir para falar com um humano, ou demonstrar irritação, respeite e informe o contato humano disponível.`;
}

export async function generateReply(
  company: CompanyProfile,
  leadName: string,
  history: ChatMessage[]
): Promise<string> {
  if (!client) {
    throw new Error(
      "ANTHROPIC_API_KEY não configurada no servidor. Defina a variável de ambiente para habilitar as respostas automáticas da LLM."
    );
  }

  const system = buildSystemPrompt(company, leadName);

  const messages = history
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: (m.role === "lead" ? "user" : "assistant") as "user" | "assistant",
      content: m.content,
    }));

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 500,
    system,
    messages,
  });

  const textBlock = response.content.find((block) => block.type === "text");
  return textBlock && textBlock.type === "text" ? textBlock.text : "";
}
