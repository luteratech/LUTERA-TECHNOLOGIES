-- Owner-operated business suite. No opening balances, tax exemptions or staff are invented.
alter table public.work_members drop constraint work_members_role_check;
alter table public.work_members add constraint work_members_role_check check(role in ('owner','admin','editor','finance','designer','staff'));
create or replace function private.work_member(email_address text, member_role text, enabled boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not private.work_allowed('members') then raise exception 'Owner access required';end if;
 if member_role not in ('owner','admin','editor','finance','designer','staff') or email_address !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(email_address)>254 then raise exception 'Invalid member';end if;
 perform pg_advisory_xact_lock(hashtextextended('lutera-owner-membership',0));
 if exists(select 1 from public.work_members where email=lower(email_address) and user_id=auth.uid()) then raise exception 'Use another owner to change your own access';end if;
 if exists(select 1 from public.work_members where email=lower(email_address) and role='owner' and active) and (member_role<>'owner' or not enabled) and (select count(*) from public.work_members where role='owner' and active)<=1 then raise exception 'BUSINESS: The last active owner cannot be removed.';end if;
 insert into public.work_members(email,role,active) values(lower(email_address),member_role,enabled) on conflict(email) do update set role=excluded.role,active=excluded.active;
 insert into public.work_audit(action,entity,entity_id) values('access_changed','member',lower(email_address));
end;$$;

create table public.work_owner_setup(
 id integer primary key default 1 check(id=1), payload jsonb not null default '{"tax":{"status":"pending","tax_id":"","registration_number":"","vat_status":"unconfirmed","effective_from":"","reference":"","notes":""},"accounting":{"enabled":false,"cutover":"","opening_reviewed":false},"solo_owner":true}',
 version integer not null default 1,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
insert into public.work_owner_setup(id) values(1);
create table public.work_responsibilities(
 email text primary key references public.work_members(email) on update cascade on delete cascade,
 title text not null default '' check(length(title)<=100), duties text not null default '' check(length(duties)<=2000),
 ledger_post boolean not null default false,period_close boolean not null default false,sign_documents boolean not null default false,
 version integer not null default 1,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.work_signature_profiles(
 user_id uuid primary key references auth.users(id),full_name text not null check(length(trim(full_name)) between 1 and 160),
 capacity text not null check(length(trim(capacity)) between 1 and 120),image_data text not null check(length(image_data) between 30 and 200000 and image_data like 'data:image/png;base64,%'),
 version integer not null default 1,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.work_document_signatures(
 id uuid primary key default gen_random_uuid(),source_table text not null check(source_table in ('work_documents','work_commercial','work_expenses')),
 source_id uuid not null,source_version integer not null,source_hash text not null check(source_hash ~ '^[a-f0-9]{64}$'),source_snapshot jsonb not null,
 actor uuid not null references auth.users(id),full_name text not null,capacity text not null,image_data text not null,
 approval_reason text not null check(length(trim(approval_reason)) between 5 and 500),self_approved boolean not null,
 created_at timestamptz not null default now(),unique(source_table,source_id,source_version,actor)
);
create index work_document_signatures_actor_idx on public.work_document_signatures(actor);
create table public.work_ledger_accounts(
 code text primary key check(code ~ '^[A-Z0-9-]{2,20}$'),name text not null check(length(trim(name)) between 1 and 160),
 category text not null check(category in ('asset','liability','equity','income','expense')),cash_account boolean not null default false,
 active boolean not null default true,created_at timestamptz not null default now()
);
insert into public.work_ledger_accounts(code,name,category,cash_account) values
 ('1000','Bank and cash clearing','asset',true),('1100','Customer receivables','asset',false),('1200','Inventory','asset',false),('1300','Input VAT recoverable','asset',false),('1400','Fixed assets','asset',false),('1500','Withholding tax credits','asset',false),
 ('2000','Supplier payables','liability',false),('2100','Output VAT payable','liability',false),('2200','Withholding tax payable','liability',false),('2300','Customer deposits and unapplied receipts','liability',false),
 ('3000','Owner capital','equity',false),('3100','Retained earnings','equity',false),('4000','Equipment and service income','income',false),('5000','Cost of sales','expense',false),('6000','Operating expenses','expense',false);
create table public.work_ledger_journals(
 id uuid primary key default gen_random_uuid(),reference text not null unique,entry_date date not null,currency text not null check(currency in ('NGN','USD','GBP','EUR')),
 description text not null check(length(trim(description)) between 5 and 500),lines jsonb not null check(jsonb_typeof(lines)='array' and jsonb_array_length(lines) between 2 and 50),
 status text not null default 'draft' check(status in ('draft','posted')),source_key text unique,source_snapshot jsonb,
 cash_flow text not null default 'none' check(cash_flow in ('none','operating','investing','financing')),
 reverses uuid unique references public.work_ledger_journals(id),created_by uuid not null default auth.uid() references auth.users(id),posted_by uuid references auth.users(id),posted_at timestamptz,
 request_key uuid not null unique,version integer not null default 1,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index work_ledger_journals_posted_idx on public.work_ledger_journals(entry_date,currency) where status='posted';
create index work_ledger_journals_created_by_idx on public.work_ledger_journals(created_by);
create index work_ledger_journals_posted_by_idx on public.work_ledger_journals(posted_by);
create table public.work_ledger_periods(
 id integer primary key default 1 check(id=1),closed_through date,reason text not null default '',version integer not null default 1,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
insert into public.work_ledger_periods(id) values(1);

create function private.work_suite_allowed(cap text) returns boolean language sql stable security definer set search_path='' as $$
 select private.work_allowed('members') or (private.work_ops_allowed('finance',null,case when cap='read' then 'read' else 'write' end) and
 (cap='read' or exists(select 1 from public.work_responsibilities r join public.work_members m using(email) where m.user_id=auth.uid() and m.active and
 ((cap='post' and r.ledger_post) or (cap='close' and r.period_close) or (cap='sign' and r.sign_documents)))));
$$;
revoke all on function private.work_suite_allowed(text) from public,anon;grant execute on function private.work_suite_allowed(text) to authenticated;
create function private.work_suite_source(tbl text,rid uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare r jsonb;a text;u uuid;
begin
 if not private.work_allowed('session') then raise exception using errcode='42501',message='BUSINESS: Verified account required.';end if;
 if tbl='work_documents' then
  if not private.work_allowed('finance') then raise exception using errcode='42501',message='BUSINESS: Document access required.';end if;
  select to_jsonb(t) into r from public.work_documents t where id=rid;
 elsif tbl='work_commercial' then
  select to_jsonb(t)||jsonb_build_object('lines',(select coalesce(jsonb_agg(to_jsonb(l) order by position),'[]') from public.work_commercial_lines l where record_id=t.id)),private.work_commercial_area(kind),assigned_to into r,a,u from public.work_commercial t where id=rid;
  if not private.work_ops_allowed(a,u) then raise exception using errcode='42501',message='BUSINESS: Document access required.';end if;
 elsif tbl='work_expenses' then
  if not private.work_ops_allowed('finance',null) then raise exception using errcode='42501',message='BUSINESS: Finance access required.';end if;
  select to_jsonb(t) into r from public.work_expenses t where id=rid;
 else raise exception 'BUSINESS: Unsupported document type.';end if;
 if r is null then raise exception 'BUSINESS: Document was not found.';end if;
 return r;
end;$$;
revoke all on function private.work_suite_source(text,uuid) from public,anon;grant execute on function private.work_suite_source(text,uuid) to authenticated;

create function private.work_suite_audit() returns trigger language plpgsql security definer set search_path='' as $$
declare r jsonb;begin r=case when TG_OP='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 insert into public.work_audit(action,entity,entity_id) values(lower(TG_OP),TG_TABLE_NAME,coalesce(r->>'id',r->>'email',r->>'user_id',r->>'code'));
 if TG_OP='DELETE' then return old;end if;return new;end;$$;
revoke all on function private.work_suite_audit() from public,anon,authenticated;
-- No direct writes: APIs and direct RPCs share live MFA/authorization checks.
do $$declare t text;begin
 foreach t in array array['work_owner_setup','work_responsibilities','work_signature_profiles','work_document_signatures','work_ledger_accounts','work_ledger_journals','work_ledger_periods'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
  if t not in ('work_document_signatures','work_ledger_accounts') then execute format('create trigger %I before update on public.%I for each row execute function private.work_touch()',t||'_touch',t);end if;
  execute format('create trigger %I after insert or update or delete on public.%I for each row execute function private.work_suite_audit()',t||'_audit',t);
 end loop;
end;$$;
-- Responsibilities/profile tables use email/user_id keys, not the generic id touch helper.
drop trigger work_responsibilities_touch on public.work_responsibilities;
drop trigger work_signature_profiles_touch on public.work_signature_profiles;
create policy suite_setup_owner on public.work_owner_setup for select to authenticated using((select private.work_allowed('members')));
create policy suite_responsibilities on public.work_responsibilities for select to authenticated using((select private.work_allowed('members')) or email=(select email from public.work_members where user_id=(select auth.uid())));
create policy suite_profile_self on public.work_signature_profiles for select to authenticated using(user_id=(select auth.uid()) and (select private.work_allowed('session')));
create policy suite_signature_read on public.work_document_signatures for select to authenticated using((select private.work_suite_allowed('read')) or actor=(select auth.uid()) and (select private.work_allowed('session')));
create policy suite_accounts_read on public.work_ledger_accounts for select to authenticated using((select private.work_suite_allowed('read')));
create policy suite_journals_read on public.work_ledger_journals for select to authenticated using((select private.work_suite_allowed('read')));
create policy suite_periods_read on public.work_ledger_periods for select to authenticated using((select private.work_suite_allowed('read')));

create function private.work_ledger_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if old.status='posted' then raise exception 'BUSINESS: Posted journals are immutable. Create a reversal.';end if;
 if TG_OP='DELETE' then return old;end if;
 return new;
end;$$;
create trigger work_ledger_immutable before update or delete on public.work_ledger_journals for each row execute function private.work_ledger_guard();

create function private.work_suite(c jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare act text=c->>'action';d jsonb=coalesce(c->'data','{}');s public.work_owner_setup;r jsonb;p public.work_signature_profiles;j public.work_ledger_journals;
 rid uuid;line jsonb;debit numeric=0;credit numeric=0;v integer;own boolean;key uuid;closed date;source jsonb;sourcekey text;tbl text;amount bigint;tax bigint=0;net bigint;cur text;dt date;account text;
begin
 if not private.work_allowed('session') then raise exception using errcode='42501',message='BUSINESS: Complete MFA and sign in again.';end if;
 own=private.work_allowed('members');
 if act='capabilities' then
  return jsonb_build_object('owner',own,'read',private.work_suite_allowed('read'),'write',private.work_ops_allowed('finance',null,'write'),'post',private.work_suite_allowed('post'),'close',private.work_suite_allowed('close'),'sign',own or exists(select 1 from public.work_responsibilities r join public.work_members m using(email) where m.user_id=auth.uid() and m.active and r.sign_documents),'accounting_enabled',coalesce((select (payload#>>'{accounting,enabled}')::boolean from public.work_owner_setup where id=1),false),'tax_status',(select payload#>>'{tax,status}' from public.work_owner_setup where id=1));
 elsif act='setup' then
  if not own then raise exception using errcode='42501',message='BUSINESS: Owner access required.';end if;
  select * into s from public.work_owner_setup where id=1 for update;
  if s.version<>(c->>'version')::integer then raise exception 'BUSINESS: Setup changed. Refresh before saving.';end if;
  if jsonb_typeof(d)<>'object' or length(d::text)>16000 or d#>>'{tax,status}' not in ('pending','confirmed') or d#>>'{tax,vat_status}' not in ('unconfirmed','registered','exempt','not_registered') then raise exception 'BUSINESS: Invalid company setup.';end if;
  if d#>>'{tax,status}'='confirmed' and (length(trim(coalesce(d#>>'{tax,reference}','')))<5 or nullif(d#>>'{tax,effective_from}','') is null or d#>>'{tax,vat_status}'='unconfirmed') then raise exception 'BUSINESS: Confirm the tax treatment, effective date and supporting reference.';end if;
  if d#>>'{tax,status}'='confirmed' and d#>>'{tax,vat_status}'='registered' and (length(trim(coalesce(d#>>'{tax,tax_id}','')))<3 or length(trim(coalesce(d#>>'{tax,registration_number}','')))<3) then raise exception 'BUSINESS: Tax ID and company registration number are required for VAT invoices.';end if;
  if coalesce((d#>>'{accounting,enabled}')::boolean,false) and (not coalesce((d#>>'{accounting,opening_reviewed}')::boolean,false) or nullif(d#>>'{accounting,cutover}','') is null) then raise exception 'BUSINESS: Review opening balances and select the accounting start date before activation.';end if;
  if coalesce((s.payload#>>'{accounting,enabled}')::boolean,false) and (d#>>'{accounting,cutover}' is distinct from s.payload#>>'{accounting,cutover}') then raise exception 'BUSINESS: The accounting start date is locked after activation.';end if;
  update public.work_owner_setup set payload=d where id=1 returning to_jsonb(work_owner_setup.*) into r;return r;
 elsif act='responsibilities' then
  if not own then raise exception using errcode='42501',message='BUSINESS: Owner access required.';end if;
  if exists(select 1 from public.work_members where email=lower(d->>'email') and user_id=auth.uid()) then raise exception 'BUSINESS: Your Owner authority is already protected; configure a colleague instead.';end if;
  insert into public.work_responsibilities(email,title,duties,ledger_post,period_close,sign_documents) values(lower(d->>'email'),coalesce(d->>'title',''),coalesce(d->>'duties',''),coalesce((d->>'ledger_post')::boolean,false),coalesce((d->>'period_close')::boolean,false),coalesce((d->>'sign_documents')::boolean,false))
  on conflict(email) do update set title=excluded.title,duties=excluded.duties,ledger_post=excluded.ledger_post,period_close=excluded.period_close,sign_documents=excluded.sign_documents,version=work_responsibilities.version+1,updated_at=now();return jsonb_build_object('success',true);
 elsif act='signature-profile' then
  insert into public.work_signature_profiles(user_id,full_name,capacity,image_data) values(auth.uid(),d->>'full_name',d->>'capacity',d->>'image_data') on conflict(user_id) do update set full_name=excluded.full_name,capacity=excluded.capacity,image_data=excluded.image_data,version=work_signature_profiles.version+1,updated_at=now();
  return jsonb_build_object('success',true);
 elsif act in ('document-preview','signature-read','sign') then
  tbl=d->>'source_table';rid=(d->>'source_id')::uuid;r=private.work_suite_source(tbl,rid);
  if act='document-preview' then return r||jsonb_build_object('_approval_hash',encode(sha256(convert_to(r::text,'UTF8')),'hex'));end if;
  if act='signature-read' then return coalesce((select jsonb_agg(to_jsonb(t)-'source_snapshot') from public.work_document_signatures t where source_table=tbl and source_id=rid and source_version=(r->>'version')::integer and source_hash=encode(sha256(convert_to(r::text,'UTF8')),'hex')),'[]');end if;
  if not own and not (exists(select 1 from public.work_responsibilities rr join public.work_members m using(email) where m.user_id=auth.uid() and rr.sign_documents) and private.work_ops_allowed(case when tbl='work_commercial' then private.work_commercial_area(r->>'kind') else 'finance' end,nullif(r->>'assigned_to','')::uuid,'approve')) then raise exception using errcode='42501',message='BUSINESS: Signing and approval authority required.';end if;
  if not exists(select 1 from jsonb_array_elements(coalesce(auth.jwt()->'amr','[]')) a where a->>'method'='totp' and (a->>'timestamp')::numeric between extract(epoch from now())-300 and extract(epoch from now())+30) then raise exception 'BUSINESS: Verify your authenticator again before signing.';end if;
  if r->>'status' not in ('issued','approved') or (r->>'version')::integer<>(d->>'source_version')::integer then raise exception 'BUSINESS: Sign only the current issued or approved document. Refresh it first.';end if;
  if d->>'expected_hash' is distinct from encode(sha256(convert_to(r::text,'UTF8')),'hex') then raise exception 'BUSINESS: The document changed. Review it again before signing.';end if;
  select * into p from public.work_signature_profiles where user_id=auth.uid();if not found then raise exception 'BUSINESS: Save your personal signature first.';end if;
  if length(trim(coalesce(d->>'reason','')))<5 then raise exception 'BUSINESS: Enter an approval reason.';end if;
  select coalesce((payload->>'solo_owner')::boolean,false) into own from public.work_owner_setup where id=1;
  if coalesce(r->>'created_by',auth.uid()::text)=auth.uid()::text and not (private.work_allowed('members') and own) then raise exception 'BUSINESS: Another authorised approver must sign this document.';end if;
  insert into public.work_document_signatures(source_table,source_id,source_version,source_hash,source_snapshot,actor,full_name,capacity,image_data,approval_reason,self_approved)
  values(tbl,rid,(r->>'version')::integer,encode(sha256(convert_to(r::text,'UTF8')),'hex'),r,auth.uid(),p.full_name,p.capacity,p.image_data,d->>'reason',coalesce(r->>'created_by',auth.uid()::text)=auth.uid()::text)
  on conflict(source_table,source_id,source_version,actor) do nothing;
  return jsonb_build_object('success',true);
 elsif act='account' then
  if not own then raise exception using errcode='42501',message='BUSINESS: Owner access required.';end if;
  insert into public.work_ledger_accounts(code,name,category,cash_account) values(d->>'code',d->>'name',d->>'category',coalesce((d->>'cash_account')::boolean,false));return jsonb_build_object('success',true);
 end if;
 if not private.work_suite_allowed('read') then raise exception using errcode='42501',message='BUSINESS: Accounting access required.';end if;
 select * into s from public.work_owner_setup where id=1;
 if act='reports' then
  return jsonb_build_object('balances',coalesce((select jsonb_agg(to_jsonb(b)) from (
   select a.code,a.name,a.category,a.cash_account,x.currency,sum(x.debit-x.credit) balance_minor from public.work_ledger_accounts a join
   (select l->>'account' code,jj.currency,(l->>'debit_minor')::bigint debit,(l->>'credit_minor')::bigint credit from public.work_ledger_journals jj cross join lateral jsonb_array_elements(jj.lines) l where jj.status='posted' and jj.entry_date<=coalesce(nullif(d->>'to','')::date,current_date)) x using(code)
   group by a.code,a.name,a.category,a.cash_account,x.currency order by a.code,x.currency)b),'[]'),
   'activity',coalesce((select jsonb_agg(to_jsonb(b)) from (select jj.reference,jj.entry_date,jj.currency,jj.description,jj.cash_flow,l.* from public.work_ledger_journals jj cross join lateral jsonb_to_recordset(jj.lines) l(account text,debit_minor bigint,credit_minor bigint) where jj.status='posted' and jj.entry_date between coalesce(nullif(d->>'from','')::date,date_trunc('year',current_date)::date) and coalesce(nullif(d->>'to','')::date,current_date) order by jj.entry_date,jj.reference)b),'[]')) || private.work_ledger_source_review(coalesce(nullif(d->>'to','')::date,current_date));
 end if;
 perform pg_advisory_xact_lock(hashtextextended('lutera-ledger',0));
 select closed_through into closed from public.work_ledger_periods where id=1 for update;
 if act='close' or act='reopen' then
  if not coalesce((s.payload#>>'{accounting,enabled}')::boolean,false) then raise exception 'BUSINESS: Complete accounting setup before closing periods.';end if;
  if not private.work_suite_allowed('close') or act='reopen' and not own then raise exception using errcode='42501',message='BUSINESS: Period closing authority required.';end if;
  if length(trim(coalesce(d->>'reason','')))<5 then raise exception 'BUSINESS: Record the reconciliation or reopening reason.';end if;
  if act='close' and (d->>'through')::date>current_date then raise exception 'BUSINESS: A future period cannot be closed.';end if;
  if act='close' and exists(select 1 from public.work_ledger_journals where status='draft' and entry_date<=(d->>'through')::date) then raise exception 'BUSINESS: Review outstanding draft journals before closing.';end if;
  if act='close' and closed is not null and (d->>'through')::date<=closed then raise exception 'BUSINESS: Use the owner reopening action to change a closed period.';end if;
  if not coalesce((d->>'reconciled')::boolean,false) then raise exception 'BUSINESS: Confirm the balances and bank accounts have been reconciled.';end if;
  if act='close' then source=private.work_ledger_source_review((d->>'through')::date);if (source->>'pending_count')::integer>0 or (source->>'changed_count')::integer>0 then raise exception 'BUSINESS: Post outstanding business sources and resolve changed source records before closing.';end if;end if;
  update public.work_ledger_periods set closed_through=case when act='reopen' then null else (d->>'through')::date end,reason=d->>'reason' where id=1;return jsonb_build_object('success',true);
 end if;
 if not private.work_ops_allowed('finance',null,'write') then raise exception using errcode='42501',message='BUSINESS: Finance editing authority required.';end if;
 if act='source' then
  tbl=d->>'source_table';rid=(d->>'source_id')::uuid;
  if tbl not in ('work_commercial','work_payments','work_allocations','work_expenses','work_supplier_payments','work_refunds') then raise exception 'BUSINESS: Unsupported accounting source.';end if;
  sourcekey=tbl||'/'||rid;select * into j from public.work_ledger_journals x where (x.source_key=sourcekey or x.source_key like sourcekey||'/%') and not exists(select 1 from public.work_ledger_journals rev where rev.reverses=x.id) order by created_at desc limit 1;
  if found then return to_jsonb(j);end if;
  if tbl='work_commercial' then
   source=private.work_suite_source(tbl,rid);
   if source->>'status'<>'issued' or source->>'kind' not in ('invoice','credit') then raise exception 'BUSINESS: Select an issued invoice or credit note.';end if;
   select sum(quantity::numeric*unit_minor)-(source->>'discount_minor')::numeric into net from public.work_commercial_lines where record_id=rid;
   amount=(source->>'total_minor')::bigint;tax=amount-net;dt=(source->>'document_date')::date;cur=source->>'currency';
   r=jsonb_build_array(jsonb_build_object('account','1100','debit_minor',amount,'credit_minor',0),jsonb_build_object('account','4000','debit_minor',0,'credit_minor',net));
   if tax>0 then r=r||jsonb_build_array(jsonb_build_object('account','2100','debit_minor',0,'credit_minor',tax));end if;
   if source->>'kind'='credit' then select jsonb_agg(jsonb_build_object('account',l->>'account','debit_minor',(l->>'credit_minor')::bigint,'credit_minor',(l->>'debit_minor')::bigint)) into r from jsonb_array_elements(r) l;end if;
  else
   execute format('select to_jsonb(t) from public.%I t where id=$1',tbl) using rid into source;
   if source is null then raise exception 'BUSINESS: Accounting source not found.';end if;
   amount=(source->>'amount_minor')::bigint;
   if tbl='work_payments' then
    if source->>'status'<>'confirmed' then raise exception 'BUSINESS: Only confirmed receipts can be imported.';end if;
    cur=source->>'currency';dt=(source->>'paid_on')::date;account='2300';
    r=jsonb_build_array(jsonb_build_object('account','1000','debit_minor',amount,'credit_minor',0),jsonb_build_object('account',account,'debit_minor',0,'credit_minor',amount));
   elsif tbl='work_expenses' then
    if source->>'status'<>'approved' then raise exception 'BUSINESS: Approve the bill first.';end if;
    account=coalesce(d->>'debit_account','6000');if not exists(select 1 from public.work_ledger_accounts where code=account and category in ('asset','expense') and active) then raise exception 'BUSINESS: Select an expense or asset account.';end if;
    cur=source->>'currency';dt=(source->>'incurred_on')::date;
    r=jsonb_build_array(jsonb_build_object('account',account,'debit_minor',amount,'credit_minor',0),jsonb_build_object('account','2000','debit_minor',0,'credit_minor',amount));
   elsif tbl='work_allocations' then
    if source->>'reversed_at' is not null then raise exception 'BUSINESS: Reversed allocations cannot be imported.';end if;
    select currency into cur from public.work_payments where id=(source->>'payment_id')::uuid;dt=(source->>'created_at')::timestamptz at time zone 'Africa/Lagos';
    r=jsonb_build_array(jsonb_build_object('account','2300','debit_minor',amount,'credit_minor',0),jsonb_build_object('account','1100','debit_minor',0,'credit_minor',amount));
   elsif tbl='work_supplier_payments' then
    if source->>'reversed_at' is not null then raise exception 'BUSINESS: Reversed supplier payments cannot be imported.';end if;
    select currency into cur from public.work_expenses where id=(source->>'expense_id')::uuid;dt=(source->>'paid_on')::date;
    r=jsonb_build_array(jsonb_build_object('account','2000','debit_minor',amount,'credit_minor',0),jsonb_build_object('account','1000','debit_minor',0,'credit_minor',amount));
   else
    select currency into cur from public.work_payments where id=(source->>'payment_id')::uuid;dt=(source->>'created_at')::timestamptz at time zone 'Africa/Lagos';
    r=jsonb_build_array(jsonb_build_object('account','2300','debit_minor',amount,'credit_minor',0),jsonb_build_object('account','1000','debit_minor',0,'credit_minor',amount));
   end if;
  end if;
  if nullif(s.payload#>>'{accounting,cutover}','') is null or dt<(s.payload#>>'{accounting,cutover}')::date then raise exception 'BUSINESS: Set an accounting start date and reconcile earlier records through opening balances.';end if;
  insert into public.work_ledger_journals(reference,entry_date,currency,description,lines,request_key,source_key,source_snapshot,cash_flow)
  values(private.work_number('JRN'),dt,cur,'Imported '||coalesce(source->>'number',source->>'title',tbl)||' · '||rid,r,(c->>'request_key')::uuid,sourcekey||'/'||gen_random_uuid(),source,case when tbl in ('work_payments','work_supplier_payments','work_refunds') then 'operating' else 'none' end) returning to_jsonb(work_ledger_journals.*) into r;return r;
 elsif act='journal-delete' then
  delete from public.work_ledger_journals where id=(d->>'id')::uuid and version=(d->>'version')::integer and status='draft';if not found then raise exception 'BUSINESS: Only a current draft journal can be deleted.';end if;return jsonb_build_object('success',true);
 elsif act='journal-update' then
  update public.work_ledger_journals set entry_date=(d->>'entry_date')::date,currency=d->>'currency',description=d->>'description',lines=d->'lines',cash_flow=d->>'cash_flow' where id=(d->>'id')::uuid and version=(d->>'version')::integer and status='draft' and source_key is null returning to_jsonb(work_ledger_journals.*) into r;
  if r is null then raise exception 'BUSINESS: Only a current manual draft can be edited.';end if;return r;
 elsif act='journal-save' then
  key=(c->>'request_key')::uuid;select * into j from public.work_ledger_journals where request_key=key;
  if found then if j.lines<>d->'lines' or j.entry_date<>(d->>'entry_date')::date or j.description<>d->>'description' or j.currency<>d->>'currency' then raise exception 'BUSINESS: This request key was already used for different journal details.';end if;return to_jsonb(j);end if;
  insert into public.work_ledger_journals(reference,entry_date,currency,description,lines,request_key,cash_flow) values(private.work_number('JRN'),(d->>'entry_date')::date,d->>'currency',d->>'description',d->'lines',key,coalesce(d->>'cash_flow','none')) returning to_jsonb(work_ledger_journals.*) into r;return r;
 elsif act='journal-post' or act='journal-reverse' then
  if not private.work_suite_allowed('post') then raise exception using errcode='42501',message='BUSINESS: Ledger posting authority required.';end if;
  select * into j from public.work_ledger_journals where id=(d->>'id')::uuid for update;
  if not found or j.version<>(d->>'version')::integer then raise exception 'BUSINESS: Journal changed. Refresh before continuing.';end if;
  if not coalesce((s.payload#>>'{accounting,enabled}')::boolean,false) then raise exception 'BUSINESS: The owner must complete accounting setup before posting.';end if;
  dt=case when act='journal-reverse' then (d->>'entry_date')::date else j.entry_date end;
  if dt<nullif(s.payload#>>'{accounting,cutover}','')::date or dt<=closed then raise exception 'BUSINESS: This accounting date is closed or before the start date.';end if;
  if act='journal-reverse' then
   if j.status<>'posted' or length(trim(coalesce(d->>'reason','')))<5 then raise exception 'BUSINESS: Select a posted journal and record the reversal reason.';end if;
   insert into public.work_ledger_journals(reference,entry_date,currency,description,lines,request_key,cash_flow,reverses,status,posted_by,posted_at)
   values(private.work_number('JRN'),dt,j.currency,'Reversal: '||(d->>'reason'),(select jsonb_agg(jsonb_build_object('account',l->>'account','debit_minor',(l->>'credit_minor')::bigint,'credit_minor',(l->>'debit_minor')::bigint)) from jsonb_array_elements(j.lines) l),(c->>'request_key')::uuid,j.cash_flow,j.id,'posted',auth.uid(),now()) returning to_jsonb(work_ledger_journals.*) into r;return r;
  end if;
  if j.status='posted' then return to_jsonb(j);end if;
  if s.payload#>>'{tax,status}'<>'confirmed' and exists(select 1 from jsonb_array_elements(j.lines) l where l->>'account' in ('1300','1500','2100','2200')) then raise exception 'BUSINESS: Complete the tax profile before posting tax account entries.';end if;
  if j.source_key is not null then
   tbl=split_part(j.source_key,'/',1);rid=split_part(j.source_key,'/',2)::uuid;
   if tbl='work_commercial' then source=private.work_suite_source(tbl,rid);else execute format('select to_jsonb(t) from public.%I t where id=$1',tbl) using rid into source;end if;
   if source is distinct from j.source_snapshot then raise exception 'BUSINESS: The source changed. Delete the draft and import the current source again.';end if;
  end if;
  foreach line in array array(select jsonb_array_elements(j.lines)) loop
   if not exists(select 1 from public.work_ledger_accounts where code=line->>'account' and active) or coalesce((line->>'debit_minor')::numeric,-1)<0 or coalesce((line->>'credit_minor')::numeric,-1)<0 or (line->>'debit_minor')::numeric*(line->>'credit_minor')::numeric<>0 or (line->>'debit_minor')::numeric+(line->>'credit_minor')::numeric<=0 or (line->>'debit_minor')::numeric<>trunc((line->>'debit_minor')::numeric) or (line->>'credit_minor')::numeric<>trunc((line->>'credit_minor')::numeric) then raise exception 'BUSINESS: Each line needs an active account and a positive debit or credit in minor units.';end if;
   debit=debit+(line->>'debit_minor')::numeric;credit=credit+(line->>'credit_minor')::numeric;
  end loop;
  if debit<>credit or debit<=0 or debit>1000000000000 then raise exception 'BUSINESS: Journal debits and credits must balance within the supported amount limit.';end if;
  update public.work_ledger_journals set status='posted',posted_by=auth.uid(),posted_at=now() where id=j.id returning to_jsonb(work_ledger_journals.*) into r;return r;
 end if;
 raise exception 'BUSINESS: Unknown suite action.';
end;$$;
revoke all on function private.work_suite(jsonb) from public,anon;grant execute on function private.work_suite(jsonb) to authenticated;
create function public.work_suite(c jsonb) returns jsonb language sql security invoker set search_path='' as $$ select private.work_suite(c) $$;
revoke all on function public.work_suite(jsonb) from public,anon;grant execute on function public.work_suite(jsonb) to authenticated;

-- Extend existing encrypted snapshots without changing their proof or file controls.
do $$declare def text;begin
 select pg_get_functiondef('private.work_backup_job(text,jsonb)'::regprocedure) into def;
 def=replace(def,'''work_members'',''work_settings''','''work_owner_setup'',''work_responsibilities'',''work_signature_profiles'',''work_document_signatures'',''work_ledger_accounts'',''work_ledger_journals'',''work_ledger_periods'',''work_members'',''work_settings''');
 if position('work_owner_setup' in def)=0 then raise exception 'Backup coverage extension failed';end if;
 execute def;
end;$$;

-- Company tax details can remain pending; no invoice is presented as tax-ready.
create function private.work_invoice_tax_setup() returns trigger language plpgsql security definer set search_path='' as $$
declare tax jsonb;
begin
 if new.status='issued' and old.status='draft' and new.kind='invoice' then
  select payload->'tax' into tax from public.work_owner_setup where id=1;
  if tax->>'status'<>'confirmed' or nullif(tax->>'effective_from','')::date>new.document_date then raise exception 'BUSINESS: Complete the owner tax profile for this date before issuing a sales invoice. You can save drafts meanwhile.';end if;
  if new.tax_bps>0 and (tax->>'vat_status'<>'registered' or new.tax_bps<>750) then raise exception 'BUSINESS: Confirm VAT registration and the applicable Nigerian VAT treatment before charging VAT.';end if;
  if new.tax_bps=0 and tax->>'vat_status'='registered' and length(trim(new.notes))<5 then raise exception 'BUSINESS: Record why this supply has no VAT before issuing.';end if;
  new.snapshot=jsonb_set(new.snapshot,'{company}',(new.snapshot->'company')||jsonb_build_object('tax_id',tax->>'tax_id','registration_number',tax->>'registration_number'))||jsonb_build_object('tax_profile_snapshot',jsonb_build_object('status',tax->>'status','vat_status',tax->>'vat_status','effective_from',tax->>'effective_from'));
 end if;return new;
end;$$;
revoke all on function private.work_invoice_tax_setup() from public,anon,authenticated;
create trigger work_invoice_tax_setup before update on public.work_commercial for each row execute function private.work_invoice_tax_setup();

-- Include only signatures for the currently issued revision in authorised mail jobs.
do $$declare def text;begin
 select pg_get_functiondef('private.work_job(text,jsonb)'::regprocedure) into def;
 def=replace(def,'rows=rows||jsonb_build_array(payload);',
 'payload=payload||jsonb_build_object(''approvals'',coalesce((select jsonb_agg(to_jsonb(s)-array[''source_snapshot'',''approval_reason'',''actor'']) from public.work_document_signatures s where ((s.source_table=''work_commercial'' and s.source_id=msg.record_id and s.source_version=(select version from public.work_commercial where id=msg.record_id)) or (s.source_table=''work_documents'' and s.source_id=msg.document_id and s.source_version=(select version from public.work_documents where id=msg.document_id)))),''[]''::jsonb)); rows=rows||jsonb_build_array(payload);');
 if position('''approvals''' in def)=0 then raise exception 'Signed mail coverage failed';end if;execute def;
end;$$;

-- Manual encrypted snapshots cover the same new records.
do $$declare def text;begin
 select pg_get_functiondef('private.work_backup()'::regprocedure) into def;
 def=replace(def,'''work_grants'',''work_customers''','''work_owner_setup'',''work_responsibilities'',''work_signature_profiles'',''work_document_signatures'',''work_ledger_accounts'',''work_ledger_journals'',''work_ledger_periods'',''work_grants'',''work_customers''');
 if position('work_owner_setup' in def)=0 then raise exception 'Manual backup extension failed';end if;execute def;
end;$$;

-- A ledger reader does not automatically gain supplier-document signature access.
drop policy suite_signature_read on public.work_document_signatures;
create policy suite_signature_read on public.work_document_signatures for select to authenticated using(
 (select private.work_allowed('members')) or (actor=(select auth.uid()) and (select private.work_allowed('session'))) or
 (source_table='work_documents' and (select private.work_allowed('finance'))) or
 (source_table='work_commercial' and exists(select 1 from public.work_commercial c where c.id=work_document_signatures.source_id)) or
 (source_table='work_expenses' and (select private.work_ops_allowed('finance',null)))
);

-- Portal authorisation remains in the original helper; only approved shared
-- current-revision signatures and the document revision are added to its output.
do $$declare def text;begin
 select pg_get_functiondef('private.work_portal_initial(text,jsonb)'::regprocedure) into def;
 def=replace(def,'''id'',r.id,''kind''','''id'',r.id,''version'',r.version,''kind''');
 def=replace(def,'''id'',d.id,''kind''','''id'',d.id,''version'',d.version,''kind''');
 def=replace(def,'if r.id is not null then return jsonb_build_object(''record'',',
 'if r.id is not null then return jsonb_build_object(''approvals'',coalesce((select jsonb_agg(to_jsonb(s)-array[''source_snapshot'',''approval_reason'',''actor'']) from public.work_document_signatures s where s.source_table=''work_commercial'' and s.source_id=r.id and s.source_version=r.version),''[]''::jsonb))||jsonb_build_object(''record'',');
 def=replace(def,'return jsonb_build_object(''legacy'',',
 'return jsonb_build_object(''approvals'',coalesce((select jsonb_agg(to_jsonb(s)-array[''source_snapshot'',''approval_reason'',''actor'']) from public.work_document_signatures s where s.source_table=''work_documents'' and s.source_id=d.id and s.source_version=d.version),''[]''::jsonb))||jsonb_build_object(''legacy'',');
 if position('''approvals''' in def)=0 then raise exception 'Signed portal coverage failed';end if;execute def;
end;$$;

-- Assignment is not authorship. Preserve an authenticated preparer for new documents;
-- historical records stay unknown rather than inventing an independent reviewer.
alter table public.work_documents add column created_by uuid references auth.users(id) default auth.uid();
alter table public.work_commercial add column created_by uuid references auth.users(id) default auth.uid();
create index work_documents_creator_idx on public.work_documents(created_by);
create index work_commercial_creator_idx on public.work_commercial(created_by);
create function private.work_document_creator() returns trigger language plpgsql set search_path='' as $$
begin
 if TG_OP='INSERT' then new.created_by=auth.uid();elsif new.created_by is distinct from old.created_by then raise exception 'BUSINESS: Document authorship cannot be changed.';end if;return new;
end;$$;
revoke all on function private.work_document_creator() from public,anon,authenticated;
create trigger work_documents_creator before insert or update on public.work_documents for each row execute function private.work_document_creator();
create trigger work_commercial_creator before insert or update on public.work_commercial for each row execute function private.work_document_creator();

-- Reconcile source coverage before period closing. Changes to bank-match flags
-- are not accounting changes; cancellations/reversals and financial edits are.
create function private.work_ledger_source_review(through_date date default current_date) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;cutover date;
begin
 if not private.work_suite_allowed('read') then raise exception using errcode='42501',message='BUSINESS: Accounting access required.';end if;
 select nullif(payload#>>'{accounting,cutover}','')::date into cutover from public.work_owner_setup where id=1;
 with sources as (
  select 'work_commercial' tbl,c.id,c.document_date dt,c.status='issued' eligible,coalesce(c.number,c.title) label,to_jsonb(c)||jsonb_build_object('lines',(select coalesce(jsonb_agg(to_jsonb(l) order by position),'[]') from public.work_commercial_lines l where record_id=c.id)) facts from public.work_commercial c where kind in ('invoice','credit')
  union all select 'work_payments',p.id,p.paid_on,p.status='confirmed',coalesce((select number from public.work_documents where id=p.receipt_id),p.reference),to_jsonb(p) from public.work_payments p
  union all select 'work_allocations',a.id,(a.created_at at time zone 'Africa/Lagos')::date,a.reversed_at is null,'Payment allocation',to_jsonb(a) from public.work_allocations a
  union all select 'work_expenses',e.id,e.incurred_on,e.status='approved',e.title,to_jsonb(e) from public.work_expenses e
  union all select 'work_supplier_payments',p.id,p.paid_on,p.reversed_at is null,p.reference,to_jsonb(p) from public.work_supplier_payments p
  union all select 'work_refunds',r.id,(r.created_at at time zone 'Africa/Lagos')::date,true,r.reason,to_jsonb(r) from public.work_refunds r
 ), checks as (
  select s.tbl,s.id,s.dt,s.label,s.eligible and j.status is distinct from 'posted' pending,
   j.status='posted' and (not s.eligible or (s.facts-array['version','updated_at','reconciled','assigned_to']) is distinct from (j.source_snapshot-array['version','updated_at','reconciled','assigned_to'])) changed
  from sources s left join lateral (select * from public.work_ledger_journals jj where (jj.source_key=s.tbl||'/'||s.id or jj.source_key like s.tbl||'/'||s.id||'/%') and not exists(select 1 from public.work_ledger_journals rev where rev.reverses=jj.id) order by created_at desc limit 1) j on true
  where s.dt>=cutover and s.dt<=through_date
 ) select jsonb_build_object('pending_count',(select count(*) from checks where pending),'changed_count',(select count(*) from checks where changed),'pending_sources',coalesce((select jsonb_agg(to_jsonb(t)) from (select tbl,id,dt,label from checks where pending order by dt,id limit 100)t),'[]'),'changed_sources',coalesce((select jsonb_agg(to_jsonb(t)) from (select tbl,id,dt,label from checks where changed order by dt,id limit 100)t),'[]')) into result;
 return result;
end;$$;
revoke all on function private.work_ledger_source_review(date) from public,anon;grant execute on function private.work_ledger_source_review(date) to authenticated;

notify pgrst, 'reload schema';
