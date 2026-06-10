# CSV Qty Consolidator V2 for Vercel

This is a Vercel-ready Next.js app.

## Main fix in V2

The app removes footer rows before parsing the CSV. This prevents errors such as:

```text
Too few fields: expected 10 fields but parsed 2
```

This usually happens because BrickLink-style exports have data rows with many columns, then footer rows such as:

```text
Total qty,Total Weight
1951,882.0701 +a
```

Those footer rows have fewer fields, so the parser can complain if they are not removed first.

## Output columns

- BLItemNo
- ColorName
- Qty
- Source

## What it does

- Accepts any number of CSV files.
- Extracts BLItemNo, ColorName and Qty.
- Removes Total Qty / Total Weight footer rows and every row after them.
- Finds the highest Qty for each BLItemNo + ColorName combination.
- Shows the sources where each combination exists.
- Lets users search the preview table.
- Lets users download the final CSV.

## Deploy to Vercel

1. Create a GitHub repository.
2. Upload all files in this folder directly to the repository root.
3. Go to https://vercel.com/new
4. Import the GitHub repository.
5. Framework preset should be Next.js.
6. Click Deploy.

## Correct repository structure

```text
your-repo/
├─ app/
│  ├─ globals.css
│  ├─ layout.js
│  └─ page.js
├─ package.json
├─ next.config.js
└─ README.md
```

## Local testing

```bash
npm install
npm run dev
```

Then open:

```text
http://localhost:3000
```
