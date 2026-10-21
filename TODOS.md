# TODOS

## Course brochure

### UTM-tag the brochure QR URL
- **What:** Encode `?utm_source=brochure` (or similar) in the brochure's QR URL so scans can be measured.
- **Why:** It's the only way to tell whether printed brochures drive traffic.
- **Pros:** Gives the brochure feature a usage metric; costs one line in `courseUrl` variants.
- **Cons:** Needs the public site (uuu.com.tw) to accept and ignore the query parameter; analytics setup is outside the CMS.
- **Context:** Deferred by /autoplan CEO review (X2, 2026-10-21, `docs/designs/course-brochure-pdf.md`). The public URL is built by `courseUrl(c)` in course.model.ts.
- **Effort:** human S / CC S. **Priority:** P3.
- **Depends on / blocked by:** The public-site owner confirming the URL format.

### Re-fetch the course before printing
- **What:** When 列印PDF is clicked, reload the course so a page left open doesn't print stale data.
- **Why:** Premise 2 says brochure content is live; a long-open page can drift from the DB.
- **Pros:** Always-current PDFs even from stale tabs.
- **Cons:** Brings back an async print path: wait for the QR to redraw, avoid printing stale DOM, timeout and latch reset, and Chrome may block `window.print()` outside the click's user activation.
- **Context:** Deferred by /autoplan CEO review (X5, 2026-10-21) after the spec review showed the complexity. See the spec review notes in `docs/designs/course-brochure-pdf.md` Review record.
- **Effort:** human M / CC S. **Priority:** P3.
- **Depends on / blocked by:** The brochure shipping first; a Chrome check that a non-gesture print still opens.

### Brochure usage signal
- **What:** Record each 列印PDF click (a fire-and-forget POST or existing logging) so adoption is measurable.
- **Why:** `window.print()` is client-side; without a signal nobody knows whether reps stopped using Word.
- **Pros:** Turns the 30/90-day adoption check into data.
- **Cons:** A new API endpoint and storage for a metric; overlaps with any future analytics.
- **Context:** Deferred by /autoplan CEO voice (P1, 2026-10-21). The plan's success criteria now include a manual 30/90-day check with the rep.
- **Effort:** human S / CC S. **Priority:** P3.
- **Depends on / blocked by:** The brochure shipping; a decision on where CMS usage events live.

### 列印PDF from the course list
- **What:** Add a print action to course list rows.
- **Why:** Reps could print without opening each detail page.
- **Pros:** Faster for reps printing several courses.
- **Cons:** The list doesn't load long texts; needs an off-screen brochure render on the list page.
- **Context:** Deferred by /autoplan CEO review (X4, 2026-10-21). The brochure component (`features/courses/course-brochure/`) takes a full `Course`.
- **Effort:** human M / CC S. **Priority:** P3.
- **Depends on / blocked by:** The brochure shipping first.

## QA findings (deferred by /qa, 2026-10-21)

### Sidebar squeezes content on phone-width screens (ISSUE-002)
- **What:** At 375px the app shell's sidebar stays expanded (~240px) and leaves about 135px for page content.
- **Severity / category:** Medium / visual. Workaround: the 收合選單 button.
- **Repro:** open any page (e.g. `/featured-promo-items`) at 375×812 → content column is unusably narrow.
- **Why deferred:** internal desktop admin app with no mobile contract; auto-collapse below a breakpoint (and how it interacts with the remembered collapse state) needs a product decision.
- **Context:** `app.html` / `app.ts` (`collapsed` signal), `app.scss`. Report: `.gstack/qa-reports/qa-report-localhost-2026-10-21.md`.

### Toasts cover the page-header action buttons (ISSUE-003)
- **What:** `<p-toast position="top-right">` in `app.html` overlaps `.page-header .actions`, hiding 儲存/返回/編輯/刪除 while a toast is shown.
- **Severity / category:** Low / UX. Clears after a few seconds or when closed.
- **Repro:** save a CourseGroup, or submit a duplicate AppRole id → the toast sits over the header buttons.
- **Fix idea:** offset the toast below the header (PrimeNG `[style]`/`top` offset) or move it to bottom-right.
- **Context:** `src/CMS.NG/src/app/app.html:53`.

## Design

### Create DESIGN.md with /design-consultation
- **What:** Run /design-consultation to write DESIGN.md: palette, type scale, spacing, PrimeNG usage and print rules.
- **Why:** Each feature re-derives colors and sizes from raw hex in `src/CMS.NG/src/styles.scss`, and design reviews have no baseline to check against.
- **Pros:** Consistent pages, faster reviews, and the brochure's `--brochure-*` tokens become shared tokens.
- **Cons:** About one session of work. It may suggest turning existing hex values into variables across pages.
- **Context:** Found in the course brochure design review (2026-10-21, D12 in `docs/designs/course-brochure-pdf.md`), which reused existing hex values as `--brochure-text/muted/rule`. Start from styles.scss and the PrimeNG Aura theme.
- **Depends on / blocked by:** Nothing. Best done after the brochure ships, so its print rules are included.
