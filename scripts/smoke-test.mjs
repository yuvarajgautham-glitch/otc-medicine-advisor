/**
 * Smoke test for query handling. Run: node scripts/smoke-test.mjs
 *
 * Checks that realistic phrasings reach sensible medicines, and — more
 * importantly — that dangerous phrasings trip the right red flag.
 */

import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	matchSymptoms,
	rankMedicines,
	filterIndex,
	AGE_BANDS,
	ROUTE_GROUPS,
} from '../src/lib/search.mjs';
import { matchRedFlags } from '../src/data/red-flags.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const index = JSON.parse(await readFile(join(ROOT, 'public', 'search-index.json'), 'utf8'));

let failures = 0;

/**
 * The top results for `query` should include one of `expect`. Several
 * medicines are often equally correct — any NSAID answers "headache" — so the
 * expectation is a set, not a single right answer.
 */
function expectMedicine(query, expect) {
	const wanted = (Array.isArray(expect) ? expect : [expect]).map((e) => e.toLowerCase());
	const ranked = rankMedicines(query, index).slice(0, 6);
	const names = ranked.map((r) => r.entry.n.toLowerCase());
	const ok = names.some((n) => wanted.some((want) => n.includes(want)));
	if (!ok) failures++;
	expect = wanted.join(' or ');
	const symptoms = matchSymptoms(query).slice(0, 2).map((s) => s.symptom.id);
	console.log(
		`${ok ? 'PASS' : 'FAIL'}  "${query}"\n      symptoms: [${symptoms.join(', ')}]\n      top: ${
			names.slice(0, 3).join(' | ') || '(nothing)'
		}\n      wanted: ${expect}\n`
	);
}

/** `query` must trip a red flag of the given tier. */
function expectFlag(query, tier, id) {
	const flags = matchRedFlags(query);
	const hit = flags.find((f) => f.tier === tier && (!id || f.id === id));
	if (!hit) failures++;
	console.log(
		`${hit ? 'PASS' : 'FAIL'}  "${query}" -> ${hit ? `${hit.tier}: ${hit.id}` : `expected ${tier}${id ? `/${id}` : ''}, got [${flags.map((f) => f.id).join(', ') || 'nothing'}]`}`
	);
}

/** `query` must NOT trip any red flag - guards against over-eager matching. */
function expectNoFlag(query) {
	const flags = matchRedFlags(query);
	if (flags.length) failures++;
	console.log(`${flags.length ? 'FAIL' : 'PASS'}  "${query}" -> no flag${flags.length ? ` (got ${flags.map((f) => f.id).join(', ')})` : ''}`);
}

console.log('=== SYMPTOM SEARCH ===\n');
expectMedicine('my head is pounding', ['ibuprofen', 'acetaminophen', 'aspirin', 'naproxen']);
expectMedicine('headache and fever', ['acetaminophen', 'ibuprofen']);
expectMedicine('really bad sore throat', ['benzocaine', 'phenol', 'menthol', 'dyclonine']);
expectMedicine('stuffy nose', ['phenylephrine', 'pseudoephedrine', 'oxymetazoline']);
expectMedicine('cant stop coughing', ['dextromethorphan', 'guaifenesin', 'menthol']);
expectMedicine('heartburn after eating', ['omeprazole', 'famotidine', 'calcium carbonate', 'esomeprazole']);
expectMedicine('itchy rash on my arm', ['hydrocortisone', 'diphenhydramine']);
expectMedicine('i cant sleep', ['diphenhydramine', 'doxylamine']);
expectMedicine('period cramps', ['ibuprofen', 'naproxen', 'acetaminophen']);
expectMedicine('diarrhea', ['loperamide', 'bismuth']);
expectMedicine('constipated', ['docusate', 'senn', 'bisacodyl', 'polyethylene glycol']);
expectMedicine('athletes foot', ['clotrimazole', 'miconazole', 'terbinafine', 'tolnaftate', 'butenafine']);
expectMedicine('hay fever', ['loratadine', 'cetirizine', 'fexofenadine', 'chlorpheniramine']);
expectMedicine('quit smoking', 'nicotine');
expectMedicine('dandruff', ['pyrithione', 'selenium', 'ketoconazole', 'coal tar']);

console.log('\n=== DIRECT NAME LOOKUP ===\n');
expectMedicine('ibuprofen', 'ibuprofen');
expectMedicine('advil', 'ibuprofen');
expectMedicine('motrin', 'ibuprofen');
expectMedicine('aleve', 'naproxen');
expectMedicine('pepto bismol', 'bismuth');
expectMedicine('claritin', 'loratadine');
expectMedicine('zyrtec', 'cetirizine');
expectMedicine('benadryl', 'diphenhydramine');

console.log('\n=== RED FLAGS (must trip) ===\n');
expectFlag('chest pain and sweating', 'emergency', 'cardiac');
expectFlag('my speech is slurred and my face is drooping', 'emergency', 'stroke');
expectFlag('i cant breathe properly', 'emergency', 'breathing');
expectFlag('my throat is closing up', 'emergency', 'anaphylaxis');
expectFlag('coughing up blood', 'emergency', 'bleeding');
expectFlag('i want to kill myself', 'emergency', 'mental-health-crisis');
expectFlag('my child swallowed some pills', 'emergency', 'overdose');
expectFlag('i hit my head and feel sick', 'emergency', 'head-injury');
expectFlag('severe abdominal pain', 'emergency', 'severe-abdominal');
expectFlag('fever and a stiff neck', 'emergency', 'meningitis');
expectFlag('im pregnant and have a headache', 'urgent', 'pregnancy');
expectFlag('headache for weeks now', 'urgent', 'persistent');
expectFlag('i think my cut is infected', 'urgent', 'infection');
expectFlag('im feeling really depressed', 'urgent', 'mental-health');

console.log('\n=== RED FLAGS (must NOT trip) ===\n');
expectNoFlag('headache');
expectNoFlag('sore throat');
expectNoFlag('stuffy nose and sneezing');
expectNoFlag('heartburn');
expectNoFlag('itchy rash');
expectNoFlag('cant sleep');

/* ------------------------------------------------------------- filters */

console.log('\n=== TAILORING FILTERS ===\n');

const assert = (name, ok, detail = '') => {
	if (!ok) failures++;
	console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

const base = { age: null, routes: [], preferences: [] };

// Every age band should leave a usable catalog behind.
for (const band of AGE_BANDS) {
	const pool = filterIndex(index, { ...base, age: band.id });
	assert(
		`age "${band.label}" keeps a usable catalog`,
		pool.length > 0 && pool.length <= index.length,
		`${pool.length} of ${index.length}`
	);
	assert(
		`age "${band.label}" excludes medicines licensed above it`,
		pool.every((e) => e.a !== null && e.a !== undefined && e.a <= band.testAge)
	);
}

// Narrower ages must never yield more than wider ones.
const babyPool = filterIndex(index, { ...base, age: 'baby' }).length;
const adultPool = filterIndex(index, { ...base, age: 'adult' }).length;
assert('younger ages are more restrictive', babyPool < adultPool, `${babyPool} vs ${adultPool}`);

// A toddler must never be shown something the label restricts to 12+.
const toddler = filterIndex(index, { ...base, age: 'child-2-5' });
assert(
	'no 12+ medicine reaches a 2-5 year old',
	toddler.every((e) => e.a <= 2),
	`worst: ${Math.max(...toddler.map((e) => e.a ?? 0))}`
);

for (const group of ROUTE_GROUPS) {
	const pool = filterIndex(index, { ...base, routes: [group.id] });
	assert(`form "${group.label}" returns matches`, pool.length > 0, `${pool.length}`);
}

const nonDrowsy = filterIndex(index, { ...base, preferences: ['non-drowsy'] });
assert(
	'non-drowsy filter removes sedating medicines',
	nonDrowsy.every((e) => e.d !== true) && nonDrowsy.length < index.length,
	`${nonDrowsy.length} of ${index.length}`
);

assert('no filters returns everything', filterIndex(index, base).length === index.length);

// Filters must compose with search, not bypass it.
const childHeadache = rankMedicines('headache', filterIndex(index, { ...base, age: 'child-2-5' }));
assert('child + headache still finds a painkiller', childHeadache.length > 0);
assert(
	'child + headache returns only child-safe options',
	childHeadache.every(({ entry }) => entry.a <= 2)
);

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
