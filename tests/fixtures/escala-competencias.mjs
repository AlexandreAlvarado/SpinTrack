export function createCompetitionFixture(groupCount, playersPerGroup = 4) {
  if (![3, 4].includes(playersPerGroup) || groupCount < 1) throw new Error('Fixture deportivo inválido');
  const groups = Array.from({ length: groupCount }, (_, index) => ({ id: index + 1, numero: index + 1 }));
  const players = groups.flatMap(group => Array.from({ length: playersPerGroup }, (_, index) => ({ id: group.id * 100 + index + 1, nombre_completo: `Jugador ${group.numero}-${index + 1}` })));
  const matches = groups.flatMap(group => {
    const groupPlayers = players.filter(player => Math.floor(player.id / 100) === group.id);
    return groupPlayers.flatMap((player, index) => groupPlayers.slice(index + 1).map(opponent => ({ id: group.id * 1000 + player.id % 100 * 10 + opponent.id % 100, grupo_id: group.id, jugador_a_id: player.id, jugador_b_id: opponent.id })));
  });
  return { groups, players, matches };
}
