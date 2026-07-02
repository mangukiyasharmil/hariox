UPDATE public.leads
SET
  city = trim(split_part(city, ',', 1)),
  state = COALESCE(NULLIF(trim(substring(city from ',(.*)$')), ''), state),
  cibil_score_range = COALESCE(
    NULLIF(cibil_score_range, ''),
    NULLIF(substring(source from 'cibil=([^;]+)'), '')
  ),
  current_monthly_emi = COALESCE(
    current_monthly_emi,
    NULLIF(substring(source from 'emi=([^;]+)'), '')::numeric
  ),
  source = NULLIF(trim(split_part(source, ';', 1)), ''),
  updated_at = now()
WHERE
  (city LIKE '%,%' OR source LIKE '%;cibil=%' OR source LIKE '%;emi=%')
  AND source LIKE 'fundkredit%';