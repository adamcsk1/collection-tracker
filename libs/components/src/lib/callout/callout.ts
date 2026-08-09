import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'libc-callout',
  templateUrl: './callout.html',
  styleUrl: './callout.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Callout {
  public readonly icon = input.required<string>();
}
