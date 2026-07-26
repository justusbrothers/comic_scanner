export function truncateDescription(
  desc: string,
  maxLen: number = 250
): string {
  if (!desc) return '';
  if (desc.length <= maxLen) return desc;
  return `${desc.substring(0, maxLen).trim()}...`;
}

export function getVariantIpn(baseIpn: string, variantCode: string): string {
  if (!variantCode || variantCode.toLowerCase() === 'a') return baseIpn;
  return `${baseIpn}-${variantCode.toUpperCase()}`;
}
