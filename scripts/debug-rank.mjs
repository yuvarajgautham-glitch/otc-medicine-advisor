/** Scratch tool: show why a query ranks the way it does. node scripts/debug-rank.mjs "query" */
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { matchSymptoms, rankMedicines } from '../src/lib/search.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const index = JSON.parse(await readFile(join(ROOT, 'public', 'search-index.json'), 'utf8'));

const q = process.argv[2] ?? 'my head is pounding';
console.log(`query: "${q}"`);
console.log('symptoms:', matchSymptoms(q).map((s) => `${s.symptom.id}:${s.score}`).join(', ') || '(none)');
console.log();

for (const { entry, score } of rankMedicines(q, index).slice(0, 10)) {
	console.log(
		`${score.toFixed(1).padStart(7)}  parts=${String(entry.n).split(',').length}  labels=${entry.c}  ${entry.n}`
	);
}

for (const name of ['acetaminophen', 'ibuprofen']) {
	const e = index.find((x) => x.n.toLowerCase() === name);
	console.log(`\n${name}: tags=[${e?.y.join(', ')}] labels=${e?.c}`);
}
