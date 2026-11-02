import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import sharp from "sharp";
import { PDFDocument, rgb } from "pdf-lib";
import { Document, Packer, Paragraph, ImageRun } from "docx";
import type { Staff, Settings } from "./contracts";
import { lutera as b } from "./brand";
import { brandedSVG, brandLogo, escapeXML } from "./export-brand";

/** The supplied brand-book card layouts. Coordinates use 12 px per mm;
 * the safe inset is 5 mm and optional printer bleed is a separate PDF box. */
export async function cardTemplate(
  staff: Staff,
  settings: Settings,
  template: "name" | "id",
  format: "pdf" | "docx" | "png",
  side: "front" | "back",
  photo?: Buffer,
  printBleed = false,
) {
  const s = staff.payload,
    c = settings.company,
    isID = template === "id",
    w = isID ? 648 : 1020,
    h = isID ? 1032 : 660;
  const fontFiles = [
    "Sora-400.ttf",
    "Sora-600.ttf",
    "JetBrainsMono-Regular.ttf",
    "JetBrainsMono-Medium.ttf",
    "ExportFallback.ttf",
    "ExportFallback-Bold.ttf",
  ];
  const fonts = await Promise.all(
    fontFiles.map(async (f) =>
      fontkit.create(
        await readFile(path.join(process.cwd(), "public/fonts", f)),
      ),
    ),
  );
  const [mark, descriptor, symbol] = await Promise.all([
    brandLogo(true),
    brandLogo(true, true),
    sharp(
      await readFile(
        path.join(process.cwd(), "public/brand/lutera-symbol-white.svg"),
      ),
    )
      .resize(700)
      .png()
      .toBuffer(),
  ]);
  const image = (
    data: Buffer,
    x: number,
    y: number,
    width: number,
    height: number,
  ) =>
    `<image x="${x}" y="${y}" width="${width}" height="${height}" href="data:image/png;base64,${data.toString("base64")}"/>`;
  const graphic = (x: number, y: number, width: number, height: number) =>
    `<defs><mask id="card-graphic">${image(symbol, x, y, width, height)}</mask></defs><rect x="${x}" y="${y}" width="${width}" height="${height}" fill="#343A6E" mask="url(#card-graphic)"/>`;
  const block = (
    value: string,
    x: number,
    y: number,
    width: number,
    height: number,
    size: number,
    fill: string = b.ink,
    strong = false,
    mono = false,
    min = size,
  ) => {
    const preferred = fonts[mono ? (strong ? 3 : 2) : strong ? 1 : 0];
    const font = [...value].every((c) =>
      preferred.hasGlyphForCodePoint(c.codePointAt(0)!),
    )
      ? preferred
      : fonts[strong ? 5 : 4];
    const wrap = (size: number) =>
      value.split("\n").flatMap((paragraph) => {
        const rows: string[] = [];
        let line = "";
        const measure = (text: string) =>
          (font.layout(text).positions.reduce((n, p) => n + p.xAdvance, 0) *
            size) /
          font.unitsPerEm;
        for (const word of paragraph.split(/\s+/)) {
          if (measure((line + " " + word).trim()) <= width) {
            line = (line + " " + word).trim();
            continue;
          }
          if (line) {
            rows.push(line);
            line = "";
          }
          for (const char of word) {
            if (line && measure(line + char) > width) {
              rows.push(line);
              line = "";
            }
            line += char;
          }
        }
        return [...rows, line];
      });
    for (let px = size; px >= min; px -= 1) {
      const rows = wrap(px);
      if (rows.length * px * 1.35 <= height)
        return rows
          .map(
            (row, i) =>
              `<text x="${x}" y="${y + px + i * px * 1.35}" font-size="${px}" font-weight="${strong ? 600 : 400}" font-family="${mono ? "JetBrains Mono" : "Sora"}" fill="${fill}">${escapeXML(row)}</text>`,
          )
          .join("");
    }
    throw new Error(
      "The printed card details exceed the safe text area. Shorten the printed name, role or contact details and export again.",
    );
  };
  let front = "",
    back = "";
  if (!isID) {
    front =
      graphic(650, 20, 475, 620) +
      image(descriptor, 60, 90, 460, 134) +
      block(
        "Supply. Build. Connect.",
        60,
        350,
        550,
        70,
        34,
        b.white,
        false,
        false,
        32,
      ) +
      block(c.name, 60, 500, 550, 72, 30, b.white, true, false, 26);
    back =
      block(s.name, 60, 70, 900, 132, 46, b.navy, true, false, 36) +
      block(s.title, 60, 215, 900, 100, 34, b.blue, false, false, 28) +
      block(
        [s.email || c.email, s.phone || c.phone, c.website].join("\n"),
        60,
        345,
        900,
        180,
        34,
        b.ink,
        false,
        false,
        26,
      ) +
      (/Abuja/i.test(c.address)
        ? block("Abuja, Nigeria", 60, 550, 900, 48, 30, b.secondary)
        : "");
  } else {
    front =
      graphic(430, 150, 353, 460) +
      image(mark, 60, 50, 336, 96) +
      `<rect x="140" y="190" width="368" height="400" rx="12" fill="${b.paper}"/>` +
      (photo
        ? `<image x="152" y="202" width="344" height="376" preserveAspectRatio="xMidYMid slice" href="data:image/jpeg;base64,${photo.toString("base64")}"/>`
        : block("Photograph", 170, 350, 308, 70, 32, b.muted)) +
      block(s.name, 60, 640, 528, 112, 40, b.white, true, false, 30) +
      block(s.title, 60, 765, 528, 68, 28, b.cyan, false, false, 24) +
      block(s.department, 60, 830, 528, 38, 24, b.paper, false, false, 22) +
      block(s.staff_number, 60, 872, 528, 40, 28, b.white, true, true, 22) +
      block(
        `Issued ${s.issued_on}${s.expires_on ? "\nExpires " + s.expires_on : ""}`,
        60,
        923,
        528,
        53,
        21,
        b.paper,
        false,
        true,
        19,
      );
    back =
      graphic(430, 150, 353, 460) +
      image(mark, 60, 50, 336, 96) +
      block("Company identification", 60, 180, 528, 55, 30, b.white, true) +
      block(c.name, 60, 245, 330, 100, 30, b.white, true, false, 26) +
      block(c.address, 60, 360, 330, 210, 26, b.paper, false, false, 23) +
      block(
        [c.email, c.phone, c.website].join("\n"),
        60,
        620,
        528,
        150,
        26,
        b.white,
        false,
        false,
        23,
      ) +
      block(
        "Property of Lutera. If found, contact the company. This is not a government-issued identity document.",
        60,
        820,
        528,
        130,
        22,
        b.paper,
        false,
        false,
        20,
      );
  }
  const state = !s.active
    ? "Inactive"
    : s.expires_on &&
        s.expires_on <
          new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" })
      ? "Expired"
      : "";
  if (state) {
    const warning =
      `<rect x="-36" y="${h - 60}" width="${w + 72}" height="96" fill="${b.danger}"/>` +
      block(state, 60, h - 51, w - 120, 48, 28, b.white, true);
    front += warning;
    back += warning;
  }
  const render = (inner: string, dark: boolean, bleed = 0) =>
    brandedSVG(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${w + bleed * 2}" height="${h + bleed * 2}" viewBox="${-bleed} ${-bleed} ${w + bleed * 2} ${h + bleed * 2}"><rect x="${-bleed}" y="${-bleed}" width="${w + bleed * 2}" height="${h + bleed * 2}" fill="${dark ? b.navy : b.paper}"/>${inner}</svg>`,
    );
  const [frontPNG, backPNG] = await Promise.all([
    render(front, true),
    render(back, isID),
  ]);
  if (format === "png") return side === "front" ? frontPNG : backPNG;
  if (format === "pdf") {
    const pdf = await PDFDocument.create(),
      unit = 72 / 25.4,
      trimW = (isID ? 54 : 85) * unit,
      trimH = (isID ? 86 : 55) * unit;
    const padding = printBleed ? 6 * unit : 0,
      bleed = 3 * unit;
    const imgs = printBleed
      ? await Promise.all([render(front, true, 36), render(back, isID, 36)])
      : [frontPNG, backPNG];
    for (const bytes of imgs) {
      const page = pdf.addPage([trimW + 2 * padding, trimH + 2 * padding]);
      const img = await pdf.embedPng(bytes);
      page.setTrimBox(padding, padding, trimW, trimH);
      if (printBleed) {
        page.setBleedBox(bleed, bleed, trimW + 2 * bleed, trimH + 2 * bleed);
        page.drawImage(img, {
          x: bleed,
          y: bleed,
          width: trimW + 2 * bleed,
          height: trimH + 2 * bleed,
        });
        for (const x of [padding, padding + trimW])
          for (const [start, end] of [
            [0, bleed],
            [trimH + padding + bleed, trimH + 2 * padding],
          ])
            page.drawLine({
              start: { x, y: start },
              end: { x, y: end },
              thickness: 0.25,
              color: rgb(0, 0, 0),
            });
        for (const y of [padding, padding + trimH])
          for (const [start, end] of [
            [0, bleed],
            [trimW + padding + bleed, trimW + 2 * padding],
          ])
            page.drawLine({
              start: { x: start, y },
              end: { x: end, y },
              thickness: 0.25,
              color: rgb(0, 0, 0),
            });
      } else page.drawImage(img, { x: 0, y: 0, width: trimW, height: trimH });
    }
    pdf.setTitle(
      `Lutera ${isID ? "staff ID" : "business card"}${printBleed ? " — 3 mm print bleed" : ""}`,
    );
    pdf.setAuthor(c.name);
    return Buffer.from(await pdf.save());
  }
  return Packer.toBuffer(
    new Document({
      creator: c.name,
      sections: [
        {
          children: [frontPNG, backPNG].map(
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
          ),
        },
      ],
    }),
  );
}
