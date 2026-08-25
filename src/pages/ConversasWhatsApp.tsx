import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { Send, Plus, X } from 'lucide-react'

type Mensagem = {
  role: 'user' | 'assistant' | 'secretaria'
  content: string
}

type Conversa = {
  id: string
  telefone: string
  mensagens: Mensagem[]
  atualizado_em: string
  clinica_id: string | null
}

type UsuarioAtual = {
  perfil: 'administrador' | 'gerente' | 'secretaria'
  clinica_id: string | null
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

function normalizarTelefone(valor: string) {
  const numeros = valor.replace(/\D/g, '')
  if (numeros.startsWith('55')) return numeros
  return `55${numeros}`
}

// Toca um bipe simples usando Web Audio API (não depende de arquivo de áudio)
function tocarBipe() {
  try {
    const AudioContextClasse = window.AudioContext || (window as any).webkitAudioContext
    const ctx = new AudioContextClasse()
    const oscilador = ctx.createOscillator()
    const ganho = ctx.createGain()
    oscilador.type = 'sine'
    oscilador.frequency.value = 880
    ganho.gain.setValueAtTime(0.15, ctx.currentTime)
    ganho.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35)
    oscilador.connect(ganho)
    ganho.connect(ctx.destination)
    oscilador.start()
    oscilador.stop(ctx.currentTime + 0.35)
  } catch (e) {
    console.error('Erro ao tocar som de notificação:', e)
  }
}

export default function ConversasWhatsApp() {
  const [conversas, setConversas] = useState<Conversa[]>([])
  const [carregando, setCarregando] = useState(true)
  const [busca, setBusca] = useState('')
  const [selecionada, setSelecionada] = useState<Conversa | null>(null)
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<Date | null>(null)
  const [usuario, setUsuario] = useState<UsuarioAtual | null>(null)
  const [carregouUsuario, setCarregouUsuario] = useState(false)
  const [resposta, setResposta] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [modalNovaConversa, setModalNovaConversa] = useState(false)

  const totalMensagensAnterior = useRef<number | null>(null)

  // Carrega o perfil do usuário logado (perfil + clínica vinculada)
  useEffect(() => {
    async function carregarUsuario() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase
          .from('usuarios')
          .select('perfil, clinica_id')
          .eq('auth_id', user.id)
          .single()
        if (data) setUsuario(data as UsuarioAtual)
      }
      setCarregouUsuario(true)
    }
    carregarUsuario()
  }, [])

  const carregarConversas = useCallback(async (mostrarLoading = false) => {
    if (mostrarLoading) setCarregando(true)

    let query = supabase
      .from('conversas_agente')
      .select('id, telefone, mensagens, atualizado_em, clinica_id')
      .order('atualizado_em', { ascending: false })

    // Secretária só vê as conversas da própria clínica; administrador/gerente vê tudo
    if (usuario?.perfil === 'secretaria' && usuario.clinica_id) {
      query = query.eq('clinica_id', usuario.clinica_id)
    }

    const { data, error } = await query

    if (!error && data) {
      const novasConversas = data as Conversa[]
      const totalMensagens = novasConversas.reduce((soma, c) => soma + (c.mensagens?.length || 0), 0)

      if (totalMensagensAnterior.current !== null && totalMensagens > totalMensagensAnterior.current) {
        tocarBipe()
      }
      totalMensagensAnterior.current = totalMensagens

      setConversas(novasConversas)
      setUltimaAtualizacao(new Date())

      setSelecionada(sel => (sel ? novasConversas.find(c => c.id === sel.id) ?? sel : sel))
    }
    setCarregando(false)
  }, [usuario])

  useEffect(() => {
    if (!carregouUsuario) return
    carregarConversas(true)
    const intervalo = setInterval(() => carregarConversas(false), 15000)
    return () => clearInterval(intervalo)
  }, [carregarConversas, carregouUsuario])

  const conversasFiltradas = conversas.filter(c =>
    c.telefone.includes(busca.replace(/\D/g, ''))
  )

  const podeVerTudo = usuario?.perfil === 'administrador' || usuario?.perfil === 'gerente'

  async function enviarResposta() {
    if (!selecionada || !resposta.trim()) return
    setEnviando(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/enviar-mensagem', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({ telefone: selecionada.telefone, mensagem: resposta.trim() }),
      })
      const data = await res.json()
      if (!res.ok || data?.erro) {
        alert('Não foi possível enviar a mensagem. Tente novamente.')
      } else {
        setResposta('')
        carregarConversas(false)
      }
    } catch (e) {
      console.error('Erro ao enviar resposta:', e)
      alert('Não foi possível enviar a mensagem. Verifique sua conexão.')
    }
    setEnviando(false)
  }

  return (
    <div className="flex gap-4 h-full">
      <div className="w-96 flex-shrink-0 flex flex-col">
        <div className="flex items-center justify-between mb-3 gap-2">
          <input
            type="text"
            placeholder="Buscar por telefone..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className="flex-1 bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-green-600"
          />
          <button
            onClick={() => setModalNovaConversa(true)}
            className="px-3 py-2 bg-green-700 hover:bg-green-600 rounded-lg text-white text-sm transition-colors"
            title="Nova conversa"
          >
            <Plus size={16} />
          </button>
          <button
            onClick={() => carregarConversas(true)}
            className="px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300 text-sm transition-colors"
            title="Atualizar agora"
          >
            🔄
          </button>
        </div>

        {ultimaAtualizacao && (
          <div className="text-gray-600 text-xs mb-2">
            Atualizado às {ultimaAtualizacao.toLocaleTimeString('pt-BR')} (auto a cada 15s)
            {podeVerTudo && <span className="ml-1">· todas as clínicas</span>}
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
                    {ultimaMsg.role === 'assistant' ? '🤖 ' : ultimaMsg.role === 'secretaria' ? '👩‍💼 ' : ''}
                    {ultimaMsg.content}
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
                        : msg.role === 'secretaria'
                        ? 'bg-blue-800 text-white'
                        : 'bg-green-800 text-white'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-gray-800 p-3 flex gap-2">
              <textarea
                value={resposta}
                onChange={e => setResposta(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    enviarResposta()
                  }
                }}
                placeholder="Digite sua resposta..."
                rows={1}
                className="flex-1 bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-green-600"
              />
              <button
                onClick={enviarResposta}
                disabled={enviando || !resposta.trim()}
                className="px-4 py-2 bg-green-700 hover:bg-green-600 disabled:opacity-40 rounded-lg text-white transition-colors flex items-center justify-center"
                title="Enviar"
              >
                <Send size={16} />
              </button>
            </div>
          </>
        )}
      </div>

      {modalNovaConversa && usuario && (
        <ModalNovaConversa
          usuario={usuario}
          onClose={() => setModalNovaConversa(false)}
          onCriada={() => {
            setModalNovaConversa(false)
            carregarConversas(true)
          }}
        />
      )}
    </div>
  )
}

// ─── Modal: Nova Conversa manual ─────────────────────────────────────────────

function ModalNovaConversa({ usuario, onClose, onCriada }: {
  usuario: UsuarioAtual
  onClose: () => void
  onCriada: () => void
}) {
  const [telefone, setTelefone] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')

  async function criar() {
    setErro('')
    const numeroLimpo = normalizarTelefone(telefone)
    if (numeroLimpo.length < 12) {
      setErro('Informe um telefone válido, com DDD.')
      return
    }
    if (!mensagem.trim()) {
      setErro('Digite a mensagem inicial.')
      return
    }

    setEnviando(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/enviar-mensagem', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({
          telefone: numeroLimpo,
          mensagem: mensagem.trim(),
          clinicaId: usuario.clinica_id ?? undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok || data?.erro) {
        setErro('Não foi possível enviar. Verifique o número e tente de novo.')
      } else {
        onCriada()
      }
    } catch (e) {
      setErro('Erro de conexão. Tente novamente.')
    }
    setEnviando(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <h3 className="text-white font-semibold text-sm">Nova conversa</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300">
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-4 flex flex-col gap-3">
          {erro && (
            <div className="bg-red-900/30 border border-red-700 text-red-400 text-xs rounded-lg p-2">{erro}</div>
          )}
          <div>
            <label className="text-gray-400 text-xs font-medium block mb-1">Telefone (com DDD)</label>
            <input
              type="text"
              value={telefone}
              onChange={e => setTelefone(e.target.value)}
              placeholder="Ex: 38 99999-9999"
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-600"
            />
          </div>
          <div>
            <label className="text-gray-400 text-xs font-medium block mb-1">Mensagem inicial</label>
            <textarea
              value={mensagem}
              onChange={e => setMensagem(e.target.value)}
              rows={3}
              placeholder="Digite a primeira mensagem..."
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-green-600"
            />
          </div>
        </div>
        <div className="px-5 py-4 border-t border-gray-800 flex justify-end gap-3">
          <button onClick={onClose} className="px-3 py-2 text-gray-400 hover:text-gray-200 text-sm">
            Cancelar
          </button>
          <button
            onClick={criar}
            disabled={enviando}
            className="px-4 py-2 bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg"
          >
            {enviando ? 'Enviando...' : 'Iniciar conversa'}
          </button>
        </div>
      </div>
    </div>
  )
}