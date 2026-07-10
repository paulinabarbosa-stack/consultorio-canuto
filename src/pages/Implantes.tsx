import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Implantes() {
  const [implantes, setImplantes] = useState<any[]>([])
  const [pacientes, setPacientes] = useState<any[]>([])
  const [dentistas, setDentistas] = useState<any[]>([])
  const [clinicas, setClinicas] = useState<any[]>([])
  const [proteticos, setProteticos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modalAberto, setModalAberto] = useState(false)
  const [modalParcela, setModalParcela] = useState(false)
  const [implanteSelecionado, setImplanteSelecionado] = useState<any>(null)
  const [parcelas, setParcelas] = useState<any[]>([])
  const [salvando, setSalvando] = useState(false)
  const [filtroStatus, setFiltroStatus] = useState('')
  const [clinicaIdUsuario, setClinicaIdUsuario] = useState<string | null>(null)
  const [perfilAdmin, setPerfilAdmin] = useState(true)

  const [form, setForm] = useState({
    paciente_id: '', dentista_id: '', clinica_id: '',
    protetico_id: '', descricao: '', valor_total: '',
    data_inicio: new Date().toISOString().split('T')[0],
    observacoes: '', status: 'em_andamento'
  })

  const [formParcela, setFormParcela] = useState({
    data_pagamento: new Date().toISOString().split('T')[0],
    valor: '', forma_pagamento: '', observacoes: ''
  })

  useEffect(() => {
    async function carregarUsuario() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('usuarios').select('perfil, clinica_id').eq('auth_id', user.id).maybeSingle()
      if (data) {
        setPerfilAdmin(data.perfil !== 'secretaria')
        if (data.clinica_id) {
          setClinicaIdUsuario(data.clinica_id)
          setForm(f => ({ ...f, clinica_id: data.clinica_id }))
        }
      }
    }
    carregarUsuario()
  }, [])

  useEffect(() => { carregar() }, [clinicaIdUsuario])

  async function carregar() {
    setLoading(true)
    let query = supabase.from('implantes')
      .select('*, pacientes(nome, telefone), dentistas(nome), clinicas(nome), proteticos(nome)')
      .order('created_at', { ascending: false })
    if (clinicaIdUsuario) query = query.eq('clinica_id', clinicaIdUsuario)

    const [{ data: imp }, { data: pac }, { data: den }, { data: cli }, { data: pro }] = await Promise.all([
      query,
      supabase.from('pacientes').select('id, nome').order('nome'),
      supabase.from('dentistas').select('id, nome'),
      supabase.from('clinicas').select('id, nome'),
      supabase.from('proteticos').select('id, nome'),
    ])
    if (imp) setImplantes(imp)
    if (pac) setPacientes(pac)
    if (den) setDentistas(den)
    if (cli) setClinicas(cli)
    if (pro) setProteticos(pro)
    setLoading(false)
  }

  async function abrirImplante(imp: any) {
    setImplanteSelecionado(imp)
    const { data } = await supabase.from('implante_parcelas')
      .select('*').eq('implante_id', imp.id).order('data_pagamento')
    if (data) setParcelas(data)
  }

  async function salvarImplante() {
    if (!form.paciente_id || !form.dentista_id || !form.clinica_id || !form.valor_total)
      return alert('Preencha paciente, dentista, clínica e valor total!')
    setSalvando(true)
    const valorTotal = parseFloat(form.valor_total)
    const comissaoDentista = valorTotal * 0.40
    const comissaoProtetico = form.protetico_id ? valorTotal * 0.40 : 0

    const { error } = await supabase.from('implantes').insert([{
      paciente_id: form.paciente_id,
      dentista_id: form.dentista_id,
      clinica_id: form.clinica_id,
      protetico_id: form.protetico_id || null,
      descricao: form.descricao || null,
      valor_total: valorTotal,
      data_inicio: form.data_inicio,
      observacoes: form.observacoes || null,
      status: 'em_andamento',
      comissao_dentista: comissaoDentista,
      comissao_protetico: comissaoProtetico,
    }])
    if (error) { alert('Erro: ' + error.message); setSalvando(false); return }
    setModalAberto(false)
    setForm({ paciente_id: '', dentista_id: '', clinica_id: clinicaIdUsuario || '', protetico_id: '', descricao: '', valor_total: '', data_inicio: new Date().toISOString().split('T')[0], observacoes: '', status: 'em_andamento' })
    await carregar()
    setSalvando(false)
  }

  async function salvarParcela() {
    if (!formParcela.valor || !formParcela.data_pagamento || !formParcela.forma_pagamento)
      return alert('Preencha data, valor e forma de pagamento!')
    setSalvando(true)
    const { error } = await supabase.from('implante_parcelas').insert([{
      implante_id: implanteSelecionado.id,
      data_pagamento: formParcela.data_pagamento,
      valor: parseFloat(formParcela.valor),
      forma_pagamento: formParcela.forma_pagamento,
      observacoes: formParcela.observacoes || null,
    }])
    if (error) { alert('Erro: ' + error.message); setSalvando(false); return }

    // Registra no financeiro
    const pct = (formParcela.forma_pagamento === 'Dinheiro' || formParcela.forma_pagamento === 'Cheque') ? 40 : 36
    await supabase.from('atendimentos').insert([{
      paciente_id: implanteSelecionado.paciente_id,
      clinica_id: implanteSelecionado.clinica_id,
      dentista_id: implanteSelecionado.dentista_id,
      data_atendimento: formParcela.data_pagamento,
      valor: parseFloat(formParcela.valor),
      forma_pagamento: formParcela.forma_pagamento,
      comissao_percentual: pct,
      comissao_valor: parseFloat(formParcela.valor) * pct / 100,
      observacoes: `Implante - parcela: ${formParcela.observacoes || implanteSelecionado.descricao || ''}`,
    }])

    setModalParcela(false)
    setFormParcela({ data_pagamento: new Date().toISOString().split('T')[0], valor: '', forma_pagamento: '', observacoes: '' })
    const { data } = await supabase.from('implante_parcelas').select('*').eq('implante_id', implanteSelecionado.id).order('data_pagamento')
    if (data) setParcelas(data)
    // Atualiza o implante selecionado
    const { data: imp } = await supabase.from('implantes').select('*, pacientes(nome, telefone), dentistas(nome), clinicas(nome), proteticos(nome)').eq('id', implanteSelecionado.id).single()
    if (imp) setImplanteSelecionado(imp)
    await carregar()
    setSalvando(false)
  }

  async function atualizarStatus(id: string, status: string) {
    await supabase.from('implantes').update({ status }).eq('id', id)
    await carregar()
    if (implanteSelecionado?.id === id) setImplanteSelecionado({ ...implanteSelecionado, status })
  }

  function fmt(v: number) {
    return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  function iniciais(nome: string) {
    return nome?.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
  }

  const STATUS = [
    { value: 'em_andamento', label: 'Em andamento', cor: 'bg-blue-900/30 text-blue-400 border-blue-800' },
    { value: 'concluido', label: 'Concluído', cor: 'bg-green-900/30 text-green-400 border-green-800' },
    { value: 'cancelado', label: 'Cancelado', cor: 'bg-red-900/30 text-red-400 border-red-800' },
  ]

  function getStatus(s: string) {
    return STATUS.find(st => st.value === s) ?? STATUS[0]
  }

  const implantesFiltrados = filtroStatus ? implantes.filter(i => i.status === filtroStatus) : implantes
  const totalValor = implantes.reduce((acc, i) => acc + (parseFloat(i.valor_total) || 0), 0)
  const totalParcelas = (imp: any) => parcelas.reduce((acc, p) => acc + (parseFloat(p.valor) || 0), 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-white text-lg font-bold">Implantes</h2>
          <p className="text-gray-500 text-sm">{implantes.length} implantes · Total: {fmt(totalValor)}</p>
        </div>
        <button onClick={() => setModalAberto(true)}
          className="bg-blue-700 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
          + Novo implante
        </button>
      </div>

      {/* Filtro status */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <button onClick={() => setFiltroStatus('')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors border ${!filtroStatus ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-900 border-gray-800 text-gray-400'}`}>
          Todos ({implantes.length})
        </button>
        {STATUS.map(s => (
          <button key={s.value} onClick={() => setFiltroStatus(filtroStatus === s.value ? '' : s.value)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors border ${filtroStatus === s.value ? s.cor : 'bg-gray-900 border-gray-800 text-gray-400'}`}>
            {s.label} ({implantes.filter(i => i.status === s.value).length})
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-gray-400 text-center p-8">Carregando...</div>
      ) : implantesFiltrados.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
          <div className="text-4xl mb-3">🦷</div>
          <div className="text-gray-400">Nenhum implante cadastrado</div>
        </div>
      ) : (
        <div className="space-y-3">
          {implantesFiltrados.map(imp => {
            const st = getStatus(imp.status)
            const pago = imp.total_pago || 0
            const restante = (parseFloat(imp.valor_total) || 0) - pago
            return (
              <div key={imp.id}
                onClick={() => abrirImplante(imp)}
                className="bg-gray-900 border border-gray-800 hover:border-blue-600 rounded-xl p-5 cursor-pointer transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-800 rounded-full flex items-center justify-center text-sm font-bold text-blue-300 flex-shrink-0">
                      {iniciais(imp.pacientes?.nome || '?')}
                    </div>
                    <div>
                      <div className="text-white font-bold text-sm">{imp.pacientes?.nome}</div>
                      <div className="text-gray-500 text-xs mt-0.5">
                        👨‍⚕️ {imp.dentistas?.nome} · 🏥 {imp.clinicas?.nome}
                      </div>
                      {imp.proteticos?.nome && (
                        <div className="text-gray-500 text-xs">🔧 Protético: {imp.proteticos.nome}</div>
                      )}
                      {imp.descricao && <div className="text-gray-400 text-xs mt-0.5">{imp.descricao}</div>}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded border font-medium ${st.cor}`}>{st.label}</span>
                    <div className="text-white font-bold mt-1">{fmt(parseFloat(imp.valor_total))}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      Início: {new Date(imp.data_inicio).toLocaleDateString('pt-BR')}
                    </div>
                  </div>
                </div>

                {/* Barra de progresso */}
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Comissão dentista (40%): {fmt(parseFloat(imp.valor_total) * 0.40)}</span>
                    {imp.proteticos?.nome && <span>Protético (40%): {fmt(parseFloat(imp.valor_total) * 0.40)}</span>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* MODAL DETALHE DO IMPLANTE */}
      {implanteSelecionado && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-800">
              <div>
                <h3 className="text-white font-bold">🦷 Implante — {implanteSelecionado.pacientes?.nome}</h3>
                <p className="text-gray-500 text-xs mt-0.5">
                  {implanteSelecionado.dentistas?.nome} · {implanteSelecionado.clinicas?.nome}
                  {implanteSelecionado.proteticos?.nome && ` · Protético: ${implanteSelecionado.proteticos.nome}`}
                </p>
              </div>
              <button onClick={() => { setImplanteSelecionado(null); setParcelas([]) }} className="text-gray-500 hover:text-white text-xl">×</button>
            </div>

            <div className="p-5">
              {/* Resumo financeiro */}
              <div className="grid grid-cols-3 gap-3 mb-5">
                <div className="bg-gray-800 rounded-lg p-3 text-center">
                  <div className="text-gray-500 text-xs mb-1">Valor total</div>
                  <div className="text-white font-bold">{fmt(parseFloat(implanteSelecionado.valor_total))}</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-3 text-center">
                  <div className="text-gray-500 text-xs mb-1">Total pago</div>
                  <div className="text-green-400 font-bold">{fmt(parcelas.reduce((acc, p) => acc + parseFloat(p.valor), 0))}</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-3 text-center">
                  <div className="text-gray-500 text-xs mb-1">Saldo restante</div>
                  <div className="text-red-400 font-bold">
                    {fmt(parseFloat(implanteSelecionado.valor_total) - parcelas.reduce((acc, p) => acc + parseFloat(p.valor), 0))}
                  </div>
                </div>
              </div>

              {/* Comissões */}
              <div className="bg-yellow-900/20 border border-yellow-800/40 rounded-lg p-3 mb-5">
                <p className="text-yellow-400 text-xs font-semibold mb-2">💰 Comissões (40% sobre valor total)</p>
                <div className="flex gap-4">
                  <div>
                    <span className="text-gray-400 text-xs">Dentista ({implanteSelecionado.dentistas?.nome}): </span>
                    <span className="text-yellow-400 font-bold text-sm">{fmt(parseFloat(implanteSelecionado.valor_total) * 0.40)}</span>
                  </div>
                  {implanteSelecionado.proteticos?.nome && (
                    <div>
                      <span className="text-gray-400 text-xs">Protético ({implanteSelecionado.proteticos.nome}): </span>
                      <span className="text-yellow-400 font-bold text-sm">{fmt(parseFloat(implanteSelecionado.valor_total) * 0.40)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Status */}
              <div className="flex items-center gap-3 mb-5">
                <span className="text-gray-400 text-xs">Status:</span>
                <div className="flex gap-2">
                  {STATUS.map(s => (
                    <button key={s.value}
                      onClick={() => atualizarStatus(implanteSelecionado.id, s.value)}
                      className={`text-xs px-3 py-1 rounded border font-medium transition-colors ${implanteSelecionado.status === s.value ? s.cor : 'bg-gray-800 border-gray-700 text-gray-500'}`}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Parcelas */}
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-white font-semibold text-sm">Parcelas pagas ({parcelas.length})</h4>
                <button onClick={() => setModalParcela(true)}
                  className="bg-green-700 hover:bg-green-600 text-white text-xs px-3 py-1.5 rounded-lg font-semibold">
                  + Registrar parcela
                </button>
              </div>

              {parcelas.length === 0 ? (
                <div className="text-center py-6 text-gray-600 text-sm">Nenhuma parcela registrada</div>
              ) : (
                <div className="bg-gray-800 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-700 text-xs text-gray-500">
                        <th className="text-left py-2 px-4">#</th>
                        <th className="text-left py-2 px-4">Data</th>
                        <th className="text-left py-2 px-4">Pagamento</th>
                        <th className="text-right py-2 px-4">Valor</th>
                        <th className="text-left py-2 px-4">Obs</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parcelas.map((p, i) => (
                        <tr key={p.id} className={i % 2 === 0 ? '' : 'bg-gray-700/30'}>
                          <td className="py-2 px-4 text-gray-500 text-xs">{i + 1}</td>
                          <td className="py-2 px-4 text-gray-300 whitespace-nowrap">
                            {new Date(p.data_pagamento + 'T12:00:00').toLocaleDateString('pt-BR')}
                          </td>
                          <td className="py-2 px-4 text-gray-400">{p.forma_pagamento}</td>
                          <td className="py-2 px-4 text-right text-green-400 font-bold">{fmt(parseFloat(p.valor))}</td>
                          <td className="py-2 px-4 text-gray-500 text-xs">{p.observacoes || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-gray-700 bg-gray-700/50">
                        <td colSpan={3} className="py-2 px-4 text-white font-bold text-xs">TOTAL PAGO</td>
                        <td className="py-2 px-4 text-right text-green-400 font-bold">
                          {fmt(parcelas.reduce((acc, p) => acc + parseFloat(p.valor), 0))}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {implanteSelecionado.observacoes && (
                <div className="mt-4 bg-gray-800 rounded-lg p-3">
                  <div className="text-gray-500 text-xs mb-1">Observações</div>
                  <div className="text-gray-300 text-sm">{implanteSelecionado.observacoes}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL PARCELA */}
      {modalParcela && (
        <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-800">
              <h3 className="text-white font-bold">Registrar Parcela</h3>
              <button onClick={() => setModalParcela(false)} className="text-gray-500 hover:text-white text-xl">×</button>
            </div>
            <div className="p-5 space-y-3">
              <div className="bg-gray-800 rounded-lg p-3 text-sm">
                <span className="text-gray-400">Paciente: </span>
                <span className="text-white font-medium">{implanteSelecionado?.pacientes?.nome}</span>
                <span className="text-gray-500 ml-2">· Valor total: {fmt(parseFloat(implanteSelecionado?.valor_total))}</span>
              </div>
              <div>
                <label className="text-gray-400 text-xs block mb-1">Data do pagamento *</label>
                <input type="date" value={formParcela.data_pagamento}
                  onChange={e => setFormParcela({...formParcela, data_pagamento: e.target.value})}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" />
              </div>
              <div>
                <label className="text-gray-400 text-xs block mb-1">Valor da parcela *</label>
                <input type="number" step="0.01" placeholder="0,00" value={formParcela.valor}
                  onChange={e => setFormParcela({...formParcela, valor: e.target.value})}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" />
              </div>
              <div>
                <label className="text-gray-400 text-xs block mb-1">Forma de pagamento *</label>
                <select value={formParcela.forma_pagamento}
                  onChange={e => setFormParcela({...formParcela, forma_pagamento: e.target.value})}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none">
                  <option value="">Selecione...</option>
                  <option>Pix</option>
                  <option>Dinheiro</option>
                  <option>Cartão de débito</option>
                  <option>Cartão de crédito</option>
                  <option>Promissória</option>
                  <option>Cheque</option>
                </select>
              </div>
              <div>
                <label className="text-gray-400 text-xs block mb-1">Observações</label>
                <input value={formParcela.observacoes}
                  onChange={e => setFormParcela({...formParcela, observacoes: e.target.value})}
                  placeholder="Ex: 1ª parcela, entrada..."
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" />
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setModalParcela(false)}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-white text-sm font-semibold py-2.5 rounded-lg">Cancelar</button>
                <button onClick={salvarParcela} disabled={salvando}
                  className="flex-1 bg-green-700 hover:bg-green-600 text-white text-sm font-semibold py-2.5 rounded-lg disabled:opacity-50">
                  {salvando ? 'Salvando...' : 'Salvar parcela'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NOVO IMPLANTE */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-800">
              <h3 className="text-white font-bold">Novo Implante</h3>
              <button onClick={() => setModalAberto(false)} className="text-gray-500 hover:text-white text-xl">×</button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="text-gray-400 text-xs block mb-1">Paciente *</label>
                <select value={form.paciente_id} onChange={e => setForm({...form, paciente_id: e.target.value})}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none">
                  <option value="">Selecione o paciente...</option>
                  {pacientes.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Dentista *</label>
                  <select value={form.dentista_id} onChange={e => setForm({...form, dentista_id: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none">
                    <option value="">Selecione...</option>
                    {dentistas.map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Clínica *</label>
                  {perfilAdmin ? (
                    <select value={form.clinica_id} onChange={e => setForm({...form, clinica_id: e.target.value})}
                      className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none">
                      <option value="">Selecione...</option>
                      {clinicas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </select>
                  ) : (
                    <div className="bg-gray-800 border border-gray-700 text-gray-400 rounded-lg px-3 py-2 text-sm">
                      {clinicas.find(c => c.id === clinicaIdUsuario)?.nome}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="text-gray-400 text-xs block mb-1">Protético (40% sobre valor total)</label>
                <select value={form.protetico_id} onChange={e => setForm({...form, protetico_id: e.target.value})}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none">
                  <option value="">Selecione o protético...</option>
                  {proteticos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
              </div>
              <div>
                <label className="text-gray-400 text-xs block mb-1">Descrição</label>
                <input value={form.descricao} onChange={e => setForm({...form, descricao: e.target.value})}
                  placeholder="Ex: Implante unitário dente 36..."
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Valor total *</label>
                  <input type="number" step="0.01" placeholder="0,00" value={form.valor_total}
                    onChange={e => setForm({...form, valor_total: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Data de início</label>
                  <input type="date" value={form.data_inicio} onChange={e => setForm({...form, data_inicio: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" />
                </div>
              </div>
              {form.valor_total && (
                <div className="bg-yellow-900/20 border border-yellow-800/40 rounded-lg p-3 text-xs">
                  <div className="text-yellow-400 font-semibold mb-1">💰 Comissões calculadas (40%)</div>
                  <div className="text-gray-300">Dentista: {(parseFloat(form.valor_total) * 0.40).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                  {form.protetico_id && <div className="text-gray-300">Protético: {(parseFloat(form.valor_total) * 0.40).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>}
                </div>
              )}
              <div>
                <label className="text-gray-400 text-xs block mb-1">Observações</label>
                <textarea value={form.observacoes} onChange={e => setForm({...form, observacoes: e.target.value})}
                  rows={2} placeholder="Anotações sobre o implante..."
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none resize-none" />
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setModalAberto(false)}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-white text-sm font-semibold py-2.5 rounded-lg">Cancelar</button>
                <button onClick={salvarImplante} disabled={salvando}
                  className="flex-1 bg-blue-700 hover:bg-blue-600 text-white text-sm font-semibold py-2.5 rounded-lg disabled:opacity-50">
                  {salvando ? 'Salvando...' : 'Salvar implante'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}