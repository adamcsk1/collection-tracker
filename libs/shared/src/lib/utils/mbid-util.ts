const MBID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MBID_CANDIDATE_REGEXP = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const BARCODE_PATTERN = /^\d{8,14}$/;

export const normalizeMbid = (value: string): string | null => {
  const mbid = value.trim().toLowerCase();
  return MBID_PATTERN.test(mbid) ? mbid : null;
};

export const extractMbid = (content: string): string | null => {
  const direct = normalizeMbid(content);
  if (direct) return direct;

  for (const match of `${content}`.matchAll(MBID_CANDIDATE_REGEXP)) {
    const normalized = normalizeMbid(match[0] ?? '');
    if (normalized) return normalized;
  }
  return null;
};

export const extractBarcode = (content: string): string | null => {
  const digits = content.trim().replace(/[\s-]/g, '');
  return BARCODE_PATTERN.test(digits) ? digits : null;
};
