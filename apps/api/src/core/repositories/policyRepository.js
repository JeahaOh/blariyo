class PolicyRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async findCurrent(policyType) {
    const result = await this.pool.query(
      `SELECT policy_type, version_label, title, body_html, effective_at, ended_at
       FROM legal.policy_version
       WHERE policy_type = $1
         AND status = 'EFFECTIVE'
         AND effective_at <= CURRENT_TIMESTAMP
       ORDER BY effective_at DESC, id DESC
       LIMIT 1`,
      [policyType]
    );
    return result.rows[0] || null;
  }

  async findPublicVersion(policyType, versionLabel) {
    const result = await this.pool.query(
      `SELECT policy_type, version_label, title, body_html, effective_at, ended_at
       FROM legal.policy_version
       WHERE policy_type = $1
         AND version_label = $2
         AND status IN ('EFFECTIVE', 'RETIRED')
         AND effective_at <= CURRENT_TIMESTAMP
       LIMIT 1`,
      [policyType, versionLabel]
    );
    return result.rows[0] || null;
  }

  async findPublicHistory(policyType) {
    const result = await this.pool.query(
      `SELECT version_label, effective_at, ended_at
       FROM legal.policy_version
       WHERE policy_type = $1
         AND status IN ('EFFECTIVE', 'RETIRED')
         AND effective_at <= CURRENT_TIMESTAMP
       ORDER BY effective_at DESC, id DESC`,
      [policyType]
    );
    return result.rows;
  }
}

module.exports = PolicyRepository;
