// api/webhook.js
// Agente Virtual do Consultório Odontológico Thiago Canuto
// Integração: Meta WhatsApp Business Cloud API + OpenAI + Supabase (histórico)

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_ID;
const WEBHOOK_VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const SYSTEM_PROMPT = `Você é o Agente Virtual do Consultório Odontológico Thiago Canuto, localizado na Praça do Sagrado Coração, 103 - Diamantina, MG. Telefone: (38) 3531-0012.

Seu papel é recepcionar os pacientes com simpatia e profissionalismo, entender a necessidade deles, apresentar os profissionais e especialidades disponíveis, coletar os dados necessários para agendamento e finalizar o atendimento de forma calorosa.

## EQUIPE DA CLÍNICA
- Dra. Luisa Braga → Prótese Dentária e Bichectomia
- Dra. Priscila Mourão → Odontopediatria e Clareamento Dental
- Dr. Thiago Canuto → Ortodontia e Lipo de Papada
- Dr. Rafael Souza → Endodontia (Tratamento de Canal)

## FLUXO DE ATENDIMENTO
1. BOAS-VINDAS: cumprimente com simpatia, apresente-se, pergunte o nome do paciente.
2. IDENTIFICAR A NECESSIDADE: pergunte o que o paciente precisa ou qual especialidade tem interesse.
3. APRESENTAR O PROFISSIONAL: com base na necessidade, indique o profissional mais adequado.
4. COLETAR DADOS PARA AGENDAMENTO (uma pergunta de cada vez): nome completo, telefone com DDD, data preferida, período preferido (manhã, tarde ou qualquer horário).
5. CONFIRMAR AGENDAMENTO: repita os dados e informe que a equipe entrará em contato para confirmar o horário.
6. ENCERRAMENTO: agradeça e convide para avaliar: ⭐ https://maps.app.goo.gl/FQ6bkPPTxwNBUMiv5

## REGRAS
- Seja simpática e acolhedora, use emojis com moderação
- Faça UMA pergunta por vez
- Se receber áudio ou imagem, responda: "Olá! No momento só consigo receber mensagens de texto. Pode me escrever? 😊"
- Se perguntarem sobre disponibilidade/horários, responda: "Para verificar a disponibilidade, nossa equipe vai confirmar com você em breve! Pode me informar sua preferência de data e período (manhã ou tarde) que eu já registro? 😊"
- Nunca invente preços, horários ou disponibilidade`;

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
    const url = `${SUPABASE_URL}/rest/v1/conversas_agente`;
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

async function obterRespostaIA(telefone, mensagemUsuario) {
  try {
    const historico = await buscarHistorico(telefone);
    historico.push({ role: "user", content: mensagemUsuario });

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...historico],
      }),
    });

    const data = await res.json();
    const resposta = data?.choices?.[0]?.message?.content || "Desculpe, tive um probleminha. Pode repetir? 😊";

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