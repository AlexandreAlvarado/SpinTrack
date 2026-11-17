"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { uploadPlayers, previewPlayers, confirmPlayers, type ImportResult } from "@/app/panel/administrador/jugadores/import-actions";
import type { SheetData } from "@/lib/excel-jugadores";
import { inferColumnMapping, type ImportRow, type ReviewRow } from "@/lib/importacion-jugadores";
import type { CatalogOption } from "@/lib/catalogos";

const fields = { nombre_completo: "Nombre completo", id: "ID de jugador existente", fecha_nacimiento: "Nacimiento (AAAA-MM-DD)", club_id: "Club (nombre exacto o ID)", localidad_procedencia_id: "Localidad (nombre exacto o ID)" };
export function PlayerImport() {
  const [sheets, setSheets] = useState<SheetData[]>([]), [sheetIndex, setSheetIndex] = useState(0), [header, setHeader] = useState(1);
  const [mode, setMode] = useState("tabla"), [mapping, setMapping] = useState<Record<string, string>>({});
  const [rows, setRows] = useState<ImportRow[]>([]), [review, setReview] = useState<ReviewRow[]>([]);
  const [clubs, setClubs] = useState<CatalogOption[]>([]), [localities, setLocalities] = useState<CatalogOption[]>([]);
  const [error, setError] = useState(""), [results, setResults] = useState<ImportResult[]>([]), [confirmed, setConfirmed] = useState(false);
  const [pending, start] = useTransition();
  const [page, setPage] = useState(0);
  const sheet = sheets[sheetIndex];
  function change(index: number, values: Partial<ImportRow>) { setRows(r => r.map((row, i) => i === index ? { ...row, ...values } : row)); setReview([]); setConfirmed(false); }
  async function preview(next: ImportRow[]) {
    const result = await previewPlayers(next);
    if (result.error) setError(result.error);
    else { setReview(result.review ?? []); setRows((result.review ?? []).map(r => r.row)); setClubs(result.clubs ?? []); setLocalities(result.localities ?? []); setError(""); }
  }
  function build() {
    if (!sheet || !Number.isInteger(header) || header < 1 || header > sheet.rows.length) { setError("Selecciona una fila de encabezados válida."); return; }
    const next: ImportRow[] = [];
    const detected = inferColumnMapping(sheet.rows[header - 1] ?? []);
    function add(cells: string[], source: string) {
      const get = (f: string) => (mapping[f] ?? detected[f]) === undefined || (mapping[f] ?? detected[f]) === "" ? "" : cells[Number(mapping[f] ?? detected[f])] ?? "";
      next.push({ source, nombre_completo: get("nombre_completo"), id: get("id"), fecha_nacimiento: get("fecha_nacimiento"), club_id: get("club_id"), localidad_procedencia_id: get("localidad_procedencia_id"), selected: true });
    }
    if (mode === "grupos") {
      sheet.rows.forEach((cells, i) => { for (const c of [1, 5, 9, 13]) if (/^[1-4]$/.test(cells[c - 1] ?? "") && (cells[c] || cells[c + 1])) next.push({ source: `${sheet.name} · fila ${i + 1}, columna ${c + 1} · Asoc.: ${cells[c + 1] ?? ""}`, nombre_completo: cells[c] ?? "", id: "", fecha_nacimiento: "", club_id: "", localidad_procedencia_id: "", selected: true }); });
    } else sheet.rows.slice(header).forEach((cells, i) => { if (cells.some(Boolean)) add(cells, `${sheet.name} · fila ${header + i + 1}`); });
    if (!next.length || next.length > 2000) { setError("Se necesitan entre 1 y 2000 registros. Divide el archivo si supera el límite."); return; }
    setRows(next); setResults([]); setConfirmed(false); setPage(0); start(() => preview(next));
  }
  const selected = rows.filter(r => r.selected).length;
  const eligible = review.filter(r => r.row.selected && !r.errors.length && !r.matches.length && !r.repeated && !r.row.id).length;
  return <section className="panel-card min-w-0 space-y-4" aria-label="Importación de jugadores">
    <h3 className="text-xl font-bold">Importar Excel</h3>
    <p className="text-sm text-slate-600">Solo fichas deportivas; sin cuentas, habilitaciones ni inscripciones. Las coincidencias no se fusionan ni actualizan. Para homónimos confirmados, usa Agregar jugador y conserva sus ID.</p>
    <a className="font-semibold text-brand underline" href="/panel/administrador/jugadores/plantilla">Descargar plantilla Excel</a>
    <form onSubmit={e => { e.preventDefault(); const data = new FormData(e.currentTarget); start(async () => { setError(""); const r = await uploadPlayers(data); if(r.error) setError(r.error); else { setSheets(r.sheets ?? []); setSheetIndex(0); setRows([]); setReview([]); setResults([]); setConfirmed(false); } }); }} className="flex flex-wrap items-end gap-3">
      <label className="form-label min-w-0">1. Archivo .xlsx (máximo 2 MB)<input className="input max-w-full" name="archivo" type="file" accept=".xlsx" required disabled={pending}/></label><button className="btn-secondary" disabled={pending}>Leer columnas</button>
    </form>
    {sheet && <fieldset disabled={pending} className="space-y-3"><legend className="font-semibold">2. Interpretar archivo</legend>
      <div className="grid gap-3 sm:grid-cols-2"><label className="form-label">Hoja<select className="input" value={sheetIndex} onChange={e => { const next = Number(e.target.value); setSheetIndex(next); setMapping(inferColumnMapping(sheets[next]?.rows[header - 1] ?? []) as Record<string, string>); setRows([]); setReview([]); }}>{sheets.map((s, i) => <option key={i} value={i}>{s.name}</option>)}</select></label>
      <label className="form-label">Formato<select className="input" value={mode} onChange={e => setMode(e.target.value)}><option value="tabla">Tabla con encabezados</option><option value="grupos">Grupos 4.ª fecha: bloques B/F/J/N</option></select></label></div>
      {mode === "grupos" ? <p className="text-sm">Revisa que los nombres estén en B/F/J/N y los números 1–4 en la columna anterior. «Asoc.» se muestra como referencia y no se convierte en club/localidad. No se deducen categorías ni nacimientos.</p> : <>
        <label className="form-label">Fila de encabezados<input className="input" type="number" min={1} max={sheet.rows.length} value={header} onChange={e => { const next = Number(e.target.value); setHeader(next); setMapping(inferColumnMapping(sheet.rows[next - 1] ?? []) as Record<string, string>); }}/></label>
        <div className="grid gap-3 sm:grid-cols-2">{Object.entries(fields).map(([key, label]) => <label className="form-label" key={key}>{label}<select className="input" value={mapping[key] ?? inferColumnMapping(sheet.rows[header - 1] ?? [])[key] ?? ""} onChange={e => setMapping(m => ({ ...m, [key]: e.target.value }))}><option value="">No importar</option>{sheet.rows[header - 1]?.map((v, i) => <option key={i} value={i}>Columna {i + 1}: {v || "(vacía)"}</option>)}</select></label>)}</div>
        <p className="text-xs text-slate-600">Club y localidad deben resolverse con los catálogos existentes en la vista previa. Las columnas no relacionadas se ignoran.</p>
      </>}
      <button className="btn-primary" type="button" onClick={build}>Preparar vista previa</button>
    </fieldset>}
    {rows.length > 0 && <>
      <h4 className="font-semibold">3. Revisar {rows.length} filas · {selected} seleccionadas · {eligible} aptas para crear</h4>
      <p className="text-sm">Revisa nombres, fechas y relaciones. Cada cambio requiere validar de nuevo. Las coincidencias se omiten; corrige variantes hacia el nombre conocido o registra personas distintas individualmente.</p>
      <div className="flex flex-wrap gap-3"><button className="btn-secondary" disabled={pending} onClick={() => { setRows(r => r.map(row => ({...row, selected: false}))); setReview([]); setConfirmed(false); }}>Excluir todas</button><button className="btn-secondary" disabled={pending} onClick={() => start(() => preview(rows))}>Validar cambios</button><button className="btn-secondary" disabled={pending || !review.length} onClick={() => { setRows(r => r.map((row, i) => ({...row, selected: row.selected && !review[i].errors.length && !review[i].matches.length && !review[i].repeated && !row.id}))); setReview([]); setConfirmed(false); }}>Excluir problemáticas</button></div>
      <fieldset disabled={pending} className="min-w-0"><legend className="sr-only">Filas del archivo</legend><table className="block w-full table-fixed text-left text-sm md:table"><thead className="hidden md:table-header-group"><tr><th>Fila / Selección</th><th>Datos interpretados</th><th>Revisión</th></tr></thead><tbody className="block md:table-row-group">{rows.slice(page * 25, page * 25 + 25).map((r, offset) => { const i = page * 25 + offset, v = review[i]; return <tr key={i} className="block border-b md:table-row"><td className="block break-words p-2 align-top md:table-cell"><label><input type="checkbox" checked={r.selected} onChange={e => change(i, {selected: e.target.checked})}/> {r.source}</label>{r.id && <p>ID indicado: {r.id} (no actualizar)</p>}</td><td className="block space-y-2 p-2 md:table-cell">
        <label className="form-label">Nombre<input className="input" maxLength={160} value={r.nombre_completo} onChange={e => change(i, {nombre_completo: e.target.value})}/></label>
        <label className="form-label">Nacimiento<input className="input" placeholder="AAAA-MM-DD o vacío" value={r.fecha_nacimiento} onChange={e => change(i, {fecha_nacimiento: e.target.value})}/></label>
        {([['club_id', 'Club', clubs], ['localidad_procedencia_id', 'Localidad', localities]] as const).map(([field, label, options]) => <label key={field} className="form-label">{label}<select className="input" value={r[field]} onChange={e => change(i, {[field]: e.target.value})}><option value="">Sin asignar</option>{r[field] && !options.some(o => String(o.id) === r[field]) && <option value={r[field]}>Revisar: {r[field]}</option>}{options.filter(o => o.activo).map(o => <option key={o.id} value={o.id}>{o.nombre} · #{o.id}</option>)}</select></label>)}
      </td><td className="block break-words p-2 align-top md:table-cell">{!v ? "Pendiente de validar" : <>{v.errors.map((m, j) => <p key={j} className="text-red-800">{m}</p>)}{v.repeated && <p className="text-amber-900">Nombre repetido en la selección; se omitirá.</p>}{v.matches.map(p => <p key={p.id} className="text-amber-900">Posible coincidencia: <Link className="underline" href={`/panel/administrador/jugadores?editar=${p.id}`} target="_blank">{p.nombre_completo} · #{p.id}</Link> · nacimiento {p.fecha_nacimiento ?? "sin informar"} · club #{p.club_id ?? "—"}</p>)}{!v.errors.length && !v.matches.length && !v.repeated && !r.id && <p>Lista para crear, sin cuenta.</p>}</>}</td></tr>; })}</tbody></table></fieldset>
      <nav className="flex flex-wrap items-center gap-3" aria-label="Páginas de vista previa"><button className="btn-secondary" disabled={page === 0 || pending} onClick={() => setPage(p => p - 1)}>Anterior</button><span>{page + 1} / {Math.ceil(rows.length / 25)}</span><button className="btn-secondary" disabled={(page + 1) * 25 >= rows.length || pending} onClick={() => setPage(p => p + 1)}>Siguiente</button></nav>
      <label className="block text-sm"><input type="checkbox" checked={confirmed} disabled={pending || !review.length || !eligible} onChange={e => setConfirmed(e.target.checked)}/> Confirmo crear únicamente las {eligible} fichas aptas seleccionadas, tras revisar todas las páginas. Las restantes se informarán como omitidas, coincidencias o errores.</label>
      <button className="btn-primary" disabled={pending || !confirmed || !review.length || !eligible} onClick={() => start(async () => { setError(""); const r = await confirmPlayers(rows, confirmed); setResults(r.results ?? []); if (r.error) setError(r.error); setConfirmed(false); await preview(rows); })}>4. Confirmar importación</button>
    </>}
    {pending && <p role="status">Procesando…</p>}{error && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-amber-900">{error}</p>}
    {!!results.length && <div role="status"><h4 className="font-semibold">Resultado del lote</h4><p>{["creado", "omitido", "duplicado", "error", "sin_confirmar"].map(s => `${s}: ${results.filter(r => r.estado === s).length}`).join(" · ")}</p><details><summary>Ver resultados por fila e ID</summary><ul>{results.map((r, i) => <li key={i}>{r.source}: {r.estado}{r.id ? ` · #${r.id}` : ""} {r.mensaje}</li>)}</ul></details></div>}
  </section>;
}
