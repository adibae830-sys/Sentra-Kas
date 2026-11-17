import { getServiceAccountConfig } from '../_sheets.js';

export function GET() {
  const cfg = getServiceAccountConfig();
  return Response.json({
    serviceAccountConfigured: Boolean(cfg),
  });
}
