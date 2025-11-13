import dotenv from "dotenv";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || "tesla-sounds";
const SAMPLES_DIR = process.argv[2] || path.join(__dirname, "..", "secure", "samples");

if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
	console.error("❌ R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY are required");
	process.exit(1);
}

const s3Client = new S3Client({
	region: "auto",
	endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
	credentials: {
		accessKeyId: R2_ACCESS_KEY_ID,
		secretAccessKey: R2_SECRET_ACCESS_KEY,
	},
});

async function uploadSamples() {
	console.log("📤 Uploading preview samples to Cloudflare R2...\n");
	console.log(`   Bucket: ${R2_BUCKET_NAME}`);
	console.log(`   Samples directory: ${SAMPLES_DIR}\n`);

	// Check if directory exists
	if (!fs.existsSync(SAMPLES_DIR)) {
		console.error(`❌ Directory not found: ${SAMPLES_DIR}`);
		process.exit(1);
	}

	// Get all MP3 files
	const files = fs.readdirSync(SAMPLES_DIR).filter(f => f.endsWith('.mp3'));
	
	if (files.length === 0) {
		console.error(`❌ No MP3 files found in ${SAMPLES_DIR}`);
		process.exit(1);
	}

	console.log(`📁 Found ${files.length} MP3 files:\n`);

	let successCount = 0;
	let failCount = 0;

	for (const filename of files) {
		const filePath = path.join(SAMPLES_DIR, filename);
		const stats = fs.statSync(filePath);
		const fileSize = (stats.size / 1024).toFixed(2);

		try {
			console.log(`📤 Uploading ${filename} (${fileSize} KB)...`);
			
			const fileBuffer = fs.readFileSync(filePath);
			const r2Path = `samples/${filename}`;

			const command = new PutObjectCommand({
				Bucket: R2_BUCKET_NAME,
				Key: r2Path,
				Body: fileBuffer,
				ContentType: "audio/mpeg",
			});

			await s3Client.send(command);
			console.log(`   ✅ Uploaded: ${r2Path}\n`);
			successCount++;
		} catch (err) {
			console.error(`   ❌ Failed: ${err.message}\n`);
			failCount++;
		}
	}

	console.log("📊 Upload Summary:");
	console.log(`   ✅ Success: ${successCount}`);
	console.log(`   ❌ Failed: ${failCount}\n`);

	if (successCount > 0) {
		console.log("🎉 Upload complete!");
		console.log("\n💡 Preview files are now available from R2");
		console.log("   Restart your server to use R2 for preview files");
	}

	if (failCount > 0) {
		process.exit(1);
	}
}

uploadSamples().catch((err) => {
	console.error("❌ Unexpected error:", err);
	process.exit(1);
});

