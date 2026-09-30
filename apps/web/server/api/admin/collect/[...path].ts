import { proxyCoreRequest } from '../../v1/[...path]';
/** Explicit D02 BFF mapping, with the same verified identity, CSRF and header allowlist. */
export default defineEventHandler(event => proxyCoreRequest(event, true));
