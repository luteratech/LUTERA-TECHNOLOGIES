import { test } from "node:test";
import assert from "node:assert/strict";
import { areas, type Access } from "../src/lib/business";
import {
  departments,
  visibleTools,
  toolAt,
  departmentFor,
  workspaceTools,
} from "../src/lib/workspace-areas";

const access = (read: string[] = [], write = false): Access =>
  Object.fromEntries(
    areas.map((a) => [
      a,
      {
        read: read.includes(a),
        write: read.includes(a) && write,
        approve: false,
      },
    ]),
  ) as Access;
test("department visibility preserves roles and explicit business grants", () => {
  const editor = visibleTools("editor", { access: access() });
  assert.deepEqual([...new Set(editor.map((t) => t.department))], ["website"]);
  assert.deepEqual(
    visibleTools("designer", null).map((t) => t.id),
    ["staff-profiles"],
  );
  const support = visibleTools("editor", { access: access(["support"]) });
  assert.ok(support.some((t) => t.id === "tasks"));
  assert.ok(support.some((t) => t.id === "tickets"));
  assert.ok(
    !support.some(
      (t) =>
        t.id === "payments" || t.id === "projects" || t.id === "portal-access",
    ),
  );
  const finance = visibleTools("finance", { access: access(["finance"]) });
  assert.ok(finance.some((t) => t.id === "payments"));
  assert.ok(
    !finance.some(
      (t) =>
        t.id === "statements" ||
        t.id === "approval-rules" ||
        t.id === "backups",
    ),
  );
  const owner = visibleTools("owner", {
    owner: true,
    access: access([...areas], true),
  });
  assert.equal(owner.length, workspaceTools.length);
  assert.equal(
    new Set(owner.map((t) => t.department)).size,
    departments.length,
  );
});
test("shared editors resolve to their correct department and preserve old URLs", () => {
  assert.equal(
    toolAt("operations", new URLSearchParams("module=payments"))?.id,
    "payments",
  );
  assert.equal(
    departmentFor(
      "operations",
      new URLSearchParams("module=commercial&kind=invoice"),
    ),
    "financial",
  );
  assert.equal(
    departmentFor(
      "operations",
      new URLSearchParams("module=commercial&kind=purchase"),
    ),
    "supply",
  );
  assert.equal(
    toolAt(
      "operations",
      new URLSearchParams("module=customers&tool=statements"),
    )?.id,
    "statements",
  );
  assert.equal(
    toolAt("finance", new URLSearchParams("documentKind=quotation"))?.id,
    "quote-documents",
  );
  assert.equal(
    toolAt("finance", new URLSearchParams("documentKind=proforma"))?.id,
    "proformas",
  );
  assert.equal(
    toolAt("finance", new URLSearchParams())?.id,
    "document-archive",
  );
  assert.equal(
    departmentFor("content", new URLSearchParams("editor=publishing")),
    "website",
  );
  assert.equal(
    departmentFor("controls", new URLSearchParams("control=locations")),
    "supply",
  );
  assert.equal(
    new Set(workspaceTools.map((t) => t.id)).size,
    workspaceTools.length,
  );
});
