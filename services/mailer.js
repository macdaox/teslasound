import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import nodemailer from "nodemailer";

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

	const mailOptions = {
		from: fromEmail,
		to: toEmail,
		subject: "Your Tesla Lock Sound Pack",
		html,
		attachments: [
			{
				filename: "tesla_sounds.zip",
				path: attachmentPath,
				contentType: "application/zip"
			}
		]
	};

	return transporter.sendMail(mailOptions);
}


