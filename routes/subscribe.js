import express from "express";
import Stripe from "stripe";
import dotenv from "dotenv";
import { createSubscription } from "../services/supabase.js";

dotenv.config();

const router = express.Router();

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || "";
const DOMAIN = process.env.DOMAIN || "http://localhost:3000";

const stripe = new Stripe(stripeSecretKey, {
	apiVersion: "2024-06-20",
});

router.post("/subscribe", async (req, res) => {
	try {
		const email = (req.body.email || "").toString().trim();
		if (!email) {
			return res.status(400).send("Email is required");
		}

		const session = await stripe.checkout.sessions.create({
			mode: "payment",
			payment_method_types: ["card"],
			customer_email: email,
			line_items: [
				{
					price_data: {
						currency: "usd",
						product_data: {
							name: "Tesla Lock Sound Pack",
							description: "One-time purchase of Tesla lock sound effects pack",
						},
						unit_amount: 995, // $9.95
					},
					quantity: 1,
				},
			],
			success_url: `${DOMAIN}/success?email=${encodeURIComponent(email)}&session_id={CHECKOUT_SESSION_ID}`,
			cancel_url: `${DOMAIN}/`,
			allow_promotion_codes: false,
		});

		// Save subscription record to Supabase
		await createSubscription({
			email,
			stripeSessionId: session.id,
			stripeCustomerId: session.customer,
			status: "pending",
			amountPaid: 995,
			currency: "usd",
		}).catch((err) => {
			console.error("Failed to save subscription to database:", err);
			// Don't block the redirect if database save fails
		});

		return res.redirect(303, session.url);
	} catch (err) {
		console.error("Stripe Checkout error:", err);
		return res.status(500).send("Failed to create checkout session");
	}
});

export default router;


