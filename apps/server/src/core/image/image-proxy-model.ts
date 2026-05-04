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
