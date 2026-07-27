import type { InvenTreePluginContext } from '@inventreedb/ui';

interface ParameterTemplate {
  pk: number;
  name: string;
  description?: string;
  data_type?: string;
}

export async function ensureTemplate(
  context: InvenTreePluginContext,
  name: string,
  description: string
): Promise<number | null> {
  try {
    const res = await context.api.get('/api/parameter/template/', {
      params: { search: name }
    });
    const results: ParameterTemplate[] = res.data?.results || res.data || [];
    const existing = results.find(
      (t) => t.name.toLowerCase() === name.toLowerCase()
    );

    if (existing) return existing.pk;

    const createRes = await context.api.post('/api/parameter/template/', {
      name,
      description,
      data_type: 'text'
    });
    return createRes.data.pk;
  } catch (err) {
    console.error(`Failed to ensure template "${name}":`, err);
    return null;
  }
}

export async function ensureParameter(
  context: InvenTreePluginContext,
  partPk: number,
  templateName: string,
  dataValue: string | number | boolean,
  isBool = false
): Promise<void> {
  try {
    const valStr = isBool ? (dataValue ? 'true' : 'false') : String(dataValue);
    const templatePk = await ensureTemplate(
      context,
      templateName,
      templateName
    );
    if (!templatePk) return;

    const existingRes = await context.api.get('/api/parameter/', {
      params: { model_id: partPk, template: templatePk }
    });
    const existingItems = existingRes.data?.results || existingRes.data || [];

    if (existingItems.length > 0) {
      await context.api.patch(`/api/parameter/${existingItems[0].pk}/`, {
        data: valStr
      });
    } else {
      await context.api.post('/api/parameter/', {
        model_type: 'part.part',
        model_id: partPk,
        template: templatePk,
        data: valStr
      });
    }
  } catch (err) {
    console.error(`Failed to save parameter "${templateName}":`, err);
  }
}
