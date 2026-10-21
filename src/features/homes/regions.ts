// Region list from the original HOME_REGIONS (module 1586); order matters for the picker.
export const HOME_REGIONS = [
  {code: 'US', name: 'United States', language: 'en', labelKey: 'homes.regions.US'},
  {code: 'GB', name: 'United Kingdom', language: 'en', labelKey: 'homes.regions.GB'},
  {code: 'IE', name: 'Ireland', language: 'en', labelKey: 'homes.regions.IE'},
  {code: 'CA', name: 'Canada', language: 'en', labelKey: 'homes.regions.CA'},
  {code: 'AU', name: 'Australia', language: 'en', labelKey: 'homes.regions.AU'},
  {code: 'NZ', name: 'New Zealand', language: 'en', labelKey: 'homes.regions.NZ'},
  {code: 'NL', name: 'Netherlands', language: 'nl', labelKey: 'homes.regions.NL'},
  {code: 'BE', name: 'Belgium', language: 'nl', labelKey: 'homes.regions.BE'},
  {code: 'DE', name: 'Germany', language: 'de', labelKey: 'homes.regions.DE'},
  {code: 'AT', name: 'Austria', language: 'de', labelKey: 'homes.regions.AT'},
  {code: 'CH', name: 'Switzerland', language: 'de', labelKey: 'homes.regions.CH'},
  {code: 'ES', name: 'Spain', language: 'es', labelKey: 'homes.regions.ES'},
  {code: 'AR', name: 'Argentina', language: 'es', labelKey: 'homes.regions.AR'},
  {code: 'BO', name: 'Bolivia', language: 'es', labelKey: 'homes.regions.BO'},
  {code: 'CL', name: 'Chile', language: 'es', labelKey: 'homes.regions.CL'},
  {code: 'CO', name: 'Colombia', language: 'es', labelKey: 'homes.regions.CO'},
  {code: 'CR', name: 'Costa Rica', language: 'es', labelKey: 'homes.regions.CR'},
  {code: 'CU', name: 'Cuba', language: 'es', labelKey: 'homes.regions.CU'},
  {code: 'DO', name: 'Dominican Republic', language: 'es', labelKey: 'homes.regions.DO'},
  {code: 'EC', name: 'Ecuador', language: 'es', labelKey: 'homes.regions.EC'},
  {code: 'SV', name: 'El Salvador', language: 'es', labelKey: 'homes.regions.SV'},
  {code: 'GT', name: 'Guatemala', language: 'es', labelKey: 'homes.regions.GT'},
  {code: 'HN', name: 'Honduras', language: 'es', labelKey: 'homes.regions.HN'},
  {code: 'MX', name: 'Mexico', language: 'es', labelKey: 'homes.regions.MX'},
  {code: 'NI', name: 'Nicaragua', language: 'es', labelKey: 'homes.regions.NI'},
  {code: 'PA', name: 'Panama', language: 'es', labelKey: 'homes.regions.PA'},
  {code: 'PY', name: 'Paraguay', language: 'es', labelKey: 'homes.regions.PY'},
  {code: 'PE', name: 'Peru', language: 'es', labelKey: 'homes.regions.PE'},
  {code: 'UY', name: 'Uruguay', language: 'es', labelKey: 'homes.regions.UY'},
  {code: 'VE', name: 'Venezuela', language: 'es', labelKey: 'homes.regions.VE'},
] as const;

export type RegionCode = (typeof HOME_REGIONS)[number]['code'];
export const DEFAULT_REGION = HOME_REGIONS[0];

export const findRegion = (code?: string | null) => HOME_REGIONS.find(r => r.code === code);
