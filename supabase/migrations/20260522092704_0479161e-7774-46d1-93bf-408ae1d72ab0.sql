UPDATE public.leads
SET source = 'fundkredit', updated_at = now()
WHERE source ILIKE 'fundkredit%';