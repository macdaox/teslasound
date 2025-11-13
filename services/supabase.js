import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
	console.warn("⚠️  Supabase credentials not found. Database features will be disabled.");
}

export const supabase = supabaseUrl && supabaseKey
	? createClient(supabaseUrl, supabaseKey)
	: null;

/**
 * Create a new subscription record
 */
export async function createSubscription(data) {
	if (!supabase) {
		console.warn("Supabase not configured, skipping subscription creation");
		return null;
	}

	const {
		email,
		stripeSessionId,
		stripeCustomerId,
		stripePaymentIntentId,
		status = "pending",
		amountPaid = 995,
		currency = "usd",
	} = data;

	try {
		const { data: subscription, error } = await supabase
			.from("subscriptions")
			.insert({
				email,
				stripe_session_id: stripeSessionId,
				stripe_customer_id: stripeCustomerId,
				stripe_payment_intent_id: stripePaymentIntentId,
				status,
				amount_paid: amountPaid,
				currency,
			})
			.select()
			.single();

		if (error) {
			console.error("Error creating subscription:", error);
			return null;
		}

		return subscription;
	} catch (err) {
		console.error("Exception creating subscription:", err);
		return null;
	}
}

/**
 * Update subscription status
 */
export async function updateSubscription(subscriptionId, updates) {
	if (!supabase) {
		return null;
	}

	try {
		const { data, error } = await supabase
			.from("subscriptions")
			.update(updates)
			.eq("id", subscriptionId)
			.select()
			.single();

		if (error) {
			console.error("Error updating subscription:", error);
			return null;
		}

		return data;
	} catch (err) {
		console.error("Exception updating subscription:", err);
		return null;
	}
}

/**
 * Find subscription by Stripe session ID
 */
export async function findSubscriptionBySessionId(sessionId) {
	if (!supabase) {
		return null;
	}

	try {
		const { data, error } = await supabase
			.from("subscriptions")
			.select("*")
			.eq("stripe_session_id", sessionId)
			.single();

		if (error) {
			if (error.code === "PGRST116") {
				// Not found
				return null;
			}
			console.error("Error finding subscription:", error);
			return null;
		}

		return data;
	} catch (err) {
		console.error("Exception finding subscription:", err);
		return null;
	}
}

/**
 * Find subscription by email
 */
export async function findSubscriptionByEmail(email) {
	if (!supabase) {
		return null;
	}

	try {
		const { data, error } = await supabase
			.from("subscriptions")
			.select("*")
			.eq("email", email)
			.eq("status", "completed")
			.order("created_at", { ascending: false })
			.limit(1)
			.single();

		if (error) {
			if (error.code === "PGRST116") {
				return null;
			}
			console.error("Error finding subscription by email:", error);
			return null;
		}

		return data;
	} catch (err) {
		console.error("Exception finding subscription by email:", err);
		return null;
	}
}

/**
 * Log email sending
 */
export async function logEmail(subscriptionId, email, emailType, status, errorMessage = null) {
	if (!supabase) {
		return;
	}

	try {
		await supabase
			.from("email_logs")
			.insert({
				subscription_id: subscriptionId,
				email,
				email_type: emailType,
				status,
				error_message: errorMessage,
			});
	} catch (err) {
		console.error("Exception logging email:", err);
	}
}

/**
 * Log download activity
 */
export async function logDownload(subscriptionId, email, downloadToken, req) {
	if (!supabase) {
		return;
	}

	try {
		await supabase
			.from("download_logs")
			.insert({
				subscription_id: subscriptionId,
				email,
				download_token: downloadToken,
				ip_address: req?.ip || req?.connection?.remoteAddress || null,
				user_agent: req?.get?.("user-agent") || null,
			});
	} catch (err) {
		console.error("Exception logging download:", err);
	}
}

/**
 * Get file from Supabase Storage
 */
export async function getFileFromStorage(bucketName, filePath) {
	if (!supabase) {
		return null;
	}

	try {
		const { data, error } = await supabase
			.storage
			.from(bucketName)
			.download(filePath);

		if (error) {
			console.error("Error downloading file from storage:", error);
			return null;
		}

		return data;
	} catch (err) {
		console.error("Exception downloading file from storage:", err);
		return null;
	}
}

/**
 * Get public URL for file in Supabase Storage
 */
export async function getPublicUrl(bucketName, filePath, expiresIn = 3600) {
	if (!supabase) {
		return null;
	}

	try {
		const { data } = supabase
			.storage
			.from(bucketName)
			.getPublicUrl(filePath);

		return data.publicUrl;
	} catch (err) {
		console.error("Exception getting public URL:", err);
		return null;
	}
}

/**
 * Get signed URL for file in Supabase Storage (with expiration)
 */
export async function getSignedUrl(bucketName, filePath, expiresIn = 3600) {
	if (!supabase) {
		return null;
	}

	try {
		const { data, error } = await supabase
			.storage
			.from(bucketName)
			.createSignedUrl(filePath, expiresIn);

		if (error) {
			console.error("Error creating signed URL:", error);
			return null;
		}

		return data.signedUrl;
	} catch (err) {
		console.error("Exception creating signed URL:", err);
		return null;
	}
}

