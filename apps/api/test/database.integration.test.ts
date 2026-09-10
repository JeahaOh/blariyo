import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import { migrationContext } from '../dist/commands/migrate.js';
import { MigrationsService } from '../dist/commands/migrations.service.js';
import { rows, requiredRow, decimalId } from '../dist/persistence/rows.js';
import type { DataSource } from 'typeorm';
import {
  ContentBoardPostBlockEntity,
  ContentBoardPostEntity,
} from '../dist/persistence/entities.js';
import {
  createDataSource,
  DatabaseContext,
  TypeOrmUnitOfWork,
} from '../dist/persistence/database.js';
import { TypeOrmPublicRepository } from '../dist/persistence/public.repository.js';
const url = process.env.TEST_NEST_DATABASE_URL;
if (!url) throw new Error('TEST_NEST_DATABASE_URL required');
async function catalog(db: DataSource) {
  return rows(
    await db.query(`SELECT 'column' kind, table_schema s, table_name t, column_name n,
    concat_ws('|',udt_name,is_nullable,column_default,character_maximum_length,datetime_precision,is_identity,identity_generation) def
    FROM information_schema.columns WHERE table_schema IN ('content','legal','ops','collect')
    UNION ALL SELECT 'constraint',n.nspname,c.relname,con.conname,pg_get_constraintdef(con.oid)
    FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname IN ('content','legal','ops','collect')
    UNION ALL SELECT 'index',schemaname,tablename,indexname,indexdef FROM pg_indexes
    WHERE schemaname IN ('content','legal','ops','collect') ORDER BY 1,2,3,4`)
  );
}
await test('TypeORM maps all SQL columns without changing schema and coordinates real transactions and locks', async (t) => {
  const pg = await createDataSource(url).initialize();
  t.after(() => pg.destroy());
  const migration = await migrationContext(url);
  try {
    await migration.get(MigrationsService).migrate();
  } finally {
    await migration.close();
  }
  const before = await catalog(pg);
  const source = await createDataSource(url).initialize();
  const second = await createDataSource(url).initialize();
  t.after(async () => {
    await source.destroy();
    await second.destroy();
  });
  assert.equal(source.options.synchronize, false);
  assert.equal(source.options.migrationsRun, false);
  const columns = before.filter((row) => row.kind === 'column');
  assert.equal(source.entityMetadatas.length, 17);
  assert.equal(
    source.entityMetadatas.reduce((n, m) => n + m.columns.length, 0),
    columns.length
  );
  for (const row of columns) {
    assert.equal(typeof row.s, 'string');
    assert.equal(typeof row.t, 'string');
    const tablePath = String(row.s) + '.' + String(row.t);
    const table = source.entityMetadatas.find((m) => m.tablePath === tablePath);
    assert.ok(table, tablePath);
    assert.ok(
      table.columns.some((c) => c.databaseName === row.n),
      String(row.n)
    );
  }
  for (const table of source.entityMetadatas)
    for (const column of table.columns.filter((c) => c.isGenerated))
      assert.equal(column.generationStrategy, 'identity');
  const foreignKeys = rows(
    await pg.query(`
    SELECT concat(n.nspname, '.', c.relname) AS source,
      string_agg(a.attname, ',' ORDER BY k.position) AS columns,
      concat(rn.nspname, '.', rc.relname) AS target,
      string_agg(ra.attname, ',' ORDER BY k.position) AS references,
      bool_or(NOT a.attnotnull) AS nullable,
      CASE con.confdeltype WHEN 'a' THEN 'NO ACTION' WHEN 'r' THEN 'RESTRICT' WHEN 'n' THEN 'SET NULL' ELSE con.confdeltype::text END AS delete_action,
      CASE con.confupdtype WHEN 'a' THEN 'NO ACTION' WHEN 'r' THEN 'RESTRICT' WHEN 'n' THEN 'SET NULL' ELSE con.confupdtype::text END AS update_action
    FROM pg_constraint con
    JOIN pg_class c ON c.oid=con.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    JOIN pg_class rc ON rc.oid=con.confrelid JOIN pg_namespace rn ON rn.oid=rc.relnamespace
    CROSS JOIN LATERAL unnest(con.conkey, con.confkey) WITH ORDINALITY AS k(local_key, remote_key, position)
    JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum=k.local_key
    JOIN pg_attribute ra ON ra.attrelid=rc.oid AND ra.attnum=k.remote_key
    WHERE con.contype='f' AND n.nspname IN ('content','legal','ops','collect')
    GROUP BY con.oid,n.nspname,c.relname,rn.nspname,rc.relname`)
  );
  const mapped = [];
  for (const table of source.entityMetadatas) {
    for (const relation of table.relations) {
      assert.equal(relation.isEager, false);
      assert.equal(relation.isLazy, false);
      assert.equal(relation.isCascadeInsert, false);
      assert.equal(relation.isCascadeUpdate, false);
      assert.equal(relation.isCascadeRemove, false);
      assert.equal(relation.persistenceEnabled, false);
      assert.equal(relation.createForeignKeyConstraints, false);
      mapped.push({
        source: table.tablePath,
        columns: relation.joinColumns.map((column) => column.databaseName).join(','),
        target: relation.inverseEntityMetadata.tablePath,
        references: relation.joinColumns
          .map((column) => {
            assert.ok(column.referencedColumn);
            return column.referencedColumn.databaseName;
          })
          .join(','),
        nullable: relation.isNullable,
        delete_action: relation.onDelete,
        update_action: relation.onUpdate,
      });
      // Execute every relation against PostgreSQL, not only TypeORM metadata.
      await source
        .getRepository(table.target)
        .createQueryBuilder('base')
        .leftJoinAndSelect('base.' + relation.propertyPath, 'linked')
        .getMany();
    }
  }
  assert.equal(foreignKeys.length, 15);
  assert.equal(mapped.length, foreignKeys.length);
  assert.deepEqual(
    mapped.map((row) => JSON.stringify(row)).sort(),
    foreignKeys.map((row) => JSON.stringify(row)).sort()
  );
  const postId = decimalId(
    requiredRow(
      await pg.query(`INSERT INTO content.board_post
    (board_id,title,status,created_by,created_at,updated_by,updated_at)
    SELECT id,'relation fixture','DRAFT','system:migration',now(),'system:migration',now()
    FROM content.board WHERE slug='meme' RETURNING id`)
    ).id
  );
  const imageId = decimalId(
    requiredRow(
      await pg.query(
        `INSERT INTO content.board_post_image
    (post_id,private_storage_key,status,content_sha256,mime_type,byte_size,width,height,created_by,created_at,updated_by,updated_at)
    VALUES ($1,'fixture/relation.png','STAGED',decode(repeat('01',32),'hex'),'image/png',1,1,1,'system:migration',now(),'system:migration',now()) RETURNING id`,
        [postId]
      )
    ).id
  );
  await pg.query(
    `INSERT INTO content.board_post_block
    (post_id,position,type,text_content,image_id,alt_text,created_by,created_at,updated_by,updated_at)
    VALUES ($1,1,'TEXT','fixture',NULL,NULL,'system:migration',now(),'system:migration',now()),
           ($1,2,'IMAGE',NULL,$2,'fixture','system:migration',now(),'system:migration',now())`,
    [postId, imageId]
  );
  const blocks = await source
    .getRepository(ContentBoardPostBlockEntity)
    .createQueryBuilder('block')
    .leftJoinAndSelect('block.post', 'post')
    .leftJoinAndSelect('block.image', 'image')
    .where('block.post_id = :postId', { postId })
    .orderBy('block.position', 'ASC')
    .getMany();
  assert.equal(blocks.length, 2);
  assert.equal(blocks[0]?.post?.id, postId);
  assert.equal(blocks[0]?.image, null);
  assert.equal(blocks[1]?.post?.id, postId);
  assert.equal(blocks[1]?.image?.id, imageId);
  assert.equal(blocks[1]?.image?.post_id, postId);
  const plain = await source.getRepository(ContentBoardPostEntity).findOneByOrFail({ id: postId });
  assert.equal(plain.board, undefined, 'Relations must not load implicitly');
  const db = new DatabaseContext(source),
    work = new TypeOrmUnitOfWork(db);
  const repo = new TypeOrmPublicRepository(db);
  const otherWork = new TypeOrmUnitOfWork(new DatabaseContext(second));
  const [board] = await repo.activeBoards();
  assert.ok(board);
  await assert.rejects(
    work.transaction(async () => {
      await db.manager.query("UPDATE content.board SET display_name='rollback' WHERE id=$1", [
        board.id,
      ]);
      assert.equal((await repo.activeBoard('meme'))?.displayName, 'rollback');
      await work.transaction(async () => {
        await db.manager.query("UPDATE content.board SET display_name='nested' WHERE id=$1", [
          board.id,
        ]);
      });
      throw new Error('rollback expected');
    }),
    /rollback expected/
  );
  assert.equal((await repo.activeBoard('meme'))?.displayName, board.displayName);
  await work.transaction(
    async () => {
      assert.equal((await repo.activeBoard('meme'))?.displayName, board.displayName);
      await second.query("UPDATE content.board SET display_name='concurrent' WHERE id=$1", [
        board.id,
      ]);
      assert.equal((await repo.activeBoard('meme'))?.displayName, board.displayName);
      await assert.rejects(
        db.manager.query("UPDATE content.board SET display_name='forbidden' WHERE id=$1", [
          board.id,
        ]),
        { code: '25006' }
      );
    },
    { isolation: 'REPEATABLE READ', readOnly: true }
  );
  await second.query('UPDATE content.board SET display_name=$2 WHERE id=$1', [
    board.id,
    board.displayName,
  ]);
  await work.lock('integration:test', async () => {
    await assert.rejects(
      otherWork.lock('integration:test', async () => {}, false),
      { code: 'IDEMPOTENCY_IN_PROGRESS' }
    );
    await work.transaction(async () => {
      await assert.rejects(
        otherWork.lock('integration:test', async () => {}, false),
        { code: 'IDEMPOTENCY_IN_PROGRESS' }
      );
    });
  });
  assert.equal(await otherWork.lock('integration:test', async () => 'released', false), 'released');
  assert.deepEqual(await catalog(pg), before);
});
