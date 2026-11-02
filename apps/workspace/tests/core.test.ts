import { workspaceOrigin } from "../src/lib/origin";
import test from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { inflateRawSync } from "node:zlib";
import {
  documentSchema,
  totals,
  minor,
  assertOrigin,
  siteSchema,
  type DocumentInput,
  type Settings,
  type BusinessDocument,
  type Staff,
} from "../src/lib/contracts";
import { financialExport, cardExport } from "../src/lib/exports";
import { encryptBackup, decryptBackup } from "../src/lib/backup";
// Inspect the generated Office ZIP without depending on a desktop Word install.
function officeXML(bytes: Buffer) {
  const end = bytes.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  assert.ok(end >= 0);
  const files: Record<string, string> = {};
  let at = bytes.readUInt32LE(end + 16);
  for (let n = 0; n < bytes.readUInt16LE(end + 10); n++) {
    assert.equal(bytes.readUInt32LE(at), 0x02014b50);
    const length = bytes.readUInt16LE(at + 28),
      size = bytes.readUInt32LE(at + 20);
    const name = bytes.subarray(at + 46, at + 46 + length).toString();
    const local = bytes.readUInt32LE(at + 42);
    const start =
      local +
      30 +
      bytes.readUInt16LE(local + 26) +
      bytes.readUInt16LE(local + 28);
    if (name.endsWith(".xml")) {
      const compressed = bytes.subarray(start, start + size);
      files[name] = (
        bytes.readUInt16LE(at + 10) === 8
          ? inflateRawSync(compressed)
          : compressed
      ).toString();
    }
    at +=
      46 + length + bytes.readUInt16LE(at + 30) + bytes.readUInt16LE(at + 32);
  }
  return files;
}
const settings: Settings = {
  company: {
    name: "Lutera Technology Ltd",
    address:
      "No. 7, Mahatma Gandhi Street, Area 11, Garki, Abuja, FCT, Nigeria",
    email: "info@luteratech.com",
    phone: "+234 902 6276 130",
    website: "https://luteratech.com",
  },
  bank_name: "",
  account_name: "",
  account_number: "",
  tax_id: "",
  document_notes: "",
  currency: "NGN",
};
const payload: DocumentInput = {
  kind: "quotation",
  customer: {
    name: "Export fixture — Àdébáyọ̀",
    address: "TEST ONLY — NOT A REAL CUSTOMER",
    email: "",
    phone: "",
  },
  date: "2026-10-22",
  valid_until: "2026-11-05",
  currency: "NGN",
  items: [
    {
      description: "Business equipment (export fixture)",
      quantity: 3,
      unit_minor: 10001,
    },
  ],
  discount_minor: 3,
  tax_bps: 750,
  notes: "Fixture only. No order or payment.",
  payment_method: "",
  payment_reference: "",
  payment_confirmed: false,
  source_id: "",
};
const record: BusinessDocument = {
  id: "4defed84-453b-47dd-bb56-74ee16a2eb01",
  number: null,
  status: "draft",
  kind: "quotation",
  payload,
  total_minor: 32250,
  version: 1,
  created_at: "2026-10-22T12:00:00Z",
  issued_at: null,
};
const staff: Staff = {
  id: "975bc24f-3fcf-44cd-b55a-faa9571817c8",
  version: 1,
  created_at: "2026-10-22T12:00:00Z",
  payload: {
    name: "Sample Profile",
    title: "Design review · sample only",
    staff_number: "SAMPLE-001",
    department: "TEST ONLY",
    email: "",
    phone: "",
    issued_on: "2026-10-22",
    expires_on: "2027-10-22",
    active: false,
    photo_path: "",
  },
};
test("integer money and deterministic half-up tax; reject unsafe finance inputs", () => {
  assert.equal(minor("0.29"), 29);
  assert.equal(minor("10001.99"), 1000199);
  assert.throws(() => minor("1e3"));
  assert.throws(() => minor("-1"));
  assert.throws(() => minor("1.001"));
  assert.deepEqual(totals(documentSchema.parse(payload)), {
    subtotal: 30003,
    discount: 3,
    tax: 2250,
    total: 32250,
  });
  for (const patch of [
    { items: [{ description: "x", quantity: 0.5, unit_minor: 1 }] },
    { discount_minor: 30003 },
    { tax_bps: 10001 },
    { valid_until: "2026-10-01" },
    { kind: "receipt" },
  ])
    assert.equal(
      documentSchema.safeParse({ ...payload, ...patch }).success,
      false,
    );
});
test("request origin blocks cross-site, missing origin and non-JSON mutations", () => {
  const origin = "https://private.example";
  const request = (headers: Record<string, string>) =>
    new Request(origin + "/api/documents/save", { method: "POST", headers });
  assert.doesNotThrow(() =>
    assertOrigin(
      request({ origin, "content-type": "application/json" }),
      origin,
    ),
  );
  const invalid: Record<string, string>[] = [
    { origin: "https://evil.example", "content-type": "application/json" },
    { origin, "content-type": "text/plain" },
    { "content-type": "application/json" },
    {
      origin,
      "content-type": "application/json",
      "sec-fetch-site": "cross-site",
    },
  ];
  for (const headers of invalid)
    assert.throws(() => assertOrigin(request(headers), origin));
});
test("public content permits service changes but rejects unknown/private fields and unsafe links", async () => {
  const site = JSON.parse(await readFile("../../content/site.json", "utf8"));
  assert.equal(siteSchema.safeParse(site).success, true);
  assert.equal(
    siteSchema.safeParse({ ...site, documents: [record] }).success,
    false,
  );
  assert.equal(
    siteSchema.safeParse({
      ...site,
      socials: [{ label: "Bad", url: "javascript:alert(1)" }],
    }).success,
    false,
  );
  assert.equal(
    siteSchema.safeParse({
      ...site,
      services: [site.services[0], site.services[0]],
    }).success,
    false,
  );
  assert.equal(
    siteSchema.safeParse({
      ...site,
      services: [
        { ...site.services[0], key: "new-service", slug: "new-service" },
      ],
    }).success,
    true,
  );
});
test("encrypted backup round-trip rejects wrong password and modified ciphertext", async () => {
  const password = "Fixture password for backup";
  const raw = await encryptBackup({ documents: [record] }, password);
  assert.ok(!raw.includes(Buffer.from(payload.customer.name)));
  assert.deepEqual(await decryptBackup(raw, password), { documents: [record] });
  await assert.rejects(decryptBackup(raw, "Incorrect fixture password"));
  const envelope = JSON.parse(raw.toString());
  const data = Buffer.from(envelope.data, "base64");
  data[0] ^= 1;
  envelope.data = data.toString("base64");
  await assert.rejects(
    decryptBackup(Buffer.from(JSON.stringify(envelope)), password),
  );
});
test("financial exports: parse PDF, DOCX ZIP and PNG, including long multipage content", async () => {
  await mkdir("test-results/exports", { recursive: true });
  for (const kind of [
    "quotation",
    "proforma",
    "receipt",
    "invoice",
    "purchase",
    "rfq",
    "delivery",
    "order",
    "credit",
  ] as const) {
    const r = {
      ...record,
      kind,
      payload: {
        ...payload,
        kind,
        ...(kind === "receipt"
          ? {
              tax_bps: 0,
              discount_minor: 0,
              payment_method: "Test fixture",
              payment_confirmed: true,
            }
          : {}),
      },
    };
    for (const format of ["pdf", "docx", "png"] as const) {
      const bytes = await financialExport(
        r as unknown as BusinessDocument,
        settings,
        format,
      );
      await writeFile(`test-results/exports/${kind}.${format}`, bytes);
      if (format === "pdf")
        assert.ok((await PDFDocument.load(bytes)).getPageCount() > 0);
      if (format === "docx")
        assert.equal(bytes.subarray(0, 2).toString(), "PK");
      if (format === "png") {
        assert.equal((await sharp(bytes).metadata()).width, 1190);
        const pixel = await sharp(bytes)
          .extract({ left: 0, top: 0, width: 1, height: 1 })
          .removeAlpha()
          .raw()
          .toBuffer();
        assert.deepEqual([...pixel], [22, 26, 61]);
      }
    }
  }
  const long = {
    ...record,
    payload: {
      ...payload,
      items: Array.from({ length: 40 }, (_, i) => ({
        description: `${i + 1}. ` + "Long equipment specification ".repeat(13),
        quantity: 1,
        unit_minor: 100000,
      })),
      notes: "Long agreed terms and conditions. ".repeat(50),
    },
  };
  const pdf = await financialExport(long, settings, "pdf");
  assert.ok((await PDFDocument.load(pdf)).getPageCount() >= 3);
  await writeFile("test-results/exports/long-quotation.pdf", pdf);
});
test("staff card exports: both sides, print dimensions and inactive warning", async () => {
  for (const template of ["name", "id"] as const)
    for (const format of ["pdf", "docx", "png"] as const) {
      const bytes = await cardExport(
        staff,
        settings,
        template,
        format,
        "front",
      );
      await writeFile(`test-results/exports/${template}-card.${format}`, bytes);
      if (format === "pdf") {
        const pdf = await PDFDocument.load(bytes);
        assert.equal(pdf.getPageCount(), 2);
        assert.ok(
          Math.abs(
            pdf.getPage(0).getWidth() -
              ((template === "name" ? 85 : 54) * 72) / 25.4,
          ) < 0.01,
        );
      }
      if (format === "png")
        assert.equal(
          (await sharp(bytes).metadata()).height,
          template === "name" ? 660 : 1032,
        );
      if (format === "docx")
        assert.equal(bytes.subarray(0, 2).toString(), "PK");
    }
});

test("brand cards preserve navy/paper sides and printer trim, bleed and safe dimensions", async () => {
  const profile = {
    ...staff,
    payload: { ...staff.payload, active: true, expires_on: "" },
  };
  for (const template of ["name", "id"] as const) {
    for (const side of ["front", "back"] as const) {
      const bytes = await cardExport(profile, settings, template, "png", side);
      const pixel = await sharp(bytes)
        .extract({ left: 0, top: 0, width: 1, height: 1 })
        .removeAlpha()
        .raw()
        .toBuffer();
      assert.deepEqual(
        [...pixel],
        template === "name" && side === "back" ? [243, 242, 238] : [22, 26, 61],
      );
      await writeFile(
        `test-results/exports/${template}-${side}-brand.png`,
        bytes,
      );
    }
    const bytes = await cardExport(
      profile,
      settings,
      template,
      "pdf",
      "front",
      undefined,
      true,
    );
    const pdf = await PDFDocument.load(bytes),
      mm = 72 / 25.4;
    assert.equal(pdf.getPageCount(), 2);
    for (const page of pdf.getPages()) {
      const trim = page.getTrimBox(),
        bleed = page.getBleedBox();
      assert.ok(
        Math.abs(trim.width / mm - (template === "name" ? 85 : 54)) < 0.01,
      );
      assert.ok(
        Math.abs(trim.height / mm - (template === "name" ? 55 : 86)) < 0.01,
      );
      assert.ok(Math.abs(trim.x / mm - 6) < 0.01);
      assert.ok(Math.abs((bleed.width - trim.width) / mm - 6) < 0.01);
      assert.ok(Math.abs((page.getWidth() - bleed.width) / mm - 6) < 0.01);
    }
    await writeFile(`test-results/exports/${template}-print-bleed.pdf`, bytes);
  }
});

test("financial documents keep snapshotted bank and tax details in the footer and omit pending records", async () => {
  const company = {
    ...settings,
    bank_name: "Fixture bank",
    account_name: "Fixture company",
    account_number: "0123456789",
    tax_id: "TEST-TAX-ONLY",
    registration_number: "TEST-RC-ONLY",
  };
  const snapshotted = { ...record, payload: { ...payload, company } };
  const word = await financialExport(snapshotted, settings, "docx");
  const pdf = await financialExport(snapshotted, settings, "pdf");
  const files = officeXML(word),
    body = files["word/document.xml"];
  const footer = Object.entries(files)
    .filter(([name]) => /word\/footer\d+\.xml/.test(name))
    .map(([, text]) => text)
    .join("");
  for (const value of [
    "Fixture bank",
    "0123456789",
    "TEST-TAX-ONLY",
    "TEST-RC-ONLY",
  ]) {
    assert.ok(footer.includes(value), value + " must be in the footer");
    assert.ok(!body.includes(value), value + " must not displace body content");
  }
  assert.ok(body.includes('w:ascii="JetBrains Mono"'));
  const pending = officeXML(await financialExport(record, settings, "docx"));
  const pendingFooter = Object.entries(pending)
    .filter(([name]) => /word\/footer\d+\.xml/.test(name))
    .map(([, text]) => text)
    .join("");
  assert.ok(
    !pendingFooter.includes("Tax ID:") && !pendingFooter.includes("Bank:"),
  );
  await writeFile("test-results/exports/footer-fixture.docx", word);
  await writeFile("test-results/exports/footer-fixture.pdf", pdf);
  assert.ok((await PDFDocument.load(pdf)).getPageCount() > 0);
  // Image generation must also fit the longest permitted numeric columns.
  const large = {
    ...snapshotted,
    payload: {
      ...snapshotted.payload,
      items: [
        {
          description: "Large numeric fixture",
          quantity: 9999,
          unit_minor: 999999999,
        },
      ],
    },
  };
  const image = await financialExport(large, settings, "png");
  assert.equal((await sharp(image).metadata()).width, 1190);
  await writeFile("test-results/exports/large-numeric-fixture.png", image);
});

test("production origin uses only configured or Vercel-provided origins", () => {
  assert.equal(
    workspaceOrigin({ WORKSPACE_ORIGIN: "https://private.example" }),
    "https://private.example",
  );
  assert.equal(
    workspaceOrigin({
      VERCEL_ENV: "production",
      VERCEL_PROJECT_PRODUCTION_URL: "private-project.vercel.app",
    }),
    "https://private-project.vercel.app",
  );
  assert.throws(() =>
    workspaceOrigin({
      VERCEL_ENV: "preview",
      VERCEL_PROJECT_PRODUCTION_URL: "private-project.vercel.app",
    }),
  );
  for (const value of [
    "http://public.example",
    "https://private.example/path",
    "https://user:password@private.example",
    "https://private.example/",
  ])
    assert.throws(() => workspaceOrigin({ WORKSPACE_ORIGIN: value }));
});
