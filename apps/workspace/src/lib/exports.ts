import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import sharp from "sharp";
import { Document, Packer, Paragraph, ImageRun } from "docx";
import type { BusinessDocument, Settings, Staff } from "./contracts";
import { lutera } from "./brand";
import { brandedSVG, brandLogo as logo } from "./export-brand";
import { financialTemplate as baseFinancialExport } from "./financial-template";
const { navy, blue, paper } = lutera;
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
  color: string = navy,
  weight = 400,
) =>
  lines(text, max)
    .map(
      (line, i) =>
        `<text x="${x}" y="${y + i * (size + 10)}" font-size="${size}" font-weight="${weight}" fill="${color}">${escape(line)}</text>`,
    )
    .join("");
const wrapSVG = (width: number, height: number, inner: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="white"/><g font-family="Sora,Arial,sans-serif">${inner}</g></svg>`;

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
    w = isID ? 648 : 1020,
    h = isID ? 1032 : 660;
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
    color: string = navy,
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
  const back = `<rect width="${w}" height="${h}" fill="${navy}"/><image x="60" y="60" width="240" height="69" href="data:image/png;base64,${darkBrand.toString("base64")}"/>${block(c.name, 60, 180, w - 120, isID ? 85 : 65, 28, "white", 600)}${block("Supply. Build. Connect.", 60, isID ? 275 : 265, w - 120, 45, 24, lutera.cyan)}${block(c.address, 60, isID ? 350 : 325, w - 120, isID ? 160 : 80, 22, "white")}${block(c.email + "\n" + c.phone + "\n" + c.website, 60, isID ? 530 : 425, w - 120, isID ? 240 : 125, 21, "white")}${isID ? block("Property of Lutera. If found, please contact the company. This card is not a government-issued identity document.", 60, 850, w - 120, 110, 17, lutera.paper) : ""}`;
  let front = `<rect width="${w}" height="${h}" fill="${paper}"/><rect x="0" y="0" width="${isID ? 648 : 14}" height="${isID ? 14 : 660}" fill="${blue}"/><image x="${isID ? 60 : 65}" y="${isID ? 55 : 65}" width="${isID ? 210 : 245}" height="70" href="data:image/png;base64,${brand.toString("base64")}"/>`;
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
  const render = async (svg: string) => brandedSVG(wrapSVG(w, h, svg));
  const frontPNG = await render(front),
    backPNG = await render(back);
  if (format === "png") return side === "front" ? frontPNG : backPNG;
  if (format === "pdf") {
    const pdf = await PDFDocument.create();
    const width = isID ? (54 * 72) / 25.4 : (85 * 72) / 25.4,
      height = isID ? (86 * 72) / 25.4 : (55 * 72) / 25.4;
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
              width: isID ? 204 : 321,
              height: isID ? 325 : 208,
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
    const totalPages = pdf.getPageCount() + valid.length;
    for (const a of valid) {
      const page = pdf.addPage([595.28, 841.89]);
      const mark = await pdf.embedPng(await logo(true));
      page.drawRectangle({
        x: 0,
        y: 700,
        width: 595.28,
        height: 141.89,
        color: rgb(22 / 255, 26 / 255, 61 / 255),
      });
      page.drawImage(mark, { x: 56.69, y: 777, width: 126, height: 36 });
      page.drawText("Electronic approval record", {
        x: 56.69,
        y: 738,
        font,
        size: 20,
        color: rgb(1, 1, 1),
      });
      let y = 668;
      const draw = (text: string, size = 10) => {
        for (const line of lines(text, 80)) {
          page.drawText(line, {
            x: 56.69,
            y,
            size,
            font,
            color: rgb(22 / 255, 26 / 255, 61 / 255),
          });
          y -= size + 7;
        }
        y -= 5;
      };

      draw("Document: " + (record.number || record.id));
      draw(a.full_name + " · " + a.capacity, 13);
      const image = await pdf.embedPng(
        Buffer.from(a.image_data.split(",")[1], "base64"),
      );
      const size = image.scaleToFit(260, 90);
      page.drawImage(image, {
        x: 56.69,
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
      page.drawText(
        `Lutera · ${record.number || "DRAFT"} · Page ${pdf.getPageCount()} of ${totalPages}`,
        {
          x: 56.69,
          y: 29,
          font,
          size: 7,
          color: rgb(93 / 255, 98 / 255, 128 / 255),
        },
      );
    }
    return Buffer.from(await pdf.save());
  }
  const meta = await sharp(base).metadata();
  const width = meta.width || 1190;
  const height = 310 * valid.length;
  const content = valid
    .map((a, i) => {
      const top = i * 310;
      return `<g transform="translate(0,${top})">${textLines("Approved electronically: " + a.full_name, 50, 40, 65, 19, navy, 600)}<image x="50" y="65" width="240" height="75" href="${a.image_data}"/>${textLines(a.capacity + " · " + a.created_at, 50, 170, 85, 16)}${textLines("Approval: " + a.id, 50, 205, 85, 14)}${textLines("Editable/image copy · verify the retained approved source revision", 50, 240, 90, 14)}</g>`;
    })
    .join("");
  const appendix = await brandedSVG(wrapSVG(width, height, content));
  return sharp(base)
    .extend({ bottom: height, background: "white" })
    .composite([{ input: appendix, top: meta.height || 0, left: 0 }])
    .png()
    .toBuffer();
}
