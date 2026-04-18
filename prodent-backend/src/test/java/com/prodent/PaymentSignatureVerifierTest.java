package com.prodent;

import com.prodent.util.PaymentSignatureVerifier;
import org.junit.jupiter.api.Test;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for PaymentSignatureVerifier — no Spring context needed.
 */
class PaymentSignatureVerifierTest {

    // ─── PayMe ──────────────────────────────────────────────

    @Test
    void verifyPayme_validAuth_returnsTrue() {
        String merchantId = "test-merchant";
        String secret = "test-secret-key";
        String header = "Basic " + Base64.getEncoder().encodeToString(
                (merchantId + ":" + secret).getBytes(StandardCharsets.UTF_8));

        assertTrue(PaymentSignatureVerifier.verifyPayme(header, merchantId, secret));
    }

    @Test
    void verifyPayme_wrongSecret_returnsFalse() {
        String header = "Basic " + Base64.getEncoder().encodeToString(
                "merchant:wrong-secret".getBytes(StandardCharsets.UTF_8));

        assertFalse(PaymentSignatureVerifier.verifyPayme(header, "merchant", "real-secret"));
    }

    @Test
    void verifyPayme_nullHeader_returnsFalse() {
        assertFalse(PaymentSignatureVerifier.verifyPayme(null, "id", "secret"));
    }

    @Test
    void verifyPayme_notBasicScheme_returnsFalse() {
        assertFalse(PaymentSignatureVerifier.verifyPayme("Bearer token123", "id", "secret"));
    }

    // ─── Click ──────────────────────────────────────────────

    @Test
    void verifyClick_validSign_returnsTrue() throws Exception {
        String secretKey = "click-secret";
        Map<String, Object> payload = Map.of(
                "click_trans_id", "123",
                "service_id", "456",
                "merchant_trans_id", "tx-001",
                "amount", "50000",
                "action", "1",
                "sign_time", "2026-04-18 10:00:00"
        );

        // Compute expected MD5
        String raw = "123" + "456" + secretKey + "tx-001" + "50000" + "1" + "2026-04-18 10:00:00";
        String md5 = md5(raw);

        Map<String, Object> withSign = new java.util.HashMap<>(payload);
        withSign.put("sign_string", md5);

        assertTrue(PaymentSignatureVerifier.verifyClick(withSign, secretKey));
    }

    @Test
    void verifyClick_tamperedAmount_returnsFalse() throws Exception {
        String secretKey = "click-secret";
        String raw = "123" + "456" + secretKey + "tx-001" + "50000" + "1" + "2026-04-18 10:00:00";
        String md5 = md5(raw);

        Map<String, Object> payload = new java.util.HashMap<>();
        payload.put("click_trans_id", "123");
        payload.put("service_id", "456");
        payload.put("merchant_trans_id", "tx-001");
        payload.put("amount", "999999"); // tampered
        payload.put("action", "1");
        payload.put("sign_time", "2026-04-18 10:00:00");
        payload.put("sign_string", md5);

        assertFalse(PaymentSignatureVerifier.verifyClick(payload, secretKey));
    }

    // ─── Uzum ───────────────────────────────────────────────

    @Test
    void verifyUzum_validHmac_returnsTrue() throws Exception {
        String secret = "uzum-secret-key";
        String body = "{\"transactionId\":\"tx-001\",\"amount\":50000}";
        String signature = hmacSha256(body, secret);

        assertTrue(PaymentSignatureVerifier.verifyUzum(body, signature, secret));
    }

    @Test
    void verifyUzum_tamperedBody_returnsFalse() throws Exception {
        String secret = "uzum-secret-key";
        String originalBody = "{\"transactionId\":\"tx-001\",\"amount\":50000}";
        String signature = hmacSha256(originalBody, secret);

        String tamperedBody = "{\"transactionId\":\"tx-001\",\"amount\":999999}";
        assertFalse(PaymentSignatureVerifier.verifyUzum(tamperedBody, signature, secret));
    }

    @Test
    void verifyUzum_nullSignature_returnsFalse() {
        assertFalse(PaymentSignatureVerifier.verifyUzum("{}", null, "secret"));
    }

    // ─── Helpers ────────────────────────────────────────────

    private static String md5(String input) throws Exception {
        MessageDigest md = MessageDigest.getInstance("MD5");
        byte[] digest = md.digest(input.getBytes(StandardCharsets.UTF_8));
        StringBuilder sb = new StringBuilder();
        for (byte b : digest) sb.append(String.format("%02x", b));
        return sb.toString();
    }

    private static String hmacSha256(String data, String key) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(key.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        return Base64.getEncoder().encodeToString(mac.doFinal(data.getBytes(StandardCharsets.UTF_8)));
    }
}
