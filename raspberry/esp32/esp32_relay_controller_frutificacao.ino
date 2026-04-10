#include <WiFi.h>
#include <WebServer.h>
#include <ArduinoJson.h>
#include <ESPmDNS.h>
#include <Wire.h>
#include <Adafruit_SHT4x.h>
#include <SensirionI2cScd4x.h>

// ===============================
// CONFIG WIFI
// ===============================
const char* WIFI_SSID = "SEU_WIFI";
const char* WIFI_PASSWORD = "SUA_SENHA";

// Token simples para API
const char* API_TOKEN = "TROCAR_TOKEN_FRUTIFICACAO";

// Device
const char* DEVICE_ID = "relay-frutificacao-01";
const char* DEVICE_NAME = "ESP32 Relay Hub - Frutificacao";

// ===============================
// PINOS
// Mapeamento ajustado para placa ESP32-S3 CAM:
// - evita GPIOs usados pela interface da camera
// - evita USB nativo (GPIO19/GPIO20)
// - evita PSRAM dedicada e pino de boot
// ===============================
const int SDA_PIN = 41;
const int SCL_PIN = 42;

const int RELAY1_PIN = 1;
const int RELAY2_PIN = 14;
const int RELAY3_PIN = 21;
const int RELAY4_PIN = 47;

// true = rele ativo em LOW
const bool RELAY_ACTIVE_LOW = true;

// ===============================
// NOMES DOS CANAIS
// relay2 e o canal esperado pela configuracao
// da sala de frutificacao no Vision.
// ===============================
const char* RELAY1_NAME = "canal_1";
const char* RELAY2_NAME = "luz_frutificacao";
const char* RELAY3_NAME = "canal_3";
const char* RELAY4_NAME = "canal_4";

// ===============================
// ESTADO
// ===============================
bool relay1State = false;
bool relay2State = false;
bool relay3State = false;
bool relay4State = false;

String operationMode = "remote";
unsigned long lastCommandMillis = 0;

Adafruit_SHT4x sht4;
SensirionI2cScd4x scd4x;
bool sht45Ready = false;
bool scd41Ready = false;
float lastTemperatureC = NAN;
float lastHumidityPct = NAN;
float lastCo2Ppm = NAN;
unsigned long lastSensorReadMs = 0;
const unsigned long SENSOR_READ_INTERVAL_MS = 5000;

WebServer server(80);
const char* HEADER_KEYS[] = {"X-API-Token"};
const size_t HEADER_KEYS_COUNT = sizeof(HEADER_KEYS) / sizeof(HEADER_KEYS[0]);

// ===============================
// AUXILIARES
// ===============================
void sendCorsHeaders() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type, X-API-Token");
  server.sendHeader("Cache-Control", "no-store");
}

void sendJson(int statusCode, const String& body) {
  sendCorsHeaders();
  server.send(statusCode, "application/json", body);
}

void writeRelayHardware(int pin, bool state) {
  if (RELAY_ACTIVE_LOW) {
    digitalWrite(pin, state ? LOW : HIGH);
  } else {
    digitalWrite(pin, state ? HIGH : LOW);
  }
}

void applyRelayStates() {
  writeRelayHardware(RELAY1_PIN, relay1State);
  writeRelayHardware(RELAY2_PIN, relay2State);
  writeRelayHardware(RELAY3_PIN, relay3State);
  writeRelayHardware(RELAY4_PIN, relay4State);
}

void setRelayStateByNumber(int relay, bool state) {
  switch (relay) {
    case 1: relay1State = state; break;
    case 2: relay2State = state; break;
    case 3: relay3State = state; break;
    case 4: relay4State = state; break;
    default: return;
  }

  applyRelayStates();
  lastCommandMillis = millis();

  Serial.print("[RELAY] ");
  Serial.print(relay);
  Serial.print(" -> ");
  Serial.println(state ? "ON" : "OFF");
}

bool getRelayStateByNumber(int relay) {
  switch (relay) {
    case 1: return relay1State;
    case 2: return relay2State;
    case 3: return relay3State;
    case 4: return relay4State;
    default: return false;
  }
}

String getRelayNameByNumber(int relay) {
  switch (relay) {
    case 1: return RELAY1_NAME;
    case 2: return RELAY2_NAME;
    case 3: return RELAY3_NAME;
    case 4: return RELAY4_NAME;
    default: return "unknown";
  }
}

void setAllRelays(bool state) {
  relay1State = state;
  relay2State = state;
  relay3State = state;
  relay4State = state;
  applyRelayStates();
  lastCommandMillis = millis();
}

bool isAuthorized() {
  if (!server.hasHeader("X-API-Token")) {
    return false;
  }
  return server.header("X-API-Token") == API_TOKEN;
}

void sendUnauthorized() {
  sendJson(401, "{\"error\":\"unauthorized\"}");
}

bool readSHT45(float& tempC, float& humPct) {
  sensors_event_t humidity;
  sensors_event_t temp;
  if (!sht4.getEvent(&humidity, &temp)) {
    return false;
  }

  tempC = temp.temperature;
  humPct = humidity.relative_humidity;
  return true;
}

bool readSCD41(float& co2ppm) {
  bool isDataReady = false;
  scd4x.getDataReadyStatus(isDataReady);
  if (!isDataReady) {
    return false;
  }

  uint16_t co2 = 0;
  float tempC = 0.0f;
  float humPct = 0.0f;
  uint16_t error = scd4x.readMeasurement(co2, tempC, humPct);
  if (error || co2 == 0) {
    return false;
  }

  co2ppm = static_cast<float>(co2);
  return true;
}

void updateSensorReadings(bool forceRead = false) {
  if (!forceRead && millis() - lastSensorReadMs < SENSOR_READ_INTERVAL_MS) {
    return;
  }

  lastSensorReadMs = millis();

  if (sht45Ready) {
    float tempC = NAN;
    float humPct = NAN;
    if (readSHT45(tempC, humPct)) {
      lastTemperatureC = tempC;
      lastHumidityPct = humPct;
    } else {
      Serial.println("[SENSOR] Falha leitura SHT45");
    }
  }

  if (scd41Ready) {
    float co2ppm = NAN;
    if (readSCD41(co2ppm)) {
      lastCo2Ppm = co2ppm;
    } else {
      Serial.println("[SENSOR] SCD41 sem dado pronto");
    }
  }
}

void setupSensors() {
  Wire.begin(SDA_PIN, SCL_PIN);

  if (!sht4.begin()) {
    Serial.println("[SENSOR] Erro ao iniciar SHT45");
  } else {
    sht4.setPrecision(SHT4X_HIGH_PRECISION);
    sht45Ready = true;
    Serial.println("[SENSOR] SHT45 OK");
  }

  scd4x.begin(Wire, 0x62);
  scd4x.stopPeriodicMeasurement();
  scd4x.startPeriodicMeasurement();
  scd41Ready = true;
  Serial.println("[SENSOR] SCD41 OK");

  updateSensorReadings(true);
}

String buildStatusJson() {
  StaticJsonDocument<768> doc;

  doc["deviceId"] = DEVICE_ID;
  doc["deviceName"] = DEVICE_NAME;
  doc["mode"] = operationMode;
  doc["ip"] = WiFi.localIP().toString();
  doc["uptimeSeconds"] = millis() / 1000;
  doc["lastCommandMs"] = lastCommandMillis;

  JsonObject relays = doc.createNestedObject("relays");

  JsonObject r1 = relays.createNestedObject("relay1");
  r1["name"] = RELAY1_NAME;
  r1["state"] = relay1State;

  JsonObject r2 = relays.createNestedObject("relay2");
  r2["name"] = RELAY2_NAME;
  r2["state"] = relay2State;

  JsonObject r3 = relays.createNestedObject("relay3");
  r3["name"] = RELAY3_NAME;
  r3["state"] = relay3State;

  JsonObject r4 = relays.createNestedObject("relay4");
  r4["name"] = RELAY4_NAME;
  r4["state"] = relay4State;

  JsonObject sensors = doc.createNestedObject("sensors");

  JsonObject sht45 = sensors.createNestedObject("sht45");
  sht45["ready"] = sht45Ready;
  if (isnan(lastTemperatureC)) {
    sht45["temperatureC"] = nullptr;
  } else {
    sht45["temperatureC"] = lastTemperatureC;
  }
  if (isnan(lastHumidityPct)) {
    sht45["humidityPct"] = nullptr;
  } else {
    sht45["humidityPct"] = lastHumidityPct;
  }

  JsonObject scd41 = sensors.createNestedObject("scd41");
  scd41["ready"] = scd41Ready;
  if (isnan(lastCo2Ppm)) {
    scd41["co2ppm"] = nullptr;
  } else {
    scd41["co2ppm"] = lastCo2Ppm;
  }

  String output;
  serializeJson(doc, output);
  return output;
}

String buildHtmlPage() {
  String html;
  html += "<!DOCTYPE html><html><head><meta charset='utf-8'>";
  html += "<meta name='viewport' content='width=device-width, initial-scale=1'>";
  html += "<title>Shroom Bros Relay Controller - Frutificacao</title>";
  html += "<style>";
  html += "body{font-family:Arial;background:#f4f4f4;padding:20px;color:#222;}";
  html += ".card{max-width:760px;margin:auto;background:#fff;padding:24px;border-radius:14px;box-shadow:0 2px 12px rgba(0,0,0,.08);}";
  html += ".relay{border:1px solid #ddd;border-radius:10px;padding:14px;margin:12px 0;}";
  html += ".row{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;}";
  html += "button{padding:12px 18px;border:none;border-radius:8px;cursor:pointer;font-size:15px;}";
  html += ".on{background:#28a745;color:white;}.off{background:#dc3545;color:white;}.neutral{background:#444;color:#fff;}";
  html += ".status-on{color:#28a745;font-weight:bold;}.status-off{color:#dc3545;font-weight:bold;}";
  html += "</style></head><body>";

  html += "<div class='card'>";
  html += "<h1>Shroom Bros - Relay Controller Frutificacao</h1>";
  html += "<p>IP: <strong>" + WiFi.localIP().toString() + "</strong> | Modo: <strong>" + operationMode + "</strong></p>";
  html += "<p>Canal principal da iluminacao da frutificacao: <strong>relay2</strong></p>";
  html += "<p>Sensores: ";
  html += "Temp <strong>" + String(isnan(lastTemperatureC) ? "--" : String(lastTemperatureC, 1)) + " C</strong> | ";
  html += "Umid <strong>" + String(isnan(lastHumidityPct) ? "--" : String(lastHumidityPct, 1)) + " %</strong> | ";
  html += "CO2 <strong>" + String(isnan(lastCo2Ppm) ? "--" : String(lastCo2Ppm, 0)) + " ppm</strong>";
  html += "</p>";

  for (int i = 1; i <= 4; i++) {
    bool state = getRelayStateByNumber(i);
    String name = getRelayNameByNumber(i);

    html += "<div class='relay'><div class='row'>";
    html += "<div><strong>Canal " + String(i) + "</strong> - " + name + "<br>Estado: ";
    html += "<span class='" + String(state ? "status-on" : "status-off") + "'>";
    html += (state ? "ON" : "OFF");
    html += "</span></div>";
    html += "<div>";
    html += "<a href='/ui/relay?relay=" + String(i) + "&state=on'><button class='on'>Ligar</button></a> ";
    html += "<a href='/ui/relay?relay=" + String(i) + "&state=off'><button class='off'>Desligar</button></a>";
    html += "</div></div></div>";
  }

  html += "<div class='row'>";
  html += "<div>";
  html += "<a href='/ui/all?state=on'><button class='on'>Ligar Todos</button></a> ";
  html += "<a href='/ui/all?state=off'><button class='off'>Desligar Todos</button></a>";
  html += "</div>";
  html += "<div>";
  html += "<a href='/ui/mode?value=manual'><button class='neutral'>Modo Manual</button></a> ";
  html += "<a href='/ui/mode?value=remote'><button class='neutral'>Modo Remote</button></a>";
  html += "</div>";
  html += "</div>";

  html += "</div></body></html>";
  return html;
}

// ===============================
// UI
// ===============================
void handleUiRoot() {
  sendCorsHeaders();
  server.send(200, "text/html", buildHtmlPage());
}

void handleUiRelay() {
  if (!server.hasArg("relay") || !server.hasArg("state")) {
    sendCorsHeaders();
    server.send(400, "text/plain", "Parametros ausentes");
    return;
  }

  int relay = server.arg("relay").toInt();
  bool state = server.arg("state") == "on";

  operationMode = "manual";
  setRelayStateByNumber(relay, state);

  server.sendHeader("Location", "/");
  sendCorsHeaders();
  server.send(302, "text/plain", "");
}

void handleUiAll() {
  if (!server.hasArg("state")) {
    sendCorsHeaders();
    server.send(400, "text/plain", "Parametro state ausente");
    return;
  }

  bool state = server.arg("state") == "on";
  operationMode = "manual";
  setAllRelays(state);

  server.sendHeader("Location", "/");
  sendCorsHeaders();
  server.send(302, "text/plain", "");
}

void handleUiMode() {
  if (!server.hasArg("value")) {
    sendCorsHeaders();
    server.send(400, "text/plain", "Parametro value ausente");
    return;
  }

  String mode = server.arg("value");
  if (mode == "manual" || mode == "remote") {
    operationMode = mode;
  }

  server.sendHeader("Location", "/");
  sendCorsHeaders();
  server.send(302, "text/plain", "");
}

// ===============================
// API
// ===============================
void handleStatus() {
  sendJson(200, buildStatusJson());
}

void handleHealth() {
  sendJson(200, buildStatusJson());
}

void handleRelayPost() {
  if (!isAuthorized()) {
    sendUnauthorized();
    return;
  }

  if (!server.hasArg("plain")) {
    sendJson(400, "{\"error\":\"missing body\"}");
    return;
  }

  StaticJsonDocument<256> doc;
  DeserializationError err = deserializeJson(doc, server.arg("plain"));
  if (err) {
    sendJson(400, "{\"error\":\"invalid json\"}");
    return;
  }

  if (!doc.containsKey("relay") || !doc.containsKey("state")) {
    sendJson(400, "{\"error\":\"relay and state are required\"}");
    return;
  }

  int relay = doc["relay"];
  bool state = doc["state"];

  if (relay < 1 || relay > 4) {
    sendJson(400, "{\"error\":\"relay must be 1..4\"}");
    return;
  }

  operationMode = "remote";
  setRelayStateByNumber(relay, state);

  sendJson(200, buildStatusJson());
}

void handleRelaysPost() {
  if (!isAuthorized()) {
    sendUnauthorized();
    return;
  }

  if (!server.hasArg("plain")) {
    sendJson(400, "{\"error\":\"missing body\"}");
    return;
  }

  StaticJsonDocument<256> doc;
  DeserializationError err = deserializeJson(doc, server.arg("plain"));
  if (err) {
    sendJson(400, "{\"error\":\"invalid json\"}");
    return;
  }

  operationMode = "remote";

  if (doc.containsKey("relay1")) relay1State = doc["relay1"];
  if (doc.containsKey("relay2")) relay2State = doc["relay2"];
  if (doc.containsKey("relay3")) relay3State = doc["relay3"];
  if (doc.containsKey("relay4")) relay4State = doc["relay4"];

  applyRelayStates();
  lastCommandMillis = millis();

  sendJson(200, buildStatusJson());
}

void handleModePost() {
  if (!isAuthorized()) {
    sendUnauthorized();
    return;
  }

  if (!server.hasArg("plain")) {
    sendJson(400, "{\"error\":\"missing body\"}");
    return;
  }

  StaticJsonDocument<128> doc;
  DeserializationError err = deserializeJson(doc, server.arg("plain"));
  if (err) {
    sendJson(400, "{\"error\":\"invalid json\"}");
    return;
  }

  if (!doc.containsKey("mode")) {
    sendJson(400, "{\"error\":\"mode is required\"}");
    return;
  }

  String mode = doc["mode"].as<String>();
  if (mode != "manual" && mode != "remote") {
    sendJson(400, "{\"error\":\"mode must be manual or remote\"}");
    return;
  }

  operationMode = mode;
  sendJson(200, buildStatusJson());
}

void handleOptions() {
  sendCorsHeaders();
  server.send(204, "text/plain", "");
}

void handleNotFound() {
  sendJson(404, "{\"error\":\"not found\"}");
}

// ===============================
// WIFI
// ===============================
void connectWifi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  Serial.print("[WIFI] Conectando");
  int retries = 0;

  while (WiFi.status() != WL_CONNECTED && retries < 60) {
    delay(500);
    Serial.print(".");
    retries++;
  }

  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("[WIFI] Conectado");
    Serial.print("[WIFI] IP: http://");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("[WIFI] Falha ao conectar");
  }
}

void setupRoutes() {
  server.on("/", HTTP_GET, handleUiRoot);
  server.on("/ui/relay", HTTP_GET, handleUiRelay);
  server.on("/ui/all", HTTP_GET, handleUiAll);
  server.on("/ui/mode", HTTP_GET, handleUiMode);

  server.on("/status", HTTP_GET, handleStatus);
  server.on("/health", HTTP_GET, handleHealth);
  server.on("/relay", HTTP_POST, handleRelayPost);
  server.on("/relays", HTTP_POST, handleRelaysPost);
  server.on("/mode", HTTP_POST, handleModePost);

  server.on("/status", HTTP_OPTIONS, handleOptions);
  server.on("/health", HTTP_OPTIONS, handleOptions);
  server.on("/relay", HTTP_OPTIONS, handleOptions);
  server.on("/relays", HTTP_OPTIONS, handleOptions);
  server.on("/mode", HTTP_OPTIONS, handleOptions);

  server.onNotFound(handleNotFound);
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  pinMode(RELAY1_PIN, OUTPUT);
  pinMode(RELAY2_PIN, OUTPUT);
  pinMode(RELAY3_PIN, OUTPUT);
  pinMode(RELAY4_PIN, OUTPUT);

  relay1State = false;
  relay2State = false;
  relay3State = false;
  relay4State = false;
  applyRelayStates();

  server.collectHeaders(HEADER_KEYS, HEADER_KEYS_COUNT);

  Serial.println();
  Serial.println("Shroom Bros Relay Controller Frutificacao iniciando...");

  setupSensors();

  connectWifi();

  if (MDNS.begin("shroombros-relay-frutificacao")) {
    Serial.println("[MDNS] http://shroombros-relay-frutificacao.local");
  }

  setupRoutes();
  server.begin();

  Serial.println("[HTTP] Servidor iniciado");
}

void loop() {
  updateSensorReadings();
  server.handleClient();
}
