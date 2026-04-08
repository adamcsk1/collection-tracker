import { TagConfigsModel } from './tag-configs-model';
import { createInjectionToken } from 'ngx-simple-signal-store';

export interface TagConfigsState {
  configs: TagConfigsModel;
}

export const initialTagConfigsState: TagConfigsState = {
  configs: [],
};

export const tagConfigsStateToken = createInjectionToken<TagConfigsState>('tagConfigsState');
