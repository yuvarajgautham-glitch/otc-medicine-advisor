/**
 * End-to-end check of the search UI in a real browser.
 *
 *   npm run dev                       # in one terminal
 *   node scripts/browser-test.mjs     # in another
 *
 * Drives Microsoft Edge (already on every Windows machine) rather than
 * downloading a Chromium build.
 */

import { chromium } from 'playwright-core';
import { mkdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = join(ROOT, '.screenshots');
// The dev server honours astro.config's `base`, so the site lives under the
// repo subfolder locally too — same shape as GitHub Pages.
const BASE = process.env.BASE_URL ?? 'http://localhost:4322/otc-medicine-advisor';

await mkdir(SHOTS, { recursive: true });

const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

const consoleErrors = [];
page.on('console', (msg) => {
	if (msg.type() === 'error') consoleErrors.push(msg.text());
});
page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`));

let failures = 0;
const check = (name, ok, detail = '') => {
	if (!ok) failures++;
	console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

async function search(query) {
	await page.fill('#q', '');
	await page.fill('#q', query);
	await page.waitForTimeout(600);
	return page.textContent('#results');
}

console.log(`Testing ${BASE}\n`);

// ---------------------------------------------------------------- homepage
await page.goto(BASE, { waitUntil: 'networkidle' });
check('homepage loads', (await page.title()).includes('OTC Medicine Advisor'));
check('brand reads OTC Medicine Advisor', (await page.textContent('.brand')).includes('OTC Medicine Advisor'));
check('old name is gone', !(await page.content()).includes('OTC Medicine Finder'));
check('search box present', (await page.locator('#q').count()) === 1);
await page.screenshot({ path: join(SHOTS, '01-home.png'), fullPage: false });

// ------------------------------------------------------------ symptom search
let text = await search('my head is pounding');
check('headache search returns results', /Acetaminophen|Ibuprofen/i.test(text), text.slice(0, 70).replace(/\s+/g, ' '));
check('headache search shows symptom heading', /for headache/i.test(text));
await page.screenshot({ path: join(SHOTS, '02-search-headache.png'), fullPage: false });

text = await search('stuffy nose and cant stop coughing');
check('multi-symptom search works', /Phenylephrine|Dextromethorphan|Pseudoephedrine/i.test(text));

// ------------------------------------------------------------ red flags
text = await search('chest pain and sweating');
check('emergency flag shown', /heart attack/i.test(text));
check('emergency suppresses medicines', !/Acetaminophen/i.test(text), 'medicines must be hidden');
check('call 911 action present', (await page.locator('a[href="tel:911"]').count()) > 0);
await page.screenshot({ path: join(SHOTS, '03-red-flag-emergency.png'), fullPage: false });

// The escape hatch must actually reveal results.
await page.click('#show-anyway');
await page.waitForTimeout(400);
text = await page.textContent('#results');
check('"show anyway" reveals medicines', /Acetaminophen|Aspirin|Ibuprofen/i.test(text));

text = await search('im pregnant and have a headache');
check('urgent flag shown with results', /pharmacist or doctor first/i.test(text) && /Acetaminophen|Ibuprofen/i.test(text));
await page.screenshot({ path: join(SHOTS, '04-red-flag-urgent.png'), fullPage: false });

// ------------------------------------------------------------ nav labels
check('nav says Home', (await page.locator('.site-nav a', { hasText: 'Home' }).count()) === 1);
check('nav says Safety FAQ', (await page.locator('.site-nav a', { hasText: 'Safety FAQ' }).count()) === 1);
check('nav says Medicine catalog', (await page.locator('.site-nav a', { hasText: 'Medicine catalog' }).count()) === 1);
check('nav no longer says Search', (await page.locator('.site-nav a', { hasText: /^Search$/ }).count()) === 0);
check('nav no longer says All medicines', (await page.locator('.site-nav a', { hasText: /^All medicines$/ }).count()) === 0);

// ------------------------------------------------------------ chips
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.click('button.chip[data-q="heartburn"]');
await page.waitForTimeout(600);
text = await page.textContent('#results');
check('symptom chip triggers search', /Famotidine|Calcium Carbonate|Omeprazole/i.test(text));
check(
	'clicked chip shows as selected',
	(await page.getAttribute('button.chip[data-q="heartburn"]', 'aria-pressed')) === 'true'
);

// -------------------------------------------------- multi-select symptoms
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.click('button.chip[data-q="Headache"]');
await page.click('button.chip[data-q="Fever"]');
await page.click('button.chip[data-q="Cough"]');
await page.waitForTimeout(700);

const inputValue = await page.inputValue('#q');
check('three chips combine into one query', /headache/i.test(inputValue) && /fever/i.test(inputValue) && /cough/i.test(inputValue), inputValue);
check(
	'all three chips show as selected',
	(await page.locator('button.chip[aria-pressed="true"]').count()) >= 3
);

text = await page.textContent('#results');
check('combined search names every symptom', /headache/i.test(text) && /fever/i.test(text) && /cough/i.test(text));
check('combined search returns medicines', (await page.locator('a.med-card').count()) > 0);
check('selection summary counts symptoms', /symptoms selected/i.test(await page.textContent('#selection-bar')));
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(300);
await page.screenshot({ path: join(SHOTS, '09-multi-select.png'), fullPage: false });

// Deselect one - it should come back out of the query.
await page.click('button.chip[data-q="Fever"]');
await page.waitForTimeout(600);
const afterDeselect = await page.inputValue('#q');
check('clicking a selected chip removes it', !/fever/i.test(afterDeselect) && /headache/i.test(afterDeselect), afterDeselect);
check(
	'deselected chip no longer marked',
	(await page.getAttribute('button.chip[data-q="Fever"]', 'aria-pressed')) === 'false'
);

// Typing should light up chips whose wording appears.
await page.fill('#q', '');
await page.fill('#q', 'sore throat');
await page.waitForTimeout(600);
check(
	'typing marks the matching chip',
	(await page.getAttribute('button.chip[data-q="Sore throat"]', 'aria-pressed')) === 'true'
);

await page.click('#clear-all');
await page.waitForTimeout(400);
check('clear all empties the search', (await page.inputValue('#q')) === '');
check('clear all deselects chips', (await page.locator('button.chip[aria-pressed="true"]').count()) === 0);

// --------------------------------------------------------- detail page nav
await page.goto(`${BASE}/?q=headache`, { waitUntil: 'networkidle' });
await page.waitForTimeout(700);
const firstCard = page.locator('a.med-card').first();
check('results render as cards', (await page.locator('a.med-card').count()) > 0);
const href = await firstCard.getAttribute('href');
await firstCard.click();
await page.waitForLoadState('networkidle');
check('clicking a result opens its detail page', page.url().includes('/medicine/'), page.url());
const detail = await page.textContent('body');
check('detail page has usage info', /What it's used for/i.test(detail));
check('detail page has directions', /How and when to take it/i.test(detail));
check('detail page has warnings', /Warnings|Do not use|Ask a doctor/i.test(detail));
check('detail page has where to buy', /Where to buy it/i.test(detail));
check('detail page cites the FDA', /openFDA|FDA/i.test(detail));
await page.screenshot({ path: join(SHOTS, '05-detail.png'), fullPage: false });

// -------------------------------------------------------------- other pages
for (const [path, needle] of [
	['/browse', 'Medicine catalog'],
	['/safety', 'Safety FAQ'],
	['/about', 'About the data'],
	['/contact', 'We want your feedback'],
]) {
	await page.goto(BASE + path, { waitUntil: 'networkidle' });
	const body = await page.textContent('body');
	check(`${path} renders`, body.includes(needle));
}

// ------------------------------------------------------------- contact
await page.goto(`${BASE}/contact`, { waitUntil: 'networkidle' });
check('nav has Contact', (await page.locator('.site-nav a', { hasText: 'Contact' }).count()) === 1);
check(
	'contact email is a mailto link',
	(await page.locator('a[href="mailto:abcdefg1234@gmail.com"]').count()) > 0
);
const contactText = await page.textContent('body');
check('"Especially useful to hear about" box is gone', !/Especially useful to hear about/i.test(contactText));
check('its contents are gone too', !/most useful bug report/i.test(contactText));
check('feedback message and warning remain', /We want your feedback/i.test(contactText) && /medical advice/i.test(contactText));
await page.screenshot({ path: join(SHOTS, '11-contact.png'), fullPage: false });

// --------------------------------------------------------- about cleanup
await page.goto(`${BASE}/about`, { waitUntil: 'networkidle' });
const aboutText = await page.textContent('body');
check('About no longer has "Refreshing the data"', !/Refreshing the data/i.test(aboutText));
check('About no longer mentions npm run data', !/npm run data/i.test(aboutText));

// ------------------------------------------------------- safety FAQ hub
await page.goto(`${BASE}/safety`, { waitUntil: 'networkidle' });
check('hub has the 911 box', (await page.locator('.flag--emergency').count()) > 0);
check('hub has "For additional questions" panel', /For additional questions/i.test(await page.textContent('body')));
check('hub has three sub-boxes', (await page.locator('a.subbox').count()) === 3);
check('hub itself lists no questions', (await page.locator('details.faq-item').count()) === 0);
await page.screenshot({ path: join(SHOTS, '10-safety-hub.png'), fullPage: false });

// Each sub-box must open a real page with the accordion format.
const subPages = [
	['How to use', '/safety/how-to-use', 12],
	['Is this an emergency?', '/safety/is-this-an-emergency', 12],
	['Do I need a doctor for this?', '/safety/do-i-need-a-doctor', 8],
];

for (const [title, expectedPath, minQuestions] of subPages) {
	await page.goto(`${BASE}/safety`, { waitUntil: 'networkidle' });
	await page.locator('a.subbox', { hasText: title }).click();
	await page.waitForLoadState('networkidle');
	check(`"${title}" opens its own page`, page.url().includes(expectedPath), page.url());

	const count = await page.locator('details.faq-item').count();
	check(`"${title}" uses the Q&A format`, count >= minQuestions, `${count} questions`);
	check(`"${title}" starts collapsed`, (await page.locator('details.faq-item[open]').count()) === 0);

	const q = page.locator('details.faq-item').first();
	check(`"${title}" answer hidden until clicked`, !(await q.locator('.faq-answer').isVisible()));
	await q.locator('summary').click();
	await page.waitForTimeout(250);
	check(`"${title}" opens on click`, await q.locator('.faq-answer').isVisible());
	check(`"${title}" links back to the hub`, (await page.locator('a[href$="/safety"]').count()) > 0);
}

// ------------------------------------------------------- data tracking Q
await page.goto(`${BASE}/safety/how-to-use`, { waitUntil: 'networkidle' });
const trackingQ = page.locator('details.faq-item', { hasText: 'track our data' });
check('data-tracking question exists', (await trackingQ.count()) === 1);
await trackingQ.locator('summary').click();
await page.waitForTimeout(250);
const trackingAnswer = await trackingQ.locator('.faq-answer').textContent();
check(
	'answer says no data is tracked',
	/no data is collected|do not track/i.test(trackingAnswer) && /generic/i.test(trackingAnswer),
	trackingAnswer.slice(0, 60)
);
await page.screenshot({ path: join(SHOTS, '12-how-to-use.png'), fullPage: false });
await page.goto(`${BASE}/browse`, { waitUntil: 'networkidle' });
await page.screenshot({ path: join(SHOTS, '06-browse.png'), fullPage: false });
await page.goto(`${BASE}/safety`, { waitUntil: 'networkidle' });
await page.screenshot({ path: join(SHOTS, '07-safety.png'), fullPage: false });

// --------------------------------------------------- last pulled from FDA
const meta = JSON.parse(await readFile(join(ROOT, 'src', 'data', 'meta.json'), 'utf8'));

await page.goto(`${BASE}/about`, { waitUntil: 'networkidle' });
const stamp = (await page.textContent('.last-updated')).trim();
check('About says "Last pulled from FDA"', /Last pulled from FDA/.test(stamp), stamp);
check(
	'the stamp carries a date and time',
	/\d{1,2}\/\d{1,2}\/\d{4} at \d{1,2}:\d{2}\s*(AM|PM)/i.test(stamp),
	stamp
);
check('the stamp matches the data file', stamp.includes(meta.displayStamp), meta.displayStamp);
check('old "Last FDA update" wording is gone', !/Last FDA update/i.test(await page.content()));
check(
	'the stamp sits above the heading',
	await page.evaluate(() => {
		const s = document.querySelector('.last-updated');
		const h = document.querySelector('h1');
		return Boolean(s && h && s.compareDocumentPosition(h) & Node.DOCUMENT_POSITION_FOLLOWING);
	})
);
check(
	'the stamp is right-aligned with the content',
	await page.evaluate(() => {
		const s = document.querySelector('.last-updated').getBoundingClientRect();
		const h = document.querySelector('h1').getBoundingClientRect();
		return Math.abs(s.right - h.right) <= 2;
	})
);

await page.goto(BASE, { waitUntil: 'networkidle' });
check('home no longer shows the stamp', (await page.locator('.last-updated').count()) === 0);

// --------------------------------------------- "Anything else to know?"
check('tailoring section exists', (await page.locator('#tailor').count()) === 1);
check(
	'tailoring section sits above browse-by-symptom',
	await page.evaluate(() => {
		const tailor = document.querySelector('#tailor');
		const browse = document.querySelector('#browse-symptoms');
		return Boolean(tailor && browse && tailor.compareDocumentPosition(browse) & Node.DOCUMENT_POSITION_FOLLOWING);
	})
);
check('has an age filter', (await page.locator('.chip--filter[data-filter="age"]').count()) >= 4);
check('has a form filter', (await page.locator('.chip--filter[data-filter="routes"]').count()) >= 3);

// Filters alone, with nothing typed, should still produce a list.
await page.click('.chip--filter[data-value="child-2-5"]');
await page.waitForTimeout(700);
text = await page.textContent('#results');
check('age filter alone returns medicines', (await page.locator('a.med-card').count()) > 0);
check('child age filter warns about dosing', /doses for young children are different/i.test(text));
check('active filters are summarised', /Narrowed to/i.test(text));

// It must actually narrow, not just decorate.
const childOnly = await page.locator('a.med-card').count();
await page.click('#clear-filters');
await page.waitForTimeout(600);
await page.fill('#q', 'headache');
await page.waitForTimeout(700);
const unfiltered = await page.locator('a.med-card').count();
await page.click('.chip--filter[data-value="child-2-5"]');
await page.waitForTimeout(700);
const filtered = await page.locator('a.med-card').count();
check('age filter changes the results', filtered < unfiltered, `${unfiltered} -> ${filtered}`);
check('filtered results are not empty', filtered > 0);
await page.screenshot({ path: join(SHOTS, '13-tailored.png'), fullPage: false });

// Route filter should restrict to that form.
await page.click('#clear-filters');
await page.waitForTimeout(500);
await page.fill('#q', 'itchy rash');
await page.waitForTimeout(700);
await page.click('.chip--filter[data-value="topical"]');
await page.waitForTimeout(700);
// Card hrefs already include the base, so resolve against the origin, not BASE.
const firstResult = await page.locator('a.med-card').first().getAttribute('href');
await page.goto(new URL(firstResult, BASE).href, { waitUntil: 'networkidle' });
check(
	'form filter returns a topical medicine',
	/topical|cutaneous|transdermal|percutaneous/i.test(await page.textContent('body')),
	firstResult
);

// Age is single-select; forms are multi-select.
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.click('.chip--filter[data-value="teen"]');
await page.click('.chip--filter[data-value="adult"]');
await page.waitForTimeout(500);
check(
	'only one age can be selected',
	(await page.locator('.chip--filter[data-filter="age"][aria-pressed="true"]').count()) === 1
);
await page.click('.chip--filter[data-value="oral"]');
await page.click('.chip--filter[data-value="topical"]');
await page.waitForTimeout(500);
check(
	'several forms can be selected',
	(await page.locator('.chip--filter[data-filter="routes"][aria-pressed="true"]').count()) === 2
);

await page.click('#clear-all');
await page.waitForTimeout(400);
check(
	'clear all also clears filters',
	(await page.locator('.chip--filter[aria-pressed="true"]').count()) === 0
);

// ------------------------------------------------------- no auto-scroll
// The chips and filters sit below the results, so any self-scrolling drags
// people away from the controls they are still clicking.
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.locator('#browse-symptoms').scrollIntoViewIfNeeded();
await page.waitForTimeout(400);

// What matters is where the clicked control appears on screen, not window.scrollY
// — the browser legitimately adjusts scrollY to hold content still when the
// block above grows. If the chip under the cursor doesn't move, nothing moved.
const topOf = async (selector) => Math.round((await page.locator(selector).boundingBox()).y);

async function expectsNoMovement(name, selector, action) {
	const before = await topOf(selector);
	await action();
	await page.waitForTimeout(800);
	const after = await topOf(selector);
	check(name, Math.abs(before - after) <= 3, `${before}px -> ${after}px`);
}

const symptomChip = '#browse-symptoms .chip[data-q="Headache"]';
await expectsNoMovement('clicking a symptom chip moves nothing', symptomChip, () =>
	page.click(symptomChip)
);

// Second click, now that a full results list exists above.
await expectsNoMovement('adding a second symptom moves nothing', symptomChip, () =>
	page.click('#browse-symptoms .chip[data-q="Cough"]')
);

// Deselecting shrinks the block above - must not pull the page either.
await expectsNoMovement('deselecting a symptom moves nothing', symptomChip, () =>
	page.click('#browse-symptoms .chip[data-q="Cough"]')
);

// Same for the tailoring filters, which also insert a "Narrowed to" bar.
await page.locator('#tailor').scrollIntoViewIfNeeded();
await page.waitForTimeout(400);
const ageChip = '.chip--filter[data-value="adult"]';
await expectsNoMovement('clicking a filter moves nothing', ageChip, () => page.click(ageChip));
await expectsNoMovement('removing a filter moves nothing', ageChip, () => page.click(ageChip));
await expectsNoMovement('clicking a form filter moves nothing', ageChip, () =>
	page.click('.chip--filter[data-value="oral"]')
);

// And the page must never scroll itself when a search is typed from the top.
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.fill('#q', 'headache');
await page.waitForTimeout(900);
check(
	'typing a search does not scroll the page',
	(await page.evaluate(() => Math.round(window.scrollY))) === 0
);
await page.fill('#q', 'chest pain');
await page.waitForTimeout(900);
check(
	'an emergency result does not scroll the page',
	(await page.evaluate(() => Math.round(window.scrollY))) === 0
);

// ---------------------------------------------------------------- mobile
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(BASE, { waitUntil: 'networkidle' });
const overflow = await page.evaluate(
	() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
);
check('no horizontal overflow on mobile', !overflow);
await page.screenshot({ path: join(SHOTS, '08-mobile.png'), fullPage: false });

// ------------------------------------------------------------------ errors
check('no console errors', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));

await browser.close();
console.log(`\n${failures === 0 ? 'ALL BROWSER CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
console.log(`screenshots in ${SHOTS}`);
process.exit(failures === 0 ? 0 : 1);
