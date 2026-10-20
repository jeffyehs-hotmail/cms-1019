import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { QrCode } from './qr-code';
import { QrCodeRenderer } from './qr-code-renderer';

@Component({
  imports: [QrCode],
  template: `<app-qr-code [text]="text()" [title]="title()" [filename]="filename()" [size]="96" />`,
})
class Host {
  readonly text = signal('https://www.uuu.com.tw/Course/Show/42/CCNP');
  readonly title = signal('CCNP');
  readonly filename = signal<string | undefined>(undefined);
}

describe('QrCode', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;

  async function create(): Promise<void> {
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    // wait for the async render promise
    await new Promise((r) => setTimeout(r, 0));
    fixture.detectChanges();
  }

  const el = () => fixture.nativeElement as HTMLElement;
  const canvas = () => el().querySelector('canvas') as HTMLCanvasElement;
  const qr = () => fixture.debugElement.children[0].componentInstance as QrCode;

  /** Count of dark pixels on the canvas — a rendered code has many; a blank canvas has none. */
  function darkPixels(): number {
    const c = canvas();
    const data = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 0; i < data.length; i += 4) if (data[i] < 128 && data[i + 3] > 0) n++;
    return n;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Host],
      providers: [provideNoopAnimations()],
    }).compileComponents();
  });

  it('renders the text as a QR code on the canvas and shows the title', async () => {
    await create();

    expect(el().querySelector('[data-qr-title]')?.textContent?.trim()).toBe('CCNP');
    expect(canvas().width).toBe(96);
    expect(canvas().getAttribute('title')).toBe('https://www.uuu.com.tw/Course/Show/42/CCNP');
    expect(darkPixels()).toBeGreaterThan(500);
    expect(qr().ready()).toBeTrue();
  });

  it('passes the text to the renderer and re-renders when it changes', async () => {
    const renderer = TestBed.inject(QrCodeRenderer);
    const render = spyOn(renderer, 'render').and.callThrough();
    await create();
    expect(render).toHaveBeenCalledOnceWith(canvas(), 'https://www.uuu.com.tw/Course/Show/42/CCNP', 96);

    const before = canvas().toDataURL();
    host.text.set('https://www.uuu.com.tw/Course/Show/43/AZ900');
    fixture.detectChanges();
    await new Promise((r) => setTimeout(r, 0));

    expect(render).toHaveBeenCalledTimes(2);
    expect(render.calls.mostRecent().args[1]).toBe('https://www.uuu.com.tw/Course/Show/43/AZ900');
    expect(canvas().toDataURL()).not.toBe(before);
  });

  it('download() saves a PNG image named after the title', async () => {
    await create();
    const click = spyOn(HTMLAnchorElement.prototype, 'click');

    qr().download();

    expect(click).toHaveBeenCalledTimes(1);
    const a = click.calls.mostRecent().object as HTMLAnchorElement;
    expect(a.download).toBe('CCNP.png');
    expect(a.href.startsWith('data:image/png;base64,')).toBeTrue();
    // PNG signature (89 50 4E 47 0D 0A 1A 0A) base64-encodes to "iVBORw0KGgo"
    expect(a.href).toContain('data:image/png;base64,iVBORw0KGgo');
    expect(a.href.length).toBeGreaterThan(200);
  });

  it('download() uses the filename input when given', async () => {
    await create();
    host.filename.set('ccnp-qr');
    fixture.detectChanges();
    const click = spyOn(HTMLAnchorElement.prototype, 'click');

    qr().download();

    expect((click.calls.mostRecent().object as HTMLAnchorElement).download).toBe('ccnp-qr.png');
  });

  it('the download button is disabled until the code is rendered', async () => {
    const renderer = TestBed.inject(QrCodeRenderer);
    let resolve!: () => void;
    spyOn(renderer, 'render').and.returnValue(new Promise<void>((r) => (resolve = r)));
    fixture = TestBed.createComponent(Host);
    fixture.detectChanges();

    expect((el().querySelector('[data-qr-download] button') as HTMLButtonElement).disabled).toBeTrue();
    const click = spyOn(HTMLAnchorElement.prototype, 'click');
    qr().download();
    expect(click).not.toHaveBeenCalled();

    resolve();
    await new Promise((r) => setTimeout(r, 0));
    fixture.detectChanges();
    expect((el().querySelector('[data-qr-download] button') as HTMLButtonElement).disabled).toBeFalse();
  });
});
