import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Dashboard from '../pages/Dashboard'
import Pacientes from '../pages/Pacientes'
import Agendamentos from '../pages/Agendamentos'
import Atendimentos from '../pages/Atendimentos'
import Financeiro from '../pages/Financeiro'
import Estoque from '../pages/Estoque'
import Rendimento from '../pages/Rendimento'

const menus = [
  { path: '/', label: 'Dashboard', icon: '📊' },
  { path: '/agenda', label: 'Agenda', icon: '📅' },
  { path: '/agendamentos', label: 'Agendamentos', icon: '🗓️' },
  { path: '/atendimentos', label: 'Atendimentos', icon: '🦷' },
  { path: '/pacientes', label: 'Pacientes / CRM', icon: '👥' },
  { path: '/aniversariantes', label: 'Aniversariantes', icon: '🎂' },
  { path: '/retornos', label: 'Retornos', icon: '🔔' },
  { path: '/financeiro', label: 'Financeiro', icon: '💰' },
  { path: '/rendimento', label: 'Rendimento', icon: '📈' },
  { path: '/estoque', label: 'Estoque', icon: '📦' },
  { path: '/dentistas', label: 'Dentistas', icon: '👨‍⚕️' },
  { path: '/clinicas', label: 'Clínicas', icon: '🏥' },
  { path: '/usuarios', label: 'Usuários', icon: '🔐' },
]

export default function Layout() {
  const navigate = useNavigate()
  const location = useLocation()

  async function sair() {
    await supabase.auth.signOut()
  }

  const paginaAtual = menus.find(m => m.path === location.pathname)

  return (
    <div className="min-h-screen bg-gray-950 flex">
      <div className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col flex-shrink-0">
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-green-700 rounded-lg flex items-center justify-center text-lg">🦷</div>
            <div>
              <div className="text-white text-xs font-bold leading-tight">Consultórios</div>
              <div className="text-green-500 text-xs">Thiago Canuto</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-2 overflow-y-auto">
          <div className="text-gray-600 text-xs font-bold uppercase tracking-wider px-2 py-2">Principal</div>
          {menus.slice(0, 4).map(m => (
            <button key={m.path} onClick={() => navigate(m.path)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm mb-0.5 transition-colors ${location.pathname === m.path ? 'bg-green-900 text-green-300' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}>
              <span>{m.icon}</span><span>{m.label}</span>
            </button>
          ))}
          <div className="text-gray-600 text-xs font-bold uppercase tracking-wider px-2 py-2 mt-2">Pacientes</div>
          {menus.slice(4, 7).map(m => (
            <button key={m.path} onClick={() => navigate(m.path)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm mb-0.5 transition-colors ${location.pathname === m.path ? 'bg-green-900 text-green-300' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}>
              <span>{m.icon}</span><span>{m.label}</span>
            </button>
          ))}
          <div className="text-gray-600 text-xs font-bold uppercase tracking-wider px-2 py-2 mt-2">Gestão</div>
          {menus.slice(7, 10).map(m => (
            <button key={m.path} onClick={() => navigate(m.path)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm mb-0.5 transition-colors ${location.pathname === m.path ? 'bg-green-900 text-green-300' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}>
              <span>{m.icon}</span><span>{m.label}</span>
            </button>
          ))}
          <div className="text-gray-600 text-xs font-bold uppercase tracking-wider px-2 py-2 mt-2">Administração</div>
          {menus.slice(10).map(m => (
            <button key={m.path} onClick={() => navigate(m.path)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm mb-0.5 transition-colors ${location.pathname === m.path ? 'bg-green-900 text-green-300' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}>
              <span>{m.icon}</span><span>{m.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-gray-800">
          <button onClick={sair} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-400 hover:bg-gray-800 hover:text-white transition-colors">
            <span>🚪</span><span>Sair</span>
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center justify-between">
          <h1 className="text-white font-semibold flex items-center gap-2">
            <span>{paginaAtual?.icon}</span>
            <span>{paginaAtual?.label || 'Dashboard'}</span>
          </h1>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/pacientes" element={<Pacientes />} />
            <Route path="/agendamentos" element={<Agendamentos />} />
            <Route path="/atendimentos" element={<Atendimentos />} />
            <Route path="/financeiro" element={<Financeiro />} />
            <Route path="/estoque" element={<Estoque />} />
            <Route path="/rendimento" element={<Rendimento />} />
            <Route path="/rendimento" element={<Rendimento />} />
          </Routes>
        </div>
      </div>
    </div>
  )
}