export function standings(count, base = 0) {
  return Array.from({ length: count }, (_, i) => {
    const id = base + i + 1;
    return { grupo_id: id, numero: i + 1, total: 3, confirmados: 3, pendientes: 0, empate: false,
      aprobable: true, aprobacion: { id, vigente: true, referencia: 'Acta local' }, snapshot: { grupo_id: id },
      filas: [1, 2, 3].map(pos => ({ jugador_id: id * 10 + pos, nombre_completo: `Fixture ${id}-${pos}`, empate: false })) };
  });
}
