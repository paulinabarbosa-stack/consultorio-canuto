// api/webhook.js
// Agente Virtual dos Consultórios Odontológicos Dr. Thiago Canuto
// Integração: Meta WhatsApp Business Cloud API + OpenAI + Supabase (histórico)

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_ID;
const WEBHOOK_VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const SYSTEM_PROMPT = `Você é o Agente Virtual dos Consultórios Odontológicos Dr. Thiago Canuto. Você não tem nome próprio — sempre que se apresentar, use exatamente "Agente Virtual dos Consultórios Odontológicos Dr. Thiago Canuto".

Seu papel é recepcionar os pacientes com simpatia e profissionalismo, entender a necessidade deles, indicar o profissional mais adequado e transferir o atendimento para a secretária da unidade que o paciente escolher, para que ela conclua o agendamento. Você NÃO agenda horários — quem agenda é a secretária de cada unidade.

## EQUIPE DE DENTISTAS
- Dr. Thiago Canuto → todos os procedimentos + Ortodontia (exclusiva dele)
- Rodrigo Brígido → todos os procedimentos + Implante (exclusiva dele)
- Larissa Mourão → todos os procedimentos
- Ana Marina Teixeira → todos os procedimentos
- Vitório Moreira → todos os procedimentos
- Will Costa → todos os procedimentos

Use esta regra para indicar o profissional: se o paciente quiser Ortodontia (aparelho), indique o Dr. Thiago Canuto. Se quiser Implante, indique o Rodrigo Brígido. Para qualquer outro procedimento, qualquer um dos dentistas pode atender — não precisa escolher um nome específico, apenas informe que a equipe tem dentista disponível para o procedimento.

## SERVIÇOS OFERECIDOS
Exodontia simples, Exodontia de 3º molar, Exodontia de 3º molar incluso, Frenectomia, Aumento de coroa, Resina (1, 2 ou 3 faces), Coroa em ceromero, Coroa em porcelana, Ionômero de vidro, Ponte fixa (ceromero ou porcelana), Ponte adesiva, Pino de fibra de vidro, Pino metálico, Dentadura, Rach, PPR provisório, Canal (anterior, pré-molar ou molar), Clareamento (caseiro, em consultório ou endógeno), Limpeza, Raio X, Lente de contato dental, Bichectomia, Implante, Protocolo, Overdenture, Enxerto ósseo, Ortodontia (aparelho).

Use esta lista para reconhecer o que o paciente quer, mesmo que ele descreva com outras palavras (ex: "colocar aparelho" = Ortodontia; "dor no dente" pode ser Canal ou Exodontia; "clarear os dentes" = Clareamento). Nunca invente um serviço que não está nesta lista.

## UNIDADES E TRANSFERÊNCIA DE ATENDIMENTO
Depois de identificar a necessidade do paciente, pergunte em qual unidade ele prefere ser atendido, oferecendo as opções:
- Bom Jesus (secretária Ana)
- Largo Dom João (secretárias Adriana e Luziane)
- Palha (secretária Elaine)
- Rio Grande (secretária Débora)

Quando o paciente escolher a unidade, informe o nome da secretária responsável, diga que vai transferir o atendimento para ela dar continuidade ao agendamento, e pergunte se ele confirma. NÃO revele o número de telefone da secretária na mensagem — o sistema cuida da transferência internamente.

Quando o paciente CONFIRMAR a transferência (ex: "sim", "pode ser", "ok"), chame a função "transferir_para_secretaria" com a unidade escolhida, o nome do paciente e um resumo curto da necessidade dele. Só depois disso escreva a mensagem final de encerramento.

## RECLAMAÇÕES
Se o paciente demonstrar insatisfação, reclamação ou problema com atendimento já realizado, NÃO tente resolver nem colete dados de agendamento. Chame a função "transferir_para_gerencia" com o nome do paciente (se souber) e um resumo da reclamação, e encerre a conversa avisando que a Bia (gerente) vai entrar em contato.

## FLUXO DE ATENDIMENTO
1. BOAS-VINDAS: cumprimente com simpatia, apresente-se como "Agente Virtual dos Consultórios Odontológicos Dr. Thiago Canuto", pergunte o nome do paciente.
2. IDENTIFICAR A NECESSIDADE: pergunte o que o paciente precisa, usando a lista de serviços para entender mesmo descrições informais.
3. INDICAR O PROFISSIONAL: siga a regra da seção EQUIPE DE DENTISTAS.
4. ESCOLHER A UNIDADE: pergunte em qual das 4 unidades o paciente prefere ser atendido.
5. TRANSFERIR: informe a secretária responsável pela unidade escolhida e pergunte se o paciente confirma. Ao confirmar, chame a função "transferir_para_secretaria".
6. ENCERRAMENTO: após chamar a função, agradeça calorosamente e finalize a mensagem com 🦷💚

## REGRAS
- Seja simpática e acolhedora, use emojis com moderação
- Faça UMA pergunta por vez
- Se receber áudio ou imagem, responda: "Olá! No momento só consigo receber mensagens de texto. Pode me escrever? 😊"
- Se perguntarem sobre disponibilidade/horários, responda que a secretária da unidade vai confirmar isso diretamente
- Nunca invente preços, horários, disponibilidade ou serviços que não estão na lista
- NUNCA escreva placeholders como [seu nome], [nome do paciente] ou similares. Se o paciente ainda não disse o nome, pergunte diretamente antes de continuar. Se ele já disse, use o nome real que ele informou
- Depois de chamar a função de transferência, apenas agradeça e encerre a conversa com a despedida. NUNCA reinicie a conversa nem repita perguntas que já foram respondidas antes
- Preste atenção em tudo que já foi dito na conversa antes de perguntar algo — nunca peça de novo uma informação que o paciente já informou`;

// ─── Contatos das unidades e da gerência ────────────────────────────────────

const CONTATOS_UNIDADES = {
  "bom jesus": { secretaria: "Ana", telefone: "5538999720229" },
  "largo dom joao": { secretaria: "Adriana e Luziane", telefone: "5538997234680" },
  "palha": { secretaria: "Elaine", telefone: "5538998089805" },
  "rio grande": { secretaria: "Débora", telefone: "5538998096248" },
};

const CONTATO_GERENCIA = { nome: "Bia", telefone: "5538999996470" }; // CONFIRME ESTE NÚMERO ANTES DE USAR COM PACIENTES REAIS

// ─── Definição das funções (tools) que a IA pode chamar ─────────────────────

const TOOLS = [
  {
    type: "function",
    function: {
      name: "transferir_para_secretaria",
      description: "Transfere o atendimento para a secretária da unidade escolhida, enviando uma mensagem de WhatsApp para ela com os dados do paciente.",
      parameters: {
        type: "object",
        properties: {
          unidade: { type: "string", enum: Object.keys(CONTATOS_UNIDADES) },
          nome_paciente: { type: "string" },
          resumo: { type: "string", description: "Resumo curto da necessidade do paciente e do dentista indicado" },
        },
        required: ["unidade", "nome_paciente", "resumo"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "transferir_para_gerencia",
      description: "Transfere uma reclamação para a Bia, gerente dos consultórios, enviando uma mensagem de WhatsApp para ela com os dados do paciente.",
      parameters: {
        type: "object",
        properties: {
          nome_paciente: { type: "string" },
          resumo: { type: "string", description: "Resumo da reclamação do paciente" },
        },
        required: ["resumo"],
      },
    },
  },
];

// ─── Executar as funções (enviar notificação real pelo WhatsApp) ───────────

async function executarFuncao(nomeFuncao, args, telefonePaciente) {
  if (nomeFuncao === "transferir_para_secretaria") {
    const unidade = CONTATOS_UNIDADES[args.unidade];
    if (!unidade) return "Unidade não encontrada";

    const mensagem = `📋 *Novo atendimento transferido pelo Agente Virtual*\n\n👤 Paciente: ${args.nome_paciente}\n📱 Telefone: ${telefonePaciente}\n🦷 Necessidade: ${args.resumo}\n\nPor favor, entre em contato para dar continuidade ao agendamento.`;
    await enviarMensagemWhatsApp(unidade.telefone, mensagem);
    return `Transferido para ${unidade.secretaria} com sucesso`;
  }

  if (nomeFuncao === "transferir_para_gerencia") {
    const mensagem = `⚠️ *Reclamação transferida pelo Agente Virtual*\n\n👤 Paciente: ${args.nome_paciente || "não informado"}\n📱 Telefone: ${telefonePaciente}\n📝 Resumo: ${args.resumo}\n\nPor favor, entre em contato o quanto antes.`;
    await enviarMensagemWhatsApp(CONTATO_GERENCIA.telefone, mensagem);
    return "Transferido para a Bia com sucesso";
  }

  return "Função desconhecida";
}

// ─── Supabase: buscar e salvar histórico ────────────────────────────────────

async function buscarHistorico(telefone) {
  try {
    const url = `${SUPABASE_URL}/rest/v1/conversas_agente?telefone=eq.${telefone}&select=mensagens`;
    const res = await fetch(url, {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
    });
    const data = await res.json();
    if (data && data.length > 0) return data[0].mensagens || [];
    return [];
  } catch (e) {
    console.error("Erro ao buscar histórico:", e);
    return [];
  }
}

async function salvarHistorico(telefone, mensagens) {
  try {
    const url = `${SUPABASE_URL}/rest/v1/conversas_agente?on_conflict=telefone`;
    await fetch(url, {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify({
        telefone,
        mensagens,
        atualizado_em: new Date().toISOString(),
      }),
    });
  } catch (e) {
    console.error("Erro ao salvar histórico:", e);
  }
}

// ─── OpenAI ──────────────────────────────────────────────────────────────────

async function chamarOpenAI(mensagens) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...mensagens],
      tools: TOOLS,
    }),
  });
  return res.json();
}

async function obterRespostaIA(telefone, mensagemUsuario) {
  try {
    const historico = await buscarHistorico(telefone);
    historico.push({ role: "user", content: mensagemUsuario });

    let data = await chamarOpenAI(historico);
    let mensagemResposta = data?.choices?.[0]?.message;

    // Se a IA decidiu chamar uma função (transferir para secretária ou gerência)
    if (mensagemResposta?.tool_calls?.length > 0) {
      historico.push(mensagemResposta);

      for (const toolCall of mensagemResposta.tool_calls) {
        const args = JSON.parse(toolCall.function.arguments || "{}");
        const resultado = await executarFuncao(toolCall.function.name, args, telefone);
        historico.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: resultado,
        });
      }

      // Segunda chamada, agora com o resultado da função, para gerar a mensagem final ao paciente
      data = await chamarOpenAI(historico);
      mensagemResposta = data?.choices?.[0]?.message;
    }

    const resposta = mensagemResposta?.content || "Desculpe, tive um probleminha. Pode repetir? 😊";

    historico.push({ role: "assistant", content: resposta });
    await salvarHistorico(telefone, historico);

    return resposta;
  } catch (e) {
    console.error("Erro OpenAI:", e);
    return "Desculpe, tive um probleminha. Pode repetir? 😊";
  }
}

// ─── Meta WhatsApp Cloud API: enviar mensagem ───────────────────────────────

async function enviarMensagemWhatsApp(telefone, mensagem) {
  try {
    const url = `https://graph.facebook.com/v20.0/${WHATSAPP_PHONE_ID}/messages`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: telefone,
        type: "text",
        text: { body: mensagem },
      }),
    });
    const data = await res.json();
    console.log("Enviado:", telefone, JSON.stringify(data));
  } catch (e) {
    console.error("Erro ao enviar mensagem:", e);
  }
}

// ─── Extrair mensagem do payload da Meta ────────────────────────────────────

function extrairMensagem(body) {
  try {
    const entry = body?.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const mensagem = value?.messages?.[0];

    if (!mensagem) return { telefone: null, texto: null };

    const telefone = mensagem.from;
    const tipo = mensagem.type;

    if (tipo !== "text") {
      return { telefone, texto: "__MIDIA__" };
    }

    const texto = mensagem.text?.body || "";
    return { telefone, texto };
  } catch (e) {
    console.error("Erro ao extrair mensagem:", e);
    return { telefone: null, texto: null };
  }
}

// ─── Handler principal (Vercel serverless function) ─────────────────────────

export default async function handler(req, res) {
  // Verificação do webhook (Meta chama isso quando você configura a URL)
  if (req.method === "GET") {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === WEBHOOK_VERIFY_TOKEN) {
      console.log("Webhook verificado com sucesso");
      return res.status(200).send(challenge);
    }
    return res.status(403).send("Forbidden");
  }

  // Recebimento de mensagens
  if (req.method === "POST") {
    try {
      const body = req.body;
      console.log("Webhook recebido:", JSON.stringify(body).slice(0, 500));

      const { telefone, texto } = extrairMensagem(body);

      if (!telefone) {
        return res.status(200).json({ status: "ignorado" });
      }

      if (texto === "__MIDIA__") {
        await enviarMensagemWhatsApp(
          telefone,
          "Olá! No momento só consigo receber mensagens de texto. Pode me escrever? 😊"
        );
        return res.status(200).json({ status: "ok" });
      }

      if (!texto) {
        return res.status(200).json({ status: "ignorado" });
      }

      const resposta = await obterRespostaIA(telefone, texto);
      await enviarMensagemWhatsApp(telefone, resposta);

      return res.status(200).json({ status: "ok" });
    } catch (e) {
      console.error("Erro no webhook:", e);
      return res.status(500).json({ error: String(e) });
    }
  }

  return res.status(405).send("Method Not Allowed");
}