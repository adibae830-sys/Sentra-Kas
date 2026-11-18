export function GET() {
  const configured = Boolean((process.env.GEMINI_API_KEY || '').trim());
  return Response.json({ configured });
}
