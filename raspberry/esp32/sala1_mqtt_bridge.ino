#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <WiFiClient.h>
#include <PubSubClient.h>
#include <Wire.h>
#include <Adafruit_SHT4x.h>
#include <SensirionI2cScd4x.h>

// ===========================
// WIFI
// ===========================
const char *WIFI_SSID = "SEU_WIFI_SSID";
const char *WIFI_PASS = "SUA_WIFI_SENHA";

// ===========================
// MQTT (Raspberry)
// ===========================
const char *MQTT_HOST = "192.168.0.10";
const uint16_t MQTT_PORT = 1883;
const char *MQTT_CLIENT_ID = "esp32-sala1";

// Tópicos de telemetria
const char *TOPIC_TEMP = "tele/chacara/sala1/temp";
const char *TOPIC_RH = "tele/chacara/sala1/rh";
const char *TOPIC_CO2 = "tele/chacara/sala1/co2";
const char *TOPIC_JSON = "tele/chacara/sala1/json";

// Tópicos de comando
const char *TOPIC_CMD_FAN = "cmd/chacara/sala1/fan";
const char *TOPIC_CMD_HUMID = "cmd/chacara/sala1/humidifier";
const char *TOPIC_ONLINE = "state/chacara/sala1/online";

// ===========================
// HTTP fallback (opcional)
// Recomendado manter OFF quando o bridge MQTT->API estiver ativo.
// ===========================
#define ENABLE_HTTP_FALLBACK 0
const char *SHROOMOS_SENSOR_ID = "sensor_sala_1_a";
const char *SHROOMOS_SALA_ID = "sala_1";
const char *INGEST_URL = "https://SEU_PROJETO.supabase.co/functions/v1/make-server-5522cecf/sensores/ingest";
const char *INGEST_HEADER_NAME = "x-sensores-key";
const char *SENSORES_INGEST_KEY = "SUA_SENSORES_INGEST_KEY";
const int HTTP_RETRY_COUNT = 3;
const unsigned long HTTP_RETRY_DELAY_MS = 1500;

// ===========================
// Sensores
// ===========================
Adafruit_SHT4x sht4;
SensirionI2cScd4x scd4x;

WiFiClient wifiClient;
PubSubClient mqtt(wifiClient);

unsigned long lastSendMs = 0;
const unsigned long SEND_INTERVAL_MS = 10000;

void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);

  Serial.print("Conectando WiFi");
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED) {
    delay(400);
    Serial.print(".");
    if (millis() - start > 20000) break;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi conectado");
    Serial.print("IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\nWiFi FAIL");
  }
}

bool readSHT45(float &tempC, float &humPct) {
  sensors_event_t humidity, temp;
  if (!sht4.getEvent(&humidity, &temp)) return false;
  tempC = temp.temperature;
  humPct = humidity.relative_humidity;
  return true;
}

bool readSCD41(float &co2ppm) {
  bool isDataReady = false;
  scd4x.getDataReadyStatus(isDataReady);
  if (!isDataReady) return false;

  uint16_t co2 = 0;
  float t_scd = 0.0f;
  float h_scd = 0.0f;
  uint16_t error = scd4x.readMeasurement(co2, t_scd, h_scd);
  if (error || co2 == 0) return false;

  co2ppm = (float)co2;
  return true;
}

bool sendToBackendHTTP(float tempC, float humPct, float co2ppm) {
#if ENABLE_HTTP_FALLBACK
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[HTTP] WiFi offline, cancelando envio");
    return false;
  }

  String body = "{";
  body += "\"sensor_id\":\"" + String(SHROOMOS_SENSOR_ID) + "\",";
  body += "\"sala_id\":\"" + String(SHROOMOS_SALA_ID) + "\",";
  body += "\"temperatura\":" + String(tempC, 2) + ",";
  body += "\"umidade\":" + String(humPct, 2) + ",";
  body += "\"co2\":" + String(co2ppm, 0);
  body += "}";

  for (int attempt = 1; attempt <= HTTP_RETRY_COUNT; attempt++) {
    WiFiClientSecure client;
    client.setInsecure();

    HTTPClient http;
    if (!http.begin(client, INGEST_URL)) {
      Serial.printf("[HTTP] Falha ao iniciar cliente (tentativa %d/%d)\n", attempt, HTTP_RETRY_COUNT);
      delay(HTTP_RETRY_DELAY_MS);
      continue;
    }

    http.addHeader("Content-Type", "application/json");
    http.addHeader(INGEST_HEADER_NAME, SENSORES_INGEST_KEY);

    Serial.printf("[HTTP] Enviando leitura para %s (tentativa %d/%d)\n", SHROOMOS_SALA_ID, attempt, HTTP_RETRY_COUNT);
    Serial.print("[HTTP] Payload: ");
    Serial.println(body);

    int code = http.POST(body);
    String resp = http.getString();
    http.end();

    Serial.print("[HTTP] Status: ");
    Serial.println(code);
    Serial.print("[HTTP] Resposta: ");
    Serial.println(resp);

    if (code >= 200 && code < 300) {
      Serial.printf("[HTTP] Ingest OK para sensor=%s sala_id=%s\n", SHROOMOS_SENSOR_ID, SHROOMOS_SALA_ID);
      return true;
    }

    if (attempt < HTTP_RETRY_COUNT) {
      Serial.printf("[HTTP] Retry em %lu ms...\n", HTTP_RETRY_DELAY_MS);
      delay(HTTP_RETRY_DELAY_MS);
    }
  }

  Serial.printf("[HTTP] Falha final ao enviar leitura para sala_id=%s\n", SHROOMOS_SALA_ID);
  return false;
#else
  (void)tempC;
  (void)humPct;
  (void)co2ppm;
  return false;
#endif
}

void mqttCallback(char *topic, byte *payload, unsigned int length) {
  String msg;
  msg.reserve(length);
  for (unsigned int i = 0; i < length; i++) msg += (char)payload[i];

  Serial.print("MQTT msg em ");
  Serial.print(topic);
  Serial.print(": ");
  Serial.println(msg);
}

bool mqttEnsureConnected() {
  if (mqtt.connected()) return true;
  if (WiFi.status() != WL_CONNECTED) return false;

  Serial.print("Conectando MQTT...");
  bool ok = mqtt.connect(
      MQTT_CLIENT_ID,
      TOPIC_ONLINE,
      1,
      true,
      "OFFLINE");

  if (!ok) {
    Serial.print(" FAIL, rc=");
    Serial.println(mqtt.state());
    return false;
  }

  Serial.println(" OK");
  mqtt.setCallback(mqttCallback);

  mqtt.publish(TOPIC_ONLINE, "ONLINE", true);
  mqtt.subscribe(TOPIC_CMD_FAN);
  mqtt.subscribe(TOPIC_CMD_HUMID);

  return true;
}

void publishMQTT(float tempC, float humPct, float co2ppm) {
  if (!mqttEnsureConnected()) return;

  mqtt.publish(TOPIC_TEMP, String(tempC, 2).c_str(), true);
  mqtt.publish(TOPIC_RH, String(humPct, 2).c_str(), true);
  mqtt.publish(TOPIC_CO2, String((int)co2ppm).c_str(), true);

  String json = "{";
  json += "\"temp\":" + String(tempC, 2) + ",";
  json += "\"rh\":" + String(humPct, 2) + ",";
  json += "\"co2\":" + String((int)co2ppm);
  json += "}";
  mqtt.publish(TOPIC_JSON, json.c_str(), true);
}

void setup() {
  Serial.begin(115200);
  delay(500);

  Wire.begin();

  if (!sht4.begin()) {
    Serial.println("Erro ao iniciar SHT45");
  } else {
    sht4.setPrecision(SHT4X_HIGH_PRECISION);
    Serial.println("SHT45 OK");
  }

  scd4x.begin(Wire, 0x62);
  scd4x.stopPeriodicMeasurement();
  scd4x.startPeriodicMeasurement();
  Serial.println("SCD41 OK");

  connectWiFi();
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setCallback(mqttCallback);
}

void loop() {
  mqtt.loop();

  if (millis() - lastSendMs < SEND_INTERVAL_MS) {
    delay(50);
    return;
  }
  lastSendMs = millis();

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi caiu. Reconectando...");
    connectWiFi();
  }

  float tempC = NAN, humPct = NAN, co2ppm = NAN;

  bool shtOk = readSHT45(tempC, humPct);
  bool scdOk = readSCD41(co2ppm);

  if (!shtOk) Serial.println("Falha leitura SHT45");
  if (!scdOk) Serial.println("SCD41 sem dado pronto ainda");

  if (shtOk && scdOk) {
    Serial.print("Temp: ");
    Serial.print(tempC);
    Serial.print(" C | ");
    Serial.print("Umid: ");
    Serial.print(humPct);
    Serial.print(" % | ");
    Serial.print("CO2: ");
    Serial.print(co2ppm);
    Serial.println(" ppm");

    publishMQTT(tempC, humPct, co2ppm);
    bool httpOk = sendToBackendHTTP(tempC, humPct, co2ppm);
    if (ENABLE_HTTP_FALLBACK) {
      Serial.print("[HTTP] Resultado final: ");
      Serial.println(httpOk ? "OK" : "FAIL");
    }
  }
}
