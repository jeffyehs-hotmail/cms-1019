import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/** Same text as the API's `PasswordPolicy.Message` (Chinese, then English). */
export const PASSWORD_POLICY_MESSAGE =
  '密碼長度至少需 8 碼，且內容須至少包含四種字元的其中三種：大寫英文／小寫英文／數字／符號\n' +
  '(Password must be at least 8 characters and contain at least 3 of the 4 classes: uppercase / lowercase / digit / symbol.)';

export const PASSWORD_MIN_LENGTH = 8;

/** Uppercase, lowercase, digit, ASCII symbol; mirrors `PasswordPolicy.IsComplex` in the API. */
const CLASSES = [/[A-Z]/, /[a-z]/, /[0-9]/, /[!-/:-@[-`{-~]/];

/** At least 8 characters and at least 3 of the 4 character classes. */
export function isComplexPassword(password: string | null | undefined): boolean {
  if (!password || password.length < PASSWORD_MIN_LENGTH) return false;
  return CLASSES.filter((re) => re.test(password)).length >= 3;
}

/** `{ passwordPolicy: true }` for a non-empty value that fails {@link isComplexPassword} (empty is left to `required`). */
export const passwordPolicyValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null =>
  !control.value || isComplexPassword(control.value) ? null : { passwordPolicy: true };

/** Group validator: `{ passwordMismatch: true }` when both fields are filled and differ. */
export function passwordsMatchValidator(field: string, confirmField: string): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const value = group.get(field)?.value;
    const confirm = group.get(confirmField)?.value;
    return value && confirm && value !== confirm ? { passwordMismatch: true } : null;
  };
}
