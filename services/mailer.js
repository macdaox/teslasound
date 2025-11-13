import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import { createDownloadToken } from "../utils/downloadToken.js";
import { logEmail, updateSubscription } from "./supabase.js";
import { getDownloadUrl } from "./r2-storage.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const viewsDir = path.join(__dirname, "..", "views");
const publicDir = path.join(__dirname, "..", "public");

const smtpHost = process.env.SMTP_HOST;
const smtpPort = Number(process.env.SMTP_PORT || 587);
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const fromEmail = process.env.FROM_EMAIL || "noreply@example.com";

const transporter = nodemailer.createTransport({
	host: smtpHost,
	port: smtpPort,
	secure: smtpPort === 465,
	auth: {
		user: smtpUser,
		pass: smtpPass,
	}
});

export async function sendWelcomeEmail(toEmail, subscriptionId = null) {
	const templatePath = path.join(viewsDir, "email_template.html");

	const resolvedDomain = (process.env.DOMAIN || "http://localhost:3000").replace(/\/$/, "");

	let html = "<p>Thanks for your purchase!</p>";
	try {
		html = await fs.readFile(templatePath, "utf-8");
		// Replace {{DOMAIN}} placeholder with actual domain
		html = html.replace(/\{\{DOMAIN\}\}/g, resolvedDomain);
	} catch (e) {
		// fallback to default html
	}

	// Always use download link (no attachments)
	const downloadSecret = process.env.DOWNLOAD_SECRET || process.env.PREVIEW_SECRET || "dev_download_secret";
	const downloadTtlMs = process.env.DOWNLOAD_TTL_MS || 24 * 60 * 60 * 1000;
	const manualDownloadUrl = process.env.DOWNLOAD_URL; // Optional: pre-defined URL
	
	let attachments = [];
	let downloadLink = null;
	
	// Always generate download link (no attachment check)
	if (manualDownloadUrl) {
		downloadLink = manualDownloadUrl;
	} else {
		downloadLink = await getDownloadUrl(toEmail, downloadSecret, downloadTtlMs);
	}
	
	if (!downloadLink) {
		console.warn("Failed to generate download link, sending email without download link");
	}
	
	// If using download link, update HTML to include it
	if (downloadLink) {
		const hoursValid = Math.round(downloadTtlMs / (1000 * 60 * 60)) || 24;
		const downloadBlock = `<div style="margin-top: 20px; padding: 20px; background: #f5f5f5; border-radius: 8px; border: 2px solid #171a20;">
				<strong style="font-size: 16px; display: block; margin-bottom: 12px;">📦 Download Your Sound Pack:</strong>
				<a href="${downloadLink}" style="display: inline-block; background: #171a20; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin-bottom: 8px;">Download Now →</a><br>
				<a href="${downloadLink}" style="color: #0066cc; font-size: 12px; word-break: break-all; display: block; margin-top: 8px;">${downloadLink}</a>
				<span style="font-size: 12px; color: #6b7280; display: block; margin-top: 8px;">Link valid for ${hoursValid} hours (链接有效期 ${hoursValid} 小时)，请尽快下载保存。</span>
			</div>`;
		if (/<\/body>/i.test(html)) {
			html = html.replace(/<\/body>/i, `${downloadBlock}</body>`);
		} else {
			html += downloadBlock;
		}
	}

	// Generate plain text version from HTML (simple strip)
	const text = html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

	const mailOptions = {
		from: fromEmail,
		to: toEmail,
		subject: "Your Tesla Lock Sound Pack",
		html,
		text, // Plain text version improves deliverability
		attachments,
		headers: {
			// Add headers to reduce spam score
			'X-Mailer': 'Tesla Sounds',
			'X-Priority': '1', // High priority
			'List-Unsubscribe': `<${resolvedDomain}/unsubscribe?email=${encodeURIComponent(toEmail)}>`,
			'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
			'Precedence': 'bulk', // Transactional email
		},
		// Add reply-to if different from from
		replyTo: process.env.REPLY_TO_EMAIL || fromEmail,
	};

	try {
		const info = await transporter.sendMail(mailOptions);
		
		// Log successful email send
		if (subscriptionId) {
			await logEmail(subscriptionId, toEmail, "welcome", "sent").catch(() => {});
			// Update subscription to mark email as sent
			await updateSubscription(subscriptionId, {
				email_sent: true,
				email_sent_at: new Date().toISOString(),
			}).catch(() => {});
		}
		
		return info;
	} catch (err) {
		// Log failed email send
		if (subscriptionId) {
			await logEmail(subscriptionId, toEmail, "welcome", "failed", err.message).catch(() => {});
		}
		throw err;
	}
}


