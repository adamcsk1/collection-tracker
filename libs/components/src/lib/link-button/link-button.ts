import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'libc-link-button',
  templateUrl: './link-button.html',
  styleUrl: './link-button.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LinkButton {
  public readonly href = input.required<string>();
  public readonly icon = input.required<string>();
  public readonly label = input.required<string>();
  public readonly variant = input<'action' | 'nav'>('nav');
  public readonly external = input(false);
  public readonly dataTestId = input<string>('');
}
