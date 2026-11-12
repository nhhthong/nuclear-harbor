import { describe, expect, it } from 'vitest';
import { buildPrecacheList, fillServiceWorker, shouldRegisterServiceWorker } from './manifest';

describe('precache manifest', () => {
  it('lists build files, drops maps and the service worker, adds the root, is sorted and unique', () => {
    const list = buildPrecacheList([
      'index.html',
      'assets/index-abc.js',
      'assets/index-abc.js.map',
      'sw.js',
      'assets/weapons/g36c/g36c.glb',
      './manifest.webmanifest',
      'index.html',
    ]);
    expect(list).toEqual(['./', 'assets/index-abc.js', 'assets/weapons/g36c/g36c.glb', 'index.html', 'manifest.webmanifest']);
  });

  it('fills the service worker template', () => {
    const tpl = "const VERSION = 'dev';\nconst PRECACHE = [];\nrest();";
    const out = fillServiceWorker(tpl, 'abc123', ['./', 'index.html']);
    expect(out).toContain('const VERSION = "abc123";');
    expect(out).toContain('const PRECACHE = ["./","index.html"];');
    expect(out).toContain('rest();');
  });

  it('refuses a template without placeholders', () => {
    expect(() => fillServiceWorker('nothing', 'v', [])).toThrow();
  });

  it('registers only in production, supported and secure contexts', () => {
    expect(shouldRegisterServiceWorker({ prod: true, supported: true, secure: true })).toBe(true);
    expect(shouldRegisterServiceWorker({ prod: false, supported: true, secure: true })).toBe(false);
    expect(shouldRegisterServiceWorker({ prod: true, supported: false, secure: true })).toBe(false);
    expect(shouldRegisterServiceWorker({ prod: true, supported: true, secure: false })).toBe(false);
  });
});
