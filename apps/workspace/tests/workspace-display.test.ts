import { caseFormPayload } from "../src/lib/case-form";
import { schemas } from "../src/lib/business";
import { bankFingerprint } from "../src/lib/bank-fingerprint";
import test from "node:test";
import assert from "node:assert/strict";
import {
  recordAmount,
  recordOption,
  displayDate,
  lineAmount,
  displayLabel,
  stockAvailable,
} from "../src/lib/workspace-display";
test("record amounts distinguish zero, negative, missing and malformed values", () => {
  assert.equal(recordAmount({ total_minor: 0, created_at: "2026-11-03" }), 0);
  assert.equal(recordAmount({ total_minor: 0, amount_minor: 1200 }), 0);
  assert.equal(recordAmount({ amount_minor: -1250 }), -1250);
  assert.equal(recordAmount({ total_minor: null, amount_minor: 1250 }), 1250);
  assert.equal(
    recordAmount({ total_minor: "bad", document_date: "2026-11-03" }),
    null,
  );
  assert.equal(recordAmount({ total_minor: "" }), null);
});
test("linked option includes its reference, date, zero amount and status", () => {
  const label = recordOption({
    number: "LUT-INV-001",
    total_minor: 0,
    currency: "NGN",
    document_date: "2026-10-15",
    status: "submitted",
  });
  assert.match(label, /LUT-INV-001/);
  assert.match(label, /15 Oct 2026/);
  assert.match(label, /0\.00/);
  assert.match(label, /Awaiting approval/);
});
test("business dates use Lagos and preserve date-only values", () => {
  assert.match(displayDate("2026-10-15"), /15 Oct 2026/);
  assert.match(displayDate("2026-10-15T23:30:00Z", true), /16 Oct 2026/);
  assert.equal(displayDate(""), "—");
});
test("line total remains safe while quantity and decimal inputs are incomplete", () => {
  assert.equal(lineAmount("2", "1250.50"), 250100);
  assert.equal(lineAmount("0", "1250.50"), 0);
  assert.equal(lineAmount("2", "1.234"), null);
  assert.equal(lineAmount("-1", "1"), null);
  assert.equal(lineAmount("2", "."), null);
  assert.equal(lineAmount("1000001", "1"), null);
});
test("stored services and accounting units have business labels", () => {
  assert.equal(displayLabel("tax_bps"), "Tax rate");
  assert.equal(displayLabel("cost_centers"), "Cost centres");
  assert.equal(displayLabel("ai-automation"), "AI agents & automation");
});

test("stock availability excludes reservations and quarantined units without hiding deficits", () => {
  assert.equal(stockAvailable({ on_hand: 10, reserved: 3, quarantined: 5 }), 2);
  assert.equal(stockAvailable({ on_hand: 2, reserved: 1, quarantined: 3 }), -2);
  assert.equal(stockAvailable({ on_hand: 0 }), 0);
});

test("bank preview duplicate keys match the deployed PostgreSQL import fingerprint", () => {
  const row = {
    posted_on: "2026-11-03",
    amount_minor: 125050,
    currency: "NGN",
    reference: "BANK-FIXTURE",
  };
  assert.equal(
    bankFingerprint("primary", row),
    "d22708dd0fb4420debc7897db5c99e36e6fd5dafcf73c1bb7efa0412f11817f6",
  );
  assert.notEqual(
    bankFingerprint("another-account", row),
    bankFingerprint("primary", row),
  );
  assert.notEqual(
    bankFingerprint("primary", { ...row, amount_minor: -125050 }),
    bankFingerprint("primary", row),
  );
});

test("case edits retain hidden values and normalize database nulls for validation", () => {
  const row = {
    id: "8fe434ad-6b01-4960-abba-b2cdf7edb8f9",
    starts_on: null,
    acceptance_id: null,
    accepted_by: "",
    response_due_at: "2026-11-04T10:00:00+00:00",
    responded_at: null,
  };
  const values = { title: "Support request", customer_id: row.id };
  const result = schemas.cases.parse(caseFormPayload(values, "ticket", row));
  assert.equal(result.starts_on, "");
  assert.equal(result.acceptance_id, "");
  assert.equal(result.response_due_at, row.response_due_at);
  const cleared = caseFormPayload(
    { ...values, response_due_at: "" },
    "ticket",
    row,
  );
  assert.equal(cleared.response_due_at, "");
});
