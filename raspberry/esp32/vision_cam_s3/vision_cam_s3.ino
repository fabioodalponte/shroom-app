#include <Arduino.h>
#include <WiFi.h>
#include <WebServer.h>
#include "esp_camera.h"
#include "esp_system.h"
#include "esp_task_wdt.h"
#include "esp_idf_version.h"

#if __has_include("device_config.h")
#include "device_config.h"
#else
#error "Missing device_config.h. Copy one of the *.example.h files in this folder to device_config.h and adjust it before compiling."
#endif

#include "camera_board_pins.h"

static const char *FIRMWARE_NAME = "vision-cam-s3";
static const char *FIRMWARE_VERSION = "2026.04.06.1";

WebServer server(HTTP_PORT);

unsigned long bootStartedAtMs = 0;
unsigned long lastWiFiConnectAttemptMs = 0;
unsigned long wifiDisconnectedSinceMs = 0;
unsigned long lastSuccessfulCaptureAtMs = 0;

bool cameraReady = false;
uint32_t captureSuccessCount = 0;
uint32_t captureFailureCount = 0;
uint8_t consecutiveCaptureFailures = 0;
esp_reset_reason_t bootReason = ESP_RST_UNKNOWN;

String jsonEscape(const char *value) {
  String escaped;
  for (size_t i = 0; value[i] != '\0'; i++) {
    const char ch = value[i];
    switch (ch) {
      case '\\':
        escaped += "\\\\";
        break;
      case '"':
        escaped += "\\\"";
        break;
      case '\n':
        escaped += "\\n";
        break;
      case '\r':
        escaped += "\\r";
        break;
      case '\t':
        escaped += "\\t";
        break;
      default:
        escaped += ch;
        break;
    }
  }
  return escaped;
}

const char *resetReasonToString(esp_reset_reason_t reason) {
  switch (reason) {
    case ESP_RST_POWERON:
      return "power_on";
    case ESP_RST_EXT:
      return "external_reset";
    case ESP_RST_SW:
      return "software_reset";
    case ESP_RST_PANIC:
      return "panic";
    case ESP_RST_INT_WDT:
      return "interrupt_watchdog";
    case ESP_RST_TASK_WDT:
      return "task_watchdog";
    case ESP_RST_WDT:
      return "other_watchdog";
    case ESP_RST_DEEPSLEEP:
      return "deep_sleep";
    case ESP_RST_BROWNOUT:
      return "brownout";
    case ESP_RST_SDIO:
      return "sdio";
    default:
      return "unknown";
  }
}

void addCorsHeaders() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
}

void sendJson(int statusCode, const String &json) {
  addCorsHeaders();
  server.sendHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  server.send(statusCode, "application/json", json);
}

void feedWatchdog() {
  esp_task_wdt_reset();
  delay(0);
}

void restartDevice(const char *reason) {
  Serial.printf("[system] restart requested: %s\n", reason);
  Serial.flush();
  delay(250);
  ESP.restart();
}

void initWatchdog() {
#if ESP_IDF_VERSION_MAJOR >= 5
  esp_task_wdt_config_t config = {
    .timeout_ms = WATCHDOG_TIMEOUT_SECONDS * 1000U,
    .idle_core_mask = (1U << portNUM_PROCESSORS) - 1U,
    .trigger_panic = true,
  };
  esp_task_wdt_init(&config);
#else
  esp_task_wdt_init(WATCHDOG_TIMEOUT_SECONDS, true);
#endif
  esp_task_wdt_add(NULL);
  Serial.printf("[wdt] enabled timeout=%us\n", WATCHDOG_TIMEOUT_SECONDS);
}

bool connectWiFiBlocking(unsigned long timeoutMs) {
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);
  WiFi.setHostname(DEVICE_NAME);

  if (WiFi.status() != WL_CONNECTED) {
    Serial.printf("[wifi] connecting ssid=%s timeout_ms=%lu\n", WIFI_SSID, timeoutMs);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  }

  const unsigned long startedAt = millis();
  while (WiFi.status() != WL_CONNECTED && (millis() - startedAt) < timeoutMs) {
    feedWatchdog();
    delay(250);
    Serial.print(".");
  }
  Serial.println();

  lastWiFiConnectAttemptMs = millis();

  if (WiFi.status() == WL_CONNECTED) {
    wifiDisconnectedSinceMs = 0;
    Serial.printf("[wifi] connected ip=%s rssi=%d\n", WiFi.localIP().toString().c_str(), WiFi.RSSI());
    return true;
  }

  if (wifiDisconnectedSinceMs == 0) {
    wifiDisconnectedSinceMs = millis();
  }

  Serial.printf("[wifi] connect failed status=%d\n", WiFi.status());
  return false;
}

void ensureWiFiConnected() {
  if (WiFi.status() == WL_CONNECTED) {
    wifiDisconnectedSinceMs = 0;
    return;
  }

  if (wifiDisconnectedSinceMs == 0) {
    wifiDisconnectedSinceMs = millis();
    Serial.println("[wifi] disconnected");
  }

  if (millis() - lastWiFiConnectAttemptMs >= WIFI_RECONNECT_INTERVAL_MS) {
    Serial.println("[wifi] reconnect attempt");
    connectWiFiBlocking(5000);
  }

  if (wifiDisconnectedSinceMs != 0 && millis() - wifiDisconnectedSinceMs >= WIFI_MAX_DISCONNECTED_MS) {
    restartDevice("wifi_disconnected_too_long");
  }
}

bool initCamera() {
  camera_config_t config = {};
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_sccb_sda = SIOD_GPIO_NUM;
  config.pin_sccb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = CAMERA_XCLK_FREQ_HZ;
  config.pixel_format = PIXFORMAT_JPEG;
  config.frame_size = CAMERA_FRAME_SIZE;
  config.jpeg_quality = CAMERA_JPEG_QUALITY;
  config.fb_count = CAMERA_FB_COUNT;
  config.grab_mode = CAMERA_GRAB_LATEST;
  config.fb_location = CAMERA_FB_LOCATION;

  if (!psramFound()) {
    Serial.println("[camera] PSRAM not found; applying fallback settings");
    config.frame_size = FRAMESIZE_QVGA;
    config.jpeg_quality = CAMERA_JPEG_QUALITY + 2;
    config.fb_count = 1;
    config.fb_location = CAMERA_FB_IN_DRAM;
  }

  const esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("[camera] init failed err=0x%x\n", err);
    return false;
  }

  sensor_t *sensor = esp_camera_sensor_get();
  if (sensor == nullptr) {
    Serial.println("[camera] sensor unavailable after init");
    return false;
  }

  sensor->set_framesize(sensor, config.frame_size);
  sensor->set_quality(sensor, config.jpeg_quality);
  sensor->set_brightness(sensor, CAMERA_BRIGHTNESS);
  sensor->set_contrast(sensor, CAMERA_CONTRAST);
  sensor->set_saturation(sensor, CAMERA_SATURATION);
  sensor->set_hmirror(sensor, CAMERA_HMIRROR ? 1 : 0);
  sensor->set_vflip(sensor, CAMERA_VFLIP ? 1 : 0);
  sensor->set_exposure_ctrl(sensor, CAMERA_AUTO_EXPOSURE ? 1 : 0);
  sensor->set_gain_ctrl(sensor, CAMERA_AUTO_GAIN ? 1 : 0);
  sensor->set_whitebal(sensor, CAMERA_AUTO_WHITEBALANCE ? 1 : 0);

  Serial.printf(
    "[camera] ready framesize=%d quality=%d fb_count=%d psram=%s\n",
    config.frame_size,
    config.jpeg_quality,
    config.fb_count,
    psramFound() ? "yes" : "no"
  );
  return true;
}

String buildStatusJson() {
  const String ipAddress = WiFi.status() == WL_CONNECTED ? WiFi.localIP().toString() : "";
  String json = "{";
  json += "\"status\":\"ok\",";
  json += "\"firmware_name\":\"" + jsonEscape(FIRMWARE_NAME) + "\",";
  json += "\"firmware_version\":\"" + jsonEscape(FIRMWARE_VERSION) + "\",";
  json += "\"device_name\":\"" + jsonEscape(DEVICE_NAME) + "\",";
  json += "\"room_name\":\"" + jsonEscape(ROOM_NAME) + "\",";
  json += "\"ip\":\"" + jsonEscape(ipAddress.c_str()) + "\",";
  json += "\"wifi_rssi\":" + String(WiFi.status() == WL_CONNECTED ? WiFi.RSSI() : -127) + ",";
  json += "\"uptime_seconds\":" + String((millis() - bootStartedAtMs) / 1000UL) + ",";
  json += "\"free_heap\":" + String(ESP.getFreeHeap()) + ",";
  json += "\"last_boot_reason\":\"" + String(resetReasonToString(bootReason)) + "\",";
  json += "\"camera_ready\":" + String(cameraReady ? "true" : "false") + ",";
  json += "\"capture_success_count\":" + String(captureSuccessCount) + ",";
  json += "\"capture_failure_count\":" + String(captureFailureCount) + ",";
  json += "\"last_successful_capture_seconds_ago\":" + String(
    lastSuccessfulCaptureAtMs == 0 ? -1L : static_cast<long>((millis() - lastSuccessfulCaptureAtMs) / 1000UL)
  );
  json += "}";
  return json;
}

void handleOptions() {
  addCorsHeaders();
  server.send(204, "text/plain", "");
}

void handleStatus() {
  sendJson(200, buildStatusJson());
}

void handleHealth() {
  handleStatus();
}

void handleRoot() {
  String html = "<html><head><meta name='viewport' content='width=device-width,initial-scale=1'></head><body>";
  html += "<h2>Vision Cam S3</h2>";
  html += "<p><strong>device:</strong> " + String(DEVICE_NAME) + "</p>";
  html += "<p><strong>room:</strong> " + String(ROOM_NAME) + "</p>";
  html += "<ul>";
  html += "<li><code>/capture</code> snapshot JPEG</li>";
  html += "<li><code>/status</code> JSON status</li>";
  html += "<li><code>/health</code> alias for status</li>";
  html += "</ul>";
  html += "<img src='/capture' style='max-width:100%;height:auto' />";
  html += "</body></html>";
  addCorsHeaders();
  server.send(200, "text/html", html);
}

void handleCapture() {
  if (!cameraReady) {
    sendJson(503, "{\"status\":\"error\",\"message\":\"camera_not_ready\"}");
    return;
  }

  if (WiFi.status() != WL_CONNECTED) {
    sendJson(503, "{\"status\":\"error\",\"message\":\"wifi_not_connected\"}");
    return;
  }

  feedWatchdog();
  camera_fb_t *fb = esp_camera_fb_get();
  if (fb == nullptr) {
    captureFailureCount++;
    consecutiveCaptureFailures++;
    Serial.printf(
      "[capture] failed consecutive_failures=%u total_failures=%u\n",
      consecutiveCaptureFailures,
      captureFailureCount
    );

    if (consecutiveCaptureFailures >= MAX_CONSECUTIVE_CAPTURE_FAILURES) {
      restartDevice("too_many_capture_failures");
    }

    server.send(503, "text/plain", "camera capture failed");
    return;
  }

  captureSuccessCount++;
  consecutiveCaptureFailures = 0;
  lastSuccessfulCaptureAtMs = millis();

  addCorsHeaders();
  server.sendHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  server.sendHeader("Content-Disposition", "inline; filename=capture.jpg");
  server.setContentLength(fb->len);
  server.send(200, "image/jpeg", "");

  WiFiClient client = server.client();
  const size_t bytesWritten = client.write(fb->buf, fb->len);
  esp_camera_fb_return(fb);

  if (bytesWritten == 0) {
    Serial.println("[capture] client disconnected during transfer");
  }

  feedWatchdog();
}

void handleNotFound() {
  sendJson(404, "{\"status\":\"error\",\"message\":\"not_found\"}");
}

void logBootBanner() {
  Serial.println();
  Serial.println("========================================");
  Serial.printf("%s %s\n", FIRMWARE_NAME, FIRMWARE_VERSION);
  Serial.printf("[boot] device_name=%s room_name=%s\n", DEVICE_NAME, ROOM_NAME);
  Serial.printf("[boot] reset_reason=%s\n", resetReasonToString(bootReason));
  Serial.printf("[boot] cpu_mhz=%u free_heap=%u psram=%u\n", ESP.getCpuFreqMHz(), ESP.getFreeHeap(), ESP.getPsramSize());
  Serial.println("========================================");
}

void setup() {
  Serial.begin(115200);
  delay(500);

  bootStartedAtMs = millis();
  bootReason = esp_reset_reason();

  logBootBanner();
  initWatchdog();

  cameraReady = initCamera();
  if (!cameraReady) {
    delay(5000);
    restartDevice("camera_init_failed");
  }

  connectWiFiBlocking(INITIAL_WIFI_CONNECT_TIMEOUT_MS);

  server.on("/", HTTP_GET, handleRoot);
  server.on("/", HTTP_OPTIONS, handleOptions);
  server.on("/capture", HTTP_GET, handleCapture);
  server.on("/capture", HTTP_OPTIONS, handleOptions);
  server.on("/status", HTTP_GET, handleStatus);
  server.on("/status", HTTP_OPTIONS, handleOptions);
  server.on("/health", HTTP_GET, handleHealth);
  server.on("/health", HTTP_OPTIONS, handleOptions);
  server.onNotFound(handleNotFound);
  server.begin();

  Serial.printf("[http] listening port=%u\n", HTTP_PORT);
  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("[http] status=http://%s/status\n", WiFi.localIP().toString().c_str());
    Serial.printf("[http] capture=http://%s/capture\n", WiFi.localIP().toString().c_str());
  }
}

void loop() {
  server.handleClient();
  ensureWiFiConnected();
  feedWatchdog();
  delay(2);
}
