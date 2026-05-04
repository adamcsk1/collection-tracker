export const getProxyImageUrl = (apiUrl: string, imageUrl: string): string => {
  if (!imageUrl || !apiUrl || !/^https?:\/\//i.test(imageUrl)) return imageUrl;

  const proxyPrefix = `${apiUrl}/proxy/image?url=`;
  if (imageUrl.startsWith(proxyPrefix)) return imageUrl;

  return `${proxyPrefix}${encodeURIComponent(imageUrl)}`;
};
