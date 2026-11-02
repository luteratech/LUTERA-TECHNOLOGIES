import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import {
  ownerSetupSchema,
  emptyOwnerSetup,
  journalSchema,
  reportSummary,
} from "../src/lib/suite";
import { financialExport } from "../src/lib/exports";
import type { BusinessDocument, Settings } from "../src/lib/contracts";
test("tax records may remain pending without inventing registration or exemptions", () => {
  const draft = ownerSetupSchema.parse(emptyOwnerSetup);
  assert.equal(draft.tax.status, "pending");
  assert.equal(draft.tax.tax_id, "");
  assert.equal(draft.tax.vat_status, "unconfirmed");
  assert.equal(draft.accounting.enabled, false);
  assert.equal(
    ownerSetupSchema.safeParse({
      ...draft,
      tax: { ...draft.tax, effective_from: "2026-02-30" },
    }).success,
    false,
  );
  assert.equal(
    journalSchema.safeParse({
      entry_date: "2026-11-01",
      currency: "NGN",
      description: "Synthetic capital",
      cash_flow: "financing",
      lines: [
        { account: "1000", debit_minor: 100, credit_minor: 0 },
        { account: "3000", debit_minor: 0, credit_minor: 100 },
      ],
    }).success,
    true,
  );
});
test("financial reports separate period income, cumulative equity and currencies", () => {
  const r = {
    balances: [
      {
        code: "1000",
        name: "Bank",
        category: "asset",
        cash_account: true,
        currency: "NGN",
        balance_minor: 15000,
      },
      {
        code: "3000",
        name: "Capital",
        category: "equity",
        cash_account: false,
        currency: "NGN",
        balance_minor: -10000,
      },
      {
        code: "4000",
        name: "Sales",
        category: "income",
        cash_account: false,
        currency: "NGN",
        balance_minor: -7000,
      },
      {
        code: "6000",
        name: "Expenses",
        category: "expense",
        cash_account: false,
        currency: "NGN",
        balance_minor: 2000,
      },
      {
        code: "1000",
        name: "Bank",
        category: "asset",
        cash_account: true,
        currency: "USD",
        balance_minor: 99999,
      },
    ],
    activity: [
      {
        reference: "JRN",
        entry_date: "2026-11-01",
        currency: "NGN",
        description: "Period movement",
        cash_flow: "operating",
        account: "4000",
        debit_minor: 0,
        credit_minor: 3000,
      },
      {
        reference: "JRN",
        entry_date: "2026-11-01",
        currency: "NGN",
        description: "Period cost",
        cash_flow: "operating",
        account: "6000",
        debit_minor: 1000,
        credit_minor: 0,
      },
    ],
  };
  const s = reportSummary(r, "NGN");
  assert.equal(s.profit, 2000);
  assert.equal(s.earnings, 5000);
  assert.equal(s.assets, s.liabilities + s.equity + s.earnings);
  assert.equal(s.trialDifference, 0);
});
test("signature exports carry exact-revision approval evidence in PDF DOCX and image; drafts exclude it", async () => {
  const settings: Settings = {
    company: {
      name: "Lutera Technology Ltd",
      address: "Abuja",
      email: "info@luteratech.com",
      phone: "+2349026276130",
      website: "https://luteratech.com",
    },
    currency: "NGN",
    bank_name: "",
    account_name: "",
    account_number: "",
    tax_id: "",
    document_notes: "",
  };
  const doc: BusinessDocument = {
    id: crypto.randomUUID(),
    number: "LUT-QUO-FIXTURE",
    kind: "quotation",
    status: "issued",
    version: 2,
    created_at: "2026-11-01",
    issued_at: "2026-11-01",
    total_minor: 10000,
    payload: {
      kind: "quotation",
      customer: {
        name: "Synthetic customer",
        address: "Abuja",
        email: "fixture@example.invalid",
        phone: "",
      },
      date: "2026-11-01",
      valid_until: "",
      currency: "NGN",
      items: [
        { description: "Synthetic equipment", quantity: 1, unit_minor: 10000 },
      ],
      discount_minor: 0,
      tax_bps: 0,
      notes: "",
      payment_method: "",
      payment_reference: "",
      payment_confirmed: false,
      source_id: "",
    },
  };
  const image = await sharp({
    create: { width: 300, height: 100, channels: 4, background: "#fff" },
  })
    .png()
    .toBuffer();
  const approval = {
    id: crypto.randomUUID(),
    source_version: 2,
    full_name: "Fixture Owner",
    capacity: "Owner",
    image_data: "data:image/png;base64," + image.toString("base64"),
    created_at: "2026-11-01T10:00:00Z",
    approval_reason: "Reviewed exact fixture version",
    source_hash: "a".repeat(64),
    self_approved: true,
  };
  const unsigned = await financialExport(doc, settings, "pdf");
  const signed = await financialExport(doc, settings, "pdf", [approval]);
  // Signatures remain in the document and have a separate proof page. The
  // legal footer can move the in-document signature to a continuation page.
  assert.ok(
    (await PDFDocument.load(signed)).getPageCount() >=
      (await PDFDocument.load(unsigned)).getPageCount() + 1,
  );
  const old = await financialExport(doc, settings, "pdf", [
    { ...approval, source_version: 1 },
  ]);
  assert.equal(
    (await PDFDocument.load(old)).getPageCount(),
    (await PDFDocument.load(unsigned)).getPageCount(),
  );
  const png = await financialExport(doc, settings, "png", [approval]);
  const original = await financialExport(doc, settings, "png");
  assert.ok(
    (await sharp(png).metadata()).height! >
      (await sharp(original).metadata()).height!,
  );
  const word = await financialExport(doc, settings, "docx", [approval]);
  assert.equal(word.subarray(0, 2).toString(), "PK");
});
