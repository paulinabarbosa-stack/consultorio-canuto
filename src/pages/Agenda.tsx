import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { ChevronLeft, ChevronRight, Calendar, Clock, Plus, X, User } from "lucide-react";

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface Clinica {
  id: string;
  nome: string;
}

interface Dentista {
  id: string;
  nome: string;
  dias_semana: string[];
}

interface Paciente {
  id: string;
  nome: string;
}

interface Procedimento {
  id: string;
  nome: string;
}

interface Agendamento {
  id: string;
  paciente_id: string;
  paciente_nome?: string;
  dentista_id: string;
  clinica_id: string;
  procedimento_id: string;
  procedimento_nome?: string;
  data_hora: string; // ISO timestamp
  status: "agendado" | "confirmado" | "realizado" | "cancelado" | "faltou";
  observacoes?: string;
}

// ─── Constantes ──────────────────────────────────────────────────────────────

const DIAS = [
  { key: "seg", label: "Seg", offset: 0 },
  { key: "ter", label: "Ter", offset: 1 },
  { key: "qua", label: "Qua", offset: 2 },
  { key: "qui", label: "Qui", offset: 3 },
  { key: "sex", label: "Sex", offset: 4 },
  { key: "sab", label: "Sáb", offset: 5 },
];

const HORARIOS: string[] = [];
for (let h = 8; h <= 18; h++) {
  HORARIOS.push(`${String(h).padStart(2, "0")}:00`);
  if (h < 18) HORARIOS.push(`${String(h).padStart(2, "0")}:30`);
}

const STATUS_CONFIG: Record<string, { label: string; cor: string }> = {
  agendado:   { label: "Agendado",   cor: "bg-blue-100 text-blue-800 border-blue-200" },
  confirmado: { label: "Confirmado", cor: "bg-green-100 text-green-800 border-green-200" },
  realizado:  { label: "Realizado",  cor: "bg-gray-100 text-gray-500 border-gray-200" },
  cancelado:  { label: "Cancelado",  cor: "bg-red-100 text-red-700 border-red-200" },
  faltou:     { label: "Faltou",     cor: "bg-orange-100 text-orange-700 border-orange-200" },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function toISO(date: Date): string {
  return date.toISOString().split("T")[0];
}

function formatWeekRange(monday: Date): string {
  const saturday = addDays(monday, 5);
  return `${monday.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} – ${saturday.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}`;
}

function extrairHora(dataHora: string): string {
  const d = new Date(dataHora);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function extrairData(dataHora: string): string {
  return new Date(dataHora).toISOString().split("T")[0];
}

function isAlmoco(hora: string): boolean {
  const h = parseInt(hora.split(":")[0]);
  return h === 12 || h === 13;
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function Agenda() {
  const [clinicas, setClinicas] = useState<Clinica[]>([]);
  const [dentistas, setDentistas] = useState<Dentista[]>([]);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [clinicaSelecionada, setClinicaSelecionada] = useState<string>("");
  const [dentistaSelecionado, setDentistaSelecionado] = useState<string>("todos");
  const [semanaBase, setSemanaBase] = useState<Date>(getMondayOfWeek(new Date()));
  const [loading, setLoading] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [celulaSelecionada, setCelulaSelecionada] = useState<{ data: string; hora: string } | null>(null);
  const [detalhe, setDetalhe] = useState<Agendamento | null>(null);
  const [perfilAdmin, setPerfilAdmin] = useState(true);

  // Carregar perfil do usuário logado
  useEffect(() => {
    async function carregarUsuario() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("usuarios")
        .select("perfil, clinica_id")
        .eq("auth_id", user.id)
        .maybeSingle();
      if (data) {
        setPerfilAdmin(data.perfil !== "secretaria");
        if (data.clinica_id) setClinicaSelecionada(data.clinica_id);
      }
    }
    carregarUsuario();
  }, []);

  // Carregar clínicas
  useEffect(() => {
    supabase.from("clinicas").select("id, nome").order("nome").then(({ data }) => {
      if (data) {
        setClinicas(data);
        if (!clinicaSelecionada && data.length > 0) setClinicaSelecionada(data[0].id);
      }
    });
  }, []);

  // Carregar dentistas da clínica
  useEffect(() => {
    if (!clinicaSelecionada) return;
    supabase
      .from("dentista_clinica")
      .select("dias_semana, dentistas(id, nome)")
      .eq("clinica_id", clinicaSelecionada)
      .then(({ data }) => {
        if (data) {
          const lista: Dentista[] = data.map((r: any) => ({
            id: r.dentistas.id,
            nome: r.dentistas.nome,
            dias_semana: r.dias_semana ?? ["seg","ter","qua","qui","sex"],
          }));
          setDentistas(lista);
          setDentistaSelecionado("todos");
        }
      });
  }, [clinicaSelecionada]);

  // Carregar agendamentos da semana
  useEffect(() => {
    if (!clinicaSelecionada) return;
    async function carregar() {
      setLoading(true);
      const inicio = toISO(semanaBase) + "T00:00:00";
      const fim = toISO(addDays(semanaBase, 5)) + "T23:59:59";

      let query = supabase
        .from("agendamentos")
        .select(`
          id, paciente_id, dentista_id, clinica_id, procedimento_id,
          data_hora, status, observacoes,
          pacientes(nome),
          procedimentos(nome)
        `)
        .eq("clinica_id", clinicaSelecionada)
        .gte("data_hora", inicio)
        .lte("data_hora", fim)
        .order("data_hora");

      if (dentistaSelecionado !== "todos") {
        query = query.eq("dentista_id", dentistaSelecionado);
      }

      const { data } = await query;
      if (data) {
        const lista: Agendamento[] = data.map((r: any) => ({
          id: r.id,
          paciente_id: r.paciente_id,
          paciente_nome: r.pacientes?.nome ?? "—",
          dentista_id: r.dentista_id,
          clinica_id: r.clinica_id,
          procedimento_id: r.procedimento_id,
          procedimento_nome: r.procedimentos?.nome ?? "—",
          data_hora: r.data_hora,
          status: r.status,
          observacoes: r.observacoes,
        }));
        setAgendamentos(lista);
      }
      setLoading(false);
    }
    carregar();
  }, [clinicaSelecionada, dentistaSelecionado, semanaBase]);

  const diasComData = DIAS.map((dia) => ({
    ...dia,
    data: toISO(addDays(semanaBase, dia.offset)),
    dataObj: addDays(semanaBase, dia.offset),
  }));

  const hoje = toISO(new Date());

  function agendamentosDaCelula(data: string, hora: string): Agendamento[] {
    return agendamentos.filter(
      (a) => extrairData(a.data_hora) === data && extrairHora(a.data_hora) === hora
    );
  }

  function dentistaDisponivel(diaKey: string): boolean {
    if (dentistaSelecionado === "todos") return true;
    const d = dentistas.find((d) => d.id === dentistaSelecionado);
    return d ? d.dias_semana.includes(diaKey) : true;
  }

  function recarregar() {
    setSemanaBase(new Date(semanaBase.getTime()));
  }

  return (
    <div className="flex flex-col h-full bg-gray-50 -m-6">

      {/* Cabeçalho */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <Calendar className="text-blue-600" size={20} />
            <h1 className="text-lg font-semibold text-gray-800">Agenda Semanal</h1>
            <div className="flex items-center gap-1 ml-2">
              <button onClick={() => setSemanaBase(addDays(semanaBase, -7))}
                className="p-1.5 rounded hover:bg-gray-100 text-gray-500">
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm font-medium text-gray-700 w-48 text-center">
                {formatWeekRange(semanaBase)}
              </span>
              <button onClick={() => setSemanaBase(addDays(semanaBase, 7))}
                className="p-1.5 rounded hover:bg-gray-100 text-gray-500">
                <ChevronRight size={16} />
              </button>
              <button onClick={() => setSemanaBase(getMondayOfWeek(new Date()))}
                className="ml-1 px-3 py-1 text-xs font-medium bg-blue-50 text-blue-700 rounded hover:bg-blue-100">
                Hoje
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {perfilAdmin && (
              <select value={clinicaSelecionada} onChange={(e) => setClinicaSelecionada(e.target.value)}
                className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                {clinicas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            )}
            {!perfilAdmin && clinicas.length > 0 && (
              <span className="text-sm bg-gray-100 text-gray-600 px-3 py-2 rounded-lg font-medium">
                📍 {clinicas.find(c => c.id === clinicaSelecionada)?.nome}
              </span>
            )}
            <select value={dentistaSelecionado} onChange={(e) => setDentistaSelecionado(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="todos">Todos os dentistas</option>
              {dentistas.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
            </select>
            <button onClick={() => { setCelulaSelecionada(null); setModalAberto(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
              <Plus size={15} /> Novo agendamento
            </button>
          </div>
        </div>
      </div>

      {/* Grade */}
      <div className="flex-1 overflow-auto px-2 py-3">
        {loading ? (
          <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
            Carregando agenda...
          </div>
        ) : (
          <div className="min-w-[860px]">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="w-14 pb-2" />
                  {diasComData.map((dia) => {
                    const isHoje = dia.data === hoje;
                    const disp = dentistaDisponivel(dia.key);
                    return (
                      <th key={dia.key} className="pb-2 text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          <span className={`text-[11px] uppercase tracking-wide font-medium ${disp ? "text-gray-500" : "text-gray-300"}`}>
                            {dia.label}
                          </span>
                          <span className={`w-7 h-7 flex items-center justify-center rounded-full text-sm font-semibold ${isHoje ? "bg-blue-600 text-white" : disp ? "text-gray-700" : "text-gray-300"}`}>
                            {dia.dataObj.getDate()}
                          </span>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {HORARIOS.map((hora) => (
                  <tr key={hora}>
                    <td className="text-right pr-2 text-[11px] text-gray-400 align-top pt-1 select-none w-14">
                      {hora.endsWith(":00") ? hora : ""}
                    </td>
                    {diasComData.map((dia) => {
                      const disp = dentistaDisponivel(dia.key);
                      const almoco = isAlmoco(hora);
                      const agds = agendamentosDaCelula(dia.data, hora);
                      const isHoje = dia.data === hoje;
                      return (
                        <td
                          key={dia.key}
                          onClick={() => {
                            if (!disp || almoco) return;
                            setCelulaSelecionada({ data: dia.data, hora });
                            setModalAberto(true);
                          }}
                          className={`
                            border-t border-gray-100 align-top p-0.5 h-9 min-h-[36px]
                            ${almoco ? "bg-amber-50" : ""}
                            ${!disp && !almoco ? "bg-gray-50/80" : ""}
                            ${isHoje && disp && !almoco ? "bg-blue-50/20" : ""}
                            ${disp && !almoco ? "cursor-pointer hover:bg-blue-50 transition-colors" : ""}
                          `}
                        >
                          {almoco && hora === "12:00" && (
                            <span className="text-[10px] text-amber-500 font-medium px-1">Almoço</span>
                          )}
                          {agds.map((ag) => {
                            const cfg = STATUS_CONFIG[ag.status] ?? STATUS_CONFIG.agendado;
                            return (
                              <div key={ag.id}
                                onClick={(e) => { e.stopPropagation(); setDetalhe(ag); }}
                                className={`text-[11px] px-1.5 py-0.5 rounded border mb-0.5 cursor-pointer hover:opacity-75 truncate font-medium ${cfg.cor}`}
                                title={`${ag.paciente_nome} — ${ag.procedimento_nome}`}>
                                <div className="truncate">{ag.paciente_nome}</div>
                                <div className="truncate text-[10px] opacity-70">{ag.procedimento_nome}</div>
                              </div>
                            );
                          })}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Legenda */}
      <div className="bg-white border-t border-gray-100 px-6 py-2 flex flex-wrap gap-3">
        {Object.entries(STATUS_CONFIG).map(([k, v]) => (
          <span key={k} className={`text-[11px] px-2 py-0.5 rounded border font-medium ${v.cor}`}>{v.label}</span>
        ))}
        <span className="text-[11px] px-2 py-0.5 rounded border bg-amber-50 text-amber-600 border-amber-200 font-medium">
          Almoço 12h–14h
        </span>
      </div>

      {/* Modal: Novo Agendamento */}
      {modalAberto && (
        <ModalNovoAgendamento
          clinicaId={clinicaSelecionada}
          dentistas={dentistas}
          celula={celulaSelecionada}
          dentistaPre={dentistaSelecionado !== "todos" ? dentistaSelecionado : ""}
          onClose={() => { setModalAberto(false); setCelulaSelecionada(null); }}
          onSalvo={() => { setModalAberto(false); setCelulaSelecionada(null); recarregar(); }}
        />
      )}

      {/* Modal: Detalhe */}
      {detalhe && (
        <ModalDetalhe
          agendamento={detalhe}
          onClose={() => setDetalhe(null)}
          onAtualizado={() => { setDetalhe(null); recarregar(); }}
        />
      )}
    </div>
  );
}

// ─── Modal: Novo Agendamento ──────────────────────────────────────────────────

function ModalNovoAgendamento({ clinicaId, dentistas, celula, dentistaPre, onClose, onSalvo }: {
  clinicaId: string;
  dentistas: Dentista[];
  celula: { data: string; hora: string } | null;
  dentistaPre: string;
  onClose: () => void;
  onSalvo: () => void;
}) {
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [procedimentos, setProcedimentos] = useState<Procedimento[]>([]);
  const [pacienteId, setPacienteId] = useState("");
  const [dentistaId, setDentistaId] = useState(dentistaPre);
  const [procedimentoId, setProcedimentoId] = useState("");
  const [data, setData] = useState(celula?.data ?? toISO(new Date()));
  const [hora, setHora] = useState(celula?.hora ?? "08:00");
  const [observacoes, setObservacoes] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    supabase.from("pacientes").select("id, nome").order("nome").then(({ data }) => {
      if (data) setPacientes(data);
    });
    supabase.from("procedimentos").select("id, nome").order("nome").then(({ data }) => {
      if (data) setProcedimentos(data);
    });
  }, []);

  async function salvar() {
    if (!pacienteId || !dentistaId || !data || !hora) return;
    setSalvando(true);
    const dataHora = `${data}T${hora}:00`;
    await supabase.from("agendamentos").insert({
      paciente_id: pacienteId,
      dentista_id: dentistaId,
      clinica_id: clinicaId,
      procedimento_id: procedimentoId || null,
      data_hora: dataHora,
      observacoes,
      status: "agendado",
    });
    setSalvando(false);
    onSalvo();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <Plus size={17} className="text-blue-600" /> Novo Agendamento
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={19} /></button>
        </div>
        <div className="px-6 py-4 flex flex-col gap-3">
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Paciente *</label>
            <select value={pacienteId} onChange={(e) => setPacienteId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Selecione o paciente</option>
              {pacientes.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Dentista *</label>
            <select value={dentistaId} onChange={(e) => setDentistaId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Selecione</option>
              {dentistas.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Procedimento</label>
            <select value={procedimentoId} onChange={(e) => setProcedimentoId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Selecione (opcional)</option>
              {procedimentos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Data *</label>
              <input type="date" value={data} onChange={(e) => setData(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Horário *</label>
              <select value={hora} onChange={(e) => setHora(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {HORARIOS.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Observações</label>
            <textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)}
              rows={2} placeholder="Anotações adicionais..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Cancelar</button>
          <button onClick={salvar} disabled={salvando || !pacienteId || !dentistaId}
            className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {salvando ? "Salvando..." : "Agendar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal: Detalhe ───────────────────────────────────────────────────────────

function ModalDetalhe({ agendamento, onClose, onAtualizado }: {
  agendamento: Agendamento;
  onClose: () => void;
  onAtualizado: () => void;
}) {
  const [status, setStatus] = useState(agendamento.status);
  const [salvando, setSalvando] = useState(false);
  const cfg = STATUS_CONFIG[agendamento.status] ?? STATUS_CONFIG.agendado;
  const dataFormatada = new Date(agendamento.data_hora).toLocaleDateString("pt-BR");
  const horaFormatada = extrairHora(agendamento.data_hora);

  async function salvar() {
    setSalvando(true);
    await supabase.from("agendamentos").update({ status }).eq("id", agendamento.id);
    setSalvando(false);
    onAtualizado();
  }

  async function cancelar() {
    if (!confirm("Cancelar este agendamento?")) return;
    await supabase.from("agendamentos").update({ status: "cancelado" }).eq("id", agendamento.id);
    onAtualizado();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <User size={17} className="text-blue-600" /> Agendamento
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={19} /></button>
        </div>
        <div className="px-6 py-4 flex flex-col gap-3">
          <div>
            <p className="text-xs text-gray-400">Paciente</p>
            <p className="font-semibold text-gray-800">{agendamento.paciente_nome}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Procedimento</p>
            <p className="text-gray-700">{agendamento.procedimento_nome}</p>
          </div>
          <div className="flex gap-6">
            <div>
              <p className="text-xs text-gray-400">Data</p>
              <p className="text-gray-700">{dataFormatada}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Horário</p>
              <p className="text-gray-700">{horaFormatada}</p>
            </div>
          </div>
          {agendamento.observacoes && (
            <div>
              <p className="text-xs text-gray-400">Observações</p>
              <p className="text-gray-600 text-sm">{agendamento.observacoes}</p>
            </div>
          )}
          <div>
            <p className="text-xs text-gray-400 mb-1">Status atual</p>
            <span className={`text-xs px-2 py-0.5 rounded border font-medium ${cfg.cor}`}>{cfg.label}</span>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Atualizar status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as any)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-between">
          <button onClick={cancelar} className="text-sm text-red-500 hover:text-red-700">Cancelar consulta</button>
          <div className="flex gap-3">
            <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700">Fechar</button>
            <button onClick={salvar} disabled={salvando}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {salvando ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
