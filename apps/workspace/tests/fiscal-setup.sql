-- Privileged configuration/audit checks, isolated and rolled back.
begin;
select set_config('request.jwt.claims','{}',true);
do $$declare r jsonb;denied boolean;begin
 update public.work_settings set payload=payload||'{"bank_name":"Synthetic bank fixture"}'::jsonb where id=1;
 if not exists(select 1 from public.work_audit where entity='work_settings' and action='management_sensitive_settings' and actor='00000000-0000-0000-0000-000000000000'::uuid) then raise exception 'Privileged bank update lacked system audit';end if;
 update public.work_owner_setup set payload=jsonb_set(payload,'{accounting,year_end}','"06-30"') where id=1;
 if not exists(select 1 from public.work_audit where entity='work_owner_setup' and actor='00000000-0000-0000-0000-000000000000'::uuid and detail->>'actor_kind'='database_management') then raise exception 'Management change omitted honest audit';end if;
 denied=false;begin update public.work_owner_setup set payload=jsonb_set(payload,'{accounting,year_end}','"02-30"') where id=1;exception when raise_exception then denied=true;end;if not denied then raise exception 'Impossible annual year-end accepted';end if;
 denied=false;begin update public.work_owner_setup set payload=jsonb_set(payload,'{accounting,year_end}','"02-29"') where id=1;exception when raise_exception then denied=true;end;if not denied then raise exception 'Leap-only annual year-end accepted';end if;
 denied=false;begin update public.work_owner_setup set payload=jsonb_set(payload,'{accounting,opening_position}','{"currency":"NGN","total_minor":999}') where id=1;exception when raise_exception then denied=true;end;if not denied then raise exception 'Incomplete or nonzero zero-confirmation accepted';end if;
 denied=false;begin update public.work_owner_setup set payload=jsonb_set(payload,'{commercial,payment_terms}','"automatic_30_days"') where id=1;exception when raise_exception then denied=true;end;if not denied then raise exception 'Unagreed fixed payment deadline accepted';end if;
end;$$;
create temp table fiscal_admin_ids(user_id uuid,session_id uuid,factor_id uuid);
insert into fiscal_admin_ids values(gen_random_uuid(),gen_random_uuid(),gen_random_uuid());
insert into auth.users(id,email,email_confirmed_at) select user_id,'fiscal-admin-fixture@example.invalid',now() from fiscal_admin_ids;
insert into auth.mfa_factors(id,user_id,factor_type,status,secret,created_at,updated_at) select factor_id,user_id,'totp'::auth.factor_type,'verified'::auth.factor_status,'FIXTURE',now(),now() from fiscal_admin_ids;
insert into auth.sessions(id,user_id,factor_id,aal,created_at,updated_at) select session_id,user_id,factor_id,'aal2'::auth.aal_level,now(),now() from fiscal_admin_ids;
insert into public.work_members(email,user_id,role) select 'fiscal-admin-fixture@example.invalid',user_id,'admin' from fiscal_admin_ids;
select set_config('request.jwt.claims',json_build_object('sub',user_id,'aal','aal2','session_id',session_id)::text,true) from fiscal_admin_ids;
set local role authenticated;
do $$declare denied boolean=false;begin
 if not private.work_allowed('settings') then raise exception 'Fixture admin needs ordinary settings access';end if;
 begin update public.work_settings set payload=payload||'{"bank_name":"Unauthorized staff change"}'::jsonb where id=1;exception when raise_exception then denied=true;end;
 if not denied then raise exception 'Application administrator acquired bank authority through the management path';end if;
end;$$;
reset role;
select set_config('request.jwt.claims','{}',true);
set local role anon;
do $$declare denied boolean=false;begin begin update public.work_owner_setup set payload=payload where id=1;exception when insufficient_privilege then denied=true;end;if not denied then raise exception 'Anonymous setup write allowed';end if;end;$$;
reset role;
rollback;
select 'PASS: annual dates, zero-opening confirmation, flexible terms and honest management audit; anonymous writes denied.';
