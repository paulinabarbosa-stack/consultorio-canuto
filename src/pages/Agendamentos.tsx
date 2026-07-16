import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const STATUS_CORES: Record<string, string> = {
  agendado: 'bg-blue-900/30 text-blue-400',
  confirmado: 'bg-verde-900/30 text-verde-400',
  cancelado: 'bg-red-900/30 text-red-400',
  concluido: 'bg-gray-800 text-gray-400',
}

const STATUS_LABELS: Record<string, string> = {
  agendado: 'Agendado',
  confirmado: 'Confirmado',
  cancelado: 'Cancelado',
  concluido: 'Concluído',
}

export default function Agendamentos() {
  const [agendamentos, setAgendamentos] = useState<any[]>([])
  const [clinicas, setClinicas] = useState<any[]>([])
  const [dentistas, setDentistas] = useState<any[]>([])
  const [pacientes, setPacientes] = useState<any[]>([])
  const [procedimentos, setProcedimentos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroData, setFiltroData] = useState(new Date().toISOString().split('T')[0])
  const [filtroClinica, setFiltroClinica] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [modalAberto, setModalAberto] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [clinicaIdUsuario, setClinicaIdUsuario] = useState<string | null>(null)
  const [perfilAdmin, setPerfilAdmin] = useState(true)
  const [form, setForm] = useState({
    paciente_id: '', dentista_id: '', clinica_id: '',
    procedimento_id: '', procedimento_outro: '', data_hora: '', duracao_minutos: 30,
    status: 'agendado', observacoes: ''
  })
  const [tipoProcedimentoSelecionado, setTipoProcedimentoSelecionado] = useState('')

  useEffect(() => {
    async function carregarUsuario() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('usuarios').select('perfil, clinica_id').eq('auth_id', user.id).maybeSingle()
      if (data) {
        setPerfilAdmin(data.perfil !== 'secretaria')
        if (data.clinica_id) {
          setClinicaIdUsuario(data.clinica_id)
          setFiltroClinica(data.clinica_id)
          setForm(f => ({ ...f, clinica_id: data.clinica_id }))
        }
      }
    }
    carregarUsuario()
  }, [])

  useEffect(() => { if (clinicaIdUsuario !== undefined) carregar() }, [filtroData, filtroClinica, filtroStatus, clinicaIdUsuario])

  async function carregar() {
    setLoading(true)
    let query = supabase
      .from('agendamentos')
      .select('*, pacientes(nome, telefone), dentistas(nome), clinicas(nome), procedimentos(nome, duracao_minutos)')
      .order('data_hora')

    if (filtroData) {
      query = query.gte('data_hora', filtroData + 'T00:00:00').lte('data_hora', filtroData + 'T23:59:59')
    }
    if (filtroClinica) query = query.eq('clinica_id', filtroClinica)
    if (filtroStatus) query = query.eq('status', filtroStatus)

    const [{ data: ag }, { data: cl }, { data: de }, { data: pa }, { data: pr }] = await Promise.all([
      query,
      supabase.from('clinicas').select('*'),
      supabase.from('dentistas').select('*'),
      supabase.from('pacientes').select('id, nome').order('nome'),
      supabase.from('procedimentos').select('*').order('nome')
    ])
    if (ag) setAgendamentos(ag)
    if (cl) setClinicas(cl)
    if (de) setDentistas(de)
    if (pa) setPacientes(pa)
    if (pr) setProcedimentos(pr)
    setLoading(false)
  }

  async function atualizarStatus(id: string, status: string) {
    await supabase.from('agendamentos').update({ status }).eq('id', id)
    await carregar()
  }

  async function salvar() {
    if (!form.paciente_id || !form.dentista_id || !form.clinica_id || !form.data_hora)
      return alert('Preencha paciente, dentista, clínica e data/hora!')
    if (tipoProcedimentoSelecionado === '__outro' && !form.procedimento_outro.trim())
      return alert('Descreva o procedimento no campo "Qual procedimento?"')
    setSalvando(true)

    const procedimentoId = tipoProcedimentoSelecionado === '__outro' ? null : (form.procedimento_id || null)
    const observacoes = tipoProcedimentoSelecionado === '__outro'
      ? `Procedimento: ${form.procedimento_outro}${form.observacoes ? ' | ' + form.observacoes : ''}`
      : (form.observacoes || null)

    const { error } = await supabase.from('agendamentos').insert([{
      paciente_id: form.paciente_id,
      dentista_id: form.dentista_id,
      clinica_id: form.clinica_id || null,
      procedimento_id: procedimentoId,
      data_hora: form.data_hora,
      duracao_minutos: form.duracao_minutos,
      status: form.status,
      observacoes,
    }])
    if (error) { alert('Erro: ' + error.message); setSalvando(false); return }
    setModalAberto(false)
    setTipoProcedimentoSelecionado('')
    setForm({ paciente_id: '', dentista_id: '', clinica_id: clinicaIdUsuario || '', procedimento_id: '', procedimento_outro: '', data_hora: '', duracao_minutos: 30, status: 'agendado', observacoes: '' })
    await carregar()
    setSalvando(false)
  }

  function formatarHora(dataHora: string) {
    return new Date(dataHora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }

  function iniciais(nome: string) {
    return nome?.split(' ').slice(0, 2).map((n: string) => n[0]).join('').toUpperCase()
  }

  const totalHoje = agendamentos.length
  const confirmados = agendamentos.filter(a => a.status === 'confirmado').length
  const cancelados = agendamentos.filter(a => a.status === 'cancelado').length

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-white text-lg font-bold">Agendamentos</h2>
          <p className="text-gray-500 text-sm">{totalHoje} agendamentos · {confirmados} confirmados · {cancelados} cancelados</p>
        </div>
        <button onClick={() => setModalAberto(true)}
          className="bg-verde-600 hover:bg-verde-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
          + Novo agendamento
        </button>
      </div>

      <div className="flex gap-3 mb-6 flex-wrap">
        <input type="date" value={filtroData} onChange={e => setFiltroData(e.target.value)}
          className="bg-gray-900 border border-gray-800 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" />
        {perfilAdmin && (
          <select value={filtroClinica} onChange={e => setFiltroClinica(e.target.value)}
            className="bg-gray-900 border border-gray-800 text-white rounded-lg px-3 py-2 text-sm focus:outline-none">
            <option value="">Todas as clínicas</option>
            {clinicas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        )}
        <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}
          className="bg-gray-900 border border-gray-800 text-white rounded-lg px-3 py-2 text-sm focus:outline-none">
          <option value="">Todos os status</option>
          <option value="agendado">Agendado</option>
          <option value="confirmado">Confirmado</option>
          <option value="cancelado">Cancelado</option>
          <option value="concluido">Concluído</option>
        </select>
        <button onClick={() => { setFiltroData(''); setFiltroStatus(''); if (perfilAdmin) setFiltroClinica('') }}
          className="bg-gray-800 border border-gray-700 text-gray-400 hover:text-white rounded-lg px-3 py-2 text-sm transition-colors">
          Limpar filtros
        </button>
      </div>

      {loading ? (
        <div className="text-gray-400">Carregando...</div>
      ) : agendamentos.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
          <div className="text-4xl mb-3">🗓️</div>
          <div className="text-gray-400 font-medium">Nenhum agendamento encontrado</div>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          {agendamentos.map((a, i) => (
            <div key={a.id} className={`flex items-center gap-4 px-4 py-3 ${i < agendamentos.length - 1 ? 'border-b border-gray-800' : ''}`}>
              <div className="w-14 text-center flex-shrink-0">
                <div className="text-white font-bold text-sm">{formatarHora(a.data_hora)}</div>
                <div className="text-gray-600 text-xs">{a.duracao_minutos}min</div>
              </div>
              <div className="w-8 h-8 bg-verde-700 rounded-full flex items-center justify-center text-xs font-bold text-verde-300 flex-shrink-0">
                {iniciais(a.pacientes?.nome || '?')}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-white font-semibold text-sm truncate">{a.pacientes?.nome}</div>
                <div className="text-gray-500 text-xs">
                  {a.procedimentos?.nome && `${a.procedimentos.nome} · `}
                  {a.dentistas?.nome} · {a.clinicas?.nome}
                </div>
                {a.pacientes?.telefone && <div className="text-gray-600 text-xs">📱 {a.pacientes.telefone}</div>}
              </div>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_CORES[a.status]}`}>
                {STATUS_LABELS[a.status]}
              </span>
              <div className="flex gap-1.5 flex-shrink-0">
                {a.status === 'agendado' && (
                  <button onClick={() => atualizarStatus(a.id, 'confirmado')}
                    className="bg-verde-700 hover:bg-verde-600 text-verde-300 text-xs px-2.5 py-1 rounded-lg transition-colors">
                    Confirmar
                  </button>
                )}
                {a.status === 'confirmado' && (
                  <button onClick={() => atualizarStatus(a.id, 'concluido')}
                    className="bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs px-2.5 py-1 rounded-lg transition-colors">
                    Concluir
                  </button>
                )}
                {(a.status === 'agendado' || a.status === 'confirmado') && (
                  <button onClick={() => atualizarStatus(a.id, 'cancelado')}
                    className="bg-red-900/30 hover:bg-red-900/50 text-red-400 text-xs px-2.5 py-1 rounded-lg transition-colors">
                    Cancelar
                  </button>
                )}
                <a href={`https://wa.me/55${a.pacientes?.telefone?.replace(/\D/g,'')}`}
                  target="_blank" rel="noreferrer"
                  className="bg-green-800/40 hover:bg-green-800/60 text-green-400 text-xs px-2.5 py-1 rounded-lg transition-colors">
                  💬
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalAberto && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-800">
              <h3 className="text-white font-bold">Novo Agendamento</h3>
              <button onClick={() => setModalAberto(false)} className="text-gray-500 hover:text-white text-xl">×</button>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-gray-400 text-xs block mb-1">Paciente *</label>
                  <select value={form.paciente_id} onChange={e => setForm({...form, paciente_id: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none">
                    <option value="">Selecione o paciente...</option>
                    {pacientes.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                  </select>
                </div>
                {perfilAdmin ? (
                  <div>
                    <label className="text-gray-400 text-xs block mb-1">Clínica *</label>
                    <select value={form.clinica_id} onChange={e => setForm({...form, clinica_id: e.target.value})}
                      className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none">
                      <option value="">Selecione...</option>
                      {clinicas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="text-gray-400 text-xs block mb-1">Clínica</label>
                    <div className="bg-gray-800 border border-gray-700 text-gray-400 rounded-lg px-3 py-2 text-sm">
                      {clinicas.find(c => c.id === clinicaIdUsuario)?.nome || '—'}
                    </div>
                  </div>
                )}
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Dentista *</label>
                  <select value={form.dentista_id} onChange={e => setForm({...form, dentista_id: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none">
                    <option value="">Selecione...</option>
                    {dentistas.map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-gray-400 text-xs block mb-1">Procedimento</label>
                  <select value={tipoProcedimentoSelecionado}
                    onChange={e => {
                      const valor = e.target.value
                      setTipoProcedimentoSelecionado(valor)
                      if (valor === '__outro') {
                        setForm({...form, procedimento_id: '', procedimento_outro: ''})
                      } else {
                        const proc = procedimentos.find(p => p.id === valor)
                        setForm({...form, procedimento_id: valor, duracao_minutos: proc?.duracao_minutos || 30, procedimento_outro: ''})
                      }
                    }}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none">
                    <option value="">Selecione o procedimento...</option>
                    {procedimentos.map(p => <option key={p.id} value={p.id}>{p.nome} ({p.duracao_minutos}min)</option>)}
                    <option value="__outro">Outro (digitar)</option>
                  </select>
                </div>

                {tipoProcedimentoSelecionado === '__outro' && (
                  <div className="col-span-2">
                    <label className="text-gray-400 text-xs block mb-1">Qual procedimento? *</label>
                    <input
                      type="text"
                      value={form.procedimento_outro}
                      onChange={e => setForm({...form, procedimento_outro: e.target.value})}
                      placeholder="Descreva o procedimento..."
                      className="w-full bg-gray-800 border border-yellow-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-yellow-500"
                    />
                  </div>
                )}

                <div>
                  <label className="text-gray-400 text-xs block mb-1">Data e hora *</label>
                  <input type="datetime-local" value={form.data_hora}
                    onChange={e => setForm({...form, data_hora: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Duração (minutos)</label>
                  <input type="number" value={form.duracao_minutos}
                    onChange={e => setForm({...form, duracao_minutos: parseInt(e.target.value)})}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" />
                </div>
                <div className="col-span-2">
                  <label className="text-gray-400 text-xs block mb-1">Observações</label>
                  <input type="text" value={form.observacoes}
                    onChange={e => setForm({...form, observacoes: e.target.value})}
                    placeholder="Anotações sobre o agendamento..."
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => { setModalAberto(false); setTipoProcedimentoSelecionado('') }}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors">
                  Cancelar
                </button>
                <button onClick={salvar} disabled={salvando}
                  className="flex-1 bg-verde-600 hover:bg-verde-500 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50">
                  {salvando ? 'Salvando...' : 'Salvar agendamento'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}