import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const FICHA_SAUDE_CAMPOS = [
  { key: 'uso_medicamento', label: 'Uso de medicamento' },
  { key: 'hemorragia', label: 'Hemorragia' },
  { key: 'cardiaco', label: 'Cardíaco' },
  { key: 'diabetico', label: 'Diabético' },
  { key: 'protese', label: 'Prótese' },
  { key: 'pressao_alta', label: 'Pressão alta' },
  { key: 'pressao_baixa', label: 'Pressão baixa' },
  { key: 'gestante', label: 'Gestante' },
]

const STATUS_TRATAMENTO = [
  { value: 'em_andamento', label: 'Em andamento', cor: 'bg-blue-900/30 text-blue-400 border-blue-800' },
  { value: 'quitado', label: 'Quitado', cor: 'bg-green-900/30 text-green-400 border-green-800' },
  { value: 'concluido', label: 'Concluído', cor: 'bg-gray-800 text-gray-400 border-gray-700' },
  { value: 'inativo', label: 'Inativo', cor: 'bg-red-900/30 text-red-400 border-red-800' },
]

function getStatusConfig(status: string) {
  return STATUS_TRATAMENTO.find(s => s.value === status) ?? STATUS_TRATAMENTO[0]
}

// Aplica máscara dd/mm/aaaa enquanto o usuário digita (só números)
function aplicarMascaraData(valor: string): string {
  const digitos = valor.replace(/\D/g, '').slice(0, 8)
  if (digitos.length <= 2) return digitos
  if (digitos.length <= 4) return `${digitos.slice(0, 2)}/${digitos.slice(2)}`
  return `${digitos.slice(0, 2)}/${digitos.slice(2, 4)}/${digitos.slice(4)}`
}

// Converte dd/mm/aaaa (texto digitado) para aaaa-mm-dd (formato do banco). Retorna null se incompleto/inválido.
function dataParaISO(dataBR: string): string | null {
  const match = dataBR.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!match) return null
  const [, dia, mes, ano] = match
  const diaNum = parseInt(dia), mesNum = parseInt(mes), anoNum = parseInt(ano)
  if (mesNum < 1 || mesNum > 12 || diaNum < 1 || diaNum > 31 || anoNum < 1900) return null
  return `${ano}-${mes}-${dia}`
}

// Converte aaaa-mm-dd (do banco) para dd/mm/aaaa (exibição no formulário de edição)
function dataParaBR(dataISO: string): string {
  if (!dataISO) return ''
  const [ano, mes, dia] = dataISO.split('-')
  if (!ano || !mes || !dia) return ''
  return `${dia}/${mes}/${ano}`
}

export default function Pacientes() {
  const [pacientes, setPacientes] = useState<any[]>([])
  const [clinicas, setClinicas] = useState<any[]>([])
  const [dentistas, setDentistas] = useState<any[]>([])
  const [procedimentos, setProcedimentos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [modalAberto, setModalAberto] = useState(false)
  const [pacienteSelecionado, setPacienteSelecionado] = useState<any>(null)
  const [prontuario, setProntuario] = useState<any[]>([])
  const [novoModalAberto, setNovoModalAberto] = useState(false)
  const [novoProntuarioAberto, setNovoProntuarioAberto] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [salvandoFicha, setSalvandoFicha] = useState(false)
  const [abaAtiva, setAbaAtiva] = useState<'dados'|'saude'|'prontuario'>('dados')
  const [fichaSaude, setFichaSaude] = useState<any>({})
  const [fichaObs, setFichaObs] = useState('')
  const [clinicaIdUsuario, setClinicaIdUsuario] = useState<string | null>(null)
  const [perfilAdmin, setPerfilAdmin] = useState(true)
  const [statusTratamento, setStatusTratamento] = useState('em_andamento')
  const [editandoDados, setEditandoDados] = useState(false)
  const [salvandoEdicao, setSalvandoEdicao] = useState(false)
  const [formEdicao, setFormEdicao] = useState({
    nome: '', telefone: '', telefone_fixo: '', email: '', cpf: '', rg: '',
    data_nascimento: '', naturalidade: '', bairro: '', cidade: '',
    endereco: '', filiacao_pai: '', filiacao_mae: '',
    clinica_id: '', dentista_id: '', observacoes_clinicas: ''
  })

  const [form, setForm] = useState({
    nome: '', telefone: '', telefone_fixo: '', email: '', cpf: '', rg: '',
    data_nascimento: '', naturalidade: '', bairro: '', cidade: '',
    endereco: '', filiacao_pai: '', filiacao_mae: '',
    clinica_id: '', dentista_id: '', observacoes_clinicas: ''
  })

  const [formProntuario, setFormProntuario] = useState({
    data_procedimento: new Date().toISOString().split('T')[0],
    quantidade: 1, tratamento: '', dentista_id: '', valor: '',
    data_pagamento: '', valor_pago: '', forma_pagamento: '', observacoes: '', orcamento_aprovado: '',
  })

  const [editandoProntuarioAberto, setEditandoProntuarioAberto] = useState(false)
  const [tipoTratamentoSelecionado, setTipoTratamentoSelecionado] = useState('')
  const [formProntuarioEdicao, setFormProntuarioEdicao] = useState({
    id: '', data_procedimento: '', quantidade: 1, tratamento: '', dentista_id: '',
    valor: '', data_pagamento: '', valor_pago: '', forma_pagamento: '', observacoes: '',
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

  useEffect(() => { carregar() }, [])

  async function carregar() {
    const [{ data: p }, { data: c }, { data: d }, { data: pr }] = await Promise.all([
      supabase.from('pacientes').select('*, clinicas(nome), dentistas(nome)').order('nome'),
      supabase.from('clinicas').select('*'),
      supabase.from('dentistas').select('*'),
      supabase.from('procedimentos').select('*').order('nome')
    ])
    if (p) setPacientes(p)
    if (c) setClinicas(c)
    if (d) setDentistas(d)
    if (pr) setProcedimentos(pr)
    setLoading(false)
  }

  async function abrirFicha(p: any) {
    setPacienteSelecionado(p)
    setAbaAtiva('dados')
    setEditandoDados(false)
    setFichaSaude(p.ficha_saude || {})
    setFichaObs(p.ficha_saude?.observacoes || '')
    setStatusTratamento(p.status_tratamento || 'em_andamento')
    const { data } = await supabase.from('prontuario').select('*, dentistas(nome)').eq('paciente_id', p.id).order('data_procedimento', { ascending: true })
    if (data) setProntuario(data)
    setModalAberto(true)
  }

  function iniciarEdicaoDados() {
    setFormEdicao({
      nome: pacienteSelecionado.nome || '',
      telefone: pacienteSelecionado.telefone || '',
      telefone_fixo: pacienteSelecionado.telefone_fixo || '',
      email: pacienteSelecionado.email || '',
      cpf: pacienteSelecionado.cpf || '',
      rg: pacienteSelecionado.rg || '',
      data_nascimento: dataParaBR(pacienteSelecionado.data_nascimento || ''),
      naturalidade: pacienteSelecionado.naturalidade || '',
      bairro: pacienteSelecionado.bairro || '',
      cidade: pacienteSelecionado.cidade || '',
      endereco: pacienteSelecionado.endereco || '',
      filiacao_pai: pacienteSelecionado.filiacao_pai || '',
      filiacao_mae: pacienteSelecionado.filiacao_mae || '',
      clinica_id: pacienteSelecionado.clinica_id || '',
      dentista_id: pacienteSelecionado.dentista_id || '',
      observacoes_clinicas: pacienteSelecionado.observacoes_clinicas || '',
    })
    setEditandoDados(true)
  }

  async function salvarEdicaoDados() {
    if (!formEdicao.nome || !formEdicao.telefone) return alert('Nome e telefone são obrigatórios!')
    if (formEdicao.data_nascimento && !dataParaISO(formEdicao.data_nascimento))
      return alert('Data de nascimento inválida! Use o formato dd/mm/aaaa.')
    setSalvandoEdicao(true)
    const dataNascISO = formEdicao.data_nascimento ? dataParaISO(formEdicao.data_nascimento) : null
    const { error } = await supabase.from('pacientes').update({
      ...formEdicao, data_nascimento: dataNascISO,
      clinica_id: formEdicao.clinica_id || null, dentista_id: formEdicao.dentista_id || null,
    }).eq('id', pacienteSelecionado.id)
    if (error) { alert('Erro: ' + error.message); setSalvandoEdicao(false); return }
    const clinicaObj = clinicas.find(c => c.id === formEdicao.clinica_id)
    const dentistaObj = dentistas.find(d => d.id === formEdicao.dentista_id)
    const atualizado = { ...pacienteSelecionado, ...formEdicao, data_nascimento: dataNascISO, clinicas: clinicaObj ? { nome: clinicaObj.nome } : null, dentistas: dentistaObj ? { nome: dentistaObj.nome } : null }
    setPacienteSelecionado(atualizado)
    setPacientes(prev => prev.map(p => p.id === pacienteSelecionado.id ? atualizado : p))
    setEditandoDados(false)
    setSalvandoEdicao(false)
  }

  async function excluirPaciente() {
    const confirmar = confirm(`Tem certeza que deseja excluir o paciente "${pacienteSelecionado.nome}"? Essa ação não pode ser desfeita.`)
    if (!confirmar) return
    const { error } = await supabase.from('pacientes').delete().eq('id', pacienteSelecionado.id)
    if (error) {
      // Erro comum: paciente já tem atendimentos, prontuário ou implantes vinculados
      if (error.message.includes('foreign key') || error.code === '23503') {
        alert('Não foi possível excluir: esse paciente já tem atendimentos, prontuário ou implantes registrados. Remova esses registros primeiro, ou avise a Paulina para excluir manualmente no banco de dados.')
      } else {
        alert('Erro ao excluir: ' + error.message)
      }
      return
    }
    setPacientes(prev => prev.filter(p => p.id !== pacienteSelecionado.id))
    setModalAberto(false)
    setPacienteSelecionado(null)
  }

  async function salvarFichaSaude() {
    setSalvandoFicha(true)
    const novaFicha = { ...fichaSaude, observacoes: fichaObs }
    await supabase.from('pacientes').update({ ficha_saude: novaFicha }).eq('id', pacienteSelecionado.id)
    setPacienteSelecionado({ ...pacienteSelecionado, ficha_saude: novaFicha })
    setSalvandoFicha(false)
    alert('Ficha de saúde salva!')
  }

  async function salvarStatusTratamento(novoStatus: string) {
    setStatusTratamento(novoStatus)
    await supabase.from('pacientes').update({ status_tratamento: novoStatus }).eq('id', pacienteSelecionado.id)
    setPacienteSelecionado({ ...pacienteSelecionado, status_tratamento: novoStatus })
    setPacientes(prev => prev.map(p => p.id === pacienteSelecionado.id ? { ...p, status_tratamento: novoStatus } : p))
  }

  async function salvarPaciente() {
    if (!form.nome || !form.telefone) return alert('Nome e telefone são obrigatórios!')
    if (form.data_nascimento && !dataParaISO(form.data_nascimento))
      return alert('Data de nascimento inválida! Use o formato dd/mm/aaaa.')
    setSalvando(true)
    const dataNascISO = form.data_nascimento ? dataParaISO(form.data_nascimento) : null
    const { error } = await supabase.from('pacientes').insert([{
      ...form, data_nascimento: dataNascISO,
      clinica_id: form.clinica_id || null, dentista_id: form.dentista_id || null,
      status_tratamento: 'em_andamento',
    }])
    if (error) { alert('Erro: ' + error.message); setSalvando(false); return }
    setNovoModalAberto(false)
    setForm({ nome: '', telefone: '', telefone_fixo: '', email: '', cpf: '', rg: '', data_nascimento: '', naturalidade: '', bairro: '', cidade: '', endereco: '', filiacao_pai: '', filiacao_mae: '', clinica_id: clinicaIdUsuario || '', dentista_id: '', observacoes_clinicas: '' })
    await carregar()
    setSalvando(false)
  }

  async function salvarProntuario() {
    if (!formProntuario.tratamento || !formProntuario.valor) return alert('Tratamento e valor são obrigatórios!')
    setSalvando(true)
    const valorTotal = parseFloat(formProntuario.valor) || 0
    const valorPago = parseFloat(formProntuario.valor_pago) || 0
    const deve = valorTotal - valorPago
    const prontuarioOrdenado = [...prontuario].sort((a, b) => new Date(a.data_procedimento).getTime() - new Date(b.data_procedimento).getTime())
    const ultimoRegistro = prontuarioOrdenado[prontuarioOrdenado.length - 1]
    const somaAnterior = ultimoRegistro ? parseFloat(ultimoRegistro.soma_acumulada) || 0 : 0
    const somaAcumulada = somaAnterior + deve

    const dentistaId = formProntuario.dentista_id || pacienteSelecionado.dentista_id

    const { error } = await supabase.from('prontuario').insert([{
      paciente_id: pacienteSelecionado.id,
      clinica_id: pacienteSelecionado.clinica_id,
      dentista_id: dentistaId,
      data_procedimento: formProntuario.data_procedimento,
      quantidade: formProntuario.quantidade,
      tratamento: formProntuario.tratamento,
      valor: valorTotal, soma_acumulada: somaAcumulada,
      data_pagamento: formProntuario.data_pagamento || null,
      valor_pago: valorPago, deve,
      forma_pagamento: formProntuario.forma_pagamento || null,
      observacoes: formProntuario.observacoes || null,
    }])
    if (error) { alert('Erro: ' + error.message); setSalvando(false); return }

    // Cria automaticamente o atendimento no financeiro (se tiver valor pago)
    if (valorPago > 0 && formProntuario.forma_pagamento) {
      const pctComissao = (formProntuario.forma_pagamento === 'Dinheiro' || formProntuario.forma_pagamento === 'Cheque') ? 40 : 36
      const comissaoValor = valorPago * pctComissao / 100
      await supabase.from('atendimentos').insert([{
        paciente_id: pacienteSelecionado.id,
        clinica_id: pacienteSelecionado.clinica_id,
        dentista_id: dentistaId,
        data_atendimento: formProntuario.data_pagamento || formProntuario.data_procedimento,
        valor: valorPago,
        forma_pagamento: formProntuario.forma_pagamento,
        comissao_percentual: pctComissao,
        comissao_valor: comissaoValor,
        observacoes: 'Prontuario: ' + formProntuario.tratamento,
      }])
    }
    setNovoProntuarioAberto(false)
    setTipoTratamentoSelecionado('')
    setFormProntuario({ data_procedimento: new Date().toISOString().split('T')[0], quantidade: 1, tratamento: '', dentista_id: '', valor: '', data_pagamento: '', valor_pago: '', forma_pagamento: '', observacoes: '', orcamento_aprovado: '' })
    const { data } = await supabase.from('prontuario').select('*, dentistas(nome)').eq('paciente_id', pacienteSelecionado.id).order('data_procedimento', { ascending: true })
    if (data) setProntuario(data)
    setSalvando(false)
  }

  function abrirEdicaoProntuario(r: any) {
    setFormProntuarioEdicao({
      id: r.id,
      data_procedimento: r.data_procedimento || new Date().toISOString().split('T')[0],
      quantidade: r.quantidade || 1,
      tratamento: r.tratamento || '',
      dentista_id: r.dentista_id || '',
      valor: r.valor != null ? String(r.valor) : '',
      data_pagamento: r.data_pagamento || '',
      valor_pago: r.valor_pago != null ? String(r.valor_pago) : '',
      forma_pagamento: r.forma_pagamento || '',
      observacoes: r.observacoes || '',
    })
    setEditandoProntuarioAberto(true)
  }

  async function salvarEdicaoProntuario() {
    if (!formProntuarioEdicao.tratamento || !formProntuarioEdicao.valor) return alert('Tratamento e valor são obrigatórios!')
    setSalvando(true)
    const valorTotal = parseFloat(formProntuarioEdicao.valor) || 0
    const valorPago = parseFloat(formProntuarioEdicao.valor_pago) || 0
    const deve = valorTotal - valorPago

    const { error } = await supabase.from('prontuario').update({
      data_procedimento: formProntuarioEdicao.data_procedimento,
      quantidade: formProntuarioEdicao.quantidade,
      tratamento: formProntuarioEdicao.tratamento,
      dentista_id: formProntuarioEdicao.dentista_id || null,
      valor: valorTotal,
      data_pagamento: formProntuarioEdicao.data_pagamento || null,
      valor_pago: valorPago,
      deve,
      forma_pagamento: formProntuarioEdicao.forma_pagamento || null,
      observacoes: formProntuarioEdicao.observacoes || null,
    }).eq('id', formProntuarioEdicao.id)
    if (error) { alert('Erro: ' + error.message); setSalvando(false); return }

    setEditandoProntuarioAberto(false)
    const { data } = await supabase.from('prontuario').select('*, dentistas(nome)').eq('paciente_id', pacienteSelecionado.id).order('data_procedimento', { ascending: true })
    if (data) setProntuario(data)
    setSalvando(false)
  }

  function calcularIdade(dataNasc: string) {
    if (!dataNasc) return null
    const hoje = new Date(); const nasc = new Date(dataNasc)
    let idade = hoje.getFullYear() - nasc.getFullYear()
    const m = hoje.getMonth() - nasc.getMonth()
    if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--
    return idade
  }

  function iniciais(nome: string) {
    return nome.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
  }

  function fmt(v: number) {
    return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  const pacientesFiltrados = pacientes.filter(p => {
    const clinicaOk = perfilAdmin || p.clinica_id === clinicaIdUsuario
    const buscaOk = p.nome.toLowerCase().includes(busca.toLowerCase()) ||
      (p.telefone && p.telefone.includes(busca)) ||
      (p.clinicas?.nome && p.clinicas.nome.toLowerCase().includes(busca.toLowerCase()))
    const statusOk = !filtroStatus || (p.status_tratamento || 'em_andamento') === filtroStatus
    return clinicaOk && buscaOk && statusOk
  })

  const totalDeve = prontuario.reduce((acc, r) => acc + (parseFloat(r.deve) || 0), 0)
  const totalPago = prontuario.reduce((acc, r) => acc + (parseFloat(r.valor_pago) || 0), 0)
  const totalGasto = prontuario.reduce((acc, r) => acc + (parseFloat(r.valor) || 0), 0)
  const alertasSaude = FICHA_SAUDE_CAMPOS.filter(c => fichaSaude[c.key] === true).map(c => c.label)

  let somaAcum = 0
  const prontuarioComSoma = prontuario.map(r => {
    somaAcum += parseFloat(r.deve) || 0
    return { ...r, soma_calculada: somaAcum }
  })

  // Contagem por status (respeita a restrição de clínica da secretária)
  const pacientesDaClinica = perfilAdmin ? pacientes : pacientes.filter(p => p.clinica_id === clinicaIdUsuario)
  const contagemStatus = STATUS_TRATAMENTO.map(s => ({
    ...s,
    qtd: pacientesDaClinica.filter(p => (p.status_tratamento || 'em_andamento') === s.value).length
  }))

  if (loading) return <div className="text-gray-400">Carregando...</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-white text-lg font-bold">Pacientes / CRM</h2>
          <p className="text-gray-500 text-sm">{pacientesDaClinica.length} pacientes · {pacientesFiltrados.length} exibidos</p>
        </div>
        <button onClick={() => setNovoModalAberto(true)}
          className="bg-verde-600 hover:bg-verde-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
          + Novo paciente
        </button>
      </div>

      {/* Cards de status */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        {contagemStatus.map(s => (
          <button key={s.value}
            onClick={() => setFiltroStatus(filtroStatus === s.value ? '' : s.value)}
            className={`rounded-xl border p-3 text-center transition-colors ${filtroStatus === s.value ? s.cor + ' ring-2 ring-offset-1 ring-offset-gray-950' : 'bg-gray-900 border-gray-800 hover:border-gray-700'}`}>
            <div className={`text-2xl font-bold ${filtroStatus === s.value ? '' : 'text-white'}`}>{s.qtd}</div>
            <div className={`text-xs font-medium ${filtroStatus === s.value ? '' : 'text-gray-500'}`}>{s.label}</div>
          </button>
        ))}
      </div>

      <input type="text" placeholder="🔍  Buscar por nome, telefone ou clínica..."
        value={busca} onChange={e => setBusca(e.target.value)}
        className="w-full bg-gray-900 border border-gray-800 text-white rounded-xl px-4 py-3 text-sm mb-4 focus:outline-none focus:border-verde-600" />

      {filtroStatus && (
        <div className="flex items-center gap-2 mb-3">
          <span className="text-gray-400 text-xs">Filtrando por:</span>
          <span className={`text-xs px-2 py-0.5 rounded border font-medium ${getStatusConfig(filtroStatus).cor}`}>
            {getStatusConfig(filtroStatus).label}
          </span>
          <button onClick={() => setFiltroStatus('')} className="text-gray-500 hover:text-white text-xs">× limpar</button>
        </div>
      )}

      {pacientesFiltrados.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
          <div className="text-4xl mb-3">👥</div>
          <div className="text-gray-400 font-medium">Nenhum paciente encontrado</div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {pacientesFiltrados.map(p => {
            const alertas = FICHA_SAUDE_CAMPOS.filter(c => p.ficha_saude?.[c.key] === true)
            const stConfig = getStatusConfig(p.status_tratamento || 'em_andamento')
            return (
              <div key={p.id} onClick={() => abrirFicha(p)}
                className="bg-gray-900 border border-gray-800 hover:border-verde-600 rounded-xl p-4 cursor-pointer transition-colors flex items-center gap-3">
                <div className="w-10 h-10 bg-verde-700 rounded-full flex items-center justify-center text-sm font-bold text-verde-300 flex-shrink-0">
                  {iniciais(p.nome)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="text-white font-semibold text-sm truncate">{p.nome}</div>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium flex-shrink-0 ${stConfig.cor}`}>
                      {stConfig.label}
                    </span>
                  </div>
                  <div className="text-gray-500 text-xs mt-0.5">
                    📱 {p.telefone}
                    {p.data_nascimento && ` · 🎂 ${calcularIdade(p.data_nascimento)} anos`}
                  </div>
                  <div className="text-gray-600 text-xs mt-0.5">
                    {p.clinicas?.nome && `🏥 ${p.clinicas.nome}`}
                    {p.dentistas?.nome && ` · 👨‍⚕️ ${p.dentistas.nome}`}
                  </div>
                  {alertas.length > 0 && (
                    <div className="text-yellow-500 text-xs mt-0.5">⚠️ {alertas.map(a => a.label).join(', ')}</div>
                  )}
                </div>
                <div className="text-verde-500 text-xs font-semibold flex-shrink-0">Ver ficha →</div>
              </div>
            )
          })}
        </div>
      )}

      {/* MODAL FICHA */}
      {modalAberto && pacienteSelecionado && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-verde-700 rounded-full flex items-center justify-center text-sm font-bold text-verde-300">
                  {iniciais(pacienteSelecionado.nome)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-white font-bold">{pacienteSelecionado.nome}</h3>
                    <span className={`text-[10px] px-2 py-0.5 rounded border font-medium ${getStatusConfig(statusTratamento).cor}`}>
                      {getStatusConfig(statusTratamento).label}
                    </span>
                  </div>
                  <p className="text-gray-500 text-xs">
                    {pacienteSelecionado.data_nascimento && `${calcularIdade(pacienteSelecionado.data_nascimento)} anos · `}
                    {pacienteSelecionado.clinicas?.nome}
                  </p>
                  {alertasSaude.length > 0 && (
                    <p className="text-yellow-400 text-xs mt-0.5">⚠️ {alertasSaude.join(' · ')}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                {/* Seletor de status */}
                <select value={statusTratamento} onChange={e => salvarStatusTratamento(e.target.value)}
                  className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-1.5 text-xs focus:outline-none">
                  {STATUS_TRATAMENTO.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
                <button onClick={() => setModalAberto(false)} className="text-gray-500 hover:text-white text-xl">×</button>
              </div>
            </div>

            {/* Abas */}
            <div className="flex border-b border-gray-800">
              <button onClick={() => setAbaAtiva('dados')}
                className={`px-5 py-3 text-sm font-semibold transition-colors ${abaAtiva === 'dados' ? 'text-verde-400 border-b-2 border-verde-500' : 'text-gray-500 hover:text-white'}`}>
                📋 Dados pessoais
              </button>
              <button onClick={() => setAbaAtiva('saude')}
                className={`px-5 py-3 text-sm font-semibold transition-colors ${abaAtiva === 'saude' ? 'text-verde-400 border-b-2 border-verde-500' : 'text-gray-500 hover:text-white'}`}>
                🏥 Ficha de saúde {alertasSaude.length > 0 && <span className="ml-1 bg-yellow-600 text-white text-xs px-1.5 py-0.5 rounded-full">{alertasSaude.length}</span>}
              </button>
              <button onClick={() => setAbaAtiva('prontuario')}
                className={`px-5 py-3 text-sm font-semibold transition-colors ${abaAtiva === 'prontuario' ? 'text-verde-400 border-b-2 border-verde-500' : 'text-gray-500 hover:text-white'}`}>
                🦷 Prontuário ({prontuario.length})
              </button>
            </div>

            <div className="p-5">
              {/* ABA DADOS */}
              {abaAtiva === 'dados' && !editandoDados && (
                <div className="space-y-3">
                  <div className="flex justify-end gap-2">
                    {perfilAdmin && (
                      <button onClick={excluirPaciente}
                        className="bg-red-900/30 hover:bg-red-900/50 border border-red-800 text-red-400 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">
                        🗑️ Excluir paciente
                      </button>
                    )}
                    <button onClick={iniciarEdicaoDados}
                      className="bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">
                      ✏️ Editar dados
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Celular', value: pacienteSelecionado.telefone },
                      { label: 'Telefone fixo', value: pacienteSelecionado.telefone_fixo },
                      { label: 'E-mail', value: pacienteSelecionado.email },
                      { label: 'CPF', value: pacienteSelecionado.cpf },
                      { label: 'RG', value: pacienteSelecionado.rg },
                      { label: 'Nascimento', value: pacienteSelecionado.data_nascimento ? new Date(pacienteSelecionado.data_nascimento).toLocaleDateString('pt-BR') : null },
                      { label: 'Naturalidade', value: pacienteSelecionado.naturalidade },
                      { label: 'Bairro', value: pacienteSelecionado.bairro },
                      { label: 'Cidade', value: pacienteSelecionado.cidade },
                    ].map(f => (
                      <div key={f.label} className="bg-gray-800 rounded-lg p-3">
                        <div className="text-gray-500 text-xs mb-1">{f.label}</div>
                        <div className="text-white text-sm">{f.value || '—'}</div>
                      </div>
                    ))}
                    <div className="bg-gray-800 rounded-lg p-3 col-span-3">
                      <div className="text-gray-500 text-xs mb-1">Endereço</div>
                      <div className="text-white text-sm">{pacienteSelecionado.endereco || '—'}</div>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-3">
                      <div className="text-gray-500 text-xs mb-1">Filiação — Pai</div>
                      <div className="text-white text-sm">{pacienteSelecionado.filiacao_pai || '—'}</div>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-3 col-span-2">
                      <div className="text-gray-500 text-xs mb-1">Filiação — Mãe</div>
                      <div className="text-white text-sm">{pacienteSelecionado.filiacao_mae || '—'}</div>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-3">
                      <div className="text-gray-500 text-xs mb-1">Clínica</div>
                      <div className="text-white text-sm">{pacienteSelecionado.clinicas?.nome || '—'}</div>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-3 col-span-2">
                      <div className="text-gray-500 text-xs mb-1">Dentista</div>
                      <div className="text-white text-sm">{pacienteSelecionado.dentistas?.nome || '—'}</div>
                    </div>
                  </div>
                  {pacienteSelecionado.observacoes_clinicas && (
                    <div className="bg-yellow-900/20 border border-yellow-700/40 rounded-lg p-3">
                      <div className="text-yellow-400 text-xs font-semibold mb-1">⚠️ Observações clínicas</div>
                      <div className="text-gray-300 text-sm">{pacienteSelecionado.observacoes_clinicas}</div>
                    </div>
                  )}
                  <a href={`https://wa.me/55${pacienteSelecionado.telefone?.replace(/\D/g,'')}`}
                    target="_blank" rel="noreferrer"
                    className="w-full bg-green-700 hover:bg-green-600 text-white text-sm font-semibold py-2.5 rounded-lg text-center transition-colors block">
                    💬 Abrir WhatsApp
                  </a>
                </div>
              )}

              {/* ABA DADOS — MODO EDIÇÃO */}
              {abaAtiva === 'dados' && editandoDados && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="text-gray-400 text-xs block mb-1">Nome completo *</label>
                      <input value={formEdicao.nome} onChange={e => setFormEdicao({...formEdicao, nome: e.target.value})}
                        className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-gray-400 text-xs block mb-1">Celular *</label>
                      <input value={formEdicao.telefone} onChange={e => setFormEdicao({...formEdicao, telefone: e.target.value})}
                        className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-gray-400 text-xs block mb-1">Telefone fixo</label>
                      <input value={formEdicao.telefone_fixo} onChange={e => setFormEdicao({...formEdicao, telefone_fixo: e.target.value})}
                        className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-gray-400 text-xs block mb-1">E-mail</label>
                      <input value={formEdicao.email} onChange={e => setFormEdicao({...formEdicao, email: e.target.value})}
                        className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-gray-400 text-xs block mb-1">CPF</label>
                      <input value={formEdicao.cpf} onChange={e => setFormEdicao({...formEdicao, cpf: e.target.value})}
                        className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-gray-400 text-xs block mb-1">RG</label>
                      <input value={formEdicao.rg} onChange={e => setFormEdicao({...formEdicao, rg: e.target.value})}
                        className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-gray-400 text-xs block mb-1">Data de nascimento</label>
                      <input type="text" inputMode="numeric" placeholder="dd/mm/aaaa" maxLength={10}
                        value={formEdicao.data_nascimento}
                        onChange={e => setFormEdicao({...formEdicao, data_nascimento: aplicarMascaraData(e.target.value)})}
                        className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-gray-400 text-xs block mb-1">Naturalidade</label>
                      <input value={formEdicao.naturalidade} onChange={e => setFormEdicao({...formEdicao, naturalidade: e.target.value})}
                        className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-gray-400 text-xs block mb-1">Bairro</label>
                      <input value={formEdicao.bairro} onChange={e => setFormEdicao({...formEdicao, bairro: e.target.value})}
                        className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-gray-400 text-xs block mb-1">Cidade</label>
                      <input value={formEdicao.cidade} onChange={e => setFormEdicao({...formEdicao, cidade: e.target.value})}
                        className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" />
                    </div>
                    <div className="col-span-2">
                      <label className="text-gray-400 text-xs block mb-1">Endereço</label>
                      <input value={formEdicao.endereco} onChange={e => setFormEdicao({...formEdicao, endereco: e.target.value})}
                        className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-gray-400 text-xs block mb-1">Filiação — Pai</label>
                      <input value={formEdicao.filiacao_pai} onChange={e => setFormEdicao({...formEdicao, filiacao_pai: e.target.value})}
                        className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-gray-400 text-xs block mb-1">Filiação — Mãe</label>
                      <input value={formEdicao.filiacao_mae} onChange={e => setFormEdicao({...formEdicao, filiacao_mae: e.target.value})}
                        className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-gray-400 text-xs block mb-1">Clínica</label>
                      {perfilAdmin ? (
                        <select value={formEdicao.clinica_id} onChange={e => setFormEdicao({...formEdicao, clinica_id: e.target.value})}
                          className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none">
                          <option value="">Selecione...</option>
                          {clinicas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                        </select>
                      ) : (
                        <div className="bg-gray-800 border border-gray-700 text-gray-300 rounded-lg px-3 py-2 text-sm">
                          {clinicas.find(c => c.id === formEdicao.clinica_id)?.nome}
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="text-gray-400 text-xs block mb-1">Dentista</label>
                      <select value={formEdicao.dentista_id} onChange={e => setFormEdicao({...formEdicao, dentista_id: e.target.value})}
                        className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none">
                        <option value="">Selecione...</option>
                        {dentistas.map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="text-gray-400 text-xs block mb-1">Observações clínicas</label>
                      <textarea value={formEdicao.observacoes_clinicas} onChange={e => setFormEdicao({...formEdicao, observacoes_clinicas: e.target.value})}
                        className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none h-20 resize-none" />
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button onClick={() => setEditandoDados(false)}
                      className="flex-1 bg-gray-800 hover:bg-gray-700 text-white text-sm font-semibold py-2.5 rounded-lg">Cancelar</button>
                    <button onClick={salvarEdicaoDados} disabled={salvandoEdicao}
                      className="flex-1 bg-verde-600 hover:bg-verde-500 text-white text-sm font-semibold py-2.5 rounded-lg disabled:opacity-50">
                      {salvandoEdicao ? 'Salvando...' : 'Salvar alterações'}
                    </button>
                  </div>
                </div>
              )}

              {/* ABA FICHA DE SAÚDE */}
              {abaAtiva === 'saude' && (
                <div className="space-y-4">
                  <p className="text-gray-400 text-sm">Marque as condições de saúde do paciente.</p>
                  <div className="grid grid-cols-2 gap-3">
                    {FICHA_SAUDE_CAMPOS.map(campo => (
                      <label key={campo.key}
                        className={`flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-colors ${fichaSaude[campo.key] ? 'border-yellow-500 bg-yellow-900/20' : 'border-gray-700 bg-gray-800 hover:border-gray-600'}`}>
                        <input type="checkbox" checked={!!fichaSaude[campo.key]}
                          onChange={e => setFichaSaude({ ...fichaSaude, [campo.key]: e.target.checked })}
                          className="accent-yellow-500 w-4 h-4" />
                        <span className={`text-sm font-medium ${fichaSaude[campo.key] ? 'text-yellow-400' : 'text-gray-300'}`}>
                          {fichaSaude[campo.key] ? '⚠️ ' : ''}{campo.label}
                        </span>
                      </label>
                    ))}
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs block mb-1">Outros / Observações de saúde</label>
                    <textarea value={fichaObs} onChange={e => setFichaObs(e.target.value)}
                      rows={3} placeholder="Medicamentos em uso, alergias, outras condições..."
                      className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none resize-none" />
                  </div>
                  <button onClick={salvarFichaSaude} disabled={salvandoFicha}
                    className="w-full bg-yellow-600 hover:bg-yellow-500 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50">
                    {salvandoFicha ? 'Salvando...' : '💾 Salvar ficha de saúde'}
                  </button>
                </div>
              )}

              {/* ABA PRONTUÁRIO */}
              {abaAtiva === 'prontuario' && (
                <div>
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="bg-gray-800 rounded-lg p-3 text-center">
                      <div className="text-gray-500 text-xs mb-1">Total tratamentos</div>
                      <div className="text-white font-bold text-sm">{fmt(totalGasto)}</div>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-3 text-center">
                      <div className="text-gray-500 text-xs mb-1">Total pago</div>
                      <div className="text-verde-400 font-bold text-sm">{fmt(totalPago)}</div>
                    </div>
                    <div className={`rounded-lg p-3 text-center ${totalDeve > 0 ? 'bg-red-900/20 border border-red-800/40' : 'bg-gray-800'}`}>
                      <div className="text-gray-500 text-xs mb-1">Total deve</div>
                      <div className={`font-bold text-sm ${totalDeve > 0 ? 'text-red-400' : 'text-verde-400'}`}>
                        {totalDeve > 0 ? '🔴 ' : '✅ '}{fmt(totalDeve)}
                      </div>
                    </div>
                  </div>

                  <button onClick={() => setNovoProntuarioAberto(true)}
                    className="w-full bg-verde-600 hover:bg-verde-500 text-white text-sm font-semibold py-2.5 rounded-lg mb-4 transition-colors">
                    + Registrar procedimento
                  </button>

                  {prontuario.length === 0 ? (
                    <div className="text-center py-8 text-gray-600">Nenhum procedimento registrado</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-gray-700 bg-gray-800/50">
                            <th className="text-left text-gray-400 py-2 px-2">Data</th>
                            <th className="text-left text-gray-400 py-2 px-2">Qde</th>
                            <th className="text-left text-gray-400 py-2 px-2">Tratamento</th>
                            <th className="text-left text-gray-400 py-2 px-2">Dr(a)</th>
                            <th className="text-right text-gray-400 py-2 px-2">Valor</th>
                            <th className="text-right text-gray-400 py-2 px-2">Soma</th>
                            <th className="text-right text-gray-400 py-2 px-2">Data pag.</th>
                            <th className="text-right text-gray-400 py-2 px-2">Pagou</th>
                            <th className="text-right text-gray-400 py-2 px-2">Deve</th>
                            <th className="text-center text-gray-400 py-2 px-2">Status</th>
                            <th className="text-center text-gray-400 py-2 px-2">Ação</th>
                          </tr>
                        </thead>
                        <tbody>
                          {prontuarioComSoma.map(r => (
                            <tr key={r.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                              <td className="text-gray-400 py-2 px-2 whitespace-nowrap">{new Date(r.data_procedimento).toLocaleDateString('pt-BR')}</td>
                              <td className="text-gray-400 py-2 px-2 text-center">{r.quantidade}</td>
                              <td className="text-white py-2 px-2 font-medium">{r.tratamento}</td>
                              <td className="text-gray-400 py-2 px-2 whitespace-nowrap">{r.dentistas?.nome?.split(' ')[0] || '—'}</td>
                              <td className="text-white py-2 px-2 text-right whitespace-nowrap">{fmt(r.valor)}</td>
                              <td className="text-gray-400 py-2 px-2 text-right whitespace-nowrap">{fmt(r.soma_calculada)}</td>
                              <td className="text-gray-400 py-2 px-2 text-right whitespace-nowrap">{r.data_pagamento ? new Date(r.data_pagamento).toLocaleDateString('pt-BR') : '—'}</td>
                              <td className="text-verde-400 py-2 px-2 text-right whitespace-nowrap">{fmt(r.valor_pago)}</td>
                              <td className={`py-2 px-2 text-right whitespace-nowrap font-semibold ${r.deve > 0 ? 'text-red-400' : 'text-verde-400'}`}>{fmt(r.deve)}</td>
                              <td className="py-2 px-2 text-center">
                                {r.deve <= 0
                                  ? <span className="bg-verde-900/40 text-verde-400 text-xs px-2 py-0.5 rounded-full">✅ Quitado</span>
                                  : <span className="bg-red-900/40 text-red-400 text-xs px-2 py-0.5 rounded-full">🔴 Deve</span>}
                              </td>
                              <td className="py-2 px-2 text-center">
                                <button onClick={() => abrirEdicaoProntuario(r)}
                                  className="text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded px-2 py-1 text-xs">
                                  ✏️
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 border-gray-700 bg-gray-800/50">
                            <td colSpan={4} className="py-2 px-2 text-gray-400 font-bold">TOTAIS</td>
                            <td className="py-2 px-2 text-right text-white font-bold">{fmt(totalGasto)}</td>
                            <td className="py-2 px-2"></td><td className="py-2 px-2"></td>
                            <td className="py-2 px-2 text-right text-verde-400 font-bold">{fmt(totalPago)}</td>
                            <td className={`py-2 px-2 text-right font-bold ${totalDeve > 0 ? 'text-red-400' : 'text-verde-400'}`}>{fmt(totalDeve)}</td>
                            <td className="py-2 px-2"></td>
                            <td className="py-2 px-2"></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL NOVO PRONTUÁRIO */}
      {novoProntuarioAberto && (
        <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-800">
              <h3 className="text-white font-bold">Registrar procedimento</h3>
              <button onClick={() => { setNovoProntuarioAberto(false); setTipoTratamentoSelecionado('') }} className="text-gray-500 hover:text-white text-xl">×</button>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Data *</label>
                  <input type="date" value={formProntuario.data_procedimento}
                    onChange={e => setFormProntuario({...formProntuario, data_procedimento: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Quantidade</label>
                  <input type="number" min="1" value={formProntuario.quantidade}
                    onChange={e => setFormProntuario({...formProntuario, quantidade: parseInt(e.target.value)})}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" />
                </div>
                <div className="col-span-2">
                  <label className="text-gray-400 text-xs block mb-1">Tratamento *</label>
                  <select value={tipoTratamentoSelecionado}
                    onChange={e => {
                      const valor = e.target.value
                      setTipoTratamentoSelecionado(valor)
                      setFormProntuario({...formProntuario, tratamento: valor === '__outro' ? '' : valor})
                    }}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none">
                    <option value="">Selecione o procedimento...</option>
                    {procedimentos.map(p => <option key={p.id} value={p.nome}>{p.nome}</option>)}
                    <option value="__outro">Outro (digitar)</option>
                  </select>
                </div>
                {tipoTratamentoSelecionado === '__outro' && (
                  <div className="col-span-2">
                    <label className="text-gray-400 text-xs block mb-1">Descreva o tratamento *</label>
                    <input type="text" placeholder="Descreva o procedimento..." value={formProntuario.tratamento}
                      onChange={e => setFormProntuario({...formProntuario, tratamento: e.target.value})}
                      className="w-full bg-gray-800 border border-yellow-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" autoFocus />
                  </div>
                )}
                <div className="col-span-2">
                  <label className="text-gray-400 text-xs block mb-1">Dentista</label>
                  <select value={formProntuario.dentista_id}
                    onChange={e => setFormProntuario({...formProntuario, dentista_id: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none">
                    <option value="">Selecione...</option>
                    {dentistas.map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Valor total *</label>
                  <input type="number" step="0.01" placeholder="0,00" value={formProntuario.valor}
                    onChange={e => setFormProntuario({...formProntuario, valor: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Valor pago</label>
                  <input type="number" step="0.01" placeholder="0,00" value={formProntuario.valor_pago}
                    onChange={e => setFormProntuario({...formProntuario, valor_pago: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Forma de pagamento</label>
                  <select value={formProntuario.forma_pagamento}
                    onChange={e => setFormProntuario({...formProntuario, forma_pagamento: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none">
                    <option value="">Selecione...</option>
                    <option>Pix</option><option>Dinheiro</option>
                    <option>Cartão de débito</option><option>Cartão de crédito</option>
                    <option>Promissória</option><option>Cheque</option>
                  </select>
                </div>
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Data do pagamento</label>
                  <input type="date" value={formProntuario.data_pagamento}
                    onChange={e => setFormProntuario({...formProntuario, data_pagamento: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" />
                </div>
                <div className="col-span-2">
                  <label className="text-gray-400 text-xs block mb-1">Orçamento aprovado pelo Dr(a)</label>
                  <input type="text" placeholder="Ex: Dr. Thiago — aprovado em 10/07/2026"
                    value={formProntuario.orcamento_aprovado}
                    onChange={e => setFormProntuario({...formProntuario, orcamento_aprovado: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" />
                </div>
                <div className="col-span-2">
                  <label className="text-gray-400 text-xs block mb-1">Observações</label>
                  <input type="text" placeholder="Anotações..." value={formProntuario.observacoes}
                    onChange={e => setFormProntuario({...formProntuario, observacoes: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => { setNovoProntuarioAberto(false); setTipoTratamentoSelecionado('') }}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-white text-sm font-semibold py-2.5 rounded-lg">Cancelar</button>
                <button onClick={salvarProntuario} disabled={salvando}
                  className="flex-1 bg-verde-600 hover:bg-verde-500 text-white text-sm font-semibold py-2.5 rounded-lg disabled:opacity-50">
                  {salvando ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDITAR PRONTUÁRIO */}
      {editandoProntuarioAberto && (
        <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-800">
              <h3 className="text-white font-bold">Editar procedimento</h3>
              <button onClick={() => setEditandoProntuarioAberto(false)} className="text-gray-500 hover:text-white text-xl">×</button>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Data *</label>
                  <input type="date" value={formProntuarioEdicao.data_procedimento}
                    onChange={e => setFormProntuarioEdicao({...formProntuarioEdicao, data_procedimento: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Quantidade</label>
                  <input type="number" min="1" value={formProntuarioEdicao.quantidade}
                    onChange={e => setFormProntuarioEdicao({...formProntuarioEdicao, quantidade: parseInt(e.target.value)})}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" />
                </div>
                <div className="col-span-2">
                  <label className="text-gray-400 text-xs block mb-1">Tratamento *</label>
                  <input type="text" value={formProntuarioEdicao.tratamento}
                    onChange={e => setFormProntuarioEdicao({...formProntuarioEdicao, tratamento: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" />
                </div>
                <div className="col-span-2">
                  <label className="text-gray-400 text-xs block mb-1">Dentista</label>
                  <select value={formProntuarioEdicao.dentista_id}
                    onChange={e => setFormProntuarioEdicao({...formProntuarioEdicao, dentista_id: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none">
                    <option value="">Selecione...</option>
                    {dentistas.map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Valor total *</label>
                  <input type="number" step="0.01" placeholder="0,00" value={formProntuarioEdicao.valor}
                    onChange={e => setFormProntuarioEdicao({...formProntuarioEdicao, valor: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Valor pago</label>
                  <input type="number" step="0.01" placeholder="0,00" value={formProntuarioEdicao.valor_pago}
                    onChange={e => setFormProntuarioEdicao({...formProntuarioEdicao, valor_pago: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Forma de pagamento</label>
                  <select value={formProntuarioEdicao.forma_pagamento}
                    onChange={e => setFormProntuarioEdicao({...formProntuarioEdicao, forma_pagamento: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none">
                    <option value="">Selecione...</option>
                    <option>Pix</option><option>Dinheiro</option>
                    <option>Cartão de débito</option><option>Cartão de crédito</option>
                    <option>Promissória</option><option>Cheque</option>
                  </select>
                </div>
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Data do pagamento</label>
                  <input type="date" value={formProntuarioEdicao.data_pagamento}
                    onChange={e => setFormProntuarioEdicao({...formProntuarioEdicao, data_pagamento: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" />
                </div>
                <div className="col-span-2">
                  <label className="text-gray-400 text-xs block mb-1">Observações</label>
                  <input type="text" placeholder="Anotações..." value={formProntuarioEdicao.observacoes}
                    onChange={e => setFormProntuarioEdicao({...formProntuarioEdicao, observacoes: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setEditandoProntuarioAberto(false)}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-white text-sm font-semibold py-2.5 rounded-lg">Cancelar</button>
                <button onClick={salvarEdicaoProntuario} disabled={salvando}
                  className="flex-1 bg-verde-600 hover:bg-verde-500 text-white text-sm font-semibold py-2.5 rounded-lg disabled:opacity-50">
                  {salvando ? 'Salvando...' : 'Salvar alterações'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NOVO PACIENTE */}
      {novoModalAberto && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-800">
              <h3 className="text-white font-bold">Novo Paciente</h3>
              <button onClick={() => setNovoModalAberto(false)} className="text-gray-500 hover:text-white text-xl">×</button>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-gray-400 text-xs block mb-1">Nome completo *</label>
                  <input value={form.nome} onChange={e => setForm({...form, nome: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" placeholder="Nome do paciente" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Celular *</label>
                  <input value={form.telefone} onChange={e => setForm({...form, telefone: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" placeholder="(38) 99999-9999" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Telefone fixo</label>
                  <input value={form.telefone_fixo} onChange={e => setForm({...form, telefone_fixo: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" placeholder="(38) 3333-3333" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs block mb-1">E-mail</label>
                  <input value={form.email} onChange={e => setForm({...form, email: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" placeholder="email@exemplo.com" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs block mb-1">CPF</label>
                  <input value={form.cpf} onChange={e => setForm({...form, cpf: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" placeholder="000.000.000-00" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs block mb-1">RG</label>
                  <input value={form.rg} onChange={e => setForm({...form, rg: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" placeholder="MG-0000000" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Data de nascimento</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={form.data_nascimento}
                    onChange={e => setForm({...form, data_nascimento: aplicarMascaraData(e.target.value)})}
                    placeholder="dd/mm/aaaa"
                    maxLength={10}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Naturalidade</label>
                  <input value={form.naturalidade} onChange={e => setForm({...form, naturalidade: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" placeholder="Cidade/UF" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Bairro</label>
                  <input value={form.bairro} onChange={e => setForm({...form, bairro: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" placeholder="Bairro" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Cidade</label>
                  <input value={form.cidade} onChange={e => setForm({...form, cidade: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" placeholder="Diamantina" />
                </div>
                <div className="col-span-2">
                  <label className="text-gray-400 text-xs block mb-1">Endereço</label>
                  <input value={form.endereco} onChange={e => setForm({...form, endereco: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" placeholder="Rua, número" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Filiação — Pai</label>
                  <input value={form.filiacao_pai} onChange={e => setForm({...form, filiacao_pai: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" placeholder="Nome do pai" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Filiação — Mãe</label>
                  <input value={form.filiacao_mae} onChange={e => setForm({...form, filiacao_mae: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" placeholder="Nome da mãe" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Clínica</label>
                  {perfilAdmin ? (
                    <select value={form.clinica_id} onChange={e => setForm({...form, clinica_id: e.target.value})}
                      className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none">
                      <option value="">Selecione...</option>
                      {clinicas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </select>
                  ) : (
                    <div className="bg-gray-800 border border-gray-700 text-gray-300 rounded-lg px-3 py-2 text-sm">
                      {clinicas.find(c => c.id === clinicaIdUsuario)?.nome}
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Dentista</label>
                  <select value={form.dentista_id} onChange={e => setForm({...form, dentista_id: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none">
                    <option value="">Selecione...</option>
                    {dentistas.map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-gray-400 text-xs block mb-1">Observações clínicas</label>
                  <textarea value={form.observacoes_clinicas} onChange={e => setForm({...form, observacoes_clinicas: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none h-20 resize-none"
                    placeholder="Alergias, condições especiais..." />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setNovoModalAberto(false)}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-white text-sm font-semibold py-2.5 rounded-lg">Cancelar</button>
                <button onClick={salvarPaciente} disabled={salvando}
                  className="flex-1 bg-verde-600 hover:bg-verde-500 text-white text-sm font-semibold py-2.5 rounded-lg disabled:opacity-50">
                  {salvando ? 'Salvando...' : 'Salvar paciente'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}