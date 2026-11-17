/** Motor puro de propuestas. No escribe resultados ni persiste llaves. */
export type Entrant = { id: string; nombre: string; grupo: string; competencia: string; autorizado: boolean; ranking?: number; cabezaSerie?: number };
export type Qualification = { grupo: string; ids: string[]; aprobada: boolean; empate: boolean; referencia: string; grupo_id?: number; snapshot?: unknown; aprobacion_id?: number | null };
export type PreviewInput = { origen: "simulado" | "competencia"; competencia: string; participantes: Entrant[]; clasificaciones: Qualification[] };
export type Source = { tipo: "jugador"; jugador: Entrant } | { tipo: "ganador"; cruce: string };
export type BracketNode = { id: string; ronda: number; entradas: Source[]; tipo: "encuentro" | "pase"; salida: Source };
export type Proposal = { estado: "vista_previa"; confirmable: false; posiciones: number; rondas: BracketNode[][]; decisiones: string[]; advertencias: string[] };

export function minimumBracketSize(count: number): number {
  if (!Number.isSafeInteger(count) || count < 2) throw new Error("Cantidad de clasificados inválida.");
  const positions = 2 ** Math.ceil(Math.log2(count));
  if (!Number.isSafeInteger(positions) || positions > 2147483647) throw new Error("El cuadro excede la representación INTEGER del almacenamiento; requiere ampliar la infraestructura.");
  return positions;
}

export function proposeBracket(input: PreviewInput): Proposal {
  if (!["simulado", "competencia"].includes(input.origen)) throw new Error("Origen de propuesta inválido.");
  if (!input.competencia?.trim() || !Array.isArray(input.participantes) || !Array.isArray(input.clasificaciones)) throw new Error("Datos incompletos.");
  const players = new Map<string, Entrant>();
  for (const player of input.participantes) {
    if (!player.id?.trim() || !player.nombre?.trim() || !player.grupo?.trim() || player.competencia !== input.competencia || player.autorizado !== true || players.has(player.id)) throw new Error("Participantes incompletos, duplicados o no autorizados para la competencia.");
    if (player.ranking !== undefined || player.cabezaSerie !== undefined) throw new Error("Siembra por ranking pendiente de implementación y validación.");
    players.set(player.id, { ...player });
  }
  const groups = new Set<string>(), selected = new Set<string>();
  const qualifiers: Entrant[] = [];
  for (const group of input.clasificaciones) {
    if (!group.grupo?.trim() || groups.has(group.grupo) || group.aprobada !== true || group.empate !== false || !group.referencia?.trim() || !Array.isArray(group.ids)) throw new Error("Clasificación duplicada, incompleta, sin aprobación válida o con empate pendiente.");
    if (group.ids.length !== 2) throw new Error("Cada grupo debe aportar exactamente primero y segundo.");
    groups.add(group.grupo);
    for (const id of group.ids) {
      const player = players.get(id);
      if (!player || player.grupo !== group.grupo || selected.has(id)) throw new Error("Clasificado duplicado o ajeno al grupo o a la competencia.");
      selected.add(id); qualifiers.push(player);
    }
  }
  if ([...players.values()].some(player => !groups.has(player.grupo))) throw new Error("Falta revisar la clasificación de un grupo.");
  if (!groups.size) throw new Error("No hay grupos.");
  const positions = minimumBracketSize(qualifiers.length);
  if (groups.size === 1) return { estado: "vista_previa", confirmable: false, posiciones: 2, rondas: [], decisiones: ["Un solo grupo y dos clasificados: distribución bloqueada; no se crea un partido ficticio ni se declara campeón automáticamente."], advertencias: ["Se necesita una regla deportiva validada para autorizar el reencuentro del único grupo."] };
  // Es una propuesta técnica determinista, sin jerarquía deportiva ni sorteo oficial.
  const bits = Math.log2(positions);
  let sources: (Source | null)[] = Array.from({ length: positions }, () => null);
  // Cada mitad recibe primeros de una paridad y segundos de la otra.
  // Las listas ocupan parejas desde extremos opuestos: no hay ramas vacías.
  const pairs = positions / 4;
  for (let half = 0; half < 2; half++) {
    const firsts = input.clasificaciones.filter((_, i) => i % 2 === half).map(g => players.get(g.ids[0])!);
    const seconds = input.clasificaciones.filter((_, i) => i % 2 !== half).map(g => players.get(g.ids[1])!);
    firsts.forEach((player, i) => { sources[half * positions / 2 + 2 * i] = { tipo: "jugador", jugador: player }; });
    seconds.forEach((player, i) => { sources[half * positions / 2 + 2 * (pairs - seconds.length + i) + 1] = { tipo: "jugador", jugador: player }; });
  }
  const initial = [...sources];
  const rounds: BracketNode[][] = [];
  while (sources.length > 1) {
    const round: BracketNode[] = [];
    const next: Source[] = [];
    for (let i = 0; i < sources.length; i += 2) {
      const entries = [sources[i], sources[i + 1]].filter((source): source is Source => source !== null);
      if (!entries.length) throw new Error("Rama vacía inválida.");
      const id = `R${rounds.length + 1}-C${i / 2 + 1}`;
      const output: Source = entries.length === 1 ? entries[0] : { tipo: "ganador", cruce: id };
      round.push({ id, ronda: rounds.length + 1, entradas: entries, tipo: entries.length === 1 ? "pase" : "encuentro", salida: output }); next.push(output);
    }
    rounds.push(round); sources = next;
  }
  let earliest = bits + 1;
  const groupPositions = new Map<string, number>();
  for (let a = 0; a < initial.length; a++) {
    const left = initial[a];
    if (left?.tipo !== "jugador") continue;
    const previous = groupPositions.get(left.jugador.grupo);
    if (previous !== undefined) {
      let x = previous, y = a, round = 0;
      while (x !== y) { x = Math.floor(x / 2); y = Math.floor(y / 2); round++; }
      earliest = Math.min(earliest, round);
    }
    groupPositions.set(left.jugador.grupo, a);
  }
  return { estado: "vista_previa", confirmable: false, posiciones: positions, rondas: rounds,
    decisiones: [input.origen === "competencia" ? "Fuente: clasificación aprobada de la competencia; no se escribió en Supabase." : "Fuente exclusivamente simulada; sin escrituras ni resultados.", `Cuadro mínimo de ${positions} posiciones para ${qualifiers.length} clasificados.`, `${positions - qualifiers.length} pases automáticos; no son partidos disputados.`, "Propuesta técnica: primeros contra segundos de otros grupos, compañeros en mitades opuestas; no constituye siembra ni sorteo oficial.", ...input.clasificaciones.map(group => `${group.grupo}: ${group.ids.length} plaza${group.ids.length === 1 ? "" : "s"} · ${group.referencia}`)],
    advertencias: ["Clasifican primero y segundo por definición del usuario. Distribución, desempates, siembra y asignación de pases pendientes de validación. A1-H2 no se presume regla oficial.", ...(earliest <= bits ? [`Compañeros de grupo podrían reencontrarse desde la ronda ${earliest}. Revisar con la regla oficial pendiente.`] : [])] };
}

export function simulatedInput(count: number): PreviewInput {
  if (!Number.isSafeInteger(count) || count < 2 || count % 2) throw new Error("Cantidad simulada inválida: dos jugadores por grupo.");
  minimumBracketSize(count);
  const participantes: Entrant[] = Array.from({ length: count }, (_, i) => ({ id: `demo-${i + 1}`, nombre: `Simulado ${i + 1}`, grupo: `Grupo ${Math.floor(i / 2) + 1}`, competencia: "laboratorio", autorizado: true }));
  return { origen: "simulado", competencia: "laboratorio", participantes, clasificaciones: Array.from({ length: count / 2 }, (_, i) => ({ grupo: `Grupo ${i + 1}`, ids: [participantes[2 * i].id, participantes[2 * i + 1].id], aprobada: true, empate: false, referencia: "Fixture local: primero y segundo" })) };
}

export type StandingsForBracket = {
  grupo_id: number; numero: number; filas: Array<{ jugador_id: number; nombre_completo: string; empate: boolean }>;
  total: number; confirmados: number; pendientes: number; empate: boolean; aprobable?: boolean;
  snapshot?: unknown;
  aprobacion: null | { id?: number; vigente: boolean; referencia: string };
};

/** Convierte clasificación vigente en primero y segundo, conservando su orden. */
export function competitionInput(competencia: string, groups: StandingsForBracket[]): PreviewInput {
  if (!competencia?.trim() || !Array.isArray(groups) || groups.length === 0) throw new Error("No hay grupos de la competencia para clasificar.");
  const ordered = [...groups].sort((a, b) => a.numero - b.numero || a.grupo_id - b.grupo_id);
  const participants: Entrant[] = [], classifications: Qualification[] = [], seen = new Set<number>();
  for (const group of ordered) {
    const first = group.filas[0], second = group.filas[1];
    if (!group.total || group.confirmados !== group.total || group.pendientes !== 0 || group.empate || group.aprobable === false || !group.aprobacion?.vigente || !group.aprobacion.referencia?.trim() || !first || first.empate) {
      throw new Error(`Grupo ${group.numero}: faltan resultados confirmados, aprobación vigente o resolución de las dos plazas.`);
    }
    if (!second || second.empate) throw new Error(`Grupo ${group.numero}: falta segundo lugar o hay empate que afecta las plazas.`);
    for (const row of [first, second]) {
      if (seen.has(row.jugador_id)) throw new Error(`Jugador duplicado entre clasificados: ${row.nombre_completo}.`);
      seen.add(row.jugador_id);
    }
    const id = String(first.jugador_id);
    const player: Entrant = { id, nombre: first.nombre_completo, grupo: `Grupo ${group.numero}`, competencia, autorizado: true };
    participants.push(player, { ...player, id: String(second.jugador_id), nombre: second.nombre_completo });
    classifications.push({ grupo: player.grupo, ids: [id, String(second.jugador_id)], aprobada: true, empate: false, referencia: group.aprobacion.referencia, grupo_id: group.grupo_id, snapshot: group.snapshot, aprobacion_id: group.aprobacion.id ?? null });
  }
  return { origen: "competencia", competencia, participantes: participants, clasificaciones: classifications };
}

export function roundName(size: number): string {
  if (size === 2) return "Final";
  if (size === 4) return "Semifinales";
  if (size === 8) return "Cuartos de final";
  if (size === 16) return "Octavos de final";
  return `Ronda de ${size} · ${size / 2} encuentros`;
}

export function persistableProposal(input: PreviewInput, proposal: Proposal): Record<string, unknown> {
  return {
    version_regla: input.clasificaciones.length === 1 ? 19 : 17,
    posiciones: proposal.posiciones,
    clasificados: input.clasificaciones.length * 2,
    pases_automaticos: Math.max(0, proposal.posiciones - input.clasificaciones.length * 2),
    metodo_distribucion: "determinista_por_grupo",
    clasificaciones: input.clasificaciones.flatMap(group => group.ids.map((id, i) => ({ grupo_id: group.grupo_id, posicion: i + 1, jugador_id: Number(id), snapshot: group.snapshot }))),
    rondas: proposal.rondas.map((round, index) => ({ posiciones: proposal.posiciones / 2 ** index, nombre: roundName(proposal.posiciones / 2 ** index), enfrentamientos: round.filter(node => node.tipo === "encuentro").map(node => {
      const [a, b] = node.entradas;
      const compact = (source: Source) => source.tipo === "jugador" ? { tipo: "jugador", jugador_id: Number(source.jugador.id) } : source;
      return { numero: Number(node.id.split("-C")[1]), tipo: "encuentro", jugador_a_id: a?.tipo === "jugador" ? Number(a.jugador.id) : null, jugador_b_id: b?.tipo === "jugador" ? Number(b.jugador.id) : null, origen_a: compact(a), origen_b: compact(b) };
    }) })),
    decisiones: ["Primero y segundo por grupo; distribución técnica pendiente de validación."],
  };
}
