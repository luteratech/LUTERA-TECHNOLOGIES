import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import sharp from "sharp";
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
  HeadingLevel,
} from "docx";
import {
  type BusinessDocument,
  type Settings,
  type Staff,
  totals,
  money,
} from "./contracts";

const navy = "#151936",
  blue = "#3456ff",
  paper = "#f3f2ee";
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[c]!,
  );
const title = (kind: string) =>
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
const asset = (file: string) =>
  readFile(path.join(process.cwd(), "public/brand", file));
const logo = async (dark = false) =>
  sharp(await asset(`lutera-horizontal-${dark ? "dark" : "light"}.svg`))
    .resize(520)
    .png()
    .toBuffer();
function lines(text: string, length: number): string[] {
  return text.split("\n").flatMap((paragraph) => {
    const result: string[] = [];
    let line = "";
    for (const word of paragraph.split(/\s+/)) {
      for (let start = 0; start < word.length || start === 0; start += length) {
        const chunk = word.slice(start, start + length);
        if ((line + " " + chunk).trim().length > length && line) {
          result.push(line);
          line = "";
        }
        line = (line + " " + chunk).trim();
      }
    }
    return [...result, line];
  });
}
const textLines = (
  text: string,
  x: number,
  y: number,
  max: number,
  size = 22,
  color = navy,
  weight = 400,
) =>
  lines(text, max)
    .map(
      (line, i) =>
        `<text x="${x}" y="${y + i * (size + 10)}" font-size="${size}" font-weight="${weight}" fill="${color}">${escape(line)}</text>`,
    )
    .join("");
const wrapSVG = (width: number, height: number, inner: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="white"/><g font-family="DejaVu Sans,Arial,sans-serif">${inner}</g></svg>`;

async function baseFinancialExport(
  record: BusinessDocument,
  settings: Settings,
  format: "pdf" | "docx" | "png",
  approvals: import("./suite").DocumentSignature[] = [],
) {
  const doc = record.payload;
  const company = doc.company || settings;
  const sum = totals(doc);
  const status =
    record.status === "draft"
      ? "DRAFT — not issued"
      : record.status === "void"
        ? "VOID — cancelled"
        : "Issued";
  const payment = [
    company.bank_name,
    company.account_name,
    company.account_number,
  ]
    .filter(Boolean)
    .join(" · ");
  const sections = [
    ...(doc.kind === "receipt"
      ? [
          `Payment method: ${doc.payment_method}`,
          `Reference: ${doc.payment_reference || "—"}`,
        ]
      : []),
    ...(payment && doc.kind !== "receipt"
      ? [`Payment details: ${payment}`]
      : []),
    ...(company.tax_id ? [`Tax identification: ${company.tax_id}`] : []),
    ...(company.registration_number
      ? [`Company registration: ${company.registration_number}`]
      : []),
    ...(doc.notes ? [doc.notes] : []),
    ...(company.document_notes ? [company.document_notes] : []),
    ...(record.payload.void_reason
      ? [`Void reason: ${record.payload.void_reason}`]
      : []),
    ...(doc.kind === "receipt"
      ? [
          "This document records payment confirmed by Lutera. It is not an online payment confirmation.",
        ]
      : [
          ["quotation", "proforma"].includes(doc.kind)
            ? "Supply and delivery are subject to the agreed terms."
            : "Please retain this numbered document for your records.",
        ]),
  ];
  const brand = await logo();
  if (format === "pdf") {
    const pdf = await PDFDocument.create();
    pdf.registerFontkit(fontkit);
    const font = await pdf.embedFont(
      await readFile(path.join(process.cwd(), "public/fonts/Sora-400.ttf")),
      { subset: true },
    );
    const bold = await pdf.embedFont(
      await readFile(path.join(process.cwd(), "public/fonts/Sora-600.ttf")),
      { subset: true },
    );
    const fallback = await pdf.embedFont(
      await readFile(
        path.join(process.cwd(), "public/fonts/ExportFallback.ttf"),
      ),
      { subset: true },
    );
    const fallbackBold = await pdf.embedFont(
      await readFile(
        path.join(process.cwd(), "public/fonts/ExportFallback-Bold.ttf"),
      ),
      { subset: true },
    );
    const sets = new Map(
      [font, bold, fallback, fallbackBold].map((f) => [
        f,
        new Set(f.getCharacterSet()),
      ]),
    );
    const chooseFont = (value: string, strong = false) => {
      const preferred = strong ? bold : font;
      if (
        [...value].every((char) =>
          sets.get(preferred)!.has(char.codePointAt(0)!),
        )
      )
        return preferred;
      const alternate = strong ? fallbackBold : fallback;
      if (
        [...value].some(
          (char) => !sets.get(alternate)!.has(char.codePointAt(0)!),
        )
      )
        throw new Error(
          "The PDF font cannot display one of these characters. Use the Word export or adjust the unsupported character.",
        );
      return alternate;
    };
    const mark = await pdf.embedPng(brand);
    let page = pdf.addPage([595.28, 841.89]),
      y = 0;
    const draw = (
      value: string,
      x: number,
      size = 10,
      strong = false,
      color = rgb(0.08, 0.1, 0.21),
    ) =>
      page.drawText(value, {
        x,
        y,
        size,
        font: chooseFont(value, strong),
        color,
      });
    const wrapPDF = (value: string, width: number, size = 10, strong = false) =>
      value.split("\n").flatMap((paragraph) => {
        const result: string[] = [];
        let line = "";
        for (const word of paragraph.split(/\s+/)) {
          const test = (line + " " + word).trim();
          if (chooseFont(test, strong).widthOfTextAtSize(test, size) <= width) {
            line = test;
            continue;
          }
          if (line) {
            result.push(line);
            line = "";
          }
          for (const char of word) {
            const next = line + char;
            if (
              chooseFont(next, strong).widthOfTextAtSize(next, size) > width &&
              line
            ) {
              result.push(line);
              line = "";
            }
            line += char;
          }
        }
        return [...result, line];
      });
    const header = () => {
      page.drawImage(mark, { x: 42, y: 770, width: 130, height: 37 });
      y = 782;
      draw(title(doc.kind), 320, 19, true);
      y -= 22;
      draw(record.number || "Unnumbered draft", 320, 10);
      y = 740;
      draw(
        status,
        42,
        10,
        true,
        record.status === "issued" ? rgb(0.1, 0.2, 0.5) : rgb(0.65, 0.1, 0.1),
      );
      y -= 28;
    };
    const ensure = (height: number) => {
      if (y - height < 65) {
        page = pdf.addPage([595.28, 841.89]);
        header();
      }
    };
    const paragraph = (value: string, size = 10, strong = false) => {
      for (const line of wrapPDF(value, 511, size, strong)) {
        ensure(size + 6);
        draw(line, 42, size, strong);
        y -= size + 6;
      }
      y -= 6;
    };
    header();
    paragraph(company.company.name, 12, true);
    paragraph(
      `${company.company.address}\n${company.company.email} | ${company.company.phone}\n${company.company.website}`,
    );
    paragraph(
      `Date: ${doc.date}${doc.valid_until ? (String(doc.kind) === "invoice" ? "   Due date: " : "   Valid until: ") + doc.valid_until : ""}   Currency: ${doc.currency}`,
    );
    paragraph("Bill to / Received from", 10, true);
    paragraph(
      [
        doc.customer.name,
        doc.customer.address,
        doc.customer.email,
        doc.customer.phone,
      ]
        .filter(Boolean)
        .join("\n"),
    );
    const tableHeader = () => {
      ensure(35);
      page.drawRectangle({
        x: 42,
        y: y - 10,
        width: 511,
        height: 27,
        color: rgb(0.94, 0.95, 0.98),
      });
      draw("Description", 50, 10, true);
      draw("Qty", 330, 10, true);
      draw("Unit price", 375, 10, true);
      draw("Amount", 475, 10, true);
      y -= 30;
    };
    tableHeader();
    for (const item of doc.items) {
      const wrapped = wrapPDF(item.description, 265);
      const height = wrapped.length * 15 + 14;
      if (y - height < 65) {
        ensure(height);
        tableHeader();
      }
      wrapped.forEach((line, i) => {
        draw(line, 50);
        if (i < wrapped.length - 1) y -= 15;
      });
      y += (wrapped.length - 1) * 15;
      draw(String(item.quantity), 330);
      draw(`${(item.unit_minor / 100).toFixed(2)}`, 375, 9);
      draw(`${((item.unit_minor * item.quantity) / 100).toFixed(2)}`, 475, 9);
      y -= height;
    }
    ensure(110);
    y -= 12;
    for (const [label, value] of [
      ["Subtotal", sum.subtotal],
      ["Discount", sum.discount],
      [`Tax (${doc.tax_bps / 100}%)`, sum.tax],
      [doc.kind === "receipt" ? "Amount received" : "Total", sum.total],
    ] as const) {
      draw(label, 330, 10, label === "Total" || label === "Amount received");
      draw(`${doc.currency} ${(value / 100).toFixed(2)}`, 445, 9, true);
      y -= 21;
    }
    y -= 15;
    for (const section of sections) paragraph(section);
    for (const approval of approvals) {
      ensure(145);
      y -= 10;
      paragraph(
        `Approved electronically by ${approval.full_name} · ${approval.capacity}`,
      );
      const signature = await pdf.embedPng(
        Buffer.from(approval.image_data.split(",")[1], "base64"),
      );
      const dimensions = signature.scaleToFit(180, 55);
      page.drawImage(signature, {
        x: 42,
        y: y - 65,
        width: dimensions.width,
        height: dimensions.height,
      });
      y -= 80;
      paragraph(`Approved: ${approval.created_at} · Reference: ${approval.id}`);
    }

    for (const [index, p] of pdf.getPages().entries())
      p.drawText(
        `Lutera | ${record.number || "DRAFT"} | Page ${index + 1} of ${pdf.getPageCount()}`,
        { x: 42, y: 29, size: 8, font, color: rgb(0.4, 0.4, 0.48) },
      );
    pdf.setTitle(`${title(doc.kind)} ${record.number || "draft"}`);
    pdf.setCreator("Lutera private workspace");
    return Buffer.from(await pdf.save());
  }
  if (format === "docx") {
    const paragraph = (value: string, bold = false) =>
      new Paragraph({
        children: [new TextRun({ text: value, bold, font: "Arial", size: 21 })],
        spacing: { after: 140 },
      });
    const cells = (values: string[], heading = false) =>
      new TableRow({
        children: values.map(
          (value) =>
            new TableCell({
              shading: heading ? { fill: "F0F2FA" } : undefined,
              children: [paragraph(value, heading)],
            }),
        ),
      });
    const document = new Document({
      creator: "Lutera Technology Ltd",
      title: `${title(doc.kind)} ${record.number || "draft"}`,
      sections: [
        {
          children: [
            new Paragraph({
              children: [
                new ImageRun({
                  type: "png",
                  data: brand,
                  transformation: { width: 180, height: 52 },
                }),
              ],
            }),
            new Paragraph({
              text: title(doc.kind),
              heading: HeadingLevel.TITLE,
            }),
            paragraph(
              `${record.number || "Unnumbered draft"} | ${status}`,
              true,
            ),
            paragraph(company.company.name, true),
            paragraph(company.company.address),
            paragraph(
              `${company.company.email} | ${company.company.phone} | ${company.company.website}`,
            ),
            paragraph(
              `Date: ${doc.date}${doc.valid_until ? (String(doc.kind) === "invoice" ? " | Due date: " : " | Valid until: ") + doc.valid_until : ""} | Currency: ${doc.currency}`,
            ),
            paragraph("Bill to / Received from", true),
            ...[
              doc.customer.name,
              doc.customer.address,
              doc.customer.email,
              doc.customer.phone,
            ]
              .filter(Boolean)
              .map((t) => paragraph(t)),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                cells(
                  ["Description", "Quantity", "Unit price", "Amount"],
                  true,
                ),
                ...doc.items.map((i) =>
                  cells([
                    i.description,
                    String(i.quantity),
                    money(i.unit_minor, doc.currency),
                    money(i.quantity * i.unit_minor, doc.currency),
                  ]),
                ),
              ],
            }),
            paragraph(
              `Subtotal: ${money(sum.subtotal, doc.currency)} | Discount: ${money(sum.discount, doc.currency)} | Tax (${doc.tax_bps / 100}%): ${money(sum.tax, doc.currency)}`,
            ),
            paragraph(
              `${doc.kind === "receipt" ? "Amount received" : "Total"}: ${money(sum.total, doc.currency)}`,
              true,
            ),
            ...sections.map((t) => paragraph(t)),
            ...approvals.flatMap((a) => [
              paragraph(
                `Approved electronically by ${a.full_name} · ${a.capacity}`,
                true,
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
              paragraph(`Approval ${a.id} · ${a.created_at}`),
              paragraph(`Source fingerprint: ${a.source_hash}`),
              paragraph(
                "Editable copy of an electronically approved record. This DOCX does not carry a PDF signing certificate.",
              ),
            ]),
          ],
        },
      ],
    });
    return Packer.toBuffer(document);
  }
  let y = 80;
  let inner = `<image x="60" y="55" width="220" height="63" href="data:image/png;base64,${brand.toString("base64")}"/>`;
  inner += textLines(title(doc.kind), 590, y, 28, 30, navy, 600);
  y = 150;
  const add = (value: string, max = 76, size = 21, strong = false) => {
    inner += textLines(value, 60, y, max, size, navy, strong ? 600 : 400);
    y += lines(value, max).length * (size + 10) + 12;
  };
  add(`${record.number || "Unnumbered draft"} · ${status}`, 65, 22, true);
  add(company.company.name, 65, 24, true);
  add(company.company.address);
  add(`${company.company.email} | ${company.company.phone}`);
  add(
    `Date: ${doc.date}${doc.valid_until ? (String(doc.kind) === "invoice" ? " | Due date: " : " | Valid until: ") + doc.valid_until : ""} | ${doc.currency}`,
  );
  add("Bill to / Received from", 70, 20, true);
  add(
    [
      doc.customer.name,
      doc.customer.address,
      doc.customer.email,
      doc.customer.phone,
    ]
      .filter(Boolean)
      .join("\n"),
  );
  inner += `<rect x="60" y="${y - 28}" width="880" height="48" fill="${paper}"/>`;
  inner +=
    textLines("Description", 75, y, 35, 21, navy, 600) +
    textLines("Qty", 605, y, 5, 21, navy, 600) +
    textLines("Unit", 680, y, 12, 21, navy, 600) +
    textLines("Amount", 820, y, 12, 21, navy, 600);
  y += 50;
  for (const item of doc.items) {
    inner +=
      textLines(item.description, 75, y, 43, 20) +
      textLines(String(item.quantity), 605, y, 8, 19) +
      textLines((item.unit_minor / 100).toFixed(2), 680, y, 18, 19) +
      textLines(
        ((item.unit_minor * item.quantity) / 100).toFixed(2),
        820,
        y,
        18,
        19,
      );
    y += Math.max(lines(item.description, 43).length * 30, 32) + 24;
  }
  y += 20;
  add(
    `Subtotal: ${money(sum.subtotal, doc.currency)}\nDiscount: ${money(sum.discount, doc.currency)}\nTax (${doc.tax_bps / 100}%): ${money(sum.tax, doc.currency)}`,
    70,
    21,
  );
  add(
    `${doc.kind === "receipt" ? "Amount received" : "Total"}: ${money(sum.total, doc.currency)}`,
    60,
    28,
    true,
  );
  for (const section of sections) add(section);
  return sharp(Buffer.from(wrapSVG(1000, y + 50, inner)))
    .png()
    .toBuffer();
}

export async function cardExport(
  staff: Staff,
  settings: Settings,
  template: "name" | "id",
  format: "pdf" | "docx" | "png",
  side: "front" | "back",
  photo?: Buffer,
) {
  const s = staff.payload,
    c = settings.company;
  const isID = template === "id",
    w = isID ? 648 : 1080,
    h = isID ? 1032 : 600;
  const brand = await logo(),
    darkBrand = await logo(true);
  // Bounded text regions shrink or wrap long fields instead of overlapping.
  const block = (
    value: string,
    x: number,
    y: number,
    width: number,
    height: number,
    size: number,
    color = navy,
    weight = 400,
  ) => {
    for (let font = size; font >= 12; font--) {
      const max = Math.max(1, Math.floor(width / font));
      if (lines(value, max).length * (font + 10) <= height)
        return textLines(value, x, y + font, max, font, color, weight);
    }
    throw new Error(
      "Card text is too long for this template. Shorten the card details before exporting.",
    );
  };
  const state = !s.active
    ? "INACTIVE"
    : s.expires_on && s.expires_on < new Date().toISOString().slice(0, 10)
      ? "EXPIRED"
      : "";
  const back = `<rect width="${w}" height="${h}" fill="${navy}"/><image x="60" y="60" width="240" height="69" href="data:image/png;base64,${darkBrand.toString("base64")}"/>${block(c.name, 60, 180, w - 120, isID ? 85 : 65, 28, "white", 600)}${block("Supply. Build. Connect.", 60, isID ? 275 : 265, w - 120, 45, 24, "#b4c1ff")}${block(c.address, 60, isID ? 350 : 325, w - 120, isID ? 160 : 80, 22, "white")}${block(c.email + "\n" + c.phone + "\n" + c.website, 60, isID ? 530 : 425, w - 120, isID ? 240 : 125, 21, "white")}${isID ? block("Property of Lutera. If found, please contact the company. This card is not a government-issued identity document.", 60, 850, w - 120, 110, 17, "#d8dcf7") : ""}`;
  let front = `<rect width="${w}" height="${h}" fill="${paper}"/><rect x="0" y="0" width="${isID ? 648 : 14}" height="${isID ? 14 : 600}" fill="${blue}"/><image x="${isID ? 60 : 65}" y="${isID ? 55 : 65}" width="${isID ? 210 : 245}" height="70" href="data:image/png;base64,${brand.toString("base64")}"/>`;
  if (isID) {
    front += `<rect x="184" y="175" width="280" height="320" rx="16" fill="#e1e3ed"/>`;
    if (photo)
      front += `<image x="184" y="175" width="280" height="320" preserveAspectRatio="xMidYMid slice" href="data:image/jpeg;base64,${photo.toString("base64")}"/>`;
    front +=
      block(s.name, 60, 525, w - 120, 110, 34, navy, 600) +
      block(s.title, 60, 650, w - 120, 75, 25, blue) +
      block(s.department, 60, 740, w - 120, 50, 22) +
      block(
        `Staff ID: ${s.staff_number}\nIssued: ${s.issued_on}${s.expires_on ? "\nExpires: " + s.expires_on : ""}`,
        60,
        810,
        w - 120,
        130,
        22,
      );
  } else {
    front +=
      block(s.name, 65, 205, w - 130, 120, 43, navy, 600) +
      block(s.title, 65, 340, w - 130, 70, 26, blue) +
      block(
        [s.email || c.email, s.phone || c.phone, c.website].join("\n"),
        65,
        425,
        w - 130,
        105,
        22,
      );
  }
  if (state)
    front += `<rect x="0" y="${h - 65}" width="${w}" height="65" fill="#ad2334"/>${textLines(state, 60, h - 23, 40, 26, "white", 600)}`;
  const render = async (svg: string) =>
    sharp(Buffer.from(wrapSVG(w, h, svg)))
      .png()
      .toBuffer();
  const frontPNG = await render(front),
    backPNG = await render(back);
  if (format === "png") return side === "front" ? frontPNG : backPNG;
  if (format === "pdf") {
    const pdf = await PDFDocument.create();
    const width = isID ? (54 * 72) / 25.4 : (90 * 72) / 25.4,
      height = isID ? (86 * 72) / 25.4 : (50 * 72) / 25.4;
    for (const image of [frontPNG, backPNG]) {
      const embedded = await pdf.embedPng(image);
      pdf
        .addPage([width, height])
        .drawImage(embedded, { x: 0, y: 0, width, height });
    }
    return Buffer.from(await pdf.save());
  }
  const images = [frontPNG, backPNG].map(
    (data, i) =>
      new Paragraph({
        pageBreakBefore: i === 1,
        children: [
          new ImageRun({
            type: "png",
            data,
            transformation: {
              width: isID ? 204 : 340,
              height: isID ? 325 : 189,
            },
          }),
        ],
      }),
  );
  return Packer.toBuffer(
    new Document({ creator: c.name, sections: [{ children: images }] }),
  );
}

/** Authenticated electronic approval appearance and audit evidence. This is not
 * an X.509/certificate-based PDF signature and must never be labelled as one. */
export async function financialExport(
  record: BusinessDocument,
  settings: Settings,
  format: "pdf" | "docx" | "png",
  approvals: import("./suite").DocumentSignature[] = [],
) {
  const valid =
    record.status === "issued"
      ? approvals
          .filter((a) => a.source_version === record.version)
          .slice(0, 10)
      : [];
  const base = await baseFinancialExport(
    record,
    settings,
    format,
    format === "docx" || format === "pdf" ? valid : [],
  );
  if (!valid.length || format === "docx") return base;
  if (format === "pdf") {
    const pdf = await PDFDocument.load(base);
    pdf.registerFontkit(fontkit);
    const font = await pdf.embedFont(
      await readFile(path.join(process.cwd(), "public/fonts/Sora-400.ttf")),
      { subset: true },
    );
    for (const a of valid) {
      const page = pdf.addPage([595.28, 841.89]);
      let y = 785;
      const draw = (text: string, size = 10) => {
        for (const line of lines(text, 80)) {
          page.drawText(line, {
            x: 42,
            y,
            size,
            font,
            color: rgb(0.08, 0.1, 0.21),
          });
          y -= size + 7;
        }
        y -= 5;
      };
      draw("LUTERA · Electronic approval record", 18);
      draw("Document: " + (record.number || record.id));
      draw(a.full_name + " · " + a.capacity, 13);
      const image = await pdf.embedPng(
        Buffer.from(a.image_data.split(",")[1], "base64"),
      );
      const size = image.scaleToFit(260, 90);
      page.drawImage(image, {
        x: 42,
        y: y - 100,
        width: size.width,
        height: size.height,
      });
      y -= 125;
      draw("Approved at: " + a.created_at);
      draw("Approval reference: " + a.id);

      draw(
        a.self_approved
          ? "Owner self-approval"
          : "Authorised document approval",
      );
      draw("Approved source revision: " + a.source_version);
      draw("Source SHA-256: " + a.source_hash);
      draw(
        "This approval is bound to the source revision retained in the private workspace. It is not a certificate-based PDF signature. Changes require a new approval.",
      );
    }
    return Buffer.from(await pdf.save());
  }
  const meta = await sharp(base).metadata();
  const width = meta.width || 1000;
  const height = 310 * valid.length;
  const content = valid
    .map((a, i) => {
      const top = i * 310;
      return `<g transform="translate(0,${top})">${textLines("Approved electronically: " + a.full_name, 50, 40, 65, 19, navy, 600)}<image x="50" y="65" width="240" height="75" href="${a.image_data}"/>${textLines(a.capacity + " · " + a.created_at, 50, 170, 85, 16)}${textLines("Approval: " + a.id, 50, 205, 85, 14)}${textLines("Editable/image copy · verify the retained approved source revision", 50, 240, 90, 14)}</g>`;
    })
    .join("");
  const appendix = await sharp(Buffer.from(wrapSVG(width, height, content)))
    .png()
    .toBuffer();
  return sharp(base)
    .extend({ bottom: height, background: "white" })
    .composite([{ input: appendix, top: meta.height || 0, left: 0 }])
    .png()
    .toBuffer();
}
