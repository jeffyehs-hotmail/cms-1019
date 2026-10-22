import { Component, ElementRef, effect, inject, input, signal, viewChild } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { QrCodeRenderer } from './qr-code-renderer';

/** `screen`: bordered code with caption and 下載. `print`: bare code drawn at 3× for sharp printing (eng re-run D22). */
export type QrCodeVariant = 'screen' | 'print';

/** Canvas pixel density of the print variant; CSS size stays `size`. */
const PRINT_SCALE = 3;

function setCssSize(canvas: HTMLCanvasElement, size: number): void {
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;
}

/**
 * QR code for a URL. The `screen` variant adds a caption and a PNG download button named `{filename}.png`;
 * the `print` variant is the bare code. Re-renders whenever `text`, `size` or `variant` changes.
 */
@Component({
  selector: 'app-qr-code',
  imports: [ButtonModule],
  template: `
    <figure class="qr" [class.print]="variant() === 'print'">
      <canvas
        #canvas
        [class.pending]="!ready()"
        [attr.aria-label]="'QR code: ' + text()"
        [title]="text()"
      ></canvas>
      @if (variant() === 'screen') {
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
      }
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
    .print canvas {
      border: 0;
      border-radius: 0;
    }
    /* A printout taken before the draw finishes shows no half-drawn square (DX CAP4). */
    .print canvas.pending {
      visibility: hidden;
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
  private renderRun = 0;

  /** Content encoded in the QR code (normally a URL). */
  readonly text = input.required<string>();
  /** Caption under the code (screen variant only). */
  readonly title = input.required<string>();
  /** Download file name without extension; defaults to the title. */
  readonly filename = input<string>();
  /** CSS size in px. */
  readonly size = input(160);
  readonly variant = input<QrCodeVariant>('screen');

  /** True once the canvas holds a rendered code (enables the download). */
  readonly ready = signal(false);
  /** True when the last render rejected; reset with `ready` on every re-render. */
  readonly failed = signal(false);

  constructor() {
    effect(() => {
      const text = this.text();
      const size = this.size();
      const print = this.variant() === 'print';
      const canvas = this.canvas().nativeElement;
      const run = ++this.renderRun;
      this.ready.set(false);
      this.failed.set(false);
      const drawn = this.renderer.render(canvas, text, print ? size * PRINT_SCALE : size);
      // Hold the print canvas at `size` right away: an undrawn canvas is 300×150, and node-qrcode writes the
      // pixel size inline synchronously; a print taken before the .then below must not see either.
      if (print) setCssSize(canvas, size);
      drawn
        .then(() => {
          if (run !== this.renderRun) return;
          // node-qrcode writes an inline width/height equal to the pixel size; shrink it back to `size`.
          if (print) setCssSize(canvas, size);
          this.ready.set(true);
        })
        .catch((err: unknown) => {
          if (run !== this.renderRun) return;
          console.error('[QrCode] render failed', { text, err });
          this.failed.set(true);
        });
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
