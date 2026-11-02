# Calendar overlays (2026–2027)

Verified on 2026-11-02. This is a bundled calendar reference, not church activity data. Turning an overlay on does not create records, assignments, or notifications. Filters start off; birthdays load through the existing Recognitions loader only when enabled.

- PH holidays: [Proclamation 1006 (2026)](https://lawphil.net/executive/proc/proc2025/pdf/proc_1006_2025.pdf), [Proclamation 1427 (2027)](https://www.lawphil.net/executive/proc/proc2026/proc_1427_2026.html).
- 2026 Eid dates: [March 20 / Proclamation 1189](https://pco.gov.ph/news_releases/proclamation-no-1189-s-2026-declaring-friday-20-march-2026-a-regular-holiday-throughout-the-country-in-observance-of-eidl-fitr-feast-of-ramadhan/), [May 27 / Proclamation 1264](https://pco.gov.ph/news_releases/palace-declares-may-27-as-a-regular-holiday-for-eidl-adha-observance/).
- Nueva Ecija: [April 25, 2026 / Proclamation 1211](https://lawphil.net/executive/proc/proc2026/pdf/proc_1211_2026.pdf); [September 2 every year / RA 7596](https://lawphil.net/statutes/repacts/ra1992/ra_7596_1992.html).
- The 2027 Eid dates await separate proclamations. April 25's 2026 proclamation is not copied into 2027. No verified separate 2026/2027 Quezon, Nueva Ecija municipal holiday declaration was found. Holidays for Quezon City, Quezon Province, and other municipalities are excluded.
- Birthdays use their actual month/day in the displayed year, independently of the Thursday–Wednesday Sunday recognition window. February 29 appears only in leap years.

Keep working/non-working classifications visible in date details. Update `src/features/activities/calendarOverlays.ts` when further official proclamations are published. Do not infer substitute weekdays or future local holidays.

## Quezon fiestas and festivals

A separate default-off, green layer marks traditional local planning references for 2026–2027: Patimyas Ani on January 30, and the February 1–3 town fiesta period. These are **not verified year-specific LGU programs or declarations of non-working holidays**. Their date details explicitly say the LGU program needs confirmation. Do not label their source links "Official source".

References: [municipal eLGU portal, historical 2025 fiesta/festival announcements](https://elgu-quezon-nueva-ecija-news.e.gov.ph/); [photographer's annual January 30 description](https://commons.wikimedia.org/wiki/File:Patimyas_Gintong_Ani_2020,_Quezon,_Nueva_Ecija.jpg); [historical Nueva Ecija festivals catalog, Patimyas Ani entry and February 1–3 explanation](https://www.scribd.com/document/735555637/Festivals-and-Founding-Anniversary-Province-of-Nueva-Ecija-2020). Replace reference dates with verified schedules when the corresponding LGU program is available; keep the holiday classification separate.
