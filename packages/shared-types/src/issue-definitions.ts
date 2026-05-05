export const EXPENSIVE_ISSUE_DEFINITIONS: ReadonlyArray<readonly [string, string]> = [
  [
    'issues:dead-external-domain',
    `is_external = 0 AND content_kind = 'html'
     AND EXISTS (
       SELECT 1 FROM links l
         JOIN urls eu ON l.to_url = eu.url
        WHERE l.from_url_id = urls.id
          AND l.is_internal = 0
          AND eu.is_external = 1
          AND LOWER(
            SUBSTR(
              eu.url,
              INSTR(eu.url, '://') + 3,
              CASE
                WHEN INSTR(SUBSTR(eu.url, INSTR(eu.url, '://') + 3), '/') > 0
                  THEN INSTR(SUBSTR(eu.url, INSTR(eu.url, '://') + 3), '/') - 1
                ELSE LENGTH(eu.url)
              END
            )
          ) IN (
            SELECT host_grouped FROM (
              SELECT
                LOWER(
                  SUBSTR(
                    url,
                    INSTR(url, '://') + 3,
                    CASE
                      WHEN INSTR(SUBSTR(url, INSTR(url, '://') + 3), '/') > 0
                        THEN INSTR(SUBSTR(url, INSTR(url, '://') + 3), '/') - 1
                      ELSE LENGTH(url)
                    END
                  )
                ) AS host_grouped,
                COUNT(*) AS total,
                SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) AS errors
              FROM urls
              WHERE is_external = 1 AND status_code IS NOT NULL
              GROUP BY host_grouped
              HAVING total >= 3 AND CAST(errors AS REAL) / total >= 0.8
            )
          )
     )`,
  ],
  [
    'issues:duplicate-url-post-norm',
    `is_external = 0 AND EXISTS (
       SELECT 1 FROM urls u2
        WHERE u2.id <> urls.id
          AND u2.is_external = 0
          AND RTRIM(
                LOWER(
                  CASE
                    WHEN INSTR(u2.url, '?') > 0
                      THEN SUBSTR(u2.url, 1, INSTR(u2.url, '?') - 1)
                    ELSE u2.url
                  END
                ),
                '/'
              ) =
              RTRIM(
                LOWER(
                  CASE
                    WHEN INSTR(urls.url, '?') > 0
                      THEN SUBSTR(urls.url, 1, INSTR(urls.url, '?') - 1)
                    ELSE urls.url
                  END
                ),
                '/'
              )
     )`,
  ],
  [
    'issues:canonical-chain-multi-hop',
    `is_external = 0 AND content_kind = 'html'
     AND canonical IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM urls u2
        WHERE u2.url = urls.canonical
          AND u2.canonical IS NOT NULL
          AND u2.canonical <> u2.url
     )`,
  ],
  [
    'issues:canonical-chain-loop',
    `is_external = 0 AND content_kind = 'html'
     AND canonical IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM urls u2
        WHERE u2.url = urls.canonical
          AND u2.canonical = urls.url
     )`,
  ],
];
