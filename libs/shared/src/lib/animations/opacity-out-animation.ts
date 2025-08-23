import { animate, AnimationTriggerMetadata, style, transition, trigger } from '@angular/animations';

export const opacityOutAnimation: AnimationTriggerMetadata = trigger('opacityOutAnimation', [
  transition(':leave', [style({ opacity: 1 }), animate('0.5s ease-in', style({ opacity: 0 }))]),
]);
