import { Button, Group, Stack, TextInput } from '@mantine/core';
import { IconBarcode, IconExternalLink } from '@tabler/icons-react';

interface ScannerInputProps {
  barcodeInput: string;
  metronIdInput: string;
  loading: boolean;
  onBarcodeChange: (val: string) => void;
  onMetronIdChange: (val: string) => void;
  onLookup: () => void;
  onManualEntry: () => void;
}

export function ScannerInput({
  barcodeInput,
  metronIdInput,
  loading,
  onBarcodeChange,
  onMetronIdChange,
  onLookup,
  onManualEntry
}: ScannerInputProps) {
  return (
    <Stack mt='md' gap='md'>
      <TextInput
        placeholder='Scan or enter UPC barcode...'
        value={barcodeInput}
        onChange={(e) => onBarcodeChange(e.currentTarget.value)}
        leftSection={<IconBarcode />}
      />
      <TextInput
        placeholder='Metron.cloud issue ID (e.g. 12345)'
        value={metronIdInput}
        onChange={(e) => onMetronIdChange(e.currentTarget.value)}
        leftSection={<IconExternalLink size={16} />}
      />
      <Group grow>
        <Button
          onClick={onLookup}
          loading={loading}
          disabled={loading || (!barcodeInput.trim() && !metronIdInput.trim())}
        >
          Lookup
        </Button>
        <Button
          variant='light'
          color='gray'
          onClick={onManualEntry}
          disabled={loading}
        >
          Manual Entry
        </Button>
      </Group>
    </Stack>
  );
}
