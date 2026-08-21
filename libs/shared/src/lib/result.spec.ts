import { describe, expect, it } from 'vitest';
import { err, ok } from './result';

describe('Result', () => {
  it('encapsule une valeur', () => {
    expect(ok(42)).toEqual({ ok: true, value: 42 });
  });

  it('encapsule une erreur', () => {
    expect(err('boom')).toEqual({ ok: false, error: 'boom' });
  });
});
