import { FormControl, FormGroup } from '@angular/forms';
import {
  PASSWORD_POLICY_MESSAGE,
  isComplexPassword,
  passwordPolicyValidator,
  passwordsMatchValidator,
} from './password-policy';

describe('password policy', () => {
  for (const weak of [
    'Ab1!xyz', // 7 chars, all 4 classes
    'abcdefgh', // 1 class
    'abcdefg1', // lower + digit
    'ABCDEFG!', // upper + symbol
    'abcdEFGH', // lower + upper
    '12345678!@', // digit + symbol
    'abcd EFGH', // a space is not a symbol
    '密碼密碼abcDEF', // CJK is not a symbol
    '',
  ]) {
    it(`rejects "${weak}"`, () => {
      expect(isComplexPassword(weak)).toBeFalse();
    });
  }

  for (const strong of ['Abcdefg1', 'abcdefg1!', 'ABCDEFG1-', 'Abcdefg_', 'Ab1!Ab1!', 'abc~def`1']) {
    it(`accepts "${strong}"`, () => {
      expect(isComplexPassword(strong)).toBeTrue();
    });
  }

  it('rejects null and undefined', () => {
    expect(isComplexPassword(null)).toBeFalse();
    expect(isComplexPassword(undefined)).toBeFalse();
  });

  it('passwordPolicyValidator leaves empty values to required', () => {
    expect(passwordPolicyValidator(new FormControl(''))).toBeNull();
    expect(passwordPolicyValidator(new FormControl('abc'))).toEqual({ passwordPolicy: true });
    expect(passwordPolicyValidator(new FormControl('Abcdefg1'))).toBeNull();
  });

  it('passwordsMatchValidator flags only two filled, different values', () => {
    const group = new FormGroup(
      { a: new FormControl(''), b: new FormControl('') },
      { validators: passwordsMatchValidator('a', 'b') },
    );
    expect(group.errors).toBeNull();

    group.setValue({ a: 'Abcdefg1', b: '' });
    expect(group.errors).toBeNull();

    group.setValue({ a: 'Abcdefg1', b: 'abcdefg1' });
    expect(group.errors).toEqual({ passwordMismatch: true });

    group.setValue({ a: 'Abcdefg1', b: 'Abcdefg1' });
    expect(group.errors).toBeNull();
  });

  it('message is bilingual', () => {
    expect(PASSWORD_POLICY_MESSAGE).toContain('密碼長度至少需 8 碼，且內容須至少包含四種字元的其中三種：大寫英文／小寫英文／數字／符號');
    expect(PASSWORD_POLICY_MESSAGE).toContain('Password must be at least 8 characters');
  });
});
