const AppError = require('../errors/appError');

const POLICY_TYPES = Object.freeze({ terms: 'TERMS', privacy: 'PRIVACY' });
const VERSION_PATTERN = /^v[0-9]+(?:\.[0-9]+)*$/;

function toIsoString(value) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

class PublicPolicyService {
  constructor({ policyRepository }) {
    this.policyRepository = policyRepository;
  }

  async getPolicy(rawType, rawVersion) {
    const policyType = POLICY_TYPES[rawType];
    const version = rawVersion === undefined ? null : rawVersion;
    if (
      !policyType
      || (version !== null
        && (typeof version !== 'string' || version.length > 20 || !VERSION_PATTERN.test(version)))
    ) {
      throw new AppError(404, 'POLICY_NOT_FOUND', '정책을 찾을 수 없습니다.');
    }

    const [policy, history] = await Promise.all([
      version === null
        ? this.policyRepository.findCurrent(policyType)
        : this.policyRepository.findPublicVersion(policyType, version),
      this.policyRepository.findPublicHistory(policyType),
    ]);
    if (!policy) throw new AppError(404, 'POLICY_NOT_FOUND', '정책을 찾을 수 없습니다.');

    return {
      policy: {
        type: rawType,
        version: policy.version_label,
        title: policy.title,
        bodyHtml: policy.body_html,
        effectiveAt: toIsoString(policy.effective_at),
        endedAt: policy.ended_at === null ? null : toIsoString(policy.ended_at),
      },
      history: history.map((item) => ({
        version: item.version_label,
        effectiveAt: toIsoString(item.effective_at),
        endedAt: item.ended_at === null ? null : toIsoString(item.ended_at),
      })),
    };
  }
}

module.exports = PublicPolicyService;
