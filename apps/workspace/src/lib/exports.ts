import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import sharp from "sharp";
import type { BusinessDocument, Settings } from "./contracts";
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
  mono = false,
) =>
  lines(text, max)
    .map(
      (line, i) =>
        `<text x="${x}" y="${y + i * (size + 10)}" font-size="${size}" font-weight="${weight}" font-family="${mono ? "JetBrains Mono" : "Sora"}" fill="${color}">${escape(line)}</text>`,
    )
    .join("");
const wrapSVG = (width: number, height: number, inner: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="white"/><g font-family="Sora,Arial,sans-serif">${inner}</g></svg>`;

export { cardTemplate as cardExport } from "./card-template";

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
    const mono = await pdf.embedFont(
      await readFile(
        path.join(process.cwd(), "public/fonts/JetBrainsMono-Regular.ttf"),
      ),
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
      const draw = (text: string, size = 10, numeric = false) => {
        for (const line of lines(text, 80)) {
          page.drawText(line, {
            x: 56.69,
            y,
            size,
            font: numeric ? mono : font,
            color: rgb(22 / 255, 26 / 255, 61 / 255),
          });
          y -= size + 7;
        }
        y -= 5;
      };

      draw("Document: " + (record.number || record.id), 10, true);
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
      draw("Approved at: " + a.created_at, 10, true);
      draw("Approval reference: " + a.id, 10, true);

      draw(
        a.self_approved
          ? "Owner self-approval"
          : "Authorised document approval",
      );
      draw("Approved source revision: " + a.source_version, 10, true);
      draw("Source SHA-256: " + a.source_hash, 10, true);
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
      return `<g transform="translate(0,${top})">${textLines("Approved electronically: " + a.full_name, 50, 40, 65, 19, navy, 600)}<image x="50" y="65" width="240" height="75" href="${a.image_data}"/>${textLines(a.capacity + " · " + a.created_at, 50, 170, 85, 16)}${textLines("Approval: " + a.id, 50, 205, 85, 14, navy, 400, true)}${textLines("Editable/image copy · verify the retained approved source revision", 50, 240, 90, 14)}</g>`;
    })
    .join("");
  const appendix = await brandedSVG(wrapSVG(width, height, content));
  return sharp(base)
    .extend({ bottom: height, background: "white" })
    .composite([{ input: appendix, top: meta.height || 0, left: 0 }])
    .png()
    .toBuffer();
}
