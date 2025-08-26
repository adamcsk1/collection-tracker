import { animate, AnimationTriggerMetadata, style, transition, trigger } from '@angular/animations';

export const opacityInAnimation: AnimationTriggerMetadata = trigger('opacityInAnimation', [
  transition(':enter', [style({ opacity: 0 }), animate('0.5s ease-out', style({ opacity: 1 }))]),
]);
