# Israel postal-code dataset

A flat, developer-friendly mapping of **city + street + house number → Israeli postal code** (both the legacy 5-digit and the current 7-digit code), covering **515,311** address rows across 91 cities and ~24,000 streets.

## Files

| File | Rows | Size | Notes |
|---|---|---|---|
| [`data/israel-postal-codes.csv`](data/israel-postal-codes.csv) | 515,311 | ~26 MB | full dataset, UTF-8 |
| [`data/sample.csv`](data/sample.csv) | 200 | ~10 KB | preview |

## Schema

| Column | Type | Description |
|---|---|---|
| `city` | string (Hebrew) | locality / city name as published by Israel Post |
| `street` | string (Hebrew) | street name |
| `house_number` | string | house number, zero-padded to 5 digits (e.g. `00009`) |
| `zip5` | string | legacy 5-digit postal code |
| `zip7` | string | current 7-digit postal code |

Notes:
- **UTF-8** encoding; values are Hebrew.
- A single house number can map to more than one `zip7` (e.g. different entrances/sides) — these appear as separate rows.
- `house_number` is kept as a zero-padded string so leading zeros and fixed width are preserved.

## Loading it into Typesense

This dataset powers a free-text address→zip search (see the main [README](README.md)). To reproduce the search locally:

```bash
# 1) run Typesense
docker run -d --name typesense -p 8108:8108 -v "$PWD/ts-data":/data \
  typesense/typesense:0.25.2 --data-dir /data --api-key=xyz

# 2) load the CSV
npm i typesense
node tools/load_into_typesense.js          # reads data/israel-postal-codes.csv
```

See [`tools/load_into_typesense.js`](tools/load_into_typesense.js).

## Querying

Once loaded, a free-text query matches across street/city/house at once with prefix + typo tolerance. There's also a public hosted endpoint:

```bash
curl -s -X POST https://liors.co.il/api/search \
  -H 'Content-Type: application/json' \
  -d '{"q":"דיזנגוף 135 תל אביב","perPage":3}'
```

## Source, attribution & license

- **Source:** derived from **Israel Post**'s published address file (קובץ הכתובות של דואר ישראל). All postal data is © Israel Post.
- This repository redistributes a reformatted (CSV) copy for **community / educational** use, with attribution. If you intend **commercial** use or large-scale redistribution, verify the current terms on Israel Post's official site first.
- The **code** in this repository is MIT-licensed; the **data** remains subject to Israel Post's terms.
- Data is refreshed periodically from Israel Post's releases; treat it as a snapshot, not a real-time source.
