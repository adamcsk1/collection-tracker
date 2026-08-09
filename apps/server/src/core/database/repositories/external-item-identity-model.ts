import { ExternalItemIdentitySourceConfidenceModel } from '@shared/models/external-metadata-provider-model';

export interface ExternalIdentityRow {
  username_hash: string;
  canonical_item_id: string;
  external_provider: string;
  external_item_id: string;
  source_confidence: ExternalItemIdentitySourceConfidenceModel;
}

export interface CanonicalItemRank {
  canonicalItemId: string;
  rank: number;
}
