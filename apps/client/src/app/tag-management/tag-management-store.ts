import { TagManagementModel } from '../settings/tag-management/tag-management-model';
import { createInjectionToken } from 'ngx-simple-signal-store';

export interface TagManagementState {
  configs: TagManagementModel;
}

export const initialTagManagementState: TagManagementState = {
  configs: [],
};

export const tagManagementStateToken = createInjectionToken<TagManagementState>('tagManagementState');
