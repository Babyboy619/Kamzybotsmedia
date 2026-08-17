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
  json: any;
  raw: string;
  networkError: string | null;
}

export function readEnv(env: unknown, key: string): string;
export function neuraPayConfig(env: unknown): NeuraPayConfig;
export function neuraPayRequest(
  cfg: NeuraPayConfig,
  path: string,
  params?: Record<string, unknown>,
  methodOverride?: string,
): Promise<NeuraPayResult>;
export function neuraPayErrorMessage(result: NeuraPayResult, fallback: string): string;
export function isNeuraPaySuccess(payload: any): boolean;
export function isPaidStatus(value: unknown): boolean;
export function extractValue(payload: any, keys: string[]): any;
export function sbFetch(
  supabaseUrl: string,
  serviceKey: string,
  path: string,
  extra?: RequestInit & { headers?: Record<string, string> },
): Promise<Response>;
export function getUser(supabaseUrl: string, serviceKey: string, token: string): Promise<any>;
export function getIntent(
  supabaseUrl: string,
  serviceKey: string,
  reference: string,
  userId?: string,
): Promise<any>;
export function creditWalletOnce(
  supabaseUrl: string,
  serviceKey: string,
  args: { userId: string; amount: number; reference: string },
): Promise<{ credited: boolean; alreadyCredited: boolean; error: string | null }>;
export function verifyAndCreditIntent(
  cfg: NeuraPayConfig,
  supabaseUrl: string,
  serviceKey: string,
  intent: any,
): Promise<{
  success: boolean;
  status: string;
  amount?: number;
  alreadyCredited?: boolean;
  error?: string;
}>;
export function listPendingIntents(
  supabaseUrl: string,
  serviceKey: string,
  userId: string,
  hours?: number,
  limit?: number,
): Promise<any[]>;
export function json(data: unknown, status?: number): Response;
export function optionsResponse(): Response;
export function corsHeaders(extra?: Record<string, string>): Record<string, string>;
export function ensureWallet(supabaseUrl: string, serviceKey: string, userId: string): Promise<any>;
export function verifyWebhookSignature(
  raw: string,
  signature: string,
  secret: string,
): Promise<boolean>;
