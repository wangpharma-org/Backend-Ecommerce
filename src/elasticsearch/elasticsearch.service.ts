import { Injectable } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

export interface EsQueryBody {
  from?: number;
  size?: number;
  track_total_hits?: boolean;
  sort?: Array<Record<string, unknown>>;
  _source?: string[];
  query?: Record<string, unknown>;
}

export interface EsHit<T> {
  _index: string;
  _id: string;
  _score: number | null;
  _source: T;
}

export interface EsSearchResponse<T> {
  took: number;
  timed_out: boolean;
  hits: {
    total: number | { value: number; relation: string };
    max_score: number | null;
    hits: EsHit<T>[];
  };
}

export interface EsCountResponse {
  count: number;
  _shards: {
    total: number;
    successful: number;
    skipped: number;
    failed: number;
  };
}

@Injectable()
export class ElasticsearchService {
  private readonly client: AxiosInstance;
  private readonly index = 'products';

  constructor() {
    this.client = axios.create({
      baseURL: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
      auth: {
        username: process.env.ELASTICSEARCH_USERNAME || 'elastic',
        password: process.env.ELASTICSEARCH_PASSWORD || 'password',
      },
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  async search<T>(body: EsQueryBody): Promise<EsSearchResponse<T>> {
    const response = await this.client.post<EsSearchResponse<T>>(
      `/${this.index}/_search`,
      body,
    );
    return response.data;
  }

  async count(body: Pick<EsQueryBody, 'query'>): Promise<EsCountResponse> {
    const response = await this.client.post<EsCountResponse>(
      `/${this.index}/_count`,
      body,
    );
    return response.data;
  }

  async deleteIndex(): Promise<unknown> {
    const response = await this.client.delete(`/${this.index}`);
    return response.data;
  }

  async checkHealth(): Promise<unknown> {
    const response = await this.client.get('/_cluster/health');
    return response.data;
  }
}
