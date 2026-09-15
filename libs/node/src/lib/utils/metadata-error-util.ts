// Only known diagnostic messages are logged; upstream errors may contain credentials or response bodies.
export const describeMetadataError = (error: unknown): string => {
  if (!(error instanceof Error)) return 'Unknown metadata failure';
  if (
    /^(Invalid API key!|Request limit reached!|Too many results\.|No API key provided\.)$/.test(error.message) ||
    /^(omdb|openlibrary|musicbrainz)( replacement)? (responded with \d{3}|request path is invalid|response is too large|did not return JSON|returned (an invalid envelope|an invalid item|an unsupported content type|invalid genres|invalid ratings|an invalid rating|invalid external IDs|an invalid providerItemId|an invalid external ID|invalid search results|invalid season metadata|duplicate season metadata|invalid episode titles))$/.test(
      error.message
    ) ||
    /^Normalized external metadata response has invalid (poster|providerItemId|externalIds\.id|title|year|plot|actors|genre|ratings\.source|ratings\.value|season title)$/.test(
      error.message
    )
  )
    return error.message;
  if (error.name === 'TimeoutError' || error.name === 'AbortError') return 'Metadata request timed out or was aborted';
  if (error instanceof SyntaxError) return 'Metadata response contains invalid JSON';
  if (error instanceof TypeError && error.message === 'fetch failed') {
    const cause = error.cause;
    const code = cause && typeof cause === 'object' && 'code' in cause ? cause.code : undefined;
    return typeof code === 'string' &&
      /^(ECONNREFUSED|ECONNRESET|ENOTFOUND|EAI_AGAIN|ETIMEDOUT|UND_ERR_CONNECT_TIMEOUT|UND_ERR_SOCKET)$/.test(code)
      ? `Metadata network request failed (${code})`
      : 'Metadata network request failed';
  }
  return 'Unexpected metadata failure';
};
