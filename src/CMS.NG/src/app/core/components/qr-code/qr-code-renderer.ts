import { Injectable } from '@angular/core';
import { toCanvas } from 'qrcode';

/** Thin wrapper over the `qrcode` library so components can be tested with a spy instead of real rendering. */
@Injectable({ providedIn: 'root' })
export class QrCodeRenderer {
  /** Draws `text` as a QR code onto `canvas` (resizes the canvas to `size` px). */
  async render(canvas: HTMLCanvasElement, text: string, size: number): Promise<void> {
    await toCanvas(canvas, text, { width: size, margin: 1, errorCorrectionLevel: 'M' });
  }
}
