import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import { FileText, Printer, ChevronLeft, ChevronRight, Calendar } from "lucide-react";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Clinica { id: string; nome: string; }
interface Dentista { id: string; nome: string; }

interface Atendimento {
  id: string;
  paciente_nome: string;
  dentista_id: string;
  dentista_nome: string;
  procedimento_nome: string;
  hora: string;
  valor_total: number;
  forma_pagamento: string;
  comissao_valor: number;
  comissao_percentual: number;
  status_agendamento: string;
  protetico_nome?: string;
  protetico_valor?: number;
}

interface AgendamentoSimples {
  id: string;
  paciente_nome: string;
  dentista_id: string;
  dentista_nome: string;
  procedimento_nome: string;
  hora: string;
  status: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toISO(date: Date): string {
  return date.toISOString().split("T")[0];
}
function addDays(date: Date, n: number): Date {
  const d = new Date(date); d.setDate(d.getDate() + n); return d;
}
function formatData(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
function formatDiaSemana(iso: string): string {
  const dias = ["Domingo","Segunda-feira","Terça-feira","Quarta-feira","Quinta-feira","Sexta-feira","Sábado"];
  const d = new Date(iso + "T12:00:00");
  return dias[d.getDay()];
}
function formatMoeda(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function extrairHora(dataHora: string): string {
  const d = new Date(dataHora);
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

const STATUS_LABEL: Record<string, string> = {
  agendado: "Agendado", confirmado: "Confirmado",
  realizado: "Realizado", cancelado: "Cancelado", faltou: "Faltou",
};
const STATUS_COR: Record<string, string> = {
  agendado: "#3b82f6", confirmado: "#22c55e",
  realizado: "#6b7280", cancelado: "#ef4444", faltou: "#f97316",
};

// ─── Componente principal ─────────────────────────────────────────────────────

export default function RelatorioDiario() {
  const [clinicas, setClinicas] = useState<Clinica[]>([]);
  const [clinicaId, setClinicaId] = useState("");
  const [clinicaNome, setClinicaNome] = useState("");
  const [data, setData] = useState(toISO(new Date()));
  const [agendamentos, setAgendamentos] = useState<AgendamentoSimples[]>([]);
  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([]);
  const [loading, setLoading] = useState(false);
  const [perfilAdmin, setPerfilAdmin] = useState(true);
  const printRef = useRef<HTMLDivElement>(null);

  // Usuário logado
  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: u } = await supabase.from("usuarios").select("perfil, clinica_id").eq("auth_id", user.id).maybeSingle();
      if (u) {
        setPerfilAdmin(u.perfil !== "secretaria");
        if (u.clinica_id) setClinicaId(u.clinica_id);
      }
    }
    init();
  }, []);

  // Clínicas
  useEffect(() => {
    supabase.from("clinicas").select("id, nome").order("nome").then(({ data }) => {
      if (data) {
        setClinicas(data);
        if (!clinicaId && data.length > 0) setClinicaId(data[0].id);
      }
    });
  }, []);

  useEffect(() => {
    if (clinicaId && clinicas.length > 0) {
      setClinicaNome(clinicas.find(c => c.id === clinicaId)?.nome ?? "");
    }
  }, [clinicaId, clinicas]);

  // Carregar dados
  useEffect(() => {
    if (!clinicaId || !data) return;
    async function carregar() {
      setLoading(true);

      // Agendamentos do dia
      const inicio = data + "T00:00:00";
      const fim = data + "T23:59:59";
      const { data: ags } = await supabase
        .from("agendamentos")
        .select("id, paciente_id, dentista_id, procedimento_id, data_hora, status, pacientes(nome), procedimentos(nome), dentistas(nome)")
        .eq("clinica_id", clinicaId)
        .gte("data_hora", inicio)
        .lte("data_hora", fim)
        .order("data_hora");

      if (ags) {
        setAgendamentos(ags.map((r: any) => ({
          id: r.id,
          paciente_nome: r.pacientes?.nome ?? "—",
          dentista_id: r.dentista_id,
          dentista_nome: r.dentistas?.nome ?? "—",
          procedimento_nome: r.procedimentos?.nome ?? "—",
          hora: extrairHora(r.data_hora),
          status: r.status,
        })));
      }

      // Atendimentos do dia (financeiro real)
      const { data: ats } = await supabase
        .from("atendimentos")
        .select(`
          id, dentista_id, valor_total, forma_pagamento,
          comissao_valor, comissao_percentual, created_at,
          pacientes(nome), procedimentos(nome), dentistas(nome),
          proteticos(nome), protetico_valor
        `)
        .eq("clinica_id", clinicaId)
        .gte("created_at", inicio)
        .lte("created_at", fim)
        .order("created_at");

      if (ats) {
        setAtendimentos(ats.map((r: any) => ({
          id: r.id,
          paciente_nome: r.pacientes?.nome ?? "—",
          dentista_id: r.dentista_id,
          dentista_nome: r.dentistas?.nome ?? "—",
          procedimento_nome: r.procedimentos?.nome ?? "—",
          hora: extrairHora(r.created_at),
          valor_total: r.valor_total ?? 0,
          forma_pagamento: r.forma_pagamento ?? "—",
          comissao_valor: r.comissao_valor ?? 0,
          comissao_percentual: r.comissao_percentual ?? 0,
          protetico_nome: r.proteticos?.nome,
          protetico_valor: r.protetico_valor,
        })));
      }

      setLoading(false);
    }
    carregar();
  }, [clinicaId, data]);

  // Agrupamentos
  const dentistaIds = [...new Set(agendamentos.map(a => a.dentista_id))];
  const totalAgendados = agendamentos.length;
  const totalRealizados = agendamentos.filter(a => a.status === "realizado").length;
  const totalConfirmados = agendamentos.filter(a => a.status === "confirmado").length;
  const totalCancelados = agendamentos.filter(a => a.status === "cancelado").length;
  const totalFaltou = agendamentos.filter(a => a.status === "faltou").length;
  const receitaTotal = atendimentos.reduce((s, a) => s + a.valor_total, 0);
  const comissaoTotal = atendimentos.reduce((s, a) => s + a.comissao_valor, 0);
  const liquidoTotal = receitaTotal - comissaoTotal;
  const proteticosDodia = atendimentos.filter(a => a.protetico_nome);

  function imprimir() {
    window.print();
  }

  return (
    <div className="bg-gray-50 min-h-full -m-6">

      {/* Barra de controles — não aparece na impressão */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex flex-wrap items-center gap-3 no-print">
        <FileText className="text-blue-600" size={20} />
        <h1 className="text-lg font-semibold text-gray-800">Relatório Diário</h1>

        <div className="flex items-center gap-1 ml-2">
          <button onClick={() => setData(toISO(addDays(new Date(data+"T12:00:00"), -1)))}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-500">
            <ChevronLeft size={16} />
          </button>
          <input type="date" value={data} onChange={e => setData(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <button onClick={() => setData(toISO(addDays(new Date(data+"T12:00:00"), 1)))}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-500">
            <ChevronRight size={16} />
          </button>
          <button onClick={() => setData(toISO(new Date()))}
            className="ml-1 px-3 py-1 text-xs font-medium bg-blue-50 text-blue-700 rounded hover:bg-blue-100">
            Hoje
          </button>
        </div>

        {perfilAdmin && (
          <select value={clinicaId} onChange={e => setClinicaId(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            {clinicas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        )}
        {!perfilAdmin && (
          <span className="text-sm bg-gray-100 text-gray-600 px-3 py-2 rounded-lg font-medium">
            📍 {clinicaNome}
          </span>
        )}

        <button onClick={imprimir}
          className="ml-auto flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
          <Printer size={15} /> Imprimir / PDF
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Carregando...</div>
      ) : (

        /* Área imprimível */
        <div ref={printRef} className="max-w-4xl mx-auto px-6 py-6 print-area">

          {/* Cabeçalho do relatório */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-2xl">🦷</span>
                  <h2 className="text-xl font-bold text-gray-800">Consultórios Dr. Thiago Canuto</h2>
                </div>
                <p className="text-gray-500 text-sm">Relatório Diário de Atendimentos</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-gray-800">{clinicaNome}</p>
                <p className="text-blue-600 font-semibold">{formatDiaSemana(data)}, {formatData(data)}</p>
                <p className="text-xs text-gray-400 mt-1">Gerado em {new Date().toLocaleString("pt-BR")}</p>
              </div>
            </div>
          </div>

          {/* Cards de resumo */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
            {[
              { label: "Total", valor: totalAgendados, cor: "bg-gray-50 border-gray-200", texto: "text-gray-700" },
              { label: "Confirmados", valor: totalConfirmados, cor: "bg-green-50 border-green-200", texto: "text-green-700" },
              { label: "Realizados", valor: totalRealizados, cor: "bg-blue-50 border-blue-200", texto: "text-blue-700" },
              { label: "Cancelados", valor: totalCancelados, cor: "bg-red-50 border-red-200", texto: "text-red-700" },
              { label: "Faltou", valor: totalFaltou, cor: "bg-orange-50 border-orange-200", texto: "text-orange-700" },
            ].map(c => (
              <div key={c.label} className={`rounded-xl border p-4 text-center ${c.cor}`}>
                <p className={`text-2xl font-bold ${c.texto}`}>{c.valor}</p>
                <p className={`text-xs font-medium ${c.texto}`}>{c.label}</p>
              </div>
            ))}
          </div>

          {/* Agendamentos por dentista */}
          <div className="bg-white rounded-xl border border-gray-200 mb-4 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
              <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                <Calendar size={16} className="text-blue-600" />
                Agenda do Dia — por Dentista
              </h3>
            </div>

            {dentistaIds.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">Nenhum agendamento para este dia.</p>
            ) : (
              dentistaIds.map(did => {
                const nomeDentista = agendamentos.find(a => a.dentista_id === did)?.dentista_nome ?? "—";
                const ags = agendamentos.filter(a => a.dentista_id === did).sort((a,b) => a.hora.localeCompare(b.hora));
                return (
                  <div key={did}>
                    <div className="px-5 py-2 bg-blue-600">
                      <p className="text-white font-semibold text-sm">👨‍⚕️ {nomeDentista}</p>
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                          <th className="px-4 py-2 text-left font-medium">Horário</th>
                          <th className="px-4 py-2 text-left font-medium">Paciente</th>
                          <th className="px-4 py-2 text-left font-medium">Procedimento</th>
                          <th className="px-4 py-2 text-left font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ags.map((ag, i) => (
                          <tr key={ag.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                            <td className="px-4 py-2.5 font-mono text-gray-600 font-medium">{ag.hora}</td>
                            <td className="px-4 py-2.5 text-gray-800 font-medium">{ag.paciente_nome}</td>
                            <td className="px-4 py-2.5 text-gray-600">{ag.procedimento_nome}</td>
                            <td className="px-4 py-2.5">
                              <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                                style={{ backgroundColor: STATUS_COR[ag.status] + "20", color: STATUS_COR[ag.status] }}>
                                {STATUS_LABEL[ag.status] ?? ag.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })
            )}
          </div>

          {/* Financeiro do dia */}
          {atendimentos.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 mb-4 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
                <h3 className="font-semibold text-gray-700">💰 Financeiro do Dia</h3>
              </div>

              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                    <th className="px-4 py-2 text-left font-medium">Horário</th>
                    <th className="px-4 py-2 text-left font-medium">Paciente</th>
                    <th className="px-4 py-2 text-left font-medium">Dentista</th>
                    <th className="px-4 py-2 text-left font-medium">Procedimento</th>
                    <th className="px-4 py-2 text-left font-medium">Pagamento</th>
                    <th className="px-4 py-2 text-right font-medium">Valor</th>
                    <th className="px-4 py-2 text-right font-medium">Comissão</th>
                  </tr>
                </thead>
                <tbody>
                  {atendimentos.map((at, i) => (
                    <tr key={at.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                      <td className="px-4 py-2.5 font-mono text-gray-600">{at.hora}</td>
                      <td className="px-4 py-2.5 text-gray-800 font-medium">{at.paciente_nome}</td>
                      <td className="px-4 py-2.5 text-gray-600">{at.dentista_nome}</td>
                      <td className="px-4 py-2.5 text-gray-600">{at.procedimento_nome}</td>
                      <td className="px-4 py-2.5 text-gray-600">{at.forma_pagamento}</td>
                      <td className="px-4 py-2.5 text-right font-medium text-gray-800">{formatMoeda(at.valor_total)}</td>
                      <td className="px-4 py-2.5 text-right text-orange-600 font-medium">
                        {at.comissao_percentual}% — {formatMoeda(at.comissao_valor)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 border-t border-gray-200">
                    <td colSpan={5} className="px-4 py-3 text-sm font-bold text-gray-700">TOTAIS</td>
                    <td className="px-4 py-3 text-right font-bold text-gray-800">{formatMoeda(receitaTotal)}</td>
                    <td className="px-4 py-3 text-right font-bold text-orange-600">{formatMoeda(comissaoTotal)}</td>
                  </tr>
                  <tr className="bg-green-50 border-t border-green-100">
                    <td colSpan={6} className="px-4 py-3 text-sm font-bold text-green-700">LÍQUIDO DA CLÍNICA</td>
                    <td className="px-4 py-3 text-right font-bold text-green-700 text-base">{formatMoeda(liquidoTotal)}</td>
                  </tr>
                </tfoot>
              </table>

              {/* Resumo por forma de pagamento */}
              <div className="px-5 py-4 border-t border-gray-100 bg-gray-50">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Por forma de pagamento</p>
                <div className="flex flex-wrap gap-3">
                  {[...new Set(atendimentos.map(a => a.forma_pagamento))].map(fp => {
                    const total = atendimentos.filter(a => a.forma_pagamento === fp).reduce((s,a) => s + a.valor_total, 0);
                    return (
                      <div key={fp} className="bg-white border border-gray-200 rounded-lg px-4 py-2 text-center">
                        <p className="text-xs text-gray-500">{fp}</p>
                        <p className="font-bold text-gray-800 text-sm">{formatMoeda(total)}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Comissão por dentista */}
              <div className="px-5 py-4 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Comissão por dentista</p>
                <div className="flex flex-wrap gap-3">
                  {[...new Set(atendimentos.map(a => a.dentista_id))].map(did => {
                    const nome = atendimentos.find(a => a.dentista_id === did)?.dentista_nome ?? "—";
                    const comissao = atendimentos.filter(a => a.dentista_id === did).reduce((s,a) => s + a.comissao_valor, 0);
                    return (
                      <div key={did} className="bg-orange-50 border border-orange-100 rounded-lg px-4 py-2 text-center">
                        <p className="text-xs text-orange-600 font-medium">{nome}</p>
                        <p className="font-bold text-orange-700 text-sm">{formatMoeda(comissao)}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Protéticos */}
          {proteticosDodia.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 mb-4 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
                <h3 className="font-semibold text-gray-700">🔧 Protéticos do Dia</h3>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                    <th className="px-4 py-2 text-left font-medium">Paciente</th>
                    <th className="px-4 py-2 text-left font-medium">Dentista</th>
                    <th className="px-4 py-2 text-left font-medium">Protético</th>
                    <th className="px-4 py-2 text-right font-medium">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {proteticosDodia.map((at, i) => (
                    <tr key={at.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                      <td className="px-4 py-2.5 text-gray-800 font-medium">{at.paciente_nome}</td>
                      <td className="px-4 py-2.5 text-gray-600">{at.dentista_nome}</td>
                      <td className="px-4 py-2.5 text-gray-600">{at.protetico_nome}</td>
                      <td className="px-4 py-2.5 text-right font-medium text-gray-800">{formatMoeda(at.protetico_valor ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 border-t border-gray-200">
                    <td colSpan={3} className="px-4 py-3 text-sm font-bold text-gray-700">TOTAL PROTÉTICOS</td>
                    <td className="px-4 py-3 text-right font-bold text-gray-800">
                      {formatMoeda(proteticosDodia.reduce((s,a) => s + (a.protetico_valor ?? 0), 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Rodapé */}
          <div className="text-center text-xs text-gray-400 py-4">
            Gerado por Inova IA Soluções • Sistema Consultórios Thiago Canuto
          </div>
        </div>
      )}

      {/* CSS de impressão */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
          .print-area { max-width: 100%; padding: 0; }
        }
      `}</style>
    </div>
  );
}
