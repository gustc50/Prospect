# Prospect — Sistema de Prospecção Automatizada

Sistema de prospecção onde a conversa com o lead é conduzida em linguagem natural por uma **LLM externa** (Claude,
via API da Anthropic). Nas **Configurações**, você cadastra as informações da empresa (segmento, produtos,
diferenciais, público-alvo, tom de voz, critérios de qualificação, objetivo da conversa, etc.), e é esse perfil
que a LLM usa como contexto para saber exatamente qual empresa está representando ao conversar com cada lead.

## Como funciona

- **Empresas**: cada empresa cadastrada tem um perfil completo. Apenas uma fica **ativa** por vez — é o perfil
  ativo que o sistema usa para atender novos leads. Isso permite reutilizar o mesmo sistema para diferentes
  negócios/clientes, bastando ativar o perfil correto.
- **Leads**: cadastrados vinculados à empresa ativa (nome, telefone, e-mail, origem, status).
- **Conversas**: cada lead tem uma conversa. Toda mensagem "do lead" enviada dispara uma chamada à LLM externa
  (Claude), que responde com base no perfil da empresa + histórico da conversa, seguindo instruções de SDR
  (entender a necessidade, qualificar, e conduzir ao objetivo definido, como agendar uma reunião).
- A tela de conversa simula o recebimento de mensagens do lead (útil para testes e demonstração). Para produção,
  o endpoint `POST /api/conversations/:id/messages` pode ser chamado a partir de qualquer canal real
  (WhatsApp Business API, webhook de e-mail, chat do site, etc.) para automatizar de ponta a ponta.

## Estrutura

```
server/   API em Node.js + Express + TypeScript + SQLite (better-sqlite3)
client/   Painel em React + Vite + TypeScript
```

## Início rápido no Windows

Dê duplo clique no arquivo **`iniciar.bat`** na raiz do projeto. Ele verifica se o Node.js está instalado,
instala as dependências na primeira execução, cria o `server/.env` automaticamente (a partir do
`.env.example`), **compila o painel e o serve a partir do próprio servidor** (uma única janela, uma única
porta), espera o sistema realmente responder e só então abre o navegador — tudo em
**`http://localhost:3001`**, sem precisar rodar nenhum comando manualmente.

> Para as respostas automáticas da LLM funcionarem, edite `server\.env` e preencha `ANTHROPIC_API_KEY` com sua
> chave da Anthropic (pode ser feito antes ou depois de rodar o `iniciar.bat`; se editar depois, feche a janela
> "Prospect" e rode o `iniciar.bat` novamente).

Se a porta `3001` já estiver em uso por outro programa, o script avisa e para — nesse caso, feche o outro
programa ou mude o valor de `PORT` em `server\.env` e rode novamente.

## Configuração manual / modo desenvolvedor (com hot reload)

Este modo roda a API e o painel como dois processos separados (API em `3001`, painel em `5173` com proxy para
`/api`), útil quando você está editando o código e quer que as mudanças apareçam na hora.

### 1. Servidor (API)

```bash
cd server
cp .env.example .env
# edite .env e defina ANTHROPIC_API_KEY com sua chave da Anthropic
npm install
npm run dev
```

A API sobe em `http://localhost:3001`. O banco SQLite é criado automaticamente em `server/data/prospect.db`.

### 2. Cliente (painel web)

```bash
cd client
npm install
npm run dev
```

O painel sobe em `http://localhost:5173` (com proxy para a API em `/api`).

### 3. Gerar a build de produção (usada pelo `iniciar.bat`)

```bash
cd client
npm run build
```

Isso gera `client/dist`. Quando esse diretório existe, o servidor (`server`) passa a servir o painel
diretamente em sua própria porta (`http://localhost:3001`) — é esse o modo usado pelo `iniciar.bat`.

## Fluxo de uso

1. Acesse **Configurações da empresa** e cadastre os dados da empresa (a primeira criada já fica ativa
   automaticamente). Esses dados são o que a LLM usa para "saber quem ela é" durante a conversa.
2. Vá em **Leads** e cadastre um lead da empresa ativa.
3. Clique em **Conversar** e envie uma mensagem simulando o lead — a resposta é gerada automaticamente pela LLM
   configurada.
4. Para trabalhar com outra empresa, cadastre um novo perfil em Configurações e clique em **Ativar como empresa
   atual**.

## Variáveis de ambiente (server/.env)

| Variável | Descrição |
|---|---|
| `PORT` | Porta da API (padrão `3001`) |
| `ANTHROPIC_API_KEY` | Chave de API da Anthropic usada para gerar as respostas da LLM |
| `ANTHROPIC_MODEL` | Modelo a ser usado (padrão `claude-sonnet-4-5`) |

Sem `ANTHROPIC_API_KEY` configurada, o sistema continua funcionando normalmente para cadastro de empresas e
leads, mas o envio de mensagens retorna um erro explicando que a chave precisa ser configurada.

## Extensões futuras sugeridas

- Integração com canais reais (WhatsApp Business API, Instagram Direct, e-mail) chamando o mesmo endpoint de
  mensagens.
- Autenticação/multiusuário para agências que gerenciam várias empresas ao mesmo tempo.
- Painel de métricas (taxa de qualificação, tempo de resposta, funil de conversão).
