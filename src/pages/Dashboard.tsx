import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Dashboard() {
  const [clinicas, setClinicas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function carregar() {
      // Busca o perfil do usuário logado
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: usuario } = await supabase
        .from('usuarios')
        .select('perfil, clinica_id')
        .eq('auth_id', user.id)
        .maybeSingle()

      let query = supabase.from('clinicas').select('*').order('nome')

      // Se for secretária, filtra apenas a clínica dela
      if (usuario?.perfil === 'secretaria' && usuario?.clinica_id) {
        query = query.eq('id', usuario.clinica_id)
      }

      const { data } = await query
      if (data) setClinicas(data)
      setLoading(false)
    }
    carregar()
  }, [])

  if (loading) return <div className="text-gray-400">Carregando...</div>

  return (
    <div>
      {/* Cards de resumo */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="text-gray-400 text-xs mb-2 flex items-center gap-1">📅 Consultas hoje</div>
          <div className="text-blue-400 text-2xl font-bold">0</div>
          <div className="text-gray-600 text-xs mt-1">nas {clinicas.length} clínica{clinicas.length !== 1 ? 's' : ''}</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="text-gray-400 text-xs mb-2 flex items-center gap-1">👥 Pacientes ativos</div>
          <div className="text-verde-500 text-2xl font-bold">0</div>
          <div className="text-gray-600 text-xs mt-1">cadastrados</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="text-gray-400 text-xs mb-2 flex items-center gap-1">💰 Receita (mês)</div>
          <div className="text-verde-500 text-2xl font-bold">R$ 0</div>
          <div className="text-gray-600 text-xs mt-1">mês atual</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="text-gray-400 text-xs mb-2 flex items-center gap-1">🎂 Aniversariantes</div>
          <div className="text-yellow-400 text-2xl font-bold">0</div>
          <div className="text-gray-600 text-xs mt-1">este mês</div>
        </div>
      </div>

      {/* Clínicas */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
            <span className="text-white text-sm font-semibold">🏥 Clínicas</span>
            <span className="text-gray-500 text-xs">{clinicas.length} unidade{clinicas.length !== 1 ? 's' : ''}</span>
          </div>
          <div>
            {clinicas.map(c => (
              <div key={c.id} className="flex items-center gap-3 px-4 py-3 border-b border-gray-800 last:border-0">
                <div className="w-8 h-8 bg-verde-700 rounded-lg flex items-center justify-center text-xs font-bold text-verde-300">
                  {c.nome.substring(0, 2).toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="text-white text-sm font-medium">{c.nome}</div>
                  <div className="text-gray-500 text-xs">{c.telefone}</div>
                </div>
                <span className="text-xs bg-verde-900/40 text-verde-400 px-2 py-0.5 rounded-full">Ativa</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800">
            <span className="text-white text-sm font-semibold">📋 Próximos agendamentos</span>
          </div>
          <div className="px-4 py-8 text-center">
            <div className="text-gray-600 text-sm">Nenhum agendamento hoje</div>
          </div>
        </div>
      </div>
    </div>
  )
}