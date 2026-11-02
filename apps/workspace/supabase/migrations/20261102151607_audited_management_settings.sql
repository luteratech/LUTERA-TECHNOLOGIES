-- Preserve the owner-only application rule while supporting the existing
-- privileged postgres management connection, with an explicit system audit.
-- Never infer database-management authority from a JWT or a SECURITY DEFINER's
-- current_user: session_user and the selected SQL role are both checked.
create or replace function private.work_sensitive_settings() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if jsonb_build_array(new.payload->'bank_name',new.payload->'account_name',new.payload->'account_number',new.payload->'tax_id',new.payload->'currency') is distinct from jsonb_build_array(old.payload->'bank_name',old.payload->'account_name',old.payload->'account_number',old.payload->'tax_id',old.payload->'currency') and not private.work_allowed('members') then
  if session_user='postgres' and current_setting('role',true) in ('none','postgres') and auth.uid() is null then
   insert into public.work_audit(actor,action,entity,entity_id,detail)
   values('00000000-0000-0000-0000-000000000000'::uuid,'management_sensitive_settings','work_settings',new.id::text,
    '{"actor_kind":"database_management","note":"Privileged postgres connection; not an authenticated staff action","fields":"bank, tax or default currency"}'::jsonb);
  else
   raise exception 'BUSINESS: Only the owner can change bank, tax or default currency settings.';
  end if;
 end if;
 return new;
end;$$;
revoke all on function private.work_sensitive_settings() from public,anon,authenticated;
