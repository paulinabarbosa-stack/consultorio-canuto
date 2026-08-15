import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

type Mensagem = {
  role: 'user' | 'assistant'
  content: string
}

type Conversa = {
  id: string
  telefone: string
  mensagens: Mensagem[]
  atualizado_em: string
}

function formatarTelefone(telefone: string) {
  const numeros = telefone.replace(/\D/g, '')
  if (numeros.length >= 12) {
    const ddd = numeros.slice(2, 4)
    const parte1 = numeros.slice(4, -4)
    const parte2 = numeros.slice(-4)
    return `(${ddd}) ${parte1}-${parte2}`
  }
  return telefone
}

function formatarDataHora(dataIso: string) {
  const data = new Date(dataIso)
  return data.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function ConversasWhatsApp() {
  const [conversas, setConversas] = useState<Conversa[]>([])
  const [carregando, setCarregando] = useState(true)
  const [busca, setBusca] = useState('')
  const [selecionada, setSelecionada] = useState<Conversa | null>(null)
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<Date | null>(null)

  const carregarConversas = useCallback(async (mostrarLoading = false) => {
    if (mostrarLoading) setCarregando(true)
    const { data, error } = await supabase
      .from('conversas_agente')
      .select('id, telefone, mensagens, atualizado_em')
      .order('atualizado_em', { ascending: false })

    if (!error && data) {
      setConversas(data as Conversa[])
      setUltimaAtualizacao(new Date())
    }
    setCarregando(false)
  }, [])

  useEffect(() => {
    carregarConversas(true)
    const intervalo = setInterval(() => carregarConversas(false), 15000)
    return () => clearInterval(intervalo)
  }, [carregarConversas])

  const conversasFiltradas = conversas.filter(c =>
    c.telefone.includes(busca.replace(/\D/g, ''))
  )

  return (
    <div className="flex gap-4 h-full">
      <div className="w-96 flex-shrink-0 flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <input
            type="text"
            placeholder="Buscar por telefone..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className="flex-1 bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-green-600"
          />
          <button
            onClick={() => carregarConversas(true)}
            className="ml-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300 text-sm transition-colors"
            title="Atualizar agora"
          >
            🔄
          </button>
        </div>

        {ultimaAtualizacao && (
          <div className="text-gray-600 text-xs mb-2">
            Atualizado às {ultimaAtualizacao.toLocaleTimeString('pt-BR')} (auto a cada 15s)
          </div>
        )}

        <div className="flex-1 overflow-y-auto bg-gray-900 border border-gray-800 rounded-lg divide-y divide-gray-800">
          {carregando && (
            <div className="p-4 text-gray-500 text-sm">Carregando conversas...</div>
          )}

          {!carregando && conversasFiltradas.length === 0 && (
            <div className="p-4 text-gray-500 text-sm">Nenhuma conversa encontrada.</div>
          )}

          {conversasFiltradas.map(conversa => {
            const ultimaMsg = conversa.mensagens?.[conversa.mensagens.length - 1]
            const ativa = selecionada?.id === conversa.id
            return (
              <button
                key={conversa.id}
                onClick={() => setSelecionada(conversa)}
                className={`w-full text-left p-3 transition-colors ${ativa ? 'bg-green-950' : 'hover:bg-gray-800'}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-white text-sm font-medium">
                    {formatarTelefone(conversa.telefone)}
                  </span>
                  <span className="text-gray-500 text-xs">
                    {formatarDataHora(conversa.atualizado_em)}
                  </span>
                </div>
                {ultimaMsg && (
                  <div className="text-gray-400 text-xs mt-1 truncate">
                    {ultimaMsg.role === 'assistant' ? '🤖 ' : ''}{ultimaMsg.content}
                  </div>
                )}
                <div className="text-gray-600 text-xs mt-1">
                  {conversa.mensagens?.length || 0} mensagens
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex-1 bg-gray-900 border border-gray-800 rounded-lg flex flex-col overflow-hidden">
        {!selecionada && (
          <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">
            Selecione uma conversa à esquerda para ver o histórico completo
          </div>
        )}

        {selecionada && (
          <>
            <div className="border-b border-gray-800 px-4 py-3 flex items-center justify-between">
              <div>
                <div className="text-white font-medium">{formatarTelefone(selecionada.telefone)}</div>
                <div className="text-gray-500 text-xs">
                  Última atualização: {formatarDataHora(selecionada.atualizado_em)}
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {selecionada.mensagens?.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                  <div
                    className={`max-w-[75%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                      msg.role === 'user'
                        ? 'bg-gray-800 text-gray-200'
                        : 'bg-green-800 text-white'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}