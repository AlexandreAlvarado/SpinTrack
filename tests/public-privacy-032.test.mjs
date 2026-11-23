import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const sql=fs.readFileSync(new URL('../supabase/migrations/032_publicacion_deportiva_segura.sql',import.meta.url),'utf8');
test('032 protege las RPC históricas, snapshots y nombres de ambos cuadros sin cambiar resultados',()=>{
 assert.match(sql,/create or replace function public.consultar_torneos_publicos_025/);
 assert.match(sql,/create or replace function public.consultar_ranking_publico_026/);
 assert.match(sql,/fecha_nacimiento <=/);
 assert.match(sql,/interval '18 years'/);
 assert.match(sql,/else 'Participante con identidad reservada'/);
 assert.match(sql,/nombre_publico_032\(\(fila->>'jugador_id'\)::bigint\)/);
 assert.doesNotMatch(sql,/'name',src.nombre_completo|'a',a.nombre_completo|'b',b.nombre_completo/);
 assert.doesNotMatch(sql,/\b(insert into|update public|delete from|create table|alter table|create trigger)\b/i);
 assert.match(sql,/revoke all on function public.nombre_publico_032\(bigint\) from public,anon,authenticated,service_role/);
 assert.doesNotMatch(sql,/'playerId',src.jugador_id/);
 assert.match(sql,/dense_rank\(\) over\(partition by src.configuracion_id order by src.jugador_id\)/);
 assert.match(sql,/editar_mi_perfil_deportivo_029\(bigint,date,bigint,bigint,jsonb\)/);
 assert.match(sql,/using errcode='55000'/);
});
