import { UserShareIncomingApiModel, UserShareOutgoingApiModel } from '@shared/models/api-model';
import { createInjectionToken } from 'ngx-simple-signal-store';

export interface SharesState {
  loaded: boolean;
  mutating: boolean;
  requestId: number;
  userShareCode: string;
  outgoing: UserShareOutgoingApiModel[];
  incoming: UserShareIncomingApiModel[];
}

export const initialSharesState: SharesState = {
  loaded: false,
  mutating: false,
  requestId: 0,
  userShareCode: '',
  outgoing: [],
  incoming: [],
};

export const sharesStateToken = createInjectionToken<SharesState>('sharesState');
