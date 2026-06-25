import { DestroyRef, Signal, TemplateRef, WritableSignal } from '@angular/core';
import { NgxSimpleSignalStoreService } from 'ngx-simple-signal-store';
import { FloatActionsService } from '../../main/float-actions/float-actions-service';
import { CollectionState } from '../collection-store';

export interface StandardSearchSetupOptions {
  collectionState: NgxSimpleSignalStoreService<CollectionState>;
  searchTextModel: WritableSignal<string>;
  floatActions: FloatActionsService;
  floatSearchTemplate: Signal<TemplateRef<unknown> | undefined>;
  destroyRef: DestroyRef;
  initialSearchText?: string;
}
