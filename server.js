import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import compression from "compression";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
import subscribeRouter from "./routes/subscribe.js";
import { sendWelcomeEmail } from "./services/mailer.js";

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

// Routes - default English
app.get("/", (req, res) => {
	return sendView(res, "index_en.html");
});

app.use("/", subscribeRouter);

app.get("/success", async (req, res) => {
	const email = (req.query.email || "").toString().trim();
	if (email) {
		// Fire-and-forget email sending; do not block rendering
		sendWelcomeEmail(email).catch((err) => {
			console.error("Failed to send welcome email:", err);
		});
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

app.listen(PORT, () => {
	console.log(`Server listening on http://localhost:${PORT}`);
});


