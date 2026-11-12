/**
 * Pure helpers for the offline precache (T-17). Used by the Vite plugin in `vite.config.ts` at
 * build time; kept free of Node and DOM APIs so they are unit-testable.
 */

/** Files that never go into the precache: source maps and the service worker itself. */
export function isPrecacheable(path: string): boolean {
  return !path.endsWith('.map') && path !== 'sw.js';
}

/**
 * Build the precache list from the relative file paths of the build output (forward slashes).
 * The page root './' is added so a navigation to the bare directory URL works offline.
 */
export function buildPrecacheList(files: readonly string[]): string[] {
  const list = files.filter(isPrecacheable).map((f) => f.replace(/^\.?\//, ''));
  list.sort();
  return ['./', ...new Set(list)];
}

/** Fill the placeholders of the service-worker template. Throws when a placeholder is missing. */
export function fillServiceWorker(template: string, version: string, precache: readonly string[]): string {
  const versionRe = /const VERSION = '[^']*';/;
  const listRe = /const PRECACHE = \[[^\]]*\];/;
  if (!versionRe.test(template) || !listRe.test(template)) {
    throw new Error('sw.js template is missing the VERSION / PRECACHE placeholders');
  }
  return template
    .replace(versionRe, `const VERSION = ${JSON.stringify(version)};`)
    .replace(listRe, `const PRECACHE = ${JSON.stringify(precache)};`);
}

/** Whether to register the service worker: production build, secure context, API present. */
export function shouldRegisterServiceWorker(env: { prod: boolean; supported: boolean; secure: boolean }): boolean {
  return env.prod && env.supported && env.secure;
}
