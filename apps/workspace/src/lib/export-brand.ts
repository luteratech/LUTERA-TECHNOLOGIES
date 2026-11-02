import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import sharp from "sharp";
import { lutera } from "./brand";

export const escapeXML = (s: string) =>
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

export async function brandLogo(dark = false, descriptor = false) {
  return sharp(
    await readFile(
      path.join(
        process.cwd(),
        "public/brand",
        `lutera-horizontal-${descriptor ? "descriptor-" : ""}${dark ? "dark" : "light"}.svg`,
      ),
    ),
  )
    .resize(640)
    .png()
    .toBuffer();
}

export function labRowsSVG(x: number, y: number, scale = 1) {
  return `<g transform="translate(${x},${y}) scale(${scale})" fill="white" opacity=".06">${[
    0, 68, 136, 204,
  ]
    .map(
      (left) =>
        `<rect x="${left}" width="16" height="84" rx="8"/><rect x="${left + 24}" y="56" width="16" height="28" rx="8"/><rect x="${left + 48}" y="56" width="16" height="28" rx="8"/>`,
    )
    .join("")}</g>`;
}

let fonts: Promise<fontkit.Font[]> | undefined;
const exportFonts = () =>
  (fonts ||= Promise.all(
    [
      "Sora-400.ttf",
      "Sora-600.ttf",
      "ExportFallback.ttf",
      "ExportFallback-Bold.ttf",
    ].map(async (f) =>
      fontkit.create(
        await readFile(path.join(process.cwd(), "public/fonts", f)),
      ),
    ),
  ));

/** Outline exported image text with the packaged Sora font. This avoids relying
 * on fonts installed on the Vercel host; unsupported symbols use the bundled fallback. */
export async function brandedSVG(svg: string) {
  const loaded = await exportFonts();
  const definitions = new Map<string, string>();
  const outlined = svg.replace(
    /<text\b([^>]*)>([^<]*)<\/text>/g,
    (_, attrs: string, encoded: string) => {
      const attr = (key: string, fallback: string) =>
        new RegExp(`(?:^|\\s)${key}="([^"]*)"`).exec(attrs)?.[1] || fallback;
      const text = encoded.replace(
        /&(amp|lt|gt|quot|apos);/g,
        (_, n: string) =>
          ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" })[n]!,
      );
      const strong = Number(attr("font-weight", "400")) >= 600;
      const preferred = loaded[strong ? 1 : 0];
      const font = [...text].every((c) =>
        preferred.hasGlyphForCodePoint(c.codePointAt(0)!),
      )
        ? preferred
        : loaded[strong ? 3 : 2];
      if ([...text].some((c) => !font.hasGlyphForCodePoint(c.codePointAt(0)!)))
        throw new Error(
          "The image font cannot display one of these characters. Use the Word export or adjust the unsupported character.",
        );
      const run = font.layout(text),
        scale = Number(attr("font-size", "20")) / font.unitsPerEm;
      let pen = 0;
      const paths = run.glyphs
        .map((glyph, i) => {
          const pos = run.positions[i];
          const id = `lt-glyph-${loaded.indexOf(font)}-${glyph.id}`;
          if (!definitions.has(id))
            definitions.set(id, `<path id="${id}" d="${glyph.path.toSVG()}"/>`);
          const p = `<use href="#${id}" transform="translate(${pen + pos.xOffset},${pos.yOffset})"/>`;
          pen += pos.xAdvance;
          return p;
        })
        .join("");
      const anchor = attr("text-anchor", "start");
      const x =
        Number(attr("x", "0")) -
        (anchor === "end"
          ? pen * scale
          : anchor === "middle"
            ? (pen * scale) / 2
            : 0);
      return `<g fill="${attr("fill", lutera.navy)}" transform="translate(${x},${attr("y", "0")}) scale(${scale},${-scale})">${paths}</g>`;
    },
  );
  return sharp(
    Buffer.from(
      outlined.replace(
        /(<svg\b[^>]*>)/,
        `$1<defs>${[...definitions.values()].join("")}</defs>`,
      ),
    ),
  )
    .png()
    .toBuffer();
}
