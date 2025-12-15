export const serializeParserRegexp = (regexp: RegExp): string => `/${regexp.source}/${regexp.flags}`;

export const restoreSerializedParserRegexp = (value: string): RegExp => {
  const matches = value.match(/^\/(.+)\/([a-z]*)$/i);
  return matches ? new RegExp(matches[1], matches[2]) : new RegExp(value);
};
