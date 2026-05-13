import { UserShareIncomingApiModel, UserShareOutgoingApiModel } from '@shared/models/api-model';
import { createInjectionToken } from 'ngx-simple-signal-store';

export interface SharesState {
  loaded: boolean;
  userShareCode: string;
  outgoing: UserShareOutgoingApiModel[];
  incoming: UserShareIncomingApiModel[];
}

export const initialSharesState: SharesState = {
  loaded: false,
  userShareCode: '',
  outgoing: [],
  incoming: [],
};

export const sharesStateToken = createInjectionToken<SharesState>('sharesState');
