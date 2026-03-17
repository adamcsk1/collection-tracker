import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'libc-image-icon',
  templateUrl: './image-icon.html',
  styleUrl: './image-icon.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImageIcon {
  public readonly imageUrl = input.required<string>();
  public readonly ariaLabel = input.required<string>();
}
