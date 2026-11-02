# Lutera accounting readiness: information and acceptance checklist

2 November 2026. This is a collection checklist, not a claim that the accounts
or Nigerian tax treatment are already approved. The owner can perform the
company review while there are no other staff. Do not send passwords, MFA
codes, banking login details, backup keys or customer personal data in chat.
Enter sensitive records through the private workspace or a controlled import.

## 1. Company and accounting setup

Supply or confirm:

- Legal name: **Lutera Technology Ltd**. RC number, Tax ID and tax registration
  records can remain pending in Owner settings until available.
- Accounting start/cutover date, financial year end and first reporting period.
  Choose the date at which the balances below will be measured.
- Functional/reporting currency (confirm NGN), other transaction currencies,
  and approved source/date for any exchange rates.
- Bank and cash account names, account currencies, and statement balances at
  cutover. For displayed invoice instructions: bank name, account name and
  account number. Banking passwords and access tokens are never needed.
- Whether the business has traded before cutover. If it has not, confirm which
  balances are genuinely zero; do not substitute assumed zero balances.
- Document starting references, quotation validity, invoice payment terms,
  rounding/discount policy, and who can issue, sign, reverse or approve records.
  Approvals remain required; monetary limits stay unset until the owner decides.

## 2. Opening balance pack

Provide an as-of date and supporting source for each balance. One reconciled
opening journal must balance; importing historical source records must not
post their opening amounts a second time.

| Area | Information needed | Reconciliation |
| --- | --- | --- |
| Bank/cash | Statement balances, cash count, outstanding deposits/payments | Each ledger account to its statement/cash count |
| Customer receivables | Unpaid invoice references, customer, currency, original value, credits, receipts and balance | Customer list to receivables control account |
| Supplier payables | Unpaid bill references, supplier, currency, credits, payments and balance | Supplier list to payables control account |
| Advances/deposits | Customer advances and supplier deposits, purpose and unallocated amount | Liability/asset controls; do not treat deposits as sales |
| Stock | SKU, location, quantity, supported unit/landed cost, serials and ownership | Physical count and cost schedule to inventory value |
| Fixed assets | Description, acquisition/in-service dates, supported cost, accumulated depreciation and useful life | Asset register to cost/depreciation controls |
| Owner funding/loans | Capital contributions, drawings, loans, interest and repayment terms | Funding evidence to equity and loan balances |
| Tax and other balances | Taxes owed/credits, accruals, prepayments and other balances with evidence | Supporting schedules to each control account |

Mark missing evidence explicitly. Do not enable ledger posting merely to clear
an onboarding warning. Review the opening trial balance and select **Opening
balances reviewed** only when it is supported.

## 3. Nigerian tax information, when ready

Tax records remain optional/pending in Owner settings now. Before using tax
calculations operationally, supply the company's actual registration status,
effective dates and supporting notices. Incorporation alone does not determine
VAT or withholding treatment.

- Tax ID/registration details, VAT registration/applicability and effective date.
- Relevant turnover/business-category facts, goods/services supplied, customer
  locations and any documented exemptions or special treatment.
- Applicable withholding obligations and evidence of tax withheld by customers;
  distinguish withholding credits from discounts or money received.
- Imports/customs duties and any recoverable versus non-recoverable taxes.
- Prior returns, opening liabilities/credits and filing/remittance obligations.
- Payroll obligations only if/when staff are employed; no staff/payroll data
  should be invented for the present owner-only business.

Rates, thresholds, effective dates, tax bases, rounding, exemptions and required
invoice disclosures must be checked against current official Nigerian law and
relevant authority guidance before enabling a tax regime. The existing editable
line tax calculation is not, by itself, a complete Nigerian tax compliance
engine. This release does not certify statutory compliance or file returns.
A Nigerian tax professional's review is advisable for obligations that remain
uncertain; the workspace does not require the owner to hire staff to enter data.

## 4. Operating rules and documents

Confirm the revenue recognition and purchase/cost recognition policy; treatment
of deposits, returns, credit notes, bad debts, stock valuation/COGS, shipping,
foreign currency gains/losses, and asset depreciation. Confirm the chart of
accounts and each source-to-ledger mapping before posting live records.

Payments stay **manual**, with uploaded evidence and explicit confirmation.
Supply approved payment methods, bank CSV samples with sensitive details
redacted, matching rules, refund/credit approval responsibilities and supporting
evidence requirements. A payment gateway is not part of the scope.

Enter the owner signing profile and signature privately. Confirm which document
types need approval/signing and their signatory capacity. Electronic approvals
are linked to a retained source revision and fresh MFA; an image on an invoice
is not a certificate-based PDF signature. Changes require a new approval.

## 5. Software and operations still requiring acceptance

The workspace has a ledger, journals, financial reports, source posting,
period controls, manual payment evidence and CSV exports. These are a working
core, not proof that every business accounting process is complete.

Before calling the agreed accounting scope ready, review:

- Coverage and reconciled mapping of every live sales, supplier, expense,
  payment, credit, deposit and adjustment workflow.
- Inventory valuation/COGS, landed cost posting, asset depreciation and FX
  adjustments: confirm manual journals versus any further automation needed.
- Nigerian tax regimes, withholding credits, statutory reports and filing
  integrations: implement only the confirmed requirements, not assumed rules.
- Stable document numbering, immutable issued snapshots, bank/tax footer,
  signature authority, corrections/reversals and period closing/reopening.
- Production attachment scanning and failure handling, isolated staging,
  scheduled primary backups, company Drive authorization, freshness monitoring
  and an isolated restore drill. A connected Drive account is not a running
  unattended backup scheduler.

## 6. Measurable go-live checks

1. Opening trial balance has zero difference and all control schedules agree.
2. Bank/cash reconcile; receivables, payables, stock, assets and taxes reconcile
   to their schedules, with signed-off explanations for differences.
3. A representative quote → order → invoice → manual payment/evidence → receipt
   journey works, including partial payment, credit/refund and failed approval.
4. A purchase → receipt → supplier bill/payment journey reconciles stock and
   supplier liabilities; imported history does not duplicate postings.
5. Confirmed tax examples and effective-date boundaries produce the reviewed
   totals and disclosures; pending registrations are never represented as known.
6. Post, reverse, close and reopen a period with the correct authority and audit
   trail. Reports/CSV exports agree to the same source records and currency.
7. A fresh encrypted Supabase snapshot and matching company Drive copy have
   verified receipts; an isolated restore reconciles records, files, counters
   and access restrictions. Preserve the recovery key separately.
8. The owner completes an actual business pilot; fixture tests alone do not
   approve company balances or statutory treatment.

“100%” should mean these checks pass for the agreed scope and actual company
data. New statutory requirements or additional ERP modules remain separate work.
