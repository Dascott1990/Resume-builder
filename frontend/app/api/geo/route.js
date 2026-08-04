/**
 * GET /api/geo — tells the client which country the request came from.
 *
 * Vercel's edge network stamps every request with an x-vercel-ip-country
 * header before it ever reaches app code — no external geolocation service,
 * no IP address handled or stored by us, just a header read. Only present
 * in production on Vercel; localhost has no such header, which is exactly
 * why the client-side hook that calls this treats an empty response as
 * "fall back to timezone" rather than an error.
 */
export async function GET(request) {
  const country = request.headers.get("x-vercel-ip-country") || null;
  return Response.json({ country });
}
