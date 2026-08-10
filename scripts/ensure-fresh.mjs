/**
 * Staleness gate. Runs automatically before `npm run dev` and `npm run build`.
 *
 * If the catalog was last pulled from the FDA more than MAX_AGE_DAYS ago, it
 * re-pulls before the site starts. Otherwise it does nothing and gets out of
 * the way — starting the site should be instant on an ordinary day.
 *
 *   node scripts/ensure-fresh.mjs            # refresh only if stale
 *   node scripts/ensure-fresh.mjs --force    # refresh regardless
 *   node scripts/ensure-fresh.mjs --dry-run  # report the decision, fetch nothing
 *   SKIP_DATA_REFRESH=1 npm run dev          # never refresh, just start
 *
 * A failed refresh is deliberately not fatal. Being offline should not stop
 * you launching the site — you just carry on with the data you already have.
 */

import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const META = join(ROOT, 'src', 'data', 'meta.json');

const MAX_AGE_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

const FORCE = process.argv.includes('--force');
const DRY_RUN = process.argv.includes('--dry-run');
const SKIP = process.env.SKIP_DATA_REFRESH === '1';

/** Days since the catalog was pulled, or null if we can't tell. */
async function ageInDays() {
	try {
		const meta = JSON.parse(await readFile(META, 'utf8'));
		const stamped = new Date(meta.generatedAt);
		if (Number.isNaN(stamped.getTime())) return null;
		return (Date.now() - stamped.getTime()) / DAY_MS;
	} catch {
		return null; // never fetched, or the file is unreadable
	}
}

function runFetch() {
	return new Promise((resolve) => {
		// --fresh bypasses the local cache; the whole point of the monthly pull is
		// to pick up labels that weren't there last time.
		const child = spawn(process.execPath, [join(ROOT, 'scripts', 'fetch-openfda.mjs'), '--fresh'], {
			cwd: ROOT,
			stdio: 'inherit',
		});
		child.on('close', (code) => resolve(code === 0));
		child.on('error', () => resolve(false));
	});
}

const age = await ageInDays();

if (SKIP) {
	console.log('[data] SKIP_DATA_REFRESH=1 — using the existing catalog.');
} else if (!FORCE && age !== null && age < MAX_AGE_DAYS) {
	const remaining = Math.ceil(MAX_AGE_DAYS - age);
	console.log(
		`[data] Catalog is ${Math.floor(age)} day(s) old — still fresh. Next pull in ${remaining} day(s).`
	);
} else {
	const why =
		age === null
			? 'no catalog found'
			: FORCE
				? 'forced'
				: `catalog is ${Math.floor(age)} days old (limit ${MAX_AGE_DAYS})`;
	if (DRY_RUN) {
		console.log(`[data] Would pull from the FDA now — ${why}. (--dry-run, nothing fetched.)`);
		process.exit(0);
	}

	console.log(`\n[data] Pulling the latest OTC medicines from the FDA — ${why}.`);
	console.log('[data] This runs about once a month and takes a few minutes.\n');

	const ok = await runFetch();

	if (ok) {
		try {
			const meta = JSON.parse(await readFile(META, 'utf8'));
			console.log(`\n[data] Updated: ${meta.medicineCount} medicines, pulled ${meta.displayStamp}.\n`);
		} catch {
			console.log('\n[data] Update finished.\n');
		}
	} else {
		console.warn(
			'\n[data] Could not reach the FDA — starting with the catalog you already have.\n' +
				'[data] Check your connection and run `npm run data:fresh` to try again.\n'
		);
	}
}
