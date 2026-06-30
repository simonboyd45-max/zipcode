#!/usr/bin/env node
/*
 * Load data/israel-postal-codes.csv into a local Typesense `zipcodes` collection.
 *
 *   docker run -d --name typesense -p 8108:8108 -v "$PWD/ts-data":/data \
 *     typesense/typesense:0.25.2 --data-dir /data --api-key=xyz
 *   npm i typesense
 *   node tools/load_into_typesense.js
 *
 * Env: TYPESENSE_HOST (localhost), TYPESENSE_PORT (8108), TYPESENSE_API_KEY (xyz)
 */
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const Typesense = require('typesense');

const CSV = path.resolve(__dirname, '../data/israel-postal-codes.csv');
const COLLECTION = 'zipcodes';
const BATCH = 5000;

const client = new Typesense.Client({
  nodes: [{
    host: process.env.TYPESENSE_HOST || 'localhost',
    port: Number(process.env.TYPESENSE_PORT || 8108),
    protocol: process.env.TYPESENSE_PROTOCOL || 'http',
  }],
  apiKey: process.env.TYPESENSE_API_KEY || 'xyz',
  connectionTimeoutSeconds: 60,
});

// Minimal RFC-4180-ish CSV line parser (handles quoted fields with commas/quotes).
function parseLine(line) {
  const out = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') inQ = false;
      else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

async function ensureCollection() {
  try { await client.collections(COLLECTION).delete(); } catch (e) { /* not there yet */ }
  await client.collections().create({
    name: COLLECTION,
    fields: [
      { name: 'location_name', type: 'string' },
      { name: 'street_name', type: 'string' },
      { name: 'house_number', type: 'string' },
      { name: 'zip5', type: 'string' },
      { name: 'zip7', type: 'string' },
    ],
  });
}

async function importBatch(docs) {
  if (!docs.length) return;
  await client.collections(COLLECTION).documents().import(docs, { action: 'create' });
}

(async () => {
  await ensureCollection();
  const rl = readline.createInterface({ input: fs.createReadStream(CSV), crlfDelay: Infinity });
  let header = null, batch = [], total = 0;
  for await (const line of rl) {
    if (!line) continue;
    if (!header) { header = parseLine(line); continue; }
    const [city, street, house, zip5, zip7] = parseLine(line);
    batch.push({ location_name: city, street_name: street, house_number: house, zip5, zip7 });
    if (batch.length >= BATCH) { await importBatch(batch); total += batch.length; batch = []; process.stdout.write(`\rimported ${total}`); }
  }
  await importBatch(batch); total += batch.length;
  console.log(`\nDone. Imported ${total} documents into '${COLLECTION}'.`);
})().catch(e => { console.error(e); process.exit(1); });
