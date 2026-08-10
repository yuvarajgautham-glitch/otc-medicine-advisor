// @ts-check
import { defineConfig } from 'astro/config';

// GitHub Pages serves a project repo from a subfolder, so the site lives at
// <user>.github.io/<repo>/ rather than the domain root. If you rename the repo,
// change `base` to match, or the published links will 404.
const REPO = 'otc-medicine-advisor';
const USER = 'yuvarajgautham-glitch';

// https://astro.build/config
export default defineConfig({
	site: `https://${USER}.github.io`,
	base: `/${REPO}`,
	// Every page is prerendered to static HTML at build time, so the site can be
	// hosted anywhere and search still works without a server.
	output: 'static',
	build: {
		format: 'directory',
	},
});
