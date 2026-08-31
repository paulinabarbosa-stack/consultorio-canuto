// api/disparo-massa.js
// Envia uma mensagem para todos os números que já conversaram com o agente.
// Só administrador/gerente podem usar (checado aqui no servidor, não só na tela).

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_ID;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function validarUsuarioAdmin(authHeader) {
  if (!authHeader) return null;
  const token = authHeader.replace("Bearer ", "");
  try {
    const resUser = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!resUser.ok) return null;
    const usuarioAuth = await resUser.json();

    const resPerfil = await fetch(
      `${SUPABASE_URL}/rest/v1/usuarios?auth_id=eq.${usuarioAuth.id}&select=perfil`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
      }
    );
    const perfilData = await resPerfil.json();
    const perfil = perfilData?.[0]?.perfil;
    if (perfil !== "administrador" && perfil !== "gerente") return null;

    return usuarioAuth;
  } catch (e) {
    console.error("Erro ao validar usuário admin:", e);
    return null;
  }
}

async function buscarTodosTelefones() {
  const urlPacientes = `${SUPABASE_URL}/rest/v1/pacientes?select=telefone&telefone=not.is.null`;
  const urlConversas = `${SUPABASE_URL}/rest/v1/conversas_agente?select=telefone`;

  const headers = {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  };

  const [resPacientes, resConversas] = await Promise.all([
    fetch(urlPacientes, { headers }),
    fetch(urlConversas, { headers }),
  ]);
  const dadosPacientes = await resPacientes.json();
  const dadosConversas = await resConversas.json();

  const telefones = [
    ...(dadosPacientes || []).map((d) => d.telefone),
    ...(dadosConversas || []).map((d) => d.telefone),
  ]
    .map(normalizarTelefone)
    .filter(Boolean);

  return [...new Set(telefones)];
}

// Garante o formato que a Meta espera: só dígitos, com código do país (55) na frente.
function normalizarTelefone(valor) {
  if (!valor) return null;
  const numeros = String(valor).replace(/\D/g, "");
  if (!numeros) return null;
  return numeros.startsWith("55") ? numeros : `55${numeros}`;
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

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ erro: "Método não permitido" });
  }

  const usuario = await validarUsuarioAdmin(req.headers["authorization"]);
  if (!usuario) {
    return res.status(401).json({ erro: "Não autorizado. Apenas administrador/gerente podem enviar disparos em massa." });
  }

  const { mensagem, limite } = req.body || {};
  if (!mensagem || !mensagem.trim()) {
    return res.status(400).json({ erro: "Mensagem é obrigatória." });
  }

  try {
    let telefones = await buscarTodosTelefones();
    if (limite && Number(limite) > 0) {
      telefones = telefones.slice(0, Number(limite));
    }
    const resultados = [];

    for (const telefone of telefones) {
      const resposta = await enviarMensagemWhatsApp(telefone, mensagem);
      if (resposta.error) {
        resultados.push({ telefone, sucesso: false, erro: resposta.error.message || "erro desconhecido" });
      } else {
        resultados.push({ telefone, sucesso: true });
      }
      // Pequena pausa entre envios para não sobrecarregar a API da Meta
      await esperar(250);
    }

    const falhas = resultados.filter((r) => !r.sucesso);

    return res.status(200).json({
      status: "concluído",
      total: resultados.length,
      sucesso: resultados.length - falhas.length,
      falhas,
    });
  } catch (e) {
    console.error("Erro no disparo em massa:", e);
    return res.status(500).json({ erro: String(e) });
  }
}