import { Course } from './course.model';
import { EDITABLE_FIELDS, toCourseRequest, validateCell } from './course-inline-edit';

describe('course-inline-edit', () => {
  const base: Course = {
    pkid: 10, title: 'Azure 管理', officialTitle: null, courseId: 'AZ104', prodCourseId: 'AZ-104', friendlyUrl: 'az104',
    displayOrder: 1, partnerPkid: 1, partnerName: 'Microsoft', courseGroupPkid: 46, courseGroupDescription: 'Azure',
    publishStatusPkid: 2, publishStatusDescription: '上架中', scheduleOn: '2026-01-01', scheduleOff: '2027-12-31',
    hour: 32, listPrice: 28000, learningCredit: 4.5, canRepeat: true, material: null, objective: null, target: null,
    prerequisites: null, outline: null, towardCertOrExam: null, note: null, otherInfo: null,
    courseFaqCount: 0, courseRelatedLinkCount: 0, hotCourseCount: 0, certifications: [], jobCategories: [],
  };

  it('excludes pkid and the FK lookup columns', () => {
    const fields: string[] = [...EDITABLE_FIELDS];
    expect(fields).not.toContain('pkid');
    expect(fields).not.toContain('partnerPkid');
    expect(fields).not.toContain('partnerName');
    expect(fields).not.toContain('courseGroupPkid');
    expect(fields).not.toContain('courseGroupDescription');
  });

  describe('validateCell', () => {
    it('requires text fields, trims them and checks ASCII / length', () => {
      expect(validateCell('title', '  New  ', base)).toEqual({ ok: true, value: 'New' });
      expect(validateCell('title', '   ', base)).toEqual({ ok: false, error: '請輸入課程名稱' });
      expect(validateCell('title', 'x'.repeat(201), base)).toEqual({ ok: false, error: '最多 200 字' });
      expect(validateCell('courseId', '', base)).toEqual({ ok: false, error: '請輸入簡介代碼' });
      expect(validateCell('courseId', '中文', base)).toEqual({ ok: false, error: '僅限英數字元' });
      expect(validateCell('prodCourseId', 'AZ-900', base)).toEqual({ ok: true, value: 'AZ-900' });
    });

    it('requires numbers and rejects negatives, overflow and extra decimals', () => {
      expect(validateCell('hour', null, base)).toEqual({ ok: false, error: '請輸入時數' });
      expect(validateCell('hour', -1, base)).toEqual({ ok: false, error: '時數不可為負數' });
      expect(validateCell('hour', 1.5, base)).toEqual({ ok: false, error: '時數須為整數' });
      expect(validateCell('hour', 40000, base)).toEqual({ ok: false, error: '時數不可超過 32767' });
      expect(validateCell('hour', 40, base)).toEqual({ ok: true, value: 40 });
      expect(validateCell('listPrice', -5, base)).toEqual({ ok: false, error: '定價不可為負數' });
      expect(validateCell('listPrice', 10.5, base)).toEqual({ ok: false, error: '定價須為整數' });
      expect(validateCell('listPrice', 0, base)).toEqual({ ok: true, value: 0 });
      expect(validateCell('learningCredit', 'abc', base)).toEqual({ ok: false, error: '點數須為數字' });
      expect(validateCell('learningCredit', 1.25, base)).toEqual({ ok: false, error: '點數最多1位小數' });
      expect(validateCell('learningCredit', 1.5, base)).toEqual({ ok: true, value: 1.5 });
      expect(validateCell('displayOrder', '', base)).toEqual({ ok: false, error: '請輸入顯示順序' });
      expect(validateCell('displayOrder', -3, base)).toEqual({ ok: true, value: -3 });
    });

    it('requires a valid Date and converts it to local ISO', () => {
      expect(validateCell('scheduleOn', null, base)).toEqual({ ok: false, error: '請輸入上架日期' });
      expect(validateCell('scheduleOff', '2026/13/99', base)).toEqual({ ok: false, error: '日期格式不正確' });
      expect(validateCell('scheduleOff', new Date('nope'), base)).toEqual({ ok: false, error: '日期格式不正確' });
      expect(validateCell('scheduleOn', new Date(2026, 2, 9), base)).toEqual({ ok: true, value: '2026-03-09' });
    });

    it('rejects 上架日期 after 下架日期 and 下架日期 before 上架日期', () => {
      expect(validateCell('scheduleOn', new Date(2028, 0, 1), base)).toEqual({ ok: false, error: '下架日期不可早於上架日期' });
      expect(validateCell('scheduleOff', new Date(2025, 11, 31), base)).toEqual({ ok: false, error: '下架日期不可早於上架日期' });
      expect(validateCell('scheduleOff', new Date(2026, 0, 1), base)).toEqual({ ok: true, value: '2026-01-01' });
    });

    it('requires a publish status and coerces the checkbox to boolean', () => {
      expect(validateCell('publishStatusPkid', null, base)).toEqual({ ok: false, error: '請選擇上架狀態' });
      expect(validateCell('publishStatusPkid', 3, base)).toEqual({ ok: true, value: 3 });
      expect(validateCell('canRepeat', null, base)).toEqual({ ok: true, value: false });
      expect(validateCell('canRepeat', true, base)).toEqual({ ok: true, value: true });
    });
  });

  it('toCourseRequest keeps the full record (long texts, n-n ids) and applies the patch', () => {
    const full: Course = {
      ...base, outline: 'long outline', note: 'n',
      certifications: [{ pkid: 7, title: 'AZ-104', partnerName: 'Microsoft' }],
      jobCategories: [{ pkid: 2, description: 'IT' }],
    };
    const req = toCourseRequest(full, { hour: 40 });
    expect(req).toEqual(jasmine.objectContaining({
      pkid: 10, title: 'Azure 管理', courseId: 'AZ104', hour: 40, outline: 'long outline', note: 'n',
      partnerPkid: 1, courseGroupPkid: 46, publishStatusPkid: 2, scheduleOn: '2026-01-01',
      certificationPkids: [7], jobCategoryPkids: [2],
    }));
    expect('partnerName' in req).toBeFalse();
    expect('certifications' in req).toBeFalse();
  });
});
