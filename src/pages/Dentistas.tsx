import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Dentistas() {
  const [dentistas, setDentistas] = useState<any[]>([])
  const [vinculos, setVinculos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setLoading(true)
    try {
      const [{ data: d }, { data: v }] = await Promise.all([
        supabase.from('dentistas').select('*').order('nome'),
        supabase.from('dentista_clinica').select('*, clinicas(nome), dentistas(nome)')
      ])
      if (d) setDentistas(d)
      if (v) setVinculos(v)
    } catch (err) { console.error(err) }
    setLoading(false)
  }

  function iniciais(nome: string) {
    return nome?.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
  }

  function clinicasDentista(id: string) {
    return vinculos.filter(v => v.dentista_id === id)
  }

  function diasLabel(dias: string[]) {
    const map: Record<string, string> = { seg: 'Seg', ter: 'Ter', qua: 'Qua', qui: 'Qui', sex: 'Sex', sab: 'Sáb' }
    return dias.map(d => map[d] || d).join(', ')
  }

  const CORES = ['#5dbc85', '#3c8ce0', '#c084fc', '#f472b6', '#67e8f9', '#e09a3c']

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-white text-lg font-bold">Dentistas</h2>
          <p className="text-gray-500 text-sm">{dentistas.length} profissionais cadastrados</p>
        </div>
      </div>

      {loading ? (
        <div className="text-gray-400 text-center p-8">Carregando...</div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {dentistas.map((d, i) => {
            const clinicas = clinicasDentista(d.id)
            return (
              <div key={d.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-base font-bold text-white flex-shrink-0"
                    style={{ background: CORES[i % CORES.length] }}>
                    {iniciais(d.nome)}
                  </div>
                  <div>
                    <div className="text-white font-bold text-sm">{d.nome}</div>
                    {d.cro && <div className="text-gray-500 text-xs">{d.cro}</div>}
                    <div className="text-gray-400 text-xs mt-0.5">{d.especialidade || 'Todos os procedimentos'}</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-2">Clínicas e dias</div>
                  {clinicas.length === 0 ? (
                    <div className="text-gray-600 text-xs">Nenhum vínculo cadastrado</div>
                  ) : clinicas.map(v => (
                    <div key={v.id} className="bg-gray-800 rounded-lg px-3 py-2 flex items-center justify-between">
                      <span className="text-white text-xs font-medium">{v.clinicas?.nome}</span>
                      <span className="text-gray-400 text-xs">{diasLabel(v.dias_semana)}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-4 pt-3 border-t border-gray-800 flex items-center justify-between">
                  <div className="text-gray-500 text-xs">Comissão</div>
                  <div className="text-yellow-400 text-xs font-semibold">
                    {d.nome === 'Dr. Thiago Canuto' ? 'Proprietário' : 'Pix/Cartão 36% · Dinheiro 40%'}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}