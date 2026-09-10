package com.blariyo.collector.web;

import com.blariyo.collector.config.Secrets;
import com.blariyo.collector.shared.CollectorFailure;
import com.blariyo.collector.shared.Json;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.*;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public final class LocalSecurity extends OncePerRequestFilter {
  private final Secrets secrets;
  private final boolean fixture;

  public LocalSecurity(Secrets secrets, Environment env) {
    this.secrets = secrets;
    this.fixture = Arrays.asList(env.getActiveProfiles()).contains("fixture");
    if (!"127.0.0.1".equals(env.getProperty("server.address")))
      throw new CollectorFailure(503, "LOOPBACK_REQUIRED");
  }

  @Override
  protected void doFilterInternal(
      HttpServletRequest req, HttpServletResponse res, FilterChain chain)
      throws ServletException, IOException {
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    try {
      if (req.getRequestURI().equals("/actuator/health/liveness")) {
        chain.doFilter(req, res);
        return;
      }
      if (!Set.of("127.0.0.1", "::1", "0:0:0:0:0:0:0:1").contains(req.getRemoteAddr())
          || req.getHeader("Origin") != null
          || req.getHeader("Cookie") != null) throw new CollectorFailure(403, "LOCAL_FORBIDDEN");
      String account =
          "GET".equals(req.getMethod())
              ? "local-read-token"
              : req.getRequestURI().endsWith("/stop") ? "local-stop-token" : "local-run-token";
      String auth = req.getHeader("Authorization");
      String expected = "Bearer " + secrets.require(account);
      if (auth == null
          || !MessageDigest.isEqual(
              auth.getBytes(StandardCharsets.UTF_8), expected.getBytes(StandardCharsets.UTF_8)))
        throw new CollectorFailure(401, "LOCAL_AUTH_REQUIRED");
      if (!Set.of("GET", "POST").contains(req.getMethod()))
        throw new CollectorFailure(405, "METHOD_NOT_ALLOWED");
      String path = req.getRequestURI();
      boolean actuator =
          path.equals("/actuator/health")
              || path.equals("/actuator/health/readiness")
              || path.equals("/actuator/metrics")
              || path.startsWith("/actuator/metrics/");
      boolean fixturePath = fixture && path.startsWith("/fixture/");
      boolean submit = path.equals("/local/v1/jobs/collect"),
          status = path.equals("/local/v1/status");
      boolean job =
          path.matches(
              "/local/v1/jobs/[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}(/stop)?");
      if (!actuator && !fixturePath && !submit && !status && !job)
        throw new CollectorFailure(
            path.startsWith("/local/v1/jobs/") ? 400 : 404,
            path.startsWith("/local/v1/jobs/") ? "VALIDATION_FAILED" : "LOCAL_NOT_FOUND");
      if (!fixturePath && ((submit || path.endsWith("/stop")) != req.getMethod().equals("POST")))
        throw new CollectorFailure(405, "METHOD_NOT_ALLOWED");
      if (req.getMethod().equals("GET")
          && (req.getContentLengthLong() > 0 || req.getHeader("Transfer-Encoding") != null))
        throw new CollectorFailure(400, "VALIDATION_FAILED");
      if (req.getMethod().equals("POST")) {
        String key = req.getHeader("Idempotency-Key");
        if (key == null || !key.matches("[A-Za-z0-9._:-]{1,128}"))
          throw new CollectorFailure(400, "IDEMPOTENCY_KEY_REQUIRED");
        byte[] body = req.getInputStream().readNBytes(16385);
        if (body.length > 16384) throw new CollectorFailure(413, "REQUEST_TOO_LARGE");
        if (body.length > 0
            && (req.getContentType() == null
                || !req.getContentType().split(";", 2)[0].equalsIgnoreCase("application/json")))
          throw new CollectorFailure(415, "CONTENT_TYPE_INVALID");
        if (req.getRequestURI().endsWith("/stop") && body.length > 0)
          throw new CollectorFailure(400, "VALIDATION_FAILED");
        chain.doFilter(
            new HttpServletRequestWrapper(req) {
              @Override
              public ServletInputStream getInputStream() {
                var in = new ByteArrayInputStream(body);
                return new ServletInputStream() {
                  public int read() {
                    return in.read();
                  }

                  public boolean isFinished() {
                    return in.available() == 0;
                  }

                  public boolean isReady() {
                    return true;
                  }

                  public void setReadListener(ReadListener listener) {
                    throw new UnsupportedOperationException();
                  }
                };
              }
            },
            res);
      } else chain.doFilter(req, res);
    } catch (CollectorFailure e) {
      res.setStatus(e.status());
      res.setContentType("application/json");
      res.getOutputStream()
          .write(
              Json.bytes(
                  Map.of(
                      "error",
                      Map.of(
                          "code",
                          e.getMessage(),
                          "message",
                          "요청을 처리하지 못했습니다.",
                          "details",
                          Map.of()),
                      "meta",
                      Map.of(
                          "requestId", UUID.randomUUID(), "timestamp", Instant.now().toString()))));
    }
  }
}
