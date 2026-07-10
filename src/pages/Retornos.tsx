import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Retornos() {
  const [pacientes, setPacientes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroDias, setFiltroDias] = useState(30)
  const [abaAtiva, setAbaAtiva] = useState<'atraso'|'agendados'>('atraso')
  const [clinicaIdUsuario, setClinicaIdUsuario] = useState<string | null>(null)
  const [editandoRetorno, setEditandoRetorno] = useState<string | null>(null)
  const [dataRetornoTemp, setDataRetornoTemp] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    async function carregarUsuario() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('usuarios').select('perfil, clinica_id').eq('auth_id', user.id).maybeSingle()
      if (data?.clinica_id) setClinicaIdUsuario(data.clinica_id)
    }
    carregarUsuario()
  }, [])

  useEffect(() => { carregar() }, [filtroDias, clinicaIdUsuario])

  async function carregar() {
    setLoading(true)
    try {
      let query = supabase
        .from('pacientes')
        .select('id, nome, telefone, data_retorno, clinica_id, clinicas(nome), dentistas(nome)')
        .order('nome')

      if (clinicaIdUsuario) query = query.eq('clinica_id', clinicaIdUsuario)

      const { data: todos } = await query
      if (todos) setPacientes(todos)
    } catch (err) { console.error(err) }
    setLoading(false)
  }

  async function salvarDataRetorno(pacienteId: string, data: string) {
    setSalvando(true)
    await supabase.from('pacientes').update({ data_retorno: data || null }).eq('id', pacienteId)
    setPacientes(prev => prev.map(p => p.id === pacienteId ? { ...p, data_retorno: data || null } : p))
    setEditandoRetorno(null)
    setDataRetornoTemp('')
    setSalvando(false)
  }

  async function limparDataRetorno(pacienteId: string) {
    await supabase.from('pacientes').update({ data_retorno: null }).eq('id', pacienteId)
    setPacientes(prev => prev.map(p => p.id === pacienteId ? { ...p, data_retorno: null } : p))
  }

  function iniciais(nome: string) {
    return nome?.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
  }

  function diasParaRetorno(data: string) {
    const hoje = new Date()
    hoje.setHours(0,0,0,0)
    const retorno = new Date(data + 'T12:00:00')
    return Math.ceil((retorno.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))
  }

  function urgencia(dias: number) {
    if (dias < 0) return { label: 'Atrasado', cor: 'bg-red-900/30 text-red-400' }
    if (dias === 0) return { label: 'Hoje!', cor: 'bg-yellow-900/30 text-yellow-400' }
    if (dias <= 7) return { label: `Em ${dias} dias`, cor: 'bg-orange-900/30 text-orange-400' }
    return { label: `Em ${dias} dias`, cor: 'bg-gray-800 text-gray-400' }
  }

  const hoje = new Date()
  hoje.setHours(0,0,0,0)

  // Pacientes com retorno agendado
  const comRetorno = pacientes
    .filter(p => p.data_retorno)
    .sort((a, b) => new Date(a.data_retorno).getTime() - new Date(b.data_retorno).getTime())

  // Pacientes sem retorno agendado (em atraso por último atendimento)
  const semRetorno = pacientes.filter(p => !p.data_retorno)

  const msg = (nome: string, data?: string) => {
    if (data) {
      const dataFmt = new Date(data + 'T12:00:00').toLocaleDateString('pt-BR')
      return `Olá, ${nome.split(' ')[0]}! 😊 Passando para lembrar que seu retorno está agendado para o dia ${dataFmt}. Confirma sua presença? 🦷`
    }
    return `Olá, ${nome.split(' ')[0]}! 😊 A equipe dos Consultórios Thiago Canuto está com saudades! Já faz um tempinho desde sua última visita. Que tal agendar uma consulta de revisão? 🦷✨`
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-white text-lg font-bold">Retornos</h2>
          <p className="text-gray-500 text-sm">{comRetorno.length} retornos agendados · {semRetorno.length} sem data</p>
        </div>
      </div>

      {/* Abas */}
      <div className="flex gap-2 mb-6">
        <button onClick={() => setAbaAtiva('agendados')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${abaAtiva === 'agendados' ? 'bg-green-900 text-green-300' : 'bg-gray-900 text-gray-400 hover:text-white border border-gray-800'}`}>
          📅 Retornos agendados ({comRetorno.length})
        </button>
        <button onClick={() => setAbaAtiva('atraso')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${abaAtiva === 'atraso' ? 'bg-orange-900 text-orange-300' : 'bg-gray-900 text-gray-400 hover:text-white border border-gray-800'}`}>
          ⚠️ Sem retorno agendado ({semRetorno.length})
        </button>
      </div>

      {loading ? (
        <div className="text-gray-400 text-center p-8">Carregando...</div>
      ) : (
        <>
          {/* ABA RETORNOS AGENDADOS */}
          {abaAtiva === 'agendados' && (
            <div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-4">
                <div className="text-white text-sm font-semibold mb-1">💬 Mensagem de lembrete</div>
                <div className="text-gray-400 text-sm italic">
                  "Olá, [Nome]! 😊 Passando para lembrar que seu retorno está agendado para o dia [data]. Confirma sua presença? 🦷"
                </div>
              </div>

              {comRetorno.length === 0 ? (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
                  <div className="text-4xl mb-3">📅</div>
                  <div className="text-gray-400">Nenhum retorno agendado</div>
                  <div className="text-gray-600 text-sm mt-1">Adicione datas de retorno nos pacientes abaixo</div>
                </div>
              ) : (
                <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                  {comRetorno.map((p, i) => {
                    const dias = diasParaRetorno(p.data_retorno)
                    const urg = urgencia(dias)
                    const dataFmt = new Date(p.data_retorno + 'T12:00:00').toLocaleDateString('pt-BR')
                    return (
                      <div key={p.id} className={`flex items-center gap-4 px-5 py-4 ${i < comRetorno.length - 1 ? 'border-b border-gray-800' : ''}`}>
                        <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center text-sm font-bold text-gray-300 flex-shrink-0">
                          {iniciais(p.nome)}
                        </div>
                        <div className="flex-1">
                          <div className="text-white font-semibold text-sm">{p.nome}</div>
                          <div className="text-gray-500 text-xs mt-0.5">
                            📅 Retorno: {dataFmt} · {p.clinicas?.nome}
                          </div>
                          {p.telefone && <div className="text-gray-600 text-xs">📱 {p.telefone}</div>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-semibold px-3 py-1 rounded-full ${urg.cor}`}>{urg.label}</span>
                          
                          {/* Editar data */}
                          {editandoRetorno === p.id ? (
                            <div className="flex items-center gap-1">
                              <input type="date" value={dataRetornoTemp}
                                onChange={e => setDataRetornoTemp(e.target.value)}
                                className="bg-gray-800 border border-gray-700 text-white rounded px-2 py-1 text-xs focus:outline-none" />
                              <button onClick={() => salvarDataRetorno(p.id, dataRetornoTemp)} disabled={salvando}
                                className="bg-green-700 text-white text-xs px-2 py-1 rounded">✓</button>
                              <button onClick={() => setEditandoRetorno(null)}
                                className="bg-gray-700 text-gray-400 text-xs px-2 py-1 rounded">×</button>
                            </div>
                          ) : (
                            <button onClick={() => { setEditandoRetorno(p.id); setDataRetornoTemp(p.data_retorno || '') }}
                              className="text-gray-500 hover:text-white text-xs px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 transition-colors">
                              ✏️ Editar
                            </button>
                          )}

                          <button onClick={() => limparDataRetorno(p.id)}
                            className="text-red-500 hover:text-red-400 text-xs px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 transition-colors">
                            🗑️
                          </button>

                          {p.telefone && (
                            <a href={`https://wa.me/55${p.telefone.replace(/\D/g,'')}?text=${encodeURIComponent(msg(p.nome, p.data_retorno))}`}
                              target="_blank" rel="noreferrer"
                              className="bg-green-800 hover:bg-green-700 text-white text-xs px-3 py-1.5 rounded-lg transition-colors">
                              💬 WhatsApp
                            </a>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ABA SEM RETORNO */}
          {abaAtiva === 'atraso' && (
            <div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-4">
                <div className="text-white text-sm font-semibold mb-1">💬 Mensagem sugerida</div>
                <div className="text-gray-400 text-sm italic">
                  "Olá, [Nome]! 😊 A equipe dos Consultórios Thiago Canuto está com saudades! Que tal agendar uma consulta de revisão? 🦷✨"
                </div>
              </div>

              {semRetorno.length === 0 ? (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
                  <div className="text-4xl mb-3">✅</div>
                  <div className="text-gray-400">Todos os pacientes têm retorno agendado!</div>
                </div>
              ) : (
                <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                  {semRetorno.map((p, i) => (
                    <div key={p.id} className={`flex items-center gap-4 px-5 py-4 ${i < semRetorno.length - 1 ? 'border-b border-gray-800' : ''}`}>
                      <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center text-sm font-bold text-gray-300 flex-shrink-0">
                        {iniciais(p.nome)}
                      </div>
                      <div className="flex-1">
                        <div className="text-white font-semibold text-sm">{p.nome}</div>
                        <div className="text-gray-500 text-xs mt-0.5">{p.clinicas?.nome}</div>
                        {p.telefone && <div className="text-gray-600 text-xs">📱 {p.telefone}</div>}
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Adicionar data de retorno */}
                        {editandoRetorno === p.id ? (
                          <div className="flex items-center gap-1">
                            <input type="date" value={dataRetornoTemp}
                              onChange={e => setDataRetornoTemp(e.target.value)}
                              className="bg-gray-800 border border-green-600 text-white rounded px-2 py-1 text-xs focus:outline-none"
                              autoFocus />
                            <button onClick={() => salvarDataRetorno(p.id, dataRetornoTemp)} disabled={salvando || !dataRetornoTemp}
                              className="bg-green-700 hover:bg-green-600 text-white text-xs px-2 py-1 rounded disabled:opacity-50">
                              {salvando ? '...' : '✓ Salvar'}
                            </button>
                            <button onClick={() => setEditandoRetorno(null)}
                              className="bg-gray-700 text-gray-400 text-xs px-2 py-1 rounded">×</button>
                          </div>
                        ) : (
                          <button onClick={() => { setEditandoRetorno(p.id); setDataRetornoTemp('') }}
                            className="bg-blue-800 hover:bg-blue-700 text-blue-300 text-xs px-3 py-1.5 rounded-lg transition-colors font-medium">
                            📅 Agendar retorno
                          </button>
                        )}

                        {p.telefone && (
                          <a href={`https://wa.me/55${p.telefone.replace(/\D/g,'')}?text=${encodeURIComponent(msg(p.nome))}`}
                            target="_blank" rel="noreferrer"
                            className="bg-green-800 hover:bg-green-700 text-white text-xs px-3 py-1.5 rounded-lg transition-colors">
                            💬 WhatsApp
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}