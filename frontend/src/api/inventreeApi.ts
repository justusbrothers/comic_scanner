import type { InvenTreePluginContext } from '@inventreedb/ui';

export async function ensureTemplate(
  context: InvenTreePluginContext,
  name: string,
  description?: string
): Promise<number | null> {
  if (!context?.api) return null;

  try {
    // 1. Search for existing template (Updated endpoint)
    const res = await context.api.get('/api/parameter/template/', {
      params: { search: name }
    });

    const data = res.data || {};
    const results = data.results || (Array.isArray(data) ? data : []);

    // Exact match lookup
    const existing = results.find(
      (t: any) => t.name?.toLowerCase() === name.toLowerCase()
    );

    if (existing) {
      return existing.pk;
    }

    // 2. Create template if missing (Updated endpoint)
    const createRes = await context.api.post('/api/parameter/template/', {
      name,
      description: description || name
    });

    return createRes.data?.pk || null;
  } catch (err: any) {
    console.error(
      `Failed to ensure parameter template "${name}":`,
      err?.response?.status,
      err?.response?.data || err.message
    );
    return null;
  }
}

export async function ensureParameter(
  context: InvenTreePluginContext,
  partPk: number,
  templateName: string,
  dataValue: string | number | boolean,
  isBool = false,
  explicitTemplatePk?: number
): Promise<void> {
  if (!context?.api) {
    console.error(
      `ensureParameter error: InvenTree context.api is undefined when attempting to process "${templateName}"`
    );
    return;
  }

  try {
    const valStr = isBool ? (dataValue ? 'true' : 'false') : String(dataValue);

    // Use explicitTemplatePk if provided, otherwise perform dynamic lookup
    const templatePk =
      explicitTemplatePk ??
      (await ensureTemplate(context, templateName, templateName));

    if (!templatePk) {
      console.warn(`Could not resolve template PK for "${templateName}"`);
      return;
    }

    // 1. Query existing parameters using model_id and template
    const existingRes = await context.api.get('/api/parameter/', {
      params: {
        model_id: partPk,
        template: templatePk
      }
    });

    const data = existingRes.data || {};
    const existingItems = data.results || (Array.isArray(data) ? data : []);
    const hasExisting = data.count > 0 || existingItems.length > 0;

    if (hasExisting) {
      // 2. Update existing parameter (PATCH)
      const paramId = existingItems[0].pk;
      await context.api.patch(`/api/parameter/${paramId}/`, {
        data: valStr
      });
      console.log(
        `Updated parameter "${templateName}" (#${paramId}) to "${valStr}"`
      );
    } else {
      // 3. Create new parameter (POST)
      await context.api.post('/api/parameter/', {
        model_type: 'part.part',
        model_id: partPk,
        template: templatePk,
        data: valStr
      });
      console.log(
        `Created parameter "${templateName}" with value "${valStr}" for part #${partPk}`
      );
    }
  } catch (err: any) {
    console.error(
      `Pipeline runtime parameter synchronization failure for ${templateName}:`,
      err?.response?.status,
      err?.response?.data || err.message
    );
  }
}
