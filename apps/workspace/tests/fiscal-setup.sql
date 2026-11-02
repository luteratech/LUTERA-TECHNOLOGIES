-- Privileged configuration/audit checks, isolated and rolled back.
begin;
select set_config('request.jwt.claims','{}',true);
do $$declare r jsonb;denied boolean;begin
 update public.work_owner_setup set payload=jsonb_set(payload,'{accounting,year_end}','"06-30"') where id=1;
 if not exists(select 1 from public.work_audit where entity='work_owner_setup' and actor='00000000-0000-0000-0000-000000000000'::uuid and detail->>'actor_kind'='database_management') then raise exception 'Management change omitted honest audit';end if;
 denied=false;begin update public.work_owner_setup set payload=jsonb_set(payload,'{accounting,year_end}','"02-30"') where id=1;exception when raise_exception then denied=true;end;if not denied then raise exception 'Impossible annual year-end accepted';end if;
 denied=false;begin update public.work_owner_setup set payload=jsonb_set(payload,'{accounting,year_end}','"02-29"') where id=1;exception when raise_exception then denied=true;end;if not denied then raise exception 'Leap-only annual year-end accepted';end if;
 denied=false;begin update public.work_owner_setup set payload=jsonb_set(payload,'{accounting,opening_position}','{"currency":"NGN","total_minor":999}') where id=1;exception when raise_exception then denied=true;end;if not denied then raise exception 'Incomplete or nonzero zero-confirmation accepted';end if;
 denied=false;begin update public.work_owner_setup set payload=jsonb_set(payload,'{commercial,payment_terms}','"automatic_30_days"') where id=1;exception when raise_exception then denied=true;end;if not denied then raise exception 'Unagreed fixed payment deadline accepted';end if;
end;$$;
set local role anon;
do $$declare denied boolean=false;begin begin update public.work_owner_setup set payload=payload where id=1;exception when insufficient_privilege then denied=true;end;if not denied then raise exception 'Anonymous setup write allowed';end if;end;$$;
reset role;
rollback;
select 'PASS: annual dates, zero-opening confirmation, flexible terms and honest management audit; anonymous writes denied.';
