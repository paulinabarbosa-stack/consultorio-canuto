import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Estoque() {
  const [itens, setItens] = useState<any[]>([])
  const [saidas, setSaidas] = useState<any[]>([])
  const [clinicas, setClinicas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [abaAtiva, setAbaAtiva] = useState<'estoque'|'saidas'>('estoque')
  const [modalAberto, setModalAberto] = useState(false)
  const [modalSaida, setModalSaida] = useState(false)
  const [itemSelecionado, setItemSelecionado] = useState<any>(null)
  const [salvando, setSalvando] = useState(false)
  const [filtroClinica, setFiltroClinica] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [clinicaIdUsuario, setClinicaIdUsuario] = useState<string | null>(null)
  const [perfilAdmin, setPerfilAdmin] = useState(true)

  const [form, setForm] = useState({
    clinica_id: '', nome: '', quantidade: '', quantidade_minima: '5', unidade: ''
  })

  const [formSaida, setFormSaida] = useState({
    tipo: 'uso',
    quantidade: '1',
    clinica_destino_id: '',
    observacoes: ''
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
          setFiltroClinica(data.clinica_id)
          setForm(f => ({ ...f, clinica_id: data.clinica_id }))
        }
      }
    }
    carregarUsuario()
  }, [])

  useEffect(() => { carregar() }, [filtroClinica])

  async function carregar() {
    setLoading(true)
    try {
      let query = supabase.from('estoque').select('*, clinicas(nome)').order('nome')
      if (filtroClinica) query = query.eq('clinica_id', filtroClinica)

      const [{ data: e }, { data: c }, { data: s }] = await Promise.all([
        query,
        supabase.from('clinicas').select('*'),
        supabase.from('estoque_saidas')
          .select('*, estoque(nome), clinicas_origem:clinica_origem_id(nome), clinicas_destino:clinica_destino_id(nome)')
          .order('created_at', { ascending: false })
          .limit(50)
      ])
      if (e) setItens(e)
      if (c) setClinicas(c)
      if (s) setSaidas(s)
    } catch (err) { console.error(err) }
    setLoading(false)
  }

  async function salvar() {
    if (!form.nome || !form.quantidade || !form.clinica_id) return alert('Preencha nome, clínica e quantidade!')
    setSalvando(true)
    const { error } = await supabase.from('estoque').insert([{
      clinica_id: form.clinica_id, nome: form.nome,
      quantidade: parseInt(form.quantidade),
      quantidade_minima: parseInt(form.quantidade_minima) || 5,
      unidade: form.unidade || null,
    }])
    if (error) { alert('Erro: ' + error.message); setSalvando(false); return }
    setModalAberto(false)
    setForm({ clinica_id: clinicaIdUsuario || '', nome: '', quantidade: '', quantidade_minima: '5', unidade: '' })
    await carregar()
    setSalvando(false)
  }

  async function registrarSaida() {
    if (!itemSelecionado || !formSaida.quantidade) return
    const qtd = parseInt(formSaida.quantidade)
    if (qtd <= 0) return alert('Quantidade inválida!')
    if (qtd > itemSelecionado.quantidade) return alert('Quantidade maior que o estoque disponível!')
    if (formSaida.tipo === 'transferencia' && !formSaida.clinica_destino_id) return alert('Selecione a clínica de destino!')

    setSalvando(true)

    // Registra a saída
    await supabase.from('estoque_saidas').insert([{
      estoque_id: itemSelecionado.id,
      clinica_origem_id: itemSelecionado.clinica_id,
      clinica_destino_id: formSaida.tipo === 'transferencia' ? formSaida.clinica_destino_id : null,
      quantidade: qtd,
      tipo: formSaida.tipo,
      observacoes: formSaida.observacoes || null,
    }])

    // Atualiza o estoque de origem
    await supabase.from('estoque').update({ quantidade: itemSelecionado.quantidade - qtd }).eq('id', itemSelecionado.id)

    // Se for transferência, adiciona na clínica destino
    if (formSaida.tipo === 'transferencia') {
      const { data: itemDestino } = await supabase.from('estoque')
        .select('*')
        .eq('clinica_id', formSaida.clinica_destino_id)
        .eq('nome', itemSelecionado.nome)
        .maybeSingle()

      if (itemDestino) {
        await supabase.from('estoque').update({ quantidade: itemDestino.quantidade + qtd }).eq('id', itemDestino.id)
      } else {
        await supabase.from('estoque').insert([{
          clinica_id: formSaida.clinica_destino_id,
          nome: itemSelecionado.nome,
          quantidade: qtd,
          quantidade_minima: itemSelecionado.quantidade_minima,
          unidade: itemSelecionado.unidade,
        }])
      }
    }

    setModalSaida(false)
    setItemSelecionado(null)
    setFormSaida({ tipo: 'uso', quantidade: '1', clinica_destino_id: '', observacoes: '' })
    await carregar()
    setSalvando(false)
  }

  async function atualizarQuantidade(id: string, novaQtd: number) {
    if (novaQtd < 0) return
    await supabase.from('estoque').update({ quantidade: novaQtd }).eq('id', id)
    await carregar()
  }

  function getStatus(item: any) {
    if (item.quantidade === 0) return { label: 'Crítico', cor: 'text-red-400 bg-red-900/30' }
    if (item.quantidade <= item.quantidade_minima) return { label: 'Baixo', cor: 'text-yellow-400 bg-yellow-900/30' }
    return { label: 'OK', cor: 'text-green-400 bg-green-900/30' }
  }

  const itensFiltrados = filtroStatus ? itens.filter(i => getStatus(i).label === filtroStatus) : itens
  const criticos = itens.filter(i => i.quantidade === 0).length
  const baixos = itens.filter(i => i.quantidade > 0 && i.quantidade <= i.quantidade_minima).length
  const ok = itens.filter(i => i.quantidade > i.quantidade_minima).length

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-white text-lg font-bold">Estoque</h2>
          <p className="text-gray-500 text-sm">{itens.length} itens · {criticos} críticos · {baixos} baixos · {ok} OK</p>
        </div>
        <button onClick={() => setModalAberto(true)}
          className="bg-green-700 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
          + Novo item
        </button>
      </div>

      {/* Cards resumo */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="bg-gray-900 border border-red-900/40 rounded-xl p-4 cursor-pointer" onClick={() => setFiltroStatus(filtroStatus === 'Crítico' ? '' : 'Crítico')}>
          <div className="text-gray-500 text-xs mb-2">🔴 Estoque crítico</div>
          <div className="text-red-400 text-2xl font-bold">{criticos}</div>
        </div>
        <div className="bg-gray-900 border border-yellow-900/40 rounded-xl p-4 cursor-pointer" onClick={() => setFiltroStatus(filtroStatus === 'Baixo' ? '' : 'Baixo')}>
          <div className="text-gray-500 text-xs mb-2">🟡 Estoque baixo</div>
          <div className="text-yellow-400 text-2xl font-bold">{baixos}</div>
        </div>
        <div className="bg-gray-900 border border-green-900/40 rounded-xl p-4 cursor-pointer" onClick={() => setFiltroStatus(filtroStatus === 'OK' ? '' : 'OK')}>
          <div className="text-gray-500 text-xs mb-2">🟢 Estoque OK</div>
          <div className="text-green-400 text-2xl font-bold">{ok}</div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 mb-4 flex-wrap">
        {perfilAdmin && (
          <select value={filtroClinica} onChange={e => setFiltroClinica(e.target.value)}
            className="bg-gray-900 border border-gray-800 text-white rounded-lg px-3 py-2 text-sm focus:outline-none">
            <option value="">Todas as clínicas</option>
            {clinicas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        )}
        {!perfilAdmin && (
          <span className="bg-gray-900 border border-gray-800 text-gray-400 rounded-lg px-3 py-2 text-sm">
            📍 {clinicas.find(c => c.id === clinicaIdUsuario)?.nome}
          </span>
        )}
        {filtroStatus && (
          <button onClick={() => setFiltroStatus('')}
            className="bg-gray-800 text-gray-400 hover:text-white rounded-lg px-3 py-2 text-sm transition-colors">
            Filtro: {filtroStatus} ×
          </button>
        )}
      </div>

      {/* Abas */}
      <div className="flex gap-2 mb-4">
        <button onClick={() => setAbaAtiva('estoque')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${abaAtiva === 'estoque' ? 'bg-green-900 text-green-300' : 'bg-gray-900 text-gray-400 hover:text-white border border-gray-800'}`}>
          📦 Estoque ({itens.length})
        </button>
        <button onClick={() => setAbaAtiva('saidas')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${abaAtiva === 'saidas' ? 'bg-orange-900 text-orange-300' : 'bg-gray-900 text-gray-400 hover:text-white border border-gray-800'}`}>
          📤 Saídas e transferências ({saidas.length})
        </button>
      </div>

      {loading ? (
        <div className="text-gray-400 text-center p-8">Carregando...</div>
      ) : abaAtiva === 'estoque' ? (
        itensFiltrados.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
            <div className="text-4xl mb-3">📦</div>
            <div className="text-gray-400">Nenhum item no estoque</div>
          </div>
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left text-gray-500 text-xs px-4 py-3">Item</th>
                  <th className="text-left text-gray-500 text-xs px-4 py-3">Clínica</th>
                  <th className="text-center text-gray-500 text-xs px-4 py-3">Qtd atual</th>
                  <th className="text-center text-gray-500 text-xs px-4 py-3">Qtd mínima</th>
                  <th className="text-left text-gray-500 text-xs px-4 py-3">Unidade</th>
                  <th className="text-center text-gray-500 text-xs px-4 py-3">Status</th>
                  <th className="text-center text-gray-500 text-xs px-4 py-3">Ajustar</th>
                  <th className="text-center text-gray-500 text-xs px-4 py-3">Saída</th>
                </tr>
              </thead>
              <tbody>
                {itensFiltrados.map((item, i) => {
                  const status = getStatus(item)
                  return (
                    <tr key={item.id} className={i < itensFiltrados.length - 1 ? 'border-b border-gray-800' : ''}>
                      <td className="px-4 py-3 text-white text-sm font-medium">{item.nome}</td>
                      <td className="px-4 py-3 text-gray-400 text-sm">{item.clinicas?.nome}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-sm font-bold ${item.quantidade === 0 ? 'text-red-400' : item.quantidade <= item.quantidade_minima ? 'text-yellow-400' : 'text-white'}`}>
                          {item.quantidade}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-gray-500 text-sm">{item.quantidade_minima}</td>
                      <td className="px-4 py-3 text-gray-400 text-sm">{item.unidade || '—'}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${status.cor}`}>{status.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => atualizarQuantidade(item.id, item.quantidade - 1)}
                            className="w-6 h-6 bg-gray-800 hover:bg-gray-700 text-white rounded text-sm transition-colors">−</button>
                          <button onClick={() => atualizarQuantidade(item.id, item.quantidade + 1)}
                            className="w-6 h-6 bg-green-800 hover:bg-green-700 text-white rounded text-sm transition-colors">+</button>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => { setItemSelecionado(item); setFormSaida({ tipo: 'uso', quantidade: '1', clinica_destino_id: '', observacoes: '' }); setModalSaida(true) }}
                          className="bg-orange-800 hover:bg-orange-700 text-orange-300 text-xs px-3 py-1.5 rounded-lg transition-colors font-medium">
                          📤 Saída
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      ) : (
        /* ABA SAÍDAS */
        saidas.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
            <div className="text-4xl mb-3">📤</div>
            <div className="text-gray-400">Nenhuma saída registrada</div>
          </div>
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left text-gray-500 text-xs px-4 py-3">Data</th>
                  <th className="text-left text-gray-500 text-xs px-4 py-3">Item</th>
                  <th className="text-left text-gray-500 text-xs px-4 py-3">Tipo</th>
                  <th className="text-left text-gray-500 text-xs px-4 py-3">Origem</th>
                  <th className="text-left text-gray-500 text-xs px-4 py-3">Destino</th>
                  <th className="text-center text-gray-500 text-xs px-4 py-3">Qtd</th>
                  <th className="text-left text-gray-500 text-xs px-4 py-3">Observações</th>
                </tr>
              </thead>
              <tbody>
                {saidas.map((s, i) => (
                  <tr key={s.id} className={i < saidas.length - 1 ? 'border-b border-gray-800' : ''}>
                    <td className="px-4 py-3 text-gray-400 text-sm whitespace-nowrap">
                      {new Date(s.created_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-4 py-3 text-white text-sm font-medium">{s.estoque?.nome}</td>
                    <td className="px-4 py-3">
                      {s.tipo === 'transferencia' ? (
                        <span className="text-xs bg-blue-900/30 text-blue-400 px-2 py-0.5 rounded-full font-medium">🔄 Transferência</span>
                      ) : (
                        <span className="text-xs bg-orange-900/30 text-orange-400 px-2 py-0.5 rounded-full font-medium">📤 Uso</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-sm">{s.clinicas_origem?.nome || '—'}</td>
                    <td className="px-4 py-3 text-gray-400 text-sm">{s.clinicas_destino?.nome || '—'}</td>
                    <td className="px-4 py-3 text-center text-white font-bold text-sm">{s.quantidade}</td>
                    <td className="px-4 py-3 text-gray-500 text-sm">{s.observacoes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* MODAL NOVO ITEM */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-800">
              <h3 className="text-white font-bold">Novo Item</h3>
              <button onClick={() => setModalAberto(false)} className="text-gray-500 hover:text-white text-xl">×</button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="text-gray-400 text-xs block mb-1">Nome do item *</label>
                <input value={form.nome} onChange={e => setForm({...form, nome: e.target.value})}
                  placeholder="Ex: Luvas descartáveis, Anestésico..."
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" />
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
                    {clinicas.find(c => c.id === clinicaIdUsuario)?.nome || '—'}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Quantidade *</label>
                  <input type="number" value={form.quantidade} onChange={e => setForm({...form, quantidade: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Qtd mínima</label>
                  <input type="number" value={form.quantidade_minima} onChange={e => setForm({...form, quantidade_minima: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Unidade</label>
                  <input value={form.unidade} onChange={e => setForm({...form, unidade: e.target.value})}
                    placeholder="cx, un, ml..."
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setModalAberto(false)}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-white text-sm font-semibold py-2.5 rounded-lg">Cancelar</button>
                <button onClick={salvar} disabled={salvando}
                  className="flex-1 bg-green-700 hover:bg-green-600 text-white text-sm font-semibold py-2.5 rounded-lg disabled:opacity-50">
                  {salvando ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL SAÍDA */}
      {modalSaida && itemSelecionado && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-800">
              <h3 className="text-white font-bold">Registrar Saída</h3>
              <button onClick={() => setModalSaida(false)} className="text-gray-500 hover:text-white text-xl">×</button>
            </div>
            <div className="p-5 space-y-3">
              <div className="bg-gray-800 rounded-lg p-3">
                <div className="text-gray-400 text-xs mb-1">Item</div>
                <div className="text-white font-semibold">{itemSelecionado.nome}</div>
                <div className="text-gray-500 text-xs">{itemSelecionado.clinicas?.nome} · Disponível: {itemSelecionado.quantidade} {itemSelecionado.unidade || 'un'}</div>
              </div>

              <div>
                <label className="text-gray-400 text-xs block mb-1">Tipo de saída *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setFormSaida({...formSaida, tipo: 'uso', clinica_destino_id: ''})}
                    className={`py-2.5 rounded-lg text-sm font-semibold border transition-colors ${formSaida.tipo === 'uso' ? 'bg-orange-800 border-orange-600 text-orange-300' : 'bg-gray-800 border-gray-700 text-gray-400'}`}>
                    📤 Uso/Consumo
                  </button>
                  <button onClick={() => setFormSaida({...formSaida, tipo: 'transferencia'})}
                    className={`py-2.5 rounded-lg text-sm font-semibold border transition-colors ${formSaida.tipo === 'transferencia' ? 'bg-blue-800 border-blue-600 text-blue-300' : 'bg-gray-800 border-gray-700 text-gray-400'}`}>
                    🔄 Transferência
                  </button>
                </div>
              </div>

              {formSaida.tipo === 'transferencia' && (
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Clínica destino *</label>
                  <select value={formSaida.clinica_destino_id} onChange={e => setFormSaida({...formSaida, clinica_destino_id: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none">
                    <option value="">Selecione a clínica destino...</option>
                    {clinicas.filter(c => c.id !== itemSelecionado.clinica_id).map(c => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="text-gray-400 text-xs block mb-1">Quantidade *</label>
                <input type="number" min="1" max={itemSelecionado.quantidade}
                  value={formSaida.quantidade} onChange={e => setFormSaida({...formSaida, quantidade: e.target.value})}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" />
              </div>

              <div>
                <label className="text-gray-400 text-xs block mb-1">Observações</label>
                <input value={formSaida.observacoes} onChange={e => setFormSaida({...formSaida, observacoes: e.target.value})}
                  placeholder="Motivo, observações..."
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" />
              </div>

              <div className="flex gap-2 pt-2">
                <button onClick={() => setModalSaida(false)}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-white text-sm font-semibold py-2.5 rounded-lg">Cancelar</button>
                <button onClick={registrarSaida} disabled={salvando}
                  className="flex-1 bg-orange-700 hover:bg-orange-600 text-white text-sm font-semibold py-2.5 rounded-lg disabled:opacity-50">
                  {salvando ? 'Registrando...' : 'Confirmar saída'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}