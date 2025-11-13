import { S3Client, GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cloudflare R2 配置
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || "tesla-sounds";
const R2_FILE_PATH = process.env.R2_FILE_PATH || "tesla_sounds.zip";
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL; // 可选：如果 bucket 是公开的

// 初始化 S3 客户端（兼容 R2）
const s3Client = R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY
	? new S3Client({
		region: "auto",
		endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
		credentials: {
			accessKeyId: R2_ACCESS_KEY_ID,
			secretAccessKey: R2_SECRET_ACCESS_KEY,
		},
	})
	: null;

/**
 * Get ZIP file - tries R2 first, falls back to local file
 */
export async function getZipFile() {
	// Try R2 Storage first
	if (s3Client) {
		try {
			const command = new GetObjectCommand({
				Bucket: R2_BUCKET_NAME,
				Key: R2_FILE_PATH,
			});

			const response = await s3Client.send(command);
			
			if (response.Body) {
				console.log("✅ Using file from Cloudflare R2");
				// Convert stream to buffer
				const chunks = [];
				for await (const chunk of response.Body) {
					chunks.push(chunk);
				}
				const buffer = Buffer.concat(chunks);
				
				return {
					buffer,
					size: buffer.length,
					source: "r2",
				};
			}
		} catch (err) {
			if (err.name !== "NoSuchKey") {
				console.error("Error fetching from R2:", err.message);
			}
			// Fall through to local file
		}
	}

	// Fallback to local file
	const localPath = path.join(__dirname, "..", "public", "assets", "tesla_sounds.zip");
	try {
		if (fs.existsSync(localPath)) {
			const stats = fs.statSync(localPath);
			console.log("✅ Using local file");
			return {
				stream: fs.createReadStream(localPath),
				size: stats.size,
				source: "local",
			};
		}
	} catch (err) {
		console.error("Error reading local file:", err);
	}

	return null;
}

/**
 * Get file size
 */
export async function getZipFileSize() {
	// Try R2 Storage first
	if (s3Client) {
		try {
			const command = new HeadObjectCommand({
				Bucket: R2_BUCKET_NAME,
				Key: R2_FILE_PATH,
			});

			const response = await s3Client.send(command);
			if (response.ContentLength) {
				return response.ContentLength;
			}
		} catch (err) {
			if (err.name !== "NotFound") {
				console.error("Error checking R2 file size:", err.message);
			}
		}
	}

	// Fallback to local file
	const localPath = path.join(__dirname, "..", "public", "assets", "tesla_sounds.zip");
	try {
		if (fs.existsSync(localPath)) {
			const stats = fs.statSync(localPath);
			return stats.size;
		}
	} catch (err) {
		// Ignore
	}

	return null;
}

/**
 * Get download URL - uses R2 signed URL or public URL
 */
export async function getDownloadUrl(email, downloadSecret, downloadTtlMs) {
	const domain = (process.env.DOMAIN || "http://localhost:3000").replace(/\/$/, "");

	// If using R2 public URL (bucket is public)
	if (R2_PUBLIC_URL) {
		return `${R2_PUBLIC_URL}/${R2_FILE_PATH}`;
	}

	// If using R2, try to get signed URL
	if (s3Client) {
		try {
			const command = new GetObjectCommand({
				Bucket: R2_BUCKET_NAME,
				Key: R2_FILE_PATH,
			});

			const expiresIn = Math.round((downloadTtlMs || 24 * 60 * 60 * 1000) / 1000);
			const signedUrl = await getSignedUrl(s3Client, command, { expiresIn });
			
			if (signedUrl) {
				console.log("✅ Using Cloudflare R2 signed URL");
				return signedUrl;
			}
		} catch (err) {
			console.error("Error generating R2 signed URL:", err.message);
		}
	}

	// Fallback to token-based download URL (through server)
	if (downloadSecret) {
		const { createDownloadToken } = await import("../utils/downloadToken.js");
		try {
			const token = createDownloadToken(
				{ email, filename: "tesla_sounds.zip" },
				downloadSecret,
				downloadTtlMs
			);
			return `${domain}/download/${token}`;
		} catch (err) {
			console.error("Failed to generate download token:", err);
		}
	}

	return null;
}

