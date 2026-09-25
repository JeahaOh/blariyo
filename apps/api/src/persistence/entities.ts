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
export const entities = [
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
