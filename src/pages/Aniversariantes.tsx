import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Aniversariantes() {
  const [pacientes, setPacientes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [mesSel, setMesSel] = useState(new Date().getMonth() + 1)
  const [clinicaIdUsuario, setClinicaIdUsuario] = useState<string | null>(null)

  const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

  useEffect(() => {
    async function carregarUsuario() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('usuarios').select('perfil, clinica_id').eq('auth_id', user.id).maybeSingle()
      if (data?.clinica_id) setClinicaIdUsuario(data.clinica_id)
    }
    carregarUsuario()
  }, [])

  useEffect(() => { carregar() }, [mesSel, clinicaIdUsuario])

  async function carregar() {
    setLoading(true)
    try {
      let query = supabase.from('pacientes').select('*, clinicas(nome), dentistas(nome)').not('data_nascimento', 'is', null)
      if (clinicaIdUsuario) query = query.eq('clinica_id', clinicaIdUsuario)
      const { data } = await query
      if (data) {
        const filtrados = data.filter(p => {
          const mes = new Date(p.data_nascimento).getMonth() + 1
          return mes === mesSel
        }).sort((a, b) => new Date(a.data_nascimento).getDate() - new Date(b.data_nascimento).getDate())
        setPacientes(filtrados)
      }
    } catch (err) { console.error(err) }
    setLoading(false)
  }

  function calcularIdade(data: string) {
    const hoje = new Date()
    const nasc = new Date(data)
    let idade = hoje.getFullYear() - nasc.getFullYear()
    if (hoje.getMonth() < nasc.getMonth() || (hoje.getMonth() === nasc.getMonth() && hoje.getDate() < nasc.getDate())) idade--
    return idade
  }

  function diasParaAniversario(data: string) {
    const hoje = new Date()
    const nasc = new Date(data)
    const aniv = new Date(hoje.getFullYear(), nasc.getMonth(), nasc.getDate())
    if (aniv < hoje) aniv.setFullYear(hoje.getFullYear() + 1)
    return Math.ceil((aniv.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))
  }

  function iniciais(nome: string) {
    return nome?.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
  }

  const msgWhatsApp = (nome: string) =>
    `Olá, ${nome.split(' ')[0]}! 🎂 A equipe dos Consultórios Thiago Canuto deseja um feliz aniversário! Que seu dia seja repleto de alegria e muitos motivos para sorrir. 😁✨`

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-white text-lg font-bold">Aniversariantes</h2>
          <p className="text-gray-500 text-sm">{pacientes.length} aniversariantes em {MESES[mesSel - 1]}</p>
        </div>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        {MESES.map((m, i) => (
          <button key={i} onClick={() => setMesSel(i + 1)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${mesSel === i + 1 ? 'bg-green-800 text-green-300' : 'bg-gray-900 text-gray-400 hover:text-white border border-gray-800'}`}>
            {m}
          </button>
        ))}
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6">
        <div className="text-white text-sm font-semibold mb-2">💬 Mensagem sugerida para WhatsApp</div>
        <div className="text-gray-400 text-sm italic leading-relaxed">
          "Olá, [Nome]! 🎂 A equipe dos Consultórios Thiago Canuto deseja um feliz aniversário! Que seu dia seja repleto de alegria e muitos motivos para sorrir. 😁✨"
        </div>
      </div>

      {loading ? (
        <div className="text-gray-400 text-center p-8">Carregando...</div>
      ) : pacientes.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
          <div className="text-4xl mb-3">🎂</div>
          <div className="text-gray-400">Nenhum aniversariante em {MESES[mesSel - 1]}</div>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          {pacientes.map((p, i) => {
            const dias = diasParaAniversario(p.data_nascimento)
            const hoje = dias === 0
            const diaNasc = new Date(p.data_nascimento).getDate()
            return (
              <div key={p.id} className={`flex items-center gap-4 px-5 py-4 ${i < pacientes.length - 1 ? 'border-b border-gray-800' : ''} ${hoje ? 'bg-green-900/10' : ''}`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${hoje ? 'bg-green-700 text-white' : 'bg-gray-700 text-gray-300'}`}>
                  {iniciais(p.nome)}
                </div>
                <div className="flex-1">
                  <div className="text-white font-semibold text-sm">{p.nome}</div>
                  <div className="text-gray-500 text-xs mt-0.5">
                    🎂 Dia {diaNasc} · {calcularIdade(p.data_nascimento)} anos · {p.clinicas?.nome}
                  </div>
                  {p.telefone && <div className="text-gray-600 text-xs">📱 {p.telefone}</div>}
                </div>
                <div className="flex items-center gap-3">
                  {hoje ? (
                    <span className="bg-green-800 text-green-300 text-xs font-bold px-3 py-1 rounded-full">🎉 Hoje!</span>
                  ) : (
                    <span className="bg-gray-800 text-gray-400 text-xs px-3 py-1 rounded-full">Em {dias} {dias === 1 ? 'dia' : 'dias'}</span>
                  )}
                  {p.telefone && (
                    <a href={`https://wa.me/55${p.telefone.replace(/\D/g,'')}?text=${encodeURIComponent(msgWhatsApp(p.nome))}`}
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