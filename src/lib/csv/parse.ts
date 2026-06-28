// Minimal RFC 4180-ish CSV parser. Handles:
// - quoted fields with commas, newlines, escaped "" quotes
// - CR/LF/CRLF row terminators
// - leading BOM
// - trimming surrounding whitespace on unquoted fields
// No dependencies.

export type CsvParseResult = {
  headers: string[];
  rows: Record<string, string>[];
};

export function parseCsv(input: string): CsvParseResult {
  // Strip BOM
  if (input.charCodeAt(0) === 0xfeff) input = input.slice(1);

  const records: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  let i = 0;

  while (i < input.length) {
    const c = input[i];

    if (inQuotes) {
      if (c === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }

    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === ",") {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (c === "\r") {
      // swallow optional \n
      row.push(field);
      field = "";
      records.push(row);
      row = [];
      i++;
      if (input[i] === "\n") i++;
      continue;
    }
    if (c === "\n") {
      row.push(field);
      field = "";
      records.push(row);
      row = [];
      i++;
      continue;
    }
    field += c;
    i++;
  }
  // tail
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    records.push(row);
  }

  // drop trailing all-empty rows
  while (records.length && records[records.length - 1].every((v) => v.trim() === "")) {
    records.pop();
  }

  if (records.length === 0) return { headers: [], rows: [] };

  const headers = records[0].map((h) => h.replace(/^\s+|\s+$/g, ""));
  const rows: Record<string, string>[] = [];
  for (let r = 1; r < records.length; r++) {
    const raw = records[r];
    const obj: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      const v = raw[c] ?? "";
      obj[headers[c]] = typeof v === "string" ? v.trim() : "";
    }
    rows.push(obj);
  }
  return { headers, rows };
}
