// One-time import of the Free Exercise DB (yuhonas/free-exercise-db, Unlicense,
// public domain) into our own Supabase project. Run manually — never called at
// runtime by the app:
//
//   node scripts/import-exercise-db.mjs
//
// Needs NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in the environment
// (same values as .env.local). Safe to re-run: exercise rows are upserted and
// images already present in the exercise-images bucket are skipped, so an
// interrupted run can just be started again.
//
// After this runs once, the app never talks to GitHub again — exercises live
// in our `exercises` table, photos in the `exercise-images` Storage bucket.

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const SOURCE_JSON_URL =
  'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json';
const SOURCE_IMAGE_BASE =
  'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';
const BUCKET = 'exercise-images';
const IMAGE_CONCURRENCY = 8;

function loadEnvLocal() {
  // Keep this dependency-free — just enough .env.local parsing to run standalone.
  try {
    const envPath = path.join(process.cwd(), '.env.local');
    const content = readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    // no .env.local — assume the caller exported the vars themselves
  }
}

async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function main() {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in the environment.');
    process.exit(1);
  }
  const supabase = createClient(url, serviceKey);

  console.log(`Fetching ${SOURCE_JSON_URL} ...`);
  const res = await fetch(SOURCE_JSON_URL);
  if (!res.ok) throw new Error(`Failed to fetch exercises.json: ${res.status}`);
  /** @type {Array<Record<string, unknown>>} */
  const raw = await res.json();
  console.log(`${raw.length} exercises found.`);

  // Per-exercise folder listing is done lazily below (and cached), so a
  // rerun after a partial failure doesn't re-list the whole bucket upfront.
  const existingByPrefix = new Map();

  const rows = raw.map((ex) => ({
    id: ex.id,
    name: ex.name,
    force: ex.force ?? null,
    level: ex.level,
    mechanic: ex.mechanic ?? null,
    equipment: ex.equipment ?? null,
    category: ex.category,
    primary_muscles: ex.primaryMuscles ?? [],
    secondary_muscles: ex.secondaryMuscles ?? [],
    instructions: ex.instructions ?? [],
    images: ex.images ?? [], // storage object paths — same relative paths as upstream
  }));

  console.log('Upserting exercise rows ...');
  const CHUNK = 200;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error } = await supabase.from('exercises').upsert(chunk, { onConflict: 'id' });
    if (error) throw new Error(`Failed to upsert exercises [${i}..${i + chunk.length}): ${error.message}`);
    console.log(`  upserted ${Math.min(i + CHUNK, rows.length)}/${rows.length}`);
  }

  const allImagePaths = rows.flatMap((r) => r.images);
  console.log(`Uploading ${allImagePaths.length} images (concurrency ${IMAGE_CONCURRENCY}) ...`);
  let done = 0;
  let skipped = 0;
  let failed = 0;
  await mapWithConcurrency(allImagePaths, IMAGE_CONCURRENCY, async (imagePath) => {
    try {
      const folder = imagePath.split('/')[0];
      if (!existingByPrefix.has(folder)) {
        const { data } = await supabase.storage.from(BUCKET).list(folder, { limit: 10 });
        existingByPrefix.set(folder, new Set((data ?? []).map((f) => `${folder}/${f.name}`)));
      }
      if (existingByPrefix.get(folder).has(imagePath)) {
        skipped++;
        return;
      }

      const imgRes = await fetch(SOURCE_IMAGE_BASE + imagePath);
      if (!imgRes.ok) throw new Error(`HTTP ${imgRes.status}`);
      const buffer = Buffer.from(await imgRes.arrayBuffer());

      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(imagePath, buffer, { contentType: 'image/jpeg', upsert: true });
      if (error) throw new Error(error.message);
      done++;
    } catch (err) {
      failed++;
      console.error(`  failed: ${imagePath} — ${err instanceof Error ? err.message : err}`);
    } finally {
      const total = done + skipped + failed;
      if (total % 50 === 0) console.log(`  ${total}/${allImagePaths.length} processed`);
    }
  });

  console.log(`Done. uploaded=${done} skipped=${skipped} failed=${failed}`);
  if (failed > 0) {
    console.log('Re-run the script to retry failed uploads — already-uploaded images are skipped.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
