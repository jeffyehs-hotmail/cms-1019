import { Course, courseUrl, qrOmitReason } from './course.model';

describe('course.model', () => {
  function course(overrides: Partial<Course> = {}): Course {
    return {
      pkid: 1, title: 'Azure 管理', officialTitle: null, courseId: 'AZ104', prodCourseId: 'AZ-104',
      friendlyUrl: 'az-104', displayOrder: 0, partnerPkid: 1, partnerName: 'Microsoft',
      courseGroupPkid: null, courseGroupDescription: null,
      publishStatusPkid: 2, publishStatusDescription: '上架中', publishStatusIsPublished: true,
      scheduleOn: '2026-01-01', scheduleOff: '2026-12-31',
      hour: 32, listPrice: 28000, learningCredit: 4.5, canRepeat: false,
      material: null, objective: null, target: null, prerequisites: null, outline: null,
      towardCertOrExam: null, note: null, otherInfo: null,
      courseFaqCount: 0, courseRelatedLinkCount: 0, hotCourseCount: 0,
      certifications: [], jobCategories: [],
      ...overrides,
    };
  }

  describe('qrOmitReason', () => {
    const cases: { name: string; c: Partial<Course>; today: string; expected: ReturnType<typeof qrOmitReason> }[] = [
      { name: 'published and inside the window', c: {}, today: '2026-06-15', expected: null },
      { name: 'first day (scheduleOn == today) counts as live', c: {}, today: '2026-01-01', expected: null },
      { name: 'last day (scheduleOff == today) counts as live', c: {}, today: '2026-12-31', expected: null },
      { name: 'status not published', c: { publishStatusIsPublished: false }, today: '2026-06-15', expected: 'unpublished' },
      { name: 'day after scheduleOff', c: {}, today: '2027-01-01', expected: 'expired' },
      { name: 'day before scheduleOn', c: {}, today: '2025-12-31', expected: 'notStarted' },
      {
        name: 'unpublished wins over expired (D9 order)',
        c: { publishStatusIsPublished: false }, today: '2027-01-01', expected: 'unpublished',
      },
      {
        name: 'expired wins over not started when the window is inverted',
        c: { scheduleOn: '2026-12-31', scheduleOff: '2026-01-01' }, today: '2026-06-15', expected: 'expired',
      },
    ];

    for (const k of cases) {
      it(k.name, () => expect(qrOmitReason(course(k.c), k.today)).toBe(k.expected));
    }
  });

  it('courseUrl builds the public page URL with an encoded CourseId', () => {
    expect(courseUrl(course({ pkid: 3334, courseId: 'UWA01 a/b' })))
      .toBe('https://www.uuu.com.tw/Course/Show/3334/UWA01%20a%2Fb');
  });
});
