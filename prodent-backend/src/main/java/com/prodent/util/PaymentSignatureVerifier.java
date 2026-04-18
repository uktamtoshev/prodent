package com.prodent.util;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import java.util.Map;

/**
 * Signature verification utilities for UZ payment providers.
 *
 * Each provider signs callbacks differently:
 * - PayMe:  Basic auth header = Base64(merchantId:secretKey), verified against stored secret
 * - Click:  MD5 hash of concatenated fields + secret_key
 * - Uzum:   HMAC-SHA256 of request body with secret key
 */
public final class PaymentSignatureVerifier {

    private PaymentSignatureVerifier() {}

    // ─── PayMe ──────────────────────────────────────────────────
    // PayMe sends Authorization: Basic <base64(merchantId:key)>
    // We verify the key portion matches our stored secret.

    public static boolean verifyPayme(String authHeader, String expectedMerchantId, String expectedSecret) {
        if (authHeader == null || !authHeader.startsWith("Basic ")) return false;
        try {
            String decoded = new String(Base64.getDecoder().decode(authHeader.substring(6)), StandardCharsets.UTF_8);
            String[] parts = decoded.split(":", 2);
            if (parts.length != 2) return false;
            // PayMe sends "Paycom:<merchant_key>" — we verify the key
            return constantTimeEquals(parts[1], expectedSecret);
        } catch (Exception e) {
            return false;
        }
    }

    // ─── Click ──────────────────────────────────────────────────
    // Click sends: sign_string = MD5(click_trans_id + service_id + secret_key + merchant_trans_id + amount + action + sign_time)

    public static boolean verifyClick(Map<String, Object> payload, String secretKey) {
        try {
            String clickTransId = str(payload, "click_trans_id");
            String serviceId = str(payload, "service_id");
            String merchantTransId = str(payload, "merchant_trans_id");
            String amount = str(payload, "amount");
            String action = str(payload, "action");
            String signTime = str(payload, "sign_time");
            String receivedSign = str(payload, "sign_string");

            if (receivedSign == null) return false;

            String raw = clickTransId + serviceId + secretKey + merchantTransId + amount + action + signTime;
            String expectedSign = md5(raw);
            return constantTimeEquals(receivedSign, expectedSign);
        } catch (Exception e) {
            return false;
        }
    }

    // ─── Uzum ───────────────────────────────────────────────────
    // Uzum signs the raw JSON body with HMAC-SHA256 and sends it in X-Signature header.

    public static boolean verifyUzum(String rawBody, String signatureHeader, String secretKey) {
        if (signatureHeader == null || rawBody == null) return false;
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secretKey.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] hash = mac.doFinal(rawBody.getBytes(StandardCharsets.UTF_8));
            String expected = Base64.getEncoder().encodeToString(hash);
            return constantTimeEquals(signatureHeader, expected);
        } catch (Exception e) {
            return false;
        }
    }

    // ─── Helpers ────────────────────────────────────────────────

    private static String md5(String input) throws Exception {
        MessageDigest md = MessageDigest.getInstance("MD5");
        byte[] digest = md.digest(input.getBytes(StandardCharsets.UTF_8));
        StringBuilder sb = new StringBuilder();
        for (byte b : digest) sb.append(String.format("%02x", b));
        return sb.toString();
    }

    private static String str(Map<String, Object> map, String key) {
        Object v = map.get(key);
        return v != null ? v.toString() : "";
    }

    /**
     * Constant-time string comparison to prevent timing attacks.
     */
    private static boolean constantTimeEquals(String a, String b) {
        if (a == null || b == null) return false;
        return MessageDigest.isEqual(
                a.getBytes(StandardCharsets.UTF_8),
                b.getBytes(StandardCharsets.UTF_8));
    }
}
