import { getEmailConfig } from '../_email.js';

export function GET() {
  const cfg = getEmailConfig();
  return Response.json({
    configured: cfg.configured,
    provider: cfg.provider,
    recipientMasked: cfg.recipientMasked,
  });
}
