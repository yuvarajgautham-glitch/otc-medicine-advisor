/**
 * Build the medicine catalog from the FDA's public openFDA drug label API.
 *
 *   node scripts/fetch-openfda.mjs           # uses cache where possible
 *   node scripts/fetch-openfda.mjs --fresh   # ignore cache, refetch everything
 *
 * Strategy: openFDA has ~150k OTC labels, but they are overwhelmingly duplicates
 * — every store brand of ibuprofen files its own. So we ask the API which active
 * ingredients are most common, then pull the best-documented label for each. That
 * gives one good entry per medicine instead of 400 near-identical ibuprofens.
 *
 * Responses are cached under .cache/openfda/ so repeat runs don't burn the
 * anonymous API quota (1000 requests/day per IP).
 */

import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	SYMPTOMS,
	EXCLUDED_PURPOSE_PATTERNS,
	EXCLUDED_NAME_PATTERNS,
	MARKETING_NAME_PATTERNS,
} from '../src/data/taxonomy.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE_DIR = join(ROOT, '.cache', 'openfda');
const OUT_DIR = join(ROOT, 'src', 'data');

const BASE = 'https://api.fda.gov/drug/label.json';
const OTC = 'openfda.product_type:"HUMAN OTC DRUG"';
const FRESH = process.argv.includes('--fresh');

/** How many distinct active ingredients to try to catalog. */
const TARGET_INGREDIENTS = 550;

/* -------------------------------------------------------------- http + cache */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function apiGet(url) {
	const key = createHash('sha1').update(url).digest('hex').slice(0, 16);
	const cacheFile = join(CACHE_DIR, `${key}.json`);

	if (!FRESH) {
		try {
			return JSON.parse(await readFile(cacheFile, 'utf8'));
		} catch {
			/* cache miss - fall through */
		}
	}

	for (let attempt = 0; attempt < 4; attempt++) {
		let res;
		try {
			res = await fetch(url, { headers: { 'User-Agent': 'medicine-finder/1.0' } });
		} catch (err) {
			await sleep(1500 * (attempt + 1));
			continue;
		}

		// 404 from openFDA means "no results", which is a legitimate answer.
		if (res.status === 404) {
			const empty = { results: [], meta: { none: true } };
			await writeFile(cacheFile, JSON.stringify(empty));
			return empty;
		}
		if (res.status === 429 || res.status >= 500) {
			await sleep(2500 * (attempt + 1));
			continue;
		}
		if (!res.ok) throw new Error(`${res.status} on ${url}`);

		const json = await res.json();
		await writeFile(cacheFile, JSON.stringify(json));
		return json;
	}
	throw new Error(`giving up on ${url}`);
}

/** Run tasks with bounded concurrency (openFDA allows 240 req/min anonymously). */
async function mapLimit(items, limit, fn) {
	const out = new Array(items.length);
	let cursor = 0;
	await Promise.all(
		Array.from({ length: Math.min(limit, items.length) }, async () => {
			while (cursor < items.length) {
				const i = cursor++;
				try {
					out[i] = await fn(items[i], i);
				} catch (err) {
					console.warn(`  ! ${items[i]}: ${err.message}`);
					out[i] = null;
				}
			}
		})
	);
	return out;
}

/* ------------------------------------------------------------------ cleaning */

const SECTION_HEADERS =
	/^(purposes?|uses?|indications? and usage|directions?|dosage and administration|warnings?|do not use|ask a doctor or pharmacist|ask a doctor|when using this product|stop use and ask a doctor|stop use|other information|storage and handling|active ingredients?|inactive ingredients?|keep out of reach of children|if pregnant or breast-?feeding|questions or comments\??|questions\??)\s*[:.\-]?\s*/i;

/**
 * Labels repeat the same wording either side of an inline heading
 * ("Antihistamine Purpose: Antihistamine"). Split on the heading and keep
 * each distinct segment once.
 */
function dedupeAroundHeadings(text) {
	const parts = text
		.split(/\s*\b(?:purposes?|uses?|indications?)\s*:\s*/i)
		.map((s) => s.trim())
		.filter(Boolean);
	const seen = new Set();
	const kept = [];
	for (const part of parts) {
		const key = part.toLowerCase().replace(/[^a-z0-9]/g, '');
		if (seen.has(key)) continue;
		seen.add(key);
		kept.push(part);
	}
	return kept.join(' ');
}

/** openFDA text repeats its own section heading. Strip it and tidy whitespace. */
function clean(value, maxLen = 4000) {
	if (!value) return '';
	let text = Array.isArray(value) ? value.join('\n\n') : String(value);
	// Zero-width characters and BOMs sit in front of headings and defeat the
	// leading-header regex below.
	text = text.replace(/[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g, '');
	text = text.replace(/[\u00A0\u2007\u202F]/g, ' ');
	// Labels use whichever bullet glyph their layout tool produced. Normalise to
	// one so the renderer can split them into list items.
	text = text.replace(/[\u25A0\u25AA\u25AB\u25CF\u25E6\u2023\u25A1\u27A2\u2043\uF0A7\uF0B7]/g, '\u2022');
	text = text.replace(/\s+/g, ' ').trim();
	// Headers sometimes appear two or three deep ("Purpose Purpose Pain reliever").
	for (let i = 0; i < 3; i++) {
		const stripped = text.replace(SECTION_HEADERS, '');
		if (stripped === text) break;
		text = stripped.trim();
	}
	text = dedupeAroundHeadings(text);
	if (text.length > maxLen) text = `${text.slice(0, maxLen).trimEnd()}…`;
	return text;
}

/**
 * Homeopathic products are registered with the FDA as OTC drugs, so they come
 * back from this API alongside real medicines. They are excluded: this site
 * answers "what treats this symptom", and listing a 30C dilution as an option
 * next to ibuprofen would imply an equivalence that does not exist.
 */
// Note the spelling: US labels say "homeopathic", imported ones "homoeopathic".
const HOMEOPATHY_MARKERS = /\bHPUS\b|hom[eo]+opath/i;
// Potency notation: 6X, 9x, 30C, 1M, 200CK, or MT for a mother tincture. The
// digit and letter must be adjacent, so unit strings like "500 mg" can't match.
const POTENCY = /\b\d+(?:X|C|CH|CK|D|DH|K|LM|M|MK)\b|\bMT\b/i;

/**
 * Backstop: classical homeopathic materia medica names. The heuristics above
 * catch most products, but some labels state neither a potency nor the word
 * "homeopathic" anywhere machine-readable.
 */
const HOMEOPATHIC_INGREDIENTS = new Set(
	[
		'nux vomica', 'belladonna', 'sulphur', 'sepia', 'arnica montana', 'calendula officinalis',
		'hyoscyamus niger', 'bryonia alba', 'apis mellifera', 'lachesis muta', 'urtica urens',
		'lycopodium clavatum', 'drosera rotundifolia', 'berberis vulgaris', 'pulsatilla',
		'rhus toxicodendron', 'ignatia amara', 'natrum muriaticum', 'phosphorus', 'silicea',
		'thuja occidentalis', 'aconitum napellus', 'gelsemium sempervirens', 'chamomilla',
		'ferrum phosphoricum', 'kali phosphoricum', 'kali sulphuricum', 'kali muriaticum',
		'magnesia phosphorica', 'natrum sulphuricum', 'calcarea carbonica', 'calcarea phosphorica',
		'antimonium tartaricum', 'argentum nitricum', 'aurum metallicum', 'baptisia tinctoria',
		'cantharis', 'carbo vegetabilis', 'causticum', 'china officinalis', 'cocculus indicus',
		'coffea cruda', 'colocynthis', 'euphrasia officinalis', 'graphites', 'hepar sulphuris',
		'hypericum perforatum', 'ipecacuanha', 'kreosotum', 'ledum palustre', 'lytta vesicatoria',
		'mercurius solubilis', 'petroleum', 'phytolacca decandra', 'podophyllum peltatum',
		'ruta graveolens', 'sanguinaria canadensis', 'spongia tosta', 'staphysagria',
		'stramonium', 'symphytum officinale', 'veratrum album', 'zincum metallicum',
	].map((n) => n.toLowerCase())
);

/** True when the ingredient name is a known homeopathic preparation. */
function isHomeopathicName(name) {
	const n = String(name).toLowerCase().trim();
	if (HOMEOPATHIC_INGREDIENTS.has(n)) return true;
	// "arnica montana flower", "lachesis muta venom", "bryonia alba root"
	return [...HOMEOPATHIC_INGREDIENTS].some((h) => h.includes(' ') && n.startsWith(h));
}

function isHomeopathic(label) {
	const fields = [
		label.active_ingredient,
		label.purpose,
		label.spl_product_data_elements,
		label.inactive_ingredient,
		label.indications_and_usage,
	]
		.flat()
		.filter(Boolean)
		.join(' ');
	if (HOMEOPATHY_MARKERS.test(fields)) return true;

	// "URTICA URENS 1M", "Arnica montana Aerial Parts MT 5.0%"
	if (POTENCY.test([label.active_ingredient].flat().filter(Boolean).join(' '))) return true;

	// Homeopathic labels state indications with an asterisk footnoting that the
	// claim has not been evaluated by the FDA, and carry no standard Purpose.
	const uses = [label.indications_and_usage].flat().filter(Boolean).join(' ');
	const hasPurpose = clean(label.purpose).length > 2;
	if (!hasPurpose && /\*/.test(uses)) return true;

	return false;
}

/**
 * openFDA generic names carry trailing route, form and strength qualifiers, so
 * "Ibuprofen", "Ibuprofen Oral" and "Guaifenesin 400 Mg" arrive as separate
 * ingredients. Strip those suffixes so they collapse into one entry.
 */
const TRAILING_QUALIFIER =
	/^(oral|topical|nasal|ophthalmic|otic|rectal|vaginal|external|sublingual|gel|spray|liquid|solution|cream|ointment|lotion|suspension|syrup|tablet|tablets|capsule|capsules|softgel|softgels|caplet|caplets|drop|drops|lozenge|lozenges|patch|patches|foam|powder|usp|mg|mcg|ml|g|%)$/i;

/** Strip trailing route/form/strength words from a single ingredient name. */
function stripQualifiers(name) {
	let parts = String(name).trim().split(/\s+/);
	let changed = true;
	while (changed && parts.length > 1) {
		changed = false;
		const last = parts[parts.length - 1].replace(/[.,]$/, '');
		// Bare numbers ("10"), and number+unit written as one token ("200mg").
		if (
			TRAILING_QUALIFIER.test(last) ||
			/^\d+(\.\d+)?%?$/.test(last) ||
			/^\d+(\.\d+)?\s*(mg|mcg|ml|g|iu|%)$/i.test(last)
		) {
			parts.pop();
			changed = true;
		}
	}
	return parts.join(' ');
}

/** Salt abbreviations vary label to label; spell them out so combos collapse. */
const SALT_ABBREVIATIONS = [
	[/\bhcl\b/gi, 'hydrochloride'],
	[/\bhbr\b/gi, 'hydrobromide'],
	[/\bhg\b/gi, 'hydrogen'],
];

/**
 * Combination products name their components inconsistently — "Guaifenesin and
 * Dextromethorphan HBr", "GUAIFENESIN, DEXTROMETHORPHAN HYDROBROMIDE" and
 * "Guaifenesin and Dextromethorphan Hydrobromide" are one product. Split into
 * components, normalise each, then sort so the order stops mattering.
 */
function canonicalIngredientName(name) {
	const components = String(name)
		.split(/\s*,\s*|\s+and\s+|\s*\/\s*|\s*\+\s*/i)
		.map((part) => {
			// "ACETAMINOPHEN, AND PHENYLEPHRINE HCL" leaves a dangling conjunction.
			let c = stripQualifiers(part.trim().replace(/^and\s+/i, ''));
			for (const [pattern, replacement] of SALT_ABBREVIATIONS) c = c.replace(pattern, replacement);
			return c.replace(/\s+/g, ' ').trim();
		})
		.filter(Boolean);

	const unique = [...new Set(components.map((c) => c.toLowerCase()))].sort();
	return unique.join(', ');
}

/**
 * Tidy a Purpose field for use as a headline.
 *
 * Combination products list each ingredient with its strength, giving
 * "(in each caplet) Purpose Acetaminophen 325 mg Pain reliever/fever reducer
 * Phenylephrine HCl 5 mg Nasal decongestant". Strip the packaging preamble and
 * the ingredient/strength pairs, leaving the purposes themselves.
 */
function cleanPurpose(raw) {
	let text = clean(raw, 400);
	// Leading "(in each caplet)" / "(in each 15 mL)" style preamble.
	text = text.replace(/^\s*\([^)]{0,60}\)\s*/, '');
	text = text.replace(SECTION_HEADERS, '').trim();
	// Dot leaders from labels laid out as a table: "Glycerin 0.25%.....Lubricant"
	text = text.replace(/\.{3,}/g, ' ');
	// The word itself recurs between ingredients on combination products.
	text = text.replace(/\bpurposes?\b/gi, ' ');
	// "Acetaminophen 325 mg", "Phenylephrine HCl 5 mg", "Zinc Oxide 12.8%"
	text = text.replace(/\b[A-Z][A-Za-z-]*(?:\s+[A-Z][A-Za-z-]*){0,3}\s+\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|%)\b/g, ' ');
	text = text.replace(/\b\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|%)\b/g, ' ');
	text = text.replace(/\s*[,;]\s*(?=[,;]|$)/g, ' ');
	text = text.replace(/\s+/g, ' ').replace(/^[\s,;.-]+|[\s,;.-]+$/g, '').trim();

	// Separate purposes end up jammed together; a middot reads better than a space.
	text = text.replace(/(?<=[a-z])\s+(?=(?:Pain reliever|Fever reducer|Antihistamine|Nasal decongestant|Cough suppressant|Expectorant|Antacid|Acid reducer|Antidiarrheal|Laxative|Antiseptic|Analgesic|Antitussive)\b)/g, ' · ');

	// A five-ingredient product can repeat "Pain reliever/fever reducer" twice.
	const seen = new Set();
	text = text
		.split(' · ')
		.map((part) => part.trim())
		.filter((part) => {
			const key = part.toLowerCase().replace(/[^a-z0-9]/g, '');
			if (!key || seen.has(key)) return false;
			seen.add(key);
			return true;
		})
		.join(' · ');

	return text.length > 200 ? `${text.slice(0, 200).trimEnd()}…` : text;
}

const titleCase = (s) =>
	s
		.toLowerCase()
		.replace(/\b([a-z])/g, (m) => m.toUpperCase())
		.replace(/\bHcl\b/g, 'HCl')
		.replace(/\bUsp\b/g, 'USP')
		.replace(/\bNsaid\b/g, 'NSAID');

const slugify = (s) =>
	s
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '')
		.slice(0, 70);

const looksExcluded = (text, patterns) => {
	const t = text.toLowerCase();
	return patterns.some((p) => t.includes(p));
};

/* ------------------------------------------------------------------ pipeline */

async function topIngredients() {
	console.log('Asking openFDA for the most common OTC active ingredients…');
	const url = `${BASE}?search=${encodeURIComponent(OTC)}&count=openfda.generic_name.exact&limit=1000`;
	const { results } = await apiGet(url);

	const names = results
		.map((r) => ({ name: r.term, labelCount: r.count }))
		.filter(({ name }) => {
			const n = name.toLowerCase();
			if (n.length < 3 || n.length > 90) return false;
			// Obvious non-medicines - filtered again by purpose after fetching.
			const junk = [
				'alcohol', 'titanium dioxide', 'avobenzone', 'homosalate', 'octisalate',
				'octocrylene', 'octinoxate', 'oxybenzone', 'ensulizole', 'sodium fluoride',
				'sodium monofluorophosphate', 'stannous fluoride', 'aluminum chlorohydrate',
				'aluminum zirconium', 'aluminum sesquichlorohydrate', 'water', 'purified water',
			];
			if (junk.some((j) => n === j || n.startsWith(`${j},`) || n.includes(j))) return false;
			return true;
		})
		.slice(0, TARGET_INGREDIENTS);

	console.log(`  ${results.length} distinct ingredients, keeping ${names.length}`);
	return names;
}

/** Pick the label with the most complete consumer information. */
/**
 * A "Purpose" should read like "Pain reliever/fever reducer". Some labels put
 * the wrong section's text in the field, which then becomes the medicine's
 * headline on the site — so score plausible ones up and obvious junk down.
 */
function purposeQuality(purposeText) {
	const p = purposeText.trim();
	if (p.length < 3) return 0;
	if (p.length > 160) return 40; // too long to be a purpose statement
	if (/^(do not|directions|keep out|if pregnant|ask a doctor|warning)/i.test(p)) return 10;
	return 200;
}

/**
 * One SPL document can cover a whole product family, splitting its sections
 * with headings like "For Arthritis Pain label" / "For Muscle Aches & Pain
 * label". Those read as nonsense out of context, so prefer a label written for
 * a single product.
 */
const MULTI_PRODUCT_HEADING = /\bfor [^•]{0,40}?\blabel\b/gi;

const multiProductPenalty = (text) => (text.match(MULTI_PRODUCT_HEADING) ?? []).length * 150;

function bestLabel(labels) {
	const score = (l) => {
		const uses = clean(l.indications_and_usage);
		return (
			(uses.length > 40 ? 400 : 0) +
			(clean(l.dosage_and_administration).length > 40 ? 300 : 0) +
			purposeQuality(cleanPurpose(l.purpose)) +
			(clean(l.warnings).length > 40 ? 100 : 0) +
			Math.min(uses.length, 600) / 10 +
			(l.openfda?.brand_name?.length ? 20 : 0) -
			multiProductPenalty(uses) -
			multiProductPenalty(clean(l.dosage_and_administration))
		);
	};
	return labels.slice().sort((a, b) => score(b) - score(a))[0];
}

/**
 * Order brand names so the recognisable ones survive truncation.
 *
 * Most labels for a given ingredient are store brands, so a naive list gives
 * "Leader Ibuprofen, Care One Ibuprofen, Topcare Ibuprofen" and never Advil.
 * A brand that doesn't simply restate the generic name is the one a person
 * would actually type, so those sort first.
 */
function rankBrands(rawBrands, genericName, limit = 18) {
	const genericWords = new Set(
		genericName
			.toLowerCase()
			.split(/[\s,]+/)
			.filter((w) => w.length > 3)
	);

	const cleaned = [
		...new Set(
			rawBrands
				.map((b) => titleCase(String(b).trim()))
				.filter((b) => b.length > 2 && b.length < 45)
				.filter((b) => !looksExcluded(b, EXCLUDED_NAME_PATTERNS))
		),
	];

	const distinctive = [];
	const derivative = [];
	for (const brand of cleaned) {
		const words = brand.toLowerCase().split(/[\s,]+/);
		// "Advil" shares no word with "Ibuprofen"; "Leader Ibuprofen" does.
		(words.some((w) => genericWords.has(w)) ? derivative : distinctive).push(brand);
	}

	// Shorter distinctive names are more likely to be the real household brand.
	distinctive.sort((a, b) => a.length - b.length);
	return [...distinctive, ...derivative].slice(0, limit);
}

/**
 * Lowest age the label permits, in years (0.5 = six months). Returns null when
 * the label says nothing usable.
 *
 * Order matters for safety. An explicit permission ("children 12 years and
 * over: 1 tablet") is trustworthy, so the lowest of those wins. Failing that we
 * fall back to restrictions ("do not use in children under 6 years") and take
 * the *most* restrictive, because guessing low on a children's dose is exactly
 * the mistake this field exists to prevent.
 */
function parseMinAgeYears(texts) {
	const text = texts.filter(Boolean).join(' ').toLowerCase().replace(/\s+/g, ' ');

	const permitted = [];
	// "adults and children 12 years and over", "6 years of age or older"
	for (const m of text.matchAll(/(\d+)\s*(?:years?|yrs?)\s*(?:of age\s*)?(?:and|or)\s*(?:over|older|above)/g)) {
		permitted.push(Number(m[1]));
	}
	// "children 2 to under 6 years" - the band starts at the first number
	for (const m of text.matchAll(/(\d+)\s*(?:to|-|–)\s*(?:under\s*)?\d+\s*(?:years?|yrs?)/g)) {
		permitted.push(Number(m[1]));
	}
	// "6 months and over", "children 6 months to under 2 years"
	for (const m of text.matchAll(/(\d+)\s*months?\s*(?:of age\s*)?(?:and|or|to)\s*(?:over|older|under)/g)) {
		permitted.push(Number(m[1]) / 12);
	}

	if (permitted.length) return Math.min(...permitted.filter((n) => n >= 0 && n <= 120));

	const restricted = [];
	for (const m of text.matchAll(/under\s*(\d+)\s*(?:years?|yrs?)/g)) restricted.push(Number(m[1]));
	if (restricted.length) return Math.max(...restricted.filter((n) => n >= 0 && n <= 120));

	return null;
}

/** Does the label warn this causes drowsiness? true / false / null (unstated). */
function parseDrowsiness(label, brandNames) {
	const text = [label.warnings, label.when_using, label.do_not_use, label.ask_doctor_or_pharmacist]
		.flat()
		.filter(Boolean)
		.join(' ');

	if (/marked drowsiness|may cause drowsiness|will cause drowsiness|drowsiness (?:may|will) occur|excitability may occur/i.test(text)) {
		return true;
	}
	if (/non-?drowsy/i.test(`${text} ${brandNames.join(' ')}`)) return false;
	return null;
}

function tagSymptoms(haystack) {
	const text = haystack.toLowerCase();
	const tags = [];
	for (const s of SYMPTOMS) {
		if (s.label_re.some((p) => new RegExp(p, 'i').test(text))) tags.push(s.id);
	}
	return tags;
}

function buildRecord(ingredient, labels) {
	// Drop homeopathy before choosing a representative label, so we don't end up
	// showing a homeopathic label for an ingredient that also has real products.
	const realLabels = labels.filter((l) => !isHomeopathic(l));
	if (!realLabels.length) return null;

	const label = bestLabel(realLabels);
	if (!label) return null;

	const purpose = cleanPurpose(label.purpose);
	const uses = clean(label.indications_and_usage);
	const genericName = titleCase(canonicalIngredientName(ingredient.name));

	// Drop cosmetics/hygiene that openFDA classes as OTC drugs.
	if (looksExcluded(purpose, EXCLUDED_PURPOSE_PATTERNS)) return null;
	if (looksExcluded(genericName, EXCLUDED_NAME_PATTERNS)) return null;
	if (looksExcluded(genericName, MARKETING_NAME_PATTERNS)) return null;
	if (isHomeopathicName(genericName)) return null;

	const brandNames = rankBrands(
		realLabels.flatMap((l) => l.openfda?.brand_name ?? []),
		genericName
	);

	// Tag from every label for this ingredient, not just the representative one.
	// Benzocaine is a throat lozenge and a teething gel; whichever single label
	// we display, it treats both.
	const allText = realLabels
		.map((l) => `${clean(l.purpose, 300)} ${clean(l.indications_and_usage, 2000)}`)
		.join(' \n ');
	const symptoms = tagSymptoms(allText);

	// An entry with no purpose, no uses text and no symptom tags is not useful
	// to anyone searching by how they feel.
	if (!symptoms.length && uses.length < 40) return null;

	const routes = [...new Set(realLabels.flatMap((l) => l.openfda?.route ?? []))].map(titleCase);

	// Pooled across every label: a children's syrup and an adult caplet of the
	// same ingredient are different products, and the lowest permitted age for
	// the ingredient is what a parent needs to know it exists.
	const ages = realLabels
		.map((l) => parseMinAgeYears([l.dosage_and_administration, l.do_not_use, l.ask_doctor, l.warnings].flat()))
		.filter((a) => a !== null);

	return {
		slug: slugify(genericName),
		genericName,
		brandNames,
		// The un-canonicalised openFDA term, needed to query this ingredient again.
		sourceNames: [ingredient.name],
		purpose,
		uses,
		directions: clean(label.dosage_and_administration),
		warnings: clean(label.warnings, 6000),
		doNotUse: clean(label.do_not_use),
		askDoctor: clean(label.ask_doctor),
		askDoctorOrPharmacist: clean(label.ask_doctor_or_pharmacist),
		whenUsing: clean(label.when_using),
		stopUse: clean(label.stop_use),
		pregnancy: clean(label.pregnancy_or_breast_feeding),
		keepOutOfReach: clean(label.keep_out_of_reach_of_children),
		storage: clean(label.storage_and_handling),
		activeIngredient: clean(label.active_ingredient, 600),
		inactiveIngredient: clean(label.inactive_ingredient, 900),
		routes,
		symptoms,
		minAgeYears: ages.length ? Math.min(...ages) : null,
		drowsy: parseDrowsiness(label, brandNames),
		labelCount: ingredient.labelCount,
		manufacturer: label.openfda?.manufacturer_name?.[0] ?? '',
		ndc: label.openfda?.product_ndc?.[0] ?? '',
		splSetId: label.openfda?.spl_set_id?.[0] ?? label.set_id ?? '',
		effectiveTime: label.effective_time ?? '',
	};
}

/**
 * Second pass for brand names.
 *
 * The label fetch only sees 20 labels per ingredient, which for something like
 * ibuprofen is 20 supermarket own-brands and no Advil. openFDA's `count`
 * endpoint returns every distinct brand name for an ingredient in a single
 * request, so spend one on each of the medicines people are most likely to
 * search for by brand.
 */
const BRAND_ENRICH_COUNT = 180;

async function enrichBrandNames(medicines) {
	const targets = medicines.slice(0, BRAND_ENRICH_COUNT);
	console.log(`Fetching full brand lists for the top ${targets.length} medicines…`);

	let done = 0;
	await mapLimit(targets, 4, async (med) => {
		const found = [];
		for (const source of med.sourceNames) {
			const q = `${OTC} AND openfda.generic_name.exact:"${source}"`;
			const url = `${BASE}?search=${encodeURIComponent(q)}&count=openfda.brand_name.exact&limit=40`;
			const { results } = await apiGet(url);
			for (const row of results ?? []) if (row.term) found.push(row.term);
		}
		med.brandNames = rankBrands([...med.brandNames, ...found], med.genericName);
		if (++done % 40 === 0) console.log(`  …${done}/${targets.length}`);
	});
}

async function main() {
	await mkdir(CACHE_DIR, { recursive: true });
	await mkdir(OUT_DIR, { recursive: true });

	const ingredients = await topIngredients();

	console.log(`Fetching labels for ${ingredients.length} ingredients…`);
	let done = 0;
	const records = await mapLimit(ingredients, 4, async (ing) => {
		const q = `${OTC} AND openfda.generic_name.exact:"${ing.name}"`;
		const { results } = await apiGet(`${BASE}?search=${encodeURIComponent(q)}&limit=20`);
		if (++done % 40 === 0) console.log(`  …${done}/${ingredients.length}`);
		if (!results?.length) return null;
		return buildRecord(ing, results);
	});

	// Deduplicate by slug. Canonicalising names collapses "Ibuprofen Oral" into
	// "Ibuprofen", so keep the better-documented entry but merge in the other's
	// brand names, routes and symptom tags rather than throwing them away.
	const bySlug = new Map();
	for (const rec of records.filter(Boolean)) {
		const existing = bySlug.get(rec.slug);
		if (!existing) {
			bySlug.set(rec.slug, rec);
			continue;
		}
		const [keep, drop] = rec.labelCount > existing.labelCount ? [rec, existing] : [existing, rec];
		keep.brandNames = rankBrands([...keep.brandNames, ...drop.brandNames], keep.genericName);
		keep.routes = [...new Set([...keep.routes, ...drop.routes])];
		keep.symptoms = [...new Set([...keep.symptoms, ...drop.symptoms])];
		keep.sourceNames = [...new Set([...keep.sourceNames, ...drop.sourceNames])];
		const bothAges = [keep.minAgeYears, drop.minAgeYears].filter((a) => a !== null);
		keep.minAgeYears = bothAges.length ? Math.min(...bothAges) : null;
		keep.drowsy = keep.drowsy ?? drop.drowsy;
		keep.labelCount += drop.labelCount;
		bySlug.set(rec.slug, keep);
	}

	const medicines = [...bySlug.values()].sort((a, b) => b.labelCount - a.labelCount);

	await enrichBrandNames(medicines);

	// Slim index shipped to the browser for instant search. Full text stays on
	// the statically-rendered detail pages so we aren't sending megabytes.
	const index = medicines.map((m) => ({
		s: m.slug,
		n: m.genericName,
		b: m.brandNames.slice(0, 10),
		p: m.purpose,
		y: m.symptoms,
		u: m.uses.slice(0, 220),
		c: m.labelCount,
		a: m.minAgeYears,
		r: m.routes,
		d: m.drowsy,
	}));

	await mkdir(join(ROOT, 'public'), { recursive: true });

	// Stamped so the site can show when the catalog was last refreshed, and so
	// the monthly job's result is visible rather than silent.
	const now = new Date();
	const displayDate = `${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()}`;
	const displayTime = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
	await writeFile(
		join(OUT_DIR, 'meta.json'),
		`${JSON.stringify(
			{
				generatedAt: now.toISOString(),
				displayDate,
				displayTime,
				// What the site actually prints: "8/7/2026 at 2:14 PM"
				displayStamp: `${displayDate} at ${displayTime}`,
				medicineCount: medicines.length,
				source: 'openFDA drug label API',
			},
			null,
			'\t'
		)}\n`
	);

	await writeFile(join(OUT_DIR, 'medicines.json'), JSON.stringify(medicines, null, '\t'));
	// Served as a static file and fetched on first interaction, so the homepage
	// doesn't ship 130 kB of JSON it may never need.
	await writeFile(join(ROOT, 'public', 'search-index.json'), JSON.stringify(index));

	const tagged = medicines.filter((m) => m.symptoms.length).length;
	const cached = (await readdir(CACHE_DIR)).length;
	console.log(`\nWrote ${medicines.length} medicines to src/data/medicines.json`);
	console.log(`  ${tagged} tagged with at least one symptom`);
	console.log(`  search index: ${(JSON.stringify(index).length / 1024).toFixed(0)} kB`);
	console.log(`  cache: ${cached} responses in .cache/openfda/`);

	const uncovered = SYMPTOMS.filter((s) => !medicines.some((m) => m.symptoms.includes(s.id)));
	if (uncovered.length) {
		console.log(`\n  Symptoms with no matching medicine: ${uncovered.map((s) => s.id).join(', ')}`);
	}
}

await main();
