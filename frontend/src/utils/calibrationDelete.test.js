import { validateDeletionReason } from './calibrationDelete';

describe('validateDeletionReason', () => {
  test('throws when reason is missing', () => {
    expect(() => validateDeletionReason(undefined)).toThrow('A deletion reason is required.');
  });

  test('throws when reason is an empty string', () => {
    expect(() => validateDeletionReason('')).toThrow('A deletion reason is required.');
  });

  test('throws when reason is only whitespace', () => {
    expect(() => validateDeletionReason('   \n\t  ')).toThrow('A deletion reason is required.');
  });

  test('returns the trimmed reason when valid', () => {
    expect(validateDeletionReason('  Duplicate entry, wrong equipment  ')).toBe('Duplicate entry, wrong equipment');
  });

  test('returns the reason unchanged when already trimmed', () => {
    expect(validateDeletionReason('Entered against the wrong serial number')).toBe('Entered against the wrong serial number');
  });
});
