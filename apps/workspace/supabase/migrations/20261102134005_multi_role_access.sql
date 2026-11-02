-- Additive role union. Existing memberships and owner authority are preserved.
alter table public.work_members add column roles text[];
update public.work_members set roles=array[role];
alter table public.work_members alter column roles set default array['staff'];
alter table public.work_members alter column roles set not null;
alter table public.work_members add constraint work_members_roles_valid check (
 cardinality(roles) between 1 and 6 and array_position(roles,null) is null
 and roles <@ array['owner','admin','editor','finance','designer','staff']::text[]
 and role=any(roles) and (not 'owner'=any(roles) or roles=array['owner']::text[])
);
create function private.work_sync_roles() returns trigger language plpgsql set search_path='' as $$
begin
 if TG_OP='INSERT' then
  if new.roles=array['staff']::text[] and new.role<>'staff' then new.roles=array[new.role];end if;
 elsif new.role is distinct from old.role and new.roles is not distinct from old.roles then new.roles=array[new.role];
 end if;
 return new;
end;$$;
create trigger work_sync_roles before insert or update on public.work_members for each row execute function private.work_sync_roles();
revoke all on function private.work_sync_roles() from public,anon,authenticated;

-- Only the four reviewed authorization helpers contain non-owner legacy-role
-- shortcuts. Retain their session, record scope, expiry and revocation checks.
do $$declare r record; definition text; updated text; k text;
begin
 for r in select p.oid,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='private' and p.proname in ('work_allowed','work_ops_allowed','work_sender_allowed','work_job') loop
  definition=pg_get_functiondef(r.oid);updated=definition;
  foreach k in array array['admin','editor','finance','designer'] loop
   updated=regexp_replace(updated,'m[.]role[[:space:]]*=[[:space:]]*'''||k||'''',''''||k||'''=any(m.roles)','g');
  end loop;
  updated=replace(updated,'m.role in (''owner'',''admin'',''finance'')','m.roles && array[''owner'',''admin'',''finance'']');
  updated=replace(updated,'m.role in (''owner'',''admin'')','m.roles && array[''owner'',''admin'']');
  updated=replace(updated,'(role in (''owner'',''admin'',''finance'')','(roles && array[''owner'',''admin'',''finance'']');
  if updated=definition then raise exception 'Role union migration: expected authorization helper not found: %',r.proname;end if;
  execute updated;
 end loop;
end;$$;

-- The legacy owner-only single-role RPC must also clear previous extra roles.
do $$declare definition text;updated text;begin
 definition=pg_get_functiondef('private.work_member(text,text,boolean)'::regprocedure);
 updated=replace(definition,'insert into public.work_members(email,role,active) values(lower(email_address),member_role,enabled)','insert into public.work_members(email,role,roles,active) values(lower(email_address),member_role,array[member_role],enabled)');
 updated=replace(updated,'set role=excluded.role,active=excluded.active','set role=excluded.role,roles=excluded.roles,active=excluded.active');
 if updated=definition then raise exception 'Expected guarded membership function not found';end if;
 execute updated;
end;$$;

create function private.work_assign_roles(email_address text, member_roles text[], enabled boolean) returns void
language plpgsql security definer set search_path='' as $$
declare selected text[]; primary_role text;
begin
 if not private.work_allowed('members') then raise exception using errcode='42501',message='Owner access required';end if;
 if member_roles is null or cardinality(member_roles) not between 1 and 6 or array_position(member_roles,null) is not null or not member_roles <@ array['owner','admin','editor','finance','designer','staff']::text[] then raise exception 'BUSINESS: Choose one or more valid workspace roles.';end if;
 select array_agg(distinct x order by x) into selected from unnest(member_roles) x;
 if 'owner'=any(selected) and cardinality(selected)<>1 then raise exception 'BUSINESS: Owner already includes all authority; assign Owner on its own.';end if;
 select x into primary_role from unnest(array['owner','admin','finance','editor','designer','staff']) x where x=any(selected) limit 1;
 -- Existing guarded helper serializes owner changes, denies self-editing,
 -- protects the last active owner, validates email and records the actor.
 perform private.work_member(email_address,primary_role,enabled);
 update public.work_members set roles=selected where email=lower(email_address);
 insert into public.work_audit(action,entity,entity_id) values('roles_changed:'||array_to_string(selected,',')||';active='||enabled::text,'member',lower(email_address));
end;$$;
revoke all on function private.work_assign_roles(text,text[],boolean) from public,anon;
grant execute on function private.work_assign_roles(text,text[],boolean) to authenticated;
create function public.work_set_roles(email_address text, member_roles text[], enabled boolean) returns void
language sql security invoker set search_path='' as $$select private.work_assign_roles(email_address,member_roles,enabled);$$;
revoke all on function public.work_set_roles(text,text[],boolean) from public,anon;
grant execute on function public.work_set_roles(text,text[],boolean) to authenticated;

-- Apply a chosen set of department permissions atomically. Unselected areas
-- remain unchanged; approve is independent of edit and of membership roles.
create function private.work_grant_areas(email_address text, areas text[], approvals text[], record_scope text, edit boolean) returns void
language plpgsql security definer set search_path='' as $$declare a text;
begin
 if not private.work_allowed('members') then raise exception using errcode='42501',message='Owner access required';end if;
 if areas is null or cardinality(areas) not between 1 and 7 or array_position(areas,null) is not null or not areas <@ array['sales','finance','procurement','inventory','projects','support','reports']::text[] or approvals is null or array_position(approvals,null) is not null or not approvals <@ areas or record_scope not in ('assigned','all') then raise exception 'BUSINESS: Choose valid departments, record scope and approval areas.';end if;
 perform pg_advisory_xact_lock(hashtextextended('lutera-owner-membership',0));
 perform 1 from public.work_members where email=lower(email_address) and active for update;
 if not found then raise exception 'BUSINESS: Choose an active approved colleague.';end if;
 if exists(select 1 from public.work_members where email=lower(email_address) and user_id=auth.uid()) then raise exception 'BUSINESS: Another owner must change your own grants.';end if;
 foreach a in array areas loop
  insert into public.work_grants(email,area,scope,write_access,approve_access) values(lower(email_address),a,record_scope,edit,a=any(approvals))
  on conflict(email,area) do update set scope=excluded.scope,write_access=excluded.write_access,approve_access=excluded.approve_access;
 end loop;
 insert into public.work_audit(action,entity,entity_id) values('department_permissions_changed:'||array_to_string(areas,',')||';approve='||array_to_string(approvals,',')||';scope='||record_scope||';edit='||edit::text,'member',lower(email_address));
end;$$;
revoke all on function private.work_grant_areas(text,text[],text[],text,boolean) from public,anon;
grant execute on function private.work_grant_areas(text,text[],text[],text,boolean) to authenticated;
create function public.work_set_grant_areas(email_address text, areas text[], approvals text[], record_scope text, edit boolean) returns void
language sql security invoker set search_path='' as $$select private.work_grant_areas(email_address,areas,approvals,record_scope,edit);$$;
revoke all on function public.work_set_grant_areas(text,text[],text[],text,boolean) from public,anon;
grant execute on function public.work_set_grant_areas(text,text[],text[],text,boolean) to authenticated;
notify pgrst,'reload schema';
