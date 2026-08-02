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
    console.group('🔍 [ComicScanner] handleLookupClick Triggered');
    console.log('📥 Inputs:', { barcodeInput, metronIdInput });

    setLoading(true);
    setError(null);

    // Optional: Reset previously edited data/IPN so the auto-generation useEffect fires fresh
    setEditedData({});

    try {
      let data = null;

      if (barcodeInput || metronIdInput) {
        console.log('🚀 Sending API Request to lookup endpoint...');

        try {
          const res = await context.api.post(
            '/plugin/comic_scanner/comic-lookup/',
            {
              barcode: barcodeInput,
              metron_id: metronIdInput
            }
          );

          data = res.data;
          console.log('📦 Raw API Response:', data);
        } catch (err) {
          console.error('Lookup failed:', err);
          return;
        }
      } else {
        console.log('ℹ️ Manual entry detected: skipping external lookup.');
      }

      if (!data) return;

      setLookupResult(data);

      if (data.comic_data) {
        console.log('📚 comic_data found:', data.comic_data);
        setListedOnWhatnot(data.comic_data.listed_on_whatnot ?? true);
        if (data.comic_data.whatnot_price) {
          setWhatnotAuctionPrice(String(data.comic_data.whatnot_price));
        }
      } else {
        console.log('ℹ️ No comic_data property in response');
      }

      if (data.variants && data.variants.length > 0) {
        console.log(`🎨 ${data.variants.length} variant(s) received`);

        const match =
          data.variants.find((v: Variant) => v.is_scanned_match) ||
          data.variants[0];

        console.log('✅ Selected Variant:', {
          title: match.title,
          publisher: match.publisher,
          issue_number: match.issue_number,
          variant: match.variant,
          is_scanned_match: match.is_scanned_match
        });

        setSelectedVariant(match);
        setEditedUPC(match.upc || barcodeInput);

        // Pre-fill image_url from the selected variant/lookup
        setEditedData((prev) => {
          console.log(
            '📸 Updating editedData.image_url:',
            match.image_url || ''
          );
          return {
            ...prev,
            image_url: match.image_url || ''
          };
        });
      } else {
        console.warn('⚠️ No variants returned in lookup payload.');
      }

      // Check defaultComic if available
      if (data.defaultComic) {
        console.log('📄 defaultComic details:', {
          title: data.defaultComic.title,
          publisher: data.defaultComic.publisher,
          issue_number: data.defaultComic.issue_number,
          ipn_proposed: data.defaultComic.ipn_proposed
        });
      }
    } catch (err: unknown) {
      console.error('❌ Error during lookup:', err);
      // Optional error logging
    } finally {
      setLoading(false);
      console.groupEnd();
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
    console.group(`💾 [ComicScanner] handleSavePart Triggered (mode: ${mode})`);
    setLoading(true);
    setError(null);

    try {
      const active = selectedVariant || lookupResult?.defaultComic;
      console.log('👉 Active item state:', active);

      if (!active) throw new Error('No active comic selected.');

      // --- 1. Compute IPN & Image ---
      console.group('🏷️ [Step 1] IPN & Image Resolution');
      console.log('Raw values check:', {
        'editedData.ipn_proposed': editedData.ipn_proposed,
        'defaultComic.ipn_proposed': lookupResult?.defaultComic?.ipn_proposed,
        'editedData.image_url': editedData.image_url,
        'active.image_url': active.image_url
      });

      const proposedIpn =
        editedData.ipn_proposed ??
        lookupResult?.defaultComic?.ipn_proposed ??
        '';

      const finalIpn = proposedIpn.trim() || undefined;
      const finalImageUrl = editedData.image_url ?? active.image_url;

      console.log('Resolved values:', {
        proposedIpn,
        finalIpn,
        finalImageUrl
      });
      console.groupEnd();

      let partPk = existingPartPk;
      console.log('Initial existingPartPk:', partPk);

      // --- 2. Create or Update Part Payload ---
      console.group('📦 [Step 2] Part Creation / Patching');

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

        // ✅ FIX: Use lowercase `ipn` (or both `IPN` and `ipn` for API compatibility)
        if (finalIpn) {
          payload.ipn = finalIpn;
          payload.IPN = finalIpn;
        }

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

        console.log('🚀 POST /api/part/ Payload:', payload);
        const createRes = await context.api.post('/api/part/', payload);
        console.log('✅ POST /api/part/ Response:', createRes.data);
        partPk = createRes.data.pk;
      } else {
        console.log(`PATCHING Existing Part (PK: ${partPk})...`);
        const patchPayload: Record<string, any> = {};
        if (editedData.title) patchPayload.name = editedData.title;
        if (editedData.description)
          patchPayload.description = truncateDescription(
            editedData.description
          );

        // ✅ FIX: Use lowercase `ipn` for PATCH requests
        if (finalIpn) {
          patchPayload.ipn = finalIpn;
          patchPayload.IPN = finalIpn;
        }

        if (finalImageUrl) patchPayload.remote_image = finalImageUrl;

        console.log('🛠️ PATCH Payload:', patchPayload);

        if (Object.keys(patchPayload).length > 0) {
          const patchRes = await context.api.patch(
            `/api/part/${partPk}/`,
            patchPayload
          );
          console.log('✅ PATCH Response:', patchRes.data);
        } else {
          console.warn('⚠️ PATCH payload was empty! No fields were updated.');
        }

        // Add standalone stock if requested on an existing part
        if (createStock && initialQuantity !== null) {
          const stockPayload = {
            part: partPk,
            quantity: initialQuantity,
            location:
              stockLocation ??
              determineStockLocation(active.publisher) ??
              undefined
          };
          console.log('📦 Creating standalone stock payload:', stockPayload);
          const stockRes = await context.api.post('/api/stock/', stockPayload);
          console.log('✅ Stock POST Response:', stockRes.data);
        }
      }
      console.groupEnd();

      if (!partPk) throw new Error('Failed to resolve Part Primary Key.');

      // --- 3. Parameters Updates ---
      console.group('🔧 [Step 3] Parameter Updates');

      console.log('Saving "Listed on WhatNot"...');
      await ensureParameter(
        context,
        partPk,
        'Listed on WhatNot',
        listedOnWhatnot,
        true
      );

      const price = whatnotAuctionPrice.trim();
      if (price) {
        console.log('Saving "WhatNot Auction Price":', price);
        await ensureParameter(
          context,
          partPk,
          'WhatNot Auction Price',
          price,
          false,
          21
        );
      }

      if (selectedCondition) {
        console.log('Saving "Condition":', selectedCondition);
        await ensureParameter(
          context,
          partPk,
          'Condition',
          selectedCondition,
          false,
          16
        );
      }

      if (includeStoreDate && storeDate) {
        console.log('Saving "In Stock Date":', storeDate);
        await ensureParameter(
          context,
          partPk,
          'In Stock Date',
          storeDate,
          false,
          68
        );
      }

      // sequentialPromises.push(ensureParameter(partData.pk, 'upc', payload.active_upc, false, 64, csrfToken));
      if (editedUPC) {
        console.log('Saving "UPC":', editedUPC);
        await ensureParameter(context, partPk, 'upc', editedUPC, false, 64);
      }
      console.groupEnd();

      notifications.show({
        title:
          mode === 'update-existing' ? 'Part Updated' : 'New Variant Created',
        message: `${active.title} saved successfully.`,
        color: 'green',
        icon: <IconCheck />,
        autoClose: 12000
      });
    } catch (err: any) {
      console.group('❌ [Error Handler]');
      console.error('Save failed error object:', err);
      const apiError = err?.response?.data || err.message;
      console.error('Extracted API Error details:', apiError);
      console.groupEnd();

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
      console.groupEnd();
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

// export const Panel = ComicScannerPanel;
// export default ComicScannerPanel;
