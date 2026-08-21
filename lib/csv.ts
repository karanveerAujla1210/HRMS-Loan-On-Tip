export function parseCSV(csvText: string): Record<string, string>[] {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== "");
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]);
  const data: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header.trim()] = values[index] ? values[index].trim() : "";
    });
    data.push(row);
  }

  return data;
}

function parseCSVLine(text: string): string[] {
  const result: string[] = [];
  let cell = "";
  let inQuotes = false;
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    
    if (char === '"' && text[i+1] === '"') {
      // Escaped quote
      cell += '"';
      i++;
    } else if (char === '"') {
      // Toggle quotes
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      // End of cell
      result.push(cell);
      cell = "";
    } else {
      cell += char;
    }
  }
  
  // Push the last cell
  result.push(cell);
  return result;
}

export function generateCSV(headers: string[], data: Record<string, any>[]): string {
  const rows = [headers.map(escapeCSV)];
  
  data.forEach(item => {
    const row = headers.map(header => escapeCSV(String(item[header] ?? "")));
    rows.push(row);
  });
  
  return rows.map(r => r.join(",")).join("\n");
}

function escapeCSV(text: string): string {
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}
