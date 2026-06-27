export const DELIVERY_PREFERENCE_FEATURE_FLAG = 'delivery_preference_hatyai';

export const DELIVERY_PREFERENCE_ENABLED_ROUTES = ['L1-1', 'L23'];

export const DELIVERY_PREFERENCE_OPTIONS = [
  { key: 'van_only', label: 'เฉพาะรถวังเภสัช' },
  { key: 'van_or_delivery', label: 'รถวังเภสัช หรือ ขนส่งทั่วไป' },
  { key: 'delivery_always', label: 'ขนส่งทั่วไปเท่านั้น' },
] as const;

export type DeliveryPreferenceKey =
  (typeof DELIVERY_PREFERENCE_OPTIONS)[number]['key'];

export const DELIVERY_PREFERENCE_KEYS: DeliveryPreferenceKey[] =
  DELIVERY_PREFERENCE_OPTIONS.map((option) => option.key);

export const WANG_SHIPPING_TYPE = 'wang';
