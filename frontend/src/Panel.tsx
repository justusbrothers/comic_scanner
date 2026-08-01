import type { InvenTreePluginContext } from '@inventreedb/ui';
import { Alert, Group, Loader, Stack, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconCheck } from '@tabler/icons-react';
import { useEffect, useState } from 'react';

import { ensureParameter } from './api/inventreeApi';
import { ComicEditor } from './components/ComicEditor';
import { ScannerInput } from './components/ScannerInput';
import { VariantSelector } from './components/VariantSelector';
import type { ComicData, LookupResponse, Variant } from './types/comic';
import {
  determineCategory,
  determinePublisherCode,
  determineStockLocation
} from './utils/publisherHelpers';
import { truncateDescription } from './utils/stringUtils';

export function ComicScannerPanel({
  context
}: {
  context: InvenTreePluginContext;
}) {
  const [barcodeInput, setBarcodeInput] = useState('');
  const [metronIdInput, setMetronIdInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [lookupResult, setLookupResult] = useState<LookupResponse | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(null);
  const [editedData, setEditedData] = useState<Partial<ComicData>>({});
  const [editedUPC, setEditedUPC] = useState('');
  const [existingPartPk] = useState<number | null>(null);

  const [createStock, setCreateStock] = useState(true);
  const [initialQuantity, setInitialQuantity] = useState(1);
  const [listedOnWhatnot, setListedOnWhatnot] = useState(true);
  const [whatnotAuctionPrice, setWhatnotAuctionPrice] = useState('');
  const [selectedCondition, setSelectedCondition] = useState('Near Mint');
  const [includeStoreDate, setIncludeStoreDate] = useState<boolean>(true);
  const [storeDate, setStoreDate] = useState<string>('');

  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [stockLocation, setStockLocation] = useState<number | null>(null);

  // Auto-fill logic when active comic or variant changes
  useEffect(() => {
    const active = selectedVariant || lookupResult?.defaultComic;
    if (!active) return;

    const publisher = active.publisher || '';
    const title = active.title || active.display_name || '';

    // Auto-determine Category if not set
    if (!selectedCategory) {
      const categoryId = determineCategory(publisher, title);
      if (categoryId) setSelectedCategory(categoryId);
    }

    // Auto-determine Stock Location if not set
    if (!stockLocation) {
      const locationId = determineStockLocation(publisher);
      if (locationId) setStockLocation(locationId);
    }

    // Auto-generate IPN if not customized
    if (!editedData.ipn_proposed) {
      const pubCode = determinePublisherCode(publisher) || 'CMC';
      const numMatch = String(active.issue_number || '1').match(/\d+/);
      const issueStr = numMatch ? numMatch[0].padStart(3, '0') : '001';
      const variantCode = active.variant
        ? `-${active.variant
            .replace(/[^a-zA-Z0-9]/g, '')
            .slice(0, 2)
            .toUpperCase()}`
        : '';

      const generatedIpn = `${pubCode}-${issueStr}${variantCode}`;

      setEditedData((prev) => ({
        ...prev,
        ipn_proposed: generatedIpn
      }));
    }
  }, [selectedVariant, lookupResult]);

  if (!context) {
    return <Alert color='red'>Plugin context unavailable.</Alert>;
  }

  const handleLookupClick = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await context.api.post(
        '/plugin/comic_scanner/comic-lookup/',
        {
          barcode: barcodeInput,
          metron_id: metronIdInput
        }
      );

      const data = res.data;
      setLookupResult(data);

      if (data.comic_data) {
        setListedOnWhatnot(data.comic_data.listed_on_whatnot ?? true);
        if (data.comic_data.whatnot_price) {
          setWhatnotAuctionPrice(String(data.comic_data.whatnot_price));
        }
      }

      if (data.variants?.length > 0) {
        const match =
          data.variants.find((v: Variant) => v.is_scanned_match) ||
          data.variants[0];

        setSelectedVariant(match);
        setEditedUPC(match.upc || barcodeInput);
        // Pre-fill image_url from the selected variant/lookup
        setEditedData((prev) => ({
          ...prev,
          image_url: match.image_url || ''
        }));
      }
    } catch (_err: unknown) {
      // ... error handling
    } finally {
      setLoading(false);
    }
  };

  const handleManualEntry = () => {
    setError(null);

    const manualComic: ComicData = {
      title: 'New Comic',
      publisher: '',
      issue_number: '1',
      description: '',
      image_url: '',
      display_name: 'New Comic #1'
    };

    const manualVariant: Variant = {
      ...manualComic,
      variant: 'Cover A',
      upc: barcodeInput.trim(),
      is_scanned_match: true
    };

    setLookupResult({
      status: 'success',
      defaultComic: manualComic,
      variants: [manualVariant]
    });

    setSelectedVariant(manualVariant);

    // Initialize editedData with blank/default fields including image_url
    setEditedData({
      title: '',
      description: '',
      ipn_proposed: '',
      image_url: '' // Allows user to paste custom Image URL
    });
    setEditedUPC(barcodeInput.trim());

    setListedOnWhatnot(true);
    setWhatnotAuctionPrice('');
    setSelectedCategory(null);
    setStockLocation(null);
  };

  const handleSavePart = async (mode: 'update-existing' | 'create-variant') => {
    setLoading(true);
    setError(null);

    try {
      const active = selectedVariant || lookupResult?.defaultComic;
      if (!active) throw new Error('No active comic selected.');

      // --- 1. Compute IPN & Image ---
      const proposedIpn =
        editedData.ipn_proposed ??
        lookupResult?.defaultComic?.ipn_proposed ??
        '';
      const finalIpn = proposedIpn.trim() || undefined;
      const finalImageUrl = editedData.image_url ?? active.image_url;

      let partPk = existingPartPk;

      // --- 2. Create or Update Part Payload ---
      if (mode === 'create-variant' || !partPk) {
        const payload: Record<string, any> = {
          name: editedData.title ?? active.title,
          description: truncateDescription(
            editedData.description || active.description || ''
          ),
          category:
            selectedCategory ??
            determineCategory(active.publisher, active.title) ??
            1
        };

        if (finalIpn) payload.IPN = finalIpn;
        if (finalImageUrl) payload.remote_image = finalImageUrl;

        if (createStock && initialQuantity !== null) {
          payload.initial_stock = {
            quantity: initialQuantity,
            location:
              stockLocation ??
              determineStockLocation(active.publisher) ??
              undefined
          };
        }

        const createRes = await context.api.post('/api/part/', payload);
        partPk = createRes.data.pk;
      } else {
        // PATCH Existing Part
        const patchPayload: Record<string, any> = {};
        if (editedData.title) patchPayload.name = editedData.title;
        if (editedData.description)
          patchPayload.description = truncateDescription(
            editedData.description
          );
        if (finalIpn) patchPayload.IPN = finalIpn;
        if (finalImageUrl) patchPayload.remote_image = finalImageUrl;

        if (Object.keys(patchPayload).length > 0) {
          await context.api.patch(`/api/part/${partPk}/`, patchPayload);
        }

        // Add standalone stock if requested on an existing part
        if (createStock && initialQuantity !== null) {
          await context.api.post('/api/stock/', {
            part: partPk,
            quantity: initialQuantity,
            location:
              stockLocation ??
              determineStockLocation(active.publisher) ??
              undefined
          });
        }
      }

      if (!partPk) throw new Error('Failed to resolve Part Primary Key.');

      // --- 3. Parameters Updates ---

      // Save "Listed on WhatNot" Parameter
      await ensureParameter(
        partPk,
        'Listed on WhatNot',
        listedOnWhatnot,
        true,
        11
      );

      // Save "WhatNot Auction Price"
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

      // Save "Condition"
      if (selectedCondition) {
        await ensureParameter(
          partPk,
          'Condition',
          selectedCondition,
          false,
          16
        );
      }

      // Save "Store Date" (Only if toggle enabled and value present)
      if (includeStoreDate && storeDate) {
        await ensureParameter(partPk, 'In Stock Date', storeDate, false, 68);
      }

      notifications.show({
        title:
          mode === 'update-existing' ? 'Part Updated' : 'New Variant Created',
        message: `${active.title} saved successfully.`,
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

  return (
    <Stack p='md'>
      <Title order={3}>Comic Scanner</Title>
      <ScannerInput
        barcodeInput={barcodeInput}
        metronIdInput={metronIdInput}
        loading={loading}
        onBarcodeChange={setBarcodeInput}
        onMetronIdChange={setMetronIdInput}
        onLookup={handleLookupClick}
        onManualEntry={handleManualEntry}
      />

      {loading && <Loader />}
      {error && (
        <Alert color='red' title='Error'>
          {error}
        </Alert>
      )}

      {lookupResult && selectedVariant && (
        <Group grow align='flex-start' mt='xl'>
          <VariantSelector
            variants={lookupResult.variants}
            selectedVariant={selectedVariant}
            onSelectVariant={setSelectedVariant}
          />
          <ComicEditor
            selectedVariant={selectedVariant}
            editedData={editedData}
            editedUPC={editedUPC}
            createStock={createStock}
            initialQuantity={initialQuantity}
            listedOnWhatnot={listedOnWhatnot}
            whatnotPrice={whatnotAuctionPrice}
            selectedCondition={selectedCondition}
            includeStoreDate={includeStoreDate}
            storeDate={storeDate}
            loading={loading}
            existingPartPk={existingPartPk}
            onEditChange={(f, v) =>
              setEditedData((prev) => ({ ...prev, [f]: v }))
            }
            onUpcChange={setEditedUPC}
            onCreateStockChange={setCreateStock}
            onQuantityChange={setInitialQuantity}
            onWhatnotChange={setListedOnWhatnot}
            onWhatnotPriceChange={setWhatnotAuctionPrice}
            onConditionChange={setSelectedCondition}
            onIncludeStoreDateChange={setIncludeStoreDate}
            onStoreDateChange={setStoreDate}
            onUpdateExisting={() => handleSavePart('update-existing')}
            onCreateNewVariant={() => handleSavePart('create-variant')}
          />
        </Group>
      )}
    </Stack>
  );
}

export function Panel(context: InvenTreePluginContext) {
  return <ComicScannerPanel context={context} />;
}

export default Panel;
