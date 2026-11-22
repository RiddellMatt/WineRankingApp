-- Distinguish a real photo scan from the short live check used while scan
-- history is still thin. Existing rows are real scans.

alter table public.gemini_model_samples
  add column if not exists source text not null default 'vision';

alter table public.gemini_model_samples
  drop constraint if exists gemini_model_samples_source_check;

alter table public.gemini_model_samples
  add constraint gemini_model_samples_source_check
  check (source in ('vision', 'probe'));
