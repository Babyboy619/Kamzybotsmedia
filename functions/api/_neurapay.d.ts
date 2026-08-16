// Type surface for the shared NeuraPay helper (implemented in _neurapay.js).
export interface NeuraPayConfig {
  baseUrl: string;
  secretKey: string;
  publicKey: string;
  webhookSecret: string;
  businessId: string;
  initPath: string;
  initMethod: string;
  verifyPath: string;
  method: string;
}

export interface NeuraPayResult {
  ok: boolean;
  status: number;
  json: unknown;
  raw: string;
  networkError: string | null;
}

export type NeuraPayUser = {
  id?: string;
  email?: string | null;
  user_metadata?: Record<string, unknown>;
};

export type NeuraPayIntent = {
  user_id?: string;
  amount?: number | string;
  reference?: string;
  status?: string;
};

export function readEnv(env: unknown, key: string): string;
export function neuraPayConfig(env: unknown): NeuraPayConfig;
export function neuraPayRequest(
  cfg: NeuraPayConfig,
  path: string,
  params?: Record<string, unknown>,
  methodOverride?: string,
): Promise<NeuraPayResult>;
export function neuraPayErrorMessage(result: NeuraPayResult, fallback: string): string;
export function isNeuraPaySuccess(payload: unknown): boolean;
export function isPaidStatus(value: unknown): boolean;
export function extractValue(payload: unknown, keys: string[]): unknown;
export function sbFetch(
  supabaseUrl: string,
  serviceKey: string,
  path: string,
  extra?: RequestInit & { headers?: Record<string, string> },
): Promise<Response>;
export function getUser(
  supabaseUrl: string,
  serviceKey: string,
  token: string,
): Promise<NeuraPayUser | null>;
export function getIntent(
  supabaseUrl: string,
  serviceKey: string,
  reference: string,
  userId?: string,
): Promise<NeuraPayIntent | null>;
export function creditWalletOnce(
  supabaseUrl: string,
  serviceKey: string,
  args: { userId: string; amount: number; reference: string },
): Promise<{ credited: boolean; alreadyCredited: boolean; error: string | null }>;
export function verifyWebhookSignature(
  raw: string,
  signature: string,
  secret: string,
): Promise<boolean>;
