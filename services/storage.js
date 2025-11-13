import { getFileFromStorage, getSignedUrl } from "./supabase.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "sound-packs";
const STORAGE_FILE_PATH = process.env.SUPABASE_STORAGE_FILE_PATH || "tesla_sounds.zip";

/**
 * Get ZIP file - tries Supabase Storage first, falls back to local file
 */
export async function getZipFile() {
	// Try Supabase Storage first
	if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
		const file = await getFileFromStorage(STORAGE_BUCKET, STORAGE_FILE_PATH);
		if (file) {
			console.log("✅ Using file from Supabase Storage");
			// Convert Blob to ArrayBuffer for streaming
			const arrayBuffer = await file.arrayBuffer();
			return {
				stream: () => arrayBuffer,
				buffer: Buffer.from(arrayBuffer),
				size: file.size || arrayBuffer.byteLength,
				source: "storage",
			};
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
	// Try Supabase Storage first
	if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
		const file = await getFileFromStorage(STORAGE_BUCKET, STORAGE_FILE_PATH);
		if (file && file.size) {
			return file.size;
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
 * Get download URL - uses Supabase Storage signed URL or generates token-based URL
 */
export async function getDownloadUrl(email, downloadSecret, downloadTtlMs) {
	const domain = (process.env.DOMAIN || "http://localhost:3000").replace(/\/$/, "");

	// If using Supabase Storage, try to get signed URL
	if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
		const expiresIn = Math.round((downloadTtlMs || 24 * 60 * 60 * 1000) / 1000);
		const signedUrl = await getSignedUrl(STORAGE_BUCKET, STORAGE_FILE_PATH, expiresIn);
		if (signedUrl) {
			console.log("✅ Using Supabase Storage signed URL");
			return signedUrl;
		}
	}

	// Fallback to token-based download URL
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

