import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import { createDownloadToken } from "../utils/downloadToken.js";

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

export async function sendWelcomeEmail(toEmail) {
	const templatePath = path.join(viewsDir, "email_template.html");
	const attachmentPath = path.join(publicDir, "assets", "tesla_sounds.zip");

	let html = "<p>Thanks for your purchase!</p>";
	try {
		html = await fs.readFile(templatePath, "utf-8");
	} catch (e) {
		// fallback to default html
	}

	// Check if attachment file exists and is valid
	// Gmail limit is ~25MB, we use 20MB as safe threshold
	const MAX_ATTACHMENT_SIZE = 20 * 1024 * 1024; // 20MB
	const downloadSecret = process.env.DOWNLOAD_SECRET || process.env.PREVIEW_SECRET || "dev_download_secret";
	const downloadTtlMs = process.env.DOWNLOAD_TTL_MS || 24 * 60 * 60 * 1000;
	const manualDownloadUrl = process.env.DOWNLOAD_URL; // Optional: pre-defined URL
	const domain = (process.env.DOMAIN || "http://localhost:3000").replace(/\/$/, "");
	
	let attachments = [];
	let downloadLink = null;
	
	try {
		const stats = await fs.stat(attachmentPath);
		if (stats.size > 1024 && stats.size <= MAX_ATTACHMENT_SIZE) {
			attachments.push({
				filename: "tesla_sounds.zip",
				path: attachmentPath,
				contentType: "application/zip"
			});
		} else if (stats.size > MAX_ATTACHMENT_SIZE) {
			console.warn(`Attachment file too large (${(stats.size / 1024 / 1024).toFixed(2)}MB), using download link instead`);
			if (manualDownloadUrl) {
				downloadLink = manualDownloadUrl;
			} else if (downloadSecret) {
				try {
					const token = createDownloadToken(
						{ email: toEmail, filename: "tesla_sounds.zip" },
						downloadSecret,
						downloadTtlMs
					);
					downloadLink = `${domain}/download/${token}`;
				} catch (err) {
					console.error("Failed to generate download token:", err);
				}
			}
		}
	} catch (e) {
		console.warn("Attachment file not found or invalid, sending email without attachment");
	}
	
	if (!downloadLink && process.env.FORCE_DOWNLOAD_LINK === "true" && downloadSecret) {
		try {
			const token = createDownloadToken(
				{ email: toEmail, filename: "tesla_sounds.zip" },
				downloadSecret,
				downloadTtlMs
			);
			downloadLink = `${domain}/download/${token}`;
		} catch (err) {
			console.error("Failed to generate forced download token:", err);
		}
	}
	
	// If using download link, update HTML to include it
	if (downloadLink) {
		const hoursValid = Math.round(downloadTtlMs / (1000 * 60 * 60)) || 24;
		const downloadBlock = `<p style="margin-top: 20px; padding: 15px; background: #f5f5f5; border-radius: 5px;">
				<strong>Download your sound pack:</strong><br>
				<a href="${downloadLink}" style="color: #0066cc;">${downloadLink}</a><br>
				<span style="font-size: 12px; color: #6b7280;">Link valid for ${hoursValid} hours (链接有效期 ${hoursValid} 小时)，请尽快下载保存。</span>
			</p>`;
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
			'List-Unsubscribe': `<${domain}/unsubscribe?email=${encodeURIComponent(toEmail)}>`,
			'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
			'Precedence': 'bulk', // Transactional email
		},
		// Add reply-to if different from from
		replyTo: process.env.REPLY_TO_EMAIL || fromEmail,
	};

	return transporter.sendMail(mailOptions);
}


