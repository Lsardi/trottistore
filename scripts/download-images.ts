#!/usr/bin/env tsx
/**
 * Download all product images from WordPress to MinIO (local S3).
 * Updates database URLs to point to MinIO instead of WordPress.
 *
 * Usage: npx tsx scripts/download-images.ts
 */
import { PrismaClient } from "@prisma/client";
import { S3Client, PutObjectCommand, CreateBucketCommand, HeadBucketCommand } from "@aws-sdk/client-s3";

const prisma = new PrismaClient();

const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || "localhost";
const MINIO_PORT = process.env.MINIO_PORT || "9001";
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY || "minioadmin";
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY || "minioadmin";
const BUCKET = "product-images";
const MINIO_PUBLIC_URL = `http://${MINIO_ENDPOINT}:${MINIO_PORT}/${BUCKET}`;

const s3 = new S3Client({
  endpoint: `http://${MINIO_ENDPOINT}:${MINIO_PORT}`,
  region: "us-east-1",
  credentials: {
    accessKeyId: MINIO_ACCESS_KEY,
    secretAccessKey: MINIO_SECRET_KEY,
  },
  forcePathStyle: true,
});

async function ensureBucket() {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: BUCKET }));
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: BUCKET }));
    console.log(`  Bucket "${BUCKET}" created`);
  }
}

function getContentType(url: string): string {
  if (url.endsWith(".png")) return "image/png";
  if (url.endsWith(".webp")) return "image/webp";
  if (url.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

function urlToKey(url: string): string {
  // Extract path after wp-content/uploads/
  const match = url.match(/wp-content\/uploads\/(.+)/);
  if (match) return match[1];
  // Fallback: use last 2 path segments
  const parts = new URL(url).pathname.split("/").filter(Boolean);
  return parts.slice(-2).join("/");
}

async function main() {
  console.log("\n═══ DOWNLOAD IMAGES TO MINIO ═══\n");

  await ensureBucket();

  const images = await prisma.productImage.findMany({
    where: { url: { contains: "trottistore.fr" } },
    select: { id: true, url: true },
  });

  console.log(`  Images to download: ${images.length}`);

  let downloaded = 0;
  let failed = 0;
  let skipped = 0;

  for (const img of images) {
    const key = urlToKey(img.url);

    try {
      // Download from WordPress
      const res = await fetch(img.url, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) {
        failed++;
        if (failed <= 5) console.log(`  ✗ ${res.status} ${img.url.slice(-50)}`);
        continue;
      }

      const buffer = Buffer.from(await res.arrayBuffer());

      // Skip tiny files (likely error pages)
      if (buffer.length < 100) {
        skipped++;
        continue;
      }

      // Upload to MinIO
      await s3.send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: buffer,
        ContentType: getContentType(img.url),
        ACL: "public-read",
      }));

      // Update DB URL
      const newUrl = `${MINIO_PUBLIC_URL}/${key}`;
      await prisma.productImage.update({
        where: { id: img.id },
        data: { url: newUrl },
      });

      downloaded++;

      if (downloaded % 100 === 0) {
        console.log(`  ... ${downloaded}/${images.length} downloaded`);
      }
    } catch (err) {
      failed++;
      if (failed <= 5) console.log(`  ✗ ${(err as Error).message?.slice(0, 60)} — ${img.url.slice(-40)}`);
    }
  }

  console.log(`\n  Downloaded: ${downloaded}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`\n═══ DONE ═══\n`);

  await prisma.$disconnect();
}

main().catch(console.error);
