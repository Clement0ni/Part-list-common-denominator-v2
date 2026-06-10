"use client";

import { useMemo, useState } from "react";
import Papa from "papaparse";
import "./globals.css";

function sourceName(filename) {
  return filename.replace(/\.[^/.]+$/, "");
}

function removeFooterTextBeforeParsing(text) {
  const lines = text.split(/\r?\n/);

  const footerIndex = lines.findIndex((line) => {
    const lower = line.toLowerCase();
    return lower.includes("total qty") || lower.includes("total weight");
  });

  if (footerIndex >= 0) {
    return lines.slice(0, footerIndex).join("\n");
  }

  return text;
}

function cleanText(value) {
  return String(value ?? "").trim();
}

function parseQty(value) {
  const number = Number(String(value ?? "").replace(/,/g, "").trim());
  return Number.isFinite(number) ? number : null;
}

function escapeCsvValue(value) {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function makeCsv(rows) {
  const columns = ["BLItemNo", "ColorName", "Qty", "Source"];
  const header = columns.join(",");
  const body = rows.map((row) =>
    columns.map((column) => escapeCsvValue(row[column])).join(",")
  );
  return [header, ...body].join("\n");
}

function downloadCSV(rows) {
  const csv = makeCsv(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = "highest_qty_by_item_color.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

export default function Home() {
  const [files, setFiles] = useState([]);
  const [output, setOutput] = useState([]);
  const [error, setError] = useState("");
  const [processed, setProcessed] = useState(false);
  const [search, setSearch] = useState("");
  const [rawRowCount, setRawRowCount] = useState(0);

  const filteredOutput = useMemo(() => {
    if (!search.trim()) return output;

    const q = search.toLowerCase();
    return output.filter((row) =>
      row.BLItemNo.toLowerCase().includes(q) ||
      row.ColorName.toLowerCase().includes(q) ||
      row.Source.toLowerCase().includes(q)
    );
  }, [output, search]);

  async function processFiles() {
    setError("");
    setOutput([]);
    setProcessed(false);
    setRawRowCount(0);

    if (!files.length) {
      setError("Please upload at least one CSV file.");
      return;
    }

    const allRows = [];
    const fileErrors = [];

    for (const file of files) {
      try {
        const originalText = await file.text();

        // Important V2 fix:
        // Remove Total Qty / Total Weight footer rows before CSV parsing.
        // This prevents PapaParse row length errors such as:
        // "Too few fields: expected 10 fields but parsed 2"
        const cleanedText = removeFooterTextBeforeParsing(originalText);

        const parsed = Papa.parse(cleanedText, {
          header: true,
          skipEmptyLines: true,
          dynamicTyping: false,
          delimiter: "",
          transformHeader: (header) => String(header).trim()
        });

        const seriousErrors = parsed.errors.filter((err) => err.code !== "TooFewFields");
        if (seriousErrors.length) {
          throw new Error(seriousErrors.map((err) => err.message).join("; "));
        }

        const headers = parsed.meta.fields || [];
        const required = ["BLItemNo", "ColorName", "Qty"];
        const missing = required.filter((col) => !headers.includes(col));

        if (missing.length) {
          throw new Error(`Missing column(s): ${missing.join(", ")}`);
        }

        const src = sourceName(file.name);

        for (const row of parsed.data) {
          const blItemNo = cleanText(row.BLItemNo);
          const colorName = cleanText(row.ColorName);
          const qty = parseQty(row.Qty);

          if (!blItemNo || !colorName || qty === null) continue;
          if (blItemNo.toLowerCase() === "nan" || colorName.toLowerCase() === "nan") continue;
          if (/total qty|total weight/i.test(blItemNo)) continue;
          if (/total qty|total weight/i.test(colorName)) continue;

          allRows.push({
            BLItemNo: blItemNo,
            ColorName: colorName,
            Qty: qty,
            Source: src
          });
        }
      } catch (err) {
        fileErrors.push(`${file.name}: ${err.message || "Could not process file."}`);
      }
    }

    if (fileErrors.length) {
      setError(fileErrors.join("\n"));
      return;
    }

    const grouped = new Map();

    for (const row of allRows) {
      const key = `${row.BLItemNo}|||${row.ColorName}`;

      if (!grouped.has(key)) {
        grouped.set(key, {
          BLItemNo: row.BLItemNo,
          ColorName: row.ColorName,
          Qty: row.Qty,
          SourceSet: new Set([row.Source])
        });
      } else {
        const existing = grouped.get(key);
        existing.Qty = Math.max(existing.Qty, row.Qty);
        existing.SourceSet.add(row.Source);
      }
    }

    const result = Array.from(grouped.values())
      .map((row) => ({
        BLItemNo: row.BLItemNo,
        ColorName: row.ColorName,
        Qty: row.Qty,
        Source: Array.from(row.SourceSet).sort().join("; ")
      }))
      .sort((a, b) => {
        const itemCompare = a.BLItemNo.localeCompare(b.BLItemNo, undefined, { numeric: true });
        if (itemCompare !== 0) return itemCompare;
        return a.ColorName.localeCompare(b.ColorName);
      });

    setRawRowCount(allRows.length);
    setOutput(result);
    setProcessed(true);
  }

  function clearAll() {
    setFiles([]);
    setOutput([]);
    setError("");
    setProcessed(false);
    setSearch("");
    setRawRowCount(0);

    const fileInput = document.getElementById("csv-files");
    if (fileInput) fileInput.value = "";
  }

  return (
    <main className="main">
      <section className="card">
        <h1>CSV Qty Consolidator V2</h1>
        <p className="subtitle">
          Upload any number of CSV files. This tool extracts BLItemNo, ColorName and Qty,
          removes Total Qty / Total Weight footer rows before parsing, then finds the
          highest Qty for every BLItemNo + ColorName combination.
        </p>

        <div className="notice">
          V2 fix: footer rows such as <strong>Total qty</strong>, <strong>Total Weight</strong>,
          <strong> 1951</strong>, <strong>1811</strong>, and <strong>2416</strong> are removed
          before the CSV parser reads the file.
        </div>

        <div className="uploadBox">
          <strong>Upload CSV files</strong>
          <br />
          <input
            id="csv-files"
            type="file"
            accept=".csv,text/csv"
            multiple
            onChange={(event) => {
              setFiles(Array.from(event.target.files || []));
              setOutput([]);
              setProcessed(false);
              setError("");
              setSearch("");
              setRawRowCount(0);
            }}
          />
          <p className="small">
            Selected files: {files.length ? files.map((file) => file.name).join(", ") : "None"}
          </p>
        </div>

        <div className="actions">
          <button onClick={processFiles} disabled={!files.length}>
            Process files
          </button>

          <button className="secondary" onClick={() => downloadCSV(output)} disabled={!output.length}>
            Download CSV
          </button>

          <button onClick={clearAll}>
            Clear
          </button>
        </div>

        {error && <div className="error">{error}</div>}

        {processed && (
          <>
            <div className="success">
              Processing complete.
            </div>

            <div className="stats">
              <div className="statBox">
                <span className="statNumber">{files.length}</span>
                <span className="statLabel">Files processed</span>
              </div>
              <div className="statBox">
                <span className="statNumber">{rawRowCount}</span>
                <span className="statLabel">Valid rows extracted</span>
              </div>
              <div className="statBox">
                <span className="statNumber">{output.length}</span>
                <span className="statLabel">Unique combinations</span>
              </div>
            </div>
          </>
        )}

        {output.length > 0 && (
          <>
            <label className="small" htmlFor="search">
              Search BLItemNo, ColorName or Source
            </label>
            <input
              id="search"
              className="searchInput"
              placeholder="Example: Black, bole 002, 99781"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />

            <div className="tableWrap">
              <table>
                <thead>
                  <tr>
                    <th>BLItemNo</th>
                    <th>ColorName</th>
                    <th>Qty</th>
                    <th>Source</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOutput.slice(0, 300).map((row, index) => (
                    <tr key={`${row.BLItemNo}-${row.ColorName}-${index}`}>
                      <td>{row.BLItemNo}</td>
                      <td>{row.ColorName}</td>
                      <td>{row.Qty}</td>
                      <td>{row.Source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="small">
              Showing {Math.min(filteredOutput.length, 300)} of {filteredOutput.length} visible rows.
              Download the CSV to get the complete output.
            </p>
          </>
        )}
      </section>
    </main>
  );
}
