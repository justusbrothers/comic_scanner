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

  /* -------------------- Barcode Lookup -------------------- */
  useEffect(() => {
    if (!barcode.trim()) return;

    const handleLookup = async () => {
      setLoading(true);
      setError(null);
      setResult(null);
      setExistingPartPk(null);

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

        // Reset switches
        setIncludeTitle(true);
        setIncludeIPN(true);
        setIncludeDescription(true);
        setIncludeImage(true);
        setIncludeUPC(true);
        setCreateStock(true);
        setInitialQuantity(1);

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
    const res = await context.api.get('/api/part/parameter/template/', { params: { name: 'UPC' } });
    if (res.data.count > 0) return res.data.results[0].pk;

    const createRes = await context.api.post('/api/part/parameter/template/', {
      name: 'UPC',
      units: 'barcode',
      description: 'Universal Product Code',
      data_type: 'string',
    });

    return createRes.data.pk;
  };

  /* -------------------- Create / Update Flow -------------------- */
  const handleCreateOrUpdate = async () => {
    if (!result) return;

    setLoading(true);

    try {
      let partPk = existingPartPk;
      const payload: Record<string, any> = {};

      if (includeTitle) payload.name = result.title;
      if (includeDescription) payload.description = result.description;

      const pubCode = determinePublisherCode(result.publisher, barcode);
      const stockLocation = determineStockLocation(pubCode);
      const category = determineCategory(pubCode);

      const safeQuantity =
        typeof initialQuantity === 'number' && initialQuantity >= 1
          ? initialQuantity
          : null;

      if (!partPk) {
        // ── CREATE NEW PART ────────────────────────────────────────

        Object.assign(payload, {
          units: 'each',
          category,
          active: true,
          stock_location: stockLocation,
        });

        if (includeImage && result.image_url) {
          payload.remote_image = result.image_url;
        }

        // Initial stock on creation (using special field)
        if (createStock && safeQuantity !== null) {
          payload.initial_stock = [
            {
              quantity: safeQuantity,
              // location: stockLocation,  // optional override
            },
          ];
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
          const patchPayload: Record<string, any> = { ...payload };
          if (includeIPN) patchPayload.IPN = result.ipn_proposed;

          if (includeImage && result.image_url) {
            patchPayload.remote_image = result.image_url;
          }

          if (Object.keys(patchPayload).length > 0) {
            await context.api.patch(`/api/part/${partPk}/`, patchPayload);
          }
        }

        // Add new stock item(s) on update
        if (createStock && safeQuantity !== null && !dryRun) {
          await context.api.post('/api/stock/', {
            part: partPk,
            quantity: safeQuantity,
            location: stockLocation ?? undefined, // use part's default if null
            // Optional extras: serial, batch, expiry_date, etc.
          });
        }
      }

      // Save UPC
      if (includeUPC && barcode && partPk && !dryRun) {
        try {
          const upcTemplatePk = await ensureUpcTemplate();
          const existingUPC = await context.api.get('/api/part/parameter/', {
            params: { part: partPk, template: upcTemplatePk },
          });

          if (existingUPC.data.count > 0) {
            await context.api.patch(
              `/api/part/parameter/${existingUPC.data.results[0].pk}/`,
              { data: barcode }
            );
          } else {
            await context.api.post('/api/part/parameter/', {
              part: partPk,
              template: upcTemplatePk,
              data: barcode,
            });
          }
        } catch {
          notifications.show({
            title: 'UPC Parameter Failed',
            message: 'Could not save UPC parameter',
            color: 'yellow',
          });
        }
      }

      notifications.show({
        title: existingPartPk ? 'Part Updated' : 'Part Created',
        message: `${result.title}${
          createStock && safeQuantity !== null
            ? ` (+${safeQuantity} in stock)`
            : ''
        }`,
        color: 'green',
        icon: <IconCheck />,
      });

      setResult(null);
      setBarcode('');
      setExistingPartPk(null);
      setInitialQuantity(1);
      setCreateStock(true);
    } catch (err: any) {
      setError(err?.message || 'Operation failed');
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
          onClick={() => setBarcode(barcodeInput)}
          loading={loading}
          disabled={!barcodeInput.trim()}
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
              <Table.Tr>
                <Table.Td>
                  <Switch
                    checked={includeTitle}
                    onChange={(e) => setIncludeTitle(e.currentTarget.checked)}
                  />
                </Table.Td>
                <Table.Td>Title</Table.Td>
                <Table.Td>{result.title}</Table.Td>
              </Table.Tr>

              <Table.Tr>
                <Table.Td>
                  <Switch
                    checked={includeIPN}
                    onChange={(e) => setIncludeIPN(e.currentTarget.checked)}
                  />
                </Table.Td>
                <Table.Td>IPN</Table.Td>
                <Table.Td>{result.ipn_proposed}</Table.Td>
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
                <Table.Td>{result.description}</Table.Td>
              </Table.Tr>

              <Table.Tr>
                <Table.Td>
                  <Switch
                    checked={includeImage}
                    onChange={(e) => setIncludeImage(e.currentTarget.checked)}
                  />
                </Table.Td>
                <Table.Td>Cover Image</Table.Td>
                <Table.Td>{result.image_url ? 'Yes' : '—'}</Table.Td>
              </Table.Tr>

              <Table.Tr>
                <Table.Td>
                  <Switch
                    checked={includeUPC}
                    onChange={(e) => setIncludeUPC(e.currentTarget.checked)}
                  />
                </Table.Td>
                <Table.Td>UPC</Table.Td>
                <Table.Td>{barcode}</Table.Td>
              </Table.Tr>

              <Table.Tr>
                <Table.Td />
                <Table.Td>Category</Table.Td>
                <Table.Td>
                  {determineCategory(
                    determinePublisherCode(result.publisher, barcode)
                  )}
                </Table.Td>
              </Table.Tr>
            </Table.Tbody>
          </Table>

          {/* Initial Stock Controls */}
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

          <Group mt="md">
            <Button
              color="green"
              onClick={handleCreateOrUpdate}
              loading={loading}
              disabled={loading}
            >
              {dryRun
                ? existingPartPk
                  ? 'Preview Update'
                  : 'Preview Create'
                : existingPartPk
                ? 'Update Part'
                : 'Create Part'}
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
