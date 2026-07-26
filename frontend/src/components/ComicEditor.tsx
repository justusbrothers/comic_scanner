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
  loading: boolean;
  existingPartPk: number | null;
  onEditChange: (field: keyof ComicData, val: any) => void;
  onUpcChange: (val: string) => void;
  onCreateStockChange: (val: boolean) => void;
  onQuantityChange: (val: number) => void;
  onWhatnotChange: (val: boolean) => void;
  onWhatnotPriceChange: (val: string) => void;
  onConditionChange: (val: string) => void;
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
  loading,
  existingPartPk,
  onEditChange,
  onUpcChange,
  onCreateStockChange,
  onQuantityChange,
  onWhatnotChange,
  onWhatnotPriceChange,
  onConditionChange,
  onUpdateExisting,
  onCreateNewVariant
}: ComicEditorProps) {
  return (
    <Stack style={{ flex: 1 }} gap='md'>
      <Title order={5}>Comic Details</Title>
      {selectedVariant.image_url && (
        <Image src={selectedVariant.image_url} h={200} fit='contain' />
      )}
      <TextInput
        label='Title / Name'
        value={editedData.title ?? selectedVariant.display_name}
        onChange={(e) => onEditChange('title', e.currentTarget.value)}
      />
      <TextInput
        label='UPC Barcode'
        value={editedUPC}
        onChange={(e) => onUpcChange(e.currentTarget.value)}
      />
      <Textarea
        label='Description'
        rows={4}
        value={editedData.description ?? selectedVariant.description}
        onChange={(e) => onEditChange('description', e.currentTarget.value)}
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
          onChange={(val) => onQuantityChange(Number(val))}
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
          value={whatnotPrice}
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
