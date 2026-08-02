import {
  DEFAULT_CATEGORY_ID,
  DEFAULT_LOCATION_ID,
  PUBLISHER_REGISTRY
} from '../constants/publishers';

/**
 * Resolves a publisher name or barcode into a registered publisher code (e.g. 'MAR', 'DC').
 * Returns 'UNK' if no match is found.
 */
export function determinePublisherCode(
  publisherName: string,
  barcode: string
): string {
  if (publisherName) {
    const cleanName = publisherName.trim().toLowerCase();
    const matchByName = PUBLISHER_REGISTRY.find(
      (p) =>
        p.name.toLowerCase() === cleanName || p.code.toLowerCase() === cleanName
    );
    if (matchByName) return matchByName.code;
  }

  if (barcode) {
    const matchByPrefix = PUBLISHER_REGISTRY.find((p) =>
      p.prefixes.some((prefix) => barcode.startsWith(prefix))
    );
    if (matchByPrefix) return matchByPrefix.code;
  }

  return 'UNK';
}

/**
 * Returns the category ID for a publisher. Accepts either a publisher short code
 * or a raw publisher name / barcode combination.
 */
export function determineCategory(
  pubCodeOrName: string,
  barcode: string = ''
): number {
  if (!pubCodeOrName) return DEFAULT_CATEGORY_ID;

  // Direct lookup by publisher code
  let pub = PUBLISHER_REGISTRY.find(
    (p) => p.code.toUpperCase() === pubCodeOrName.trim().toUpperCase()
  );

  // If not found by direct code, resolve input using determinePublisherCode
  if (!pub) {
    const resolvedCode = determinePublisherCode(pubCodeOrName, barcode);
    pub = PUBLISHER_REGISTRY.find((p) => p.code === resolvedCode);
  }

  return pub?.catId ?? DEFAULT_CATEGORY_ID;
}

/**
 * Returns the default stock location ID for a publisher. Accepts either a publisher short code
 * or a raw publisher name / barcode combination.
 */
export function determineStockLocation(
  pubCodeOrName: string,
  barcode: string = ''
): number | null {
  if (!pubCodeOrName) return DEFAULT_LOCATION_ID;

  // Direct lookup by publisher code
  let pub = PUBLISHER_REGISTRY.find(
    (p) => p.code.toUpperCase() === pubCodeOrName.trim().toUpperCase()
  );

  // If not found by direct code, resolve input using determinePublisherCode
  if (!pub) {
    const resolvedCode = determinePublisherCode(pubCodeOrName, barcode);
    pub = PUBLISHER_REGISTRY.find((p) => p.code === resolvedCode);
  }

  return pub?.locId ?? DEFAULT_LOCATION_ID;
}
