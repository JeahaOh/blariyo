import type { NitroErrorHandler } from 'nitropack/types';
import { send, setResponseHeaders, setResponseStatus } from 'h3';

const errorHandler: NitroErrorHandler = async (error, event, { defaultHandler }) => {
  if (event.handled) return;
  const response = await defaultHandler(error, event, { json: true });
  // Preserve Nitro's error sanitization, body, status and security headers.
  if (response.status >= 400 && response.status < 600)
    response.headers['cache-control'] = 'no-store';
  setResponseHeaders(event, response.headers);
  setResponseStatus(event, response.status, response.statusText);
  return send(event, JSON.stringify(response.body, null, 2));
};

export default errorHandler;
