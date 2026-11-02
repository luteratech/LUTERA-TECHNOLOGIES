import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Settings } from "./contracts";
import { brandLogo } from "./export-brand";
export type StatementSnapshot = {
  customer: { name: string; address?: string; email?: string };
  currency: string;
  opening_minor: number;
  events: {
    posted_on: string;
    kind: string;
    reference: string;
    debit_minor: number;
    credit_minor: number;
  }[];
  company: Settings;
  from: string;
  to: string;
};
const amount = (n: number) =>
  new Intl.NumberFormat("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n / 100);
export async function statementPDF(statement: StatementSnapshot) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(
    await readFile(path.join(process.cwd(), "public/fonts/Sora-400.ttf")),
  );
  const bold = await pdf.embedFont(
    await readFile(path.join(process.cwd(), "public/fonts/Sora-600.ttf")),
  );
  const mono = await pdf.embedFont(
    await readFile(
      path.join(process.cwd(), "public/fonts/JetBrainsMono-Regular.ttf"),
    ),
    { subset: true },
  );
  const logo = await pdf.embedPng(await brandLogo());
  const darkLogo = await pdf.embedPng(await brandLogo(true, true));
  let page = pdf.addPage([595.28, 841.89]),
    y = 0,
    balance = Number(statement.opening_minor);
  const safe = (s: string) =>
    Array.from(s)
      .map((c) => {
        try {
          font.encodeText(c);
          return c;
        } catch {
          return "?";
        }
      })
      .join("");
  const draw = (
    text: string,
    x: number,
    size = 9,
    strong = false,
    white = false,
    numeric = false,
  ) =>
    page.drawText(safe(text), {
      x,
      y,
      size,
      font: numeric ? mono : strong ? bold : font,
      color: white ? rgb(1, 1, 1) : rgb(22 / 255, 26 / 255, 61 / 255),
    });
  const figure = (
    text: string,
    end: number,
    available = 74,
    strong = false,
  ) => {
    let size = 9;
    while (size > 6 && mono.widthOfTextAtSize(text, size) > available)
      size -= 0.25;
    draw(
      text,
      end - mono.widthOfTextAtSize(text, size),
      size,
      strong,
      false,
      true,
    );
  };
  const header = (cover = false) => {
    if (cover) {
      page.drawRectangle({
        x: 0,
        y: 700,
        width: 595.28,
        height: 141.89,
        color: rgb(22 / 255, 26 / 255, 61 / 255),
      });
      page.drawImage(darkLogo, { x: 56.69, y: 766, width: 145, height: 42 });
      y = 728;
      draw("Customer statement", 56.69, 24, true, true);
      y = 695;
    } else {
      page.drawImage(logo, { x: 56.69, y: 785, width: 112, height: 32 });
      y = 755;
      draw("Customer statement", 56.69, 18, true);
    }
    y -= 28;
    draw(statement.company.company.name, 56.69, 10, true);
    y -= 17;
    draw(statement.customer.name, 56.69, 10, true);
    y -= 17;
    draw(
      `${statement.from || "Beginning"} to ${statement.to || "Current"} | ${statement.currency}`,
      56.69,
    );
    y -= 30;
    page.drawRectangle({
      x: 56.69,
      y: y - 7,
      width: 481.9,
      height: 26,
      color: rgb(22 / 255, 26 / 255, 61 / 255),
    });
    draw("Date / reference", 64.69, 9, true, true);
    draw("Debit", 308, 9, true, true);
    draw("Credit", 397, 9, true, true);
    draw("Balance", 479, 9, true, true);
    y -= 20;
  };
  const next = () => {
    if (y < 70) {
      page = pdf.addPage([595.28, 841.89]);
      header();
    }
  };
  header(true);
  draw("Opening balance", 56.69);
  figure(amount(balance), 538.59);
  y -= 25;
  for (const event of statement.events) {
    balance += Number(event.debit_minor) - Number(event.credit_minor);
    next();
    draw(`${event.posted_on}  ${event.kind}`, 56.69);
    figure(amount(Number(event.debit_minor)), 380);
    figure(amount(Number(event.credit_minor)), 459);
    figure(amount(balance), 538.59);
    y -= 15;
    const reference = String(event.reference);
    for (let start = 0; start < reference.length; start += 65) {
      next();
      draw(reference.slice(start, start + 65), 56.69, 8, false, false, true);
      y -= 13;
    }
    page.drawLine({
      start: { x: 56.69, y: y - 2 },
      end: { x: 538.59, y: y - 2 },
      thickness: 0.5,
      color: rgb(211 / 255, 212 / 255, 220 / 255),
    });
    y -= 10;
  }
  next();
  y -= 8;
  draw("Closing balance", 56.69, 11, true);
  figure(statement.currency + " " + amount(balance), 538.59, 180, true);
  for (const [i, p] of pdf.getPages().entries())
    p.drawText(
      `${statement.company.company.name} | Page ${i + 1} of ${pdf.getPageCount()}`,
      {
        x: 56.69,
        y: 30,
        font,
        size: 8,
        color: rgb(93 / 255, 98 / 255, 128 / 255),
      },
    );
  pdf.setTitle("Lutera customer statement");
  return Buffer.from(await pdf.save());
}
