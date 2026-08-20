class CloudflareCachePurge {
  constructor({ zoneId, token, serviceBaseUrl, fetchImpl = fetch }) {
    this.zoneId = zoneId;
    this.token = token;
    this.serviceBaseUrl = serviceBaseUrl.replace(/\/$/, '');
    this.fetchImpl = fetchImpl;
  }

  async purge(paths) {
    if (!Array.isArray(paths) || paths.length < 1) return;
    const files = [...new Set(paths)].map((path) => new URL(path, `${this.serviceBaseUrl}/`).toString());
    const response = await this.fetchImpl(
      `https://api.cloudflare.com/client/v4/zones/${this.zoneId}/purge_cache`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ files }),
        signal: AbortSignal.timeout(5000),
      }
    );
    const body = await response.json().catch(() => null);
    if (!response.ok || body?.success !== true) throw new Error('CACHE_PURGE_FAILED');
  }
}

class UnavailableCachePurge {
  async purge() {
    throw new Error('Cache purge is not configured');
  }
}

function createCachePurgeFromEnv(env = process.env) {
  const zoneId = env.CF_ZONE_ID;
  const token = env.CF_CACHE_PURGE_TOKEN;
  const serviceBaseUrl = env.SERVICE_BASE_URL;
  if ([zoneId, token, serviceBaseUrl].every((value) => typeof value === 'string' && value.length > 0)) {
    return new CloudflareCachePurge({ zoneId, token, serviceBaseUrl });
  }
  return new UnavailableCachePurge();
}

module.exports = { CloudflareCachePurge, UnavailableCachePurge, createCachePurgeFromEnv };
