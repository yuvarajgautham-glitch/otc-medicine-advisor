/**
 * Presentation helpers for openFDA label text.
 *
 * Label sections arrive as one long run-on string. Some use bullet characters,
 * some don't. These helpers turn them into something readable without inventing
 * or reordering any of the wording.
 */

/**
 * Split a label section into list items when the label itself used bullets.
 * Returns null when the text has no bullet structure, so the caller can fall
 * back to rendering it as a paragraph.
 */
export function asBullets(text) {
	if (!text) return null;
	if (!text.includes('•')) return null;
	const items = text
		.split('•')
		.map((s) => s.trim().replace(/^[-–—:;,\s]+/, '').trim())
		.filter((s) => s.length > 1);
	return items.length > 1 ? items : null;
}

/** "20240115" -> "15 January 2024" */
export function formatLabelDate(yyyymmdd) {
	if (!/^\d{8}$/.test(String(yyyymmdd ?? ''))) return '';
	const s = String(yyyymmdd);
	const date = new Date(Number(s.slice(0, 4)), Number(s.slice(4, 6)) - 1, Number(s.slice(6, 8)));
	if (Number.isNaN(date.getTime())) return '';
	return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

/** Brand names minus any that just restate the generic name. */
export function distinctBrands(genericName, brandNames = []) {
	const generic = genericName.toLowerCase();
	return brandNames.filter((b) => {
		const brand = b.toLowerCase();
		return brand !== generic && brand !== `${generic} usp`;
	});
}

/** Retailer search URLs. These are searches, not stock claims. */
export function buyLinks(name) {
	const q = encodeURIComponent(name);
	return [
		{ label: 'CVS', href: `https://www.cvs.com/search?searchTerm=${q}` },
		{ label: 'Walgreens', href: `https://www.walgreens.com/search/results.jsp?Ntt=${q}` },
		{ label: 'Walmart', href: `https://www.walmart.com/search?q=${q}` },
		{ label: 'Amazon', href: `https://www.amazon.com/s?k=${q}` },
		{ label: 'Compare prices on GoodRx', href: `https://www.goodrx.com/search?query=${q}` },
	];
}
