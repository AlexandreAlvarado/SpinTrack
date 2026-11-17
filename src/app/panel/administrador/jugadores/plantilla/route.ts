import ExcelJS from "exceljs";
import { requireRole } from "@/lib/auth";
export async function GET() {
  await requireRole("administrador");
  const w = new ExcelJS.Workbook();
  const s = w.addWorksheet("Jugadores");
  s.addRow(["nombre_completo", "fecha_nacimiento", "club_id", "localidad_procedencia_id", "id"]);
  s.columns.forEach(c => { c.width = 28; });
  s.getRow(1).font = { bold: true };
  return new Response(new Uint8Array(await w.xlsx.writeBuffer()), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": 'attachment; filename="plantilla-jugadores.xlsx"', "Cache-Control": "private, no-store" } });
}
