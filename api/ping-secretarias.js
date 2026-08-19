// api/ping-secretarias.js
// Robô diário: mantém a janela de 24h da Meta aberta com todas as secretárias
// e a Bia, para que a transferência de atendimento nunca falhe silenciosamente.

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_ID;
const CRON_SECRET = process.env.CRON_SECRET;

const CONTATOS = [
  { nome: "Ana (Bom Jesus)", telefone: "5538999720229" },
  { nome: "Adriana e Luziane (Largo Dom João)", telefone: "5538997234680" },
  { nome: "Elaine/Débora (Palha e Rio Grande)", telefone: "5538998096248" },
  { nome: "Bia (Gerência)", telefone: "5538999996470" },
];

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
    if (data.error) {
      console.error(`Erro ao pingar ${telefone}:`, JSON.stringify(data.error));
      return { telefone, sucesso: false, erro: data.error?.message || "erro desconhecido" };
    }
    console.log(`Ping enviado com sucesso para ${telefone}`);
    return { telefone, sucesso: true };
  } catch (e) {
    console.error(`Erro de rede ao pingar ${telefone}:`, e);
    return { telefone, sucesso: false, erro: String(e) };
  }
}

export default async function handler(req, res) {
  // Segurança: só aceita chamadas do Vercel Cron (que envia esse header automaticamente
  // quando CRON_SECRET está configurado) ou testes manuais com a chave certa.
  const authHeader = req.headers["authorization"];
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: "Não autorizado" });
  }

  const mensagem = "🦷 Bom dia! Mensagem automática só para manter o WhatsApp do consultório ativo e recebendo transferências de pacientes normalmente. Não precisa responder. 💚";

  const resultados = [];
  for (const contato of CONTATOS) {
    const resultado = await enviarMensagemWhatsApp(contato.telefone, mensagem);
    resultados.push({ nome: contato.nome, ...resultado });
  }

  const falhas = resultados.filter((r) => !r.sucesso);

  return res.status(200).json({
    status: "concluído",
    total: resultados.length,
    sucesso: resultados.length - falhas.length,
    falhas,
  });
}