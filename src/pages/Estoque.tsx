import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Estoque() {
  const [itens, setItens] = useState<any[]>([])
  const [clinicas, setClinicas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modalAberto, setModalAberto] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [filtroClinica, setFiltroClinica] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [clinicaIdUsuario, setClinicaIdUsuario] = useState<string | null>(null)
  const [perfilAdmin, setPerfilAdmin] = useState(true)
  const [form, setForm] = useState({
    clinica_id: '', nome: '', quantidade: '',
    quantidade_minima: '5', unidade: ''
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
      const [{ data: e }, { data: c }] = await Promise.all([query, supabase.from('clinicas').select('*')])
      if (e) setItens(e)
      if (c) setClinicas(c)
    } catch (err) { console.error(err) }
    setLoading(false)
  }

  async function salvar() {
    if (!form.nome || !form.quantidade || !form.clinica_id)
      return alert('Preencha nome, clínica e quantidade!')
    setSalvando(true)
    const { error } = await supabase.from('estoque').insert([{
      clinica_id: form.clinica_id,
      nome: form.nome,
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

      <div className="grid grid-cols-3 gap-4 mb-6">
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

      <div className="flex gap-3 mb-4">
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
            Limpar filtro: {filtroStatus} ×
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-gray-400 text-center p-8">Carregando...</div>
      ) : itensFiltrados.length === 0 ? (
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
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

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
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors">
                  Cancelar
                </button>
                <button onClick={salvar} disabled={salvando}
                  className="flex-1 bg-green-700 hover:bg-green-600 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50">
                  {salvando ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}