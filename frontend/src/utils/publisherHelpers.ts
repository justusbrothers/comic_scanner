import {
  DEFAULT_CATEGORY_ID,
  DEFAULT_LOCATION_ID,
  PUBLISHER_REGISTRY
} from '../constants/publishers';

export function determinePublisherCode(
  publisherName: string,
  barcode: string
): string {
  const matchByName = PUBLISHER_REGISTRY.find(
    (p) => p.name.toLowerCase() === publisherName?.toLowerCase()
  );
  if (matchByName) return matchByName.code;

  if (barcode) {
    const matchByPrefix = PUBLISHER_REGISTRY.find((p) =>
      p.prefixes.some((prefix) => barcode.startsWith(prefix))
    );
    if (matchByPrefix) return matchByPrefix.code;
  }

  return 'UNK';
}

export function determineCategory(pubCode: string): number {
  const pub = PUBLISHER_REGISTRY.find((p) => p.code === pubCode);
  return pub?.catId ?? DEFAULT_CATEGORY_ID;
}

export function determineStockLocation(pubCode: string): number | null {
  const pub = PUBLISHER_REGISTRY.find((p) => p.code === pubCode);
  return pub?.locId ?? DEFAULT_LOCATION_ID;
}
