import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.SUPABASE_URL;
// Use Service Role Key for bucket creation (has admin permissions)
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

	if (!supabaseUrl || !supabaseKey) {
	console.error("❌ SUPABASE_URL and SUPABASE_ANON_KEY (or SUPABASE_SERVICE_ROLE_KEY) are required");
	process.exit(1);
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
	console.warn("⚠️  Warning: Using ANON_KEY may not have permission to create buckets.");
	console.warn("   For bucket creation, use SUPABASE_SERVICE_ROLE_KEY (found in Supabase Dashboard > Settings > API)");
	console.warn("   Or create the bucket manually in Supabase Dashboard > Storage\n");
}

const supabase = createClient(supabaseUrl, supabaseKey);

const BUCKET_NAME = process.env.SUPABASE_STORAGE_BUCKET || "sound-packs";
const FILE_PATH = process.env.SUPABASE_STORAGE_FILE_PATH || "tesla_sounds.zip";
const LOCAL_FILE = process.argv[2] || path.join(__dirname, "..", "public", "assets", "tesla_sounds.zip");

async function uploadFile() {
	console.log("📤 Uploading file to Supabase Storage...\n");
	console.log(`   Bucket: ${BUCKET_NAME}`);
	console.log(`   File path: ${FILE_PATH}`);
	console.log(`   Local file: ${LOCAL_FILE}\n`);

	// Check if local file exists
	if (!fs.existsSync(LOCAL_FILE)) {
		console.error(`❌ Local file not found: ${LOCAL_FILE}`);
		process.exit(1);
	}

	const fileStats = fs.statSync(LOCAL_FILE);
	console.log(`   File size: ${(fileStats.size / 1024 / 1024).toFixed(2)} MB\n`);

	// Create bucket if it doesn't exist
	console.log("📦 Checking bucket...");
	const { data: buckets, error: listError } = await supabase.storage.listBuckets();
	
	if (listError) {
		console.error("❌ Error listing buckets:", listError);
		process.exit(1);
	}

	const bucketExists = buckets.some(b => b.name === BUCKET_NAME);
	
	if (!bucketExists) {
		console.log(`   Creating bucket: ${BUCKET_NAME}...`);
		const { error: createError } = await supabase.storage.createBucket(BUCKET_NAME, {
			public: false, // Private bucket, use signed URLs
		});

		if (createError) {
			console.error("❌ Error creating bucket:", createError);
			process.exit(1);
		}
		console.log("   ✅ Bucket created");
	} else {
		console.log("   ✅ Bucket exists");
	}

	// Upload file
	console.log("\n📤 Uploading file...");
	const fileBuffer = fs.readFileSync(LOCAL_FILE);
	
	const { data, error } = await supabase.storage
		.from(BUCKET_NAME)
		.upload(FILE_PATH, fileBuffer, {
			contentType: "application/zip",
			upsert: true, // Overwrite if exists
		});

	if (error) {
		console.error("❌ Error uploading file:", error);
		process.exit(1);
	}

	console.log("✅ File uploaded successfully!");
	console.log(`   Path: ${data.path}`);
	console.log(`   Full path: ${BUCKET_NAME}/${data.path}\n`);

	// Test download
	console.log("🧪 Testing download...");
	const { data: downloadData, error: downloadError } = await supabase.storage
		.from(BUCKET_NAME)
		.download(FILE_PATH);

	if (downloadError) {
		console.error("⚠️  Warning: Could not download file for verification:", downloadError);
	} else {
		console.log("✅ Download test successful!");
		console.log(`   Downloaded size: ${(downloadData.size / 1024 / 1024).toFixed(2)} MB\n`);
	}

	console.log("🎉 Upload complete!");
	console.log("\n💡 Next steps:");
	console.log("   1. Add to .env: SUPABASE_STORAGE_BUCKET=sound-packs");
	console.log("   2. Add to .env: SUPABASE_STORAGE_FILE_PATH=tesla_sounds.zip");
	console.log("   3. Restart your server");
}

uploadFile().catch((err) => {
	console.error("❌ Unexpected error:", err);
	process.exit(1);
});

