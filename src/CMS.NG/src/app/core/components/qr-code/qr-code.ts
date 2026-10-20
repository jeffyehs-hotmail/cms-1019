import { Component, ElementRef, effect, inject, input, signal, viewChild } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { QrCodeRenderer } from './qr-code-renderer';

/**
 * QR code for a URL with a caption and a PNG download button.
 * Re-renders whenever `text` changes; the download is named `{filename}.png`.
 */
@Component({
  selector: 'app-qr-code',
  imports: [ButtonModule],
  template: `
    <figure class="qr">
      <canvas #canvas [attr.aria-label]="'QR code: ' + text()" [title]="text()"></canvas>
      <figcaption data-qr-title>{{ title() }}</figcaption>
      <p-button
        label="下載"
        icon="pi pi-download"
        size="small"
        severity="secondary"
        [outlined]="true"
        [disabled]="!ready()"
        (onClick)="download()"
        data-qr-download
      />
    </figure>
  `,
  styles: `
    .qr {
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      gap: 0.35rem;
      margin: 0;
    }
    canvas {
      border: 1px solid #e5e7eb;
      border-radius: 4px;
    }
    figcaption {
      font-weight: 600;
      word-break: break-all;
      text-align: center;
    }
  `,
})
export class QrCode {
  private readonly renderer = inject(QrCodeRenderer);
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  /** Content encoded in the QR code (normally a URL). */
  readonly text = input.required<string>();
  /** Caption under the code. */
  readonly title = input.required<string>();
  /** Download file name without extension; defaults to the title. */
  readonly filename = input<string>();
  readonly size = input(160);

  /** True once the canvas holds a rendered code (enables the download). */
  readonly ready = signal(false);

  constructor() {
    effect(() => {
      const text = this.text();
      const size = this.size();
      const canvas = this.canvas().nativeElement;
      this.ready.set(false);
      this.renderer.render(canvas, text, size).then(() => this.ready.set(true));
    });
  }

  /** PNG data URL of the rendered code. */
  toDataUrl(): string {
    return this.canvas().nativeElement.toDataURL('image/png');
  }

  download(): void {
    if (!this.ready()) return;
    const a = document.createElement('a');
    a.href = this.toDataUrl();
    a.download = `${this.filename() ?? this.title()}.png`;
    a.click();
  }
}
