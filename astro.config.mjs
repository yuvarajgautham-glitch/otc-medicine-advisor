// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
	// Every page is prerendered to static HTML at build time, so the site can be
	// hosted anywhere and search still works without a server.
	output: 'static',
	build: {
		format: 'directory',
	},
});
