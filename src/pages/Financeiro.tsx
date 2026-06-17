import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Financeiro() {
  const [entradas, setEntradas] = useState<any[]>([])
  const [saidas, setSaidas] = useState<any[]>([])
  const [clinicas, setClinicas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [abaAtiva, setAbaAtiva] = useState<'entradas'|'saidas'>('entradas')
  const [modalSaida, setModalSaida] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [mes, setMes] = useState(new Date().toISOString().slice(0, 7))
  const [filtroClinica, setFiltroClinica] = useState('')

  const [form, setForm] = useState({
    clinica_id: '', descricao: '', valor: '',
    categoria: '', data_saida: new Date().toISOString().split('T')[0]
  })

  useEffect(() => { carregar() }, [mes, filtroClinica])

  async function carregar() {
    setLoading(true)
    try {
      const inicioMes = mes + '-01'
      const fimMes = mes + '-31'

      let qEntradas = supabase
        .from('atendimentos')
        .select('*, dentistas(nome), clinicas(nome), procedimentos(nome)')
        .gte('data_atendimento', inicioMes)
        .lte('data_atendimento', fimMes)
        .order('data_atendimento', { ascending: false })

      let qSaidas = supabase
        .from('financeiro_saidas')
        .select('*, clinicas(nome)')
        .gte('data_saida', inicioMes)
        .lte('data_saida', fimMes)
        .order('data_saida', { ascending: false })

      if (filtroClinica) {
        qEntradas = qEntradas.eq('clinica_id', filtroClinica)
        qSaidas = qSaidas.eq('clinica_id', filtroClinica)
      }

      const [{ data: e }, { data: s }, { data: c }] = await Promise.all([
        qEntradas, qSaidas,
        supabase.from('clinicas').select('*')
      ])

      if (e) setEntradas(e)
      if (s) setSaidas(s)
      if (c) setClinicas(c)
    } catch (err) {
      console.error(err)
    }
    setLoading(false)
  }

  async function salvarSaida() {
    if (!form.descricao || !form.valor || !form.data_saida)
      return alert('Preencha descrição, valor e data!')
    setSalvando(true)
    const { error } = await supabase.from('financeiro_saidas').insert([{
      clinica_id: form.clinica_id || null,
      descricao: form.descricao,
      valor: parseFloat(form.valor),
      categoria: form.categoria || null,
      data_saida: form.data_saida,
    }])
    if (error) { alert('Erro: ' + error.message); setSalvando(false); return }
    setModalSaida(false)
    setForm({ clinica_id: '', descricao: '', valor: '', categoria: '', data_saida: new Date().toISOString().split('T')[0] })
    await carregar()
    setSalvando(false)
  }

  function fmt(v: number) {
    return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  const totalEntradas = entradas.reduce((acc, e) => acc + (parseFloat(e.valor) || 0), 0)
  const totalSaidas = saidas.reduce((acc, s) => acc + (parseFloat(s.valor) || 0), 0)
  const totalComissoes = entradas.reduce((acc, e) => acc + (parseFloat(e.comissao_valor) || 0), 0)
  const saldo = totalEntradas - totalSaidas - totalComissoes

  const categorias = ['Aluguel', 'Salários', 'Materiais', 'Equipamentos', 'Serviços', 'Impostos', 'Outros']

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-white text-lg font-bold">Financeiro</h2>
          <p className="text-gray-500 text-sm">Controle de entradas e saídas</p>
        </div>
        <button onClick={() => setModalSaida(true)}
          className="bg-red-800 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
          + Registrar saída
        </button>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <input type="month" value={mes} onChange={e => setMes(e.target.value)}
          className="bg-gray-900 border border-gray-800 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" />
        <select value={filtroClinica} onChange={e => setFiltroClinica(e.target.value)}
          className="bg-gray-900 border border-gray-800 text-white rounded-lg px-3 py-2 text-sm focus:outline-none">
          <option value="">Todas as clínicas</option>
          {clinicas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      </div>

      {/* Cards resumo */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="text-gray-500 text-xs mb-2">📈 Total entradas</div>
          <div className="text-green-400 text-xl font-bold">{fmt(totalEntradas)}</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="text-gray-500 text-xs mb-2">💸 Total comissões</div>
          <div className="text-yellow-400 text-xl font-bold">{fmt(totalComissoes)}</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="text-gray-500 text-xs mb-2">📉 Total saídas</div>
          <div className="text-red-400 text-xl font-bold">{fmt(totalSaidas)}</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="text-gray-500 text-xs mb-2">💰 Saldo líquido</div>
          <div className={`text-xl font-bold ${saldo >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmt(saldo)}</div>
        </div>
      </div>

      {/* Abas */}
      <div className="flex gap-2 mb-4">
        <button onClick={() => setAbaAtiva('entradas')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${abaAtiva === 'entradas' ? 'bg-green-900 text-green-300' : 'bg-gray-900 text-gray-400 hover:text-white'}`}>
          📈 Entradas ({entradas.length})
        </button>
        <button onClick={() => setAbaAtiva('saidas')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${abaAtiva === 'saidas' ? 'bg-red-900 text-red-300' : 'bg-gray-900 text-gray-400 hover:text-white'}`}>
          📉 Saídas ({saidas.length})
        </button>
      </div>

      {loading ? (
        <div className="text-gray-400 text-center p-8">Carregando...</div>
      ) : abaAtiva === 'entradas' ? (
        entradas.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
            <div className="text-gray-400">Nenhuma entrada registrada neste período</div>
          </div>
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left text-gray-500 text-xs px-4 py-3">Data</th>
                  <th className="text-left text-gray-500 text-xs px-4 py-3">Paciente</th>
                  <th className="text-left text-gray-500 text-xs px-4 py-3">Procedimento</th>
                  <th className="text-left text-gray-500 text-xs px-4 py-3">Dentista</th>
                  <th className="text-left text-gray-500 text-xs px-4 py-3">Clínica</th>
                  <th className="text-left text-gray-500 text-xs px-4 py-3">Pagamento</th>
                  <th className="text-right text-gray-500 text-xs px-4 py-3">Valor</th>
                  <th className="text-right text-gray-500 text-xs px-4 py-3">Comissão</th>
                </tr>
              </thead>
              <tbody>
                {entradas.map((e, i) => (
                  <tr key={e.id} className={i < entradas.length - 1 ? 'border-b border-gray-800' : ''}>
                    <td className="px-4 py-3 text-gray-400 text-sm whitespace-nowrap">
                      {new Date(e.data_atendimento).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-4 py-3 text-white text-sm">{e.pacientes?.nome || '—'}</td>
                    <td className="px-4 py-3 text-gray-400 text-sm">{e.procedimentos?.nome || '—'}</td>
                    <td className="px-4 py-3 text-gray-400 text-sm">{e.dentistas?.nome || '—'}</td>
                    <td className="px-4 py-3 text-gray-400 text-sm">{e.clinicas?.nome || '—'}</td>
                    <td className="px-4 py-3 text-gray-400 text-sm">{e.forma_pagamento}</td>
                    <td className="px-4 py-3 text-right text-green-400 text-sm font-semibold">{fmt(e.valor)}</td>
                    <td className="px-4 py-3 text-right text-yellow-400 text-sm">{fmt(e.comissao_valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        saidas.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
            <div className="text-gray-400">Nenhuma saída registrada neste período</div>
          </div>
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left text-gray-500 text-xs px-4 py-3">Data</th>
                  <th className="text-left text-gray-500 text-xs px-4 py-3">Descrição</th>
                  <th className="text-left text-gray-500 text-xs px-4 py-3">Categoria</th>
                  <th className="text-left text-gray-500 text-xs px-4 py-3">Clínica</th>
                  <th className="text-right text-gray-500 text-xs px-4 py-3">Valor</th>
                </tr>
              </thead>
              <tbody>
                {saidas.map((s, i) => (
                  <tr key={s.id} className={i < saidas.length - 1 ? 'border-b border-gray-800' : ''}>
                    <td className="px-4 py-3 text-gray-400 text-sm whitespace-nowrap">
                      {new Date(s.data_saida).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-4 py-3 text-white text-sm">{s.descricao}</td>
                    <td className="px-4 py-3 text-gray-400 text-sm">{s.categoria || '—'}</td>
                    <td className="px-4 py-3 text-gray-400 text-sm">{s.clinicas?.nome || 'Todas'}</td>
                    <td className="px-4 py-3 text-right text-red-400 text-sm font-semibold">{fmt(s.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* MODAL SAÍDA */}
      {modalSaida && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-800">
              <h3 className="text-white font-bold">Registrar Saída</h3>
              <button onClick={() => setModalSaida(false)} className="text-gray-500 hover:text-white text-xl">×</button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="text-gray-400 text-xs block mb-1">Descrição *</label>
                <input value={form.descricao} onChange={e => setForm({...form, descricao: e.target.value})}
                  placeholder="Ex: Aluguel clínica Palha, Material odontológico..."
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Valor (R$) *</label>
                  <input type="number" step="0.01" placeholder="0,00" value={form.valor}
                    onChange={e => setForm({...form, valor: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Data *</label>
                  <input type="date" value={form.data_saida}
                    onChange={e => setForm({...form, data_saida: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Categoria</label>
                  <select value={form.categoria} onChange={e => setForm({...form, categoria: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none">
                    <option value="">Selecione...</option>
                    {categorias.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Clínica</label>
                  <select value={form.clinica_id} onChange={e => setForm({...form, clinica_id: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none">
                    <option value="">Todas</option>
                    {clinicas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setModalSaida(false)}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors">
                  Cancelar
                </button>
                <button onClick={salvarSaida} disabled={salvando}
                  className="flex-1 bg-red-800 hover:bg-red-700 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50">
                  {salvando ? 'Salvando...' : 'Salvar saída'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}