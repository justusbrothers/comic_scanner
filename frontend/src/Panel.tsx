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
  Text,
  TextInput,
  Title,
  Stack,
  Image,
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

function ComicScannerPanel({ context }: { context: InvenTreePluginContext }) {
  const [barcode, setBarcode] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ComicData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dryRun, setDryRun] = useState(true);

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

          notifications.show({
            title: 'Success',
            message: `Found: ${payload.comic_data.title}`,
            color: 'green',
            icon: <IconCheck />,
          });
        } else {
          throw new Error(
            payload?.message || 'Invalid response from server'
          );
        }
      } catch (err: any) {
        setError(err?.message || 'Failed to lookup comic');

        notifications.show({
          title: 'Error',
          message: err?.message || 'Operation failed',
          color: 'red',
          icon: <IconX />,
        });
      } finally {
        setLoading(false);
      }
    };

    handleLookup();
  }, [barcode, context.api]);

  const handleCreate = async () => {
    if (!result) return;

    if (dryRun) {
      notifications.show({
        title: 'Dry Run Preview',
        message: `Would create:\n${result.title}\nIPN: ${
          result.ipn_proposed
        }\n\n${result.description.substring(0, 150)}...`,
        color: 'teal',
        autoClose: false,
      });
      return;
    }

    setLoading(true);

    try {
      const createResponse = await context.api.post('/api/part/', {
        name: result.title,
        IPN: result.ipn_proposed,
        description: result.description || 'Imported from Metron.cloud',
        link: result.metron_url,
        units: 'each',
        revision: 'A',
        category: 1,
      });

      const createdPart = createResponse.data;

      notifications.show({
        title: 'Part Created',
        message: `PK: ${createdPart.pk} - ${createdPart.name}`,
        color: 'green',
        icon: <IconCheck />,
      });

      setResult(null);
      setBarcode('');
    } catch (err: any) {
      setError(err?.message || 'Failed to create part');

      notifications.show({
        title: 'Creation Error',
        message: err?.message || 'Creation failed',
        color: 'red',
        icon: <IconX />,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Stack p="md">
      <Title order={3}>Comic Scanner</Title>

      <Text c="dimmed" mb="md">
        Scan or enter UPC to lookup comic data and create part
      </Text>

      <Group mb="md">
        <Switch
          label="Dry Run Mode (Preview Only)"
          checked={dryRun}
          onChange={(e) => setDryRun(e.currentTarget.checked)}
          color="teal"
          size="md"
        />
      </Group>

      <Group grow>
        <TextInput
          placeholder="Scan or enter UPC barcode..."
          value={barcode}
          onChange={(e) =>
            setBarcode((e.target as HTMLInputElement).value)
          }
          leftSection={<IconBarcode />}
          onKeyDown={(e) =>
            e.key === 'Enter' &&
            setBarcode((e.target as HTMLInputElement).value)
          }
          autoFocus
        />

        <Button
          onClick={() => setBarcode(barcode)}
          loading={loading}
          disabled={!barcode.trim()}
        >
          Lookup
        </Button>
      </Group>

      {loading && <Loader mt="md" />}

      {error && (
        <Alert color="red" title="Error" mt="md">
          {error}
        </Alert>
      )}

      {result && (
        <Alert color="blue" title="Comic Data" mt="md">
          <Stack gap="xs">
            <Group justify="apart">
              <Title order={4}>{result.title}</Title>
              <Text fw={700} c="dimmed">
                IPN: {result.ipn_proposed}
              </Text>
            </Group>

            <Text size="sm" lineClamp={3}>
              {result.description}
            </Text>

            <Group>
              <Text>
                Publisher: {result.publisher} ({result.pub_code})
              </Text>
              <Text>
                Issue: {result.issue}{' '}
                {result.volume ? `(Vol. ${result.volume})` : ''}
              </Text>
            </Group>

            <Group>
              <Text>Cover: {result.cover_date}</Text>
              <Text>Store: {result.store_date}</Text>
            </Group>

            {result.image_url && (
              <Image
                src={result.image_url}
                alt="Comic cover"
                radius="md"
                fit="contain"
                mah={300}
                mx="auto"
              />
            )}

            <Group mt="md">
              <Button
                color="green"
                onClick={handleCreate}
                loading={loading}
              >
                {dryRun ? 'Preview Create' : 'Create Part'}
              </Button>
              <Button
                variant="outline"
                onClick={() => setResult(null)}
              >
                Clear
              </Button>
            </Group>
          </Stack>
        </Alert>
      )}
    </Stack>
  );
}

export function renderComicScannerPanel(
  context: InvenTreePluginContext
) {
  checkPluginVersion(context);
  return <ComicScannerPanel context={context} />;
}
