function createHealthController(pool, expectedMigrationVersion = 2) {
  return {
    live(req, res) {
      res.setHeader('Cache-Control', 'no-store');
      res.json({ status: 'UP' });
    },

    async ready(req, res) {
      try {
        const result = await pool.query(`
          SELECT
            1 AS database_ready,
            COALESCE((SELECT MAX(version) FROM ops.schema_migration), 0) AS migration_version
        `);
        const migrationVersion = Number(result.rows[0].migration_version);
        if (migrationVersion !== expectedMigrationVersion) throw new Error('migration mismatch');
        res.setHeader('Cache-Control', 'no-store');
        res.json({ status: 'READY' });
      } catch (error) {
        res.setHeader('Cache-Control', 'no-store');
        res.status(503).json({ status: 'NOT_READY' });
      }
    },
  };
}

module.exports = createHealthController;
