import crypto from "crypto";

const DEFAULT_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

function toBase64Url(buffer) {
	return Buffer.from(buffer).toString("base64url");
}

export function createDownloadToken(payload, secret, expiresInMs = DEFAULT_EXPIRY_MS) {
	if (!secret) {
		throw new Error("DOWNLOAD_SECRET is required to generate download token");
	}

	const exp = Date.now() + Number(expiresInMs || DEFAULT_EXPIRY_MS);
	const data = { ...payload, exp };
	const json = JSON.stringify(data);
	const encoded = toBase64Url(json);
	const signature = toBase64Url(crypto.createHmac("sha256", secret).update(encoded).digest());
	return `${encoded}.${signature}`;
}

export function verifyDownloadToken(token, secret) {
	if (!token || !secret) return null;
	const parts = token.split(".");
	if (parts.length !== 2) return null;
	const [encoded, signature] = parts;
	const expectedSig = toBase64Url(crypto.createHmac("sha256", secret).update(encoded).digest());
	if (signature !== expectedSig) return null;
	try {
		const json = Buffer.from(encoded, "base64url").toString("utf-8");
		const payload = JSON.parse(json);
		if (!payload.exp || Date.now() > payload.exp) return null;
		return payload;
	} catch (err) {
		return null;
	}
}


