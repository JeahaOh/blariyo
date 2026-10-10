import { Inject, Injectable } from '@nestjs/common';
import { isDeepStrictEqual } from 'node:util';
import { randomUUID, createHash } from 'node:crypto';
import { DiscordReviewRepository, type ReviewDelivery, type ExportAck, type ReviewScan, type NoticeClaim, type NoticeAck } from '../features/collection/discord-review.repository.js';
import { DISCORD_REVIEW_SETTINGS, type DiscordReviewSettings } from '../features/collection/review-authority.js';
import type { ReviewManifest, MessageObservation } from '../features/collection/discord-review-policy.js';
import { DatabaseContext } from './database.js';
import { rows, requiredRow } from './rows.js';
import { fail } from '../shared/errors.js';
const optional = (v: unknown) => typeof v === 'string' ? v : null;
const time = (v: unknown) => v instanceof Date ? v.toISOString() : typeof v === 'string' ? v : null;
const nonce = (v: string) => createHash('sha256').update(v).digest('hex').slice(0,24);
@Injectable()
export class TypeOrmDiscordReviewRepository extends DiscordReviewRepository {
  constructor(@Inject(DatabaseContext) private readonly db: DatabaseContext,
    @Inject(DISCORD_REVIEW_SETTINGS) private readonly settings: DiscordReviewSettings) { super(); }
  async candidates(since: string) {
    return rows(await this.db.manager.query(`SELECT i.id FROM collect.batch_item i JOIN collect.batch_retention l ON l.item_id=i.id
      LEFT JOIN collect.batch_review r ON r.item_id=i.id LEFT JOIN collect.batch_review_control c ON c.item_id=i.id
      WHERE i.state='FETCHED' AND i.fetched_at >= $1 AND l.retention_state='LIVE' AND l.expires_at>clock_timestamp()
      AND NOT EXISTS(SELECT 1 FROM collect.batch_source_publish_policy p JOIN collect.batch_run b ON b.source_key=p.source_key
        WHERE b.id=i.run_id AND p.auto_publish_enabled AND b.started_at>=p.enabled_since
          AND NOT EXISTS(SELECT 1 FROM collect.batch_auto_publish_classification a WHERE a.item_id=i.id
            AND a.decision='REVIEW'))
      AND r.item_id IS NULL AND COALESCE(c.authority,'DISCORD')='DISCORD'
      AND NOT EXISTS(SELECT 1 FROM collect.discord_review_delivery d WHERE d.item_id=i.id)
      ORDER BY i.fetched_at,i.id LIMIT 20`,[since])).map(r=>String(r.id));
  }
  async blockCandidate(itemId: string, itemVersion: number, digest: string) {
    const id=randomUUID();
    await this.db.manager.query(`INSERT INTO collect.discord_review_delivery
      (id,item_id,environment,item_version,content_digest,renderer_version,manifest,guild_id,channel_id,state,last_error)
      VALUES($1,$2,$3,$4,decode($5,'hex'),'sentence-v1','{}',$6,$7,'BLOCKED','REVIEW_CONTENT_INVALID') ON CONFLICT DO NOTHING`,
    [id,itemId,this.settings.environment,itemVersion,digest,this.settings.guildId,this.settings.channelId]);
  }
  async reconcileExpired() {
    // Retention is independent from review expiry: purge Discord copies without inventing a decision.
    await this.db.manager.query(`UPDATE collect.discord_review_delivery d SET state='CANCELLED',generation=generation+1,
      cleanup_state='PENDING',next_attempt_at=clock_timestamp(),last_error='BATCH_ORIGINAL_EXPIRED',
      lease_token=NULL,lease_owner=NULL,lease_until=NULL,work_kind=NULL
      WHERE environment=$1 AND channel_id=$2 AND guild_id=$3 AND cleanup_state='NONE'
      AND NOT EXISTS(SELECT 1 FROM collect.batch_retention l WHERE l.item_id=d.item_id AND l.retention_state='LIVE' AND l.expires_at>clock_timestamp())`,
    [this.settings.environment,this.settings.channelId,this.settings.guildId]);
  }
  async create(itemId: string, itemVersion: number, manifest: ReviewManifest) {
    await this.db.manager.query('INSERT INTO collect.batch_review_control(item_id) VALUES($1) ON CONFLICT DO NOTHING',[itemId]);
    const control = requiredRow(await this.db.manager.query('SELECT * FROM collect.batch_review_control WHERE item_id=$1 FOR UPDATE',[itemId]));
    if (control.authority !== 'DISCORD' || control.active_command_id !== null) return;
    if (rows(await this.db.manager.query(`SELECT 1 FROM collect.batch_source_publish_policy p
      JOIN collect.batch_run b ON b.source_key=p.source_key JOIN collect.batch_item i ON i.run_id=b.id
      WHERE i.id=$1 AND p.auto_publish_enabled AND b.started_at>=p.enabled_since
        AND NOT EXISTS(SELECT 1 FROM collect.batch_auto_publish_classification a WHERE a.item_id=i.id
          AND a.decision='REVIEW')
      FOR SHARE OF p`,[itemId])).length) return;
    const id = randomUUID();
    // Persist offsets/hashes only; source text and object keys remain under original retention.
    const metadata = { rendererVersion: manifest.rendererVersion, contentDigest: manifest.contentDigest,
      units: manifest.units.map(u=>({ id:u.id,blockIndex:u.blockIndex,start:u.start,end:u.end,kind:u.block.type,fragments:u.fragments.length })) };
    const inserted = rows(await this.db.manager.query(`INSERT INTO collect.discord_review_delivery
      (id,item_id,environment,item_version,content_digest,renderer_version,manifest,guild_id,channel_id,head_nonce)
      VALUES($1,$2,$3,$4,decode($5,'hex'),$6,$7,$8,$9,$10) ON CONFLICT DO NOTHING RETURNING id`,
    [id,itemId,this.settings.environment,itemVersion,manifest.contentDigest,manifest.rendererVersion,JSON.stringify(metadata),this.settings.guildId,this.settings.channelId,nonce(id)]));
    if (!inserted.length) return;
    let ordinal = 0;
    for (const unit of manifest.units) for (let index=0;index<unit.fragments.length;index++) {
      await this.db.manager.query(`INSERT INTO collect.discord_review_part
        (delivery_id,ordinal,unit_id,fragment_index,kind,source_block,source_start,source_end,image_position,attempt_nonce)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,[id,ordinal,unit.id,index,unit.block.type,unit.blockIndex,unit.start,unit.end,
        unit.block.type === 'IMAGE' ? unit.block.imagePosition : null,nonce(`${id}:${ordinal}`)]);
      ordinal++;
    }
  }
  async delivery(id: string): Promise<ReviewDelivery | null> {
    const d = rows(await this.db.manager.query(`SELECT * FROM collect.discord_review_delivery
      WHERE id=$1 AND environment=$2 AND channel_id=$3 AND guild_id=$4`,[id,this.settings.environment,this.settings.channelId,this.settings.guildId]))[0];
    if (!d) return null;
    if (!Buffer.isBuffer(d.content_digest)) throw new Error('REVIEW_RECORD_INVALID');
    const parts = rows(await this.db.manager.query('SELECT * FROM collect.discord_review_part WHERE delivery_id=$1 ORDER BY ordinal',[id]));
    return { id,itemId:String(d.item_id),itemVersion:Number(d.item_version),contentDigest:d.content_digest.toString('hex'),number:Number(d.review_number),
      state:String(d.state),generation:Number(d.generation),channelId:String(d.channel_id),guildId:String(d.guild_id),headMessageId:optional(d.head_message_id),
      threadId:optional(d.thread_id),headSeeded:d.head_seeded === true,headSendState:String(d.head_send_state),headNonce:String(d.head_nonce),
      leaseToken:optional(d.lease_token),readyAt:time(d.ready_at),parts:parts.map(p=>({ordinal:Number(p.ordinal),unitId:String(p.unit_id),
        fragmentIndex:Number(p.fragment_index),kind:String(p.kind),imagePosition:p.image_position===null?null:Number(p.image_position),
        messageId:optional(p.message_id),sendState:String(p.send_state),seeded:p.seeded===true,nonce:String(p.attempt_nonce)})) };
  }
  async claimExport(workerId: string) {
    const token = randomUUID();
    const row = rows(await this.db.manager.query(`WITH candidate AS (SELECT id FROM collect.discord_review_delivery d
      WHERE environment=$1 AND channel_id=$2 AND guild_id=$3 AND state IN ('PENDING','EXPORTING','CANCELLED')
      AND (state<>'CANCELLED' OR head_send_state IN ('SENDING','UNKNOWN') OR EXISTS
        (SELECT 1 FROM collect.discord_review_part p WHERE p.delivery_id=d.id AND p.send_state IN ('SENDING','UNKNOWN')))
      AND next_attempt_at<=clock_timestamp() AND (lease_until IS NULL OR lease_until<clock_timestamp())
      ORDER BY created_at,id FOR UPDATE SKIP LOCKED LIMIT 1), changed AS (UPDATE collect.discord_review_delivery d SET
      state=CASE WHEN state='CANCELLED' THEN state ELSE 'EXPORTING' END,work_kind='EXPORT',lease_owner=$4,lease_token=$5,export_token=$5,
      lease_until=clock_timestamp()+interval '180 seconds',updated_at=clock_timestamp()
      FROM candidate c WHERE d.id=c.id RETURNING d.id) SELECT id FROM changed`,[this.settings.environment,this.settings.channelId,this.settings.guildId,workerId,token]))[0];
    return row ? this.delivery(String(row.id)) : null;
  }
  async exportAck(id: string, ack: ExportAck) {
    const d = rows(await this.db.manager.query(`SELECT * FROM collect.discord_review_delivery WHERE id=$1
      AND environment=$2 AND channel_id=$3 AND guild_id=$4 FOR UPDATE`,[id,this.settings.environment,this.settings.channelId,this.settings.guildId]))[0];
    if (!d || d.export_token !== ack.leaseToken) fail(409,'DISCORD_EXPORT_LEASE_LOST');
    const late = d.state === 'CANCELLED';
    const receipts = ['HEAD_SENT','THREAD_SENT','PART_SENT'];
    if ((!late || !receipts.includes(ack.event)) && (d.lease_token !== ack.leaseToken ||
      !(d.lease_until instanceof Date) || d.lease_until.getTime() <= Date.now())) fail(409,'DISCORD_EXPORT_LEASE_LOST');
    if (!late && Number(d.generation)!==ack.generation) fail(409,'DISCORD_EXPORT_LEASE_LOST');
    if (late && !receipts.includes(ack.event) && ack.event !== 'ERROR' && ack.event !== 'CANCEL_RESOLVED') fail(409,'BATCH_REVIEW_SUPERSEDED');
    const part = ack.ordinal === undefined ? null : rows(await this.db.manager.query(
      'SELECT * FROM collect.discord_review_part WHERE delivery_id=$1 AND ordinal=$2 FOR UPDATE',[id,ack.ordinal]))[0];
    if (ack.event.startsWith('PART_') && !part) fail(400,'VALIDATION_FAILED');
    const message = ack.messageId;
    if (receipts.includes(ack.event) && (!message || !/^[0-9]{17,20}$/.test(message))) fail(400,'VALIDATION_FAILED');
    if (ack.event === 'CANCEL_RESOLVED') {
      if (!late || d.thread_deleted_at === null || d.head_send_state !== 'SENT' || !d.head_message_id) fail(409,'DISCORD_EXPORT_UNCERTAIN');
      await this.db.manager.query("UPDATE collect.discord_review_part SET send_state='BLOCKED' WHERE delivery_id=$1 AND send_state IN ('SENDING','UNKNOWN')",[id]);
      await this.db.manager.query("UPDATE collect.discord_review_delivery SET cleanup_state='PENDING',next_attempt_at=clock_timestamp(),lease_token=NULL,lease_owner=NULL,lease_until=NULL,work_kind=NULL WHERE id=$1",[id]);
    } else if (ack.event === 'HEAD_RETRY') {
      if (d.head_send_state !== 'SENDING' || d.head_message_id !== null) fail(409,'DISCORD_EXPORT_UNCERTAIN');
      await this.db.manager.query("UPDATE collect.discord_review_delivery SET head_send_state='PENDING' WHERE id=$1",[id]);
    } else if (ack.event === 'PART_RETRY') {
      if (part?.send_state !== 'SENDING' || part.message_id !== null) fail(409,'DISCORD_EXPORT_UNCERTAIN');
      await this.db.manager.query("UPDATE collect.discord_review_part SET send_state='PENDING' WHERE delivery_id=$1 AND ordinal=$2",[id,ack.ordinal]);
    } else if (ack.event === 'HEAD_BEGIN') {
      if (d.head_send_state !== 'PENDING') fail(409,'DISCORD_EXPORT_UNCERTAIN');
      await this.db.manager.query("UPDATE collect.discord_review_delivery SET head_send_state='SENDING' WHERE id=$1",[id]);
    } else if (ack.event === 'HEAD_SENT') {
      if (!['SENDING','UNKNOWN','SENT'].includes(String(d.head_send_state)) || (d.head_message_id !== null && d.head_message_id !== message)) fail(409,'DISCORD_EXPORT_UNCERTAIN');
      await this.db.manager.query("UPDATE collect.discord_review_delivery SET head_message_id=$2,head_send_state='SENT',head_deleted_at=NULL WHERE id=$1",[id,message]);
    } else if (ack.event === 'THREAD_BEGIN') {
      if (!d.head_message_id || d.head_send_state!=='SENT') fail(409,'DISCORD_EXPORT_INCOMPLETE');
      // Thread id equals the starter message id, so crash recovery can GET this exact id.
      await this.db.manager.query('UPDATE collect.discord_review_delivery SET thread_id=head_message_id WHERE id=$1',[id]);
    } else if (ack.event === 'THREAD_SENT') {
      if (message !== d.head_message_id) fail(409,'DISCORD_THREAD_SCOPE_INVALID');
      await this.db.manager.query('UPDATE collect.discord_review_delivery SET thread_id=$2,thread_deleted_at=NULL WHERE id=$1',[id,message]);
    } else if (ack.event === 'PART_BEGIN') {
      if (!d.thread_id || part?.send_state !== 'PENDING') fail(409,'DISCORD_EXPORT_UNCERTAIN');
      await this.db.manager.query("UPDATE collect.discord_review_part SET send_state='SENDING' WHERE delivery_id=$1 AND ordinal=$2",[id,ack.ordinal]);
    } else if (ack.event === 'PART_SENT') {
      if (!part || !['SENDING','UNKNOWN','SENT'].includes(String(part.send_state)) || (part.message_id!==null && part.message_id!==message)) fail(409,'DISCORD_EXPORT_UNCERTAIN');
      await this.db.manager.query("UPDATE collect.discord_review_part SET message_id=$3,send_state='SENT' WHERE delivery_id=$1 AND ordinal=$2",[id,ack.ordinal,message]);
    } else if (ack.event === 'HEAD_SEEDED') {
      if (d.head_send_state !== 'SENT') fail(409,'DISCORD_EXPORT_INCOMPLETE');
      await this.db.manager.query('UPDATE collect.discord_review_delivery SET head_seeded=true WHERE id=$1',[id]);
    } else if (ack.event === 'PART_SEEDED') {
      if (part?.send_state!=='SENT') fail(409,'DISCORD_EXPORT_INCOMPLETE');
      await this.db.manager.query('UPDATE collect.discord_review_part SET seeded=true WHERE delivery_id=$1 AND ordinal=$2',[id,ack.ordinal]);
    } else if (ack.event === 'READY') {
      const incomplete = rows(await this.db.manager.query("SELECT ordinal FROM collect.discord_review_part WHERE delivery_id=$1 AND (NOT seeded OR send_state<>'SENT' OR message_id IS NULL) LIMIT 1",[id]));
      if (!d.head_seeded || !d.head_message_id || !d.thread_id || incomplete.length) fail(409,'DISCORD_EXPORT_INCOMPLETE');
      await this.db.manager.query(`UPDATE collect.discord_review_delivery SET state='READY',ready_at=statement_timestamp(),
        expires_at=statement_timestamp()+interval '48 hours',lease_token=NULL,lease_until=NULL,lease_owner=NULL,work_kind=NULL WHERE id=$1`,[id]);
    } else if (ack.event === 'ERROR') {
      await this.db.manager.query(`UPDATE collect.discord_review_delivery SET state=CASE WHEN $3 AND state<>'CANCELLED' THEN 'BLOCKED' ELSE state END,
        last_error=$2,next_attempt_at=clock_timestamp()+make_interval(secs=>GREATEST(60,$4::double precision/1000)),
        lease_token=NULL,lease_until=NULL,lease_owner=NULL,work_kind=NULL WHERE id=$1`,[id,ack.code??'DISCORD_EXPORT_FAILED',ack.blocked??false,ack.retryAfterMs??0]);
    }
    if (late && receipts.includes(ack.event)) await this.db.manager.query(`UPDATE collect.discord_review_delivery SET
      cleanup_state='PENDING',next_attempt_at=clock_timestamp(),lease_token=NULL,lease_until=NULL,lease_owner=NULL,work_kind=NULL WHERE id=$1`,[id]);
    else if (!['READY','ERROR','CANCEL_RESOLVED'].includes(ack.event)) await this.db.manager.query(`UPDATE collect.discord_review_delivery SET
      lease_until=clock_timestamp()+interval '180 seconds',updated_at=clock_timestamp() WHERE id=$1`,[id]);
  }
  async epoch(itemId: string) {
    const row=rows(await this.db.manager.query('SELECT decision_epoch FROM collect.batch_review_control WHERE item_id=$1',[itemId]))[0];
    return row ? Number(row.decision_epoch) : 0;
  }
  async startScan(workerId: string, slot: string): Promise<ReviewScan | null> {
    const id=randomUUID(),token=randomUUID();
    await this.db.manager.query(`INSERT INTO collect.discord_review_scan_run(id,environment,scheduled_slot,cutoff_at,lease_owner,lease_token,lease_until)
      VALUES($1,$2,$3,clock_timestamp(),$4,$5,clock_timestamp()+interval '180 seconds') ON CONFLICT DO NOTHING`,[id,this.settings.environment,slot,workerId,token]);
    const row=rows(await this.db.manager.query(`WITH chosen AS (SELECT id FROM collect.discord_review_scan_run WHERE environment=$1 AND state='RUNNING'
      AND (lease_token=$2 OR lease_until<clock_timestamp()) ORDER BY scheduled_slot FOR UPDATE SKIP LOCKED LIMIT 1), changed AS (
      UPDATE collect.discord_review_scan_run s SET lease_owner=$3,lease_token=$2,lease_until=clock_timestamp()+interval '180 seconds'
      FROM chosen c WHERE s.id=c.id RETURNING s.*) SELECT * FROM changed`,[this.settings.environment,token,workerId]))[0];
    return row?{id:String(row.id),leaseToken:token,cutoff:time(row.cutoff_at)??''}:null;
  }
  private async scan(scan: ReviewScan) {
    const row=rows(await this.db.manager.query(`SELECT * FROM collect.discord_review_scan_run WHERE id=$1 AND lease_token=$2
      AND environment=$3 AND state='RUNNING' AND lease_until>clock_timestamp() FOR UPDATE`,[scan.id,scan.leaseToken,this.settings.environment]))[0];
    if (!row) fail(409,'DISCORD_SCAN_LEASE_LOST');
    await this.db.manager.query("UPDATE collect.discord_review_scan_run SET lease_until=clock_timestamp()+interval '180 seconds' WHERE id=$1",[scan.id]);
    return row;
  }
  async nextScan(scan: ReviewScan) {
    const s=await this.scan(scan);
    const row=rows(await this.db.manager.query(`SELECT d.id FROM collect.discord_review_delivery d JOIN collect.batch_review_control c ON c.item_id=d.item_id
      WHERE d.environment=$1 AND d.channel_id=$2 AND d.guild_id=$3 AND d.state='READY' AND d.cleanup_state='NONE'
      AND c.authority='DISCORD' AND c.active_command_id IS NULL AND d.ready_at<=$4
      AND ($5::timestamptz IS NULL OR (d.ready_at,d.id)>($5::timestamptz,$6::uuid)) ORDER BY d.ready_at,d.id LIMIT 1`,
    [this.settings.environment,this.settings.channelId,this.settings.guildId,s.cutoff_at,s.cursor_ready_at,s.cursor_id]))[0];
    if (!row) {
      await this.db.manager.query("UPDATE collect.discord_review_scan_run SET state='COMPLETED',finished_at=clock_timestamp() WHERE id=$1",[scan.id]);
      return null;
    }
    await this.db.manager.query(`UPDATE collect.discord_review_delivery SET observation_scan_id=$2,
      observation_started_at=clock_timestamp(),observation_chunks='[]'::jsonb WHERE id=$1`,[row.id,scan.id]);
    return this.delivery(String(row.id));
  }
  async appendObservation(scan: ReviewScan, deliveryId: string, index: number, messages: MessageObservation[]) {
    await this.scan(scan);
    const d=requiredRow(await this.db.manager.query('SELECT * FROM collect.discord_review_delivery WHERE id=$1 FOR UPDATE',[deliveryId]));
    if (d.observation_scan_id!==scan.id || !Array.isArray(d.observation_chunks)) fail(409,'DISCORD_OBSERVATION_CONFLICT');
    const chunks: unknown[]=d.observation_chunks;
    if (index<chunks.length && isDeepStrictEqual(chunks[index],messages)) return;
    if (index!==chunks.length || chunks.length>=101) fail(409,'DISCORD_OBSERVATION_CONFLICT');
    await this.db.manager.query('UPDATE collect.discord_review_delivery SET observation_chunks=observation_chunks || $2::jsonb WHERE id=$1',[deliveryId,JSON.stringify([messages])]);
  }
  async observation(scan: ReviewScan, deliveryId: string) {
    await this.scan(scan);
    const d=requiredRow(await this.db.manager.query('SELECT * FROM collect.discord_review_delivery WHERE id=$1 FOR UPDATE',[deliveryId]));
    if (d.observation_scan_id!==scan.id || !(d.observation_started_at instanceof Date) || !Array.isArray(d.observation_chunks)) fail(409,'DISCORD_OBSERVATION_CONFLICT');
    // Each chunk entered through a strict OpenAPI schema. Revalidate persisted JSON after restore.
    const messages: MessageObservation[]=[];
    for (const chunk of d.observation_chunks) {
      if (!Array.isArray(chunk)) fail(409,'DISCORD_OBSERVATION_CONFLICT');
      for (const v of chunk) {
        const m=requiredRow([v]);
        if (typeof m.messageId!=='string' || typeof m.complete!=='boolean' || !Array.isArray(m.reactions)) fail(409,'DISCORD_OBSERVATION_CONFLICT');
        const reactions=m.reactions.map((value:unknown)=>{
          const r=requiredRow([value]);
          if (typeof r.emoji!=='string' || typeof r.complete!=='boolean' || !Array.isArray(r.users)) fail(409,'DISCORD_OBSERVATION_CONFLICT');
          const users=r.users.map((value:unknown)=>{const u=requiredRow([value]);if(typeof u.id!=='string'||typeof u.bot!=='boolean')fail(409,'DISCORD_OBSERVATION_CONFLICT');return{id:u.id,bot:u.bot};});
          return {emoji:r.emoji,complete:r.complete,users};
        });
        messages.push({messageId:m.messageId,complete:m.complete,reactions});
      }
    }
    return {startedAt:d.observation_started_at.getTime(),messages};
  }
  async finishObservation(scan: ReviewScan, deliveryId: string, reason: string) {
    await this.scan(scan);
    const d=requiredRow(await this.db.manager.query('SELECT ready_at FROM collect.discord_review_delivery WHERE id=$1 AND observation_scan_id=$2',[deliveryId,scan.id]));
    await this.db.manager.query(`UPDATE collect.discord_review_delivery SET last_scanned_at=clock_timestamp(),last_scan_result=$2,
      observation_chunks='[]'::jsonb,observation_scan_id=NULL,observation_started_at=NULL WHERE id=$1`,[deliveryId,reason]);
    await this.db.manager.query(`UPDATE collect.discord_review_scan_run SET cursor_ready_at=$2,cursor_id=$3,
      summary=jsonb_set(summary,ARRAY[$4::text],to_jsonb(COALESCE((summary->>$4)::int,0)+1)) WHERE id=$1`,[scan.id,d.ready_at,deliveryId,reason]);
  }
  async jobs() {
    const commands=rows(await this.db.manager.query(`SELECT c.id FROM collect.batch_review_command c
      WHERE c.finished_at IS NULL AND c.next_attempt_at<=clock_timestamp() AND (c.lease_until IS NULL OR c.lease_until<clock_timestamp()) ORDER BY created_at LIMIT 20`));
    const deliveries=rows(await this.db.manager.query(`SELECT id,cleanup_state,notice_state FROM collect.discord_review_delivery
      WHERE environment=$1 AND channel_id=$2 AND guild_id=$3 AND (lease_until IS NULL OR lease_until<clock_timestamp())
      AND ((next_attempt_at<=clock_timestamp() AND cleanup_state IN ('PENDING','RUNNING','RETRY_WAIT'))
        OR (notice_next_attempt_at<=clock_timestamp() AND notice_state='PENDING')) ORDER BY next_attempt_at,id LIMIT 20`,
    [this.settings.environment,this.settings.channelId,this.settings.guildId]));
    return {commands:commands.map(r=>String(r.id)),cleanup:deliveries.filter(r=>['PENDING','RUNNING','RETRY_WAIT'].includes(String(r.cleanup_state))).map(r=>String(r.id)),
      notices:deliveries.filter(r=>r.notice_state==='PENDING').map(r=>String(r.id))};
  }
  async claimNotice(id: string, workerId: string): Promise<NoticeClaim | null> {
    const token=randomUUID(),attempt=randomUUID();
    const row=rows(await this.db.manager.query(`WITH changed AS (UPDATE collect.discord_review_delivery SET
      lease_token=$5,attempt_id=$6,lease_owner=$4,lease_until=clock_timestamp()+interval '180 seconds',work_kind='NOTICE'
      WHERE id=$1 AND environment=$2 AND channel_id=$3 AND notice_state='PENDING' AND cleanup_failures>=2
      AND (lease_until IS NULL OR lease_until<clock_timestamp()) AND notice_next_attempt_at<=clock_timestamp() RETURNING *) SELECT * FROM changed`,
    [id,this.settings.environment,this.settings.channelId,workerId,token,attempt]))[0];
    if(!row)return null;
    if(typeof row.thread_id!=='string'||row.thread_deleted_at!==null){
      await this.db.manager.query("UPDATE collect.discord_review_delivery SET notice_state='UNAVAILABLE',lease_token=NULL,lease_owner=NULL,lease_until=NULL,work_kind=NULL WHERE id=$1",[id]);
      return null;
    }
    const status=rows(await this.db.manager.query(`SELECT COALESCE(r.status,CASE WHEN c.stage='REJECTED' THEN 'REJECTED'
        WHEN c.stage IN ('APPROVED','PREPARING','DRAFTED','PUBLISHED') THEN 'APPROVED' END) AS status,p.status AS post_status
      FROM (SELECT $1::uuid AS item_id) i LEFT JOIN collect.batch_review r ON r.item_id=i.item_id
      LEFT JOIN collect.batch_review_control ctl ON ctl.item_id=i.item_id LEFT JOIN collect.batch_review_command c ON c.id=ctl.active_command_id
      LEFT JOIN content.board_post p ON p.id=COALESCE(r.post_id,c.post_id)`,[row.item_id]))[0];
    const review=status?.status==='APPROVED'?'승인':status?.status==='REJECTED'?'반려':'미확정';
    const published=status?.post_status==='PUBLISHED'?'발행 완료':status?.post_status==='DRAFT'?'초안 저장 · 미발행':'미발행';
    return {deliveryId:id,channelId:String(row.channel_id),threadId:String(row.thread_id),messageId:optional(row.notice_message_id),
      leaseToken:token,attemptId:attempt,nonce:nonce(id+':notice'),
      text:`처리 결과: ${review} / ${published}\nDiscord 메시지 삭제가 ${Number(row.cleanup_failures)}회 실패했습니다. 삭제만 재시도하며 승인·발행은 반복하지 않습니다.`};
  }
  async acknowledgeNotice(id: string, ack: NoticeAck) {
    const changed=rows(await this.db.manager.query(`WITH changed AS (UPDATE collect.discord_review_delivery SET
      notice_message_id=COALESCE($4,notice_message_id),notice_state=CASE WHEN $5 THEN 'UNAVAILABLE' WHEN $6 THEN 'BLOCKED'
        WHEN $4::text IS NOT NULL AND $7::text IS NULL THEN 'SENT' ELSE 'PENDING' END,
      notice_failures=notice_failures+CASE WHEN $7::text IS NULL THEN 0 ELSE 1 END,
      notice_next_attempt_at=CASE WHEN $7::text IS NOT NULL THEN clock_timestamp()+make_interval(secs=>GREATEST(60,$8::double precision/1000)) ELSE notice_next_attempt_at END,
      lease_token=NULL,lease_owner=NULL,lease_until=NULL,work_kind=NULL,last_ack_attempt_id=$3
      WHERE id=$1 AND lease_token=$2 AND attempt_id=$3 AND work_kind='NOTICE' AND lease_until>clock_timestamp()
      AND last_ack_attempt_id IS DISTINCT FROM $3 RETURNING id) SELECT * FROM changed`,
    [id,ack.leaseToken,ack.attemptId,ack.messageId??null,ack.unavailable??false,ack.blocked??false,ack.error??null,ack.retryAfterMs??0]));
    if(!changed.length)fail(409,'DISCORD_NOTICE_LEASE_LOST');
  }
  async status(itemId: string) {
    const d=rows(await this.db.manager.query(`SELECT state,ready_at,expires_at,cleanup_state,cleanup_failures,notice_state,last_error,last_scan_result
      FROM collect.discord_review_delivery WHERE item_id=$1 AND environment=$2 ORDER BY created_at DESC LIMIT 1`,[itemId,this.settings.environment]))[0];
    const c=rows(await this.db.manager.query(`SELECT c.id,c.stage,c.origin,c.post_id,c.excluded_unit_ids,c.last_error FROM collect.batch_review_control r
      JOIN collect.batch_review_command c ON c.id=r.active_command_id WHERE r.item_id=$1`,[itemId]))[0];
    return {enabled:true,delivery:d?{...d,ready_at:time(d.ready_at),expires_at:time(d.expires_at)}:null,command:c??null};
  }
}
