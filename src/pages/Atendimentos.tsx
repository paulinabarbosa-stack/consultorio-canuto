import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const PGTO_CORES: Record<string, string> = {
  Pix: 'bg-green-900/30 text-green-400',
  Dinheiro: 'bg-yellow-900/30 text-yellow-400',
  'Cartão de débito': 'bg-blue-900/30 text-blue-400',
  'Cartão de crédito': 'bg-orange-900/30 text-orange-400',
  Promissória: 'bg-purple-900/30 text-purple-400',
  Cheque: 'bg-gray-800 text-gray-400',
}

export default function Atendimentos() {
  const [atendimentos, setAtendimentos] = useState<any[]>([])
  const [clinicas, setClinicas] = useState<any[]>([])
  const [dentistas, setDentistas] = useState<any[]>([])
  const [pacientes, setPacientes] = useState<any[]>([])
  const [procedimentos, setProcedimentos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modalAberto, setModalAberto] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [filtroData, setFiltroData] = useState(new Date().toISOString().split('T')[0])
  const [filtroClinica, setFiltroClinica] = useState('')
  const [filtroDentista, setFiltroDentista] = useState('')

  const [form, setForm] = useState({
    paciente_id: '', dentista_id: '', clinica_id: '',
    procedimento_id: '', data_atendimento: new Date().toISOString().split('T')[0],
    valor: '', forma_pagamento: '', observacoes: ''
  })

  useEffect(() => { carregar() }, [filtroData, filtroClinica, filtroDentista])

  async function carregar() {
    setLoading(true)
    try {
      let query = supabase
        .from('atendimentos')
        .select('*, pacientes(nome), dentistas(nome), clinicas(nome), procedimentos(nome)')
        .order('created_at', { ascending: false })

      if (filtroData) query = query.eq('data_atendimento', filtroData)
      if (filtroClinica) query = query.eq('clinica_id', filtroClinica)
      if (filtroDentista) query = query.eq('dentista_id', filtroDentista)

      const { data: at } = await query
      const { data: cl } = await supabase.from('clinicas').select('*')
      const { data: de } = await supabase.from('dentistas').select('*')
      const { data: pa } = await supabase.from('pacientes').select('id, nome').order('nome')
      const { data: pr } = await supabase.from('procedimentos').select('*').order('nome')

      if (at) setAtendimentos(at)
      if (cl) setClinicas(cl)
      if (de) setDentistas(de)
      if (pa) setPacientes(pa)
      if (pr) setProcedimentos(pr)
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  async function salvar() {
    if (!form.paciente_id || !form.dentista_id || !form.clinica_id || !form.valor || !form.forma_pagamento)
      return alert('Preencha paciente, dentista, clínica, valor e forma de pagamento!')
    setSalvando(true)
    const valor = parseFloat(form.valor)
    const pctComissao = (form.forma_pagamento === 'Dinheiro') ? 40 : 36
    const comissaoValor = valor * pctComissao / 100
    const { error } = await supabase.from('atendimentos').insert([{
      paciente_id: form.paciente_id,
      dentista_id: form.dentista_id,
      clinica_id: form.clinica_id,
      procedimento_id: form.procedimento_id || null,
      data_atendimento: form.data_atendimento,
      valor, forma_pagamento: form.forma_pagamento,
      comissao_percentual: pctComissao,
      comissao_valor: comissaoValor,
      observacoes: form.observacoes || null,
    }])
    if (error) { alert('Erro: ' + error.message); setSalvando(false); return }
    setModalAberto(false)
    setForm({ paciente_id: '', dentista_id: '', clinica_id: '', procedimento_id: '', data_atendimento: new Date().toISOString().split('T')[0], valor: '', forma_pagamento: '', observacoes: '' })
    await carregar()
    setSalvando(false)
  }

  function formatarDinheiro(v: number) {
    return v?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || 'R$ 0,00'
  }

  const totalReceita = atendimentos.reduce((acc, a) => acc + (parseFloat(a.valor) || 0), 0)
  const totalComissao = atendimentos.reduce((acc, a) => acc + (parseFloat(a.comissao_valor) || 0), 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-white text-lg font-bold">Atendimentos</h2>
          <p className="text-gray-500 text-sm">{atendimentos.length} registros · Receita: {formatarDinheiro(totalReceita)} · Comissões: {formatarDinheiro(totalComissao)}</p>
        </div>
        <button onClick={() => setModalAberto(true)}
          className="bg-green-700 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
          + Registrar atendimento
        </button>
      </div>

      <div className="flex gap-3 mb-6 flex-wrap">
        <input type="date" value={filtroData} onChange={e => setFiltroData(e.target.value)}
          className="bg-gray-900 border border-gray-800 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" />
        <select value={filtroClinica} onChange={e => setFiltroClinica(e.target.value)}
          className="bg-gray-900 border border-gray-800 text-white rounded-lg px-3 py-2 text-sm focus:outline-none">
          <option value="">Todas as clínicas</option>
          {clinicas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
        <select value={filtroDentista} onChange={e => setFiltroDentista(e.target.value)}
          className="bg-gray-900 border border-gray-800 text-white rounded-lg px-3 py-2 text-sm focus:outline-none">
          <option value="">Todos os dentistas</option>
          {dentistas.map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}
        </select>
        <button onClick={() => { setFiltroData(''); setFiltroClinica(''); setFiltroDentista('') }}
          className="bg-gray-800 border border-gray-700 text-gray-400 hover:text-white rounded-lg px-3 py-2 text-sm transition-colors">
          Limpar filtros
        </button>
      </div>

      {atendimentos.length > 0 && (
        <div className="grid grid-cols-4 gap-3 mb-6">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
            <div className="text-gray-500 text-xs mb-1">Atendimentos</div>
            <div className="text-white font-bold text-lg">{atendimentos.length}</div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
            <div className="text-gray-500 text-xs mb-1">Receita total</div>
            <div className="text-green-400 font-bold text-lg">{formatarDinheiro(totalReceita)}</div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
            <div className="text-gray-500 text-xs mb-1">Total comissões</div>
            <div className="text-yellow-400 font-bold text-lg">{formatarDinheiro(totalComissao)}</div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
            <div className="text-gray-500 text-xs mb-1">Líquido clínica</div>
            <div className="text-green-400 font-bold text-lg">{formatarDinheiro(totalReceita - totalComissao)}</div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-gray-400 p-8 text-center">Carregando...</div>
      ) : atendimentos.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
          <div className="text-4xl mb-3">🦷</div>
          <div className="text-gray-400 font-medium">Nenhum atendimento registrado</div>
          <div className="text-gray-600 text-sm mt-1">Clique em "+ Registrar atendimento" para começar</div>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left text-gray-500 text-xs px-4 py-3">Paciente</th>
                <th className="text-left text-gray-500 text-xs px-4 py-3">Procedimento</th>
                <th className="text-left text-gray-500 text-xs px-4 py-3">Dentista</th>
                <th className="text-left text-gray-500 text-xs px-4 py-3">Clínica</th>
                <th className="text-right text-gray-500 text-xs px-4 py-3">Valor</th>
                <th className="text-right text-gray-500 text-xs px-4 py-3">Comissão</th>
                <th className="text-left text-gray-500 text-xs px-4 py-3">Pagamento</th>
              </tr>
            </thead>
            <tbody>
              {atendimentos.map((a, i) => (
                <tr key={a.id} className={i < atendimentos.length - 1 ? 'border-b border-gray-800' : ''}>
                  <td className="px-4 py-3"><div className="text-white text-sm font-medium">{a.pacientes?.nome}</div></td>
                  <td className="px-4 py-3"><div className="text-gray-400 text-sm">{a.procedimentos?.nome || '—'}</div></td>
                  <td className="px-4 py-3"><div className="text-gray-400 text-sm">{a.dentistas?.nome}</div></td>
                  <td className="px-4 py-3"><div className="text-gray-400 text-sm">{a.clinicas?.nome}</div></td>
                  <td className="px-4 py-3 text-right"><div className="text-green-400 text-sm font-semibold">{formatarDinheiro(a.valor)}</div></td>
                  <td className="px-4 py-3 text-right">
                    <div className="text-yellow-400 text-sm">
                      {formatarDinheiro(a.comissao_valor)}
                      <span className="text-gray-600 text-xs ml-1">({a.comissao_percentual}%)</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${PGTO_CORES[a.forma_pagamento] || 'bg-gray-800 text-gray-400'}`}>
                      {a.forma_pagamento}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalAberto && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-800">
              <h3 className="text-white font-bold">Registrar Atendimento</h3>
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
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Clínica *</label>
                  <select value={form.clinica_id} onChange={e => setForm({...form, clinica_id: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none">
                    <option value="">Selecione...</option>
                    {clinicas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>
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
                  <select value={form.procedimento_id} onChange={e => setForm({...form, procedimento_id: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none">
                    <option value="">Selecione...</option>
                    {procedimentos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Data *</label>
                  <input type="date" value={form.data_atendimento}
                    onChange={e => setForm({...form, data_atendimento: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Valor (R$) *</label>
                  <input type="number" step="0.01" placeholder="0,00" value={form.valor}
                    onChange={e => setForm({...form, valor: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" />
                </div>
                <div className="col-span-2">
                  <label className="text-gray-400 text-xs block mb-1">Forma de pagamento *</label>
                  <select value={form.forma_pagamento} onChange={e => setForm({...form, forma_pagamento: e.target.value})}
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
                {form.forma_pagamento && form.valor && (
                  <div className="col-span-2 bg-gray-800 rounded-lg p-3 text-sm">
                    <span className="text-gray-400">Comissão do dentista: </span>
                    <span className="text-yellow-400 font-semibold">
                      {form.forma_pagamento === 'Dinheiro' ? '40%' : '36%'} = {' '}
                      {(parseFloat(form.valor) * (form.forma_pagamento === 'Dinheiro' ? 0.40 : 0.36)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  </div>
                )}
                <div className="col-span-2">
                  <label className="text-gray-400 text-xs block mb-1">Observações</label>
                  <input type="text" value={form.observacoes}
                    onChange={e => setForm({...form, observacoes: e.target.value})}
                    placeholder="Anotações..."
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setModalAberto(false)}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors">
                  Cancelar
                </button>
                <button onClick={salvar} disabled={salvando}
                  className="flex-1 bg-green-700 hover:bg-green-600 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50">
                  {salvando ? 'Salvando...' : 'Salvar atendimento'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}