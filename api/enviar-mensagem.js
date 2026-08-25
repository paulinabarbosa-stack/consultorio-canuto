// api/enviar-mensagem.js
// Permite que a secretária responda ao paciente diretamente pelo sistema,
// usando o mesmo número oficial do WhatsApp (Meta Cloud API), em vez do
// celular pessoal dela.

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_ID;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Confirma que quem está chamando esse endpoint é um usuário realmente
// logado no sistema (valida o token do Supabase Auth enviado pelo painel).
async function validarUsuarioLogado(authHeader) {
  if (!authHeader) return null;
  const token = authHeader.replace("Bearer ", "");
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) return null;
    return res.json();
  } catch (e) {
    console.error("Erro ao validar usuário:", e);
    return null;
  }
}

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

async function salvarHistorico(telefone, mensagens, clinicaId) {
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

async function enviarMensagemWhatsApp(telefone, mensagem) {
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
  return res.json();
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ erro: "Método não permitido" });
  }

  const usuario = await validarUsuarioLogado(req.headers["authorization"]);
  if (!usuario) {
    return res.status(401).json({ erro: "Não autorizado. Faça login novamente." });
  }

  const { telefone, mensagem, clinicaId } = req.body || {};
  if (!telefone || !mensagem) {
    return res.status(400).json({ erro: "Telefone e mensagem são obrigatórios." });
  }

  try {
    const resultadoEnvio = await enviarMensagemWhatsApp(telefone, mensagem);
    if (resultadoEnvio.error) {
      console.error("Erro Meta ao enviar mensagem da secretária:", JSON.stringify(resultadoEnvio.error));
      return res.status(502).json({ erro: "Falha ao enviar pelo WhatsApp: " + resultadoEnvio.error.message });
    }

    const historico = await buscarHistorico(telefone);
    historico.push({ role: "secretaria", content: mensagem });
    await salvarHistorico(telefone, historico, clinicaId);

    return res.status(200).json({ status: "ok" });
  } catch (e) {
    console.error("Erro em enviar-mensagem:", e);
    return res.status(500).json({ erro: String(e) });
  }
}