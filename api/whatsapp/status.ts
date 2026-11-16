import { getGatewayConfig } from '../_whatsapp.js';

export function GET() {
  const cfg = getGatewayConfig();
  return Response.json({
    configured: cfg.isConfigured,
    provider: cfg.provider,
    hasDefaultGroup: Boolean(cfg.defaultGroupId),
  });
}
