import { inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
import { MessageDialog } from '@components/message-dialog/message-dialog';
import { PortalService } from '@services/portal-service';
import { NewItemDialog } from '../new-item-dialog/new-item-dialog';
import { ItemDialog } from './item-dialog';

export const itemDraftGuard: CanDeactivateFn<unknown> = async () => {
  const portal = inject(PortalService);
  const component = portal.componentRef();
  const dialog = component?.instance;
  if (dialog instanceof MessageDialog) return false;
  if (dialog instanceof NewItemDialog && component) {
    const approved = await dialog.canDiscard();
    if (approved) portal.close(component.location.nativeElement);
    return approved;
  }
  return dialog instanceof ItemDialog ? dialog.canDiscard() : true;
};
