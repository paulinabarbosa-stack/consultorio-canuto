import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { ChevronDown, ChevronUp } from 'lucide-react'

export default function Rendimento() {
  const [dados, setDados] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [mes, setMes] = useState(new Date().toISOString().slice(0, 7))
  const [expandido, setExpandido] = useState<string | null>(null)

  useEffect(() => { carregar() }, [mes])

  async function carregar() {
    setLoading(true)
    try {
      const inicio = mes + '-01'
      const fim = mes + '-31'
      const [{ data: at }, { data: de }] = await Promise.all([
        supabase.from('atendimentos')
          .select('*, clinicas(nome), pacientes(nome), procedimentos(nome)')
          .gte('data_atendimento', inicio)
          .lte('data_atendimento', fim)
          .order('data_atendimento', { ascending: true }),
        supabase.from('dentistas').select('*')
      ])
      if (at && de) {
        const resumo = de.map((d: any) => {
          const atsDent = at.filter((a: any) => a.dentista_id === d.id)
          const totalPix = atsDent.filter((a: any) => a.forma_pagamento !== 'Dinheiro' && a.forma_pagamento !== 'Cheque').reduce((acc: number, a: any) => acc + (parseFloat(a.valor) || 0), 0)
          const totalDin = atsDent.filter((a: any) => a.forma_pagamento === 'Dinheiro' || a.forma_pagamento === 'Cheque').reduce((acc: number, a: any) => acc + (parseFloat(a.valor) || 0), 0)
          const totalProd = totalPix + totalDin
          const comissaoPix = totalPix * 0.36
          const comissaoDin = totalDin * 0.40
          const totalComissao = comissaoPix + comissaoDin
          return {
            ...d,
            atendimentos: atsDent,
            qtd: atsDent.length,
            producao: totalProd,
            comissao: totalComissao,
            liquido: totalProd - totalComissao,
          }
        }).filter((d: any) => d.qtd > 0)
          .sort((a: any, b: any) => b.producao - a.producao)
        setDados(resumo)
      }
    } catch (err) { console.error(err) }
    setLoading(false)
  }

  function fmt(v: number) {
    return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  function nomeProcedimento(a: any): string {
    if (a.procedimentos?.nome) return a.procedimentos.nome
    if (a.observacoes?.startsWith('Procedimento: ')) {
      return a.observacoes.split(' | ')[0].replace('Procedimento: ', '') + ' (Outros)'
    }
    return '—'
  }

  function pctComissao(a: any): number {
    return (a.forma_pagamento === 'Dinheiro' || a.forma_pagamento === 'Cheque') ? 40 : 36
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

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="text-gray-500 text-xs mb-2">📈 Produção total</div>
          <div className="text-green-400 text-2xl font-bold">{fmt(totalGeral)}</div>
          <div className="text-gray-600 text-xs mt-1">{dados.reduce((acc, d) => acc + d.qtd, 0)} atendimentos</div>
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
                    <div className="h-full rounded-lg flex items-center px-2 transition-all duration-700"
                      style={{ width: `${(d.producao / maxProd) * 100}%`, background: CORES[i % CORES.length] }}>
                      <span className="text-white text-xs font-semibold">{Math.round((d.producao / maxProd) * 100)}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Detalhamento por dentista expansível */}
          <div className="space-y-3">
            {dados.map((d, i) => (
              <div key={d.id} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">

                {/* Cabeçalho do dentista — clicável */}
                <button
                  onClick={() => setExpandido(expandido === d.id ? null : d.id)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-800/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: CORES[i % CORES.length] }} />
                    <span className="text-white font-semibold">{d.nome}</span>
                    <span className="text-gray-500 text-xs">{d.qtd} atendimento{d.qtd !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Produção</p>
                      <p className="text-green-400 font-bold text-sm">{fmt(d.producao)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Comissão</p>
                      <p className="text-yellow-400 font-bold text-sm">{fmt(d.comissao)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Líquido</p>
                      <p className="text-white font-bold text-sm">{fmt(d.liquido)}</p>
                    </div>
                    <div className="text-gray-500 ml-2">
                      {expandido === d.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </div>
                  </div>
                </button>

                {/* Tabela de atendimentos expandida */}
                {expandido === d.id && (
                  <div className="border-t border-gray-800">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-800/60 text-xs text-gray-500 uppercase tracking-wide">
                          <th className="px-5 py-2 text-left font-medium">Data</th>
                          <th className="px-4 py-2 text-left font-medium">Paciente</th>
                          <th className="px-4 py-2 text-left font-medium">Procedimento</th>
                          <th className="px-4 py-2 text-left font-medium">Clínica</th>
                          <th className="px-4 py-2 text-left font-medium">Pagamento</th>
                          <th className="px-4 py-2 text-right font-medium">Valor</th>
                          <th className="px-4 py-2 text-right font-medium">Comissão</th>
                        </tr>
                      </thead>
                      <tbody>
                        {d.atendimentos.map((a: any, j: number) => {
                          const pct = pctComissao(a)
                          const com = (parseFloat(a.valor) || 0) * pct / 100
                          return (
                            <tr key={a.id} className={j % 2 === 0 ? 'bg-gray-900' : 'bg-gray-800/30'}>
                              <td className="px-5 py-2.5 text-gray-400 whitespace-nowrap">
                                {new Date(a.data_atendimento).toLocaleDateString('pt-BR')}
                              </td>
                              <td className="px-4 py-2.5 text-white font-medium">{a.pacientes?.nome || '—'}</td>
                              <td className="px-4 py-2.5 text-gray-400">{nomeProcedimento(a)}</td>
                              <td className="px-4 py-2.5 text-gray-400">{a.clinicas?.nome || '—'}</td>
                              <td className="px-4 py-2.5 text-gray-400">{a.forma_pagamento}</td>
                              <td className="px-4 py-2.5 text-right text-green-400 font-semibold">{fmt(parseFloat(a.valor))}</td>
                              <td className="px-4 py-2.5 text-right text-yellow-400">
                                {pct}% = {fmt(com)}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-gray-700 bg-gray-800/70">
                          <td colSpan={5} className="px-5 py-3 text-white font-bold text-sm">Total {d.nome}</td>
                          <td className="px-4 py-3 text-right text-green-400 font-bold">{fmt(d.producao)}</td>
                          <td className="px-4 py-3 text-right text-yellow-400 font-bold">{fmt(d.comissao)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}