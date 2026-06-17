import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Clinicas() {
  const [clinicas, setClinicas] = useState<any[]>([])
  const [vinculos, setVinculos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setLoading(true)
    try {
      const [{ data: c }, { data: v }] = await Promise.all([
        supabase.from('clinicas').select('*').order('nome'),
        supabase.from('dentista_clinica').select('*, dentistas(nome)')
      ])
      if (c) setClinicas(c)
      if (v) setVinculos(v)
    } catch (err) { console.error(err) }
    setLoading(false)
  }

  function dentistasDaClinica(id: string) {
    return vinculos.filter(v => v.clinica_id === id)
  }

  function diasLabel(dias: string[]) {
    const map: Record<string, string> = { seg: 'Seg', ter: 'Ter', qua: 'Qua', qui: 'Qui', sex: 'Sex', sab: 'Sáb' }
    return dias.map(d => map[d] || d).join(', ')
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-white text-lg font-bold">Clínicas</h2>
          <p className="text-gray-500 text-sm">{clinicas.length} unidades cadastradas</p>
        </div>
      </div>

      {loading ? (
        <div className="text-gray-400 text-center p-8">Carregando...</div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {clinicas.map(c => {
            const dentistas = dentistasDaClinica(c.id)
            return (
              <div key={c.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-green-800 rounded-xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                    {c.nome.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-white font-bold">{c.nome}</div>
                    {c.telefone && <div className="text-gray-400 text-xs mt-0.5">📞 {c.telefone}</div>}
                    {c.endereco && <div className="text-gray-500 text-xs mt-0.5">📍 {c.endereco}</div>}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-gray-800 rounded-lg p-3">
                    <div className="text-gray-500 text-xs mb-1">Horário Seg-Sex</div>
                    <div className="text-white text-sm font-medium">
                      {c.horario_inicio?.slice(0,5) || '08:00'} – {c.horario_fim?.slice(0,5) || '18:00'}
                    </div>
                  </div>
                  <div className="bg-gray-800 rounded-lg p-3">
                    <div className="text-gray-500 text-xs mb-1">Sábado</div>
                    <div className="text-white text-sm font-medium">
                      {c.atende_sabado ? `08:00 – ${c.horario_sabado_fim?.slice(0,5) || '12:00'}` : 'Não atende'}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-2">Dentistas</div>
                  {dentistas.length === 0 ? (
                    <div className="text-gray-600 text-xs">Nenhum dentista vinculado</div>
                  ) : (
                    <div className="space-y-1.5">
                      {dentistas.map(v => (
                        <div key={v.id} className="bg-gray-800 rounded-lg px-3 py-2 flex items-center justify-between">
                          <span className="text-white text-xs font-medium">{v.dentistas?.nome}</span>
                          <span className="text-gray-400 text-xs">{diasLabel(v.dias_semana)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-gray-800">
                  <span className="bg-green-900/30 text-green-400 text-xs font-semibold px-3 py-1 rounded-full">
                    ✅ Ativa
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}