import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import compression from "compression";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
import crypto from "crypto";
import fs from "fs";
import subscribeRouter from "./routes/subscribe.js";
import { sendWelcomeEmail } from "./services/mailer.js";
import { verifyDownloadToken } from "./utils/downloadToken.js";
import { findSubscriptionBySessionId, findSubscriptionByEmail, updateSubscription, logEmail, logDownload } from "./services/supabase.js";

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Security and performance middlewares
app.use(helmet({
	contentSecurityPolicy: false
}));
app.use(compression());
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

// Body parsers
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Static assets
app.use("/public", express.static(path.join(__dirname, "public"), { maxAge: "7d", etag: true }));

// Views helper
const viewsPath = path.join(__dirname, "views");
const sendView = (res, filename) => {
	res.sendFile(path.join(viewsPath, filename));
};

// -------- Secure preview token helpers --------
const PREVIEW_SECRET = process.env.PREVIEW_SECRET || "dev_preview_secret";
const DOMAIN = process.env.DOMAIN || `http://localhost:${PORT}`;
const secureSamplesDir = path.join(__dirname, "secure", "samples");
const downloadSecret = process.env.DOWNLOAD_SECRET || process.env.PREVIEW_SECRET || "dev_download_secret";

const SAMPLE_FILES = [
	{ filename: "labubu1.mp3", labelEn: "Labubu Chirp", labelZh: "Labubu 锁车音 · 版本 1" },
	{ filename: "labubu2.mp3", labelEn: "Labubu Pulse", labelZh: "Labubu 锁车音 · 版本 2" },
	{ filename: "labubu3.mp3", labelEn: "Labubu Wave", labelZh: "Labubu 锁车音 · 版本 3" },
	{ filename: "windows.mp3", labelEn: "Windows Chime", labelZh: "Windows 系统提示音" },
	{ filename: "winopen.mp3", labelEn: "Windows Start", labelZh: "Windows 开机音" },
	{ filename: "jiming.mp3", labelEn: "Morning Rooster", labelZh: "鸡鸣提示音" },
];
const ALLOWED_SAMPLE_NAMES = new Set(SAMPLE_FILES.map((item) => item.filename));

function hmac(content) {
	return Buffer.from(crypto.createHmac("sha256", PREVIEW_SECRET).update(content).digest("hex")).toString("base64url");
}
function signPreviewToken(filename, expiresAtMs) {
	const payload = `${filename}.${expiresAtMs}`;
	const sig = hmac(payload);
	return Buffer.from(`${payload}.${sig}`).toString("base64url");
}
function verifyPreviewToken(token) {
	try {
		const raw = Buffer.from(token, "base64url").toString();
		const parts = raw.split(".");
		if (parts.length < 3) return null;
		const sig = parts.pop();
		const expStr = parts.pop();
		const filename = parts.join(".");
		if (!filename || !expStr || !sig) return null;
		const expected = hmac(`${filename}.${expStr}`);
		if (expected !== sig) return null;
		const exp = Number(expStr);
		if (Number.isNaN(exp) || Date.now() > exp) return null;
		return { filename, exp };
	} catch {
		return null;
	}
}

// Routes - default English
app.get("/", (req, res) => {
	return sendView(res, "index_en.html");
});

app.use("/", subscribeRouter);

app.get("/success", async (req, res) => {
	const email = (req.query.email || "").toString().trim();
	const sessionId = (req.query.session_id || "").toString().trim();
	
	if (email) {
		let subscription = null;
		
		// Try to find and update subscription if session_id is provided
		if (sessionId) {
			subscription = await findSubscriptionBySessionId(sessionId);
			if (subscription) {
				// Update subscription status to completed
				await updateSubscription(subscription.id, {
					status: "completed",
					email_sent: false, // Will be updated after email is sent
				}).catch((err) => {
					console.error("Failed to update subscription:", err);
				});
			}
		}
		
		try {
			await sendWelcomeEmail(email, subscription?.id);
		} catch (err) {
			console.error("Failed to send welcome email:", err);
			if (subscription?.id) {
				await logEmail(subscription.id, email, "welcome", "failed", err.message).catch(() => {});
			}
		}
	}
	return sendView(res, "success_en.html");
});

app.get("/sounds", (req, res) => {
	return sendView(res, "sounds_en.html");
});

app.get("/install-guide", (req, res) => {
	return sendView(res, "install-guide_en.html");
});

app.get("/privacy", (req, res) => {
	return sendView(res, "privacy_en.html");
});

app.get("/refund-policy", (req, res) => {
	return sendView(res, "refund-policy_en.html");
});

// Explicit language routes
app.get("/en", (req, res) => sendView(res, "index_en.html"));
app.get("/en/success", (req, res) => sendView(res, "success_en.html"));
app.get("/en/sounds", (req, res) => sendView(res, "sounds_en.html"));
app.get("/en/install-guide", (req, res) => sendView(res, "install-guide_en.html"));
app.get("/en/privacy", (req, res) => sendView(res, "privacy_en.html"));
app.get("/en/refund-policy", (req, res) => sendView(res, "refund-policy_en.html"));

app.get("/zh", (req, res) => sendView(res, "index.html"));
app.get("/zh/success", (req, res) => sendView(res, "success.html"));
app.get("/zh/sounds", (req, res) => sendView(res, "sounds.html"));
app.get("/zh/install-guide", (req, res) => sendView(res, "install-guide.html"));
app.get("/zh/privacy", (req, res) => sendView(res, "privacy.html"));
app.get("/zh/refund-policy", (req, res) => sendView(res, "refund-policy.html"));

// ---- API: signed preview url ----
app.get("/api/preview-url", (req, res) => {
	const name = (req.query.name || "").toString().trim();
	if (!ALLOWED_SAMPLE_NAMES.has(name)) {
		return res.status(400).json({ error: "invalid name" });
	}
	const expiresAt = Date.now() + 60 * 1000; // 1 minute
	const token = signPreviewToken(name, expiresAt);
	const url = `/preview/${name}?token=${encodeURIComponent(token)}`;
	return res.json({ url, expiresAt });
});

app.get("/api/preview-list", (req, res) => {
	return res.json({
		samples: SAMPLE_FILES.map((item) => ({
			filename: item.filename,
			labelEn: item.labelEn,
			labelZh: item.labelZh,
		}))
	});
});

// ---- Secure preview streaming ----
app.get("/preview/:name", async (req, res) => {
	const token = (req.query.token || "").toString();
	const verify = verifyPreviewToken(token);
	if (!verify || verify.filename !== req.params.name) {
		return res.status(401).send("Unauthorized");
	}
	// Same-origin / referer check
	const referer = req.get("referer") || "";
	if (referer && !referer.startsWith(DOMAIN)) {
		return res.status(403).send("Forbidden");
	}

	// Try to get file from R2 or local
	const { getPreviewFile } = await import("./services/r2-storage.js");
	const fileData = await getPreviewFile(verify.filename);

	if (!fileData) {
		return res.status(404).send("Not Found");
	}

	res.setHeader("Content-Type", "audio/mpeg");
	res.setHeader("Content-Disposition", "inline; filename=\"preview.mp3\"");
	res.setHeader("Cache-Control", "no-store, max-age=0");
	res.setHeader("Referrer-Policy", "no-referrer");
	res.setHeader("Cross-Origin-Resource-Policy", "same-origin");

	// Handle stream from R2 or local file
	if (fileData.source === "r2") {
		// Cloudflare R2 - send buffer directly
		res.send(fileData.buffer);
	} else {
		// Local file stream
		fileData.stream.pipe(res);
		fileData.stream.on("error", (err) => {
			console.error("Preview stream error:", err);
			if (!res.headersSent) {
				res.status(500).end();
			}
		});
	}
});

app.get("/download/:token", async (req, res) => {
	const { token } = req.params;
	const payload = verifyDownloadToken(token, downloadSecret);
	if (!payload) {
		return res.status(403).send("Download link expired or invalid");
	}

	const fileName = (payload.filename || "tesla_sounds.zip").replace(/(\.\.\/|\/)/g, "");

	// Log download activity (fire-and-forget)
	const email = payload.email;
	if (email) {
		findSubscriptionByEmail(email)
			.then((subscription) => {
				if (subscription) {
					return logDownload(subscription.id, email, token, req);
				}
			})
			.catch((err) => {
				console.error("Failed to log download:", err);
			});
	}

	// Try to get file from storage or local
	const { getZipFile } = await import("./services/r2-storage.js");
	const fileData = await getZipFile();

	if (!fileData) {
		return res.status(404).send("File not found");
	}

	res.setHeader("Content-Type", "application/zip");
	res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
	res.setHeader("Cache-Control", "no-store, max-age=0");

	// Handle stream from storage or local file
	if (fileData.source === "r2") {
		// Cloudflare R2 - send buffer directly
		res.send(fileData.buffer);
	} else {
		// Local file stream
		fileData.stream.pipe(res);
		fileData.stream.on("error", (err) => {
			console.error("Download stream error:", err);
			if (!res.headersSent) {
				res.status(500).send("Download failed");
			}
		});
	}
});

app.all("/unsubscribe", (req, res) => {
	const email = (req.query.email || "").toString();
	console.log("Unsubscribe request received for:", email);
	res.status(200).send("You have been unsubscribed from Tesla Sounds notifications. If this was a mistake, please contact support.");
});

// Fallback 404
app.use((req, res) => {
	res.status(404).send("Not Found");
});

// Error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
	console.error(err);
	res.status(500).send("Internal Server Error");
});

// Export for Vercel serverless
export default app;

// Start server for local development
if (process.env.VERCEL !== "1") {
	app.listen(PORT, () => {
		console.log(`Server listening on http://localhost:${PORT}`);
	});
}


