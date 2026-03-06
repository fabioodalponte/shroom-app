#include <WiFi.h>
#include <WebServer.h>
#include "esp_camera.h"

// ===========================
// WIFI
// ===========================
const char *WIFI_SSID = "SEU_WIFI_SSID";
const char *WIFI_PASS = "SUA_WIFI_SENHA";
const char *DEVICE_NAME = "esp32-cam-sala1";

// ===========================
// Camera model: AI Thinker ESP32-CAM
// ===========================
#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM      0
#define SIOD_GPIO_NUM     26
#define SIOC_GPIO_NUM     27

#define Y9_GPIO_NUM       35
#define Y8_GPIO_NUM       34
#define Y7_GPIO_NUM       39
#define Y6_GPIO_NUM       36
#define Y5_GPIO_NUM       21
#define Y4_GPIO_NUM       19
#define Y3_GPIO_NUM       18
#define Y2_GPIO_NUM        5
#define VSYNC_GPIO_NUM    25
#define HREF_GPIO_NUM     23
#define PCLK_GPIO_NUM     22

WebServer server(80);
unsigned long lastWifiCheckMs = 0;
const unsigned long WIFI_CHECK_INTERVAL_MS = 5000;

void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);
  WiFi.setHostname(DEVICE_NAME);
  WiFi.begin(WIFI_SSID, WIFI_PASS);

  Serial.print("Conectando WiFi");
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED) {
    delay(400);
    Serial.print(".");
    if (millis() - start > 30000) {
      break;
    }
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi conectado");
    Serial.print("IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\nFalha ao conectar no WiFi");
  }
}

bool initCamera() {
  camera_config_t config;
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
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;

  if (psramFound()) {
    config.frame_size = FRAMESIZE_SVGA;
    config.jpeg_quality = 12;
    config.fb_count = 2;
  } else {
    config.frame_size = FRAMESIZE_VGA;
    config.jpeg_quality = 15;
    config.fb_count = 1;
  }

  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.print("Erro ao iniciar camera: 0x");
    Serial.println(err, HEX);
    return false;
  }

  sensor_t *sensor = esp_camera_sensor_get();
  if (sensor != nullptr) {
    sensor->set_brightness(sensor, 0);
    sensor->set_contrast(sensor, 0);
    sensor->set_saturation(sensor, 0);
    sensor->set_whitebal(sensor, 1);
    sensor->set_gain_ctrl(sensor, 1);
    sensor->set_exposure_ctrl(sensor, 1);
  }

  Serial.println("Camera iniciada com sucesso");
  return true;
}

void handleRoot() {
  String html = "<html><head><meta name='viewport' content='width=device-width,initial-scale=1'></head><body>";
  html += "<h2>ESP32-CAM Sala 1</h2>";
  html += "<p>Use <code>/capture</code> para snapshot JPEG.</p>";
  html += "<p>Use <code>/health</code> para status.</p>";
  html += "<img src='/capture' style='max-width:100%;height:auto' />";
  html += "</body></html>";
  server.send(200, "text/html", html);
}

void handleHealth() {
  String json = "{";
  json += "\"status\":\"ok\",";
  json += "\"ip\":\"" + WiFi.localIP().toString() + "\",";
  json += "\"rssi\":" + String(WiFi.RSSI()) + ",";
  json += "\"uptime_seconds\":" + String(millis() / 1000);
  json += "}";

  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(200, "application/json", json);
}

void handleCapture() {
  camera_fb_t *fb = esp_camera_fb_get();
  if (!fb) {
    server.send(503, "text/plain", "camera capture failed");
    return;
  }

  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Content-Disposition", "inline; filename=capture.jpg");
  server.send_P(200, "image/jpeg", reinterpret_cast<const char *>(fb->buf), fb->len);
  esp_camera_fb_return(fb);
}

void handleNotFound() {
  server.send(404, "text/plain", "not found");
}

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\nBoot ESP32-CAM...");

  if (!initCamera()) {
    Serial.println("Camera indisponivel, reiniciando em 10s...");
    delay(10000);
    ESP.restart();
  }

  connectWiFi();

  server.on("/", HTTP_GET, handleRoot);
  server.on("/health", HTTP_GET, handleHealth);
  server.on("/capture", HTTP_GET, handleCapture);
  server.onNotFound(handleNotFound);
  server.begin();

  Serial.println("HTTP server iniciado na porta 80");
}

void loop() {
  server.handleClient();

  if (millis() - lastWifiCheckMs > WIFI_CHECK_INTERVAL_MS) {
    lastWifiCheckMs = millis();
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("WiFi desconectado. Tentando reconectar...");
      connectWiFi();
    }
  }
}
