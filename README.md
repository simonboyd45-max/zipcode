# zipcode — free-text Israeli postal-code lookup

Type an address the way you'd say it — and get the 7-digit Israeli postal code back instantly.

**Live:** https://liors.co.il

---

## The problem with the usual way

Most Israeli zip-code finders make you fill a chain of dependent controls:

> pick **city** → wait → pick **street** (autocomplete) → wait → pick **house number** → submit

That's several clicks, several round-trips, and it only works if you spell everything exactly and already know which official city name the street lives under. It's slow, and it breaks on partial knowledge ("I know the street and number but not the exact municipal name").

## The idea

Replace the whole cascade with **one text box**. You type a free-text address — city, street, and/or house number, **in any order, in Hebrew, with typos** — and the matching postal code surfaces as you type:

```
"הרצל 16 תל אביב"      → 6688402
"דיזנגוף 135"          → 6346108
"רוטשילד ראשון לציון"  → 7526912
```

No dropdowns, no dependent fields, no "select a city first." One input, ranked results, sub-50 ms.

## How it works

The trick is to treat address lookup as a **search-relevance problem**, not a database-join problem. Instead of querying structured columns, every address row is indexed as a searchable document in [Typesense](https://typesense.org/), and the free-text query is matched against several fields at once with typo-tolerance and prefix matching.

```
                 ┌──────────────────────────────────────────┐
   Browser       │  React + Vite single-page app            │
  (one input) ──▶│  debounced fetch on each keystroke        │
                 └───────────────────┬──────────────────────┘
                                     │  POST /api/search { q }
                                     ▼
                 ┌──────────────────────────────────────────┐
   nginx (TLS) ─▶│  Express API  (Node + TypeScript)         │
                 │  • normalises numeric tokens (house no.)  │
                 │  • forwards a single multi-field query    │
                 └───────────────────┬──────────────────────┘
                                     │  search(q, query_by=…)
                                     ▼
                 ┌──────────────────────────────────────────┐
   Typesense ───▶│  collection `zipcodes` (~515k documents)  │
                 │  fields: location_name, street_name,      │
                 │          house_number, zip5, zip7         │
                 │  prefix + typo-tolerant ranking, in-memory│
                 └──────────────────────────────────────────┘
```

### The data

The index is built from Israel Post's official address file — **~515,000 rows**, each loaded as a document with five fields: `location_name` (city/locality), `street_name`, `house_number`, `zip5`, and `zip7` (the current 7-digit code).

### The search

A query hits all the relevant fields in one shot:

- **`query_by: street_name, location_name, house_number`** — so "street + city + number" in any order all contribute to the match.
- **prefix matching** — results appear while you're still typing.
- **typo tolerance** — small spelling mistakes (common in Hebrew transliteration) still resolve.
- **relevance ranking** — the best-matching address floats to the top instead of returning a raw, unordered set.
- **house-number normalisation** — numeric tokens are padded to the stored fixed-width format before querying, so "16" matches the stored "00016".

Because the whole collection lives in memory, typical responses are well under ~20 ms.

### Why this beats the cascading-combobox UX

| | Cascading selects | Free-text + search engine |
|---|---|---|
| Interaction | city → street → number, step by step | one box, type and go |
| Order | must follow the fixed sequence | any order |
| Spelling | must be exact | typo-tolerant |
| Partial input | often blocked until prior field chosen | works with whatever you know |
| Round-trips | several | one (debounced) |

## API

The search endpoint is a plain JSON POST — no key, no registration:

```bash
curl -s -X POST https://liors.co.il/api/search \
  -H 'Content-Type: application/json' \
  -d '{"q":"דיזנגוף 135 תל אביב","perPage":3}'
```

```json
{
  "query": "דיזנגוף 135 תל אביב",
  "results": [
    { "address": "דיזנגוף 135, תל אביב - יפו", "zipcode": "6346108", "raw": { … } }
  ],
  "meta": { "found": 1, "searchTimeMs": 12 }
}
```

Request fields: `q` (free-text address), optional `perPage` and `numTypos`.

## Stack

- **Search:** Typesense (single in-memory collection, rebuilt from the source address file)
- **API:** Node + TypeScript + Express
- **Frontend:** React + Vite (single debounced input)
- **Edge:** nginx (TLS, static hosting, `/api` reverse-proxy)

## Data source

Address and postal-code data is derived from Israel Post's published address file and is refreshed periodically from their releases.
