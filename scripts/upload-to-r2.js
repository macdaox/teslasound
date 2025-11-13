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
const R2_FILE_PATH = process.env.R2_FILE_PATH || "tesla_sounds.zip";
const LOCAL_FILE = process.argv[2] || path.join(__dirname, "..", "public", "assets", "tesla_sounds.zip");

if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
	console.error("❌ R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY are required");
	console.error("\n💡 获取方法：");
	console.error("   1. R2_ACCOUNT_ID: Dashboard 右侧边栏或 R2 概览页面");
	console.error("   2. R2_ACCESS_KEY_ID: R2 > Manage R2 API Tokens > 创建 Token > 复制'访问密钥 ID'");
	console.error("   3. R2_SECRET_ACCESS_KEY: 同上，复制'机密访问密钥'");
	console.error("   注意：'令牌值'不需要，可以忽略");
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

async function uploadFile() {
	console.log("📤 Uploading file to Cloudflare R2...\n");
	console.log(`   Bucket: ${R2_BUCKET_NAME}`);
	console.log(`   File path: ${R2_FILE_PATH}`);
	console.log(`   Local file: ${LOCAL_FILE}\n`);

	// Check if local file exists
	if (!fs.existsSync(LOCAL_FILE)) {
		console.error(`❌ Local file not found: ${LOCAL_FILE}`);
		process.exit(1);
	}

	const fileStats = fs.statSync(LOCAL_FILE);
	console.log(`   File size: ${(fileStats.size / 1024 / 1024).toFixed(2)} MB\n`);

	// Read file
	console.log("📖 Reading file...");
	const fileBuffer = fs.readFileSync(LOCAL_FILE);

	// Upload file
	console.log("📤 Uploading to R2...");
	const command = new PutObjectCommand({
		Bucket: R2_BUCKET_NAME,
		Key: R2_FILE_PATH,
		Body: fileBuffer,
		ContentType: "application/zip",
	});

	try {
		const response = await s3Client.send(command);
		console.log("✅ File uploaded successfully!");
		console.log(`   ETag: ${response.ETag}\n`);

		// Test download
		console.log("🧪 Testing download...");
		const { GetObjectCommand } = await import("@aws-sdk/client-s3");
		const getCommand = new GetObjectCommand({
			Bucket: R2_BUCKET_NAME,
			Key: R2_FILE_PATH,
		});
		
		const getResponse = await s3Client.send(getCommand);
		if (getResponse.ContentLength) {
			console.log("✅ Download test successful!");
			console.log(`   Downloaded size: ${(getResponse.ContentLength / 1024 / 1024).toFixed(2)} MB\n`);
		}

		console.log("🎉 Upload complete!");
		console.log("\n💡 Next steps:");
		console.log("   1. Make sure R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY are in .env");
		console.log("   2. Optional: Set R2_PUBLIC_URL if bucket is public");
		console.log("   3. Restart your server");
	} catch (err) {
		if (err.name === "NoSuchBucket") {
			console.error(`❌ Bucket '${R2_BUCKET_NAME}' does not exist`);
			console.error("\n💡 Create bucket in Cloudflare Dashboard:");
			console.error("   1. Go to R2");
			console.error(`   2. Create bucket: ${R2_BUCKET_NAME}`);
			console.error("   3. Run this script again");
		} else {
			console.error("❌ Error uploading file:", err.message);
		}
		process.exit(1);
	}
}

uploadFile().catch((err) => {
	console.error("❌ Unexpected error:", err);
	process.exit(1);
});

