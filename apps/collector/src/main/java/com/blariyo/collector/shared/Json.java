package com.blariyo.collector.shared;

import java.security.MessageDigest;
import java.util.*;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

public final class Json {
  public static final JsonMapper MAPPER = JsonMapper.builder().build();

  private Json() {}

  public static JsonNode parse(byte[] bytes) {
    return MAPPER.readTree(bytes);
  }

  public static byte[] bytes(Object value) {
    return MAPPER.writeValueAsBytes(value);
  }

  public static JsonNode tree(Object value) {
    return MAPPER.valueToTree(value);
  }

  public static String sha(byte[] bytes) {
    try {
      return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
    } catch (Exception e) {
      throw new IllegalStateException("HASH_UNAVAILABLE");
    }
  }

  public static byte[] canonical(JsonNode node) {
    return bytes(sorted(node));
  }

  private static Object sorted(JsonNode node) {
    if (node.isObject()) {
      var map = new TreeMap<String, Object>();
      node.properties().forEach(e -> map.put(e.getKey(), sorted(e.getValue())));
      return map;
    }
    if (node.isArray()) {
      var list = new ArrayList<Object>();
      node.forEach(v -> list.add(sorted(v)));
      return list;
    }
    if (node.isNull()) return null;
    if (node.isBoolean()) return node.booleanValue();
    if (node.isIntegralNumber()) return node.longValue();
    if (node.isNumber()) return node.decimalValue();
    return node.asText();
  }
}
