import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

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
	// Gmail limit is 25MB, we use 20MB as safe threshold
	const MAX_ATTACHMENT_SIZE = 20 * 1024 * 1024; // 20MB
	const downloadUrl = process.env.DOWNLOAD_URL; // Optional: cloud storage URL
	
	let attachments = [];
	let useDownloadLink = false;
	
	try {
		const stats = await fs.stat(attachmentPath);
		if (stats.size > 1024 && stats.size <= MAX_ATTACHMENT_SIZE) {
			// File exists and is within size limit, attach it
			attachments.push({
				filename: "tesla_sounds.zip",
				path: attachmentPath,
				contentType: "application/zip"
			});
		} else if (stats.size > MAX_ATTACHMENT_SIZE) {
			// File too large, use download link instead
			useDownloadLink = true;
			console.warn(`Attachment file too large (${(stats.size / 1024 / 1024).toFixed(2)}MB), using download link instead`);
		}
	} catch (e) {
		// File doesn't exist or can't be read
		console.warn("Attachment file not found or invalid, sending email without attachment");
	}
	
	// If using download link, update HTML to include it
	if (useDownloadLink && downloadUrl) {
		html = html.replace(
			/<\/body>/i,
			`<p style="margin-top: 20px; padding: 15px; background: #f5f5f5; border-radius: 5px;">
				<strong>Download your sound pack:</strong><br>
				<a href="${downloadUrl}" style="color: #0066cc;">${downloadUrl}</a>
			</p></body>`
		);
	} else if (useDownloadLink && !downloadUrl) {
		// File too large but no download URL configured
		html = html.replace(
			/<\/body>/i,
			`<p style="margin-top: 20px; padding: 15px; background: #fff3cd; border-radius: 5px; color: #856404;">
				<strong>Note:</strong> Your sound pack file is too large to attach. We'll send you a download link separately.
			</p></body>`
		);
	}

	// Generate plain text version from HTML (simple strip)
	const text = html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
	
	// Extract domain for List-Unsubscribe header
	const domain = process.env.DOMAIN || 'http://localhost:3000';
	
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


