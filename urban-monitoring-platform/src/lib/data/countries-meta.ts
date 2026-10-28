// Corrections applied on top of the GeoNames country list.

/** The 193 United Nations member states (ISO 3166-1 alpha-2). */
const UN_MEMBERS = `AF AL DZ AD AO AG AR AM AU AT AZ BS BH BD BB BY BE BZ BJ BT BO BA BW BR BN BG BF BI CV KH CM CA CF TD CL CN CO KM CG
CD CR CI HR CU CY CZ KP DK DJ DM DO EC EG SV GQ ER EE SZ ET FJ FI FR GA GM GE DE GH GR GD GT GN GW GY HT HN HU IS IN ID IR IQ IE IL IT
JM JP JO KZ KE KI KW KG LA LV LB LS LR LY LI LT LU MG MW MY MV ML MT MH MR MU MX FM MD MC MN ME MA MZ MM NA NR NP NL NZ NI NE NG MK NO
OM PK PW PA PG PY PE PH PL PT QA KR RO RU RW KN LC VC WS SM ST SA SN RS SC SL SG SK SI SB SO ZA SS ES LK SD SR SE CH SY TJ TZ TH TL TG
TO TT TN TR TM TV UG UA AE GB US UY UZ VU VE VN YE ZM ZW`.split(/\s+/);

/** UN non-member observer states. */
const OBSERVERS = ["VA", "PS"];

/** Sovereign countries: UN members + observer states (195). Everything else is a territory or other area. */
export const SOVEREIGN = new Set([...UN_MEMBERS, ...OBSERVERS]);

/** Common English names where the GeoNames label is outdated or unusual. */
export const NAME_FIXES: Record<string, string> = {
  PS: "Palestine",
  NL: "Netherlands",
  TL: "Timor-Leste",
  CI: "Côte d'Ivoire",
  VA: "Vatican City",
  CC: "Cocos (Keeling) Islands",
  AX: "Åland Islands",
  CW: "Curaçao",
  RE: "Réunion",
  BL: "Saint Barthélemy",
  MO: "Macao",
  MF: "Saint Martin (French part)",
  SX: "Sint Maarten (Dutch part)",
  FM: "Micronesia",
  BQ: "Caribbean Netherlands",
};

export const CONTINENTS: Record<string, string> = {
  AF: "Africa",
  AN: "Antarctica",
  AS: "Asia",
  EU: "Europe",
  NA: "North America",
  OC: "Oceania",
  SA: "South America",
};
