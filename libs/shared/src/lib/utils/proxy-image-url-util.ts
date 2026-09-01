export const getProxyImageUrl = (apiUrl: string, imageUrl: string): string => {
  if (!imageUrl || !apiUrl || !/^https?:\/\//i.test(imageUrl)) return imageUrl;

  const proxyPrefix = `${apiUrl}/images/proxy?url=`;
  if (imageUrl.startsWith(proxyPrefix)) return imageUrl;

  return `${proxyPrefix}${encodeURIComponent(imageUrl)}`;
};
