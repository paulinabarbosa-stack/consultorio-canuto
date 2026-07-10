import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const CORES = ['#5dbc85', '#3c8ce0', '#c084fc', '#f472b6', '#67e8f9', '#e09a3c']
const TZ = 'America/Sao_Paulo'

function iniciais(nome: string) {
  return nome?.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
}

function diasLabel(dias: string[]) {
  const map: Record<string, string> = { seg: 'Seg', ter: 'Ter', qua: 'Qua', qui: 'Qui', sex: 'Sex', sab: 'Sáb' }
  return dias?.map(d => map[d] || d).join(', ') || '—'
}

function fmt(v: number) {
  return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function extrairHora(dataHora: string): string {
  const d = dataHora.includes('+') || dataHora.includes('Z') ? new Date(dataHora) : new Date(dataHora + 'Z')
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: TZ })
}

export default function Dentistas() {
  const [dentistas, setDentistas] = useState<any[]>([])
  const [vinculos, setVinculos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [dentistaSelecionado, setDentistaSelecionado] = useState<any>(null)
  const [abaAtiva, setAbaAtiva] = useState<'agenda'|'atendimentos'|'producao'>('agenda')
  const [agendamentos, setAgendamentos] = useState<any[]>([])
  const [atendimentos, setAtendimentos] = useState<any[]>([])
  const [loadingFicha, setLoadingFicha] = useState(false)
  const [mesFiltro, setMesFiltro] = useState(new Date().toISOString().slice(0, 7))
  const [clinicaIdUsuario, setClinicaIdUsuario] = useState<string | null>(null)
  const [perfilAdmin, setPerfilAdmin] = useState(true)

  useEffect(() => {
    async function carregarUsuario() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('usuarios').select('perfil, clinica_id').eq('auth_id', user.id).maybeSingle()
      if (data) {
        setPerfilAdmin(data.perfil !== 'secretaria')
        if (data.clinica_id) setClinicaIdUsuario(data.clinica_id)
      }
    }
    carregarUsuario()
  }, [])

  useEffect(() => { carregar() }, [clinicaIdUsuario])

  async function carregar() {
    setLoading(true)
    try {
      let qVinculos = supabase.from('dentista_clinica').select('*, clinicas(nome), dentistas(id, nome, cro, especialidade)')
      if (clinicaIdUsuario) qVinculos = qVinculos.eq('clinica_id', clinicaIdUsuario)

      const { data: v } = await qVinculos

      if (v) {
        setVinculos(v)
        // Dentistas únicos
        const dentistasMap: Record<string, any> = {}
        v.forEach((vv: any) => {
          if (!dentistasMap[vv.dentistas.id]) dentistasMap[vv.dentistas.id] = vv.dentistas
        })
        setDentistas(Object.values(dentistasMap))
      }
    } catch (err) { console.error(err) }
    setLoading(false)
  }

  async function abrirFicha(dentista: any) {
    setDentistaSelecionado(dentista)
    setAbaAtiva('agenda')
    setLoadingFicha(true)

    const hoje = new Date().toISOString().split('T')[0]
    const inicioMes = mesFiltro + '-01'
    const fimMes = mesFiltro + '-31'

    const [{ data: ags }, { data: ats }] = await Promise.all([
      supabase.from('agendamentos')
        .select('*, pacientes(nome), clinicas(nome), procedimentos(nome)')
        .eq('dentista_id', dentista.id)
        .gte('data_hora', hoje + 'T00:00:00')
        .order('data_hora')
        .limit(20),
      supabase.from('atendimentos')
        .select('*, pacientes(nome), clinicas(nome), procedimentos(nome)')
        .eq('dentista_id', dentista.id)
        .gte('data_atendimento', inicioMes)
        .lte('data_atendimento', fimMes)
        .order('data_atendimento', { ascending: false })
    ])

    if (ags) setAgendamentos(ags)
    if (ats) setAtendimentos(ats)
    setLoadingFicha(false)
  }

  async function recarregarAtendimentos(dentista: any) {
    setLoadingFicha(true)
    const inicioMes = mesFiltro + '-01'
    const fimMes = mesFiltro + '-31'
    const { data: ats } = await supabase.from('atendimentos')
      .select('*, pacientes(nome), clinicas(nome), procedimentos(nome)')
      .eq('dentista_id', dentista.id)
      .gte('data_atendimento', inicioMes)
      .lte('data_atendimento', fimMes)
      .order('data_atendimento', { ascending: false })
    if (ats) setAtendimentos(ats)
    setLoadingFicha(false)
  }

  function clinicasDentista(id: string) {
    return vinculos.filter(v => v.dentistas?.id === id || v.dentista_id === id)
  }

  const STATUS_COR: Record<string, string> = {
    agendado: 'bg-blue-900/30 text-blue-400',
    confirmado: 'bg-green-900/30 text-green-400',
    cancelado: 'bg-red-900/30 text-red-400',
    realizado: 'bg-gray-800 text-gray-400',
    faltou: 'bg-orange-900/30 text-orange-400',
  }

  const totalProducao = atendimentos.reduce((acc, a) => acc + (parseFloat(a.valor) || 0), 0)
  const totalComissao = atendimentos.reduce((acc, a) => acc + (parseFloat(a.comissao_valor) || 0), 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-white text-lg font-bold">Dentistas</h2>
          <p className="text-gray-500 text-sm">{dentistas.length} profissionais {!perfilAdmin && clinicaIdUsuario ? 'nesta clínica' : 'cadastrados'}</p>
        </div>
      </div>

      {loading ? (
        <div className="text-gray-400 text-center p-8">Carregando...</div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {dentistas.map((d, i) => {
            const clinicas = clinicasDentista(d.id)
            return (
              <div key={d.id}
                onClick={() => abrirFicha(d)}
                className="bg-gray-900 border border-gray-800 hover:border-verde-600 rounded-xl p-5 cursor-pointer transition-colors">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-base font-bold text-white flex-shrink-0"
                    style={{ background: CORES[i % CORES.length] }}>
                    {iniciais(d.nome)}
                  </div>
                  <div className="flex-1">
                    <div className="text-white font-bold text-sm">{d.nome}</div>
                    {d.cro && <div className="text-gray-500 text-xs">{d.cro}</div>}
                    <div className="text-gray-400 text-xs mt-0.5">{d.especialidade || 'Todos os procedimentos'}</div>
                  </div>
                  <div className="text-verde-500 text-xs font-semibold">Ver ficha →</div>
                </div>

                <div className="space-y-2">
                  <div className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-2">Clínicas e dias</div>
                  {clinicas.length === 0 ? (
                    <div className="text-gray-600 text-xs">Nenhum vínculo cadastrado</div>
                  ) : clinicas.map(v => (
                    <div key={v.id} className="bg-gray-800 rounded-lg px-3 py-2 flex items-center justify-between">
                      <span className="text-white text-xs font-medium">{v.clinicas?.nome}</span>
                      <span className="text-gray-400 text-xs">{diasLabel(v.dias_semana)}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-4 pt-3 border-t border-gray-800 flex items-center justify-between">
                  <div className="text-gray-500 text-xs">Comissão</div>
                  <div className="text-yellow-400 text-xs font-semibold">
                    Pix/Cartão 36% · Dinheiro 40%
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* MODAL FICHA DO DENTISTA */}
      {dentistaSelecionado && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            
            {/* Cabeçalho */}
            <div className="flex items-center justify-between p-5 border-b border-gray-800">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-base font-bold text-white flex-shrink-0"
                  style={{ background: CORES[dentistas.findIndex(d => d.id === dentistaSelecionado.id) % CORES.length] }}>
                  {iniciais(dentistaSelecionado.nome)}
                </div>
                <div>
                  <h3 className="text-white font-bold">{dentistaSelecionado.nome}</h3>
                  <p className="text-gray-500 text-xs">
                    {dentistaSelecionado.especialidade || 'Todos os procedimentos'}
                    {dentistaSelecionado.cro && ` · ${dentistaSelecionado.cro}`}
                  </p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {clinicasDentista(dentistaSelecionado.id).map(v => (
                      <span key={v.id} className="text-[10px] bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">
                        {v.clinicas?.nome} · {diasLabel(v.dias_semana)}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <button onClick={() => setDentistaSelecionado(null)} className="text-gray-500 hover:text-white text-xl">×</button>
            </div>

            {/* Abas */}
            <div className="flex border-b border-gray-800">
              <button onClick={() => setAbaAtiva('agenda')}
                className={`px-5 py-3 text-sm font-semibold transition-colors ${abaAtiva === 'agenda' ? 'text-verde-400 border-b-2 border-verde-500' : 'text-gray-500 hover:text-white'}`}>
                📅 Próximos agendamentos
              </button>
              <button onClick={() => { setAbaAtiva('atendimentos'); recarregarAtendimentos(dentistaSelecionado) }}
                className={`px-5 py-3 text-sm font-semibold transition-colors ${abaAtiva === 'atendimentos' ? 'text-verde-400 border-b-2 border-verde-500' : 'text-gray-500 hover:text-white'}`}>
                🦷 Atendimentos
              </button>
              <button onClick={() => { setAbaAtiva('producao'); recarregarAtendimentos(dentistaSelecionado) }}
                className={`px-5 py-3 text-sm font-semibold transition-colors ${abaAtiva === 'producao' ? 'text-verde-400 border-b-2 border-verde-500' : 'text-gray-500 hover:text-white'}`}>
                📈 Produção
              </button>
            </div>

            <div className="p-5">
              {loadingFicha ? (
                <div className="text-gray-400 text-center py-8">Carregando...</div>
              ) : (

                <>
                  {/* ABA AGENDA */}
                  {abaAtiva === 'agenda' && (
                    <div>
                      <p className="text-gray-500 text-xs mb-4">Próximos agendamentos a partir de hoje</p>
                      {agendamentos.length === 0 ? (
                        <div className="text-center py-8 text-gray-600">Nenhum agendamento futuro</div>
                      ) : (
                        <div className="space-y-2">
                          {agendamentos.map(ag => (
                            <div key={ag.id} className="bg-gray-800 rounded-lg px-4 py-3 flex items-center gap-3">
                              <div className="text-center flex-shrink-0 w-14">
                                <div className="text-white font-bold text-sm">{extrairHora(ag.data_hora)}</div>
                                <div className="text-gray-500 text-xs">
                                  {new Date(ag.data_hora).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: TZ })}
                                </div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-white font-semibold text-sm">{ag.pacientes?.nome}</div>
                                <div className="text-gray-400 text-xs">{ag.procedimentos?.nome || '—'} · {ag.clinicas?.nome}</div>
                              </div>
                              <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COR[ag.status] || 'bg-gray-800 text-gray-400'}`}>
                                {ag.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ABA ATENDIMENTOS */}
                  {abaAtiva === 'atendimentos' && (
                    <div>
                      <div className="flex items-center gap-3 mb-4">
                        <input type="month" value={mesFiltro}
                          onChange={e => { setMesFiltro(e.target.value); recarregarAtendimentos(dentistaSelecionado) }}
                          className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" />
                        <span className="text-gray-500 text-sm">{atendimentos.length} atendimentos</span>
                      </div>
                      {atendimentos.length === 0 ? (
                        <div className="text-center py-8 text-gray-600">Nenhum atendimento neste período</div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-gray-700 text-xs text-gray-500">
                                <th className="text-left py-2 px-3">Data</th>
                                <th className="text-left py-2 px-3">Paciente</th>
                                <th className="text-left py-2 px-3">Procedimento</th>
                                <th className="text-left py-2 px-3">Clínica</th>
                                <th className="text-left py-2 px-3">Pagamento</th>
                                <th className="text-right py-2 px-3">Valor</th>
                                <th className="text-right py-2 px-3">Comissão</th>
                              </tr>
                            </thead>
                            <tbody>
                              {atendimentos.map((at, i) => (
                                <tr key={at.id} className={i % 2 === 0 ? 'bg-gray-800/30' : ''}>
                                  <td className="py-2 px-3 text-gray-400 whitespace-nowrap text-xs">
                                    {new Date(at.data_atendimento).toLocaleDateString('pt-BR')}
                                  </td>
                                  <td className="py-2 px-3 text-white font-medium text-xs">{at.pacientes?.nome}</td>
                                  <td className="py-2 px-3 text-gray-400 text-xs">{at.procedimentos?.nome || '—'}</td>
                                  <td className="py-2 px-3 text-gray-400 text-xs">{at.clinicas?.nome}</td>
                                  <td className="py-2 px-3 text-gray-400 text-xs">{at.forma_pagamento}</td>
                                  <td className="py-2 px-3 text-right text-green-400 font-semibold text-xs">{fmt(at.valor)}</td>
                                  <td className="py-2 px-3 text-right text-yellow-400 text-xs">{fmt(at.comissao_valor)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ABA PRODUÇÃO */}
                  {abaAtiva === 'producao' && (
                    <div>
                      <div className="flex items-center gap-3 mb-4">
                        <input type="month" value={mesFiltro}
                          onChange={e => { setMesFiltro(e.target.value); recarregarAtendimentos(dentistaSelecionado) }}
                          className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" />
                      </div>

                      <div className="grid grid-cols-3 gap-4 mb-6">
                        <div className="bg-gray-800 rounded-xl p-4 text-center">
                          <div className="text-gray-500 text-xs mb-2">Atendimentos</div>
                          <div className="text-white font-bold text-2xl">{atendimentos.length}</div>
                        </div>
                        <div className="bg-gray-800 rounded-xl p-4 text-center">
                          <div className="text-gray-500 text-xs mb-2">Produção total</div>
                          <div className="text-green-400 font-bold text-xl">{fmt(totalProducao)}</div>
                        </div>
                        <div className="bg-gray-800 rounded-xl p-4 text-center">
                          <div className="text-gray-500 text-xs mb-2">Comissão a pagar</div>
                          <div className="text-yellow-400 font-bold text-xl">{fmt(totalComissao)}</div>
                        </div>
                      </div>

                      {/* Por forma de pagamento */}
                      {atendimentos.length > 0 && (
                        <div>
                          <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-3">Por forma de pagamento</p>
                          <div className="space-y-2">
                            {[...new Set(atendimentos.map(a => a.forma_pagamento))].map(fp => {
                              const total = atendimentos.filter(a => a.forma_pagamento === fp).reduce((s, a) => s + (parseFloat(a.valor) || 0), 0)
                              const comissao = atendimentos.filter(a => a.forma_pagamento === fp).reduce((s, a) => s + (parseFloat(a.comissao_valor) || 0), 0)
                              const qtd = atendimentos.filter(a => a.forma_pagamento === fp).length
                              return (
                                <div key={fp} className="bg-gray-800 rounded-lg px-4 py-3 flex items-center justify-between">
                                  <div>
                                    <span className="text-white text-sm font-medium">{fp}</span>
                                    <span className="text-gray-500 text-xs ml-2">{qtd} atendimento{qtd !== 1 ? 's' : ''}</span>
                                  </div>
                                  <div className="text-right">
                                    <div className="text-green-400 text-sm font-semibold">{fmt(total)}</div>
                                    <div className="text-yellow-400 text-xs">comissão: {fmt(comissao)}</div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>

                          <div className="mt-4 bg-gray-800/50 border border-gray-700 rounded-xl p-4 flex items-center justify-between">
                            <div>
                              <p className="text-white font-bold">Líquido da clínica</p>
                              <p className="text-gray-500 text-xs">Produção menos comissão</p>
                            </div>
                            <div className="text-green-400 text-xl font-bold">{fmt(totalProducao - totalComissao)}</div>
                          </div>
                        </div>
                      )}

                      {atendimentos.length === 0 && (
                        <div className="text-center py-8 text-gray-600">Nenhum atendimento neste período</div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}