import axios, { AxiosInstance } from 'axios';
import { config } from '../config';
import { logger } from '../config/logger';
import { InferenceResponse } from '../schemas/types';

class MLServiceClient {
  private client: AxiosInstance;

  constructor() {
    // this.client = axios.create({
    //   baseURL: config.mlService.url,
      console.log('ML Service URL:', config.mlService.url);
      this.client = axios.create({
      baseURL: config.mlService.url,
      timeout: 30000,  // ML inference can take a moment
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async healthCheck(): Promise<boolean> {
    try {
      const res = await this.client.get('/health');
      return res.data?.status === 'ok';
    } catch (err: any) {
      console.error('Error occurred while checking ML service health:', err.message);
      return false;
    }
  }

  async analyze(params: {
    account_id?: string;
    start_date?: string;
    end_date?: string;
    limit?: number;
  }): Promise<InferenceResponse> {
    try {
      logger.debug(`Calling ML service /analyze for account: ${params.account_id || 'all'}`);
      const res = await this.client.post('/api/v1/inference/analyze', params);
      return res.data;
    } catch (err: any) {
      const detail = err.response?.data?.detail || err.message;
      logger.error(`ML service analyze failed: ${detail}`);
      throw new Error(`ML service error: ${detail}`);
    }
  }

  async getAccountAnomalies(accountId: string, limit = 100): Promise<unknown> {
    try {
      const res = await this.client.get(`/api/v1/inference/anomalies/${accountId}`, {
        params: { limit },
      });
      return res.data;
    } catch (err: any) {
      const detail = err.response?.data?.detail || err.message;
      logger.error(`ML service anomalies failed: ${detail}`);
      throw new Error(`ML service error: ${detail}`);
    }
  }

  async trainModel(days = 90): Promise<unknown> {
    try {
      const res = await this.client.post('/api/v1/inference/train', null, {
        params: { days },
        timeout: 120000,  // training takes longer
      });
      return res.data;
    } catch (err: any) {
      const detail = err.response?.data?.detail || err.message;
      logger.error(`ML service training failed: ${detail}`);
      throw new Error(`ML service error: ${detail}`);
    }
  }
}

export const mlClient = new MLServiceClient();