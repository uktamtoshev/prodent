package com.prodent.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * Dynamic sitemap.xml generator. Includes static pages + all public
 * doctor profiles, clinic profiles, and blog articles.
 *
 * Google/Yandex fetch this instead of the static sitemap.xml in /public.
 */
@RestController
@RequiredArgsConstructor
public class SitemapController {

    private final JdbcTemplate jdbcTemplate;

    private static final String BASE_URL = "https://prodent.uz";

    @GetMapping(value = "/sitemap.xml", produces = MediaType.APPLICATION_XML_VALUE)
    public ResponseEntity<String> sitemap() {
        StringBuilder xml = new StringBuilder();
        xml.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
        xml.append("<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n");

        // Static pages
        addUrl(xml, "/", "daily", "1.0");
        addUrl(xml, "/search", "daily", "0.9");
        addUrl(xml, "/clinics", "daily", "0.9");
        addUrl(xml, "/articles", "weekly", "0.8");
        addUrl(xml, "/promotions", "weekly", "0.7");
        addUrl(xml, "/about", "monthly", "0.6");

        // Doctor profiles
        try {
            List<Map<String, Object>> doctors = jdbcTemplate.queryForList(
                    "SELECT d.id, d.updated_at FROM doctors d " +
                    "JOIN users u ON d.user_id = u.id " +
                    "WHERE d.is_verified = true ORDER BY d.rating DESC LIMIT 5000");
            for (Map<String, Object> doc : doctors) {
                String id = doc.get("id").toString();
                String lastmod = extractDate(doc.get("updated_at"));
                addUrl(xml, "/doctor/" + id, "weekly", "0.8", lastmod);
            }
        } catch (Exception e) {
            // Silently skip if table doesn't exist yet
        }

        // Clinic profiles
        try {
            List<Map<String, Object>> clinics = jdbcTemplate.queryForList(
                    "SELECT id, slug, updated_at FROM clinics " +
                    "WHERE is_verified = true AND is_active = true ORDER BY rating DESC LIMIT 5000");
            for (Map<String, Object> clinic : clinics) {
                String id = clinic.get("id").toString();
                String lastmod = extractDate(clinic.get("updated_at"));
                addUrl(xml, "/clinic/" + id, "weekly", "0.8", lastmod);
            }
        } catch (Exception e) {
            // Silently skip
        }

        // Blog articles
        try {
            List<Map<String, Object>> posts = jdbcTemplate.queryForList(
                    "SELECT slug, published_at FROM blog_posts " +
                    "WHERE is_published = true ORDER BY published_at DESC LIMIT 1000");
            for (Map<String, Object> post : posts) {
                String slug = post.get("slug").toString();
                String lastmod = extractDate(post.get("published_at"));
                addUrl(xml, "/articles/" + slug, "monthly", "0.7", lastmod);
            }
        } catch (Exception e) {
            // Silently skip
        }

        xml.append("</urlset>\n");
        return ResponseEntity.ok(xml.toString());
    }

    private void addUrl(StringBuilder xml, String path, String changefreq, String priority) {
        addUrl(xml, path, changefreq, priority, LocalDate.now().toString());
    }

    private void addUrl(StringBuilder xml, String path, String changefreq, String priority, String lastmod) {
        xml.append("  <url>\n");
        xml.append("    <loc>").append(BASE_URL).append(path).append("</loc>\n");
        xml.append("    <lastmod>").append(lastmod).append("</lastmod>\n");
        xml.append("    <changefreq>").append(changefreq).append("</changefreq>\n");
        xml.append("    <priority>").append(priority).append("</priority>\n");
        xml.append("  </url>\n");
    }

    private String extractDate(Object timestamp) {
        if (timestamp == null) return LocalDate.now().toString();
        String s = timestamp.toString();
        // Extract YYYY-MM-DD from timestamp
        return s.length() >= 10 ? s.substring(0, 10) : s;
    }
}
