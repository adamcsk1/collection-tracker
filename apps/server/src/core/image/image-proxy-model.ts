export interface ImageCacheMetadata {
  contentType: string;
  fileName: string;
  sourceUrl: string;
}

export interface PublicTarget {
  address: string;
  family: 4 | 6;
}

export interface ProxiedImageResponse {
  statusCode: number;
  contentType: string;
  image: Buffer | null;
}

export type ImageProxyResult =
  | { kind: 'cached' }
  | { kind: 'fetched' }
  | { kind: 'invalid-url' }
  | { kind: 'blocked' }
  | { kind: 'redirect' }
  | { kind: 'upstream-error'; statusCode: number }
  | { kind: 'not-image' }
  | { kind: 'too-large' };
