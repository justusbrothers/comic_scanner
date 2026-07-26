export interface ComicData {
  title: string;
  ipn_proposed: string;
  series: string;
  issue: string;
  volume: string | null;
  publisher: string;
  pub_code: string;
  variant: string;
  description: string;
  metron_url: string;
  metron_id: number | null;
  image_url: string;
  part_link: string;
  category?: number;
  store_date: string;
  listed_on_whatnot: boolean;
  whatnot_price: string;
  estimated_price?: number | null;
  price_source?: string;
  price_note?: string;
}

export interface Variant {
  metron_id: number;
  variant: string;
  display_name: string;
  image_url: string;
  description: string;
  upc: string | null;
  is_scanned_match: boolean;
}

export interface LookupResponse {
  success: boolean;
  defaultComic: ComicData;
  variants: Variant[];
  scannedBarcode: string;
  message?: string;
}

export interface PublisherConfig {
  name: string;
  code: string;
  prefixes: string[];
  catId: number;
  locId: number | null;
}

export type SaveMode = 'update-existing' | 'create-variant';
