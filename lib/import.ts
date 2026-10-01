import { validateSong, type SongInput } from "./validation";
// RFC 4180-style CSV, including quoted commas, quotes and embedded newlines.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false;
  text = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
          if (text[i + 1] && ![",", "\r", "\n"].includes(text[i + 1]))
            throw new Error("Invalid CSV after a quoted field.");
        }
      } else cell += c;
    } else if (c === '"') {
      if (cell) throw new Error("Invalid CSV quote.");
      quoted = true;
    } else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (quoted) throw new Error("CSV has an unfinished quoted field.");
  row.push(cell);
  if (row.some(Boolean)) rows.push(row);
  return rows;
}
export function parseCatalog(text: string, format: string): SongInput[] {
  if (Buffer.byteLength(text, "utf8") > 200000)
    throw new Error("Import must be smaller than 200 KB.");
  let rows: unknown;
  if (format === "csv") {
    const [header, ...values] = parseCsv(text);
    if (!header) throw new Error("CSV is empty.");
    if (new Set(header).size !== header.length)
      throw new Error("Duplicate CSV column names.");
    for (const name of ["id", "title", "artistName", "releaseYear"])
      if (!header.includes(name))
        throw new Error(`Missing CSV column: ${name}.`);
    rows = values.map((cells) => {
      if (cells.length !== header.length)
        throw new Error("CSV rows must match the header column count.");
      const r: Record<string, unknown> = Object.fromEntries(
        header.map((key, i) => [key, cells[i]]),
      );
      r.status = r.status || "active";
      r.providers = r.providers ? JSON.parse(String(r.providers)) : [];
      return r;
    });
  } else if (format === "json") rows = JSON.parse(text);
  else throw new Error("Choose JSON or CSV.");
  if (!Array.isArray(rows) || rows.length < 1 || rows.length > 100)
    throw new Error("Import 1 to 100 songs at a time.");
  const songs = rows.map(validateSong);
  if (new Set(songs.map((s) => s.id)).size !== songs.length)
    throw new Error("Duplicate song IDs in import.");
  return songs;
}
