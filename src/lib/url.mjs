/**
 * Base-aware URLs.
 *
 * GitHub Pages serves a project site from a subfolder — the site's root is
 * /otc-medicine-advisor/, not /. A bare href="/browse" would point at the top
 * of github.io and 404. Astro does not rewrite links for you, so every
 * internal link goes through here.
 *
 * `import.meta.env.BASE_URL` is "/" during local development and the configured
 * base in a production build, so the same code works in both.
 */

/** Anything with a scheme, a fragment, or a protocol-relative prefix is left alone. */
const EXTERNAL = /^([a-z][a-z0-9+.-]*:|\/\/|#)/i;

export function withBase(path = '/') {
	const raw = String(path ?? '/');
	if (EXTERNAL.test(raw)) return raw;

	const base = (import.meta.env?.BASE_URL ?? '/').replace(/\/+$/, '');
	if (!raw.startsWith('/')) return raw; // already relative - leave it be

	// Keep query strings and hashes attached to the path they belong to.
	const joined = `${base}/${raw.replace(/^\/+/, '')}`;
	return joined.replace(/([^:])\/{2,}/g, '$1/') || '/';
}
