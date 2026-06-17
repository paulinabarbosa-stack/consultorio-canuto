import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Rendimento() {
  const [dados, setDados] = useState<any[]>([])
  const [dentistas, setDentistas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [mes, setMes] = useState(new Date().toISOString().slice(0, 7))

  useEffect(() => { carregar() }, [mes])

  async function carregar() {
    setLoading(true)
    try {
      const inicio = mes + '-01'
      const fim = mes + '-31'
      const [{ data: at }, { data: de }] = await Promise.all([
        supabase.from('atendimentos')
          .select('*, dentistas(id, nome), clinicas(nome)')
          .gte('data_atendimento', inicio)
          .lte('data_atendimento', fim),
        supabase.from('dentistas').select('*')
      ])
      if (at && de) {
        const resumo = de.map(d => {
          const atsDent = at.filter(a => a.dentista_id === d.id)
          const totalProd = atsDent.reduce((acc, a) => acc + (parseFloat(a.valor) || 0), 0)
          const totalComPix = atsDent.filter(a => a.forma_pagamento !== 'Dinheiro').reduce((acc, a) => acc + (parseFloat(a.valor) || 0), 0)
          const totalComDin = atsDent.filter(a => a.forma_pagamento === 'Dinheiro').reduce((acc, a) => acc + (parseFloat(a.valor) || 0), 0)
          const comissaoPix = totalComPix * 0.36
          const comissaoDin = totalComDin * 0.40
          const totalComissao = comissaoPix + comissaoDin
          return {
            ...d,
            atendimentos: atsDent.length,
            producao: totalProd,
            comissao: totalComissao,
            liquido: totalProd - totalComissao,
            detalhe: atsDent
          }
        }).filter(d => d.atendimentos > 0)
          .sort((a, b) => b.producao - a.producao)
        setDados(resumo)
        setDentistas(de)
      }
    } catch (err) { console.error(err) }
    setLoading(false)
  }

  function fmt(v: number) {
    return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  const totalGeral = dados.reduce((acc, d) => acc + d.producao, 0)
  const totalComissoes = dados.reduce((acc, d) => acc + d.comissao, 0)
  const maxProd = Math.max(...dados.map(d => d.producao), 1)

  const CORES = ['#5dbc85', '#3c8ce0', '#c084fc', '#f472b6', '#67e8f9', '#e09a3c']

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-white text-lg font-bold">Rendimento Mensal</h2>
          <p className="text-gray-500 text-sm">Produção e comissões por dentista</p>
        </div>
        <input type="month" value={mes} onChange={e => setMes(e.target.value)}
          className="bg-gray-900 border border-gray-800 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" />
      </div>

      {/* Cards resumo */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="text-gray-500 text-xs mb-2">📈 Produção total</div>
          <div className="text-green-400 text-2xl font-bold">{fmt(totalGeral)}</div>
          <div className="text-gray-600 text-xs mt-1">{dados.reduce((acc, d) => acc + d.atendimentos, 0)} atendimentos</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="text-gray-500 text-xs mb-2">💸 Total comissões</div>
          <div className="text-yellow-400 text-2xl font-bold">{fmt(totalComissoes)}</div>
          <div className="text-gray-600 text-xs mt-1">{dados.length} dentistas ativos</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="text-gray-500 text-xs mb-2">💰 Líquido clínica</div>
          <div className="text-green-400 text-2xl font-bold">{fmt(totalGeral - totalComissoes)}</div>
          <div className="text-gray-600 text-xs mt-1">após comissões</div>
        </div>
      </div>

      {loading ? (
        <div className="text-gray-400 text-center p-8">Carregando...</div>
      ) : dados.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
          <div className="text-4xl mb-3">📊</div>
          <div className="text-gray-400">Nenhum atendimento registrado neste período</div>
        </div>
      ) : (
        <>
          {/* Gráfico de barras */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
            <h3 className="text-white text-sm font-semibold mb-4">Produção por dentista</h3>
            <div className="space-y-3">
              {dados.map((d, i) => (
                <div key={d.id}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-white font-medium">{d.nome}</span>
                    <span style={{ color: CORES[i % CORES.length] }} className="font-bold">{fmt(d.producao)}</span>
                  </div>
                  <div className="h-6 bg-gray-800 rounded-lg overflow-hidden">
                    <div
                      className="h-full rounded-lg flex items-center px-2 transition-all duration-700"
                      style={{ width: `${(d.producao / maxProd) * 100}%`, background: CORES[i % CORES.length] }}>
                      <span className="text-white text-xs font-semibold">
                        {Math.round((d.producao / maxProd) * 100)}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tabela detalhada */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-800">
              <h3 className="text-white text-sm font-semibold">Detalhamento por dentista</h3>
              <p className="text-gray-500 text-xs mt-1">Pix/Cartão = 36% · Dinheiro = 40%</p>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left text-gray-500 text-xs px-5 py-3">Dentista</th>
                  <th className="text-center text-gray-500 text-xs px-4 py-3">Atendimentos</th>
                  <th className="text-right text-gray-500 text-xs px-4 py-3">Produção</th>
                  <th className="text-right text-gray-500 text-xs px-4 py-3">Comissão</th>
                  <th className="text-right text-gray-500 text-xs px-4 py-3">Líquido clínica</th>
                </tr>
              </thead>
              <tbody>
                {dados.map((d, i) => (
                  <tr key={d.id} className={i < dados.length - 1 ? 'border-b border-gray-800' : ''}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: CORES[i % CORES.length] }}></div>
                        <span className="text-white text-sm font-medium">{d.nome}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-400 text-sm">{d.atendimentos}</td>
                    <td className="px-4 py-3 text-right text-green-400 text-sm font-semibold">{fmt(d.producao)}</td>
                    <td className="px-4 py-3 text-right text-yellow-400 text-sm">{fmt(d.comissao)}</td>
                    <td className="px-4 py-3 text-right text-white text-sm font-semibold">{fmt(d.liquido)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-gray-700 bg-gray-800/50">
                  <td className="px-5 py-3 text-white font-bold text-sm">Total</td>
                  <td className="px-4 py-3 text-center text-white font-bold text-sm">{dados.reduce((acc, d) => acc + d.atendimentos, 0)}</td>
                  <td className="px-4 py-3 text-right text-green-400 font-bold text-sm">{fmt(totalGeral)}</td>
                  <td className="px-4 py-3 text-right text-yellow-400 font-bold text-sm">{fmt(totalComissoes)}</td>
                  <td className="px-4 py-3 text-right text-green-400 font-bold text-sm">{fmt(totalGeral - totalComissoes)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}