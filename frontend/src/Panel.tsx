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
  Table,
  NumberInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconBarcode, IconCheck, IconX, IconExternalLink } from '@tabler/icons-react';
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

/* -------------------- Publisher Defaults -------------------- */
const PUBLISHER_CODES: Record<string, string> = {
  Marvel: 'MAR',
  'DC Comics': 'DC',
  'Image Comics': 'IMG',
  'Dark Horse Comics': 'DHC',
  'IDW Publishing': 'IDW',
  'Boom! Studios': 'BOOM',
  'Valiant Entertainment': 'VAL',
  'Archie Comics': 'ARCH',
};

const PUBLISHER_PART_CATEGORIES: Record<string, number | null> = {
  ARCH: null,
  BOOM: null,
  DC: 3,
  DHC: 2,
  IDW: 24,
  IMG: 4,
  MAR: 5,
  VAL: 23,
  VER: 26,
};

const PUBLISHER_STOCK_LOCATIONS: Record<string, number | null> = {
  ARCH: null,
  BOOM: null,
  DC: 91,
  DHC: null,
  IDW: null,
  IMG: null,
  MAR: 92,
  VAL: null,
  VER: null,
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
  const [barcodeInput, setBarcodeInput] = useState('');
  const [dryRun, setDryRun] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ComicData | null>(null);
  const [existingPartPk, setExistingPartPk] = useState<number | null>(null);

  // Individual Switches for each field
  const [includeTitle, setIncludeTitle] = useState(true);
  const [includeIPN, setIncludeIPN] = useState(true);
  const [includeDescription, setIncludeDescription] = useState(true);
  const [includeImage, setIncludeImage] = useState(true);
  const [includeUPC, setIncludeUPC] = useState(true);

  // Stock creation controls
  const [createStock, setCreateStock] = useState(true);
  const [initialQuantity, setInitialQuantity] = useState<number | ''>(1);

  // Track recently created/updated part for linking
  const [createdOrUpdatedPart, setCreatedOrUpdatedPart] = useState<{
    pk: number;
    name: string;
  } | null>(null);

  /* -------------------- Barcode Lookup -------------------- */
  useEffect(() => {
    if (!barcode.trim()) return;

    const handleLookup = async () => {
      setLoading(true);
      setError(null);
      // Keep previous result until new lookup succeeds

      try {
        const response = await context.api.post(
          '/plugin/comic_scanner/comic-lookup/',
          { barcode }
        );

        const payload = response.data;

        if (!payload?.success || !payload?.comic_data) {
          throw new Error(payload?.message || 'Invalid response from Metron');
        }

        const comic = payload.comic_data;
        setResult(comic);

        // Reset switches for new comic
        setIncludeTitle(true);
        setIncludeIPN(true);
        setIncludeDescription(true);
        setIncludeImage(true);
        setIncludeUPC(true);
        setCreateStock(true);
        setInitialQuantity(1);
        setCreatedOrUpdatedPart(null); // Clear previous success link

        // Find existing part
        const partRes = await context.api.get('/api/part/', {
          params: { search: comic.ipn_proposed },
        });

        let locatedPartPk: number | null = null;

        const parts = Array.isArray(partRes.data) ? partRes.data : [];

        const exactMatch = parts.find(
          (p: any) => p.IPN?.trim() === comic.ipn_proposed
        );

        if (exactMatch) {
          locatedPartPk = exactMatch.pk;
          notifications.show({
            title: 'Found in InvenTree',
            message: `Part PK: ${locatedPartPk}`,
            color: 'green',
            icon: <IconCheck />,
          });
        }

        setExistingPartPk(locatedPartPk);

        notifications.show({
          title: 'Found on Metron',
          message: comic.title,
          color: 'green',
          icon: <IconCheck />,
        });
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
  const determinePublisherCode = (publisher: string, barcode: string) => {
    if (PUBLISHER_CODES[publisher]) return PUBLISHER_CODES[publisher];
    for (const prefix in PUBLISHER_UPC_PREFIXES) {
      if (barcode.startsWith(prefix)) return PUBLISHER_UPC_PREFIXES[prefix];
    }
    return 'UNK';
  };

  const determineStockLocation = (pubCode: string) =>
    PUBLISHER_STOCK_LOCATIONS[pubCode] || null;

  const determineCategory = (pubCode: string) =>
    PUBLISHER_PART_CATEGORIES[pubCode] || 1;

  const ensureUpcTemplate = async (): Promise<number> => {
    try {
      const res = await context.api.get('/api/part/parameter/template/', {
        params: { name: 'UPC' },
      });

      if (res.data.count > 0) {
        return res.data.results[0].pk;
      }

      const createRes = await context.api.post('/api/part/parameter/template/', {
        name: 'UPC',
        units: 'barcode',
        description: 'Universal Product Code (barcode)',
        data_type: 'string',
        default_value: '',
        choices: [],
      });

      return createRes.data.pk;
    } catch (err: any) {
      console.error('Failed to ensure UPC template:', err?.response?.data || err);
      throw err;
    }
  };

  /* -------------------- Create / Update Flow -------------------- */
  const handleCreateOrUpdate = async () => {
    if (!result) return;

    setLoading(true);
    setError(null);

    try {
      let partPk = existingPartPk;
      const payload: Record<string, any> = {};

      const pubCode = determinePublisherCode(result.publisher, barcode);
      const stockLocation = determineStockLocation(pubCode);
      const category = determineCategory(pubCode);

      const safeQuantity =
        typeof initialQuantity === 'number' && initialQuantity >= 1
          ? initialQuantity
          : null;

      const stockBatch = includeIPN ? result.ipn_proposed : undefined;

      if (!partPk) {
        // ── CREATE NEW PART ────────────────────────────────────────

        payload.name = includeTitle
          ? result.title
          : `Comic ${result.ipn_proposed || barcode.slice(-6) || 'Unknown'}`;

        if (includeDescription) payload.description = result.description;

        Object.assign(payload, {
          units: 'each',
          category,
          active: true,
          stock_location: stockLocation,
        });

        if (includeImage && result.image_url) {
          payload.remote_image = result.image_url;
        }

        if (createStock && safeQuantity !== null) {
          payload.initial_stock = {
            quantity: safeQuantity,
            batch: stockBatch,
            location: stockLocation ?? undefined,     // ← Added: ensures initial stock goes to the right location
          };
        }

        if (!dryRun) {
          const createRes = await context.api.post('/api/part/', {
            ...payload,
            IPN: includeIPN ? result.ipn_proposed : undefined,
          });
          partPk = createRes.data.pk;
        }
      } else {
        // ── UPDATE EXISTING PART ───────────────────────────────────

        if (!dryRun) {
          const patchPayload: Record<string, any> = {};

          if (includeTitle) patchPayload.name = result.title;
          if (includeDescription) patchPayload.description = result.description;
          if (includeIPN) patchPayload.IPN = result.ipn_proposed;

          if (includeImage && result.image_url) {
            patchPayload.remote_image = result.image_url;
          }

          if (Object.keys(patchPayload).length > 0) {
            await context.api.patch(`/api/part/${partPk}/`, patchPayload);
          }
        }

        if (createStock && safeQuantity !== null && !dryRun) {
          await context.api.post('/api/stock/', {
            part: partPk,
            quantity: safeQuantity,
            location: stockLocation ?? undefined,
            batch: stockBatch,
          });
        }
      }

      // Save UPC – improved error handling
      if (includeUPC && barcode && partPk && !dryRun) {
        try {
          const upcTemplatePk = await ensureUpcTemplate();

          const existingRes = await context.api.get('/api/part/parameter/', {
            params: { part: partPk, template: upcTemplatePk },
          });

          if (existingRes.data.count > 0) {
            const paramId = existingRes.data.results[0].pk;
            await context.api.patch(`/api/part/parameter/${paramId}/`, {
              data: barcode.trim(),
            });
          } else {
            await context.api.post('/api/part/parameter/', {
              part: partPk,
              template: upcTemplatePk,
              data: barcode.trim(),
            });
          }
        } catch (upcErr: any) {
          const detail = upcErr?.response?.data || upcErr.message || 'Unknown UPC error';
          notifications.show({
            title: 'Could not save UPC',
            message: typeof detail === 'object'
              ? (detail?.non_field_errors?.[0] || JSON.stringify(detail))
              : detail,
            color: 'yellow',
            autoClose: 8000,
          });
        }
      }

      // Show success + link (keep form visible)
      if (partPk && !dryRun) {
        setCreatedOrUpdatedPart({
          pk: partPk,
          name: result.title,
        });
      }

      notifications.show({
        title: existingPartPk ? 'Part Updated' : 'Part Created',
        message: (
          <>
            {result.title}
            {createStock && safeQuantity !== null ? ` (+${safeQuantity} in stock)` : ''}
            {stockBatch ? ` | Batch/IPN: ${stockBatch}` : ''}
            <br />
            <a
              href={`/part/${partPk}/`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--mantine-color-blue-6)', textDecoration: 'underline' }}
            >
              View part → #{partPk}
            </a>
          </>
        ),
        color: 'green',
        icon: <IconCheck />,
        autoClose: 12000,
      });
    } catch (err: any) {
      const apiError = err?.response?.data || err.message;
      setError(typeof apiError === 'object' ? JSON.stringify(apiError, null, 2) : apiError);
      notifications.show({
        title: 'Operation Failed',
        message: typeof apiError === 'object' ? JSON.stringify(apiError, null, 2) : apiError,
        color: 'red',
        autoClose: false,
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
          value={barcodeInput}
          onChange={(e) => setBarcodeInput(e.currentTarget.value)}
          leftSection={<IconBarcode />}
        />
        <Button
          onClick={() => setBarcode(barcodeInput.trim())}
          loading={loading}
          disabled={!barcodeInput.trim() || loading}
        >
          Lookup
        </Button>
      </Group>

      {loading && <Loader />}
      {error && <Alert color="red" title="Error">{error}</Alert>}

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
              <Table.Tr>
                <Table.Td><Switch checked={includeTitle} onChange={(e) => setIncludeTitle(e.currentTarget.checked)} /></Table.Td>
                <Table.Td>Title</Table.Td>
                <Table.Td>{result.title}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td><Switch checked={includeIPN} onChange={(e) => setIncludeIPN(e.currentTarget.checked)} /></Table.Td>
                <Table.Td>IPN</Table.Td>
                <Table.Td>{result.ipn_proposed}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td><Switch checked={includeDescription} onChange={(e) => setIncludeDescription(e.currentTarget.checked)} /></Table.Td>
                <Table.Td>Description</Table.Td>
                <Table.Td>{result.description}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td><Switch checked={includeImage} onChange={(e) => setIncludeImage(e.currentTarget.checked)} /></Table.Td>
                <Table.Td>Cover Image</Table.Td>
                <Table.Td>{result.image_url ? 'Yes' : '—'}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td><Switch checked={includeUPC} onChange={(e) => setIncludeUPC(e.currentTarget.checked)} /></Table.Td>
                <Table.Td>UPC</Table.Td>
                <Table.Td>{barcode}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td />
                <Table.Td>Category</Table.Td>
                <Table.Td>{determineCategory(determinePublisherCode(result.publisher, barcode))}</Table.Td>
              </Table.Tr>
            </Table.Tbody>
          </Table>

          <Stack mt="xl" gap="xs">
            <Title order={5}>Stock Adjustment</Title>
            <Switch
              label="Add initial stock (new part) or new stock item (existing part)"
              checked={createStock}
              onChange={(e) => setCreateStock(e.currentTarget.checked)}
            />
            {createStock && (
              <NumberInput
                label="Quantity to add"
                min={1}
                value={initialQuantity}
                onChange={(value) => setInitialQuantity(value as number | '')}
                placeholder="e.g. 12"
                allowDecimal={false}
                allowNegative={false}
              />
            )}
            {createStock && initialQuantity === '' && (
              <Alert color="yellow" title="Note">
                Quantity must be at least 1 to add stock.
              </Alert>
            )}
          </Stack>

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

          {createdOrUpdatedPart && (
            <Alert
              color="green"
              title={existingPartPk ? 'Part Updated' : 'Part Created'}
              icon={<IconCheck />}
              mt="md"
            >
              <Group justify="space-between" wrap="nowrap">
                <div>
                  <strong>{createdOrUpdatedPart.name}</strong> is ready.
                </div>
                <Button
                  variant="light"
                  component="a"
                  href={`/part/${createdOrUpdatedPart.pk}/`}
                  target="_blank"
                  rightSection={<IconExternalLink size={16} />}
                >
                  Open part
                </Button>
              </Group>
            </Alert>
          )}

          <Group mt="md">
            <Button
              color="green"
              onClick={handleCreateOrUpdate}
              loading={loading}
              disabled={loading}
            >
              {dryRun
                ? existingPartPk ? 'Preview Update' : 'Preview Create'
                : existingPartPk ? 'Update Part' : 'Create Part'}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                // Full reset only on manual Clear
                setResult(null);
                setBarcode('');
                setBarcodeInput('');
                setExistingPartPk(null);
                setInitialQuantity(1);
                setCreateStock(true);
                setCreatedOrUpdatedPart(null);
                setIncludeTitle(true);
                setIncludeIPN(true);
                setIncludeDescription(true);
                setIncludeImage(true);
                setIncludeUPC(true);
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
