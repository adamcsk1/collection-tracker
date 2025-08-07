import { animate, AnimationTriggerMetadata, style, transition, trigger } from '@angular/animations';

export const scaleAnimation: AnimationTriggerMetadata = trigger('scaleAnimation', [
  transition(':enter', [
    style({ transform: 'scale(0)', opacity: 0 }),
    animate('0.2s', style({ transform: 'scale(100%)', opacity: 1 })),
  ]),
  transition(':leave', [
    style({ transform: 'scale(100%)', opacity: 1 }),
    animate('0.2s', style({ transform: 'scale(0)', opacity: 0 })),
  ]),
]);
