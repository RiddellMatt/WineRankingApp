-- A 404 means the model id is retired. Rank it out of the scan instead of
-- treating that fast error as a cheap retry.

alter table public.gemini_model_samples
  drop constraint if exists gemini_model_samples_outcome_check;

alter table public.gemini_model_samples
  add constraint gemini_model_samples_outcome_check
  check (outcome in ('success', 'overload', 'timeout', 'error', 'unavailable'));
