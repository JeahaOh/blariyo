import type { operations } from '@blariyo/contracts/collection-api';
import type { ImageFile } from '../images/image-validation.js';
export type CollectorBodies = {
  create: operations['collectorCreateCandidate']['requestBody']['content']['application/json'];
  claim: operations['collectorClaim']['requestBody']['content']['application/json'];
  heartbeat: operations['collectorHeartbeat']['requestBody']['content']['application/json'];
  result: operations['collectorResult']['requestBody']['content']['application/json'];
  preview: { collectorId: string; lockVersion: number; collectorExecutionId?: string };
};
export type CollectorCommand =
  | {
      action: 'create';
      operation: 'collectorCreateCandidate';
      params: Record<string, string>;
      body: CollectorBodies['create'];
    }
  | {
      action: 'claim';
      operation: 'collectorClaim';
      params: Record<string, string>;
      body: CollectorBodies['claim'];
    }
  | {
      action: 'heartbeat';
      operation: 'collectorHeartbeat';
      params: { candidateId: string };
      body: CollectorBodies['heartbeat'];
    }
  | {
      action: 'result';
      operation: 'collectorResult';
      params: { candidateId: string };
      body: CollectorBodies['result'];
    }
  | {
      action: 'preview';
      operation: 'collectorUploadPreview';
      params: { candidateId: string; candidateImageId: string };
      body: CollectorBodies['preview'];
      file: ImageFile;
    };
