import { Alert, Image, Stack, Table, Text, Title } from '@mantine/core';
import type { Variant } from '../types/comic';

interface VariantSelectorProps {
  variants: Variant[];
  selectedVariant: Variant | null;
  onSelectVariant: (v: Variant) => void;
}

export function VariantSelector({
  variants,
  selectedVariant,
  onSelectVariant
}: VariantSelectorProps) {
  return (
    <Stack style={{ flex: 1 }}>
      <Title order={5}>Select Variant ({variants.length})</Title>
      {variants.length > 30 && (
        <Alert color='orange' title='Large number of matches'>
          Many results – pick the correct cover based on image/description.
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
          {variants.map((v) => (
            <Table.Tr
              key={v.metron_id}
              onClick={() => onSelectVariant(v)}
              style={{
                cursor: 'pointer',
                backgroundColor:
                  selectedVariant?.metron_id === v.metron_id
                    ? 'var(--mantine-color-blue-light)'
                    : undefined
              }}
            >
              <Table.Td>{v.is_scanned_match ? '🎯' : ''}</Table.Td>

              <Table.Td>
                {v.image_url && (
                  <Image src={v.image_url} h={50} w={35} fit='contain' />
                )}
              </Table.Td>

              <Table.Td>
                <Text
                  size='sm'
                  fw={selectedVariant?.metron_id === v.metron_id ? 700 : 400}
                >
                  {v.display_name}
                </Text>
              </Table.Td>

              <Table.Td>
                <Text size='xs' c='dimmed'>
                  {v.upc || '-'}
                </Text>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Stack>
  );
}
