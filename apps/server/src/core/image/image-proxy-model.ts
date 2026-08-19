export interface ImageCacheMetadata {
  accessedAt: number;
  contentType: string;
  fileName: string;
  size: number;
  sourceUrl: string;
}

export interface ImageCacheEntry {
  imagePath: string;
  metadata: ImageCacheMetadata;
  metadataBytes: number;
  metadataPath: string;
  size: number;
}

export interface ImageCacheState {
  accessFlushTimeout?: ReturnType<typeof setTimeout>;
  bytes: number;
  dirtyAccesses: Set<string>;
  entries: Map<string, ImageCacheEntry>;
  entriesBySourceUrl: Map<string, ImageCacheEntry>;
  fileMutations: Map<string, Promise<void>>;
  mutation: Promise<void>;
}

export interface PublicTarget {
  address: string;
  family: 4 | 6;
}

export interface ImageFetchQueueEntry {
  grant: () => void;
  timeout: ReturnType<typeof setTimeout>;
}

export interface ProxiedImageResponse {
  statusCode: number;
  contentType: string;
  image: Buffer | null;
  location?: string;
}

export type ImageProxyResult =
  | { kind: 'cached' }
  | { kind: 'fetched' }
  | { kind: 'invalid-url' }
  | { kind: 'blocked' }
  | { kind: 'redirect' }
  | { kind: 'upstream-error'; statusCode: number }
  | { kind: 'not-image' }
  | { kind: 'too-large' }
  | { kind: 'busy' };
