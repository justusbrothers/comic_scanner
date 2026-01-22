import {
  checkPluginVersion,
  type InvenTreePluginContext,
} from '@inventreedb/ui';
import {
  Alert,
  Button,
  Group,
  Loader,
  Switch,
  TextInput,
  Title,
  Stack,
  Image,
  Checkbox,
  Table,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconBarcode, IconCheck, IconX } from '@tabler/icons-react';
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
}

type FieldKey =
  | 'title'
  | 'ipn_proposed'
  | 'description'
  | 'image_url'
  | 'upc';

const DEFAULT_FIELDS: Record<FieldKey, boolean> = {
  title: true,
  ipn_proposed: true,
  description: true,
  image_url: true,
  upc: true,
};

/* -------------------- Publisher Defaults -------------------- */
const PUBLISHER_CODES: Record<string, string> = {
  "Marvel": "MAR",
  "DC Comics": "DC",
  "Image Comics": "IMG",
  "Dark Horse Comics": "DHC",
  "IDW Publishing": "IDW",
  "Boom! Studios": "BOOM",
  "Valiant Entertainment": "VAL",
  "Archie Comics": "ARCH",
};

const PUBLISHER_PART_CATEGORIES: Record<string, number | null> = {
  "ARCH": null,
  "BOOM": null,
  "DC": 3,
  "DHC": 2,
  "IDW": 24,
  "IMG": 4,
  "MAR": 5,
  "VAL": 23,
  "VER": 26,
};

const PUBLISHER_STOCK_LOCATIONS: Record<string, number | null> = {
  "ARCH": null,
  "BOOM": null,
  "DC": 91,
  "DHC": null,
  "IDW": null,
  "IMG": null,
  "MAR": 92,
  "VAL": null,
  "VER": null,
};

const PUBLISHER_UPC_PREFIXES: Record<string, string> = {
  '761941': 'DC',
  '761568': 'DHC',
  '827': 'IDW',
  '704': 'IMG',
  '759606': 'MAR',
};

function ComicScannerPanel({ context }: { context: InvenTreePluginContext }) {
  const [barcode, setBarcode] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ComicData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dryRun, setDryRun] = useState(true);
  const [selectedFields, setSelectedFields] =
    useState<Record<FieldKey, boolean>>(DEFAULT_FIELDS);

  /* -------------------- Barcode Lookup -------------------- */
  useEffect(() => {
    if (!barcode.trim()) return;

    const handleLookup = async () => {
      setLoading(true);
      setError(null);
      setResult(null);

      try {
        const response = await context.api.post(
          '/plugin/comic_scanner/comic-lookup/',
          { barcode }
        );

        const payload = response.data;

        if (payload?.success && payload?.comic_data) {
          setResult(payload.comic_data);
          setSelectedFields(DEFAULT_FIELDS);

          notifications.show({
            title: 'Success',
            message: `Found: ${payload.comic_data.title}`,
            color: 'green',
            icon: <IconCheck />,
          });
        } else {
          throw new Error(payload?.message || 'Invalid response');
        }
      } catch (err: any) {
        setError(err?.message || 'Lookup failed');
        notifications.show({
          title: 'Error',
          message: err?.message,
          color: 'red',
          icon: <IconX />,
        });
      } finally {
        setLoading(false);
      }
    };

    handleLookup();
  }, [barcode, context.api]);

  /* -------------------- Helpers -------------------- */

  const ensureUpcTemplate = async (): Promise<number> => {
    const res = await context.api.get(
      '/api/part/parameter/template/',
      { params: { name: 'UPC' } }
    );

    if (res.data.count > 0) {
      return res.data.results[0].pk;
    }

    const createRes = await context.api.post(
      '/api/part/parameter/template/',
      {
        name: 'UPC',
        units: 'barcode',
        description: 'Universal Product Code',
        data_type: 'string',
      }
    );

    return createRes.data.pk;
  };

  const uploadImageToPart = async (partPk: number, imageUrl: string) => {
    const imageResponse = await fetch(imageUrl);
    const blob = await imageResponse.blob();

    const formData = new FormData();
    formData.append('part', partPk.toString());
    formData.append('image', blob, 'cover.jpg');

    await context.api.post('/api/image/part/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  };

  const determinePublisherCode = (publisher: string, barcode: string) => {
    if (PUBLISHER_CODES[publisher]) return PUBLISHER_CODES[publisher];

    // fallback to UPC prefix
    for (const prefix in PUBLISHER_UPC_PREFIXES) {
      if (barcode.startsWith(prefix)) return PUBLISHER_UPC_PREFIXES[prefix];
    }

    return 'UNK';
  };

  const determineStockLocation = (pubCode: string) => {
    return PUBLISHER_STOCK_LOCATIONS[pubCode] || null;
  };

  const determineCategory = (pubCode: string) => {
    return PUBLISHER_PART_CATEGORIES[pubCode] || 1;
  };

  /* -------------------- Create Flow -------------------- */
  const handleCreate = async () => {
    if (!result) return;

    const pubCode = determinePublisherCode(result.publisher, barcode);
    const stockLocation = determineStockLocation(pubCode);
    const category = determineCategory(pubCode);

    if (dryRun) {
      notifications.show({
        title: 'Dry Run',
        message: `Would create: ${result.title}\nIPN: ${result.ipn_proposed}\nCategory: ${category}`,
        color: 'teal',
        autoClose: false,
      });
      return;
    }

    setLoading(true);

    try {
      const payload: Record<string, any> = {
        units: 'each',
        category,
        active: true,
        stock_location: stockLocation,
      };

      if (selectedFields.title) payload.name = result.title;
      if (selectedFields.ipn_proposed) payload.IPN = result.ipn_proposed;
      if (selectedFields.description)
        payload.description = result.description;

      const createResponse = await context.api.post('/api/part/', payload);
      const createdPart = createResponse.data;

      /* ---- Image Upload ---- */
      if (selectedFields.image_url && result.image_url) {
        try {
          await uploadImageToPart(createdPart.pk, result.image_url);
        } catch {
          notifications.show({
            title: 'Image Upload Failed',
            message: 'Part created, image upload failed',
            color: 'yellow',
          });
        }
      }

      /* ---- UPC Parameter ---- */
      if (selectedFields.upc && barcode) {
        try {
          const upcTemplatePk = await ensureUpcTemplate();
          await context.api.post('/api/part/parameter/', {
            part: createdPart.pk,
            template: upcTemplatePk,
            data: barcode,
          });
        } catch {
          notifications.show({
            title: 'UPC Parameter Failed',
            message: 'Part created, UPC parameter not saved',
            color: 'yellow',
          });
        }
      }

      notifications.show({
        title: 'Part Created',
        message: `PK ${createdPart.pk} - ${createdPart.name}`,
        color: 'green',
        icon: <IconCheck />,
      });

      setResult(null);
      setBarcode('');
    } catch (err: any) {
      setError(err?.message || 'Create failed');
      notifications.show({
        title: 'Creation Error',
        message: err?.message,
        color: 'red',
        icon: <IconX />,
      });
    } finally {
      setLoading(false);
    }
  };

  /* -------------------- UI -------------------- */
  return (
    <Stack p="md">
      <Title order={3}>Comic Scanner</Title>

      <Switch
        label="Dry Run Mode"
        checked={dryRun}
        onChange={(e) => setDryRun(e.currentTarget.checked)}
      />

      <Group grow mt="md">
        <TextInput
          placeholder="Scan UPC..."
          value={barcode}
          onChange={(e) => setBarcode(e.currentTarget.value)}
          leftSection={<IconBarcode />}
        />
        <Button
          onClick={() => setBarcode(barcode)}
          loading={loading}
          disabled={!barcode.trim()}
        >
          Lookup
        </Button>
      </Group>

      {loading && <Loader />}
      {error && <Alert color="red">{error}</Alert>}

      {result && (
        <>
          <Alert color="blue" title={result.title} mt="md">
            {result.description}
          </Alert>

          <Table withTableBorder mt="md">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Include</Table.Th>
                <Table.Th>Field</Table.Th>
                <Table.Th>Value</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {([
                ['title', 'Title', result.title],
                ['ipn_proposed', 'IPN', result.ipn_proposed],
                ['description', 'Description', result.description],
                ['image_url', 'Cover Image', result.image_url ? 'Yes' : '—'],
                ['upc', 'UPC', barcode],
              ] as [FieldKey, string, string][]).map(
                ([key, label, value]) => (
                  <Table.Tr key={key}>
                    <Table.Td>
                      <Checkbox
                        checked={selectedFields[key]}
                        onChange={(e) =>
                          setSelectedFields((p) => ({
                            ...p,
                            [key]: e.currentTarget.checked,
                          }))
                        }
                      />
                    </Table.Td>
                    <Table.Td>{label}</Table.Td>
                    <Table.Td>{value}</Table.Td>
                  </Table.Tr>
                )
              )}

              {/* Display Category (read-only) */}
              <Table.Tr key="category">
                <Table.Td />
                <Table.Td>Category</Table.Td>
                <Table.Td>
                  {determineCategory(determinePublisherCode(result.publisher, barcode))}
                </Table.Td>
              </Table.Tr>
            </Table.Tbody>
          </Table>

          {result.image_url && (
            <Image
              src={result.image_url}
              alt="Cover"
              radius="md"
              mah={300}
              fit="contain"
              mt="md"
            />
          )}

          <Group mt="md">
            <Button color="green" onClick={handleCreate} loading={loading}>
              {dryRun ? 'Preview Create' : 'Create Part'}
            </Button>
            <Button variant="outline" onClick={() => setResult(null)}>
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
