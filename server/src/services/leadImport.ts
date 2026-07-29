import readXlsxFile from "read-excel-file/node";

export interface ParsedLeadRow {
  name: string;
  phone: string;
  email: string;
  source: string;
  notes: string;
}

export interface ImportResult {
  rows: ParsedLeadRow[];
  skipped: { row: number; reason: string }[];
}

const HEADER_ALIASES: Record<keyof ParsedLeadRow, string[]> = {
  name: ["nome", "name", "lead", "nome do lead", "cliente", "nome completo"],
  phone: ["telefone", "phone", "celular", "whatsapp", "tel", "fone", "numero", "número"],
  email: ["email", "e-mail"],
  source: ["origem", "source", "canal", "onde conheceu"],
  notes: ["observacoes", "observações", "obs", "notas", "notes", "comentarios", "comentários"],
};

function normalizeHeader(cell: unknown): string {
  return String(cell ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function buildColumnMap(headerRow: unknown[]): Partial<Record<keyof ParsedLeadRow, number>> {
  const map: Partial<Record<keyof ParsedLeadRow, number>> = {};
  headerRow.forEach((cell, index) => {
    const normalized = normalizeHeader(cell);
    (Object.keys(HEADER_ALIASES) as (keyof ParsedLeadRow)[]).forEach((field) => {
      if (map[field] === undefined && HEADER_ALIASES[field].includes(normalized)) {
        map[field] = index;
      }
    });
  });
  return map;
}

function cellToString(row: unknown[], index: number | undefined): string {
  if (index === undefined) return "";
  const value = row[index];
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function rowsToLeads(rows: unknown[][]): ImportResult {
  if (rows.length === 0) {
    return { rows: [], skipped: [] };
  }

  const columnMap = buildColumnMap(rows[0]);
  if (columnMap.name === undefined) {
    throw new Error(
      'Não encontrei uma coluna de nome na planilha. Use um cabeçalho como "Nome" na primeira linha.'
    );
  }

  const leads: ParsedLeadRow[] = [];
  const skipped: { row: number; reason: string }[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const isBlank = row.every((cell) => cell === null || cell === undefined || String(cell).trim() === "");
    if (isBlank) continue;

    const name = cellToString(row, columnMap.name);
    if (!name) {
      skipped.push({ row: i + 1, reason: "linha sem nome" });
      continue;
    }

    leads.push({
      name,
      phone: cellToString(row, columnMap.phone),
      email: cellToString(row, columnMap.email),
      source: cellToString(row, columnMap.source),
      notes: cellToString(row, columnMap.notes),
    });
  }

  return { rows: leads, skipped };
}

// Parser de CSV minimalista e sem dependências externas: suporta campos entre aspas
// (com aspas escapadas ""), delimitador ',' ou ';' (detectado pelo cabeçalho) e
// campos com quebras de linha internas.
function parseCsv(text: string): string[][] {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      row.push(field);
      field = "";
    } else if (char === "\r") {
      // ignora, tratado junto com \n
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

export async function parseLeadsFile(buffer: Buffer, filename: string): Promise<ImportResult> {
  const isCsv = filename.toLowerCase().endsWith(".csv");

  if (isCsv) {
    const rows = parseCsv(buffer.toString("utf-8"));
    return rowsToLeads(rows);
  }

  const sheets = await readXlsxFile(buffer);
  const rows = sheets[0]?.data ?? [];
  return rowsToLeads(rows as unknown[][]);
}
