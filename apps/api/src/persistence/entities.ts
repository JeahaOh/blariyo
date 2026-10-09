import {
  Entity,
  Column,
  PrimaryColumn,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  type Relation,
} from 'typeorm';
// Existing SQL migrations own all DDL. These classes are hydrated by TypeORM.
// Definite assignment is limited to ORM-managed entity columns. Never synchronize.
@Entity({ schema: 'collect', name: 'candidate', synchronize: false })
export class CollectCandidateEntity {
  @Column({ type: 'jsonb', nullable: true })
  content_blocks!:
    import('../features/collection/collection.model.js').CollectionContentBlock[] | null;
  @PrimaryGeneratedColumn('identity', { type: 'bigint', generatedIdentity: 'BY DEFAULT' })
  id!: string;
  @Column({ type: 'bigint' })
  source_id!: string;
  @Column({ type: 'varchar', length: 2048 })
  origin_url!: string;
  @Column({ type: 'bytea' })
  origin_url_sha256!: Buffer;
  @Column({ type: 'varchar', length: 200, nullable: true })
  source_post_key!: string | null;
  @Column({ type: 'varchar', nullable: true, length: 300 })
  title!: string | null;
  @Column({ type: 'timestamptz', nullable: true, precision: 3 })
  source_published_at!: Date | null;
  @Column({ type: 'varchar', nullable: true, length: 100 })
  parser_version!: string | null;
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  warnings!: unknown;
  @Column({ type: 'varchar', length: 16 })
  status!: string;
  @Column({ type: 'varchar', length: 16, default: () => "'MANUAL_URL'::character varying" })
  discovery_mode!: string;
  @Column({ type: 'bigint', nullable: true })
  duplicate_post_id!: string | null;
  @Column({ type: 'bigint', nullable: true })
  post_id!: string | null;
  @Column({ type: 'varchar', nullable: true, length: 30 })
  reject_reason_code!: string | null;
  @Column({ type: 'varchar', nullable: true, length: 50 })
  fetch_error_code!: string | null;
  @Column({ type: 'varchar', nullable: true, length: 100 })
  collector_id!: string | null;
  @Column({ type: 'timestamptz', precision: 3, default: () => 'now()' })
  requested_at!: Date;
  @Column({ type: 'timestamptz', nullable: true, precision: 3 })
  claimed_at!: Date | null;
  @Column({ type: 'timestamptz', nullable: true, precision: 3 })
  lease_until!: Date | null;
  @Column({ type: 'timestamptz', nullable: true, precision: 3 })
  fetched_at!: Date | null;
  @Column({ type: 'timestamptz', nullable: true, precision: 3 })
  reviewed_at!: Date | null;
  @Column({ type: 'integer', default: () => '0' })
  attempt_count!: number;
  @Column({ type: 'integer', default: () => '1' })
  lock_version!: number;
  @Column({ type: 'varchar', length: 100 })
  created_by!: string;
  @Column({ type: 'timestamptz', precision: 3, default: () => 'now()' })
  created_at!: Date;
  @Column({ type: 'varchar', length: 100 })
  updated_by!: string;
  @Column({ type: 'timestamptz', precision: 3, default: () => 'now()' })
  updated_at!: Date;
  @Column({ type: 'uuid', nullable: true })
  collector_execution_id!: string | null;
  @Column({ type: 'timestamptz', nullable: true, precision: 3 })
  last_heartbeat_at!: Date | null;
  @Column({ type: 'bytea', nullable: true })
  result_payload_sha256!: Buffer | null;
  // Loaded only by an explicit relation query; DDL and writes remain owned by SQL/Repositories.
  @ManyToOne(() => CollectSourceEntity, {
    nullable: false,
    onDelete: 'NO ACTION',
    onUpdate: 'NO ACTION',
    cascade: false,
    eager: false,
    lazy: false,
    persistence: false,
    createForeignKeyConstraints: false,
    orphanedRowAction: 'disable',
  })
  @JoinColumn([{ name: 'source_id', referencedColumnName: 'id' }])
  source?: Relation<CollectSourceEntity>;
  @ManyToOne(() => ContentBoardPostEntity, {
    nullable: true,
    onDelete: 'NO ACTION',
    onUpdate: 'NO ACTION',
    cascade: false,
    eager: false,
    lazy: false,
    persistence: false,
    createForeignKeyConstraints: false,
    orphanedRowAction: 'disable',
  })
  @JoinColumn([{ name: 'duplicate_post_id', referencedColumnName: 'id' }])
  duplicatePost?: Relation<ContentBoardPostEntity> | null;
  @ManyToOne(() => ContentBoardPostEntity, {
    nullable: true,
    onDelete: 'NO ACTION',
    onUpdate: 'NO ACTION',
    cascade: false,
    eager: false,
    lazy: false,
    persistence: false,
    createForeignKeyConstraints: false,
    orphanedRowAction: 'disable',
  })
  @JoinColumn([{ name: 'post_id', referencedColumnName: 'id' }])
  approvedPost?: Relation<ContentBoardPostEntity> | null;
}
export type CollectCandidateRow = CollectCandidateEntity;
@Entity({ schema: 'collect', name: 'candidate_image', synchronize: false })
export class CollectCandidateImageEntity {
  @PrimaryGeneratedColumn('identity', { type: 'bigint', generatedIdentity: 'BY DEFAULT' })
  id!: string;
  @Column({ type: 'bigint' })
  candidate_id!: string;
  @Column({ type: 'smallint' })
  position!: number;
  @Column({ type: 'varchar', length: 2048 })
  remote_url!: string;
  @Column({ type: 'varchar', nullable: true, length: 500 })
  preview_storage_key!: string | null;
  @Column({ type: 'timestamptz', nullable: true, precision: 3 })
  preview_expires_at!: Date | null;
  @Column({ type: 'bigint', nullable: true })
  image_id!: string | null;
  @Column({ type: 'varchar', length: 16, default: () => "'DISCOVERED'::character varying" })
  status!: string;
  @Column({ type: 'varchar', nullable: true, length: 50 })
  fetch_error_code!: string | null;
  @Column({ type: 'varchar', length: 100 })
  created_by!: string;
  @Column({ type: 'timestamptz', precision: 3, default: () => 'now()' })
  created_at!: Date;
  @Column({ type: 'varchar', length: 100 })
  updated_by!: string;
  @Column({ type: 'timestamptz', precision: 3, default: () => 'now()' })
  updated_at!: Date;
  @Column({ type: 'bytea', nullable: true })
  preview_source_sha256!: Buffer | null;
  @Column({ type: 'timestamptz', nullable: true, precision: 3 })
  preview_uploaded_at!: Date | null;
  // Loaded only by an explicit relation query; DDL and writes remain owned by SQL/Repositories.
  @ManyToOne(() => CollectCandidateEntity, {
    nullable: false,
    onDelete: 'NO ACTION',
    onUpdate: 'NO ACTION',
    cascade: false,
    eager: false,
    lazy: false,
    persistence: false,
    createForeignKeyConstraints: false,
    orphanedRowAction: 'disable',
  })
  @JoinColumn([{ name: 'candidate_id', referencedColumnName: 'id' }])
  candidate?: Relation<CollectCandidateEntity>;
  @ManyToOne(() => ContentBoardPostImageEntity, {
    nullable: true,
    onDelete: 'NO ACTION',
    onUpdate: 'NO ACTION',
    cascade: false,
    eager: false,
    lazy: false,
    persistence: false,
    createForeignKeyConstraints: false,
    orphanedRowAction: 'disable',
  })
  @JoinColumn([{ name: 'image_id', referencedColumnName: 'id' }])
  image?: Relation<ContentBoardPostImageEntity> | null;
}
export type CollectCandidateImageRow = CollectCandidateImageEntity;
@Entity({ schema: 'collect', name: 'collector_operational_event', synchronize: false })
export class CollectCollectorOperationalEventEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;
  @Column({ type: 'varchar', length: 100 })
  collector_id!: string;
  @Column({ type: 'uuid' })
  delivery_id!: string;
  @Column({ type: 'bigint', nullable: true })
  candidate_id!: string | null;
  @Column({ type: 'uuid', nullable: true })
  job_request_id!: string | null;
  @Column({ type: 'varchar', length: 40 })
  event_code!: string;
  @Column({ type: 'varchar', length: 5 })
  severity!: string;
  @Column({ type: 'varchar', length: 16, default: () => "'UNACKNOWLEDGED'::character varying" })
  delivery_status!: string;
  @Column({ type: 'integer' })
  attempt_count!: number;
  @Column({ type: 'timestamptz', precision: 3 })
  occurred_at!: Date;
  @Column({ type: 'timestamptz', precision: 3, default: () => 'now()' })
  created_at!: Date;
  @Column({ type: 'timestamptz', nullable: true, precision: 3 })
  last_attempted_at!: Date | null;
  @Column({ type: 'timestamptz', nullable: true, precision: 3 })
  acknowledged_at!: Date | null;
  @Column({ type: 'bytea' })
  request_hash!: Buffer;
  // Loaded only by an explicit relation query; DDL and writes remain owned by SQL/Repositories.
  @ManyToOne(() => CollectCandidateEntity, {
    nullable: true,
    onDelete: 'SET NULL',
    onUpdate: 'NO ACTION',
    cascade: false,
    eager: false,
    lazy: false,
    persistence: false,
    createForeignKeyConstraints: false,
    orphanedRowAction: 'disable',
  })
  @JoinColumn([{ name: 'candidate_id', referencedColumnName: 'id' }])
  candidate?: Relation<CollectCandidateEntity> | null;
}
export type CollectCollectorOperationalEventRow = CollectCollectorOperationalEventEntity;
@Entity({ schema: 'collect', name: 'collector_receipt', synchronize: false })
export class CollectCollectorReceiptEntity {
  @PrimaryColumn({ type: 'varchar', length: 100 })
  collector_id!: string;
  @PrimaryColumn({ type: 'varchar', length: 200 })
  operation!: string;
  @PrimaryColumn({ type: 'bytea' })
  key_hash!: Buffer;
  @Column({ type: 'bytea' })
  request_hash!: Buffer;
  @Column({ type: 'integer' })
  response_status!: number;
  @Column({ type: 'jsonb' })
  response_body!: unknown;
  @Column({ type: 'timestamptz', precision: 3, default: () => 'now()' })
  created_at!: Date;
  @Column({ type: 'timestamptz', precision: 3, default: () => "(now() + '7 days'::interval)" })
  expires_at!: Date;
}
export type CollectCollectorReceiptRow = CollectCollectorReceiptEntity;
@Entity({ schema: 'collect', name: 'source', synchronize: false })
export class CollectSourceEntity {
  @PrimaryGeneratedColumn('identity', { type: 'bigint', generatedIdentity: 'BY DEFAULT' })
  id!: string;
  @Column({ type: 'varchar', length: 50 })
  name!: string;
  @Column({ type: 'varchar', length: 2048 })
  base_url!: string;
  @Column({ type: 'varchar', length: 255 })
  host!: string;
  @Column({ type: 'varchar', length: 16, default: () => "'URL_ONLY'::character varying" })
  fetch_mode!: string;
  @Column({ type: 'varchar', nullable: true, length: 2048 })
  list_url!: string | null;
  @Column({ type: 'varchar', length: 24, default: () => "'MANUAL'::character varying" })
  parser_type!: string;
  @Column({ type: 'boolean', default: () => 'false' })
  is_active!: boolean;
  @Column({ type: 'boolean', default: () => 'false' })
  is_list_crawl_enabled!: boolean;
  @Column({ type: 'boolean', nullable: true })
  robots_allowed!: boolean | null;
  @Column({ type: 'timestamptz', nullable: true, precision: 3 })
  robots_checked_at!: Date | null;
  @Column({ type: 'integer' })
  request_interval_ms!: number;
  @Column({ type: 'integer' })
  daily_fetch_limit!: number;
  @Column({ type: 'timestamptz', nullable: true, precision: 3 })
  last_fetched_at!: Date | null;
  @Column({ type: 'varchar', nullable: true, length: 50 })
  last_error_code!: string | null;
  @Column({ type: 'integer', default: () => '0' })
  consecutive_error_count!: number;
  @Column({ type: 'varchar', nullable: true, length: 30 })
  disabled_reason_code!: string | null;
  @Column({ type: 'integer', default: () => '1' })
  lock_version!: number;
  @Column({ type: 'varchar', length: 100 })
  created_by!: string;
  @Column({ type: 'timestamptz', precision: 3, default: () => 'now()' })
  created_at!: Date;
  @Column({ type: 'varchar', length: 100 })
  updated_by!: string;
  @Column({ type: 'timestamptz', precision: 3, default: () => 'now()' })
  updated_at!: Date;
  @Column({ type: 'timestamptz', nullable: true, precision: 3 })
  next_request_at!: Date | null;
}
export type CollectSourceRow = CollectSourceEntity;
@Entity({ schema: 'collect', name: 'source_request_budget', synchronize: false })
export class CollectSourceRequestBudgetEntity {
  @PrimaryColumn({ type: 'bigint' })
  source_id!: string;
  @PrimaryColumn({ type: 'date' })
  budget_date!: string;
  @Column({ type: 'integer', default: () => '0' })
  reserved_count!: number;
  @Column({ type: 'integer', default: () => '1' })
  lock_version!: number;
  // Loaded only by an explicit relation query; DDL and writes remain owned by SQL/Repositories.
  @ManyToOne(() => CollectSourceEntity, {
    nullable: false,
    onDelete: 'NO ACTION',
    onUpdate: 'NO ACTION',
    cascade: false,
    eager: false,
    lazy: false,
    persistence: false,
    createForeignKeyConstraints: false,
    orphanedRowAction: 'disable',
  })
  @JoinColumn([{ name: 'source_id', referencedColumnName: 'id' }])
  source?: Relation<CollectSourceEntity>;
}
export type CollectSourceRequestBudgetRow = CollectSourceRequestBudgetEntity;
@Entity({ schema: 'collect', name: 'source_request_reservation', synchronize: false })
export class CollectSourceRequestReservationEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;
  @Column({ type: 'bigint' })
  source_id!: string;
  @Column({ type: 'bigint', nullable: true })
  candidate_id!: string | null;
  @Column({ type: 'varchar', length: 100 })
  collector_id!: string;
  @Column({ type: 'uuid' })
  collector_execution_id!: string;
  @Column({ type: 'uuid' })
  job_request_id!: string;
  @Column({ type: 'bytea' })
  request_key_hash!: Buffer;
  @Column({ type: 'bytea' })
  request_hash!: Buffer;
  @Column({ type: 'varchar', length: 10 })
  request_kind!: string;
  @Column({ type: 'date' })
  budget_date!: string;
  @Column({ type: 'timestamptz', precision: 3 })
  reserved_at!: Date;
  @Column({ type: 'timestamptz', precision: 3 })
  valid_until!: Date;
  @Column({ type: 'timestamptz', precision: 3 })
  next_allowed_at!: Date;
  @Column({ type: 'integer' })
  reserved_count!: number;
  @Column({ type: 'integer' })
  remaining_count!: number;
  @Column({ type: 'varchar', length: 10, default: () => "'ISSUED'::character varying" })
  status!: string;
  // Loaded only by an explicit relation query; DDL and writes remain owned by SQL/Repositories.
  @ManyToOne(() => CollectSourceEntity, {
    nullable: false,
    onDelete: 'NO ACTION',
    onUpdate: 'NO ACTION',
    cascade: false,
    eager: false,
    lazy: false,
    persistence: false,
    createForeignKeyConstraints: false,
    orphanedRowAction: 'disable',
  })
  @JoinColumn([{ name: 'source_id', referencedColumnName: 'id' }])
  source?: Relation<CollectSourceEntity>;
  @ManyToOne(() => CollectCandidateEntity, {
    nullable: true,
    onDelete: 'SET NULL',
    onUpdate: 'NO ACTION',
    cascade: false,
    eager: false,
    lazy: false,
    persistence: false,
    createForeignKeyConstraints: false,
    orphanedRowAction: 'disable',
  })
  @JoinColumn([{ name: 'candidate_id', referencedColumnName: 'id' }])
  candidate?: Relation<CollectCandidateEntity> | null;
}
export type CollectSourceRequestReservationRow = CollectSourceRequestReservationEntity;
@Entity({ schema: 'content', name: 'board', synchronize: false })
export class ContentBoardEntity {
  @PrimaryGeneratedColumn('identity', { type: 'bigint', generatedIdentity: 'BY DEFAULT' })
  id!: string;
  @Column({ type: 'varchar', length: 32 })
  slug!: string;
  @Column({ type: 'varchar', length: 50 })
  display_name!: string;
  @Column({ type: 'boolean' })
  is_active!: boolean;
  @Column({ type: 'varchar', length: 16 })
  posting_policy!: string;
  @Column({ type: 'smallint' })
  display_order!: number;
  @Column({ type: 'varchar', length: 100 })
  created_by!: string;
  @Column({ type: 'timestamptz', precision: 3 })
  created_at!: Date;
  @Column({ type: 'varchar', length: 100 })
  updated_by!: string;
  @Column({ type: 'timestamptz', precision: 3 })
  updated_at!: Date;
}
export type ContentBoardRow = ContentBoardEntity;
@Entity({ schema: 'content', name: 'board_post', synchronize: false })
export class ContentBoardPostEntity {
  @PrimaryGeneratedColumn('identity', { type: 'bigint', generatedIdentity: 'BY DEFAULT' })
  id!: string;
  @Column({ type: 'bigint' })
  board_id!: string;
  @Column({ type: 'varchar', length: 200 })
  title!: string;
  @Column({ type: 'varchar', nullable: true, length: 200 })
  source_name!: string | null;
  @Column({ type: 'varchar', nullable: true, length: 2048 })
  source_url!: string | null;
  @Column({ type: 'varchar', length: 20 })
  status!: string;
  @Column({ type: 'smallint', nullable: true })
  pinned_position!: number | null;
  @Column({ type: 'timestamptz', nullable: true, precision: 3 })
  scheduled_at!: Date | null;
  @Column({ type: 'timestamptz', nullable: true, precision: 3 })
  published_at!: Date | null;
  @Column({ type: 'bigint', default: () => '0' })
  view_count!: string;
  @Column({ type: 'integer', default: () => '1' })
  lock_version!: number;
  @Column({ type: 'varchar', length: 100 })
  created_by!: string;
  @Column({ type: 'timestamptz', precision: 3 })
  created_at!: Date;
  @Column({ type: 'varchar', length: 100 })
  updated_by!: string;
  @Column({ type: 'timestamptz', precision: 3 })
  updated_at!: Date;
  // Loaded only by an explicit relation query; DDL and writes remain owned by SQL/Repositories.
  @ManyToOne(() => ContentBoardEntity, {
    nullable: false,
    onDelete: 'RESTRICT',
    onUpdate: 'RESTRICT',
    cascade: false,
    eager: false,
    lazy: false,
    persistence: false,
    createForeignKeyConstraints: false,
    orphanedRowAction: 'disable',
  })
  @JoinColumn([{ name: 'board_id', referencedColumnName: 'id' }])
  board?: Relation<ContentBoardEntity>;
}
export type ContentBoardPostRow = ContentBoardPostEntity;
@Entity({ schema: 'content', name: 'board_post_block', synchronize: false })
export class ContentBoardPostBlockEntity {
  @PrimaryGeneratedColumn('identity', { type: 'bigint', generatedIdentity: 'BY DEFAULT' })
  id!: string;
  @Column({ type: 'bigint' })
  post_id!: string;
  @Column({ type: 'smallint' })
  position!: number;
  @Column({ type: 'varchar', length: 16 })
  type!: string;
  @Column({ type: 'text', nullable: true })
  text_content!: string | null;
  @Column({ type: 'bigint', nullable: true })
  image_id!: string | null;
  @Column({ type: 'varchar', nullable: true, length: 300 })
  alt_text!: string | null;
  @Column({ type: 'varchar', length: 100 })
  created_by!: string;
  @Column({ type: 'timestamptz', precision: 3 })
  created_at!: Date;
  @Column({ type: 'varchar', length: 100 })
  updated_by!: string;
  @Column({ type: 'timestamptz', precision: 3 })
  updated_at!: Date;
  // Loaded only by an explicit relation query; DDL and writes remain owned by SQL/Repositories.
  @ManyToOne(() => ContentBoardPostEntity, {
    nullable: false,
    onDelete: 'RESTRICT',
    onUpdate: 'NO ACTION',
    cascade: false,
    eager: false,
    lazy: false,
    persistence: false,
    createForeignKeyConstraints: false,
    orphanedRowAction: 'disable',
  })
  @JoinColumn([{ name: 'post_id', referencedColumnName: 'id' }])
  post?: Relation<ContentBoardPostEntity>;
  @ManyToOne(() => ContentBoardPostImageEntity, {
    nullable: true,
    onDelete: 'RESTRICT',
    onUpdate: 'NO ACTION',
    cascade: false,
    eager: false,
    lazy: false,
    persistence: false,
    createForeignKeyConstraints: false,
    orphanedRowAction: 'disable',
  })
  @JoinColumn([
    { name: 'post_id', referencedColumnName: 'post_id' },
    { name: 'image_id', referencedColumnName: 'id' },
  ])
  image?: Relation<ContentBoardPostImageEntity> | null;
}
export type ContentBoardPostBlockRow = ContentBoardPostBlockEntity;
@Entity({ schema: 'content', name: 'board_post_image', synchronize: false })
export class ContentBoardPostImageEntity {
  @Column({ type: 'timestamptz', nullable: true, precision: 3 })
  source_expires_at!: Date | null;
  @PrimaryGeneratedColumn('identity', { type: 'bigint', generatedIdentity: 'BY DEFAULT' })
  id!: string;
  @Column({ type: 'bigint', nullable: true })
  post_id!: string | null;
  @Column({ type: 'varchar', length: 512 })
  private_storage_key!: string;
  @Column({ type: 'varchar', nullable: true, length: 512 })
  public_storage_key!: string | null;
  @Column({ type: 'varchar', length: 24 })
  status!: string;
  @Column({ type: 'bytea' })
  content_sha256!: Buffer;
  @Column({ type: 'varchar', length: 50 })
  mime_type!: string;
  @Column({ type: 'integer' })
  byte_size!: number;
  @Column({ type: 'integer' })
  width!: number;
  @Column({ type: 'integer' })
  height!: number;
  @Column({ type: 'varchar', length: 100 })
  created_by!: string;
  @Column({ type: 'timestamptz', precision: 3 })
  created_at!: Date;
  @Column({ type: 'varchar', length: 100 })
  updated_by!: string;
  @Column({ type: 'timestamptz', precision: 3 })
  updated_at!: Date;
  // Loaded only by an explicit relation query; DDL and writes remain owned by SQL/Repositories.
  @ManyToOne(() => ContentBoardPostEntity, {
    nullable: true,
    onDelete: 'RESTRICT',
    onUpdate: 'NO ACTION',
    cascade: false,
    eager: false,
    lazy: false,
    persistence: false,
    createForeignKeyConstraints: false,
    orphanedRowAction: 'disable',
  })
  @JoinColumn([{ name: 'post_id', referencedColumnName: 'id' }])
  post?: Relation<ContentBoardPostEntity> | null;
}
export type ContentBoardPostImageRow = ContentBoardPostImageEntity;
@Entity({ schema: 'content', name: 'board_post_status_history', synchronize: false })
export class ContentBoardPostStatusHistoryEntity {
  @PrimaryGeneratedColumn('identity', { type: 'bigint', generatedIdentity: 'BY DEFAULT' })
  id!: string;
  @Column({ type: 'bigint' })
  post_id!: string;
  @Column({ type: 'varchar', nullable: true, length: 20 })
  from_status!: string | null;
  @Column({ type: 'varchar', length: 20 })
  to_status!: string;
  @Column({ type: 'varchar', length: 30 })
  reason_code!: string;
  @Column({ type: 'varchar', length: 16 })
  actor_type!: string;
  @Column({ type: 'varchar', length: 100 })
  created_by!: string;
  @Column({ type: 'timestamptz', precision: 3 })
  created_at!: Date;
  @Column({ type: 'varchar', length: 100 })
  updated_by!: string;
  @Column({ type: 'timestamptz', precision: 3 })
  updated_at!: Date;
  // Loaded only by an explicit relation query; DDL and writes remain owned by SQL/Repositories.
  @ManyToOne(() => ContentBoardPostEntity, {
    nullable: false,
    onDelete: 'RESTRICT',
    onUpdate: 'NO ACTION',
    cascade: false,
    eager: false,
    lazy: false,
    persistence: false,
    createForeignKeyConstraints: false,
    orphanedRowAction: 'disable',
  })
  @JoinColumn([{ name: 'post_id', referencedColumnName: 'id' }])
  post?: Relation<ContentBoardPostEntity>;
}
export type ContentBoardPostStatusHistoryRow = ContentBoardPostStatusHistoryEntity;
@Entity({ schema: 'legal', name: 'policy_version', synchronize: false })
export class LegalPolicyVersionEntity {
  @PrimaryGeneratedColumn('identity', { type: 'bigint', generatedIdentity: 'BY DEFAULT' })
  id!: string;
  @Column({ type: 'varchar', length: 20 })
  policy_type!: string;
  @Column({ type: 'varchar', length: 20 })
  version_label!: string;
  @Column({ type: 'varchar', length: 200 })
  title!: string;
  @Column({ type: 'text' })
  body_html!: string;
  @Column({ type: 'varchar', length: 20 })
  status!: string;
  @Column({ type: 'timestamptz', nullable: true, precision: 3 })
  effective_at!: Date | null;
  @Column({ type: 'timestamptz', nullable: true, precision: 3 })
  ended_at!: Date | null;
  @Column({ type: 'varchar', length: 100 })
  created_by!: string;
  @Column({ type: 'timestamptz', precision: 3 })
  created_at!: Date;
  @Column({ type: 'varchar', length: 100 })
  updated_by!: string;
  @Column({ type: 'timestamptz', precision: 3 })
  updated_at!: Date;
}
export type LegalPolicyVersionRow = LegalPolicyVersionEntity;
@Entity({ schema: 'ops', name: 'idempotency_request', synchronize: false })
export class OpsIdempotencyRequestEntity {
  @PrimaryGeneratedColumn('identity', { type: 'bigint', generatedIdentity: 'BY DEFAULT' })
  id!: string;
  @Column({ type: 'varchar', length: 120 })
  operation_scope!: string;
  @Column({ type: 'varchar', length: 128 })
  idempotency_key!: string;
  @Column({ type: 'bytea' })
  request_hash!: Buffer;
  @Column({ type: 'smallint' })
  response_status!: number;
  @Column({ type: 'jsonb' })
  response_body!: unknown;
  @Column({ type: 'varchar', length: 20 })
  resource_type!: string;
  @Column({ type: 'bigint' })
  resource_id!: string;
  @Column({ type: 'timestamptz', precision: 3 })
  expires_at!: Date;
  @Column({ type: 'varchar', length: 100 })
  created_by!: string;
  @Column({ type: 'timestamptz', precision: 3 })
  created_at!: Date;
  @Column({ type: 'varchar', length: 100 })
  updated_by!: string;
  @Column({ type: 'timestamptz', precision: 3 })
  updated_at!: Date;
}
export type OpsIdempotencyRequestRow = OpsIdempotencyRequestEntity;
@Entity({ schema: 'ops', name: 'outbox_task', synchronize: false })
export class OpsOutboxTaskEntity {
  @PrimaryGeneratedColumn('identity', { type: 'bigint', generatedIdentity: 'BY DEFAULT' })
  id!: string;
  @Column({ type: 'varchar', length: 30 })
  type!: string;
  @Column({ type: 'varchar', length: 20 })
  status!: string;
  @Column({ type: 'varchar', length: 20 })
  aggregate_type!: string;
  @Column({ type: 'bigint', nullable: true })
  aggregate_id!: string | null;
  @Column({ type: 'jsonb' })
  payload!: unknown;
  @Column({ type: 'smallint', default: () => '0' })
  attempt_count!: number;
  @Column({ type: 'timestamptz', precision: 3 })
  next_attempt_at!: Date;
  @Column({ type: 'varchar', nullable: true, length: 50 })
  last_error_code!: string | null;
  @Column({ type: 'varchar', length: 100 })
  created_by!: string;
  @Column({ type: 'timestamptz', precision: 3 })
  created_at!: Date;
  @Column({ type: 'varchar', length: 100 })
  updated_by!: string;
  @Column({ type: 'timestamptz', precision: 3 })
  updated_at!: Date;
}
export type OpsOutboxTaskRow = OpsOutboxTaskEntity;
@Entity({ schema: 'ops', name: 'schedule_failure_alert', synchronize: false })
export class OpsScheduleFailureAlertEntity {
  @PrimaryColumn({ type: 'bigint' })
  post_id!: string;
  @PrimaryColumn({ type: 'timestamptz', precision: 3 })
  scheduled_at!: Date;
  @PrimaryColumn({ type: 'varchar', length: 80 })
  error_code!: string;
  @Column({ type: 'integer' })
  attempt_count!: number;
  @Column({ type: 'timestamptz', precision: 3 })
  first_attempt_at!: Date;
  @Column({ type: 'timestamptz', precision: 3 })
  last_attempt_at!: Date;
  @Column({ type: 'integer', default: () => '0' })
  notified_count!: number;
  @Column({ type: 'timestamptz', nullable: true, precision: 3 })
  notified_at!: Date | null;
  @Column({ type: 'varchar', length: 100, default: () => "'system:scheduler'::character varying" })
  created_by!: string;
  @Column({ type: 'timestamptz', precision: 3, default: () => 'now()' })
  created_at!: Date;
  @Column({ type: 'varchar', length: 100, default: () => "'system:scheduler'::character varying" })
  updated_by!: string;
  @Column({ type: 'timestamptz', precision: 3, default: () => 'now()' })
  updated_at!: Date;
  // Loaded only by an explicit relation query; DDL and writes remain owned by SQL/Repositories.
  @ManyToOne(() => ContentBoardPostEntity, {
    nullable: false,
    onDelete: 'NO ACTION',
    onUpdate: 'NO ACTION',
    cascade: false,
    eager: false,
    lazy: false,
    persistence: false,
    createForeignKeyConstraints: false,
    orphanedRowAction: 'disable',
  })
  @JoinColumn([{ name: 'post_id', referencedColumnName: 'id' }])
  post?: Relation<ContentBoardPostEntity>;
}
export type OpsScheduleFailureAlertRow = OpsScheduleFailureAlertEntity;
@Entity({ schema: 'ops', name: 'schema_migration', synchronize: false })
export class OpsSchemaMigrationEntity {
  @PrimaryColumn({ type: 'varchar', length: 20 })
  version!: string;
  @Column({ type: 'varchar', length: 200 })
  filename!: string;
  @Column({ type: 'bytea' })
  checksum_sha256!: Buffer;
  @Column({ type: 'timestamptz', precision: 3 })
  applied_at!: Date;
  @Column({ type: 'integer' })
  duration_ms!: number;
}
export type OpsSchemaMigrationRow = OpsSchemaMigrationEntity;
// V007/V008 tables are SQL-owned, like the rest of this mapping. Registering
// metadata does not enable schema synchronization or implicit relation writes.
@Entity({ schema: 'collect', name: 'source_discovery_policy', synchronize: false })
export class CollectSourceDiscoveryPolicyEntity {
  @PrimaryColumn({ type: 'bigint' }) source_id!: string;
  @Column({ type: 'boolean', default: false }) enabled!: boolean;
  @Column({ type: 'varchar', length: 2048 }) list_url!: string;
  @Column({ type: 'timestamptz', precision: 3 }) reviewed_at!: Date;
  @Column({ type: 'varchar', length: 100 }) policy_version!: string;
  @ManyToOne(() => CollectSourceEntity, {
    nullable: false, onDelete: 'NO ACTION', onUpdate: 'NO ACTION',
    cascade: false, eager: false, lazy: false, persistence: false,
    createForeignKeyConstraints: false, orphanedRowAction: 'disable',
  })
  @JoinColumn([{ name: 'source_id', referencedColumnName: 'id' }])
  source?: Relation<CollectSourceEntity>;
}
@Entity({ schema: 'collect', name: 'batch_review', synchronize: false })
export class CollectBatchReviewEntity {
  @PrimaryColumn({ type: 'uuid' }) item_id!: string;
  @Column({ type: 'bigint' }) item_version!: string;
  @Column({ type: 'bytea' }) content_digest!: Buffer;
  @Column({ type: 'varchar', length: 80 }) source_key!: string;
  @Column({ type: 'varchar', length: 200, nullable: true }) source_post_key!: string | null;
  @Column({ type: 'bytea' }) canonical_url_hash!: Buffer;
  @Column({ type: 'varchar', length: 16 }) status!: string;
  @Column({ type: 'integer', default: 1 }) lock_version!: number;
  @Column({ type: 'bigint', nullable: true, unique: true }) post_id!: string | null;
  @Column({ type: 'varchar', length: 100 }) updated_by!: string;
  @Column({ type: 'timestamptz', precision: 3, default: () => 'now()' }) updated_at!: Date;
  @ManyToOne(() => ContentBoardPostEntity, {
    nullable: true, onDelete: 'NO ACTION', onUpdate: 'NO ACTION',
    cascade: false, eager: false, lazy: false, persistence: false,
    createForeignKeyConstraints: false, orphanedRowAction: 'disable',
  })
  @JoinColumn([{ name: 'post_id', referencedColumnName: 'id' }])
  post?: Relation<ContentBoardPostEntity>;
}
@Entity({ schema: 'collect', name: 'batch_review_request', synchronize: false })
export class CollectBatchReviewRequestEntity {
  @PrimaryColumn({ type: 'varchar', length: 100 }) actor!: string;
  @PrimaryColumn({ type: 'varchar', length: 200 }) scope!: string;
  @PrimaryColumn({ type: 'varchar', length: 200 }) request_key!: string;
  @Column({ type: 'bytea' }) digest!: Buffer;
  @Column({ type: 'integer' }) response_status!: number;
  @Column({ type: 'jsonb' }) response_data!: unknown;
  @Column({ type: 'timestamptz', precision: 3, default: () => 'now()' }) created_at!: Date;
}
@Entity({ schema: 'content', name: 'post_collection_origin', synchronize: false })
export class ContentPostCollectionOriginEntity {
  @PrimaryColumn({ type: 'bigint' }) post_id!: string;
  @Column({ type: 'uuid', unique: true }) dedup_id!: string;
  @ManyToOne(() => ContentBoardPostEntity, {
    nullable: false, onDelete: 'NO ACTION', onUpdate: 'NO ACTION',
    cascade: false, eager: false, lazy: false, persistence: false,
    createForeignKeyConstraints: false, orphanedRowAction: 'disable',
  })
  @JoinColumn([{ name: 'post_id', referencedColumnName: 'id' }])
  post?: Relation<ContentBoardPostEntity>;
}
@Entity({ schema: 'collect', name: 'web_collection_request', synchronize: false })
export class CollectWebCollectionRequestEntity {
  @PrimaryColumn({ type: 'uuid' }) id!: string;
  @Column({ type: 'varchar', length: 100 }) actor!: string;
  @Column({ type: 'varchar', length: 200 }) idempotency_key!: string;
  @Column({ type: 'bytea' }) request_hash!: Buffer;
  @Column({ type: 'varchar', length: 80 }) source_key!: string;
  @Column({ type: 'text', nullable: true }) canonical_url!: string | null;
  @Column({ type: 'bytea' }) canonical_hash!: Buffer;
  @Column({ type: 'bytea' }) post_key_hash!: Buffer;
  @Column({ type: 'smallint' }) normalization_version!: number;
  @Column({ type: 'timestamptz', precision: 3, default: () => 'clock_timestamp()' }) requested_at!: Date;
  @Column({ type: 'timestamptz', precision: 3 }) accept_before!: Date;
  @Column({ type: 'uuid', nullable: true }) lease_token!: string | null;
  @Column({ type: 'timestamptz', precision: 3, nullable: true }) lease_until!: Date | null;
  @Column({ type: 'uuid', nullable: true }) previous_request_id!: string | null;
  @Column({ type: 'timestamptz', precision: 3, nullable: true }) closed_at!: Date | null;
  @Column({ type: 'varchar', length: 16, default: 'PENDING' }) state!: string;
}
@Entity({ schema: 'collect', name: 'web_collection_request_key', synchronize: false })
export class CollectWebCollectionRequestKeyEntity {
  @PrimaryColumn({ type: 'varchar', length: 100 }) actor!: string;
  @PrimaryColumn({ type: 'varchar', length: 200 }) idempotency_key!: string;
  @Column({ type: 'bytea' }) request_hash!: Buffer;
  @Column({ type: 'uuid' }) request_id!: string;
  @Column({ type: 'timestamptz', precision: 3, default: () => "clock_timestamp()+interval '24 hours'" }) expires_at!: Date;
  @ManyToOne(() => CollectWebCollectionRequestEntity, {
    nullable: false, onDelete: 'CASCADE', onUpdate: 'NO ACTION',
    cascade: false, eager: false, lazy: false, persistence: false,
    createForeignKeyConstraints: false, orphanedRowAction: 'disable',
  })
  @JoinColumn([{ name: 'request_id', referencedColumnName: 'id' }])
  request?: Relation<CollectWebCollectionRequestEntity>;
}
// V013 common-code schema; SQL migrations retain DDL and audit ownership.
@Entity({ schema: 'content', name: 'common_code_group', synchronize: false })
export class ContentCommonCodeGroupEntity {
  @PrimaryColumn({ type: 'varchar', length: 40 }) group_key!: string;
  @Column({ type: 'varchar', length: 200 }) display_name!: string;
  @Column({ type: 'integer', default: 1 }) lock_version!: number;
  @Column({ type: 'varchar', length: 100 }) created_by!: string;
  @Column({ type: 'timestamptz', precision: 3, default: () => 'now()' }) created_at!: Date;
  @Column({ type: 'varchar', length: 100 }) updated_by!: string;
  @Column({ type: 'timestamptz', precision: 3, default: () => 'now()' }) updated_at!: Date;
}
@Entity({ schema: 'content', name: 'common_code', synchronize: false })
export class ContentCommonCodeEntity {
  @PrimaryColumn({ type: 'varchar', length: 40 }) group_key!: string;
  @PrimaryColumn({ type: 'varchar', length: 40 }) code!: string;
  @Column({ type: 'varchar', length: 200 }) display_name!: string;
  @Column({ type: 'varchar', length: 80, nullable: true }) reference_key!: string | null;
  @Column({ type: 'integer', default: 1 }) lock_version!: number;
  @Column({ type: 'varchar', length: 100 }) created_by!: string;
  @Column({ type: 'timestamptz', precision: 3, default: () => 'now()' }) created_at!: Date;
  @Column({ type: 'varchar', length: 100 }) updated_by!: string;
  @Column({ type: 'timestamptz', precision: 3, default: () => 'now()' }) updated_at!: Date;
  @ManyToOne(() => ContentCommonCodeGroupEntity, {
    nullable: false, onDelete: 'NO ACTION', onUpdate: 'NO ACTION',
    cascade: false, eager: false, lazy: false, persistence: false,
    createForeignKeyConstraints: false, orphanedRowAction: 'disable',
  })
  @JoinColumn([{ name: 'group_key', referencedColumnName: 'group_key' }])
  group?: Relation<ContentCommonCodeGroupEntity>;
}
// V014 durable Discord review state; SQL owns constraints, indexes and lifecycle.
@Entity({ schema: 'collect', name: 'batch_review_control', synchronize: false })
export class CollectBatchReviewControlEntity {
  @PrimaryColumn({ type: 'uuid' }) item_id!: string;
  @Column({ type: 'varchar', length: 16 }) authority!: string;
  @Column({ type: 'bigint' }) decision_epoch!: string;
  @Column({ type: 'uuid', nullable: true }) active_command_id!: string | null;
  @Column({ type: 'varchar', length: 80, nullable: true }) last_observation_reason!: string | null;
  @Column({ type: 'timestamptz', precision: 3 }) updated_at!: Date;
}
@Entity({ schema: 'collect', name: 'discord_review_delivery', synchronize: false })
export class CollectDiscordReviewDeliveryEntity {
  @PrimaryColumn({ type: 'uuid' }) id!: string;
  @Column({ type: 'uuid' }) item_id!: string;
  @Column({ type: 'varchar', length: 16 }) environment!: string;
  @Column({ type: 'bigint' }) item_version!: string;
  @Column({ type: 'bytea' }) content_digest!: Buffer;
  @Column({ type: 'varchar', length: 40 }) renderer_version!: string;
  @Column({ type: 'jsonb' }) manifest!: unknown;
  @Column({ type: 'varchar', length: 20 }) guild_id!: string;
  @Column({ type: 'varchar', length: 20 }) channel_id!: string;
  @Column({ type: 'varchar', length: 20, nullable: true }) head_message_id!: string | null;
  @Column({ type: 'varchar', length: 20, nullable: true }) thread_id!: string | null;
  @Column({ type: 'bigint', generated: 'identity' }) review_number!: string;
  @Column({ type: 'varchar', length: 20 }) state!: string;
  @Column({ type: 'bigint' }) generation!: string;
  @Column({ type: 'boolean' }) head_seeded!: boolean;
  @Column({ type: 'varchar', length: 16 }) head_send_state!: string;
  @Column({ type: 'varchar', length: 25, nullable: true }) head_nonce!: string | null;
  @Column({ type: 'uuid', nullable: true }) export_token!: string | null;
  @Column({ type: 'uuid', nullable: true }) observation_scan_id!: string | null;
  @Column({ type: 'timestamptz', precision: 3, nullable: true }) observation_started_at!: Date | null;
  @Column({ type: 'jsonb' }) observation_chunks!: unknown;
  @Column({ type: 'timestamptz', precision: 3, nullable: true }) ready_at!: Date | null;
  @Column({ type: 'timestamptz', precision: 3, nullable: true }) expires_at!: Date | null;
  @Column({ type: 'timestamptz', precision: 3, nullable: true }) last_scanned_at!: Date | null;
  @Column({ type: 'varchar', length: 80, nullable: true }) last_scan_result!: string | null;
  @Column({ type: 'varchar', length: 16, nullable: true }) work_kind!: string | null;
  @Column({ type: 'varchar', length: 100, nullable: true }) lease_owner!: string | null;
  @Column({ type: 'uuid', nullable: true }) lease_token!: string | null;
  @Column({ type: 'timestamptz', precision: 3, nullable: true }) lease_until!: Date | null;
  @Column({ type: 'uuid', nullable: true }) attempt_id!: string | null;
  @Column({ type: 'uuid', nullable: true }) last_ack_attempt_id!: string | null;
  @Column({ type: 'timestamptz', precision: 3 }) next_attempt_at!: Date;
  @Column({ type: 'varchar', length: 20 }) cleanup_state!: string;
  @Column({ type: 'integer' }) cleanup_failures!: number;
  @Column({ type: 'timestamptz', precision: 3, nullable: true }) head_deleted_at!: Date | null;
  @Column({ type: 'timestamptz', precision: 3, nullable: true }) thread_deleted_at!: Date | null;
  @Column({ type: 'varchar', length: 20 }) notice_state!: string;
  @Column({ type: 'integer' }) notice_failures!: number;
  @Column({ type: 'timestamptz', precision: 3 }) notice_next_attempt_at!: Date;
  @Column({ type: 'varchar', length: 20, nullable: true }) notice_message_id!: string | null;
  @Column({ type: 'varchar', length: 80, nullable: true }) last_error!: string | null;
  @Column({ type: 'timestamptz', precision: 3 }) created_at!: Date;
  @Column({ type: 'timestamptz', precision: 3 }) updated_at!: Date;
}
@Entity({ schema: 'collect', name: 'discord_review_part', synchronize: false })
export class CollectDiscordReviewPartEntity {
  @PrimaryColumn({ type: 'uuid' }) delivery_id!: string;
  @PrimaryColumn({ type: 'integer' }) ordinal!: number;
  @Column({ type: 'varchar', length: 64 }) unit_id!: string;
  @Column({ type: 'integer' }) fragment_index!: number;
  @Column({ type: 'varchar', length: 8 }) kind!: string;
  @Column({ type: 'integer' }) source_block!: number;
  @Column({ type: 'integer' }) source_start!: number;
  @Column({ type: 'integer' }) source_end!: number;
  @Column({ type: 'integer', nullable: true }) image_position!: number | null;
  @Column({ type: 'varchar', length: 20, nullable: true }) message_id!: string | null;
  @Column({ type: 'varchar', length: 16 }) send_state!: string;
  @Column({ type: 'boolean' }) seeded!: boolean;
  @Column({ type: 'varchar', length: 25, nullable: true }) attempt_nonce!: string | null;
  @Column({ type: 'timestamptz', precision: 3 }) updated_at!: Date;
  @ManyToOne(() => CollectDiscordReviewDeliveryEntity, {
    nullable: false, onDelete: 'NO ACTION', onUpdate: 'NO ACTION',
    cascade: false, eager: false, lazy: false, persistence: false,
    createForeignKeyConstraints: false, orphanedRowAction: 'disable',
  })
  @JoinColumn([{ name: 'delivery_id', referencedColumnName: 'id' }])
  delivery?: Relation<CollectDiscordReviewDeliveryEntity>;
}
@Entity({ schema: 'collect', name: 'batch_review_command', synchronize: false })
export class CollectBatchReviewCommandEntity {
  @PrimaryColumn({ type: 'uuid' }) id!: string;
  @Column({ type: 'uuid' }) item_id!: string;
  @Column({ type: 'varchar', length: 8 }) origin!: string;
  @Column({ type: 'varchar', length: 20 }) action!: string;
  @Column({ type: 'varchar', length: 100 }) actor!: string;
  @Column({ type: 'varchar', length: 100, nullable: true }) operator_id!: string | null;
  @Column({ type: 'jsonb' }) reviewer_ids!: unknown;
  @Column({ type: 'bigint' }) decision_epoch!: string;
  @Column({ type: 'bigint' }) item_version!: string;
  @Column({ type: 'integer' }) review_version!: number;
  @Column({ type: 'bytea' }) content_digest!: Buffer;
  @Column({ type: 'bytea' }) selection_digest!: Buffer;
  @Column({ type: 'jsonb' }) excluded_unit_ids!: unknown;
  @Column({ type: 'jsonb' }) evidence!: unknown;
  @Column({ type: 'jsonb' }) request_body!: unknown;
  @Column({ type: 'varchar', length: 200 }) request_key!: string;
  @Column({ type: 'bytea' }) request_hash!: Buffer;
  @Column({ type: 'varchar', length: 20 }) stage!: string;
  @Column({ type: 'bigint', nullable: true }) post_id!: string | null;
  @Column({ type: 'integer', nullable: true }) post_version!: number | null;
  @Column({ type: 'varchar', length: 100, nullable: true }) lease_owner!: string | null;
  @Column({ type: 'uuid', nullable: true }) lease_token!: string | null;
  @Column({ type: 'timestamptz', precision: 3, nullable: true }) lease_until!: Date | null;
  @Column({ type: 'timestamptz', precision: 3 }) next_attempt_at!: Date;
  @Column({ type: 'integer' }) retry_count!: number;
  @Column({ type: 'varchar', length: 80, nullable: true }) last_error!: string | null;
  @Column({ type: 'timestamptz', precision: 3 }) created_at!: Date;
  @Column({ type: 'timestamptz', precision: 3 }) updated_at!: Date;
  @Column({ type: 'timestamptz', precision: 3, nullable: true }) finished_at!: Date | null;
  @ManyToOne(() => ContentBoardPostEntity, {
    nullable: true, onDelete: 'NO ACTION', onUpdate: 'NO ACTION',
    cascade: false, eager: false, lazy: false, persistence: false,
    createForeignKeyConstraints: false, orphanedRowAction: 'disable',
  })
  @JoinColumn([{ name: 'post_id', referencedColumnName: 'id' }])
  post?: Relation<ContentBoardPostEntity>;
}
@Entity({ schema: 'collect', name: 'discord_review_scan_run', synchronize: false })
export class CollectDiscordReviewScanRunEntity {
  @PrimaryColumn({ type: 'uuid' }) id!: string;
  @Column({ type: 'varchar', length: 16 }) environment!: string;
  @Column({ type: 'timestamptz', precision: 3 }) scheduled_slot!: Date;
  @Column({ type: 'timestamptz', precision: 3 }) cutoff_at!: Date;
  @Column({ type: 'timestamptz', precision: 3, nullable: true }) cursor_ready_at!: Date | null;
  @Column({ type: 'uuid', nullable: true }) cursor_id!: string | null;
  @Column({ type: 'varchar', length: 16 }) state!: string;
  @Column({ type: 'varchar', length: 100 }) lease_owner!: string;
  @Column({ type: 'uuid' }) lease_token!: string;
  @Column({ type: 'timestamptz', precision: 3 }) lease_until!: Date;
  @Column({ type: 'jsonb' }) summary!: unknown;
  @Column({ type: 'timestamptz', precision: 3 }) started_at!: Date;
  @Column({ type: 'timestamptz', precision: 3, nullable: true }) finished_at!: Date | null;
}
@Entity({ schema: 'collect', name: 'batch_source_publish_policy', synchronize: false })
export class CollectSourcePublishPolicyEntity {
  @PrimaryColumn({ type: 'varchar', length: 80 }) source_key!: string;
  @Column({ type: 'boolean', default: false }) auto_publish_enabled!: boolean;
  @Column({ type: 'timestamptz', precision: 3, nullable: true }) enabled_since!: Date | null;
  @Column({ type: 'integer', default: 1 }) lock_version!: number;
  @Column({ type: 'varchar', length: 100 }) updated_by!: string;
  @Column({ type: 'timestamptz', precision: 3, default: () => 'clock_timestamp()' }) updated_at!: Date;
}
@Entity({ schema: 'collect', name: 'batch_source_publish_policy_change', synchronize: false })
export class CollectSourcePublishPolicyChangeEntity {
  @PrimaryColumn({ type: 'varchar', length: 80 }) source_key!: string;
  @PrimaryColumn({ type: 'integer' }) lock_version!: number;
  @Column({ type: 'boolean' }) auto_publish_enabled!: boolean;
  @Column({ type: 'timestamptz', precision: 3, nullable: true }) enabled_since!: Date | null;
  @Column({ type: 'varchar', length: 100 }) actor!: string;
  @Column({ type: 'timestamptz', precision: 3, default: () => 'clock_timestamp()' }) occurred_at!: Date;
  @ManyToOne(() => CollectSourcePublishPolicyEntity, {
    nullable: false, onDelete: 'NO ACTION', onUpdate: 'NO ACTION',
    cascade: false, eager: false, lazy: false, persistence: false,
    createForeignKeyConstraints: false, orphanedRowAction: 'disable',
  })
  @JoinColumn([{ name: 'source_key', referencedColumnName: 'source_key' }])
  policy?: Relation<CollectSourcePublishPolicyEntity>;
}
export const entities = [
  CollectSourcePublishPolicyEntity,
  CollectSourcePublishPolicyChangeEntity,
  CollectBatchReviewControlEntity,
  CollectDiscordReviewDeliveryEntity,
  CollectDiscordReviewPartEntity,
  CollectBatchReviewCommandEntity,
  CollectDiscordReviewScanRunEntity,

  ContentCommonCodeGroupEntity,
  ContentCommonCodeEntity,
  ContentPostCollectionOriginEntity,
  CollectWebCollectionRequestEntity,
  CollectWebCollectionRequestKeyEntity,
  CollectSourceDiscoveryPolicyEntity,
  CollectBatchReviewEntity,
  CollectBatchReviewRequestEntity,
  CollectCandidateEntity,
  CollectCandidateImageEntity,
  CollectCollectorOperationalEventEntity,
  CollectCollectorReceiptEntity,
  CollectSourceEntity,
  CollectSourceRequestBudgetEntity,
  CollectSourceRequestReservationEntity,
  ContentBoardEntity,
  ContentBoardPostEntity,
  ContentBoardPostBlockEntity,
  ContentBoardPostImageEntity,
  ContentBoardPostStatusHistoryEntity,
  LegalPolicyVersionEntity,
  OpsIdempotencyRequestEntity,
  OpsOutboxTaskEntity,
  OpsScheduleFailureAlertEntity,
  OpsSchemaMigrationEntity,
];
