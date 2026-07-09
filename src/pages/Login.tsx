import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Eye, EyeOff } from 'lucide-react'

export default function Login() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)

  async function entrar(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setErro('')
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
    if (error) setErro('E-mail ou senha incorretos')
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-verde-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🦷</span>
          </div>
          <h1 className="text-white text-2xl font-bold">Consultórios</h1>
          <p className="text-verde-500 font-semibold">Thiago Canuto</p>
          <p className="text-gray-500 text-sm mt-1">Sistema de Gestão</p>
        </div>

        <form onSubmit={entrar} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
          {erro && (
            <div className="bg-red-900/30 border border-red-700 text-red-400 text-sm rounded-lg p-3">
              {erro}
            </div>
          )}
          <div>
            <label className="text-gray-400 text-xs font-medium block mb-2">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-verde-600"
              placeholder="seu@email.com"
              required
            />
          </div>
          <div>
            <label className="text-gray-400 text-xs font-medium block mb-2">Senha</label>
            <div className="relative">
              <input
                type={mostrarSenha ? 'text' : 'password'}
                value={senha}
                onChange={e => setSenha(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5 pr-10 text-sm focus:outline-none focus:border-verde-600"
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setMostrarSenha(!mostrarSenha)}
                className="absolute right-3 top-2.5 text-gray-500 hover:text-gray-300 transition-colors"
              >
                {mostrarSenha ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-verde-600 hover:bg-verde-500 text-white font-semibold rounded-lg py-2.5 text-sm transition-colors disabled:opacity-50"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <p className="text-center text-gray-600 text-xs mt-6">
          Inova IA Soluções · Diamantina MG
        </p>
      </div>
    </div>
  )
}