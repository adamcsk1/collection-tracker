import { isIP } from 'node:net';
import { pathToFileURL } from 'node:url';

export const renderTrustedProxyConfig = (value = '') => {
  const trustedProxies = value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (trustedProxies.length === 0) return '';

  for (const trustedProxy of trustedProxies) {
    const [address, prefix, extra] = trustedProxy.split('/');
    const addressVersion = isIP(address);
    const maximumPrefix = addressVersion === 4 ? 32 : 128;
    const prefixIsValid = prefix === undefined || /^\d+$/.test(prefix);
    const prefixValue = prefixIsValid && prefix !== undefined ? Number(prefix) : undefined;

    if (
      addressVersion === 0 ||
      extra !== undefined ||
      !prefixIsValid ||
      (prefixValue !== undefined && (!Number.isInteger(prefixValue) || prefixValue < 0 || prefixValue > maximumPrefix))
    ) {
      throw new Error(`Invalid trusted proxy IP or CIDR: ${trustedProxy}`);
    }
  }

  return [
    'real_ip_header X-Forwarded-For;',
    'real_ip_recursive on;',
    ...trustedProxies.map((trustedProxy) => `set_real_ip_from ${trustedProxy};`),
  ].join('\n');
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.stdout.write(renderTrustedProxyConfig(process.env.TRUSTED_PROXY_CIDRS));
}
