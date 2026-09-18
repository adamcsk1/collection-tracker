export const PROXY_IMAGE_VARIANTS = ['card', 'background'] as const;
export type ProxyImageVariant = (typeof PROXY_IMAGE_VARIANTS)[number];

export const isProxyImageVariant = (value: unknown): value is ProxyImageVariant =>
  value === 'card' || value === 'background';

export const getProxyImageUrl = (apiUrl: string, imageUrl: string, variant?: ProxyImageVariant): string => {
  if (!imageUrl || !apiUrl || !/^https?:\/\//i.test(imageUrl)) return imageUrl;

  const proxyPrefix = `${apiUrl}/images/proxy?url=`;
  const withVariant = (proxiedUrl: string): string => {
    const stripped = proxiedUrl.replace(/&variant=[^&]*/g, '');
    return variant ? `${stripped}&variant=${variant}` : stripped;
  };

  if (imageUrl.startsWith(proxyPrefix)) return withVariant(imageUrl);

  return withVariant(`${proxyPrefix}${encodeURIComponent(imageUrl)}`);
};
