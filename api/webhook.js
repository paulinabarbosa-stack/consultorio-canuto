// Endpoint de Webhook do WhatsApp Business (API oficial da Meta)
// Caminho final: https://consultorio-canuto.vercel.app/api/webhook
//
// A Meta usa este mesmo endereço para duas coisas:
// 1) Verificação inicial (método GET) — confirma que o link é seu, usando o WEBHOOK_VERIFY_TOKEN
// 2) Recebimento de mensagens e eventos (método POST) — toda mensagem que o paciente manda chega aqui

export default async function handler(req, res) {
  // ── 1) VERIFICAÇÃO DO WEBHOOK (a Meta chama isso quando seu parceiro configura o link) ──
  if (req.method === 'GET') {
    const mode = req.query['hub.mode']
    const token = req.query['hub.verify_token']
    const challenge = req.query['hub.challenge']

    const verifyToken = process.env.WEBHOOK_VERIFY_TOKEN

    if (mode === 'subscribe' && token === verifyToken) {
      console.log('Webhook verificado com sucesso!')
      res.status(200).send(challenge)
    } else {
      console.log('Falha na verificação do webhook — token não bateu.')
      res.status(403).send('Forbidden')
    }
    return
  }

  // ── 2) RECEBIMENTO DE MENSAGENS/EVENTOS (toda mensagem do WhatsApp chega aqui) ──
  if (req.method === 'POST') {
    try {
      const payload = req.body
      console.log('Mensagem recebida da Meta:', JSON.stringify(payload, null, 2))

      // Por enquanto, só estamos registrando o que chega no log do Vercel.
      // O próximo passo (próxima etapa do projeto) é: extrair a mensagem do paciente
      // daqui dentro, e conectar com a lógica do agente de atendimento.

      // A Meta exige resposta 200 rápida, senão ela reenvia a mesma mensagem depois.
      res.status(200).send('EVENT_RECEIVED')
    } catch (err) {
      console.error('Erro ao processar webhook:', err)
      res.status(200).send('EVENT_RECEIVED') // Responde 200 mesmo assim, para evitar reenvio
    }
    return
  }

  res.status(405).send('Method Not Allowed')
}