import sharp from "sharp";
import { scanEvidence } from "./evidence-scan";
export async function normalizeAvatar(data: string) {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(data))
    throw new Error("Choose a valid JPEG, PNG or WebP image.");
  const bytes = Buffer.from(data, "base64");
  if (bytes.length > 1048576)
    throw new Error("Choose a profile photo under 1 MB.");
  await scanEvidence(bytes);
  try {
    const image = sharp(bytes, { limitInputPixels: 16000000 });
    const meta = await image.metadata();
    if (!["jpeg", "png", "webp"].includes(meta.format || ""))
      throw new Error("format");
    return await image
      .rotate()
      .resize(512, 512, { fit: "cover", withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
  } catch {
    throw new Error(
      "Choose a valid JPEG, PNG or WebP image under 1 MB and 16 megapixels.",
    );
  }
}
