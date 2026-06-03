import {
  IdentityVerifier,
  OcrService,
  DonorRanker,
  Notifier,
  FileStorage,
  AnalysisEngine,
} from '@mentamind/shared';
import { AppConfig } from '../config/env.js';
import { LocalIdentityVerifier } from './local-identity-verifier.js';
import { LocalOcrService } from './local-ocr-service.js';
import { LocalDonorRanker } from './local-donor-ranker.js';
import { LocalNotifier } from './local-notifier.js';
import { MinioFileStorage } from './minio-file-storage.js';
import { LocalAnalysisEngine } from './local-analysis-engine.js';

export interface ServiceContainer {
  identityVerifier: IdentityVerifier;
  ocrService: OcrService;
  donorRanker: DonorRanker;
  notifier: Notifier;
  fileStorage: FileStorage;
  analysisEngine: AnalysisEngine;
}

export function createServiceContainer(appConfig: AppConfig): ServiceContainer {
  return {
    identityVerifier: new LocalIdentityVerifier(),
    ocrService: new LocalOcrService(),
    donorRanker: new LocalDonorRanker(),
    notifier: new LocalNotifier(),
    fileStorage: new MinioFileStorage({
      endPoint: appConfig.MINIO_ENDPOINT,
      port: appConfig.MINIO_PORT,
      useSSL: appConfig.MINIO_USE_SSL,
      accessKey: appConfig.MINIO_ACCESS_KEY,
      secretKey: appConfig.MINIO_SECRET_KEY,
      bucket: appConfig.MINIO_BUCKET,
    }),
    analysisEngine: new LocalAnalysisEngine(),
  };
}
