import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Pacientes() {
  const [pacientes, setPacientes] = useState<any[]>([])
  const [clinicas, setClinicas] = useState<any[]>([])
  const [dentistas, setDentistas] = useState<any[]>([])
  const [procedimentos, setProcedimentos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [modalAberto, setModalAberto] = useState(false)
  const [pacienteSelecionado, setPacienteSelecionado] = useState<any>(null)
  const [prontuario, setProntuario] = useState<any[]>([])
  const [novoModalAberto, setNovoModalAberto] = useState(false)
  const [novoProntuarioAberto, setNovoProntuarioAberto] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [abaAtiva, setAbaAtiva] = useState<'dados'|'prontuario'>('dados')

  const [form, setForm] = useState({
    nome: '', telefone: '', telefone_fixo: '', email: '', cpf: '', rg: '',
    data_nascimento: '', naturalidade: '', bairro: '', cidade: '',
    endereco: '', filiacao_pai: '', filiacao_mae: '',
    clinica_id: '', dentista_id: '', observacoes_clinicas: ''
  })

  const [formProntuario, setFormProntuario] = useState({
    data_procedimento: new Date().toISOString().split('T')[0],
    quantidade: 1,
    tratamento: '',
    dentista_id: '',
    valor: '',
    data_pagamento: '',
    valor_pago: '',
    forma_pagamento: '',
    observacoes: ''
  })

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
    const { data } = await supabase
      .from('prontuario')
      .select('*, dentistas(nome)')
      .eq('paciente_id', p.id)
      .order('data_procedimento', { ascending: false })
    if (data) setProntuario(data)
    setModalAberto(true)
  }

  async function salvarPaciente() {
    if (!form.nome || !form.telefone) return alert('Nome e telefone são obrigatórios!')
    setSalvando(true)
    const dados = {
      ...form,
      clinica_id: form.clinica_id || null,
      dentista_id: form.dentista_id || null,
    }
    const { error } = await supabase.from('pacientes').insert([dados])
    if (error) { alert('Erro: ' + error.message); setSalvando(false); return }
    setNovoModalAberto(false)
    setForm({ nome: '', telefone: '', telefone_fixo: '', email: '', cpf: '', rg: '', data_nascimento: '', naturalidade: '', bairro: '', cidade: '', endereco: '', filiacao_pai: '', filiacao_mae: '', clinica_id: '', dentista_id: '', observacoes_clinicas: '' })
    await carregar()
    setSalvando(false)
  }

  async function salvarProntuario() {
    if (!formProntuario.tratamento || !formProntuario.valor) return alert('Tratamento e valor são obrigatórios!')
    setSalvando(true)
    const valorTotal = parseFloat(formProntuario.valor) || 0
    const valorPago = parseFloat(formProntuario.valor_pago) || 0
    const deve = valorTotal - valorPago
    const ultimoRegistro = prontuario[prontuario.length - 1]
    const somaAnterior = ultimoRegistro ? parseFloat(ultimoRegistro.soma_acumulada) : 0
    const somaAcumulada = somaAnterior + deve

    const { error } = await supabase.from('prontuario').insert([{
      paciente_id: pacienteSelecionado.id,
      clinica_id: pacienteSelecionado.clinica_id,
      dentista_id: formProntuario.dentista_id || pacienteSelecionado.dentista_id,
      data_procedimento: formProntuario.data_procedimento,
      quantidade: formProntuario.quantidade,
      tratamento: formProntuario.tratamento,
      valor: valorTotal,
      soma_acumulada: somaAcumulada,
      data_pagamento: formProntuario.data_pagamento || null,
      valor_pago: valorPago,
      deve: deve,
      forma_pagamento: formProntuario.forma_pagamento || null,
      observacoes: formProntuario.observacoes || null,
    }])
    if (error) { alert('Erro: ' + error.message); setSalvando(false); return }
    setNovoProntuarioAberto(false)
    setFormProntuario({ data_procedimento: new Date().toISOString().split('T')[0], quantidade: 1, tratamento: '', dentista_id: '', valor: '', data_pagamento: '', valor_pago: '', forma_pagamento: '', observacoes: '' })
    const { data } = await supabase.from('prontuario').select('*, dentistas(nome)').eq('paciente_id', pacienteSelecionado.id).order('data_procedimento', { ascending: false })
    if (data) setProntuario(data)
    setSalvando(false)
  }

  function calcularIdade(dataNasc: string) {
    if (!dataNasc) return null
    const hoje = new Date()
    const nasc = new Date(dataNasc)
    let idade = hoje.getFullYear() - nasc.getFullYear()
    const m = hoje.getMonth() - nasc.getMonth()
    if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--
    return idade
  }

  function iniciais(nome: string) {
    return nome.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
  }

  function formatarDinheiro(v: number) {
    return v?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || 'R$ 0,00'
  }

  const pacientesFiltrados = pacientes.filter(p =>
    p.nome.toLowerCase().includes(busca.toLowerCase()) ||
    (p.telefone && p.telefone.includes(busca)) ||
    (p.clinicas?.nome && p.clinicas.nome.toLowerCase().includes(busca.toLowerCase()))
  )

  const totalDeve = prontuario.reduce((acc, r) => acc + (parseFloat(r.deve) || 0), 0)
  const totalPago = prontuario.reduce((acc, r) => acc + (parseFloat(r.valor_pago) || 0), 0)
  const totalGasto = prontuario.reduce((acc, r) => acc + (parseFloat(r.valor) || 0), 0)

  if (loading) return <div className="text-gray-400">Carregando...</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-white text-lg font-bold">Pacientes / CRM</h2>
          <p className="text-gray-500 text-sm">{pacientes.length} pacientes cadastrados</p>
        </div>
        <button onClick={() => setNovoModalAberto(true)}
          className="bg-verde-600 hover:bg-verde-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
          + Novo paciente
        </button>
      </div>

      <input type="text" placeholder="🔍  Buscar por nome, telefone ou clínica..."
        value={busca} onChange={e => setBusca(e.target.value)}
        className="w-full bg-gray-900 border border-gray-800 text-white rounded-xl px-4 py-3 text-sm mb-4 focus:outline-none focus:border-verde-600" />

      {pacientesFiltrados.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
          <div className="text-4xl mb-3">👥</div>
          <div className="text-gray-400 font-medium">Nenhum paciente encontrado</div>
          <div className="text-gray-600 text-sm mt-1">Clique em "Novo paciente" para cadastrar</div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {pacientesFiltrados.map(p => (
            <div key={p.id} onClick={() => abrirFicha(p)}
              className="bg-gray-900 border border-gray-800 hover:border-verde-600 rounded-xl p-4 cursor-pointer transition-colors flex items-center gap-3">
              <div className="w-10 h-10 bg-verde-700 rounded-full flex items-center justify-center text-sm font-bold text-verde-300 flex-shrink-0">
                {iniciais(p.nome)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-white font-semibold text-sm truncate">{p.nome}</div>
                <div className="text-gray-500 text-xs mt-0.5">
                  📱 {p.telefone}
                  {p.data_nascimento && ` · 🎂 ${calcularIdade(p.data_nascimento)} anos`}
                </div>
                <div className="text-gray-600 text-xs mt-0.5">
                  {p.clinicas?.nome && `🏥 ${p.clinicas.nome}`}
                  {p.dentistas?.nome && ` · 👨‍⚕️ ${p.dentistas.nome}`}
                </div>
              </div>
              <div className="text-verde-500 text-xs font-semibold">Ver ficha →</div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL FICHA */}
      {modalAberto && pacienteSelecionado && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-verde-700 rounded-full flex items-center justify-center text-sm font-bold text-verde-300">
                  {iniciais(pacienteSelecionado.nome)}
                </div>
                <div>
                  <h3 className="text-white font-bold">{pacienteSelecionado.nome}</h3>
                  <p className="text-gray-500 text-xs">
                    {pacienteSelecionado.data_nascimento && `${calcularIdade(pacienteSelecionado.data_nascimento)} anos · `}
                    {pacienteSelecionado.clinicas?.nome}
                  </p>
                </div>
              </div>
              <button onClick={() => setModalAberto(false)} className="text-gray-500 hover:text-white text-xl">×</button>
            </div>

            {/* Abas */}
            <div className="flex border-b border-gray-800">
              <button onClick={() => setAbaAtiva('dados')}
                className={`px-5 py-3 text-sm font-semibold transition-colors ${abaAtiva === 'dados' ? 'text-verde-400 border-b-2 border-verde-500' : 'text-gray-500 hover:text-white'}`}>
                📋 Dados pessoais
              </button>
              <button onClick={() => setAbaAtiva('prontuario')}
                className={`px-5 py-3 text-sm font-semibold transition-colors ${abaAtiva === 'prontuario' ? 'text-verde-400 border-b-2 border-verde-500' : 'text-gray-500 hover:text-white'}`}>
                🦷 Prontuário ({prontuario.length})
              </button>
            </div>

            <div className="p-5">
              {abaAtiva === 'dados' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-gray-800 rounded-lg p-3">
                      <div className="text-gray-500 text-xs mb-1">Celular</div>
                      <div className="text-white text-sm">{pacienteSelecionado.telefone || '—'}</div>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-3">
                      <div className="text-gray-500 text-xs mb-1">Telefone fixo</div>
                      <div className="text-white text-sm">{pacienteSelecionado.telefone_fixo || '—'}</div>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-3">
                      <div className="text-gray-500 text-xs mb-1">E-mail</div>
                      <div className="text-white text-sm">{pacienteSelecionado.email || '—'}</div>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-3">
                      <div className="text-gray-500 text-xs mb-1">CPF</div>
                      <div className="text-white text-sm">{pacienteSelecionado.cpf || '—'}</div>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-3">
                      <div className="text-gray-500 text-xs mb-1">RG</div>
                      <div className="text-white text-sm">{pacienteSelecionado.rg || '—'}</div>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-3">
                      <div className="text-gray-500 text-xs mb-1">Nascimento</div>
                      <div className="text-white text-sm">
                        {pacienteSelecionado.data_nascimento ? new Date(pacienteSelecionado.data_nascimento).toLocaleDateString('pt-BR') : '—'}
                      </div>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-3">
                      <div className="text-gray-500 text-xs mb-1">Naturalidade</div>
                      <div className="text-white text-sm">{pacienteSelecionado.naturalidade || '—'}</div>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-3">
                      <div className="text-gray-500 text-xs mb-1">Bairro</div>
                      <div className="text-white text-sm">{pacienteSelecionado.bairro || '—'}</div>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-3">
                      <div className="text-gray-500 text-xs mb-1">Cidade</div>
                      <div className="text-white text-sm">{pacienteSelecionado.cidade || '—'}</div>
                    </div>
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

              {abaAtiva === 'prontuario' && (
                <div>
                  {/* Resumo financeiro */}
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="bg-gray-800 rounded-lg p-3 text-center">
                      <div className="text-gray-500 text-xs mb-1">Total tratamentos</div>
                      <div className="text-white font-bold text-sm">{formatarDinheiro(totalGasto)}</div>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-3 text-center">
                      <div className="text-gray-500 text-xs mb-1">Total pago</div>
                      <div className="text-verde-400 font-bold text-sm">{formatarDinheiro(totalPago)}</div>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-3 text-center">
                      <div className="text-gray-500 text-xs mb-1">Total deve</div>
                      <div className={`font-bold text-sm ${totalDeve > 0 ? 'text-red-400' : 'text-verde-400'}`}>{formatarDinheiro(totalDeve)}</div>
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
                          <tr className="border-b border-gray-800">
                            <th className="text-left text-gray-500 py-2 pr-3">Data</th>
                            <th className="text-left text-gray-500 py-2 pr-3">Qde</th>
                            <th className="text-left text-gray-500 py-2 pr-3">Tratamento</th>
                            <th className="text-left text-gray-500 py-2 pr-3">Dr(a)</th>
                            <th className="text-right text-gray-500 py-2 pr-3">Valor</th>
                            <th className="text-right text-gray-500 py-2 pr-3">Pagou</th>
                            <th className="text-right text-gray-500 py-2">Deve</th>
                          </tr>
                        </thead>
                        <tbody>
                          {prontuario.map(r => (
                            <tr key={r.id} className="border-b border-gray-800/50">
                              <td className="text-gray-400 py-2 pr-3 whitespace-nowrap">
                                {new Date(r.data_procedimento).toLocaleDateString('pt-BR')}
                              </td>
                              <td className="text-gray-400 py-2 pr-3">{r.quantidade}</td>
                              <td className="text-white py-2 pr-3">{r.tratamento}</td>
                              <td className="text-gray-400 py-2 pr-3 whitespace-nowrap">{r.dentistas?.nome?.split(' ')[0] || '—'}</td>
                              <td className="text-white py-2 pr-3 text-right whitespace-nowrap">{formatarDinheiro(r.valor)}</td>
                              <td className="text-verde-400 py-2 pr-3 text-right whitespace-nowrap">{formatarDinheiro(r.valor_pago)}</td>
                              <td className={`py-2 text-right whitespace-nowrap font-semibold ${r.deve > 0 ? 'text-red-400' : 'text-verde-400'}`}>
                                {formatarDinheiro(r.deve)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
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
        <div className="fixed inset-0 bg-black/80 z-60 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-800">
              <h3 className="text-white font-bold">Registrar procedimento</h3>
              <button onClick={() => setNovoProntuarioAberto(false)} className="text-gray-500 hover:text-white text-xl">×</button>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Data *</label>
                  <input type="date" value={formProntuario.data_procedimento}
                    onChange={e => setFormProntuario({...formProntuario, data_procedimento: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-verde-600" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Quantidade</label>
                  <input type="number" min="1" value={formProntuario.quantidade}
                    onChange={e => setFormProntuario({...formProntuario, quantidade: parseInt(e.target.value)})}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-verde-600" />
                </div>
                <div className="col-span-2">
                  <label className="text-gray-400 text-xs block mb-1">Tratamento *</label>
                  <select value={formProntuario.tratamento}
                    onChange={e => setFormProntuario({...formProntuario, tratamento: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-verde-600">
                    <option value="">Selecione o procedimento...</option>
                    {procedimentos.map(p => <option key={p.id} value={p.nome}>{p.nome}</option>)}
                    <option value="Outro">Outro (digitar)</option>
                  </select>
                </div>
                {formProntuario.tratamento === 'Outro' && (
                  <div className="col-span-2">
                    <label className="text-gray-400 text-xs block mb-1">Descreva o tratamento</label>
                    <input type="text" placeholder="Descreva o procedimento..."
                      onChange={e => setFormProntuario({...formProntuario, tratamento: e.target.value})}
                      className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-verde-600" />
                  </div>
                )}
                <div className="col-span-2">
                  <label className="text-gray-400 text-xs block mb-1">Dentista</label>
                  <select value={formProntuario.dentista_id}
                    onChange={e => setFormProntuario({...formProntuario, dentista_id: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-verde-600">
                    <option value="">Selecione...</option>
                    {dentistas.map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Valor total *</label>
                  <input type="number" step="0.01" placeholder="0,00" value={formProntuario.valor}
                    onChange={e => setFormProntuario({...formProntuario, valor: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-verde-600" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Valor pago</label>
                  <input type="number" step="0.01" placeholder="0,00" value={formProntuario.valor_pago}
                    onChange={e => setFormProntuario({...formProntuario, valor_pago: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-verde-600" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Forma de pagamento</label>
                  <select value={formProntuario.forma_pagamento}
                    onChange={e => setFormProntuario({...formProntuario, forma_pagamento: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-verde-600">
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
                  <label className="text-gray-400 text-xs block mb-1">Data do pagamento</label>
                  <input type="date" value={formProntuario.data_pagamento}
                    onChange={e => setFormProntuario({...formProntuario, data_pagamento: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-verde-600" />
                </div>
                <div className="col-span-2">
                  <label className="text-gray-400 text-xs block mb-1">Observações</label>
                  <input type="text" placeholder="Anotações..." value={formProntuario.observacoes}
                    onChange={e => setFormProntuario({...formProntuario, observacoes: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-verde-600" />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setNovoProntuarioAberto(false)}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors">
                  Cancelar
                </button>
                <button onClick={salvarProntuario} disabled={salvando}
                  className="flex-1 bg-verde-600 hover:bg-verde-500 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50">
                  {salvando ? 'Salvando...' : 'Salvar'}
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
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-verde-600"
                    placeholder="Nome do paciente" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Celular *</label>
                  <input value={form.telefone} onChange={e => setForm({...form, telefone: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-verde-600"
                    placeholder="(38) 99999-9999" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Telefone fixo</label>
                  <input value={form.telefone_fixo} onChange={e => setForm({...form, telefone_fixo: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-verde-600"
                    placeholder="(38) 3333-3333" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs block mb-1">E-mail</label>
                  <input value={form.email} onChange={e => setForm({...form, email: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-verde-600"
                    placeholder="email@exemplo.com" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs block mb-1">CPF</label>
                  <input value={form.cpf} onChange={e => setForm({...form, cpf: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-verde-600"
                    placeholder="000.000.000-00" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs block mb-1">RG</label>
                  <input value={form.rg} onChange={e => setForm({...form, rg: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-verde-600"
                    placeholder="MG-0000000" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Data de nascimento</label>
                  <input type="date" value={form.data_nascimento} onChange={e => setForm({...form, data_nascimento: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-verde-600" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Naturalidade</label>
                  <input value={form.naturalidade} onChange={e => setForm({...form, naturalidade: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-verde-600"
                    placeholder="Cidade/UF" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Bairro</label>
                  <input value={form.bairro} onChange={e => setForm({...form, bairro: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-verde-600"
                    placeholder="Bairro" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Cidade</label>
                  <input value={form.cidade} onChange={e => setForm({...form, cidade: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-verde-600"
                    placeholder="Diamantina" />
                </div>
                <div className="col-span-2">
                  <label className="text-gray-400 text-xs block mb-1">Endereço</label>
                  <input value={form.endereco} onChange={e => setForm({...form, endereco: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-verde-600"
                    placeholder="Rua, número" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Filiação — Pai</label>
                  <input value={form.filiacao_pai} onChange={e => setForm({...form, filiacao_pai: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-verde-600"
                    placeholder="Nome do pai" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Filiação — Mãe</label>
                  <input value={form.filiacao_mae} onChange={e => setForm({...form, filiacao_mae: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-verde-600"
                    placeholder="Nome da mãe" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Clínica</label>
                  <select value={form.clinica_id} onChange={e => setForm({...form, clinica_id: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-verde-600">
                    <option value="">Selecione...</option>
                    {clinicas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Dentista</label>
                  <select value={form.dentista_id} onChange={e => setForm({...form, dentista_id: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-verde-600">
                    <option value="">Selecione...</option>
                    {dentistas.map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-gray-400 text-xs block mb-1">Observações clínicas</label>
                  <textarea value={form.observacoes_clinicas} onChange={e => setForm({...form, observacoes_clinicas: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-verde-600 h-20 resize-none"
                    placeholder="Alergias, condições especiais..." />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setNovoModalAberto(false)}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors">
                  Cancelar
                </button>
                <button onClick={salvarPaciente} disabled={salvando}
                  className="flex-1 bg-verde-600 hover:bg-verde-500 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50">
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