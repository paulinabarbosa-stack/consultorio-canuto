import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function DisparoMassa() {
  const [totalContatos, setTotalContatos] = useState<number | null>(null)
  const [mensagem, setMensagem] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState<any>(null)
  const [erro, setErro] = useState('')
  const [modoTeste, setModoTeste] = useState(true)

  useEffect(() => {
    async function contarContatos() {
      const [{ data: pacientesData }, { data: conversasData }] = await Promise.all([
        supabase.from('pacientes').select('telefone').not('telefone', 'is', null),
        supabase.from('conversas_agente').select('telefone'),
      ])
      const normalizar = (t: string) => {
        const n = (t || '').replace(/\D/g, '')
        return n ? (n.startsWith('55') ? n : `55${n}`) : ''
      }
      const unicos = new Set(
        [...(pacientesData || []), ...(conversasData || [])]
          .map((d: any) => normalizar(d.telefone))
          .filter(Boolean)
      )
      setTotalContatos(unicos.size)
    }
    contarContatos()
  }, [])

  async function enviar() {
    setErro('')
    setResultado(null)
    if (!mensagem.trim()) { setErro('Digite a mensagem antes de enviar.'); return }

    const limite = modoTeste ? 20 : undefined
    const alvoTexto = modoTeste
      ? `um teste com até ${limite} contatos`
      : `TODOS os ${totalContatos ?? '...'} contatos`

    const confirmar = confirm(
      `Tem certeza que deseja enviar essa mensagem para ${alvoTexto}? Essa ação não pode ser desfeita.`
    )
    if (!confirmar) return

    setEnviando(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/disparo-massa', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({ mensagem: mensagem.trim(), limite }),
      })
      const data = await res.json()
      if (!res.ok || data?.erro) {
        setErro(data?.erro || 'Não foi possível enviar o disparo.')
      } else {
        setResultado(data)
        setMensagem('')
      }
    } catch (e) {
      setErro('Erro de conexão. Tente novamente.')
    }
    setEnviando(false)
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h2 className="text-white text-lg font-bold">📢 Disparo em Massa</h2>
        <p className="text-gray-500 text-sm mt-1">
          Envia uma mensagem para todos os pacientes cadastrados e para quem já conversou com o agente pelo WhatsApp.
        </p>
      </div>

      <div className="bg-yellow-900/20 border border-yellow-800/40 rounded-lg p-4 mb-5 text-sm">
        <p className="text-yellow-400 font-semibold mb-1">⚠️ Atenção antes de enviar</p>
        <p className="text-gray-300">
          A Meta só permite mensagem livre para contatos que falaram com o agente nas últimas 24 horas.
          Contatos mais antigos podem não receber (a mensagem falha silenciosamente para eles) — o
          relatório no final mostra exatamente quem recebeu e quem não recebeu.
        </p>
        <p className="text-gray-300 mt-2">
          Enviar para muitos números de uma vez pode reduzir a nota de qualidade do WhatsApp ou até
          bloquear temporariamente o número, caso muitos denunciem como spam. Use o modo teste primeiro
          e, para enviar sem esse risco pra todo mundo, o ideal é usar um Template aprovado pela Meta.
        </p>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-5">
        <div className="flex items-center justify-between mb-3">
          <div className="text-gray-400 text-sm">
            {totalContatos === null ? 'Carregando contatos...' : (
              <>📇 <span className="text-white font-semibold">{totalContatos}</span> contatos únicos (pacientes + WhatsApp)</>
            )}
          </div>
          <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
            <input type="checkbox" checked={modoTeste} onChange={e => setModoTeste(e.target.checked)} className="accent-yellow-600" />
            Modo teste (máx. 20 contatos)
          </label>
        </div>

        {!modoTeste && (
          <div className="bg-red-900/20 border border-red-800/40 rounded-lg p-3 mb-3 text-xs text-red-300">
            ⚠️ Modo teste desligado — isso vai enviar para TODOS os {totalContatos ?? '...'} contatos de uma vez.
          </div>
        )}

        <label className="text-gray-400 text-xs block mb-1">Mensagem</label>
        <textarea
          value={mensagem}
          onChange={e => setMensagem(e.target.value)}
          rows={5}
          placeholder="Digite a mensagem que será enviada para todos os contatos..."
          className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-green-600"
        />

        {erro && (
          <div className="bg-red-900/30 border border-red-700 text-red-400 text-sm rounded-lg p-3 mt-3">
            {erro}
          </div>
        )}

        <button
          onClick={enviar}
          disabled={enviando || !mensagem.trim()}
          className="mt-4 w-full bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors">
          {enviando ? 'Enviando... isso pode levar alguns minutos' : modoTeste ? '🧪 Enviar teste (até 20 contatos)' : '📤 Enviar para todos os contatos'}
        </button>
      </div>

      {resultado && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-white font-semibold text-sm mb-3">Resultado do disparo</h3>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-gray-800 rounded-lg p-3 text-center">
              <div className="text-gray-500 text-xs mb-1">Total</div>
              <div className="text-white font-bold">{resultado.total}</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-3 text-center">
              <div className="text-gray-500 text-xs mb-1">Entregues</div>
              <div className="text-green-400 font-bold">{resultado.sucesso}</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-3 text-center">
              <div className="text-gray-500 text-xs mb-1">Falharam</div>
              <div className="text-red-400 font-bold">{resultado.falhas?.length || 0}</div>
            </div>
          </div>

          {resultado.falhas?.length > 0 && (
            <div>
              <p className="text-gray-400 text-xs mb-2">Números que não receberam (provavelmente fora da janela de 24h):</p>
              <div className="bg-gray-800 rounded-lg p-3 max-h-48 overflow-y-auto text-xs text-gray-400 space-y-1">
                {resultado.falhas.map((f: any) => (
                  <div key={f.telefone}>{f.telefone} — {f.erro}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}