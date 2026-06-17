import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Retornos() {
  const [pacientes, setPacientes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroDias, setFiltroDias] = useState(30)

  useEffect(() => { carregar() }, [filtroDias])

  async function carregar() {
    setLoading(true)
    try {
      const { data: ats } = await supabase
        .from('atendimentos')
        .select('paciente_id, data_atendimento, pacientes(id, nome, telefone, clinicas(nome), dentistas(nome))')
        .order('data_atendimento', { ascending: false })

      if (ats) {
        const hoje = new Date()
        const ultimoAt: Record<string, any> = {}
        ats.forEach(a => {
          if (!ultimoAt[a.paciente_id]) ultimoAt[a.paciente_id] = a
        })
        const atrasados = Object.values(ultimoAt).filter(a => {
          const diff = Math.floor((hoje.getTime() - new Date(a.data_atendimento).getTime()) / (1000 * 60 * 60 * 24))
          return diff >= filtroDias
        }).map(a => ({
          ...a.pacientes,
          ultima_visita: a.data_atendimento,
          dias_ausente: Math.floor((hoje.getTime() - new Date(a.data_atendimento).getTime()) / (1000 * 60 * 60 * 24))
        })).sort((a, b) => b.dias_ausente - a.dias_ausente)
        setPacientes(atrasados)
      }
    } catch (err) { console.error(err) }
    setLoading(false)
  }

  function iniciais(nome: string) {
    return nome?.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
  }

  function urgencia(dias: number) {
    if (dias >= 90) return { label: 'Urgente', cor: 'bg-red-900/30 text-red-400' }
    if (dias >= 60) return { label: 'Atenção', cor: 'bg-yellow-900/30 text-yellow-400' }
    return { label: 'Normal', cor: 'bg-gray-800 text-gray-400' }
  }

  const msg = (nome: string) =>
    `Olá, ${nome.split(' ')[0]}! 😊 A equipe dos Consultórios Thiago Canuto está com saudades! Já faz um tempinho desde sua última visita. Que tal agendar uma consulta de revisão? Estamos à disposição! 🦷✨`

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-white text-lg font-bold">Retornos</h2>
          <p className="text-gray-500 text-sm">{pacientes.length} pacientes sem consulta há mais de {filtroDias} dias</p>
        </div>
      </div>

      {/* Filtro */}
      <div className="flex gap-2 mb-6">
        {[30, 45, 60, 90].map(d => (
          <button key={d} onClick={() => setFiltroDias(d)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${filtroDias === d ? 'bg-green-800 text-green-300' : 'bg-gray-900 text-gray-400 hover:text-white border border-gray-800'}`}>
            +{d} dias
          </button>
        ))}
      </div>

      {/* Mensagem sugerida */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6">
        <div className="text-white text-sm font-semibold mb-2">💬 Mensagem sugerida</div>
        <div className="text-gray-400 text-sm italic leading-relaxed">
          "Olá, [Nome]! 😊 A equipe dos Consultórios Thiago Canuto está com saudades! Já faz um tempinho desde sua última visita. Que tal agendar uma consulta de revisão? Estamos à disposição! 🦷✨"
        </div>
      </div>

      {loading ? (
        <div className="text-gray-400 text-center p-8">Carregando...</div>
      ) : pacientes.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
          <div className="text-4xl mb-3">✅</div>
          <div className="text-gray-400 font-medium">Nenhum paciente em atraso!</div>
          <div className="text-gray-600 text-sm mt-1">Todos os pacientes consultaram nos últimos {filtroDias} dias</div>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          {pacientes.map((p, i) => {
            const urg = urgencia(p.dias_ausente)
            return (
              <div key={p.id} className={`flex items-center gap-4 px-5 py-4 ${i < pacientes.length - 1 ? 'border-b border-gray-800' : ''}`}>
                <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center text-sm font-bold text-gray-300 flex-shrink-0">
                  {iniciais(p.nome)}
                </div>
                <div className="flex-1">
                  <div className="text-white font-semibold text-sm">{p.nome}</div>
                  <div className="text-gray-500 text-xs mt-0.5">
                    Última visita: {new Date(p.ultima_visita).toLocaleDateString('pt-BR')} · {p.clinicas?.nome}
                    {p.dentistas?.nome && ` · ${p.dentistas.nome}`}
                  </div>
                  {p.telefone && <div className="text-gray-600 text-xs">📱 {p.telefone}</div>}
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-semibold px-3 py-1 rounded-full ${urg.cor}`}>
                    {p.dias_ausente} dias · {urg.label}
                  </span>
                  {p.telefone && (
                    <a href={`https://wa.me/55${p.telefone.replace(/\D/g,'')}?text=${encodeURIComponent(msg(p.nome))}`}
                      target="_blank" rel="noreferrer"
                      className="bg-green-800 hover:bg-green-700 text-white text-xs px-3 py-1.5 rounded-lg transition-colors">
                      💬 WhatsApp
                    </a>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}