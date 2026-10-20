import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { environment } from '@env/environment';
import { UserProfile } from '../../core/auth/auth.model';
import { AUTH_PROFILE_KEY, AuthService } from '../../core/auth/auth.service';
import { PASSWORD_POLICY_MESSAGE } from '../../core/auth/password-policy';
import { Profile } from './profile';

const url = `${environment.apiUrl}/auth/profile`;
const changePasswordUrl = `${environment.apiUrl}/auth/change-password`;

const base: UserProfile = {
  userId: 'alice',
  userName: 'Alice',
  roles: [
    { roleId: 'Admin', roleName: 'Administrator' },
    { roleId: 'User', roleName: 'User' },
  ],
};

describe('Profile', () => {
  let fixture: ComponentFixture<Profile>;
  let http: HttpTestingController;
  let auth: AuthService;
  let messages: MessageService;
  let el: HTMLElement;

  beforeEach(async () => {
    sessionStorage.clear();
    // Signed in before the real AuthService is created, so saving can refresh the stored profile.
    sessionStorage.setItem(AUTH_PROFILE_KEY, JSON.stringify({ userId: 'alice', userName: 'Alice', accessToken: 'a.b.c' }));
    await TestBed.configureTestingModule({
      imports: [Profile],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNoopAnimations(),
        MessageService,
        ConfirmationService,
      ],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
    messages = TestBed.inject(MessageService);
    fixture = TestBed.createComponent(Profile);
    el = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  afterEach(() => {
    http.verify();
    sessionStorage.clear();
  });

  function loadProfile(profile: UserProfile = base): void {
    const req = http.expectOne(url);
    expect(req.request.method).toBe('GET');
    req.flush(profile);
    fixture.detectChanges();
  }

  function typeUserName(value: string): void {
    const input = el.querySelector('#userName') as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function clickSave(): void {
    (el.querySelector('button[type="submit"]') as HTMLButtonElement).click();
    fixture.detectChanges();
  }

  it('shows UserId and roles as read-only text, and UserName in an editable input', () => {
    loadProfile();

    const userId = el.querySelector('[data-field="userId"]') as HTMLElement;
    expect(userId.textContent?.trim()).toBe('alice');
    expect(userId.querySelector('input, select, textarea')).toBeNull();
    expect(el.querySelector('#userId')).toBeNull();

    const roles = el.querySelector('[data-field="roles"]') as HTMLElement;
    expect(roles.textContent).toContain('Administrator (Admin)');
    expect(roles.textContent).toContain('User (User)');
    expect(roles.querySelector('input, select, textarea, p-multiselect, button')).toBeNull();

    const userName = el.querySelector('#userName') as HTMLInputElement;
    expect(userName.value).toBe('Alice');
    expect(userName.disabled).toBeFalse();
    expect(el.querySelectorAll('input:not([type="password"])').length).toBe(1);
  });

  it('shows a placeholder when the user has no roles', () => {
    loadProfile({ ...base, roles: [] });

    expect(el.querySelector('[data-field="roles"]')?.textContent).toContain('尚未指派角色');
  });

  it('saving sends only the trimmed UserName and refreshes the shell profile and sessionStorage', () => {
    loadProfile();
    const toast = spyOn(messages, 'add');

    typeUserName('  Alice Wang  ');
    clickSave();
    const req = http.expectOne(url);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ userName: 'Alice Wang' });
    req.flush({ ...base, userName: 'Alice Wang' });
    fixture.detectChanges();

    expect(auth.userName()).toBe('Alice Wang');
    expect(JSON.parse(sessionStorage.getItem(AUTH_PROFILE_KEY)!)).toEqual({
      userId: 'alice',
      userName: 'Alice Wang',
      accessToken: 'a.b.c',
    });
    expect((el.querySelector('#userName') as HTMLInputElement).value).toBe('Alice Wang');
    expect(toast).toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'success' }));
  });

  for (const blank of ['', '   ']) {
    it(`does not save a blank UserName ("${blank}")`, () => {
      loadProfile();

      typeUserName(blank);
      clickSave();

      http.expectNone(url);
      expect(el.querySelector('small.error')?.textContent).toContain('請輸入使用者名稱');
      expect(auth.userName()).toBe('Alice');
    });
  }

  it('toasts the API message and keeps the shell name when saving fails', () => {
    loadProfile();
    const toast = spyOn(messages, 'add');

    typeUserName('Alice Wang');
    clickSave();
    http.expectOne(url).flush({ message: '請輸入使用者名稱' }, { status: 400, statusText: 'Bad Request' });

    expect(toast).toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'error', detail: '請輸入使用者名稱' }));
    expect(auth.userName()).toBe('Alice');
    expect(JSON.parse(sessionStorage.getItem(AUTH_PROFILE_KEY)!).userName).toBe('Alice');
  });

  describe('change password', () => {
    function typePassword(id: 'currentPassword' | 'newPassword' | 'confirmPassword', value: string): void {
      const input = el.querySelector('#' + id) as HTMLInputElement;
      input.value = value;
      input.dispatchEvent(new Event('input'));
      input.dispatchEvent(new Event('blur'));
      fixture.detectChanges();
    }

    function fill(current: string, next: string, confirm = next): void {
      typePassword('currentPassword', current);
      typePassword('newPassword', next);
      typePassword('confirmPassword', confirm);
    }

    function submit(): void {
      (el.querySelector('form[data-form="password"] button[type="submit"]') as HTMLButtonElement).click();
      fixture.detectChanges();
    }

    function errorUnder(id: string): string {
      return (el.querySelector('#' + id)?.parentElement?.querySelector('small.error')?.textContent ?? '').trim();
    }

    beforeEach(() => loadProfile());

    it('has three empty password inputs (type=password)', () => {
      for (const id of ['currentPassword', 'newPassword', 'confirmPassword']) {
        const input = el.querySelector('#' + id) as HTMLInputElement;
        expect(input.type).withContext(id).toBe('password');
        expect(input.value).withContext(id).toBe('');
      }
    });

    it('requires all three fields and sends nothing when empty', () => {
      submit();

      http.expectNone(changePasswordUrl);
      expect(errorUnder('currentPassword')).toBe('請輸入目前密碼');
      expect(errorUnder('newPassword')).toBe('請輸入新密碼');
      expect(errorUnder('confirmPassword')).toBe('請再次輸入新密碼');
    });

    for (const weak of ['Ab1!xyz', 'abcdefgh', 'abcdefg1', 'ABCDEFG!', 'abcdEFGH', '12345678!@']) {
      it(`rejects a weak new password "${weak}" with the bilingual policy message`, () => {
        fill('P@ssw0rd!', weak);
        submit();

        http.expectNone(changePasswordUrl);
        expect(errorUnder('newPassword')).toBe(PASSWORD_POLICY_MESSAGE);
        expect(errorUnder('newPassword')).toContain('密碼長度至少需 8 碼');
        expect(errorUnder('newPassword')).toContain('Password must be at least 8 characters');
      });
    }

    it('rejects a confirmation that does not match', () => {
      fill('P@ssw0rd!', 'N3wPassword', 'N3wPassw0rd');
      submit();

      http.expectNone(changePasswordUrl);
      expect(errorUnder('newPassword')).toBe('');
      expect(errorUnder('confirmPassword')).toBe('新密碼與確認新密碼不一致');
    });

    it('shows the policy as a hint until the new password is invalid', () => {
      expect(el.querySelector('.policy-hint')?.textContent).toContain('Password must be at least 8 characters');

      typePassword('newPassword', 'short');
      expect(el.querySelector('.policy-hint')).toBeNull();

      typePassword('newPassword', 'Abcdefg1');
      expect(errorUnder('newPassword')).toBe('');
      expect(el.querySelector('.policy-hint')).not.toBeNull();
    });

    it('posts the three passwords, toasts success, clears the form and keeps the session', () => {
      const toast = spyOn(messages, 'add');

      fill('P@ssw0rd!', 'N3wPassword');
      submit();
      const req = http.expectOne(changePasswordUrl);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        currentPassword: 'P@ssw0rd!',
        newPassword: 'N3wPassword',
        confirmPassword: 'N3wPassword',
      });
      req.flush(null, { status: 204, statusText: 'No Content' });
      fixture.detectChanges();

      expect(toast).toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'success' }));
      for (const id of ['currentPassword', 'newPassword', 'confirmPassword']) {
        expect((el.querySelector('#' + id) as HTMLInputElement).value).withContext(id).toBe('');
      }
      expect(errorUnder('newPassword')).toBe('');
      expect(sessionStorage.getItem(AUTH_PROFILE_KEY)).not.toBeNull();
    });

    it('toasts the API message (e.g. wrong current password) and keeps the input', () => {
      const toast = spyOn(messages, 'add');

      fill('wrong', 'N3wPassword');
      submit();
      http.expectOne(changePasswordUrl).flush({ message: '目前密碼錯誤' }, { status: 400, statusText: 'Bad Request' });
      fixture.detectChanges();

      expect(toast).toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'error', detail: '目前密碼錯誤' }));
      expect((el.querySelector('#newPassword') as HTMLInputElement).value).toBe('N3wPassword');
    });

    it('does not submit the UserName form', () => {
      fill('P@ssw0rd!', 'N3wPassword');
      submit();

      http.expectNone(url);
      http.expectOne(changePasswordUrl).flush(null, { status: 204, statusText: 'No Content' });
    });
  });
});
