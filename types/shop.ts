/** 카페24 OAuth 토큰 응답 (token / refresh 응답 공통) */
export interface Cafe24TokenResponse {
  access_token?: string;
  expires_at?: string;
  refresh_token?: string;
  refresh_token_expires_at?: string;
  client_id?: string;
  mall_id?: string;
  user_id?: string;
  scopes?: string[];
  issued_at?: string;
  shop_no?: string;
  error?: string;
  error_description?: string;
}

export interface TokenRefreshResult {
  success: boolean;
  access_token?: string;
  expires_at?: string;
  error?: string;
}

/** policy.shops 조회 시 토큰 로직에서 쓰는 최소 필드 */
export interface PolicyShopRow {
  mall_id: string;
  access_token: string | null;
  refresh_token: string | null;
  expires_at: string | null;
  refresh_expires_at?: string | null;
  enabled?: boolean;
}
