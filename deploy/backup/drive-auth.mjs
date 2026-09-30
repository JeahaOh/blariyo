import { createSign, createHash } from 'node:crypto';

const endpoint = 'https://oauth2.googleapis.com/token';
const scope = 'https://www.googleapis.com/auth/drive.file';
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');

/** Credentials are loaded by the OS-owned runner, never logged or written into receipts. */
export class DriveAuth {
  constructor(config, { fetcher = fetch, now = Date.now } = {}) {
    this.config = config; this.fetcher = fetcher; this.now = now;
    if (config.mode === 'oauth') {
      if (!config.clientId || !config.clientSecret || !config.refreshToken || config.driveId)
        throw Error('DRIVE_OAUTH_CONFIG_INVALID');
    } else if (config.mode === 'shared-service-account') {
      if (!config.driveId || !config.clientEmail || !config.privateKey || config.subject)
        throw Error('DRIVE_SHARED_ACCOUNT_CONFIG_INVALID');
    } else throw Error('DRIVE_AUTH_MODE_INVALID');
    this.identity = createHash('sha256').update(JSON.stringify([config.mode, config.clientId || config.clientEmail])).digest('hex');
  }

  async token(force = false) {
    if (!force && this.cached && this.cached.until > this.now() + 60000) return this.cached.value;
    const c = this.config;
    let body;
    if (c.mode === 'oauth') {
      body = new URLSearchParams({ grant_type: 'refresh_token', refresh_token: c.refreshToken,
        client_id: c.clientId, client_secret: c.clientSecret });
    } else {
      const iat = Math.floor(this.now() / 1000);
      const unsigned = encode({ alg: 'RS256', typ: 'JWT' }) + '.' + encode({ iss: c.clientEmail,
        scope, aud: endpoint, iat, exp: iat + 3600 });
      const signature = createSign('RSA-SHA256').update(unsigned).sign(c.privateKey).toString('base64url');
      body = new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: unsigned + '.' + signature });
    }
    let response;
    try { response = await this.fetcher(endpoint, { method: 'POST', body, redirect: 'error', signal: AbortSignal.timeout(30000) }); }
    catch { throw Error('DRIVE_TOKEN_NETWORK_FAILED'); }
    const data = await response.json().catch(() => ({}));
    if (data.error === 'invalid_grant') { this.cached = undefined; throw Error('DRIVE_REAUTH_REQUIRED'); }
    if (!response.ok || typeof data.access_token !== 'string' || !Number.isFinite(Number(data.expires_in)))
      throw Error('DRIVE_TOKEN_FAILED');
    if (data.scope && data.scope.split(' ').some(value => value !== scope)) throw Error('DRIVE_TOKEN_SCOPE_INVALID');
    this.cached = { value: data.access_token, until: this.now() + Number(data.expires_in) * 1000 };
    return this.cached.value;
  }
}
