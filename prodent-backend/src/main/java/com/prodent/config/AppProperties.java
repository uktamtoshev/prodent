package com.prodent.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Getter
@Setter
@Configuration
@ConfigurationProperties(prefix = "app")
public class AppProperties {

    private Jwt jwt = new Jwt();
    private Cors cors = new Cors();
    private RateLimit rateLimit = new RateLimit();
    private Sms sms = new Sms();
    private Payment payment = new Payment();

    @Getter
    @Setter
    public static class Jwt {
        private String secret;
        private long accessTokenExpiration = 900000;       // 15 min default
        private long refreshTokenExpiration = 2592000000L; // 30 days default
    }

    @Getter
    @Setter
    public static class Cors {
        private String allowedOrigins = "http://localhost:3000";
    }

    @Getter
    @Setter
    public static class RateLimit {
        private int otpMaxRequests = 5;
        private int otpWindowMinutes = 60;
        private int loginMaxAttempts = 10;
        private int loginLockMinutes = 15;
    }

    @Getter
    @Setter
    public static class Sms {
        private String provider = "playmobile";
        private String apiUrl = "https://send.smsxabar.uz/broker-api/send";
        private String login;
        private String password;
        /** If true, OTP is logged instead of sent (dev mode). Defaults to false. */
        private boolean dryRun = false;
    }

    @Getter
    @Setter
    public static class Payment {
        private PayMe payme = new PayMe();
        private Click click = new Click();
        private Uzum uzum = new Uzum();

        @Getter
        @Setter
        public static class PayMe {
            private String merchantId;
            private String secretKey;
            private String callbackUrl;
        }

        @Getter
        @Setter
        public static class Click {
            private String merchantId;
            private String serviceId;
            private String secretKey;
            private String callbackUrl;
        }

        @Getter
        @Setter
        public static class Uzum {
            private String merchantId;
            private String terminalId;
            private String secretKey;
            private String callbackUrl;
        }
    }
}
