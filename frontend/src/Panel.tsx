import type { InvenTreePluginContext } from '@inventreedb/ui';
import { Alert, Group, Loader, Stack, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconCheck } from '@tabler/icons-react';
import { useState } from 'react';
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
import { getVariantIpn, truncateDescription } from './utils/stringUtils';

export function Panel({ context }: { context: InvenTreePluginContext }) {
  const [barcodeInput, setBarcodeInput] = useState('');
  const [metronIdInput, setMetronIdInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [lookupResult, setLookupResult] = useState<LookupResponse | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(null);
  const [editedData, setEditedData] = useState<Partial<ComicData>>({});
  const [editedUPC, setEditedUPC] = useState('');
  const [existingPartPk, _setExistingPartPk] = useState<number | null>(null);

  const [createStock, setCreateStock] = useState(true);
  const [initialQuantity, setInitialQuantity] = useState(1);
  const [listedOnWhatnot, setListedOnWhatnot] = useState(false);
  const [whatnotAuctionPrice, setWhatnotAuctionPrice] = useState('');
  const [selectedCondition, setSelectedCondition] = useState('Near Mint');

  const handleLookupClick = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await context.api.get('/api/plugin/comic-scanner/lookup/', {
        params: { barcode: barcodeInput, metron_id: metronIdInput }
      });
      setLookupResult(res.data);
      if (res.data.variants?.length > 0) {
        const match =
          res.data.variants.find((v: Variant) => v.is_scanned_match) ||
          res.data.variants[0];
        setSelectedVariant(match);
        setEditedUPC(match.upc || barcodeInput);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Lookup failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSavePart = async (mode: 'update-existing' | 'create-variant') => {
    if (!lookupResult || !selectedVariant) return;

    setLoading(true);
    setError(null);

    const active = {
      ...lookupResult.defaultComic,
      title: editedData.title ?? selectedVariant.display_name,
      description: truncateDescription(
        editedData.description ?? selectedVariant.description
      ),
      image_url: editedData.image_url ?? selectedVariant.image_url,
      variant: selectedVariant.variant,
      metron_id: selectedVariant.metron_id
    };

    let partPk: number | null =
      mode === 'update-existing' ? existingPartPk : null;
    const finalIpn = getVariantIpn(
      lookupResult.defaultComic.ipn_proposed,
      selectedVariant.variant
    );

    try {
      const pubCode = determinePublisherCode(
        active.publisher,
        lookupResult.scannedBarcode
      );
      const stockLocation = determineStockLocation(pubCode);
      const finalCategory = determineCategory(pubCode);

      if (!partPk) {
        const createRes = await context.api.post('/api/part/', {
          name: active.title,
          IPN: finalIpn,
          description: active.description,
          units: 'each',
          category: finalCategory,
          active: true,
          stock_location: stockLocation,
          remote_image: active.image_url || undefined
        });
        partPk = createRes.data.pk;
      }

      if (partPk) {
        await ensureParameter(context, partPk, 'Condition', selectedCondition);
        await ensureParameter(
          context,
          partPk,
          'Listed on WhatNot',
          listedOnWhatnot,
          true
        );
        if (whatnotAuctionPrice) {
          await ensureParameter(
            context,
            partPk,
            'WhatNot Auction Price',
            whatnotAuctionPrice
          );
        }
      }

      notifications.show({
        title: mode === 'update-existing' ? 'Part Updated' : 'Variant Created',
        message: `${active.title} saved successfully.`,
        color: 'green',
        icon: <IconCheck />
      });
    } catch (err: any) {
      const apiErr = err?.response?.data || err.message;
      setError(typeof apiErr === 'object' ? JSON.stringify(apiErr) : apiErr);
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
        onManualEntry={() => {}}
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
            onUpdateExisting={() => handleSavePart('update-existing')}
            onCreateNewVariant={() => handleSavePart('create-variant')}
          />
        </Group>
      )}
    </Stack>
  );
}
