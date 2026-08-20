const crypto = require('crypto');
const AppError = require('../errors/appError');

const ADMIN_ACTOR_PATTERN = /^admin:v[1-9][0-9]*:[A-Za-z0-9_-]{43}$/;

function digest(value) {
  return crypto.createHash('sha256').update(value).digest();
}

function createInternalAdminAuth({ coreServiceToken }) {
  if (typeof coreServiceToken !== 'string' || Buffer.byteLength(coreServiceToken) < 32) {
    throw new Error('CORE_SERVICE_TOKEN must be at least 32 bytes');
  }
  const expectedDigest = digest(coreServiceToken);

  return function internalAdminAuth(req, res, next) {
    const providedToken = req.get('X-Blariyo-Service-Token');
    const authenticated = typeof providedToken === 'string'
      && crypto.timingSafeEqual(digest(providedToken), expectedDigest);
    if (!authenticated) {
      return next(new AppError(
        401,
        'CORE_SERVICE_AUTH_REQUIRED',
        '내부 서비스 인증이 필요합니다.'
      ));
    }

    const adminActor = req.get('X-Blariyo-Admin-Actor');
    if (typeof adminActor !== 'string' || !ADMIN_ACTOR_PATTERN.test(adminActor)) {
      return next(new AppError(
        401,
        'ADMIN_CONTEXT_REQUIRED',
        '관리자 인증 문맥이 필요합니다.'
      ));
    }
    req.adminActor = adminActor;
    return next();
  };
}

module.exports = createInternalAdminAuth;
