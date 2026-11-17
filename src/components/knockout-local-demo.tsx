"use client";

import { useState } from "react";
import { BracketView } from "@/components/knockout-preview";
import { proposeBracket, simulatedInput, type Proposal } from "@/lib/eliminatorias";

type MatchStatus = "pendiente" | "asignado" | "enviado" | "observado" | "confirmado";
type DemoMatch = { id: string; a: string; b: string; status: MatchStatus; winner?: string; loser?: string };

const labels: Record<MatchStatus, string> = { pendiente: "Partido pendiente", asignado: "Árbitro asignado", enviado: "Resultado enviado a revisión", observado: "Resultado observado", confirmado: "Confirmación simulada del Juez General" };

function makeMatches(proposal: Proposal): DemoMatch[] {
  return proposal.rondas.flatMap(round => round.filter(node => node.tipo === "encuentro").map(node => ({ id: node.id, a: node.entradas[0]?.tipo === "jugador" ? node.entradas[0].jugador.nombre : "Pendiente", b: node.entradas[1]?.tipo === "jugador" ? node.entradas[1].jugador.nombre : "Pendiente", status: "pendiente" as MatchStatus })));
}

export function KnockoutLocalDemo() {
  const [count, setCount] = useState(4);
  const [proposal, setProposal] = useState(() => proposeBracket(simulatedInput(4)));
  const [matches, setMatches] = useState(() => makeMatches(proposal));
  const [selected, setSelected] = useState("");
  const [mobile, setMobile] = useState(false);
  const selectedMatch = matches.find(match => match.id === selected);
  const champion = matches.find(match => match.id.startsWith(`R${Math.log2(proposal.posiciones)}-`) && match.status === "confirmado")?.winner;

  function changeScenario(value: string) {
    const nextCount = Number(value);
    const nextProposal = proposeBracket(simulatedInput(nextCount));
    setCount(nextCount); setProposal(nextProposal); setMatches(makeMatches(nextProposal)); setSelected("");
  }
  function advance(status: MatchStatus) {
    if (!selectedMatch) return;
    setMatches(current => {
      const updated = current.map(match => match.id === selectedMatch.id ? { ...match, status, ...(status === "confirmado" ? { winner: match.a, loser: match.b } : {}) } : match);
      if (status !== "confirmado") return updated;
      const [, roundText, matchText] = selectedMatch.id.match(/^R(\d+)-C(\d+)$/) ?? [];
      if (!roundText || !matchText) return updated;
      const nextId = `R${Number(roundText) + 1}-C${Math.ceil(Number(matchText) / 2)}`;
      const winner = selectedMatch.a;
      return updated.map(match => {
        if (match.id !== nextId || winner === "Pendiente") return match;
        return match.a === "Pendiente" ? { ...match, a: winner } : match.b === "Pendiente" ? { ...match, b: winner } : match;
      });
    });
  }
  return <main className={mobile ? "mx-auto max-w-sm p-4" : "mx-auto max-w-6xl p-6"}>
    <div className="mb-6 rounded-2xl border-2 border-dashed border-amber-400 bg-amber-50 p-4"><p className="font-bold text-amber-950">SIMULACIÓN LOCAL · sin Supabase</p><p className="text-sm text-amber-900">Fixtures sintéticos y estado en memoria. No representa autenticación real ni permite confirmar resultados deportivos.</p></div>
    <div className="mb-6 flex flex-wrap items-end gap-3"><label className="text-sm">Escenario<select className="input mt-1 block" value={count} onChange={event => changeScenario(event.target.value)}><option value="4">A · 4 clasificados</option><option value="6">B · 6 clasificados</option><option value="16">C · 16 clasificados</option></select></label><button type="button" className="btn-secondary" onClick={() => setMobile(value => !value)}>{mobile ? "Vista escritorio" : "Vista móvil"}</button></div>
    <section className="mb-6 panel-card"><h1 className="text-xl font-bold">Demostración de eliminación directa</h1><p className="mt-2 text-sm">{proposal.posiciones} posiciones · {count} clasificados · {Math.max(0, proposal.posiciones - count)} pases automáticos.</p><BracketView proposal={proposal} /></section>
    <section className="space-y-3"><h2 className="text-lg font-bold">Operación simulada</h2><div className="grid gap-3 md:grid-cols-2">{matches.map(match => <button type="button" key={match.id} className={`rounded-xl border p-3 text-left ${selected === match.id ? "border-sky-500 bg-sky-50" : "border-slate-200 bg-white"}`} onClick={() => setSelected(match.id)}><p className="font-semibold">{match.id}</p><p>{match.a} vs. {match.b}</p><p className="mt-1 text-sm text-slate-600">{labels[match.status]}</p>{match.winner && <p className="mt-1 text-sm text-emerald-700">Ganador: {match.winner} · eliminado: {match.loser}</p>}</button>)}</div></section>
    {selectedMatch && <section className="mt-6 panel-card"><h2 className="font-bold">Flujo local de {selectedMatch.id}</h2><p className="mt-1 text-sm">{selectedMatch.a} vs. {selectedMatch.b}</p><div className="mt-3 flex flex-wrap gap-2">{(["asignado", "enviado", "observado", "confirmado"] as MatchStatus[]).map(status => <button type="button" className="btn-secondary" key={status} onClick={() => advance(status)}>{labels[status]}</button>)}</div>{selectedMatch.status === "observado" && <p className="mt-3 text-sm">Corrección disponible: el árbitro puede reenviar el resultado simulado.</p>}{selectedMatch.status === "confirmado" && <p className="mt-3 text-sm text-emerald-700">Avance simulado aplicado; el perdedor queda eliminado y el ganador ocupa su origen siguiente.</p>}</section>}
    {champion && <p className="mt-6 panel-card font-bold">Campeón simulado: {champion} · subcampeón conservado en el historial local.</p>}
  </main>;
}
