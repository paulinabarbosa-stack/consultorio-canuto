import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'

export default function Financeiro() {
  const [carregandoPerfil, setCarregandoPerfil] = useState(true)
  const [perfilUsuario, setPerfilUsuario] = useState<string>('')

  const [entradas, setEntradas] = useState<any[]>([])
  const [saidas, setSaidas] = useState<any[]>([])
  const [boletos, setBoletos] = useState<any[]>([])
  const [clinicas, setClinicas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [abaAtiva, setAbaAtiva] = useState<'resumo'|'entradas'|'saidas'|'dentistas'|'boletos'>('resumo')
  const [modalSaida, setModalSaida] = useState(false)
  const [modalBoleto, setModalBoleto] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [mes, setMes] = useState(new Date().toISOString().slice(0, 7))
  const [filtroClinica, setFiltroClinica] = useState('')

  const [form, setForm] = useState({
    clinica_id: '', descricao: '', valor: '',
    categoria: '', data_saida: new Date().toISOString().split('T')[0]
  })

  const [formBoleto, setFormBoleto] = useState({
    fornecedor: '', descricao: '', valor: '', total_parcelas: '1',
    vencimento_inicial: new Date().toISOString().split('T')[0], clinica_id: ''
  })

  useEffect(() => {
    async function carregarPerfil() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setCarregandoPerfil(false); return }
      const { data } = await supabase.from('usuarios').select('perfil').eq('auth_id', user.id).maybeSingle()
      setPerfilUsuario(data?.perfil || '')
      setCarregandoPerfil(false)
    }
    carregarPerfil()
  }, [])

  const acessoLiberado = perfilUsuario === 'administrador' || perfilUsuario === 'gerente'

  useEffect(() => { if (acessoLiberado) carregar() }, [mes, acessoLiberado])

  async function carregar() {
    setLoading(true)
    try {
      const inicioMes = mes + '-01'
      const fimMes = mes + '-31'

      const qEntradas = supabase
        .from('atendimentos')
        .select('*, pacientes(nome), dentistas(nome), clinicas(nome), procedimentos(nome)')
        .gte('data_atendimento', inicioMes)
        .lte('data_atendimento', fimMes)
        .order('data_atendimento', { ascending: false })

      const qSaidas = supabase
        .from('financeiro_saidas')
        .select('*, clinicas(nome)')
        .gte('data_saida', inicioMes)
        .lte('data_saida', fimMes)
        .order('data_saida', { ascending: false })

      const qBoletos = supabase
        .from('boletos')
        .select('*, clinicas(nome)')
        .order('vencimento', { ascending: true })

      const [{ data: e }, { data: s }, { data: b }, { data: c }] = await Promise.all([
        qEntradas, qSaidas, qBoletos,
        supabase.from('clinicas').select('*')
      ])

      if (e) setEntradas(e)
      if (s) setSaidas(s)
      if (b) setBoletos(b)
      if (c) setClinicas(c)
    } catch (err) { console.error(err) }
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

  async function salvarBoleto() {
    if (!formBoleto.fornecedor || !formBoleto.valor || !formBoleto.total_parcelas || !formBoleto.vencimento_inicial)
      return alert('Preencha fornecedor, valor da parcela, número de parcelas e vencimento inicial!')
    setSalvando(true)
    const totalParcelas = parseInt(formBoleto.total_parcelas)
    const grupoId = crypto.randomUUID()
    const dataBase = new Date(formBoleto.vencimento_inicial + 'T12:00:00')
    const linhas = []
    for (let i = 0; i < totalParcelas; i++) {
      const venc = new Date(dataBase)
      venc.setMonth(venc.getMonth() + i)
      linhas.push({
        grupo_id: grupoId,
        fornecedor: formBoleto.fornecedor,
        descricao: formBoleto.descricao || null,
        numero_parcela: i + 1,
        total_parcelas: totalParcelas,
        valor: parseFloat(formBoleto.valor),
        vencimento: venc.toISOString().split('T')[0],
        pago: false,
        clinica_id: formBoleto.clinica_id || null,
      })
    }
    const { error } = await supabase.from('boletos').insert(linhas)
    if (error) { alert('Erro: ' + error.message); setSalvando(false); return }
    setModalBoleto(false)
    setFormBoleto({ fornecedor: '', descricao: '', valor: '', total_parcelas: '1', vencimento_inicial: new Date().toISOString().split('T')[0], clinica_id: '' })
    await carregar()
    setSalvando(false)
  }

  async function alternarPagoBoleto(id: string, pagoAtual: boolean) {
    await supabase.from('boletos').update({
      pago: !pagoAtual,
      data_pagamento: !pagoAtual ? new Date().toISOString().split('T')[0] : null
    }).eq('id', id)
    await carregar()
  }

  async function excluirGrupoBoleto(grupoId: string) {
    if (!confirm('Excluir todas as parcelas desse boleto? Essa ação não pode ser desfeita.')) return
    await supabase.from('boletos').delete().eq('grupo_id', grupoId)
    await carregar()
  }

  function fmt(v: number) {
    return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  function nomeProcedimento(e: any): string {
    if (e.procedimentos?.nome) return e.procedimentos.nome
    if (e.observacoes?.startsWith('Procedimento: ')) {
      return e.observacoes.split(' | ')[0].replace('Procedimento: ', '') + ' (Outros)'
    }
    return '—'
  }

  // Filtragem client-side por clínica (para as abas Entradas/Saídas/Dentistas)
  const entradasFiltradas = filtroClinica ? entradas.filter(e => e.clinica_id === filtroClinica) : entradas
  const saidasFiltradas = filtroClinica ? saidas.filter(s => s.clinica_id === filtroClinica) : saidas

  const resumoDentistas = Object.values(
    entradasFiltradas.reduce((acc: any, e: any) => {
      const nome = e.dentistas?.nome ?? 'Sem dentista'
      const id = e.dentista_id ?? 'sem'
      if (!acc[id]) acc[id] = { nome, total: 0, comissao: 0, qtd: 0 }
      acc[id].total += parseFloat(e.valor) || 0
      acc[id].comissao += parseFloat(e.comissao_valor) || 0
      acc[id].qtd += 1
      return acc
    }, {})
  ) as any[]

  const totalEntradas = entradasFiltradas.reduce((acc, e) => acc + (parseFloat(e.valor) || 0), 0)
  const totalSaidas = saidasFiltradas.reduce((acc, s) => acc + (parseFloat(s.valor) || 0), 0)
  const totalComissoes = entradasFiltradas.reduce((acc, e) => acc + (parseFloat(e.comissao_valor) || 0), 0)
  const saldo = totalEntradas - totalSaidas - totalComissoes

  // Resumo por clínica (sempre com todas as clínicas, independente do filtro)
  const resumoClinicas = useMemo(() => {
    const porClinica = clinicas.map(c => {
      const entradasC = entradas.filter(e => e.clinica_id === c.id)
      const saidasC = saidas.filter(s => s.clinica_id === c.id)
      const totalE = entradasC.reduce((a, e) => a + (parseFloat(e.valor) || 0), 0)
      const totalCom = entradasC.reduce((a, e) => a + (parseFloat(e.comissao_valor) || 0), 0)
      const totalS = saidasC.reduce((a, s) => a + (parseFloat(s.valor) || 0), 0)
      return { nome: c.nome, entradas: totalE, comissoes: totalCom, saidas: totalS, saldo: totalE - totalCom - totalS }
    })
    const saidasGerais = saidas.filter(s => !s.clinica_id).reduce((a, s) => a + (parseFloat(s.valor) || 0), 0)
    const totalEntradasGeral = porClinica.reduce((a, c) => a + c.entradas, 0)
    const totalComissoesGeral = porClinica.reduce((a, c) => a + c.comissoes, 0)
    const totalSaidasEspecificasGeral = porClinica.reduce((a, c) => a + c.saidas, 0)
    const saldoGeral = totalEntradasGeral - totalComissoesGeral - totalSaidasEspecificasGeral - saidasGerais
    return { porClinica, saidasGerais, totalEntradasGeral, totalComissoesGeral, totalSaidasEspecificasGeral, saldoGeral }
  }, [clinicas, entradas, saidas])

  // Boletos: agrupados por grupo_id
  const boletosPorGrupo = useMemo(() => {
    const grupos: Record<string, any[]> = {}
    boletos.forEach(b => {
      if (!grupos[b.grupo_id]) grupos[b.grupo_id] = []
      grupos[b.grupo_id].push(b)
    })
    return Object.values(grupos).map(parcelas => ({
      parcelas: parcelas.sort((a, b) => a.numero_parcela - b.numero_parcela),
      fornecedor: parcelas[0].fornecedor,
      descricao: parcelas[0].descricao,
      clinica: parcelas[0].clinicas?.nome,
      totalGrupo: parcelas.reduce((a, p) => a + (parseFloat(p.valor) || 0), 0),
      totalAVencerGrupo: parcelas.filter(p => !p.pago).reduce((a, p) => a + (parseFloat(p.valor) || 0), 0),
    }))
  }, [boletos])

  const totalBoletosAVencer = boletos.filter(b => !b.pago).reduce((a, b) => a + (parseFloat(b.valor) || 0), 0)

  const boletosPorMes = useMemo(() => {
    const meses: Record<string, number> = {}
    boletos.filter(b => !b.pago).forEach(b => {
      const chave = b.vencimento.slice(0, 7)
      meses[chave] = (meses[chave] || 0) + (parseFloat(b.valor) || 0)
    })
    return Object.entries(meses).sort(([a], [b]) => a.localeCompare(b))
  }, [boletos])

  function nomeMes(chave: string) {
    const [ano, m] = chave.split('-')
    const nomes = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
    return `${nomes[parseInt(m) - 1]}/${ano}`
  }

  const categorias = ['Aluguel', 'Salários', 'Materiais', 'Equipamentos', 'Serviços', 'Impostos', 'Outros']

  if (carregandoPerfil) {
    return <div className="text-gray-400 text-center p-8">Carregando...</div>
  }

  if (!acessoLiberado) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
        <div className="text-4xl mb-3">🔒</div>
        <div className="text-white font-bold mb-1">Acesso restrito</div>
        <div className="text-gray-400 text-sm">Essa área é visível apenas para administração e gerência.</div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-white text-lg font-bold">Financeiro</h2>
          <p className="text-gray-500 text-sm">Controle de entradas e saídas</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setModalBoleto(true)}
            className="bg-purple-800 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
            + Novo boleto
          </button>
          <button onClick={() => setModalSaida(true)}
            className="bg-red-800 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
            + Registrar saída
          </button>
        </div>
      </div>

      <div className="flex gap-3 mb-6 flex-wrap">
        <input type="month" value={mes} onChange={e => setMes(e.target.value)}
          className="bg-gray-900 border border-gray-800 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" />
        <select value={filtroClinica} onChange={e => setFiltroClinica(e.target.value)}
          className="bg-gray-900 border border-gray-800 text-white rounded-lg px-3 py-2 text-sm focus:outline-none">
          <option value="">Todas as clínicas</option>
          {clinicas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      </div>

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

      <div className="flex gap-2 mb-4 flex-wrap">
        <button onClick={() => setAbaAtiva('resumo')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${abaAtiva === 'resumo' ? 'bg-purple-900 text-purple-300' : 'bg-gray-900 text-gray-400 hover:text-white'}`}>
          🏥 Por clínica
        </button>
        <button onClick={() => setAbaAtiva('entradas')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${abaAtiva === 'entradas' ? 'bg-green-900 text-green-300' : 'bg-gray-900 text-gray-400 hover:text-white'}`}>
          📈 Entradas ({entradasFiltradas.length})
        </button>
        <button onClick={() => setAbaAtiva('saidas')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${abaAtiva === 'saidas' ? 'bg-red-900 text-red-300' : 'bg-gray-900 text-gray-400 hover:text-white'}`}>
          📉 Saídas ({saidasFiltradas.length})
        </button>
        <button onClick={() => setAbaAtiva('dentistas')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${abaAtiva === 'dentistas' ? 'bg-yellow-900 text-yellow-300' : 'bg-gray-900 text-gray-400 hover:text-white'}`}>
          👨‍⚕️ Por dentista ({resumoDentistas.length})
        </button>
        <button onClick={() => setAbaAtiva('boletos')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${abaAtiva === 'boletos' ? 'bg-purple-900 text-purple-300' : 'bg-gray-900 text-gray-400 hover:text-white'}`}>
          🧾 Boletos ({boletosPorGrupo.length})
        </button>
      </div>

      {loading ? (
        <div className="text-gray-400 text-center p-8">Carregando...</div>
      ) : abaAtiva === 'resumo' ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left text-gray-500 text-xs px-4 py-3">Clínica</th>
                <th className="text-right text-gray-500 text-xs px-4 py-3">Entradas</th>
                <th className="text-right text-gray-500 text-xs px-4 py-3">Comissões</th>
                <th className="text-right text-gray-500 text-xs px-4 py-3">Saídas</th>
                <th className="text-right text-gray-500 text-xs px-4 py-3">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {resumoClinicas.porClinica.map((c, i) => (
                <tr key={i} className="border-b border-gray-800">
                  <td className="px-4 py-3 text-white text-sm font-medium">🏥 {c.nome}</td>
                  <td className="px-4 py-3 text-right text-green-400 text-sm">{fmt(c.entradas)}</td>
                  <td className="px-4 py-3 text-right text-yellow-400 text-sm">{fmt(c.comissoes)}</td>
                  <td className="px-4 py-3 text-right text-red-400 text-sm">{fmt(c.saidas)}</td>
                  <td className={`px-4 py-3 text-right text-sm font-semibold ${c.saldo >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmt(c.saldo)}</td>
                </tr>
              ))}
              <tr className="border-b border-gray-800 bg-gray-800/30">
                <td className="px-4 py-3 text-gray-400 text-sm">💸 Despesas gerais (todas as clínicas)</td>
                <td className="px-4 py-3 text-right text-gray-600 text-sm">—</td>
                <td className="px-4 py-3 text-right text-gray-600 text-sm">—</td>
                <td className="px-4 py-3 text-right text-red-400 text-sm">{fmt(resumoClinicas.saidasGerais)}</td>
                <td className="px-4 py-3 text-right text-red-400 text-sm">−{fmt(resumoClinicas.saidasGerais)}</td>
              </tr>
              <tr className="border-t-2 border-gray-700 bg-gray-800/50">
                <td className="px-4 py-3 text-white font-bold text-sm">TOTAL GERAL</td>
                <td className="px-4 py-3 text-right text-green-400 font-bold text-sm">{fmt(resumoClinicas.totalEntradasGeral)}</td>
                <td className="px-4 py-3 text-right text-yellow-400 font-bold text-sm">{fmt(resumoClinicas.totalComissoesGeral)}</td>
                <td className="px-4 py-3 text-right text-red-400 font-bold text-sm">{fmt(resumoClinicas.totalSaidasEspecificasGeral + resumoClinicas.saidasGerais)}</td>
                <td className={`px-4 py-3 text-right font-bold text-sm ${resumoClinicas.saldoGeral >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmt(resumoClinicas.saldoGeral)}</td>
              </tr>
            </tbody>
          </table>
          <div className="px-4 py-3 text-gray-600 text-xs border-t border-gray-800">
            💰 Saldo = o que sobra para o Dr. Thiago (entradas − comissões dos dentistas − saídas). Boletos entram na conta de saídas só quando marcados como pagos no mês.
          </div>
        </div>
      ) : abaAtiva === 'entradas' ? (
        entradasFiltradas.length === 0 ? (
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
                {entradasFiltradas.map((e, i) => (
                  <tr key={e.id} className={i < entradasFiltradas.length - 1 ? 'border-b border-gray-800' : ''}>
                    <td className="px-4 py-3 text-gray-400 text-sm whitespace-nowrap">
                      {new Date(e.data_atendimento).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-4 py-3 text-white text-sm font-medium">{e.pacientes?.nome || '—'}</td>
                    <td className="px-4 py-3 text-gray-400 text-sm">{nomeProcedimento(e)}</td>
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
      ) : abaAtiva === 'saidas' ? (
        saidasFiltradas.length === 0 ? (
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
                {saidasFiltradas.map((s, i) => (
                  <tr key={s.id} className={i < saidasFiltradas.length - 1 ? 'border-b border-gray-800' : ''}>
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
      ) : abaAtiva === 'dentistas' ? (
        resumoDentistas.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
            <div className="text-gray-400">Nenhuma entrada registrada neste período</div>
          </div>
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left text-gray-500 text-xs px-4 py-3">Dentista</th>
                  <th className="text-center text-gray-500 text-xs px-4 py-3">Atendimentos</th>
                  <th className="text-right text-gray-500 text-xs px-4 py-3">Total produzido</th>
                  <th className="text-right text-gray-500 text-xs px-4 py-3">Comissão a pagar</th>
                  <th className="text-right text-gray-500 text-xs px-4 py-3">Líquido clínica</th>
                </tr>
              </thead>
              <tbody>
                {resumoDentistas.sort((a, b) => b.total - a.total).map((d, i) => (
                  <tr key={i} className={i < resumoDentistas.length - 1 ? 'border-b border-gray-800' : ''}>
                    <td className="px-4 py-3 text-white text-sm font-medium">👨‍⚕️ {d.nome}</td>
                    <td className="px-4 py-3 text-center text-gray-400 text-sm">{d.qtd}</td>
                    <td className="px-4 py-3 text-right text-green-400 text-sm font-semibold">{fmt(d.total)}</td>
                    <td className="px-4 py-3 text-right text-yellow-400 text-sm font-semibold">{fmt(d.comissao)}</td>
                    <td className="px-4 py-3 text-right text-white text-sm font-semibold">{fmt(d.total - d.comissao)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-gray-700 bg-gray-800/50">
                  <td className="px-4 py-3 text-white font-bold text-sm">Total</td>
                  <td className="px-4 py-3 text-center text-white font-bold text-sm">{resumoDentistas.reduce((a, d) => a + d.qtd, 0)}</td>
                  <td className="px-4 py-3 text-right text-green-400 font-bold text-sm">{fmt(totalEntradas)}</td>
                  <td className="px-4 py-3 text-right text-yellow-400 font-bold text-sm">{fmt(totalComissoes)}</td>
                  <td className="px-4 py-3 text-right text-green-400 font-bold text-sm">{fmt(totalEntradas - totalComissoes)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )
      ) : (
        /* Aba Boletos */
        <div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="text-gray-500 text-xs mb-2">🧾 Total a vencer (todos os boletos)</div>
              <div className="text-red-400 text-xl font-bold">{fmt(totalBoletosAVencer)}</div>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="text-gray-500 text-xs mb-2">📅 Total por mês</div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                {boletosPorMes.length === 0 ? (
                  <span className="text-gray-600 text-sm">Nenhum boleto pendente</span>
                ) : boletosPorMes.map(([chave, valor]) => (
                  <span key={chave} className="text-gray-300 text-xs">
                    <span className="text-gray-500">{nomeMes(chave)}:</span> <span className="font-semibold text-red-400">{fmt(valor)}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {boletosPorGrupo.length === 0 ? (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
              <div className="text-gray-400">Nenhum boleto cadastrado</div>
            </div>
          ) : (
            <div className="space-y-3">
              {boletosPorGrupo.map((grupo, gi) => (
                <div key={gi} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-gray-800/30">
                    <div>
                      <span className="text-white font-bold text-sm">{grupo.fornecedor}</span>
                      {grupo.descricao && <span className="text-gray-500 text-xs ml-2">{grupo.descricao}</span>}
                      {grupo.clinica && <span className="text-gray-500 text-xs ml-2">· 🏥 {grupo.clinica}</span>}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-gray-400 text-xs">Total: <span className="text-white font-semibold">{fmt(grupo.totalGrupo)}</span></span>
                      <span className="text-gray-400 text-xs">A vencer: <span className="text-red-400 font-semibold">{fmt(grupo.totalAVencerGrupo)}</span></span>
                      <button onClick={() => excluirGrupoBoleto(grupo.parcelas[0].grupo_id)}
                        className="text-xs bg-red-900/30 hover:bg-red-900/50 text-red-400 px-2 py-1 rounded transition-colors">
                        🗑️
                      </button>
                    </div>
                  </div>
                  <table className="w-full">
                    <tbody>
                      {grupo.parcelas.map((p: any) => (
                        <tr key={p.id} className="border-b border-gray-800 last:border-b-0">
                          <td className="px-4 py-2 text-gray-400 text-sm w-20">{p.numero_parcela}/{p.total_parcelas}</td>
                          <td className="px-4 py-2 text-gray-400 text-sm">
                            {new Date(p.vencimento + 'T12:00:00').toLocaleDateString('pt-BR')}
                          </td>
                          <td className="px-4 py-2 text-right text-white text-sm font-semibold">{fmt(p.valor)}</td>
                          <td className="px-4 py-2 text-right w-32">
                            <label className="flex items-center justify-end gap-1.5 text-xs text-gray-400 cursor-pointer">
                              <input type="checkbox" checked={p.pago} onChange={() => alternarPagoBoleto(p.id, p.pago)}
                                className="accent-purple-600" />
                              {p.pago ? <span className="text-green-400 font-semibold">Pago</span> : 'A vencer'}
                            </label>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}
        </div>
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
                  placeholder="Ex: Aluguel, Material odontológico..."
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

      {/* MODAL BOLETO */}
      {modalBoleto && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-800">
              <h3 className="text-white font-bold">Novo Boleto</h3>
              <button onClick={() => setModalBoleto(false)} className="text-gray-500 hover:text-white text-xl">×</button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="text-gray-400 text-xs block mb-1">Fornecedor *</label>
                <input value={formBoleto.fornecedor} onChange={e => setFormBoleto({...formBoleto, fornecedor: e.target.value})}
                  placeholder="Ex: Neodent, Medodent..."
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" />
              </div>
              <div>
                <label className="text-gray-400 text-xs block mb-1">Descrição</label>
                <input value={formBoleto.descricao} onChange={e => setFormBoleto({...formBoleto, descricao: e.target.value})}
                  placeholder="Ex: Compra de implantes"
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Valor por parcela (R$) *</label>
                  <input type="number" step="0.01" placeholder="0,00" value={formBoleto.valor}
                    onChange={e => setFormBoleto({...formBoleto, valor: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Número de parcelas *</label>
                  <input type="number" min="1" placeholder="Ex: 4" value={formBoleto.total_parcelas}
                    onChange={e => setFormBoleto({...formBoleto, total_parcelas: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Vencimento da 1ª parcela *</label>
                  <input type="date" value={formBoleto.vencimento_inicial}
                    onChange={e => setFormBoleto({...formBoleto, vencimento_inicial: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Clínica (opcional)</label>
                  <select value={formBoleto.clinica_id} onChange={e => setFormBoleto({...formBoleto, clinica_id: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none">
                    <option value="">Geral</option>
                    {clinicas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>
              </div>
              {formBoleto.valor && formBoleto.total_parcelas && (
                <div className="bg-purple-900/20 border border-purple-800/40 rounded-lg p-3 text-xs">
                  <div className="text-purple-400 font-semibold">
                    Total do boleto: {(parseFloat(formBoleto.valor) * parseInt(formBoleto.total_parcelas || '0')).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </div>
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <button onClick={() => setModalBoleto(false)}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors">
                  Cancelar
                </button>
                <button onClick={salvarBoleto} disabled={salvando}
                  className="flex-1 bg-purple-800 hover:bg-purple-700 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50">
                  {salvando ? 'Salvando...' : 'Salvar boleto'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}