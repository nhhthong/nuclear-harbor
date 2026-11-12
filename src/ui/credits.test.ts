import { describe, expect, it } from 'vitest';
import { CREDITS } from './credits';

describe('credits', () => {
  it('names the weapon author and both libraries', () => {
    const names = CREDITS.map((c) => c.name);
    expect(names).toContain('funnky');
    expect(names).toContain('Three.js');
    expect(names).toContain('Rapier');
    expect(CREDITS.find((c) => c.name === 'funnky')?.role).toContain('G36C');
  });
});
