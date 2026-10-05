import { Directive, ElementRef, effect, inject, input } from '@angular/core';

/**
 * Animates a number from its previous value to the new one.
 * `[viqCountUp]="value" [format]="fn"` - format turns the running number
 * into display text.
 */
@Directive({ selector: '[viqCountUp]' })
export class CountUp {
  private readonly el = inject(ElementRef<HTMLElement>);

  readonly viqCountUp = input<number | null>(0);
  readonly format = input<(v: number) => string>((v) => Math.round(v).toLocaleString());
  readonly duration = input(1100);

  private current = 0;
  private frame = 0;

  constructor() {
    effect(() => {
      const target = Number(this.viqCountUp() ?? 0);
      const fmt = this.format();
      const from = this.current;
      const start = performance.now();
      const span = this.duration();
      cancelAnimationFrame(this.frame);

      const step = (t: number) => {
        const p = Math.min(1, (t - start) / span);
        const eased = 1 - Math.pow(1 - p, 4);
        this.current = from + (target - from) * eased;
        this.el.nativeElement.textContent = fmt(this.current);
        if (p < 1) this.frame = requestAnimationFrame(step);
        else this.current = target;
      };
      this.frame = requestAnimationFrame(step);
    });
  }
}
