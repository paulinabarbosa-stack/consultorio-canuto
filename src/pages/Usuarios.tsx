import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { Users, Plus, X, Pencil, Trash2, Shield, Eye, EyeOff } from "lucide-react";

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface Clinica { id: string; nome: string; }

interface Usuario {
  id: string;
  auth_id: string;
  nome: string;
  email: string;
  perfil: "administrador" | "gerente" | "secretaria";
  clinica_id: string | null;
  clinica_nome?: string;
  created_at: string;
}

// ─── Constantes ──────────────────────────────────────────────────────────────

const PERFIS = [
  { value: "administrador", label: "Administrador", descricao: "Acesso total ao sistema", cor: "bg-purple-100 text-purple-800 border-purple-200" },
  { value: "gerente",       label: "Gerente",       descricao: "Acesso total ao sistema", cor: "bg-blue-100 text-blue-800 border-blue-200" },
  { value: "secretaria",    label: "Secretária",    descricao: "Acesso somente à sua clínica", cor: "bg-green-100 text-green-800 border-green-200" },
];

function perfilCor(perfil: string) {
  return PERFIS.find(p => p.value === perfil)?.cor ?? "bg-gray-100 text-gray-600 border-gray-200";
}
function perfilLabel(perfil: string) {
  return PERFIS.find(p => p.value === perfil)?.label ?? perfil;
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [clinicas, setClinicas] = useState<Clinica[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<Usuario | null>(null);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState<string | null>(null);

  async function carregar() {
    setLoading(true);
    const { data: cl } = await supabase.from("clinicas").select("id, nome").order("nome");
    if (cl) setClinicas(cl);

    const { data: us } = await supabase
      .from("usuarios")
      .select("id, auth_id, nome, email, perfil, clinica_id, created_at")
      .order("nome");

    if (us && cl) {
      setUsuarios(us.map((u: any) => ({
        ...u,
        clinica_nome: cl.find((c: Clinica) => c.id === u.clinica_id)?.nome ?? "—",
      })));
    }
    setLoading(false);
  }

  useEffect(() => { carregar(); }, []);

  async function excluir(id: string, authId: string) {
    // Remove da tabela usuarios
    await supabase.from("usuarios").delete().eq("id", id);
    // Remove do Auth do Supabase via admin (só funciona com service role — orientar fazer manual se necessário)
    setConfirmandoExclusao(null);
    carregar();
  }

  return (
    <div className="max-w-5xl mx-auto">

      {/* Cabeçalho */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Shield size={22} className="text-blue-600" /> Usuários e Acessos
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Gerencie quem tem acesso ao sistema e a quais clínicas</p>
        </div>
        <button
          onClick={() => { setEditando(null); setModalAberto(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
          <Plus size={16} /> Novo Usuário
        </button>
      </div>

      {/* Cards de perfil */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {PERFIS.map(p => {
          const qtd = usuarios.filter(u => u.perfil === p.value).length;
          return (
            <div key={p.value} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-1">
                <span className={`text-xs px-2 py-0.5 rounded border font-medium ${p.cor}`}>{p.label}</span>
                <span className="text-2xl font-bold text-gray-700">{qtd}</span>
              </div>
              <p className="text-xs text-gray-400">{p.descricao}</p>
            </div>
          );
        })}
      </div>

      {/* Tabela de usuários */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
          <h3 className="font-semibold text-gray-700 flex items-center gap-2">
            <Users size={16} className="text-blue-600" />
            Usuários cadastrados ({usuarios.length})
          </h3>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-400 text-sm">Carregando...</div>
        ) : usuarios.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">Nenhum usuário cadastrado.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100">
                <th className="px-5 py-3 text-left font-medium">Nome</th>
                <th className="px-5 py-3 text-left font-medium">E-mail</th>
                <th className="px-5 py-3 text-left font-medium">Perfil</th>
                <th className="px-5 py-3 text-left font-medium">Clínica</th>
                <th className="px-5 py-3 text-left font-medium">Cadastrado em</th>
                <th className="px-5 py-3 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u, i) => (
                <tr key={u.id} className={`border-b border-gray-50 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/30"}`}>
                  <td className="px-5 py-3 font-medium text-gray-800">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {u.nome.charAt(0).toUpperCase()}
                      </div>
                      {u.nome}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-gray-500">{u.email}</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded border font-medium ${perfilCor(u.perfil)}`}>
                      {perfilLabel(u.perfil)}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-600">
                    {u.perfil === "secretaria" ? (u.clinica_nome ?? "—") : (
                      <span className="text-xs text-gray-400 italic">Todas as clínicas</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-gray-400 text-xs">
                    {new Date(u.created_at).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => { setEditando(u); setModalAberto(true); }}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Editar">
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => setConfirmandoExclusao(u.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Excluir">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal: Criar / Editar */}
      {modalAberto && (
        <ModalUsuario
          usuario={editando}
          clinicas={clinicas}
          onClose={() => { setModalAberto(false); setEditando(null); }}
          onSalvo={() => { setModalAberto(false); setEditando(null); carregar(); }}
        />
      )}

      {/* Modal: Confirmar exclusão */}
      {confirmandoExclusao && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 className="font-semibold text-gray-800 mb-2">Confirmar exclusão</h3>
            <p className="text-sm text-gray-500 mb-6">
              Tem certeza que deseja remover este usuário? Esta ação não pode ser desfeita.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmandoExclusao(null)}
                className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">
                Cancelar
              </button>
              <button
                onClick={() => {
                  const u = usuarios.find(u => u.id === confirmandoExclusao);
                  if (u) excluir(u.id, u.auth_id);
                }}
                className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700">
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Modal: Criar / Editar Usuário ───────────────────────────────────────────

function ModalUsuario({ usuario, clinicas, onClose, onSalvo }: {
  usuario: Usuario | null;
  clinicas: Clinica[];
  onClose: () => void;
  onSalvo: () => void;
}) {
  const editando = !!usuario;
  const [nome, setNome] = useState(usuario?.nome ?? "");
  const [email, setEmail] = useState(usuario?.email ?? "");
  const [perfil, setPerfil] = useState(usuario?.perfil ?? "secretaria");
  const [clinicaId, setClinicaId] = useState(usuario?.clinica_id ?? "");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  async function salvar() {
    setErro("");
    if (!nome || !email) { setErro("Nome e e-mail são obrigatórios."); return; }
    if (!editando && !senha) { setErro("Informe uma senha para o novo usuário."); return; }
    if (perfil === "secretaria" && !clinicaId) { setErro("Secretária precisa ter uma clínica vinculada."); return; }

    setSalvando(true);

    if (editando && usuario) {
      // Atualizar dados na tabela usuarios
      const { error } = await supabase.from("usuarios").update({
        nome,
        email,
        perfil,
        clinica_id: perfil === "secretaria" ? clinicaId : null,
      }).eq("id", usuario.id);

      if (error) { setErro("Erro ao atualizar: " + error.message); setSalvando(false); return; }

    } else {
      // Criar usuário no Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password: senha,
        options: { data: { nome } }
      });

      if (authError || !authData.user) {
        setErro("Erro ao criar acesso: " + (authError?.message ?? "tente novamente"));
        setSalvando(false);
        return;
      }

      // Inserir na tabela usuarios
      const { error: dbError } = await supabase.from("usuarios").insert({
        auth_id: authData.user.id,
        nome,
        email,
        perfil,
        clinica_id: perfil === "secretaria" ? clinicaId : null,
      });

      if (dbError) { setErro("Usuário criado no Auth mas erro ao salvar perfil: " + dbError.message); setSalvando(false); return; }
    }

    setSalvando(false);
    onSalvo();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <Shield size={17} className="text-blue-600" />
            {editando ? "Editar Usuário" : "Novo Usuário"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={19} /></button>
        </div>

        <div className="px-6 py-4 flex flex-col gap-4">
          {erro && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
              {erro}
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Nome completo *</label>
            <input type="text" value={nome} onChange={e => setNome(e.target.value)}
              placeholder="Ex: Lúcia Ferreira"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">E-mail *</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="email@exemplo.com"
              disabled={editando}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400" />
            {editando && <p className="text-xs text-gray-400 mt-1">E-mail não pode ser alterado.</p>}
          </div>

          {!editando && (
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Senha inicial *</label>
              <div className="relative">
                <input
                  type={mostrarSenha ? "text" : "password"}
                  value={senha} onChange={e => setSenha(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <button type="button" onClick={() => setMostrarSenha(!mostrarSenha)}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600">
                  {mostrarSenha ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1">O usuário poderá alterar a senha depois.</p>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Perfil de acesso *</label>
            <div className="flex flex-col gap-2">
              {PERFIS.map(p => (
                <label key={p.value}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-colors ${perfil === p.value ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:bg-gray-50"}`}>
                  <input type="radio" name="perfil" value={p.value}
                    checked={perfil === p.value} onChange={() => setPerfil(p.value as any)}
                    className="accent-blue-600" />
                  <div>
                    <span className={`text-xs px-2 py-0.5 rounded border font-medium ${p.cor}`}>{p.label}</span>
                    <p className="text-xs text-gray-400 mt-0.5">{p.descricao}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {perfil === "secretaria" && (
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Clínica vinculada *</label>
              <select value={clinicaId} onChange={e => setClinicaId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Selecione a clínica</option>
                {clinicas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Cancelar</button>
          <button onClick={salvar} disabled={salvando}
            className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {salvando ? "Salvando..." : editando ? "Salvar alterações" : "Criar usuário"}
          </button>
        </div>
      </div>
    </div>
  );
}