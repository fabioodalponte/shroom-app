import { describe, expect, it } from 'vitest';
import { cn } from './utils';

describe('cn', () => {
  it('mescla classes simples', () => {
    expect(cn('px-2', 'py-4')).toBe('px-2 py-4');
  });

  it('resolve conflito de utilitários tailwind', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
  });

  it('ignora valores falsy', () => {
    const optionalClass: string | undefined = undefined;
    expect(cn('text-sm', optionalClass, null)).toBe('text-sm');
  });
});
