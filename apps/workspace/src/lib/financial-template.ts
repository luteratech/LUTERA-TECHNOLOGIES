import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  ImageRun,
  Header,
  Footer,
  PageNumber,
  BorderStyle,
  AlignmentType,
  TableLayoutType,
} from "docx";
import {
  type BusinessDocument,
  type Settings,
  totals,
  money,
} from "./contracts";
import type { DocumentSignature } from "./suite";
import { lutera as b } from "./brand";
import {
  brandLogo,
  brandedSVG,
  escapeXML,
  labRowsSVG,
  corporateFooter,
} from "./export-brand";

export const documentTitle = (kind: string) =>
  ({
    order: "Sales order",
    invoice: "Sales invoice",
    credit: "Credit note",
    purchase: "Purchase order",
    rfq: "Request for quotation",
    delivery: "Delivery note",
    quotation: "Quotation",
    proforma: "Pro forma invoice",
    receipt: "Payment receipt",
  })[kind] || kind;
const color = (hex: string) =>
  rgb(
    ...([1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [
      number,
      number,
      number,
    ]),
  );
const margin = 56.69,
  pageWidth = 595.28,
  pageHeight = 841.89,
  width = pageWidth - margin * 2;
const number = (n: number) =>
  (n / 100).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export async function financialTemplate(
  record: BusinessDocument,
  settings: Settings,
  format: "pdf" | "docx" | "png",
  approvals: DocumentSignature[] = [],
) {
  const doc = record.payload,
    company = doc.company || settings,
    sum = totals(doc);
  const heading = documentTitle(doc.kind),
    reference = record.number || "Unnumbered draft";
  const unpriced = ["rfq", "delivery"].includes(String(doc.kind));
  const recipient = ["purchase", "rfq"].includes(String(doc.kind))
    ? "Supplier"
    : doc.kind === "receipt"
      ? "Received from"
      : String(doc.kind) === "delivery"
        ? "Deliver to"
        : "Bill to";
  const status =
    record.status === "draft"
      ? "DRAFT — not issued"
      : record.status === "void"
        ? "VOID — cancelled"
        : "Issued";
  const facts = [
    ["Document reference", reference],
    [
      "Date",
      doc.date +
        (doc.valid_until
          ? `  ·  ${String(doc.kind) === "invoice" ? "Due date" : "Valid until"}: ${doc.valid_until}`
          : ""),
    ],
    ["Currency / status", `${doc.currency}  ·  ${status}`],
  ];
  const from = [
    company.company.name,
    company.company.address,
    `${company.company.email} · ${company.company.phone}`,
    company.company.website,
  ].filter(Boolean);
  const to = [
    doc.customer.name,
    doc.customer.address,
    doc.customer.email,
    doc.customer.phone,
  ].filter(Boolean);
  const footer = corporateFooter(company, !unpriced && doc.kind !== "receipt");
  const sections = [
    ...(doc.kind === "receipt"
      ? [
          `Payment method: ${doc.payment_method}`,
          `Payment reference: ${doc.payment_reference || "—"}`,
        ]
      : []),
    ...(doc.notes ? [doc.notes] : []),
    ...(company.document_notes ? [company.document_notes] : []),
    ...(doc.void_reason ? [`Void reason: ${doc.void_reason}`] : []),
    doc.kind === "receipt"
      ? "Payment received and confirmed by Lutera."
      : ["quotation", "proforma"].includes(doc.kind)
        ? "Supply and delivery are subject to the agreed terms."
        : "Please retain this numbered document for your records.",
  ];
  const summary = [
    ["Subtotal", sum.subtotal],
    ["Discount", sum.discount],
    [`Tax (${doc.tax_bps / 100}%)`, sum.tax],
    [doc.kind === "receipt" ? "Amount received" : "Total", sum.total],
  ] as const;
  const [dark, light, small] = await Promise.all([
    brandLogo(true, true),
    brandLogo(false, true),
    brandLogo(),
  ]);

  if (format === "pdf") {
    const pdf = await PDFDocument.create();
    pdf.registerFontkit(fontkit);
    const fonts = await Promise.all(
      [
        "Sora-400.ttf",
        "Sora-600.ttf",
        "ExportFallback.ttf",
        "ExportFallback-Bold.ttf",
        "JetBrainsMono-Regular.ttf",
        "JetBrainsMono-Medium.ttf",
      ].map(async (file) =>
        pdf.embedFont(
          await readFile(path.join(process.cwd(), "public/fonts", file)),
          { subset: true },
        ),
      ),
    );
    const sets = fonts.map((f) => new Set(f.getCharacterSet()));
    const choose = (text: string, strong = false, mono = false) => {
      const preferred = mono ? (strong ? 5 : 4) : strong ? 1 : 0,
        alternate = strong ? 3 : 2;
      const index = [...text].every((c) =>
        sets[preferred].has(c.codePointAt(0)!),
      )
        ? preferred
        : alternate;
      if ([...text].some((c) => !sets[index].has(c.codePointAt(0)!)))
        throw new Error(
          "The PDF font cannot display one of these characters. Use the Word export or adjust the unsupported character.",
        );
      return fonts[index];
    };
    const wrap = (
      value: string,
      available: number,
      size = 9,
      strong = false,
      mono = false,
    ) =>
      value.split("\n").flatMap((paragraph) => {
        const result: string[] = [];
        let line = "";
        for (const word of paragraph.split(/\s+/)) {
          const test = (line + " " + word).trim();
          if (
            choose(test, strong, mono).widthOfTextAtSize(test, size) <=
            available
          ) {
            line = test;
            continue;
          }
          if (line) {
            result.push(line);
            line = "";
          }
          for (const char of word) {
            if (
              line &&
              choose(line + char, strong, mono).widthOfTextAtSize(
                line + char,
                size,
              ) > available
            ) {
              result.push(line);
              line = "";
            }
            line += char;
          }
        }
        return [...result, line];
      });
    const footerRows = footer.flatMap((row) =>
      wrap(row.text, width, 7.5, false, row.mono).map((text) => ({
        text,
        mono: row.mono,
      })),
    );
    const footerTop = margin + (footerRows.length - 1) * 10.5;
    const minY = footerTop + 28;
    const darkMark = await pdf.embedPng(dark),
      smallMark = await pdf.embedPng(small);
    const pattern = await pdf.embedPng(
      await brandedSVG(
        `<svg xmlns="http://www.w3.org/2000/svg" width="270" height="84">${labRowsSVG(0, 0)}</svg>`,
      ),
    );
    let page = pdf.addPage([pageWidth, pageHeight]),
      y = 0;
    const text = (
      value: string,
      x: number,
      baseline: number,
      size = 9,
      strong = false,
      fill: string = b.ink,
      mono = false,
    ) =>
      page.drawText(value, {
        x,
        y: baseline,
        size,
        font: choose(value, strong, mono),
        color: color(fill),
      });
    const right = (
      value: string,
      end: number,
      baseline: number,
      available: number,
      strong = false,
      fill: string = b.ink,
      mono = true,
    ) => {
      let size = 9;
      while (
        size > 6 &&
        choose(value, strong, mono).widthOfTextAtSize(value, size) > available
      )
        size -= 0.25;
      text(
        value,
        end - choose(value, strong, mono).widthOfTextAtSize(value, size),
        baseline,
        size,
        strong,
        fill,
        mono,
      );
    };
    const rule = (baseline: number) =>
      page.drawLine({
        start: { x: margin, y: baseline },
        end: { x: pageWidth - margin, y: baseline },
        thickness: 0.6,
        color: color(b.border),
      });
    const header = (cover = false) => {
      if (cover) {
        page.drawRectangle({
          x: 0,
          y: 668,
          width: pageWidth,
          height: pageHeight - 668,
          color: color(b.navy),
        });
        page.drawImage(darkMark, { x: margin, y: 756, width: 145, height: 42 });
        text(heading, margin, 710, 25, true, b.white);
        text(reference, margin, 685, 10, false, b.white, true);
        page.drawImage(pattern, { x: 423, y: 684, width: 185, height: 58 });
        y = 640;
      } else {
        page.drawImage(smallMark, { x: margin, y: 788, width: 91, height: 26 });
        right(
          `${heading} · ${reference}`,
          pageWidth - margin,
          795,
          330,
          false,
          b.muted,
          false,
        );
        rule(779);
        y = 750;
      }
    };
    const ensure = (height: number) => {
      if (y - height < minY) {
        page = pdf.addPage([pageWidth, pageHeight]);
        header();
      }
    };
    const paragraph = (
      value: string,
      size = 9,
      strong = false,
      fill: string = b.secondary,
    ) => {
      for (const line of wrap(value, width - 24, size, strong)) {
        ensure(size + 6);
        text(line, margin + 12, y, size, strong, fill);
        y -= size + 6;
      }
      y -= 5;
    };
    header(true);
    // Company and recipient are two independent, wrapped columns.
    const left = from.flatMap((s, i) =>
      wrap(s, width / 2 - 20, i === 0 ? 10 : 8.5, i === 0),
    );
    const rightLines = to.flatMap((s, i) =>
      wrap(s, width / 2 - 20, i === 0 ? 10 : 8.5, i === 0),
    );
    text("From", margin, y, 9, true, b.blue);
    text(recipient, margin + width / 2 + 10, y, 9, true, b.blue);
    y -= 19;
    const partyTop = y;
    for (let i = 0; i < Math.max(left.length, rightLines.length); i++) {
      ensure(15);
      if (left[i])
        text(
          left[i],
          margin,
          y,
          i === 0 ? 10 : 8.5,
          i === 0,
          i === 0 ? b.navy : b.secondary,
        );
      if (rightLines[i])
        text(
          rightLines[i],
          margin + width / 2 + 10,
          y,
          i === 0 ? 10 : 8.5,
          i === 0,
          i === 0 ? b.navy : b.secondary,
        );
      y -= 14;
    }
    if (y === partyTop) y -= 14;
    y -= 15;
    for (const [label, value] of facts) {
      const valueLines = wrap(
        value,
        width - 151,
        8.5,
        false,
        label === "Document reference",
      );
      const height = Math.max(25, valueLines.length * 13 + 12);
      ensure(height + 2);
      page.drawRectangle({
        x: margin,
        y: y - height,
        width,
        height,
        borderColor: color(b.border),
        borderWidth: 0.5,
      });
      page.drawRectangle({
        x: margin + 0.5,
        y: y - height + 0.5,
        width: 140,
        height: height - 1,
        color: color(b.wash),
      });
      text(label, margin + 8, y - 16, 8.5, true, b.secondary);
      valueLines.forEach((line, i) =>
        text(
          line,
          margin + 151,
          y - 16 - i * 13,
          8.5,
          false,
          b.ink,
          label === "Document reference",
        ),
      );
      y -= height;
    }
    y -= 27;
    const columns = unpriced ? [width - 68, 68] : [width - 218, 40, 84, 94];
    const starts = columns.map(
      (_, i) => margin + columns.slice(0, i).reduce((a, n) => a + n, 0),
    );
    const tableHeader = () => {
      ensure(42);
      page.drawRectangle({
        x: margin,
        y: y - 23,
        width,
        height: 26,
        color: color(b.navy),
      });
      (unpriced
        ? ["Description", "Quantity"]
        : ["Description", "Qty", "Unit price", "Amount"]
      ).forEach((label, i) =>
        text(label, starts[i] + 8, y - 14, 8.5, true, b.white),
      );
      y -= 23;
    };
    tableHeader();
    for (const item of doc.items) {
      const itemLines = wrap(item.description, columns[0] - 16, 9);
      let offset = 0;
      while (offset < itemLines.length) {
        if (y < minY + 36) {
          page = pdf.addPage([pageWidth, pageHeight]);
          header();
          tableHeader();
        }
        const count = Math.min(
          itemLines.length - offset,
          Math.max(1, Math.floor((y - minY - 14) / 14)),
        );
        const height = count * 14 + 14;
        page.drawRectangle({
          x: margin,
          y: y - height,
          width,
          height,
          borderColor: color(b.border),
          borderWidth: 0.5,
        });
        starts.slice(1).forEach((x) =>
          page.drawLine({
            start: { x, y },
            end: { x, y: y - height },
            thickness: 0.5,
            color: color(b.border),
          }),
        );
        itemLines
          .slice(offset, offset + count)
          .forEach((line, i) => text(line, margin + 8, y - 17 - i * 14));
        if (!offset) {
          right(
            String(item.quantity),
            starts[1] + columns[1] - 8,
            y - 17,
            columns[1] - 16,
          );
          if (!unpriced) {
            right(
              number(item.unit_minor),
              starts[2] + columns[2] - 8,
              y - 17,
              columns[2] - 16,
            );
            right(
              number(item.unit_minor * item.quantity),
              pageWidth - margin - 8,
              y - 17,
              columns[3] - 16,
            );
          }
        }
        y -= height;
        offset += count;
        if (offset < itemLines.length) {
          page = pdf.addPage([pageWidth, pageHeight]);
          header();
          tableHeader();
        }
      }
    }
    y -= 16;
    if (!unpriced) {
      ensure(94);
      for (const [i, [label, value]] of summary.entries()) {
        const final = i === summary.length - 1;
        if (final)
          page.drawRectangle({
            x: margin + width - 250,
            y: y - 7,
            width: 250,
            height: 25,
            color: color(b.wash),
          });
        text(label, margin + width - 240, y + 1, 9, final, b.navy);
        right(
          `${doc.currency} ${number(value)}`,
          pageWidth - margin - 8,
          y + 1,
          140,
          final,
          b.navy,
        );
        y -= final ? 34 : 21;
      }
    }
    ensure(40);
    y -= 8;
    page.drawRectangle({
      x: margin,
      y: y - 3,
      width: 3,
      height: 14,
      color: color(b.blue),
    });
    text("Notes", margin + 12, y, 10, true, b.navy);
    y -= 22;
    for (const section of sections) paragraph(section);
    for (const approval of approvals) {
      const signerLines = wrap(
        `${approval.full_name} · ${approval.capacity}`,
        width - 24,
        9,
        true,
      );
      ensure(130 + signerLines.length * 15);
      y -= 8;
      rule(y);
      y -= 22;
      text("Approved electronically", margin, y, 9, true, b.blue);
      y -= 17;
      for (const line of signerLines) {
        text(line, margin, y, 9, true, b.navy);
        y -= 15;
      }
      y += 7;
      const signature = await pdf.embedPng(
        Buffer.from(approval.image_data.split(",")[1], "base64"),
      );
      const dims = signature.scaleToFit(160, 42);
      page.drawImage(signature, {
        x: margin,
        y: y - 45,
        width: dims.width,
        height: dims.height,
      });
      y -= 62;
      paragraph(
        `Approved: ${approval.created_at} · Reference: ${approval.id}`,
        8,
      );
    }
    const pageCount = pdf.getPageCount() + approvals.length;
    for (const [index, p] of pdf.getPages().entries()) {
      p.drawLine({
        start: { x: margin, y: footerTop + 12 },
        end: { x: pageWidth - margin, y: footerTop + 12 },
        thickness: 0.5,
        color: color(b.border),
      });
      footerRows.forEach((row, i) =>
        p.drawText(row.text, {
          x: margin,
          y: footerTop - i * 10.5,
          size: 7.5,
          font: choose(row.text, false, row.mono),
          color: color(b.muted),
        }),
      );
      const ref = wrap(reference, width - 100, 7, false, true)[0];
      p.drawText(ref, {
        x: margin,
        y: margin - 15,
        size: 7,
        font: choose(ref, false, true),
        color: color(b.muted),
      });
      p.drawText(`Page ${index + 1} of ${pageCount}`, {
        x: pageWidth - margin - 67,
        y: margin - 15,
        size: 7,
        font: fonts[0],
        color: color(b.muted),
      });
    }
    pdf.setTitle(`${heading} ${reference}`);
    pdf.setCreator("Lutera private workspace");
    pdf.setAuthor(company.company.name);
    return Buffer.from(await pdf.save());
  }

  if (format === "docx") {
    const hex = (s: string) => s.slice(1);
    const paragraph = (
      value: string,
      strong = false,
      fill: string = b.ink,
      size = 20,
      family = "Sora",
    ) =>
      new Paragraph({
        children: value.split("\n").map(
          (text, i) =>
            new TextRun({
              text,
              break: i ? 1 : undefined,
              bold: strong,
              font: family,
              size,
              color: hex(fill),
            }),
        ),
        spacing: { after: 100, line: 300 },
      });
    const borders = Object.fromEntries(
      [
        "top",
        "bottom",
        "left",
        "right",
        "insideHorizontal",
        "insideVertical",
      ].map((side) => [
        side,
        { style: BorderStyle.SINGLE, size: 4, color: hex(b.border) },
      ]),
    );
    const row = (
      values: string[],
      head = false,
      metadata = false,
      numeric: number[] = [],
    ) =>
      new TableRow({
        tableHeader: head,
        cantSplit: true,
        children: values.map(
          (v, i) =>
            new TableCell({
              shading: head
                ? { fill: hex(b.navy) }
                : metadata && !i
                  ? { fill: hex(b.wash) }
                  : undefined,
              margins: { top: 90, bottom: 40, left: 130, right: 130 },
              children: [
                paragraph(
                  v,
                  head || (metadata && !i),
                  head ? b.white : metadata && !i ? b.secondary : b.ink,
                  18,
                  numeric.includes(i) ? "JetBrains Mono" : "Sora",
                ),
              ],
            }),
        ),
      });
    const spacer = () =>
      new Paragraph({ spacing: { after: 160 }, children: [] });
    const table = (rows: TableRow[], columnWidths?: number[]) =>
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        columnWidths,
        layout: TableLayoutType.FIXED,
        borders,
        rows,
      });
    const docx = new Document({
      creator: company.company.name,
      title: `${heading} ${reference}`,
      styles: {
        default: {
          document: {
            run: { font: "Sora", size: 20, color: hex(b.ink) },
            paragraph: { spacing: { line: 300, after: 120 } },
          },
        },
      },
      sections: [
        {
          properties: {
            page: {
              size: { width: 11906, height: 16838 },
              margin: {
                top: 1134,
                bottom: Math.max(
                  1134,
                  footer.reduce(
                    (n, r) => n + Math.ceil(r.text.length / 105),
                    0,
                  ) *
                    240 +
                    560,
                ),
                left: 1134,
                right: 1134,
                footer: 400,
              },
            },
          },
          headers: {
            default: new Header({
              children: [
                paragraph(
                  `${company.company.name} · ${reference}`,
                  false,
                  b.muted,
                  16,
                ),
              ],
            }),
          },
          footers: {
            default: new Footer({
              children: [
                ...footer.map(
                  (r) =>
                    new Paragraph({
                      spacing: { after: 30, line: 210 },
                      children: [
                        new TextRun({
                          text: r.text,
                          font: r.mono ? "JetBrains Mono" : "Sora",
                          size: 15,
                          color: hex(b.muted),
                        }),
                      ],
                    }),
                ),

                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [
                    new TextRun({
                      text: `${company.company.name} · Page `,
                      font: "Sora",
                      size: 16,
                      color: hex(b.muted),
                    }),
                    new TextRun({
                      children: [
                        PageNumber.CURRENT,
                        " of ",
                        PageNumber.TOTAL_PAGES,
                      ],
                      font: "Sora",
                      size: 16,
                      color: hex(b.muted),
                    }),
                  ],
                }),
              ],
            }),
          },
          children: [
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              borders: Object.fromEntries(
                Object.keys(borders).map((k) => [
                  k,
                  { style: BorderStyle.NONE, size: 0, color: hex(b.navy) },
                ]),
              ),
              rows: [
                new TableRow({
                  children: [
                    new TableCell({
                      shading: { fill: hex(b.navy) },
                      margins: { top: 360, bottom: 300, left: 320, right: 320 },
                      children: [
                        new Paragraph({
                          children: [
                            new ImageRun({
                              type: "png",
                              data: dark,
                              transformation: { width: 194, height: 56 },
                            }),
                          ],
                          spacing: { after: 240 },
                        }),
                        paragraph(heading, true, b.white, 42),
                        paragraph(reference, false, b.white, 20),
                      ],
                    }),
                  ],
                }),
              ],
            }),
            spacer(),
            table([
              row(["From", recipient], true),
              row([from.join("\n"), to.join("\n")]),
            ]),
            spacer(),
            table(
              facts.map((f) =>
                row(f, false, true, f[0] === "Document reference" ? [1] : []),
              ),
              [2800, 6838],
            ),
            spacer(),
            table(
              [
                row(
                  unpriced
                    ? ["Description", "Quantity"]
                    : ["Description", "Qty", "Unit price", "Amount"],
                  true,
                ),
                ...doc.items.map((i) =>
                  row(
                    unpriced
                      ? [i.description, String(i.quantity)]
                      : [
                          i.description,
                          String(i.quantity),
                          money(i.unit_minor, doc.currency),
                          money(i.quantity * i.unit_minor, doc.currency),
                        ],
                    false,
                    false,
                    unpriced ? [1] : [1, 2, 3],
                  ),
                ),
              ],
              unpriced ? [8278, 1360] : [5278, 800, 1680, 1880],
            ),
            spacer(),
            ...(!unpriced
              ? [
                  table(
                    summary.map(([label, value], i) =>
                      row(
                        [label, money(value, doc.currency)],
                        i === summary.length - 1,
                        false,
                        [1],
                      ),
                    ),
                  ),
                ]
              : []),
            spacer(),
            paragraph("Notes", true, b.navy, 22),
            ...sections.map((s) => paragraph(s)),
            ...approvals.flatMap((a) => [
              spacer(),
              paragraph(
                `Approved electronically by ${a.full_name} · ${a.capacity}`,
                true,
                b.navy,
              ),
              new Paragraph({
                children: [
                  new ImageRun({
                    type: "png",
                    data: Buffer.from(a.image_data.split(",")[1], "base64"),
                    transformation: { width: 192, height: 60 },
                  }),
                ],
              }),
              paragraph(
                `Approval ${a.id} · ${a.created_at}`,
                false,
                b.muted,
                16,
              ),
              paragraph(
                `Source fingerprint: ${a.source_hash}`,
                false,
                b.muted,
                16,
              ),
              paragraph(
                "Editable copy of an electronically approved record. This DOCX does not carry a PDF signing certificate.",
                false,
                b.muted,
                16,
              ),
            ]),
          ],
        },
      ],
    });
    return Packer.toBuffer(docx);
  }

  // Image equivalent: the same hierarchy and ruled tables on a continuous sheet.
  const w = 1190,
    m = 113,
    bodyWidth = w - m * 2;
  const fonts = await Promise.all(
    [
      "Sora-400.ttf",
      "Sora-600.ttf",
      "JetBrainsMono-Regular.ttf",
      "JetBrainsMono-Medium.ttf",
    ].map(async (f) =>
      fontkit.create(
        await readFile(path.join(process.cwd(), "public/fonts", f)),
      ),
    ),
  );
  const wrap = (
    value: string,
    available: number,
    size = 19,
    strong = false,
    mono = false,
  ) =>
    value.split("\n").flatMap((p) => {
      const result: string[] = [];
      let line = "";
      const font = fonts[mono ? (strong ? 3 : 2) : strong ? 1 : 0];
      const measure = (s: string) =>
        (font.layout(s).positions.reduce((n, p) => n + p.xAdvance, 0) * size) /
        font.unitsPerEm;
      for (const word of p.split(/\s+/)) {
        if (measure((line + " " + word).trim()) <= available) {
          line = (line + " " + word).trim();
          continue;
        }
        if (line) {
          result.push(line);
          line = "";
        }
        for (const c of word) {
          if (line && measure(line + c) > available) {
            result.push(line);
            line = "";
          }
          line += c;
        }
      }
      return [...result, line];
    });
  const text = (
    s: string,
    x: number,
    y: number,
    size = 19,
    strong = false,
    fill: string = b.ink,
    end = false,
    mono = end,
  ) =>
    `<text x="${x}" y="${y}" font-size="${size}" font-weight="${strong ? 600 : 400}" fill="${fill}"${end ? ' text-anchor="end"' : ""}${mono ? ' font-family="JetBrains Mono"' : ""}>${escapeXML(s)}</text>`;
  const amountText = (value: string, column: number, baseline: number) => {
    const font = fonts[2],
      available = columns[column] - 32;
    const measured =
      font.layout(value).positions.reduce((n, p) => n + p.xAdvance, 0) /
      font.unitsPerEm;
    const size = Math.min(17, available / Math.max(1, measured));
    return text(
      value,
      starts[column] + columns[column] - 16,
      baseline,
      size,
      false,
      b.ink,
      true,
    );
  };
  let inner = `<rect width="${w}" height="348" fill="${b.navy}"/><image x="${m}" y="84" width="290" height="84" href="data:image/png;base64,${dark.toString("base64")}"/>${labRowsSVG(850, 190, 1.1)}${text(heading, m, 263, 50, true, b.white)}${text(reference, m, 313, 20, false, b.white, false, true)}`;
  let y = 402;
  const party = (values: string[]) =>
    values.flatMap((s, i) => wrap(s, bodyWidth / 2 - 40, i ? 17 : 20, !i));
  const a = party(from),
    c = party(to);
  inner +=
    text("From", m, y, 18, true, b.blue) +
    text(recipient, m + bodyWidth / 2 + 20, y, 18, true, b.blue);
  y += 38;
  for (let i = 0; i < Math.max(a.length, c.length); i++) {
    if (a[i])
      inner += text(a[i], m, y, i ? 17 : 20, !i, i ? b.secondary : b.navy);
    if (c[i])
      inner += text(
        c[i],
        m + bodyWidth / 2 + 20,
        y,
        i ? 17 : 20,
        !i,
        i ? b.secondary : b.navy,
      );
    y += 28;
  }
  y += 26;
  for (const [label, value] of facts) {
    const rows = wrap(
        value,
        bodyWidth - 310,
        18,
        false,
        label === "Document reference",
      ),
      h = Math.max(50, rows.length * 27 + 24);
    inner += `<rect x="${m}" y="${y}" width="${bodyWidth}" height="${h}" fill="white" stroke="${b.border}"/><rect x="${m + 1}" y="${y + 1}" width="280" height="${h - 2}" fill="${b.wash}"/>${text(label, m + 16, y + 32, 18, true, b.secondary)}`;
    rows.forEach(
      (s, i) =>
        (inner += text(
          s,
          m + 302,
          y + 32 + i * 27,
          18,
          false,
          b.ink,
          false,
          label === "Document reference",
        )),
    );
    y += h;
  }
  y += 44;
  const columns = unpriced
    ? [bodyWidth - 136, 136]
    : [bodyWidth - 436, 80, 168, 188];
  const starts = columns.map(
    (_, i) => m + columns.slice(0, i).reduce((n, a) => n + a, 0),
  );
  inner += `<rect x="${m}" y="${y}" width="${bodyWidth}" height="52" fill="${b.navy}"/>`;
  (unpriced
    ? ["Description", "Quantity"]
    : ["Description", "Qty", "Unit price", "Amount"]
  ).forEach(
    (s, i) => (inner += text(s, starts[i] + 16, y + 33, 17, true, b.white)),
  );
  y += 52;
  for (const item of doc.items) {
    const rows = wrap(item.description, columns[0] - 32),
      h = rows.length * 28 + 28;
    inner += `<rect x="${m}" y="${y}" width="${bodyWidth}" height="${h}" fill="white" stroke="${b.border}"/>`;
    starts
      .slice(1)
      .forEach(
        (x) => (inner += `<path d="M${x} ${y}v${h}" stroke="${b.border}"/>`),
      );
    rows.forEach((s, i) => (inner += text(s, m + 16, y + 34 + i * 28)));
    inner += amountText(String(item.quantity), 1, y + 34);
    if (!unpriced) {
      inner += amountText(number(item.unit_minor), 2, y + 34);
      inner += amountText(number(item.unit_minor * item.quantity), 3, y + 34);
    }
    y += h;
  }
  y += 32;
  if (!unpriced)
    for (const [i, [label, value]] of summary.entries()) {
      const final = i === summary.length - 1;
      if (final)
        inner += `<rect x="${w - m - 500}" y="${y - 29}" width="500" height="50" fill="${b.wash}"/>`;
      inner +=
        text(label, w - m - 480, y, 18, final, b.navy) +
        text(
          `${doc.currency} ${number(value)}`,
          w - m - 16,
          y,
          18,
          final,
          b.navy,
          true,
        );
      y += final ? 68 : 42;
    }
  y += 22;
  inner += `<rect x="${m}" y="${y - 22}" width="6" height="28" fill="${b.blue}"/>${text("Notes", m + 24, y, 21, true, b.navy)}`;
  y += 42;
  for (const section of sections) {
    for (const line of wrap(section, bodyWidth - 24)) {
      inner += text(line, m + 24, y, 19, false, b.secondary);
      y += 30;
    }
    y += 10;
  }
  y += 40;
  inner += `<path d="M${m} ${y}h${bodyWidth}" stroke="${b.border}"/>`;
  y += 30;
  for (const row of footer) {
    for (const line of wrap(row.text, bodyWidth, 15, false, row.mono)) {
      inner += text(line, m, y, 15, false, b.muted, false, row.mono);
      y += 23;
    }
  }
  y += 12;
  for (const line of wrap(reference, bodyWidth, 14, false, true)) {
    inner += text(line, m, y, 14, false, b.muted, false, true);
    y += 22;
  }
  return brandedSVG(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${y + 48}"><rect width="100%" height="100%" fill="white"/>${inner}</svg>`,
  );
}
