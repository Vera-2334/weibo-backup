// ============================================================
// Weibo Image Downloader — downloads images to local storage
// ============================================================

import fs from "fs";
import path from "path";
import { getDb, getUndownloadedImageCount, updateImage, getImages } from "./db";

const IMAGE_DIR = path.join(process.cwd(), "public", "uploads", "weibo");

function ensureDir(): void {
  if (!fs.existsSync(IMAGE_DIR)) {
    fs.mkdirSync(IMAGE_DIR, { recursive: true });
  }
}

export function getImageDir(): string {
  ensureDir();
  return IMAGE_DIR;
}

// Download a single image
export async function downloadImage(
  imageUrl: string,
  weibo_id: string,
  index: number
): Promise<{ localPath: string; fileSize: number; success: boolean; error?: string }> {
  ensureDir();

  // Determine extension from URL
  const urlObj = new URL(imageUrl);
  const extMatch = urlObj.pathname.match(/\.(jpg|jpeg|png|gif|webp)/i);
  const ext = extMatch ? extMatch[1].toLowerCase() : "jpg";
  const filename = `${weibo_id}_${index}.${ext}`;
  const filePath = path.join(IMAGE_DIR, filename);

  try {
    const resp = await fetch(imageUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; WeiboBackup/1.0)",
        Referer: "https://m.weibo.cn/",
      },
    });

    if (!resp.ok) {
      return { localPath: "", fileSize: 0, success: false, error: `HTTP ${resp.status}` };
    }

    const buffer = Buffer.from(await resp.arrayBuffer());
    fs.writeFileSync(filePath, buffer);

    const relativePath = `/uploads/weibo/${filename}`;
    return { localPath: relativePath, fileSize: buffer.length, success: true };
  } catch (err: any) {
    return { localPath: "", fileSize: 0, success: false, error: err.message || "下载失败" };
  }
}

// Batch download all undownloaded images
export async function downloadAllPending(
  onProgress?: (progress: { completed: number; total: number; currentUrl: string }) => void
): Promise<{ total: number; downloaded: number; failed: number }> {
  ensureDir();

  const images = await getImages(undefined, true); // only undownloaded
  const total = images.length;

  if (total === 0) return { total: 0, downloaded: 0, failed: 0 };

  let downloaded = 0;
  let failed = 0;

  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    const result = await downloadImage(img.original_url, img.weibo_id, i);

    if (result.success) {
      await updateImage(img.id, {
        local_path: result.localPath,
        file_size: result.fileSize,
        fetched: 1,
      });
      downloaded++;
    } else {
      await updateImage(img.id, { fetched: -1 });
      failed++;
    }

    if (onProgress) {
      onProgress({ completed: i + 1, total, currentUrl: img.original_url });
    }

    // Small delay between downloads
    if (i < images.length - 1) {
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  return { total, downloaded, failed };
}

// Retry failed downloads
export async function retryFailed(
  onProgress?: (progress: { completed: number; total: number; currentUrl: string }) => void
): Promise<{ total: number; downloaded: number; failed: number }> {
  ensureDir();

  const images = await getImages(undefined, false); // all images
  const failedImages = images.filter((img) => img.fetched === -1);
  const total = failedImages.length;

  if (total === 0) return { total: 0, downloaded: 0, failed: 0 };

  let downloaded = 0;
  let failed = 0;

  for (let i = 0; i < failedImages.length; i++) {
    const img = failedImages[i];
    const result = await downloadImage(img.original_url, img.weibo_id, i);

    if (result.success) {
      await updateImage(img.id, {
        local_path: result.localPath,
        file_size: result.fileSize,
        fetched: 1,
      });
      downloaded++;
    } else {
      failed++;
    }

    if (onProgress) {
      onProgress({ completed: i + 1, total, currentUrl: img.original_url });
    }
  }

  return { total, downloaded, failed };
}