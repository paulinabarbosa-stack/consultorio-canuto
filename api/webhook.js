// api/webhook.js
// Consultórios Odontológicos Dr. Thiago Canuto
// Integração: Meta WhatsApp Business Cloud API + OpenAI + Supabase (histórico)

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_ID;
const WEBHOOK_VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// ─── Saudação baseada no horário real de Brasília ───────────────────────────

function obterSaudacao() {
  const horaBrasilia = parseInt(
    new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo", hour: "numeric", hour12: false }),
    10
  );
  if (horaBrasilia < 12) return "Bom dia";
  if (horaBrasilia < 18) return "Boa tarde";
  return "Boa noite";
}

function construirSystemPrompt(saudacao) {
  return `Você faz o atendimento inicial dos Consultórios Odontológicos Dr. Thiago Canuto pelo WhatsApp. NÃO se identifique como robô, inteligência artificial ou "agente virtual" em nenhum momento — cumprimente de forma natural, como uma recepção normal faria.

Seu papel é recepcionar os pacientes com simpatia e profissionalismo, entender a necessidade deles, indicar o profissional mais adequado e transferir o atendimento para a secretária da unidade que o paciente escolher, para que ela conclua o agendamento. Você NÃO agenda horários — quem agenda é a secretária de cada unidade.

## SAUDAÇÃO INICIAL (use exatamente esta abertura na primeira mensagem da conversa)
Comece a primeira mensagem exatamente assim: "${saudacao}! Seja bem-vindo(a) aos Consultórios Odontológicos Dr. Thiago Canuto." — depois disso, pergunte o nome do paciente. Use esse cumprimento apenas na primeira mensagem da conversa; não repita nas mensagens seguintes.

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

## UNIDADES — TODAS ATENDEM ADULTOS NORMALMENTE
As 4 unidades (Bom Jesus, Largo Dom João, Palha, Rio Grande) atendem pacientes adultos normalmente, para QUALQUER procedimento da lista de serviços. Isso inclui o Largo Dom João: ele NÃO é exclusivo para crianças — atende adultos normalmente também. A seção ATENDIMENTO INFANTIL abaixo só direciona automaticamente pacientes infantis para essa unidade; ela nunca é motivo para recusar ou redirecionar um pedido de adulto que já escolheu o Largo Dom João. Se um paciente adulto pedir para ser atendido no Largo Dom João, prossiga normalmente com a transferência para essa unidade, exatamente como faria para qualquer outra.

## ATENDIMENTO INFANTIL (ODONTOPEDIATRIA)
Se o paciente disser que o atendimento é para uma criança, ou pedir especificamente odontopediatria, NÃO pergunte a unidade — indique diretamente que o atendimento infantil é feito na unidade Largo Dom João (secretárias Adriana e Luziane) e siga direto para a confirmação da transferência com essa unidade.

## UNIDADES E TRANSFERÊNCIA DE ATENDIMENTO
Para os demais casos (atendimento de adulto), depois de identificar a necessidade do paciente, pergunte em qual unidade ele prefere ser atendido, oferecendo as opções:
- Bom Jesus (secretária Ana)
- Largo Dom João (secretárias Adriana e Luziane)
- Palha (secretária Elaine)
- Rio Grande (secretária Débora)

Se o paciente já disser de cara em qual unidade quer ser atendido (incluindo Largo Dom João), não pergunte de novo — apenas confirme e prossiga.

Quando o paciente escolher a unidade, informe o nome da secretária responsável, diga que vai transferir o atendimento para ela dar continuidade ao agendamento, e pergunte se ele confirma. NÃO revele o número de telefone da secretária na mensagem — o sistema cuida da transferência internamente.

Quando o paciente CONFIRMAR a transferência (ex: "sim", "pode ser", "ok"), chame a função "transferir_para_secretaria" com a unidade escolhida, o nome do paciente e um resumo curto da necessidade dele. Só depois disso escreva a mensagem final de encerramento.

## CANCELAMENTO OU REMARCAÇÃO DE CONSULTA
Se o paciente pedir para desmarcar, cancelar ou remarcar uma consulta já agendada — incluindo quando ele só informa uma nova data/período preferido (ex: "de manhã", "quarta-feira") — isso é SEMPRE tratado como um pedido normal de agendamento, transferido para a SECRETÁRIA da unidade. Pergunte em qual unidade a consulta está marcada e chame a função "transferir_para_secretaria" com a unidade, o nome do paciente e um resumo dizendo que é um pedido de cancelamento/remarcação (ex: "Deseja remarcar a consulta para quarta de manhã").

IMPORTANTE: NUNCA chame "transferir_para_gerencia" para cancelamento ou remarcação, mesmo que o paciente pareça apressado, insatisfeito por precisar remarcar, ou mencione problemas de horário. Isso vai SEMPRE para a secretária da unidade, nunca para a Bia.

## RECLAMAÇÕES
Só chame "transferir_para_gerencia" quando o paciente reclamar especificamente de um atendimento, procedimento, cobrança ou profissional — algo que já aconteceu de errado. NÃO tente resolver nem colete dados de agendamento nesse caso. Chame a função com o nome do paciente (se souber) e um resumo da reclamação, e encerre a conversa avisando que a Bia (gerente) vai entrar em contato.

## FLUXO DE ATENDIMENTO
1. BOAS-VINDAS: siga exatamente a seção SAUDAÇÃO INICIAL acima, e pergunte o nome do paciente.
2. IDENTIFICAR A NECESSIDADE: pergunte o que o paciente precisa. Se for atendimento infantil, siga a seção ATENDIMENTO INFANTIL. Se for cancelamento/remarcação, siga a seção específica (sempre secretária). Se for uma nova necessidade odontológica de adulto, use a lista de serviços para entender mesmo descrições informais.
3. INDICAR O PROFISSIONAL: siga a regra da seção EQUIPE DE DENTISTAS (não se aplica a atendimento infantil, cancelamento ou remarcação).
4. ESCOLHER A UNIDADE: pergunte em qual das 4 unidades o paciente prefere ser atendido (ou onde a consulta está marcada, no caso de cancelamento/remarcação) — a menos que o paciente já tenha dito qual unidade prefere, incluindo Largo Dom João, que atende adultos normalmente. Para atendimento infantil, pule esta etapa — já é Largo Dom João.
5. TRANSFERIR: informe a secretária responsável pela unidade escolhida e pergunte se o paciente confirma. Ao confirmar, chame a função "transferir_para_secretaria".
6. ENCERRAMENTO: após chamar a função, agradeça calorosamente e finalize a mensagem com 🦷💚

## FIM DA CONVERSA
Depois que você já mandou a mensagem de encerramento (com 🦷💚), a conversa terminou. Se o paciente responder só com um agradecimento ou confirmação curta e SEM pedido novo (ex: "obrigado", "obrigada", "ok", "valeu", "de nada", "👍"), NÃO mande mais nenhuma mensagem de despedida nem repita "tenha um ótimo dia". Nesse caso específico, responda com exatamente esta palavra, sem mais nada: FIM_CONVERSA
Se o paciente mandar uma pergunta nova ou pedir outra coisa depois do encerramento, aí sim responda normalmente, atendendo o novo pedido.

## REGRAS
- Seja simpática e acolhedora, use emojis com moderação
- Faça UMA pergunta por vez
- Se receber áudio ou imagem, responda: "Olá! No momento só consigo receber mensagens de texto. Pode me escrever? 😊"
- Se perguntarem sobre disponibilidade/horários, responda que a secretária da unidade vai confirmar isso diretamente
- Nunca invente preços, horários, disponibilidade ou serviços que não estão na lista
- NUNCA escreva placeholders como [seu nome], [nome do paciente] ou similares. Se o paciente ainda não disse o nome, pergunte diretamente antes de continuar. Se ele já disse, use o nome real que ele informou
- Depois de chamar a função de transferência, apenas agradeça e encerre a conversa com a despedida. NUNCA reinicie a conversa nem repita perguntas que já foram respondidas antes
- Preste atenção em tudo que já foi dito na conversa antes de perguntar algo — nunca peça de novo uma informação que o paciente já informou
- NUNCA copie ou repita literalmente o texto técnico que o resultado de uma função retorna (ex: "Transferido para X com sucesso"). Depois de chamar uma função, sempre escreva você mesmo uma mensagem natural e calorosa de encerramento, nunca o texto cru do sistema
- Nunca se identifique como robô, inteligência artificial, assistente virtual ou "agente virtual" em nenhuma mensagem, mesmo que o paciente pergunte diretamente — nesse caso, apenas responda normalmente como uma recepção faria
- NUNCA recuse ou redirecione um pedido de adulto no Largo Dom João dizendo que a unidade só atende crianças — isso está errado, a unidade atende adultos normalmente`;
}

// ─── Contatos das unidades e da gerência ────────────────────────────────────

const CONTATOS_UNIDADES = {
  "bom jesus": { secretaria: "Ana", telefone: "5538999720229" },
  "largo dom joao": { secretaria: "Adriana e Luziane", telefone: "5538997234680" },
  "palha": { secretaria: "Elaine", telefone: "5538998096248" },
  "rio grande": { secretaria: "Débora", telefone: "5538998096248" },
};

const CONTATO_GERENCIA = { nome: "Bia", telefone: "5538999996470" };

// ─── IDs reais das clínicas no Supabase (tabela "clinicas") ─────────────────
// Palha aponta para o mesmo id do Rio Grande, pois as duas são atendidas
// juntas pela Débora (decisão da Paulina, 19/08/2026).

const CLINICA_IDS = {
  "bom jesus": "f4d54baf-4113-4831-99f4-e4e0880a2857",
  "largo dom joao": "72f99ea0-5338-4a71-abe2-f5174574bf7e",
  "palha": "9d762f26-e3a8-4649-935a-5579540f536b",
  "rio grande": "9d762f26-e3a8-4649-935a-5579540f536b",
};

// ─── Definição das funções (tools) que a IA pode chamar ─────────────────────

const TOOLS = [
  {
    type: "function",
    function: {
      name: "transferir_para_secretaria",
      description: "Transfere o atendimento para a secretária da unidade escolhida, enviando uma mensagem de WhatsApp para ela com os dados do paciente. Use para novos agendamentos (adultos em qualquer uma das 4 unidades, incluindo Largo Dom João), atendimento infantil (sempre Largo Dom João) E TAMBÉM para cancelamentos ou remarcações de consulta.",
      parameters: {
        type: "object",
        properties: {
          unidade: { type: "string", enum: Object.keys(CONTATOS_UNIDADES) },
          nome_paciente: { type: "string" },
          resumo: { type: "string", description: "Resumo curto da necessidade do paciente (agendamento, atendimento infantil, cancelamento ou remarcação) e do dentista indicado, se aplicável" },
        },
        required: ["unidade", "nome_paciente", "resumo"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "transferir_para_gerencia",
      description: "Transfere APENAS reclamações sobre atendimento, procedimento ou cobrança já ocorridos para a Bia, gerente dos consultórios. NUNCA use para cancelamento ou remarcação de consulta.",
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
    if (!unidade) return { resultado: "Unidade não encontrada", clinicaId: null };

    const mensagem = `📋 *Novo atendimento transferido*\n\n👤 Paciente: ${args.nome_paciente}\n📱 Telefone: ${telefonePaciente}\n🦷 Necessidade: ${args.resumo}\n\nPor favor, entre em contato para dar continuidade ao agendamento.`;
    await enviarMensagemWhatsApp(unidade.telefone, mensagem);

    const clinicaId = CLINICA_IDS[args.unidade] || null;
    return { resultado: `Transferido para ${unidade.secretaria} com sucesso`, clinicaId };
  }

  if (nomeFuncao === "transferir_para_gerencia") {
    const mensagem = `⚠️ *Reclamação transferida*\n\n👤 Paciente: ${args.nome_paciente || "não informado"}\n📱 Telefone: ${telefonePaciente}\n📝 Resumo: ${args.resumo}\n\nPor favor, entre em contato o quanto antes.`;
    await enviarMensagemWhatsApp(CONTATO_GERENCIA.telefone, mensagem);
    return { resultado: "Transferido para a Bia com sucesso", clinicaId: null };
  }

  return { resultado: "Função desconhecida", clinicaId: null };
}

// ─── Supabase: buscar e salvar histórico ────────────────────────────────────

// Busca mensagens E clinica_id — usamos clinica_id como sinal de que a
// conversa já foi transferida para uma secretária (a partir daí o agente
// automático para de responder, só a secretária continua pelo sistema).
async function buscarConversa(telefone) {
  try {
    const url = `${SUPABASE_URL}/rest/v1/conversas_agente?telefone=eq.${telefone}&select=mensagens,clinica_id`;
    const res = await fetch(url, {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
    });
    const data = await res.json();
    if (data && data.length > 0) {
      return { mensagens: data[0].mensagens || [], clinicaId: data[0].clinica_id || null };
    }
    return { mensagens: [], clinicaId: null };
  } catch (e) {
    console.error("Erro ao buscar conversa:", e);
    return { mensagens: [], clinicaId: null };
  }
}

async function salvarHistorico(telefone, mensagens, clinicaId = null) {
  try {
    const url = `${SUPABASE_URL}/rest/v1/conversas_agente?on_conflict=telefone`;
    const corpo = {
      telefone,
      mensagens,
      atualizado_em: new Date().toISOString(),
    };
    if (clinicaId) corpo.clinica_id = clinicaId;

    await fetch(url, {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify(corpo),
    });
  } catch (e) {
    console.error("Erro ao salvar histórico:", e);
  }
}

// ─── OpenAI ──────────────────────────────────────────────────────────────────

// A OpenAI só aceita os papéis system/user/assistant/tool. Mensagens digitadas
// pela secretária no sistema ficam salvas com role "secretaria" (para a tela
// de Conversas exibir com cor própria) — aqui convertemos para "assistant"
// só na hora de enviar pra IA, sem alterar o que fica salvo no banco.
function paraFormatoOpenAI(historico) {
  return historico.map((m) => (m.role === "secretaria" ? { role: "assistant", content: m.content } : m));
}

async function chamarOpenAI(mensagens, saudacao) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: construirSystemPrompt(saudacao) }, ...paraFormatoOpenAI(mensagens)],
      tools: TOOLS,
    }),
  });
  return res.json();
}

async function obterRespostaIA(telefone, mensagemUsuario, historicoAtual) {
  try {
    const saudacao = obterSaudacao();
    const historico = historicoAtual;
    historico.push({ role: "user", content: mensagemUsuario, hora: new Date().toISOString() });

    let data = await chamarOpenAI(historico, saudacao);
    let mensagemResposta = data?.choices?.[0]?.message;
    console.log("DEBUG resposta IA:", JSON.stringify(mensagemResposta));

    let clinicaIdDaTransferencia = null;

    if (mensagemResposta?.tool_calls?.length > 0) {
      historico.push({ ...mensagemResposta, hora: new Date().toISOString() });

      for (const toolCall of mensagemResposta.tool_calls) {
        const args = JSON.parse(toolCall.function.arguments || "{}");
        const { resultado, clinicaId } = await executarFuncao(toolCall.function.name, args, telefone);
        if (clinicaId) clinicaIdDaTransferencia = clinicaId;
        historico.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: resultado,
          hora: new Date().toISOString(),
        });
      }

      data = await chamarOpenAI(historico, saudacao);
      mensagemResposta = data?.choices?.[0]?.message;
      console.log("DEBUG resposta final apos tool:", JSON.stringify(mensagemResposta));
    }

    const resposta = mensagemResposta?.content || "Desculpe, tive um probleminha. Pode repetir? 😊";

    historico.push({ role: "assistant", content: resposta, hora: new Date().toISOString() });
    await salvarHistorico(telefone, historico, clinicaIdDaTransferencia);

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

  if (req.method === "POST") {
    try {
      const body = req.body;
      console.log("Webhook recebido:", JSON.stringify(body).slice(0, 500));

      const { telefone, texto } = extrairMensagem(body);

      if (!telefone) {
        return res.status(200).json({ status: "ignorado" });
      }

      if (texto === "__MIDIA__") {
        const { mensagens, clinicaId } = await buscarConversa(telefone);
        if (clinicaId) {
          mensagens.push({ role: "user", content: "[mídia recebida]", hora: new Date().toISOString() });
          await salvarHistorico(telefone, mensagens, clinicaId);
          return res.status(200).json({ status: "encaminhado para secretaria" });
        }
        await enviarMensagemWhatsApp(
          telefone,
          "Olá! No momento só consigo receber mensagens de texto. Pode me escrever? 😊"
        );
        return res.status(200).json({ status: "ok" });
      }

      if (!texto) {
        return res.status(200).json({ status: "ignorado" });
      }

      const { mensagens, clinicaId } = await buscarConversa(telefone);

      if (clinicaId) {
        mensagens.push({ role: "user", content: texto, hora: new Date().toISOString() });
        await salvarHistorico(telefone, mensagens, clinicaId);
        return res.status(200).json({ status: "encaminhado para secretaria, sem resposta automatica" });
      }

      const resposta = await obterRespostaIA(telefone, texto, mensagens);

      if (resposta.trim() === "FIM_CONVERSA") {
        return res.status(200).json({ status: "conversa encerrada, sem resposta" });
      }

      await enviarMensagemWhatsApp(telefone, resposta);

      return res.status(200).json({ status: "ok" });
    } catch (e) {
      console.error("Erro no webhook:", e);
      return res.status(500).json({ error: String(e) });
    }
  }

  return res.status(405).send("Method Not Allowed");
}