import {
  Button,
  Group,
  Image,
  NumberInput,
  Select,
  Stack,
  Switch,
  Textarea,
  TextInput,
  Title
} from '@mantine/core';
import type { ComicData, Variant } from '../types/comic';

interface ComicEditorProps {
  selectedVariant: Variant;
  editedData: Partial<ComicData>;
  editedUPC: string;
  createStock: boolean;
  initialQuantity: number;
  listedOnWhatnot: boolean;
  whatnotPrice: string;
  selectedCondition: string;
  includeStoreDate: boolean;
  storeDate: string;
  loading: boolean;
  existingPartPk: number | null;
  onEditChange: <K extends keyof ComicData>(
    field: K,
    val: ComicData[K]
  ) => void;
  onUpcChange: (val: string) => void;
  onCreateStockChange: (val: boolean) => void;
  onQuantityChange: (val: number) => void;
  onWhatnotChange: (val: boolean) => void;
  onWhatnotPriceChange: (val: string) => void;
  onConditionChange: (val: string) => void;
  onIncludeStoreDateChange: (val: boolean) => void;
  onStoreDateChange: (val: string) => void;
  onUpdateExisting: () => void;
  onCreateNewVariant: () => void;
}

export function ComicEditor({
  selectedVariant,
  editedData,
  editedUPC,
  createStock,
  initialQuantity,
  listedOnWhatnot,
  whatnotPrice,
  selectedCondition,
  includeStoreDate,
  storeDate,
  loading,
  existingPartPk,
  onEditChange,
  onUpcChange,
  onCreateStockChange,
  onQuantityChange,
  onWhatnotChange,
  onWhatnotPriceChange,
  onConditionChange,
  onIncludeStoreDateChange,
  onStoreDateChange,
  onUpdateExisting,
  onCreateNewVariant
}: ComicEditorProps) {
  const displayImageUrl =
    editedData.image_url !== undefined && editedData.image_url !== ''
      ? editedData.image_url
      : selectedVariant?.image_url;

  const truncateText = (text: string, maxLength = 250): string => {
    if (!text || text.length <= maxLength) return text ?? '';
    return·`${text.slice(0, maxLength)}...`;
  };

  return (
    <Stack style={{ flex: 1 }} gap='md'>
      <Title order={5}>Comic Details</Title>

      {displayImageUrl && <Image src={displayImageUrl} h={200} fit='contain' />}

      <TextInput
        label='Title / Name'
        value={editedData.title ?? selectedVariant?.display_name ?? ''}
        onChange={(e) => onEditChange('title', e.currentTarget.value)}
      />

      <TextInput
        label='Internal Part Number (IPN)'
        placeholder='e.g. CB_BAD_REALLIGATOR-001B'
        value={editedData.ipn_proposed ?? ''}
        onChange={(e) => onEditChange('ipn_proposed', e.currentTarget.value)}
      />

      <TextInput
        label='UPC Barcode'
        value={editedUPC ?? ''}
        onChange={(e) => onUpcChange(e.currentTarget.value)}
      />

      <Textarea
        label='Description'
        rows={4}
        maxLength={250}
        value={
          editedData.description !== undefined
            ? editedData.description
            : truncateText(selectedVariant?.description ?? '', 250)
        }
        onChange={(e) => onEditChange('description', e.currentTarget.value)}
      />

      <TextInput
        label='Image URL'
        placeholder='https://example.com/cover.jpg'
        value={editedData.image_url ?? selectedVariant?.image_url ?? ''}
        onChange={(e) => onEditChange('image_url', e.currentTarget.value)}
      />

      <Switch
        label='Add Initial Stock'
        checked={createStock}
        onChange={(e) => onCreateStockChange(e.currentTarget.checked)}
      />

      {createStock && (
        <NumberInput
          label='Quantity'
          value={initialQuantity}
          onChange={(val) =>
            onQuantityChange(typeof val === 'number' ? val : 1)
          }
          min={1}
        />
      )}

      <Switch
        label='Listed on WhatNot'
        checked={listedOnWhatnot}
        onChange={(e) => onWhatnotChange(e.currentTarget.checked)}
      />

      {listedOnWhatnot && (
        <TextInput
          label='WhatNot Auction Price'
          value={whatnotPrice ?? ''}
          onChange={(e) => onWhatnotPriceChange(e.currentTarget.value)}
        />
      )}

      <Select
        label='Condition'
        data={[
          'Near Mint',
          'Very Fine',
          'Fine',
          'Very Good',
          'Good',
          'Fair',
          'Poor'
        ]}
        value={selectedCondition}
        onChange={(val) => onConditionChange(val || 'Near Mint')}
      />

      <Switch
        label='Include In-Stock Date'
        checked={includeStoreDate}
        onChange={(e) => onIncludeStoreDateChange(e.currentTarget.checked)}
      />

      {includeStoreDate && (
        <TextInput
          label='In-Stock Date'
          type='date'
          value={storeDate ?? ''}
          onChange={(e) => onStoreDateChange(e.currentTarget.value)}
        />
      )}

      <Group grow mt='md'>
        {existingPartPk && (
          <Button color='orange' loading={loading} onClick={onUpdateExisting}>
            Update Existing Part (#{existingPartPk})
          </Button>
        )}

        <Button color='green' loading={loading} onClick={onCreateNewVariant}>
          Create New Part
        </Button>
      </Group>
    </Stack>
  );
}
