// lib/constants/cafe24Scopes.ts
export const cafe24Scopes = [
  "mall.read_application",
  "mall.write_application",
  "mall.read_store",
  "mall.write_store",

  // 주의: mall.write_product와 mall.read_order는
  // Cafe24 개발자 센터에서 별도 승인이 필요합니다.
  // 개발자 센터에서 "상품(Product)" Read + Write와 "주문(Order)" Read 권한을
  // 설정한 후 아래 주석을 해제하세요.
  // "mall.write_product", // 상품 가격 변경을 위해 필요
  // "mall.read_order", // 주문 조회를 위해 필요
];
