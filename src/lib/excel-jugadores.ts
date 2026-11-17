import ExcelJS from "exceljs";
import { inflateRawSync } from "node:zlib";

export const MAX_FILE = 2 * 1024 * 1024;
export const MAX_ROWS = 2000;
export type SheetData = { name: string; rows: string[][] };

// Inspección acotada del ZIP antes de que el lector XML reserve memoria.
export function checkArchive(b: Buffer) {
  let end = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) if (b.readUInt32LE(i) === 0x06054b50) { end = i; break; }
  if (end < 0 || b.readUInt16LE(end + 4) || b.readUInt16LE(end + 6)) throw new Error("Excel ZIP inválido.");
  const count = b.readUInt16LE(end + 10);
  let pos = b.readUInt32LE(end + 16), total = 0;
  if (pos + b.readUInt32LE(end + 12) !== end) throw new Error("Directorio ZIP no admitido.");
  if (count > 300 || count === 0) throw new Error("Demasiados componentes en el Excel.");
  for (let i = 0; i < count; i++) {
    if (pos + 46 > end || b.readUInt32LE(pos) !== 0x02014b50) throw new Error("Directorio ZIP inválido.");
    const flags = b.readUInt16LE(pos + 8), method = b.readUInt16LE(pos + 10);
    const size = b.readUInt32LE(pos + 20), len = b.readUInt16LE(pos + 28), extra = b.readUInt16LE(pos + 30), comment = b.readUInt16LE(pos + 32);
    const offset = b.readUInt32LE(pos + 42), name = b.subarray(pos + 46, pos + 46 + len).toString();
    if (flags & 1 || ![0, 8].includes(method) || /vbaProject|externalLinks|\.\.\//i.test(name) || offset + 30 > b.length || b.readUInt32LE(offset) !== 0x04034b50) throw new Error("Excel cifrado o con componentes no admitidos.");
    const start = offset + 30 + b.readUInt16LE(offset + 26) + b.readUInt16LE(offset + 28);
    if (start + size > b.length) throw new Error("Excel truncado.");
    const compressed = b.subarray(start, start + size);
    const data = method === 8 ? inflateRawSync(compressed, { maxOutputLength: 8 * 1024 * 1024 }) : compressed;
    total += data.length;
    if (total > 20 * 1024 * 1024 || data.length > 8 * 1024 * 1024) throw new Error("Excel descomprimido demasiado grande.");
    if (/\.xml$/i.test(name)) {
      const xml = data.toString();
      if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error("XML no admitido.");
      if (/^xl\/worksheets\/[^/]+\.xml$/i.test(name)) {
        // Impide índices dispersos y merges gigantes antes de instanciar celdas.
        for (const attr of xml.matchAll(/\b(?:r|ref|sqref)\s*=\s*["']([^"']+)["']/g)) {
          if (/^\d+$/.test(attr[1]) && Number(attr[1]) > MAX_ROWS) throw new Error("Fila fuera de límite.");
          for (const ref of attr[1].matchAll(/([A-Z]+)(\d+)/gi)) {
            const column = Array.from(ref[1].toUpperCase()).reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0);
            if (column > 50 || Number(ref[2]) > MAX_ROWS) throw new Error("Rango fuera de límite.");
          }
        }
      }
    }
    pos += 46 + len + extra + comment;
  }
  if (pos !== end) throw new Error("Componentes ZIP inesperados.");
}
export async function readExcel(bytes: Buffer): Promise<SheetData[]> {
  if (!bytes.length || bytes.length > MAX_FILE) throw new Error("Selecciona un .xlsx de hasta 2 MB.");
  checkArchive(bytes);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  if (workbook.worksheets.length > 20) throw new Error("Máximo 20 hojas.");
  return workbook.worksheets.map(sheet => {
    if (sheet.rowCount > MAX_ROWS || sheet.columnCount > 50) throw new Error("Máximo 2000 filas y 50 columnas por hoja.");
    const rows: string[][] = [];
    for (let n = 1; n <= sheet.rowCount; n++) {
      const row: string[] = [];
      for (let c = 1; c <= sheet.columnCount; c++) {
        const cell = sheet.getRow(n).getCell(c), v = cell.value;
        let text = "";
        if (v instanceof Date) text = v.toISOString().slice(0, 10);
        else if (typeof v === "string" || typeof v === "number") text = String(v);
        else if (v && typeof v === "object") text = "richText" in v ? v.richText.map(t => t.text).join("") : "[Contenido no admitido]";
        if (text.length > 300) throw new Error("Una celda supera los 300 caracteres.");
        row.push(text.trim());
      }
      rows.push(row);
    }
    return { name: sheet.name, rows };
  });
}
