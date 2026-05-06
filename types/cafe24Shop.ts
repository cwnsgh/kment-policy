/** 카페24 `GET admin/shops`에서 쓰는 쇼핑몰 한 줄(클라이언트 표시용) */
export type Cafe24ShopListItem = {
  shop_no: number;
  shop_name: string;
  language_name: string | null;
  default_shop: boolean;
  active: boolean;
};
