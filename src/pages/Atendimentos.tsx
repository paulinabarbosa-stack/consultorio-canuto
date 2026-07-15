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
  const [proteticos, setProteticos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modalAberto, setModalAberto] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [filtroData, setFiltroData] = useState(new Date().toISOString().split('T')[0])
  const [filtroClinica, setFiltroClinica] = useState('')
  const [filtroDentista, setFiltroDentista] = useState('')
  const [clinicaIdUsuario, setClinicaIdUsuario] = useState<string | null>(null)
  const [perfilAdmin, setPerfilAdmin] = useState(true)

  const [form, setForm] = useState({
    paciente_id: '', dentista_id: '', clinica_id: '',
    procedimento_id: '', procedimento_outro: '',
    data_atendimento: new Date().toISOString().split('T')[0],
    data_pagamento: new Date().toISOString().split('T')[0],
    valor: '', forma_pagamento: '', observacoes: '',
    envolve_protetico: false, protetico_id: '', protetico_valor: ''
  })
  const [buscaPaciente, setBuscaPaciente] = useState('')
  const [dropdownPacienteAberto, setDropdownPacienteAberto] = useState(false)
  const [editandoAtendimento, setEditandoAtendimento] = useState<any>(null)
  const [formEdicao, setFormEdicao] = useState({
    valor: '', forma_pagamento: '', data_atendimento: '', data_pagamento: '',
    observacoes: '', envolve_protetico: false, protetico_id: '', protetico_valor: ''
  })

  // Carrega o perfil do usuário logado (admin ou secretária) e sua clínica
  useEffect(() => {
    async function carregarUsuario() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('usuarios').select('perfil, clinica_id').eq('auth_id', user.id).maybeSingle()
      if (data) {
        const ehAdmin = data.perfil !== 'secretaria'
        setPerfilAdmin(ehAdmin)
        if (data.clinica_id) {
          setClinicaIdUsuario(data.clinica_id)
          // Secretária: trava a clínica do formulário e do filtro na clínica dela
          if (!ehAdmin) {
            setForm(f => ({ ...f, clinica_id: data.clinica_id }))
            setFiltroClinica(data.clinica_id)
          }
        }
      }
    }
    carregarUsuario()
  }, [])

  useEffect(() => { carregar() }, [filtroData, filtroClinica, filtroDentista])

  async function carregar() {
    setLoading(true)
    try {
      let query = supabase
        .from('atendimentos')
        .select('*, pacientes(nome), dentistas(nome), clinicas(nome), procedimentos(nome), proteticos(nome)')
        .order('created_at', { ascending: false })

      if (filtroData) query = query.eq('data_atendimento', filtroData)
      if (filtroClinica) query = query.eq('clinica_id', filtroClinica)
      if (filtroDentista) query = query.eq('dentista_id', filtroDentista)

      const { data: at } = await query
      const { data: cl } = await supabase.from('clinicas').select('*')
      const { data: de } = await supabase.from('dentistas').select('*')
      // Traz clinica_id do paciente para poder filtrar por clínica no formulário
      const { data: pa } = await supabase.from('pacientes').select('id, nome, clinica_id').order('nome')
      const { data: pr } = await supabase.from('procedimentos').select('*').order('nome')
      const { data: pt } = await supabase.from('proteticos').select('*').order('nome')

      if (at) setAtendimentos(at)
      if (cl) setClinicas(cl)
      if (de) setDentistas(de)
      if (pa) setPacientes(pa)
      if (pr) setProcedimentos(pr)
      if (pt) setProteticos(pt)
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  async function salvar() {
    if (!form.paciente_id || !form.dentista_id || !form.clinica_id || !form.valor || !form.forma_pagamento)
      return alert('Preencha paciente, dentista, clínica, valor e forma de pagamento!')
    if (!form.data_pagamento)
      return alert('Informe a data do pagamento!')
    if (form.procedimento_id === 'outros' && !form.procedimento_outro.trim())
      return alert('Descreva o procedimento no campo "Qual procedimento?"')
    if (form.envolve_protetico && (!form.protetico_id || !form.protetico_valor))
      return alert('Selecione o protético e informe o valor cobrado por ele!')

    setSalvando(true)
    const valor = parseFloat(form.valor)
    const pctComissao = (form.forma_pagamento === 'Dinheiro' || form.forma_pagamento === 'Cheque') ? 40 : 36
    const comissaoValor = valor * pctComissao / 100

    // Cálculo do protético
    const proteticoValor = form.envolve_protetico ? parseFloat(form.protetico_valor) : null
    const proteticoDescontoDentista = proteticoValor ? proteticoValor * 0.40 : 0
    const proteticoDescontoClinica = proteticoValor ? proteticoValor * 0.60 : 0
    const comissaoValorLiquido = comissaoValor - proteticoDescontoDentista

    // Se for "Outros", salva sem procedimento_id mas com observação do procedimento
    const procedimentoId = form.procedimento_id === 'outros' ? null : (form.procedimento_id || null)
    const observacoes = form.procedimento_id === 'outros'
      ? `Procedimento: ${form.procedimento_outro}${form.observacoes ? ' | ' + form.observacoes : ''}`
      : (form.observacoes || null)

    const { error } = await supabase.from('atendimentos').insert([{
      paciente_id: form.paciente_id,
      dentista_id: form.dentista_id,
      clinica_id: form.clinica_id,
      procedimento_id: procedimentoId,
      data_atendimento: form.data_atendimento,
      data_pagamento: form.data_pagamento,
      valor, forma_pagamento: form.forma_pagamento,
      comissao_percentual: pctComissao,
      comissao_valor: comissaoValor,
      observacoes,
      protetico_id: form.envolve_protetico ? form.protetico_id : null,
      protetico_valor: proteticoValor,
      protetico_desconto_dentista: form.envolve_protetico ? proteticoDescontoDentista : null,
      protetico_desconto_clinica: form.envolve_protetico ? proteticoDescontoClinica : null,
      comissao_valor_liquido: comissaoValorLiquido,
    }])
    if (error) { alert('Erro: ' + error.message); setSalvando(false); return }
    setModalAberto(false)
    setBuscaPaciente('')
    setForm({
      paciente_id: '', dentista_id: '', clinica_id: '',
      procedimento_id: '', procedimento_outro: '',
      data_atendimento: new Date().toISOString().split('T')[0],
      data_pagamento: new Date().toISOString().split('T')[0],
      valor: '', forma_pagamento: '', observacoes: '',
      envolve_protetico: false, protetico_id: '', protetico_valor: ''
    })
    await carregar()
    setSalvando(false)
  }

  function abrirEdicao(a: any) {
    setEditandoAtendimento(a)
    setFormEdicao({
      valor: a.valor != null ? String(a.valor) : '',
      forma_pagamento: a.forma_pagamento || '',
      data_atendimento: a.data_atendimento || '',
      data_pagamento: a.data_pagamento || '',
      observacoes: a.observacoes || '',
      envolve_protetico: !!a.protetico_id,
      protetico_id: a.protetico_id || '',
      protetico_valor: a.protetico_valor != null ? String(a.protetico_valor) : '',
    })
  }

  async function salvarEdicao() {
    if (!formEdicao.valor || !formEdicao.forma_pagamento) return alert('Preencha valor e forma de pagamento!')
    if (!formEdicao.data_pagamento) return alert('Informe a data do pagamento!')
    if (formEdicao.envolve_protetico && (!formEdicao.protetico_id || !formEdicao.protetico_valor))
      return alert('Selecione o protético e informe o valor cobrado por ele!')

    setSalvando(true)
    const valor = parseFloat(formEdicao.valor)
    const pctComissao = (formEdicao.forma_pagamento === 'Dinheiro' || formEdicao.forma_pagamento === 'Cheque') ? 40 : 36
    const comissaoValor = valor * pctComissao / 100

    const proteticoValor = formEdicao.envolve_protetico ? parseFloat(formEdicao.protetico_valor) : null
    const proteticoDescontoDentista = proteticoValor ? proteticoValor * 0.40 : 0
    const proteticoDescontoClinica = proteticoValor ? proteticoValor * 0.60 : 0
    const comissaoValorLiquido = comissaoValor - proteticoDescontoDentista

    const { error } = await supabase.from('atendimentos').update({
      valor,
      forma_pagamento: formEdicao.forma_pagamento,
      data_atendimento: formEdicao.data_atendimento,
      data_pagamento: formEdicao.data_pagamento,
      observacoes: formEdicao.observacoes || null,
      comissao_percentual: pctComissao,
      comissao_valor: comissaoValor,
      protetico_id: formEdicao.envolve_protetico ? formEdicao.protetico_id : null,
      protetico_valor: proteticoValor,
      protetico_desconto_dentista: formEdicao.envolve_protetico ? proteticoDescontoDentista : null,
      protetico_desconto_clinica: formEdicao.envolve_protetico ? proteticoDescontoClinica : null,
      comissao_valor_liquido: comissaoValorLiquido,
    }).eq('id', editandoAtendimento.id)
    if (error) { alert('Erro: ' + error.message); setSalvando(false); return }

    setEditandoAtendimento(null)
    await carregar()
    setSalvando(false)
  }

  function formatarDinheiro(v: number) {
    return v?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || 'R$ 0,00'
  }

  // Nome do procedimento para exibir na tabela
  function nomeProcedimento(a: any): string {
    if (a.procedimentos?.nome) return a.procedimentos.nome
    if (a.observacoes?.startsWith('Procedimento: ')) {
      return a.observacoes.split(' | ')[0].replace('Procedimento: ', '') + ' (Outros)'
    }
    return '—'
  }

  const totalReceita = atendimentos.reduce((acc, a) => acc + (parseFloat(a.valor) || 0), 0)
  const totalComissao = atendimentos.reduce((acc, a) => acc + (parseFloat(a.comissao_valor_liquido ?? a.comissao_valor) || 0), 0)

  // Valores calculados para exibição no formulário
  const comissaoBrutaForm = (form.valor && form.forma_pagamento)
    ? parseFloat(form.valor) * ((form.forma_pagamento === 'Dinheiro' || form.forma_pagamento === 'Cheque') ? 0.40 : 0.36)
    : 0
  const proteticoValorForm = form.envolve_protetico ? parseFloat(form.protetico_valor || '0') : 0
  const proteticoDescontoDentistaForm = proteticoValorForm * 0.40
  const proteticoDescontoClinicaForm = proteticoValorForm * 0.60
  const comissaoLiquidaForm = comissaoBrutaForm - proteticoDescontoDentistaForm

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

      <div className="flex gap-3 mb-6 flex-wrap items-center">
        <input type="date" value={filtroData} onChange={e => setFiltroData(e.target.value)}
          className="bg-gray-900 border border-gray-800 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" />
        {perfilAdmin ? (
          <select value={filtroClinica} onChange={e => setFiltroClinica(e.target.value)}
            className="bg-gray-900 border border-gray-800 text-white rounded-lg px-3 py-2 text-sm focus:outline-none">
            <option value="">Todas as clínicas</option>
            {clinicas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        ) : (
          <span className="bg-gray-800 border border-gray-700 text-gray-300 rounded-lg px-3 py-2 text-sm font-medium">
            📍 {clinicas.find(c => c.id === clinicaIdUsuario)?.nome}
          </span>
        )}
        <select value={filtroDentista} onChange={e => setFiltroDentista(e.target.value)}
          className="bg-gray-900 border border-gray-800 text-white rounded-lg px-3 py-2 text-sm focus:outline-none">
          <option value="">Todos os dentistas</option>
          {dentistas.map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}
        </select>
        <button onClick={() => { setFiltroData(''); setFiltroClinica(perfilAdmin ? '' : (clinicaIdUsuario || '')); setFiltroDentista('') }}
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
                <th className="text-center text-gray-500 text-xs px-4 py-3">Ação</th>
              </tr>
            </thead>
            <tbody>
              {atendimentos.map((a, i) => (
                <tr key={a.id} className={i < atendimentos.length - 1 ? 'border-b border-gray-800' : ''}>
                  <td className="px-4 py-3"><div className="text-white text-sm font-medium">{a.pacientes?.nome}</div></td>
                  <td className="px-4 py-3">
                    <div className="text-gray-400 text-sm">{nomeProcedimento(a)}</div>
                    {a.proteticos?.nome && (
                      <div className="text-purple-400 text-xs mt-0.5">🔧 {a.proteticos.nome} · {formatarDinheiro(a.protetico_valor)}</div>
                    )}
                  </td>
                  <td className="px-4 py-3"><div className="text-gray-400 text-sm">{a.dentistas?.nome}</div></td>
                  <td className="px-4 py-3"><div className="text-gray-400 text-sm">{a.clinicas?.nome}</div></td>
                  <td className="px-4 py-3 text-right"><div className="text-green-400 text-sm font-semibold">{formatarDinheiro(a.valor)}</div></td>
                  <td className="px-4 py-3 text-right">
                    <div className="text-yellow-400 text-sm">
                      {formatarDinheiro(a.comissao_valor_liquido ?? a.comissao_valor)}
                      <span className="text-gray-600 text-xs ml-1">({a.comissao_percentual}%)</span>
                    </div>
                    {a.protetico_desconto_dentista > 0 && (
                      <div className="text-gray-600 text-xs">− {formatarDinheiro(a.protetico_desconto_dentista)} protético</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${PGTO_CORES[a.forma_pagamento] || 'bg-gray-800 text-gray-400'}`}>
                      {a.forma_pagamento}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => abrirEdicao(a)}
                      className="text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded px-2 py-1 text-xs">
                      ✏️
                    </button>
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
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Clínica *</label>
                  {perfilAdmin ? (
                    <select value={form.clinica_id} onChange={e => { setForm({...form, clinica_id: e.target.value, paciente_id: ''}); setBuscaPaciente('') }}
                      className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none">
                      <option value="">Selecione...</option>
                      {clinicas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </select>
                  ) : (
                    <div className="bg-gray-800 border border-gray-700 text-gray-300 rounded-lg px-3 py-2 text-sm">
                      {clinicas.find(c => c.id === form.clinica_id)?.nome}
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Dentista *</label>
                  <select value={form.dentista_id} onChange={e => setForm({...form, dentista_id: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none">
                    <option value="">Selecione...</option>
                    {dentistas.map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}
                  </select>
                </div>
                <div className="col-span-2 relative">
                  <label className="text-gray-400 text-xs block mb-1">Paciente *</label>
                  <input
                    type="text"
                    value={buscaPaciente}
                    disabled={!form.clinica_id}
                    placeholder={form.clinica_id ? 'Digite o nome do paciente...' : 'Selecione a clínica primeiro'}
                    onChange={e => {
                      setBuscaPaciente(e.target.value)
                      setForm({...form, paciente_id: ''})
                      setDropdownPacienteAberto(true)
                    }}
                    onFocus={() => setDropdownPacienteAberto(true)}
                    onBlur={() => setTimeout(() => setDropdownPacienteAberto(false), 200)}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none disabled:opacity-50"
                  />
                  {dropdownPacienteAberto && form.clinica_id && (
                    <div className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto bg-gray-800 border border-gray-700 rounded-lg shadow-lg">
                      {pacientes.filter(p => p.clinica_id === form.clinica_id && p.nome.toLowerCase().includes(buscaPaciente.toLowerCase())).length === 0 ? (
                        <div className="px-3 py-2 text-gray-500 text-sm">Nenhum paciente encontrado</div>
                      ) : (
                        pacientes
                          .filter(p => p.clinica_id === form.clinica_id && p.nome.toLowerCase().includes(buscaPaciente.toLowerCase()))
                          .map(p => (
                            <div key={p.id}
                              onClick={() => { setForm({...form, paciente_id: p.id}); setBuscaPaciente(p.nome); setDropdownPacienteAberto(false) }}
                              className="px-3 py-2 text-white text-sm hover:bg-gray-700 cursor-pointer">
                              {p.nome}
                            </div>
                          ))
                      )}
                    </div>
                  )}
                </div>
                <div className="col-span-2">
                  <label className="text-gray-400 text-xs block mb-1">Procedimento</label>
                  <select value={form.procedimento_id} onChange={e => setForm({...form, procedimento_id: e.target.value, procedimento_outro: ''})}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none">
                    <option value="">Selecione...</option>
                    {procedimentos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                    <option value="outros">Outros (digitar manualmente)</option>
                  </select>
                </div>

                {/* Campo livre para "Outros" */}
                {form.procedimento_id === 'outros' && (
                  <div className="col-span-2">
                    <label className="text-gray-400 text-xs block mb-1">Qual procedimento? *</label>
                    <input
                      type="text"
                      value={form.procedimento_outro}
                      onChange={e => setForm({...form, procedimento_outro: e.target.value})}
                      placeholder="Descreva o procedimento..."
                      className="w-full bg-gray-800 border border-yellow-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-yellow-500"
                      autoFocus
                    />
                  </div>
                )}

                <div>
                  <label className="text-gray-400 text-xs block mb-1">Data do procedimento *</label>
                  <input type="date" value={form.data_atendimento}
                    onChange={e => setForm({...form, data_atendimento: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Data do pagamento *</label>
                  <input type="date" value={form.data_pagamento}
                    onChange={e => setForm({...form, data_pagamento: e.target.value})}
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

                {/* Checkbox protético */}
                <div className="col-span-2 flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="envolve_protetico"
                    checked={form.envolve_protetico}
                    onChange={e => setForm({...form, envolve_protetico: e.target.checked, protetico_id: '', protetico_valor: ''})}
                    className="w-4 h-4"
                  />
                  <label htmlFor="envolve_protetico" className="text-gray-300 text-sm cursor-pointer">
                    Este atendimento envolve protético?
                  </label>
                </div>

                {form.envolve_protetico && (
                  <>
                    <div>
                      <label className="text-gray-400 text-xs block mb-1">Protético *</label>
                      <select value={form.protetico_id} onChange={e => setForm({...form, protetico_id: e.target.value})}
                        className="w-full bg-gray-800 border border-purple-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none">
                        <option value="">Selecione...</option>
                        {proteticos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-gray-400 text-xs block mb-1">Valor cobrado pelo protético *</label>
                      <input type="number" step="0.01" placeholder="0,00" value={form.protetico_valor}
                        onChange={e => setForm({...form, protetico_valor: e.target.value})}
                        className="w-full bg-gray-800 border border-purple-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" />
                    </div>
                  </>
                )}

                {form.forma_pagamento && form.valor && (
                  <div className="col-span-2 bg-gray-800 rounded-lg p-3 text-sm space-y-1">
                    <div>
                      <span className="text-gray-400">Comissão bruta do dentista: </span>
                      <span className="text-yellow-400 font-semibold">
                        {(form.forma_pagamento === 'Dinheiro' || form.forma_pagamento === 'Cheque') ? '40%' : '36%'} = {formatarDinheiro(comissaoBrutaForm)}
                      </span>
                    </div>
                    {form.envolve_protetico && proteticoValorForm > 0 && (
                      <>
                        <div>
                          <span className="text-gray-400">Protético cobra: </span>
                          <span className="text-purple-400 font-semibold">{formatarDinheiro(proteticoValorForm)}</span>
                        </div>
                        <div>
                          <span className="text-gray-400">Clínica paga ao protético (60%): </span>
                          <span className="text-purple-400">{formatarDinheiro(proteticoDescontoClinicaForm)}</span>
                        </div>
                        <div>
                          <span className="text-gray-400">Desconto na comissão do dentista (40%): </span>
                          <span className="text-red-400">− {formatarDinheiro(proteticoDescontoDentistaForm)}</span>
                        </div>
                        <div className="pt-1 border-t border-gray-700">
                          <span className="text-gray-300 font-semibold">Comissão líquida do dentista: </span>
                          <span className="text-green-400 font-bold">{formatarDinheiro(comissaoLiquidaForm)}</span>
                        </div>
                      </>
                    )}
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

      {editandoAtendimento && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-800">
              <div>
                <h3 className="text-white font-bold">Editar Atendimento</h3>
                <p className="text-gray-500 text-xs mt-0.5">{editandoAtendimento.pacientes?.nome} · {nomeProcedimento(editandoAtendimento)}</p>
              </div>
              <button onClick={() => setEditandoAtendimento(null)} className="text-gray-500 hover:text-white text-xl">×</button>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Data do procedimento *</label>
                  <input type="date" value={formEdicao.data_atendimento}
                    onChange={e => setFormEdicao({...formEdicao, data_atendimento: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Data do pagamento *</label>
                  <input type="date" value={formEdicao.data_pagamento}
                    onChange={e => setFormEdicao({...formEdicao, data_pagamento: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Valor (R$) *</label>
                  <input type="number" step="0.01" placeholder="0,00" value={formEdicao.valor}
                    onChange={e => setFormEdicao({...formEdicao, valor: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Forma de pagamento *</label>
                  <select value={formEdicao.forma_pagamento} onChange={e => setFormEdicao({...formEdicao, forma_pagamento: e.target.value})}
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

                <div className="col-span-2 flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="envolve_protetico_edicao"
                    checked={formEdicao.envolve_protetico}
                    onChange={e => setFormEdicao({...formEdicao, envolve_protetico: e.target.checked, protetico_id: '', protetico_valor: ''})}
                    className="w-4 h-4"
                  />
                  <label htmlFor="envolve_protetico_edicao" className="text-gray-300 text-sm cursor-pointer">
                    Este atendimento envolve protético?
                  </label>
                </div>

                {formEdicao.envolve_protetico && (
                  <>
                    <div>
                      <label className="text-gray-400 text-xs block mb-1">Protético *</label>
                      <select value={formEdicao.protetico_id} onChange={e => setFormEdicao({...formEdicao, protetico_id: e.target.value})}
                        className="w-full bg-gray-800 border border-purple-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none">
                        <option value="">Selecione...</option>
                        {proteticos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-gray-400 text-xs block mb-1">Valor cobrado pelo protético *</label>
                      <input type="number" step="0.01" placeholder="0,00" value={formEdicao.protetico_valor}
                        onChange={e => setFormEdicao({...formEdicao, protetico_valor: e.target.value})}
                        className="w-full bg-gray-800 border border-purple-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" />
                    </div>
                  </>
                )}

                <div className="col-span-2">
                  <label className="text-gray-400 text-xs block mb-1">Observações</label>
                  <input type="text" value={formEdicao.observacoes}
                    onChange={e => setFormEdicao({...formEdicao, observacoes: e.target.value})}
                    placeholder="Anotações..."
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setEditandoAtendimento(null)}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors">
                  Cancelar
                </button>
                <button onClick={salvarEdicao} disabled={salvando}
                  className="flex-1 bg-green-700 hover:bg-green-600 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50">
                  {salvando ? 'Salvando...' : 'Salvar alterações'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}