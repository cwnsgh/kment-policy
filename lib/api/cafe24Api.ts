/**
 * 카페24 API 공통 (kment-widget과 동일한 헤더·URL 패턴, 엔드포인트는 호출부에서 확장)
 */

import { config } from "@/lib/config/env";
import { logger } from "@/lib/utils/logger";

export interface Cafe24ApiOptions {
  mallId: string;
  endpoint: string;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  headers?: Record<string, string>;
  body?: unknown;
  accessToken?: string;
}

export interface Cafe24ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  status?: number;
}

export function createCafe24ApiUrl(mallId: string, endpoint: string): string {
  return `https://${mallId}.${config.cafe24.baseUrl}/api/v2/${endpoint}`;
}

export function createCafe24ApiHeaders(
  accessToken?: string
): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Cafe24-Api-Version": config.cafe24.apiVersion,
    "X-Cafe24-Client-Id": config.cafe24.clientId,
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  return headers;
}

export async function callCafe24Api<T = unknown>(
  options: Cafe24ApiOptions
): Promise<Cafe24ApiResponse<T>> {
  const {
    mallId,
    endpoint,
    method = "GET",
    headers = {},
    body,
    accessToken,
  } = options;

  const url = createCafe24ApiUrl(mallId, endpoint);
  const apiHeaders = {
    ...createCafe24ApiHeaders(accessToken),
    ...headers,
  };

  logger.info("카페24 API 호출", {
    url,
    method,
    mallId,
    endpoint,
    hasAccessToken: !!accessToken,
  });

  try {
    const requestOptions: RequestInit = {
      method,
      headers: apiHeaders,
    };

    if (body && method !== "GET") {
      requestOptions.body = JSON.stringify(body);
    }

    const response = await fetch(url, requestOptions);

    if (!response.ok) {
      const errorText = await response.text();
      logger.error("카페24 API 에러", {
        status: response.status,
        error: errorText,
        url,
        mallId,
        endpoint,
      });

      return {
        success: false,
        error: `카페24 API 에러: ${response.status} - ${errorText}`,
        status: response.status,
      };
    }

    const data = (await response.json()) as T;
    logger.info("카페24 API 응답 성공", { url, mallId, endpoint });

    return {
      success: true,
      data,
    };
  } catch (error) {
    logger.error("카페24 API 호출 중 예외", { error, url, mallId, endpoint });
    return {
      success: false,
      error: error instanceof Error ? error.message : "알 수 없는 오류",
    };
  }
}
