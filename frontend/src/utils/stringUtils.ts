// comic_scanner/frontend/src/utils/stringUtils.ts

/**
 * Formats variant IPNs into clean codes (e.g. CB_DC_100BULLETSTHEU-002B)
 */
export function getVariantIpn(baseIpn: string, variantRaw: string): string {
  if (!variantRaw) return baseIpn;

  // 1. Sanitize the variant text: remove words like "COVER", "VARIANT", spaces, hyphens
  const cleanVariant = variantRaw
    .toUpperCase()
    .replace(/\b(COVER|VARIANT)\b/gi, '') // Remove keywords like "COVER" or "VARIANT"
    .replace(/[^A-Z0-9]/g, ''); // Remove spaces, dashes, or punctuation

  // 2. If it's Cover 'A' or empty, return base IPN directly
  if (!cleanVariant || cleanVariant === 'A') {
    return baseIpn;
  }

  // 3. Append clean letter/suffix directly to base IPN (no extra dash)
  return `${baseIpn}${cleanVariant}`;
}

/**
 * Truncates text used for comic description
 */
export function truncateDescription(
  desc: string,
  maxLen: number = 250
): string {
  // If no `string`, return `empty string`
  if (!desc) {
    return '';
  }

  // If `string is less than 250`, return `whole string`
  if (desc.length <= maxLen) {
    return desc;
  }

  // Trim string to `maxLen` chars
  return `${desc.substring(0, maxLen).trim()}...`;
}
