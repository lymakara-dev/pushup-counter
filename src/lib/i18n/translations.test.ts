import { describe, it, expect } from 'vitest';
import { en, km, TranslationDictionary } from './translations';

describe('Translations', () => {
  it('should have all keys in both English and Khmer dictionaries', () => {
    const enKeys = Object.keys(en).sort();
    const kmKeys = Object.keys(km).sort();

    // Verify lengths match
    expect(enKeys.length).toBe(kmKeys.length);

    // Verify exact keys match
    expect(enKeys).toEqual(kmKeys);
  });

  it('should not have empty translations in Khmer', () => {
    for (const [key, value] of Object.entries(km)) {
      if (typeof value === 'string') {
        expect(value.trim()).not.toBe('');
      } else if (typeof value === 'function') {
        expect(value('test')).not.toBe('');
      }
    }
  });

  it('should not have empty translations in English', () => {
    for (const [key, value] of Object.entries(en)) {
      if (typeof value === 'string') {
        expect(value.trim()).not.toBe('');
      } else if (typeof value === 'function') {
        expect(value('test')).not.toBe('');
      }
    }
  });
});
