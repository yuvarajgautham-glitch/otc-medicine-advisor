/**
 * Query understanding for the symptom search box.
 *
 * People do not type label terminology. They type "my head is pounding" or
 * "cant stop coughing". This maps that onto the symptom taxonomy, then ranks
 * medicines that the openFDA label text says treat those symptoms.
 */

import { SYMPTOMS } from '../data/taxonomy.mjs';

/**
 * Age bands offered in the "Anything else to know?" filters.
 *
 * `testAge` is the age a medicine must be licensed for to qualify — the bottom
 * of each band, not the top. A 4-year-old's parent selecting "Child (2–5)"
 * should not be shown something only approved from 6, so the strictest end of
 * the band is what gets tested.
 */
export const AGE_BANDS = [
	{ id: 'baby', label: 'Baby (under 2)', testAge: 1 },
	{ id: 'child-2-5', label: 'Child (2–5)', testAge: 2 },
	{ id: 'child-6-11', label: 'Child (6–11)', testAge: 6 },
	{ id: 'teen', label: 'Teen (12–17)', testAge: 12 },
	{ id: 'adult', label: 'Adult (18+)', testAge: 18 },
];

/** Ages where a pharmacist really should be checking the dose. */
export const CHILD_AGE_BANDS = ['baby', 'child-2-5', 'child-6-11'];

/** How the medicine is taken, grouped from openFDA's route values. */
export const ROUTE_GROUPS = [
	{ id: 'oral', label: 'Tablets, capsules or liquid', routes: ['oral', 'sublingual', 'buccal'] },
	{ id: 'topical', label: 'Cream, gel or ointment', routes: ['topical', 'cutaneous', 'percutaneous', 'transdermal'] },
	{ id: 'nasal', label: 'Nasal spray or drops', routes: ['nasal', 'respiratory (inhalation)'] },
	{ id: 'eye', label: 'Eye drops', routes: ['ophthalmic'] },
	{ id: 'ear', label: 'Ear drops', routes: ['auricular (otic)', 'otic'] },
	{ id: 'other-route', label: 'Suppositories & other', routes: ['rectal', 'vaginal', 'dental', 'oropharyngeal'] },
];

/** Extra preferences that map onto label data we actually have. */
export const PREFERENCES = [
	{
		id: 'non-drowsy',
		label: 'Non-drowsy',
		hint: 'Hides medicines whose label warns they cause drowsiness',
	},
];

export const EMPTY_FILTERS = { age: null, routes: [], preferences: [] };

/** Is any filter actually doing something? */
export const hasActiveFilters = (f) =>
	Boolean(f && (f.age || f.routes?.length || f.preferences?.length));

/**
 * Narrow the catalog before ranking.
 *
 * When an age is selected, medicines whose label never states an age are
 * dropped rather than assumed safe — "the label doesn't say" is not the same
 * as "it's fine for a toddler".
 */
export function filterIndex(index, activeFilters) {
	// Not a default parameter: TypeScript would infer the empty shape's literal
	// types ({age: null}) and then reject a real selection.
	const filters = activeFilters ?? EMPTY_FILTERS;
	if (!hasActiveFilters(filters)) return index;

	const band = filters.age ? AGE_BANDS.find((b) => b.id === filters.age) : null;
	const routeGroups = (filters.routes ?? [])
		.map((id) => ROUTE_GROUPS.find((g) => g.id === id))
		.filter(Boolean);

	return index.filter((entry) => {
		if (band) {
			if (entry.a === null || entry.a === undefined) return false;
			if (entry.a > band.testAge) return false;
		}

		if (routeGroups.length) {
			const routes = (entry.r ?? []).map((r) => String(r).toLowerCase());
			const matches = routeGroups.some((group) =>
				group.routes.some((wanted) => routes.some((r) => r.includes(wanted) || wanted.includes(r)))
			);
			if (!matches) return false;
		}

		if (filters.preferences?.includes('non-drowsy') && entry.d === true) return false;

		return true;
	});
}

/** Rank by how widely marketed something is - used when filters run with no query. */
export function rankByPopularity(index) {
	return index
		.slice()
		.sort((a, b) => (b.c ?? 0) - (a.c ?? 0) || a.n.localeCompare(b.n))
		.map((entry) => ({ entry, score: 0 }));
}

const STOPWORDS = new Set([
	'i', 'me', 'my', 'mine', 'im', 'ive', 'a', 'an', 'the', 'is', 'am', 'are', 'was',
	'be', 'been', 'have', 'has', 'had', 'got', 'get', 'getting', 'feel', 'feeling',
	'feels', 'really', 'very', 'so', 'bad', 'badly', 'quite', 'bit', 'little', 'and',
	'or', 'of', 'for', 'with', 'in', 'on', 'at', 'to', 'from', 'it', 'its', 'that',
	'this', 'these', 'some', 'any', 'help', 'need', 'want', 'what', 'which', 'can',
	'could', 'should', 'take', 'taking', 'medicine', 'medication', 'meds', 'drug',
	'pill', 'pills', 'tablet', 'tablets', 'something', 'anything', 'good', 'best',
	'relief', 'relieve', 'treat', 'treatment', 'cure', 'stop', 'about', 'like',
	'right', 'now', 'today', 'please', 'me', 'you', 'do', 'does', 'how', 'why',
]);

export const normalize = (s) =>
	String(s ?? '')
		.toLowerCase()
		.replace(/['’]/g, '')
		.replace(/[^a-z0-9]+/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();

/**
 * Crude suffix stripping so "coughing" matches "cough" and "itchy" matches
 * "itching". Applied to both the query and the label text, so the two sides
 * only ever have to agree with each other.
 */
export function stem(word) {
	if (word.length > 5 && word.endsWith('ing')) return word.slice(0, -3);
	if (word.length > 4 && word.endsWith('ed')) return word.slice(0, -2);
	if (word.length > 4 && word.endsWith('es')) return word.slice(0, -2);
	if (word.length > 4 && word.endsWith('y')) return word.slice(0, -1);
	if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
	return word;
}

export const tokenize = (s) =>
	normalize(s)
		.split(' ')
		.filter((t) => t.length > 2 && !STOPWORDS.has(t));

/**
 * Every word used anywhere in the taxonomy's user-facing phrasing.
 *
 * Brand names are full of ordinary body words — "Head & Shoulders", "Head
 * Congestion Relief". Without this guard, "my head is pounding" scores dandruff
 * shampoo as a brand-name hit. Words in here describe symptoms, so they are
 * never treated as someone naming a brand.
 */
const SYMPTOM_WORDS = new Set(
	SYMPTOMS.flatMap((s) => [...s.query, s.label]).flatMap((phrase) =>
		normalize(phrase).split(' ')
	)
);

/** Set of stemmed words in a piece of text, for whole-word matching. */
const wordSet = (text) => {
	const set = new Set();
	for (const word of normalize(text).split(' ')) {
		if (!word) continue;
		set.add(word);
		set.add(stem(word));
	}
	return set;
};

/**
 * Field word-sets are derived from static index entries, so compute once and
 * hang the result off the entry rather than redoing it on every keystroke.
 */
function entryWords(entry) {
	if (!entry.__w) {
		entry.__w = {
			name: wordSet(entry.n),
			nameNorm: normalize(entry.n),
			brands: (entry.b ?? []).map((b) => normalize(b)),
			brandWords: wordSet((entry.b ?? []).join(' ')),
			purpose: wordSet(entry.p),
			uses: wordSet(entry.u),
			// "Acetaminophen, Guaifenesin, Phenylephrine Hydrochloride" -> 3
			components: String(entry.n).split(',').length,
		};
	}
	return entry.__w;
}

/**
 * Which symptoms is this query talking about?
 * Returns [{ symptom, score }] sorted strongest first.
 */
export function matchSymptoms(query) {
	const q = ` ${normalize(query)} `;
	if (q.trim() === '') return [];
	const queryTokens = new Set(tokenize(query));
	const hits = [];

	for (const symptom of SYMPTOMS) {
		// Some words only look like this symptom ("hay fever"). If every mention
		// is accounted for by a negating phrase, this symptom isn't being asked
		// about at all.
		if (symptom.negate?.length) {
			let stripped = q;
			for (const phrase of symptom.negate) {
				stripped = stripped.split(normalize(phrase)).join(' ');
			}
			const stillMentioned = symptom.query.some((p) => {
				const n = normalize(p);
				return stripped.includes(` ${n} `) || stripped.split(' ').includes(n);
			});
			if (!stillMentioned) continue;
		}

		let best = 0;
		for (const phrase of symptom.query) {
			const p = normalize(phrase);
			const words = p.split(' ');
			if (q.includes(` ${p} `)) {
				// Whole phrase present - the strongest possible signal.
				best = Math.max(best, 12 * words.length);
			} else if (words.length > 1 && words.every((w) => queryTokens.has(w))) {
				// All the words are there but scattered.
				best = Math.max(best, 7 * words.length);
			} else if (words.length === 1 && queryTokens.has(p)) {
				best = Math.max(best, 9);
			}
		}
		// The symptom's own display name is fair game too ("period cramps").
		const labelNorm = normalize(symptom.label);
		if (q.includes(` ${labelNorm} `)) best = Math.max(best, 14);

		if (best > 0) hits.push({ symptom, score: best });
	}

	return hits.sort((a, b) => b.score - a.score);
}

/**
 * Rank medicines for a query.
 *
 * @param query    raw user input
 * @param index    entries from /search-index.json
 * @param symptoms result of matchSymptoms(query), passed in to avoid recomputing
 */
export function rankMedicines(query, index, symptoms = matchSymptoms(query)) {
	const tokens = tokenize(query);
	if (!tokens.length && !symptoms.length) return [];

	const symptomWeight = new Map();
	symptoms.forEach(({ symptom, score }, i) => {
		// Later (weaker) symptom matches still count, just less.
		symptomWeight.set(symptom.id, score * (i === 0 ? 1 : 0.6));
	});

	const stems = tokens.map(stem);
	const scored = [];

	for (const entry of index) {
		let score = 0;
		const w = entryWords(entry);

		// Symptom overlap is the main signal.
		for (const id of entry.y ?? []) {
			const weight = symptomWeight.get(id);
			if (weight) score += 55 + weight * 2;
		}

		// Direct name lookups: "ibuprofen", "advil", "pepto".
		// Whole words only - substring matching made "cant" hit "lubricant".
		for (let i = 0; i < tokens.length; i++) {
			const token = tokens[i];
			const stemmed = stems[i];

			if (w.nameNorm === token) score += 260;
			else if (w.name.has(token) || w.name.has(stemmed)) score += 120;
			else if (token.length >= 5 && w.nameNorm.includes(token)) score += 70;

			// Best single brand match only. Summing across brands let one common
			// word in four different pack names outweigh the actual medicine.
			let brandScore = 0;
			for (const brand of w.brands) {
				if (brand === token) brandScore = Math.max(brandScore, 240);
				else if (
					token.length >= 4 &&
					!SYMPTOM_WORDS.has(token) &&
					brand.split(' ').includes(token)
				) {
					brandScore = Math.max(brandScore, 50);
				}
			}
			if (!SYMPTOM_WORDS.has(token) && w.brandWords.has(stemmed)) {
				brandScore = Math.max(brandScore, 35);
			}
			score += brandScore;

			if (w.purpose.has(token) || w.purpose.has(stemmed)) score += 30;
			if (w.uses.has(token) || w.uses.has(stemmed)) score += 14;
		}

		if (score > 0) {
			// Combination products treat several things at once. For a single
			// complaint they're the wrong shape of answer, so discount each
			// ingredient beyond the number of symptoms actually asked about.
			const unjustified = Math.max(0, w.components - Math.max(1, symptoms.length));
			score -= unjustified * 30;

			// Lean toward widely-sold ingredients so household names surface above
			// obscure ones with similar symptom matches. Log-scaled: the gap
			// between 10 and 100 marketed products matters far more than the gap
			// between 900 and 1000.
			score += Math.log10(1 + (entry.c ?? 0)) * 12;

			if (score > 0) scored.push({ entry, score });
		}
	}

	return scored.sort((a, b) => b.score - a.score || a.entry.n.localeCompare(b.entry.n));
}
