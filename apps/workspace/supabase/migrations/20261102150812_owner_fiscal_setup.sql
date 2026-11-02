-- Reporting calendar and an explicitly confirmed zero opening position.
-- Company bank data and live setup answers are applied separately, never seeded here.
create function private.work_validate_fiscal_setup() returns trigger
language plpgsql set search_path='' as $$
declare ending text; month_number integer; day_number integer; opening jsonb;begin
 if jsonb_typeof(new.payload->'accounting') is distinct from 'object' then raise exception 'BUSINESS: Invalid accounting setup.';end if;
 ending=coalesce(new.payload#>>'{accounting,year_end}','12-31');
 if ending !~ '^[0-9]{2}-[0-9]{2}$' then raise exception 'BUSINESS: Choose a valid annual financial year-end (MM-DD).';end if;
 month_number=split_part(ending,'-',1)::integer;day_number=split_part(ending,'-',2)::integer;
 begin perform make_date(2001,month_number,day_number);exception when datetime_field_overflow then raise exception 'BUSINESS: Choose a valid annual financial year-end (MM-DD).';end;
 if TG_OP='UPDATE' and ending is distinct from coalesce(old.payload#>>'{accounting,year_end}','12-31') and exists(select 1 from public.work_ledger_journals where status='posted') then raise exception 'BUSINESS: The financial year-end is locked after ledger posting. Arrange a reviewed year-end change.';end if;
 new.payload=jsonb_set(new.payload,'{accounting,year_end}',to_jsonb(ending));
 opening=new.payload#>'{accounting,opening_position}';
 if opening is not null and (opening is distinct from '{"currency":"NGN","total_minor":0,"no_receivables":true,"no_payables":true,"no_deposits":true,"no_loans":true,"no_stock":true,"no_fixed_assets":true}'::jsonb or nullif(new.payload#>>'{accounting,cutover}','') is null) then raise exception 'BUSINESS: Invalid confirmed zero opening position. Record actual later transactions separately.';end if;
 if not new.payload ? 'commercial' then new.payload=new.payload||'{"commercial":{"payment_terms":"per_transaction","numbering":"existing_sequences","approvals":"owner_then_delegates"}}'::jsonb;end if;
 if new.payload->'commercial' is distinct from '{"payment_terms":"per_transaction","numbering":"existing_sequences","approvals":"owner_then_delegates"}'::jsonb then raise exception 'BUSINESS: Use transaction-specific terms, existing numbering and delegated approval controls.';end if;
 return new;
end;$$;
revoke all on function private.work_validate_fiscal_setup() from public,anon,authenticated;
create trigger work_owner_setup_fiscal before insert or update on public.work_owner_setup
for each row execute function private.work_validate_fiscal_setup();

-- Privileged management changes must have an honest system actor, rather than
-- fabricating a staff JWT/MFA session. This sentinel is only an audit identifier.
create or replace function private.work_suite_audit() returns trigger language plpgsql security definer set search_path='' as $$
declare r jsonb; staff_actor uuid=auth.uid();begin
 r=case when TG_OP='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 insert into public.work_audit(actor,action,entity,entity_id,detail)
 values(coalesce(staff_actor,'00000000-0000-0000-0000-000000000000'::uuid),lower(TG_OP),TG_TABLE_NAME,coalesce(r->>'id',r->>'email',r->>'user_id',r->>'code'),
 case when staff_actor is null then '{"actor_kind":"database_management","note":"Privileged database operation; not an authenticated staff action"}'::jsonb else '{}'::jsonb end);
 if TG_OP='DELETE' then return old;end if;return new;
end;$$;
revoke all on function private.work_suite_audit() from public,anon,authenticated;

-- Expose only the nonsensitive reporting calendar to verified workspace users.
do $$declare definition text;needle text;begin
 select pg_get_functiondef('private.work_suite(jsonb)'::regprocedure) into definition;
 needle='''accounting_enabled'',coalesce';
 if position(needle in definition)=0 then raise exception 'Fiscal capability extension target missing';end if;
 definition=replace(definition,needle,'''accounting_start'',coalesce((select payload#>>''{accounting,cutover}'' from public.work_owner_setup where id=1),''''),''financial_year_end'',coalesce((select payload#>>''{accounting,year_end}'' from public.work_owner_setup where id=1),''12-31''),''accounting_enabled'',coalesce');
 execute definition;
end;$$;
