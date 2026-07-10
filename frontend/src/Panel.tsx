import {
  checkPluginVersion,
  type InvenTreePluginContext
} from '@inventreedb/ui';
import {
  Alert,
  Button,
  Group,
  Image,
  Loader,
  NumberInput,
  Select,
  Stack,
  Switch,
  Table,
  Text,
  Textarea,
  TextInput,
  Title
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconBarcode,
  IconCheck,
  IconExternalLink,
  IconSearch,
  IconX
} from '@tabler/icons-react';
import { useEffect, useState } from 'react';

interface ComicData {
  title: string;
  ipn_proposed: string;
  series: string;
  issue: string;
  volume: string | null;
  publisher: string;
  pub_code: string;
  cover_date: string;
  store_date: string;
  variant: string;
  description: string;
  metron_url: string;
  metron_id: number | null;
  image_url: string;
  part_link: string;
  category?: number;
  listed_on_whatnot: boolean;
  whatnot_price: string;

  // Price lookup fields from backend
  estimated_price?: number | null;
  price_source?: string;
  price_note?: string;
}

interface Variant {
  metron_id: number;
  variant: string;
  display_name: string;
  image_url: string;
  description: string;
  cover_date: string;
  store_date: string;
  upc: string | null;
  is_scanned_match: boolean;
}

interface LookupResponse {
  success: boolean;
  comic_data: ComicData;
  variants: Variant[];
  scanned_barcode: string;
  message?: string;
}

/* -------------------- Publisher Defaults -------------------- */
const PUBLISHER_CODES: Record<string, string> = {
  'Abstract Studio': 'ABS',
  'Action Lab Comics': 'ALC',
  'Archie Comics': 'ARCH',
  'Bad Idea Studios': 'BAD',
  'Boom! Studios': 'BOOM',
  'Dark Horse Comics': 'DHC',
  'DC Comics': 'DC',
  "Devil's Due Comics": 'DD',
  'IDW Publishing': 'IDW',
  'Image Comics': 'IMG',
  'Indie Comics': 'IND',
  'Iron Age Comics': 'IAC',
  Keenspot: 'KS',
  'Mad Cave Comics': 'MAD',
  'Marvel Comics': 'MAR',
  'Midnight Factory': 'MID',
  'Oni Press': 'ONI',
  'Valiant Entertainment': 'VAL',
  'Vault Comics': 'VAU',
  'Vertigo Comics': 'VER'
};

const PUBLISHER_UPC_PREFIXES: Record<string, string> = {
  '070989': 'DC',
  '071486': 'MAR',
  '59606': 'MAR',
  '60196': 'MAD',
  '60283': 'KS',
  '60554': 'IAC',
  '64985': 'ONI',
  '68267': 'DD',
  '704': 'IMG',
  '709': 'IMG',
  '70985': 'IMG',
  '72513': 'DYN',
  '759606': 'MAR',
  '761568': 'DHC',
  '761941': 'DC',
  '78200': 'MID',
  '78430': 'ALC',
  '827': 'IDW',
  '85001': 'BAD',
  '85005': 'VAU',
  '89317': 'ABS'
};

const PUBLISHER_PART_CATEGORIES: Record<string, number | null> = {
  ABS: 22,
  ALC: 22,
  ARCH: null,
  BAD: 22,
  BOOM: null,
  DC: 3,
  DD: 22,
  DHC: 2,
  DYN: 105,
  IAC: 22,
  IDW: 24,
  IMG: 4,
  IND: 22,
  KS: 110,
  MAD: 108,
  MAR: 5,
  MID: 22,
  ONI: 107,
  VAL: 23,
  VAU: 109,
  VER: 26
};

const PUBLISHER_STOCK_LOCATIONS: Record<string, number | null> = {
  ABS: 82,
  ALC: 82,
  ARCH: null,
  BAD: 82,
  BOOM: null,
  DC: 91,
  DD: 82,
  DHC: 73,
  DYN: 94,
  IAC: 82,
  IDW: 76,
  IMG: 70,
  IND: 82,
  KS: 100,
  MAD: 98,
  MAR: 66,
  MID: 82,
  ONI: 97,
  VAL: 80,
  VAU: 99,
  VER: 84
};

const COMIC_CONDITIONS = [
  { value: 'Near Mint', label: 'Near Mint (NM)' },
  { value: 'Very Fine', label: 'Very Fine (VF)' },
  { value: 'Fine', label: 'Fine (FN)' },
  { value: 'Very Good', label: 'Very Good (VG)' },
  { value: 'Good', label: 'Good (GD)' },
  { value: 'Fair', label: 'Fair (FR)' },
  { value: 'Poor', label: 'Poor (PR)' },
  { value: 'Raw', label: 'Raw (Ungraded)' }
];

/** Truncate text to max length, adding "..." if it was shortened */
const truncateDescription = (text: string, maxLength: number = 250): string => {
  if (!text) return '';

  const trimmed = text.trim();
  if (trimmed.length <= maxLength) return trimmed;

  return `${trimmed.substring(0, maxLength - 3)}...`;
};

let upcTemplatePkCache: number | null = null;

function ComicScannerPanel({ context }: { context: InvenTreePluginContext }) {
  const [manualEntryMode, setManualEntryMode] = useState(false);

  const [barcodeInput, setBarcodeInput] = useState('');
  const [metronIdInput, setMetronIdInput] = useState('');
  const [queryInput, setQueryInput] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lookupResult, setLookupResult] = useState<{
    defaultComic: ComicData;
    variants: Variant[];
    scannedBarcode: string;
  } | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(null);
  const [existingPartPk, setExistingPartPk] = useState<number | null>(null);

  // Editable fields
  const [editedData, setEditedData] = useState<Partial<ComicData>>({});
  const [editedUPC, setEditedUPC] = useState<string>('');

  // WhatNot fields
  const [listedOnWhatnot, setListedOnWhatnot] = useState(false);
  const [whatnotAuctionPrice, setWhatnotAuctionPrice] = useState('');

  // New Condition field
  const [selectedCondition, setSelectedCondition] =
    useState<string>('Near Mint');

  // Selected Part Category
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);

  // Switches
  const [includeTitle, setIncludeTitle] = useState(true);
  const [includeIPN, setIncludeIPN] = useState(true);
  const [includeDescription, setIncludeDescription] = useState(true);
  const [includeImage, setIncludeImage] = useState(true);
  const [includeUPC, setIncludeUPC] = useState(true);

  // Stock
  const [createStock, setCreateStock] = useState(true);
  const [initialQuantity, setInitialQuantity] = useState<number | ''>(1);

  const [createdOrUpdatedPart, setCreatedOrUpdatedPart] = useState<{
    pk: number;
    name: string;
  } | null>(null);

  const cleanBarcode = (input: string): string => {
    return input.replace(/[^0-9]/g, '');
  };

  /** Generate variant-aware IPN */
  const getVariantIpn = (baseIpn: string, variantName: string): string => {
    if (
      !variantName ||
      ['standard', 'none', ''].includes(variantName.toLowerCase())
    ) {
      return baseIpn;
    }
    const suffix = variantName
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 8);
    return `${baseIpn}-${suffix}`;
  };

  const handleLookupClick = async () => {
    const cleanedBarcode = cleanBarcode(barcodeInput.trim());
    const metronId = metronIdInput.trim();
    const searchQuery = queryInput.trim();

    if (!cleanedBarcode && !metronId && !searchQuery) {
      notifications.show({
        title: 'Input required',
        message: 'Enter a UPC barcode, Metron issue ID, or search query',
        color: 'yellow'
      });
      return;
    }

    setLoading(true);
    setError(null);
    setLookupResult(null);
    setSelectedVariant(null);
    setExistingPartPk(null);
    setCreatedOrUpdatedPart(null);
    setEditedData({});
    setEditedUPC('');
    setListedOnWhatnot(false);
    setWhatnotAuctionPrice('');
    setSelectedCondition('Near Mint');
    setSelectedCategory(null);

    try {
      const payload: any = {};

      if (metronId && /^\d+$/.test(metronId)) {
        payload.metron_id = metronId;
      } else if (cleanedBarcode) {
        payload.barcode = cleanedBarcode;
      } else {
        payload.query = searchQuery;
      }

      const response = await context.api.post<LookupResponse>(
        '/plugin/comic_scanner/comic-lookup/',
        payload
      );

      const data = response.data;

      if (!data?.success || !data?.comic_data || !data?.variants) {
        throw new Error(data?.message || 'Invalid response');
      }

      setLookupResult({
        defaultComic: data.comic_data,
        variants: data.variants,
        scannedBarcode: data.scanned_barcode || ''
      });

      const matched = data.variants.find((v: Variant) => v.is_scanned_match);
      const initialVariant = matched || data.variants[0] || null;
      setSelectedVariant(initialVariant);

      const baseIpn = data.comic_data.ipn_proposed;
      const initialIpn = initialVariant
        ? getVariantIpn(baseIpn, initialVariant.variant)
        : baseIpn;

      setEditedData({
        title: initialVariant?.display_name ?? data.comic_data.title,
        description: initialVariant?.description ?? data.comic_data.description,
        image_url: initialVariant?.image_url ?? data.comic_data.image_url,
        cover_date: initialVariant?.cover_date ?? data.comic_data.cover_date,
        store_date: initialVariant?.store_date ?? data.comic_data.store_date,
        ipn_proposed: initialIpn
      });

      setEditedUPC(data.scanned_barcode || '');

      // ====================== PRICE AUTO-FILL ======================
      const comic = data.comic_data;
      const hasEstimatedPrice =
        comic.estimated_price && comic.estimated_price > 0;

      setListedOnWhatnot(hasEstimatedPrice || comic.listed_on_whatnot || false);
      setWhatnotAuctionPrice(
        hasEstimatedPrice
          ? comic.estimated_price!.toFixed(2)
          : comic.whatnot_price || ''
      );

      if (hasEstimatedPrice) {
        notifications.show({
          title: 'Price Auto-filled',
          message: `$${comic.estimated_price!.toFixed(2)} from ${comic.price_source || 'lookup'}`,
          color: 'teal',
          icon: <IconCheck />,
          autoClose: 5000
        });
      }
      // ============================================================

      const defaultCat = data.comic_data.category || 1;
      setSelectedCategory(defaultCat);

      setIncludeTitle(true);
      setIncludeIPN(true);
      setIncludeDescription(true);
      setIncludeImage(true);
      setIncludeUPC(!!data.scanned_barcode);
      setCreateStock(true);
      setInitialQuantity(1);

      // Check if base part already exists
      const partRes = await context.api.get('/api/part/', {
        params: { search: data.comic_data.ipn_proposed }
      });
      const parts = Array.isArray(partRes.data)
        ? partRes.data
        : partRes.data.results || [];
      const exactMatch = parts.find(
        (p: any) => p.IPN?.trim() === data.comic_data.ipn_proposed.trim()
      );
      setExistingPartPk(exactMatch?.pk ?? null);

      notifications.show({
        title: payload.metron_id
          ? 'Metron ID loaded'
          : data.scanned_barcode
            ? 'Found on Metron'
            : 'Search results',
        message: `${data.variants.length} entries available`,
        color: 'green',
        icon: <IconCheck />
      });
    } catch (err: any) {
      setError(err?.message || 'Lookup failed');
      notifications.show({
        title: 'Error',
        message: err?.message || 'Lookup failed',
        color: 'red',
        icon: <IconX />
      });
    } finally {
      setLoading(false);
    }
  };

  const handleManualEntry = () => {
    setError(null);
    setLookupResult(null);
    setSelectedVariant(null);
    setExistingPartPk(null);
    setCreatedOrUpdatedPart(null);

    setManualEntryMode(true);

    const emptyComic: ComicData = {
      title: '',
      ipn_proposed: '',
      series: '',
      issue: '',
      volume: '',
      publisher: '',
      pub_code: '',
      cover_date: '',
      store_date: '',
      variant: '',
      description: '',
      metron_url: '',
      metron_id: null,
      image_url: '',
      part_link: '',
      category: 1,
      listed_on_whatnot: false,
      whatnot_price: '',
      estimated_price: null,
      price_source: '',
      price_note: ''
    };

    const manualVariant: Variant = {
      metron_id: 0,
      variant: 'Manual',
      display_name: '',
      image_url: '',
      description: '',
      cover_date: '',
      store_date: '',
      upc: '',
      is_scanned_match: false
    };

    setLookupResult({
      defaultComic: emptyComic,
      variants: [manualVariant],
      scannedBarcode: ''
    });

    setSelectedVariant(manualVariant);

    setEditedData({
      title: '',
      description: '',
      image_url: '',
      cover_date: '',
      store_date: '',
      ipn_proposed: ''
    });

    setEditedUPC('');
    setSelectedCategory(1);
    setListedOnWhatnot(false);
    setWhatnotAuctionPrice('');

    setIncludeTitle(true);
    setIncludeIPN(true);
    setIncludeDescription(true);
    setIncludeImage(true);
    setIncludeUPC(true);
  };

  useEffect(() => {
    if (manualEntryMode) return;

    if (selectedVariant && lookupResult) {
      const baseIpn = lookupResult.defaultComic.ipn_proposed;
      const variantIpn = getVariantIpn(baseIpn, selectedVariant.variant);

      setEditedData((prev) => ({
        ...prev,
        title: selectedVariant.display_name,
        description: selectedVariant.description,
        image_url: selectedVariant.image_url,
        cover_date: selectedVariant.cover_date,
        store_date: selectedVariant.store_date,
        ipn_proposed: variantIpn
      }));
      if (selectedVariant.upc) {
        setEditedUPC(selectedVariant.upc);
      }
    }
  }, [selectedVariant, lookupResult]);

  const determinePublisherCode = (publisher: string, barcode: string) => {
    if (PUBLISHER_CODES[publisher]) return PUBLISHER_CODES[publisher];
    const sortedPrefixes = Object.keys(PUBLISHER_UPC_PREFIXES).sort(
      (a, b) => b.length - a.length
    );
    for (const prefix of sortedPrefixes) {
      if (barcode.startsWith(prefix)) return PUBLISHER_UPC_PREFIXES[prefix];
    }
    return 'UNK';
  };

  const determineStockLocation = (pubCode: string) =>
    PUBLISHER_STOCK_LOCATIONS[pubCode] || null;

  const determineCategory = (pubCode: string) =>
    PUBLISHER_PART_CATEGORIES[pubCode] || 1;

  const ensureUpcTemplate = async (): Promise<number | null> => {
    if (upcTemplatePkCache !== null) return upcTemplatePkCache;

    try {
      const res = await context.api.get('/api/parameter/template/', {
        params: { search: 'UPC' }
      });

      const templates: any[] = res.data?.results || res.data || [];

      if (templates.length > 0) {
        const template = templates.find(
          (t: any) => t.name?.trim().toUpperCase() === 'UPC'
        );
        if (template?.pk) {
          upcTemplatePkCache = template.pk;
          return upcTemplatePkCache;
        }
      }

      const createRes = await context.api.post('/api/parameter/template/', {
        name: 'UPC',
        description: 'Universal Product Code (barcode)',
        units: '',
        checkbox: false,
        choices: ''
      });

      if (createRes.data?.pk) {
        upcTemplatePkCache = createRes.data.pk;
        return upcTemplatePkCache;
      }

      throw new Error('Could not create UPC template');
    } catch (err: any) {
      console.error('[UPC TEMPLATE] Failed:', err);
      return null;
    }
  };

  const ensureParameter = async (
    partPk: number,
    templateName: string,
    value: any,
    isBoolean: boolean = false,
    templatePk: number
  ) => {
    if (!partPk || !templatePk) return;

    try {
      const dataValue = isBoolean
        ? value === true || value === 'true'
          ? 'true'
          : 'false'
        : String(value || '').trim();

      if (isBoolean && dataValue === 'false') return;
      if (!isBoolean && !dataValue) return;

      const existingRes = await context.api.get('/api/parameter/', {
        params: { model_id: partPk, template: templatePk }
      });

      const existingItems = existingRes.data?.results || existingRes.data || [];
      const hasExisting =
        existingRes.data?.count > 0 || existingItems.length > 0;

      if (hasExisting) {
        const paramId = existingItems[0].pk;
        await context.api.patch(`/api/parameter/${paramId}/`, {
          data: dataValue
        });
      } else {
        await context.api.post('/api/parameter/', {
          model_type: 'part.part',
          model_id: partPk,
          template: templatePk,
          data: dataValue
        });
      }
    } catch (err: any) {
      console.error(
        `Failed to save "${templateName}":`,
        err?.response?.data || err
      );
      notifications.show({
        title: `Could not save ${templateName}`,
        message: err?.message || 'Unknown error',
        color: 'red',
        autoClose: 8000
      });
    }
  };

  const handleSavePart = async (mode: 'update-existing' | 'create-variant') => {
    if (!lookupResult || !selectedVariant) return;

    setLoading(true);
    setError(null);

    const active = {
      ...lookupResult.defaultComic,
      title: includeTitle
        ? (editedData.title ?? selectedVariant.display_name)
        : lookupResult.defaultComic.title,

      description: includeDescription
        ? truncateDescription(
            editedData.description ?? selectedVariant.description
          )
        : '',

      image_url: includeImage
        ? (editedData.image_url ?? selectedVariant.image_url)
        : '',
      variant: selectedVariant.variant,
      metron_id: selectedVariant.metron_id,
      metron_url: `https://metron.cloud/issue/${selectedVariant.metron_id}/`,
      cover_date: editedData.cover_date ?? selectedVariant.cover_date,
      store_date: editedData.store_date ?? selectedVariant.store_date,
      part_link: lookupResult.defaultComic.part_link
    };

    let finalIpn: string;
    let partPk: number | null = null;

    if (mode === 'update-existing') {
      if (!existingPartPk) return;
      partPk = existingPartPk;
      finalIpn = lookupResult.defaultComic.ipn_proposed;
    } else {
      partPk = null;
      finalIpn = includeIPN
        ? (editedData.ipn_proposed ??
          getVariantIpn(
            lookupResult.defaultComic.ipn_proposed,
            selectedVariant.variant
          ))
        : lookupResult.defaultComic.ipn_proposed;
    }

    try {
      const pubCode = determinePublisherCode(
        active.publisher,
        lookupResult.scannedBarcode
      );
      const stockLocation = determineStockLocation(pubCode);
      const finalCategory =
        selectedCategory !== null
          ? selectedCategory
          : determineCategory(pubCode);

      const safeQuantity =
        typeof initialQuantity === 'number' && initialQuantity >= 1
          ? initialQuantity
          : null;

      const stockBatch = includeIPN ? finalIpn : undefined;

      if (!partPk) {
        const payload: Record<string, any> = {
          name: includeTitle ? active.title : `Comic ${finalIpn || 'Unknown'}`,
          units: 'each',
          category: finalCategory,
          active: true,
          stock_location: stockLocation
        };

        if (includeDescription) payload.description = active.description;
        if (includeImage && active.image_url) {
          payload.remote_image = active.image_url;
        }
        if (createStock && safeQuantity !== null) {
          payload.initial_stock = {
            quantity: safeQuantity,
            batch: stockBatch,
            location: stockLocation ?? undefined
          };
        }

        const createRes = await context.api.post('/api/part/', {
          ...payload,
          IPN: includeIPN ? finalIpn : undefined
        });
        partPk = createRes.data.pk;
      } else {
        const patchPayload: Record<string, any> = {};
        if (includeTitle) patchPayload.name = active.title;
        if (includeDescription) patchPayload.description = active.description;
        if (includeIPN) patchPayload.IPN = finalIpn;

        if (includeImage && active.image_url) {
          patchPayload.remote_image = active.image_url;
        }

        if (Object.keys(patchPayload).length > 0) {
          await context.api.patch(`/api/part/${partPk}/`, patchPayload);
        }

        if (createStock && safeQuantity !== null) {
          await context.api.post('/api/stock/', {
            part: partPk,
            quantity: safeQuantity,
            location: stockLocation ?? undefined,
            batch: stockBatch
          });
        }
      }

      // Save UPC
      if (includeUPC && editedUPC.trim() && partPk) {
        const upcTemplatePk = await ensureUpcTemplate();
        if (upcTemplatePk) {
          const trimmedUPC = editedUPC.trim();

          const existingRes = await context.api.get('/api/parameter/', {
            params: { model_id: partPk, template: upcTemplatePk }
          });

          const existingItems =
            existingRes.data?.results || existingRes.data || [];
          const hasExisting =
            existingRes.data?.count > 0 || existingItems.length > 0;

          if (hasExisting) {
            const paramId = existingItems[0].pk;
            await context.api.patch(`/api/parameter/${paramId}/`, {
              data: trimmedUPC
            });
          } else {
            await context.api.post('/api/parameter/', {
              model_type: 'part.part',
              model_id: partPk,
              template: upcTemplatePk,
              data: trimmedUPC
            });
          }
        }
      }

      // Save WhatNot and Condition parameters
      if (partPk) {
        await ensureParameter(
          partPk,
          'Listed on WhatNot',
          listedOnWhatnot,
          true,
          11
        );
        const price = whatnotAuctionPrice.trim();
        if (price) {
          await ensureParameter(
            partPk,
            'WhatNot Auction Price',
            price,
            false,
            21
          );
        }

        await ensureParameter(
          partPk,
          'Condition',
          selectedCondition,
          false,
          16
        );

        setCreatedOrUpdatedPart({
          pk: partPk,
          name: active.title
        });
      }

      notifications.show({
        title:
          mode === 'update-existing' ? 'Part Updated' : 'New Variant Created',
        message: (
          <>
            {active.title}
            {createStock && safeQuantity !== null
              ? ` (+${safeQuantity} stock)`
              : ''}
            <br />
            <a
              href={`/part/${partPk}/`}
              target='_blank'
              rel='noopener noreferrer'
              style={{ color: 'var(--mantine-color-blue-6)' }}
            >
              View part → #{partPk}
            </a>
          </>
        ),
        color: 'green',
        icon: <IconCheck />,
        autoClose: 12000
      });
    } catch (err: any) {
      const apiError = err?.response?.data || err.message;
      setError(
        typeof apiError === 'object'
          ? JSON.stringify(apiError, null, 2)
          : apiError
      );
      notifications.show({
        title: 'Operation Failed',
        message:
          typeof apiError === 'object'
            ? JSON.stringify(apiError, null, 2)
            : apiError,
        color: 'red',
        autoClose: false
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateExisting = () => handleSavePart('update-existing');
  const handleCreateNewVariant = () => handleSavePart('create-variant');

  const activeComic =
    selectedVariant && lookupResult
      ? {
          ...lookupResult.defaultComic,
          title: editedData.title ?? selectedVariant.display_name,
          description: editedData.description ?? selectedVariant.description,
          image_url: editedData.image_url ?? selectedVariant.image_url,
          metron_id: selectedVariant.metron_id,
          metron_url: selectedVariant.metron_id
            ? `https://metron.cloud/issue/${selectedVariant.metron_id}/`
            : '',
          cover_date: editedData.cover_date ?? selectedVariant.cover_date,
          store_date: editedData.store_date ?? selectedVariant.store_date,
          part_link: lookupResult.defaultComic.part_link || ''
        }
      : (lookupResult?.defaultComic ?? null);

  const currentDescription =
    editedData.description ?? activeComic?.description ?? '';
  const hasSourceLink = !!activeComic?.part_link;

  return (
    <Stack p='md'>
      <Title order={3}>Comic Scanner</Title>

      <Stack mt='md' gap='md'>
        <TextInput
          placeholder='Scan or enter UPC barcode...'
          value={barcodeInput}
          onChange={(e) => setBarcodeInput(e.currentTarget.value)}
          leftSection={<IconBarcode />}
        />

        <TextInput
          placeholder='Metron.cloud issue ID (e.g. 12345)'
          value={metronIdInput}
          onChange={(e) => setMetronIdInput(e.currentTarget.value)}
          leftSection={<IconExternalLink size={16} />}
        />

        <TextInput
          placeholder='Search by title, series, issue # (e.g. Batman 123)'
          value={queryInput}
          onChange={(e) => setQueryInput(e.currentTarget.value)}
          leftSection={<IconSearch />}
        />

        <Group grow>
          <Button
            onClick={handleLookupClick}
            loading={loading}
            disabled={
              loading ||
              (!barcodeInput.trim() &&
                !metronIdInput.trim() &&
                !queryInput.trim())
            }
          >
            Lookup
          </Button>

          <Button
            variant='light'
            color='gray'
            onClick={handleManualEntry}
            disabled={loading}
          >
            Manual Entry
          </Button>
        </Group>
      </Stack>

      {loading && <Loader />}
      {error && (
        <Alert color='red' title='Error'>
          {error}
        </Alert>
      )}

      {lookupResult && activeComic && selectedVariant && (
        <>
          <Group grow align='flex-start' mt='xl'>
            {!manualEntryMode && (
              <Stack style={{ flex: 1 }}>
                <Title order={5}>
                  Select Variant ({lookupResult.variants.length})
                </Title>

                {lookupResult.variants.length > 30 && (
                  <Alert color='orange' title='Large number of matches'>
                    Many results – pick the correct cover based on
                    image/description.
                  </Alert>
                )}

                <Table highlightOnHover withTableBorder>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th />
                      <Table.Th>Cover</Table.Th>
                      <Table.Th>Name</Table.Th>
                      <Table.Th>UPC</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {lookupResult.variants.map((v) => (
                      <Table.Tr
                        key={v.metron_id}
                        onClick={() => setSelectedVariant(v)}
                        style={{ cursor: 'pointer' }}
                        bg={
                          selectedVariant.metron_id === v.metron_id
                            ? 'var(--mantine-color-blue-light)'
                            : undefined
                        }
                      >
                        <Table.Td>
                          {selectedVariant.metron_id === v.metron_id && (
                            <IconCheck color='green' />
                          )}
                        </Table.Td>
                        <Table.Td>
                          {v.image_url ? (
                            <Image
                              src={v.image_url}
                              alt={v.variant}
                              width={60}
                              height={90}
                              fit='contain'
                            />
                          ) : (
                            '—'
                          )}
                        </Table.Td>
                        <Table.Td>{v.display_name}</Table.Td>
                        <Table.Td>
                          {v.is_scanned_match ? (
                            <IconCheck
                              color='green'
                              title='Matches scanned barcode'
                            />
                          ) : v.upc ? (
                            'Other'
                          ) : (
                            '—'
                          )}
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Stack>
            )}

            <Stack style={{ flex: 1 }}>
              <Alert
                color='blue'
                title={activeComic.title}
                icon={<IconCheck />}
              >
                <Group justify='space-between' align='center'>
                  <Text>
                    {activeComic.description || 'No description available.'}
                  </Text>

                  {hasSourceLink ? (
                    <Button
                      variant='light'
                      color='blue'
                      component='a'
                      href={activeComic.part_link}
                      target='_blank'
                      rel='noopener noreferrer'
                      leftSection={<IconExternalLink size={16} />}
                      size='xs'
                    >
                      Open on Metron
                    </Button>
                  ) : (
                    <Text size='sm' color='dimmed'>
                      No source link available
                    </Text>
                  )}
                </Group>
              </Alert>

              {activeComic.image_url && (
                <Image
                  src={activeComic.image_url}
                  alt='Selected cover'
                  radius='md'
                  mah={400}
                  fit='contain'
                  mt='md'
                />
              )}

              <Table withTableBorder mt='md'>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Include</Table.Th>
                    <Table.Th>Field</Table.Th>
                    <Table.Th>Value (editable)</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  <Table.Tr>
                    <Table.Td>
                      <Switch
                        checked={includeTitle}
                        onChange={(e) =>
                          setIncludeTitle(e.currentTarget.checked)
                        }
                      />
                    </Table.Td>
                    <Table.Td>Title</Table.Td>
                    <Table.Td>
                      <TextInput
                        value={editedData.title ?? activeComic.title}
                        onChange={(e) =>
                          setEditedData({
                            ...editedData,
                            title: e.currentTarget.value
                          })
                        }
                        disabled={!includeTitle}
                      />
                    </Table.Td>
                  </Table.Tr>

                  <Table.Tr>
                    <Table.Td>
                      <Switch
                        checked={includeIPN}
                        onChange={(e) => setIncludeIPN(e.currentTarget.checked)}
                      />
                    </Table.Td>
                    <Table.Td>IPN</Table.Td>
                    <Table.Td>
                      <TextInput
                        value={
                          editedData.ipn_proposed ??
                          lookupResult.defaultComic.ipn_proposed
                        }
                        onChange={(e) =>
                          setEditedData({
                            ...editedData,
                            ipn_proposed: e.currentTarget.value
                          })
                        }
                        placeholder={lookupResult.defaultComic.ipn_proposed}
                        disabled={!includeIPN}
                      />
                    </Table.Td>
                  </Table.Tr>

                  <Table.Tr>
                    <Table.Td>
                      <Switch
                        checked={includeDescription}
                        onChange={(e) =>
                          setIncludeDescription(e.currentTarget.checked)
                        }
                      />
                    </Table.Td>
                    <Table.Td>Description</Table.Td>
                    <Table.Td>
                      <Stack gap='xs'>
                        <Textarea
                          value={currentDescription}
                          onChange={(e) => {
                            const newValue = e.currentTarget.value;
                            setEditedData({
                              ...editedData,
                              description: newValue
                            });
                          }}
                          autosize
                          minRows={3}
                          maxRows={12}
                          disabled={!includeDescription}
                          styles={{ input: { resize: 'vertical' } }}
                          placeholder='Comic description (will be auto-truncated to 250 chars)'
                        />

                        <Group justify='space-between' align='center'>
                          <Text size='xs' color='dimmed'>
                            {currentDescription.length} / 250 characters
                          </Text>

                          {currentDescription.length > 250 && (
                            <Text size='xs' color='orange' fw={500}>
                              Will be truncated to 250 chars
                            </Text>
                          )}
                        </Group>

                        {/* Optional: Show what the final truncated version will look like */}
                        {currentDescription.length > 247 &&
                          includeDescription && (
                            <Text
                              size='xs'
                              color='dimmed'
                              style={{ fontStyle: 'italic' }}
                            >
                              Saved as:{' '}
                              {truncateDescription(currentDescription)}
                            </Text>
                          )}
                      </Stack>
                    </Table.Td>
                  </Table.Tr>

                  <Table.Tr>
                    <Table.Td>
                      <Switch
                        checked={includeImage}
                        onChange={(e) =>
                          setIncludeImage(e.currentTarget.checked)
                        }
                      />
                    </Table.Td>
                    <Table.Td>Cover Image URL</Table.Td>
                    <Table.Td>
                      <TextInput
                        value={editedData.image_url ?? activeComic.image_url}
                        onChange={(e) =>
                          setEditedData({
                            ...editedData,
                            image_url: e.currentTarget.value
                          })
                        }
                        disabled={!includeImage}
                      />
                    </Table.Td>
                  </Table.Tr>

                  <Table.Tr>
                    <Table.Td>
                      <Switch
                        checked={includeUPC}
                        onChange={(e) => setIncludeUPC(e.currentTarget.checked)}
                      />
                    </Table.Td>
                    <Table.Td>UPC</Table.Td>
                    <Table.Td>
                      <TextInput
                        value={editedUPC}
                        onChange={(e) =>
                          setEditedUPC(e.currentTarget.value.trim())
                        }
                        placeholder={
                          lookupResult.scannedBarcode
                            ? 'Edit scanned UPC'
                            : 'Enter UPC manually'
                        }
                        disabled={!includeUPC}
                        error={
                          includeUPC &&
                          editedUPC &&
                          !/^\d{8,20}$/.test(editedUPC.trim())
                            ? 'UPC should be numeric (8–20 digits)'
                            : null
                        }
                        type='text'
                        inputMode='numeric'
                        pattern='[0-9]*'
                        maxLength={20}
                      />
                    </Table.Td>
                  </Table.Tr>

                  <Table.Tr>
                    <Table.Td>
                      <Switch checked={true} disabled />
                    </Table.Td>
                    <Table.Td>Part Category</Table.Td>
                    <Table.Td>
                      <Select
                        value={selectedCategory?.toString() || ''}
                        onChange={(value) =>
                          setSelectedCategory(value ? parseInt(value) : null)
                        }
                        data={[
                          { value: '1', label: 'Comic Books (Default)' },
                          { value: '2', label: 'Dark Horse Comics' },
                          { value: '3', label: 'DC Comics' },
                          { value: '105', label: 'Dynamite Comics' },
                          { value: '24', label: 'IDW Publishing' },
                          { value: '4', label: 'Image Comics' },
                          { value: '22', label: 'Indie Comics' },
                          { value: '110', label: 'Keenspot' },
                          { value: '108', label: 'Mad Cave Comics' },
                          { value: '5', label: 'Marvel Comics' },
                          { value: '107', label: 'Oni Press' },
                          { value: '23', label: 'Valiant Entertainment' },
                          { value: '109', label: 'Vault Comics' },
                          { value: '26', label: 'Vertigo Comics' }
                        ]}
                        placeholder='Select part category'
                        searchable
                        clearable
                      />
                    </Table.Td>
                  </Table.Tr>
                </Table.Tbody>
              </Table>
            </Stack>
          </Group>

          <Stack mt='xl' gap='xs'>
            <Title order={5}>Stock Adjustment</Title>
            <Switch
              label='Add initial stock (new part) or new stock item (existing part)'
              checked={createStock}
              onChange={(e) => setCreateStock(e.currentTarget.checked)}
            />
            {createStock && (
              <NumberInput
                label='Quantity to add'
                min={1}
                value={initialQuantity}
                onChange={(val) => setInitialQuantity(val as number | '')}
                placeholder='e.g. 12'
                allowDecimal={false}
                allowNegative={false}
              />
            )}
          </Stack>

          <Stack mt='xl' gap='xs'>
            <Title order={5}>Additional Part Parameters</Title>
            <Table withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Field</Table.Th>
                  <Table.Th>Value</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                <Table.Tr>
                  <Table.Td>Listed on WhatNot</Table.Td>
                  <Table.Td>
                    <Switch
                      checked={listedOnWhatnot}
                      onChange={(e) =>
                        setListedOnWhatnot(e.currentTarget.checked)
                      }
                      label='This issue is listed for sale on WhatNot'
                    />
                  </Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td>WhatNot Auction Price</Table.Td>
                  <Table.Td>
                    <TextInput
                      value={whatnotAuctionPrice}
                      onChange={(e) =>
                        setWhatnotAuctionPrice(e.currentTarget.value)
                      }
                      placeholder='e.g. 12.99'
                      leftSection='$'
                      type='number'
                      step='0.01'
                      min={0}
                    />
                  </Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td>Condition</Table.Td>
                  <Table.Td>
                    <Select
                      value={selectedCondition}
                      onChange={(value) =>
                        setSelectedCondition(value || 'Near Mint')
                      }
                      data={COMIC_CONDITIONS}
                      placeholder='Select condition'
                      searchable
                    />
                  </Table.Td>
                </Table.Tr>
              </Table.Tbody>
            </Table>
          </Stack>

          {createdOrUpdatedPart && (
            <Alert
              color='green'
              title={existingPartPk ? 'Updated' : 'Created'}
              icon={<IconCheck />}
              mt='md'
            >
              <Group justify='space-between'>
                <div>
                  <strong>{createdOrUpdatedPart.name}</strong> is ready.
                </div>
                <Button
                  variant='light'
                  component='a'
                  href={`/part/${createdOrUpdatedPart.pk}/`}
                  target='_blank'
                  rightSection={<IconExternalLink size={16} />}
                >
                  Open
                </Button>
              </Group>
            </Alert>
          )}

          <Group mt='xl'>
            {existingPartPk ? (
              <>
                <Button
                  color='blue'
                  onClick={handleUpdateExisting}
                  loading={loading}
                  disabled={loading}
                >
                  Update Existing Part
                </Button>
                <Button
                  color='green'
                  onClick={handleCreateNewVariant}
                  loading={loading}
                  disabled={loading}
                >
                  Create New Variant Part
                </Button>
              </>
            ) : (
              <Button
                color='green'
                onClick={handleCreateNewVariant}
                loading={loading}
                disabled={loading}
              >
                Create Part
              </Button>
            )}

            <Button
              variant='outline'
              onClick={() => {
                setManualEntryMode(false);
                setLookupResult(null);
                setSelectedVariant(null);
                setBarcodeInput('');
                setMetronIdInput('');
                setQueryInput('');
                setExistingPartPk(null);
                setInitialQuantity(1);
                setCreateStock(true);
                setCreatedOrUpdatedPart(null);
                setIncludeTitle(true);
                setIncludeIPN(true);
                setIncludeDescription(true);
                setIncludeImage(true);
                setIncludeUPC(true);
                setEditedData({});
                setEditedUPC('');
                setListedOnWhatnot(false);
                setWhatnotAuctionPrice('');
                setSelectedCondition('Near Mint');
                setSelectedCategory(null);
              }}
            >
              Clear
            </Button>
          </Group>
        </>
      )}
    </Stack>
  );
}

export function renderComicScannerPanel(context: InvenTreePluginContext) {
  checkPluginVersion(context);
  return <ComicScannerPanel context={context} />;
}
