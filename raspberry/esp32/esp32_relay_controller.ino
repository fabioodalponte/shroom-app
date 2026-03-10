#include <WiFi.h>
#include <WebServer.h>
#include <ArduinoJson.h>
#include <ESPmDNS.h>

// ===============================
// CONFIG WIFI
// ===============================
const char* WIFI_SSID = "SEU_WIFI";
const char* WIFI_PASSWORD = "SUA_SENHA";

// Token simples para API
const char* API_TOKEN = "shroombros-token-123";

// Device
const char* DEVICE_ID = "relay-controller-01";
const char* DEVICE_NAME = "ESP32-CAM Relay Hub";

// ===============================
// PINOS DOS RELES
// ===============================
const int RELAY1_PIN = 12; // ventilador
const int RELAY2_PIN = 13; // luz
const int RELAY3_PIN = 14; // aquecedor
const int RELAY4_PIN = 15; // umidificador

// true = rele ativo em LOW
const bool RELAY_ACTIVE_LOW = true;

// ===============================
// NOMES DOS CANAIS
// ===============================
const char* RELAY1_NAME = "ventilador";
const char* RELAY2_NAME = "luz";
const char* RELAY3_NAME = "aquecedor";
const char* RELAY4_NAME = "umidificador";

// ===============================
// ESTADO
// ===============================
bool relay1State = false;
bool relay2State = false;
bool relay3State = false;
bool relay4State = false;

String operationMode = "remote";
unsigned long lastCommandMillis = 0;

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

String buildStatusJson() {
  StaticJsonDocument<512> doc;

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

  String output;
  serializeJson(doc, output);
  return output;
}

String buildHtmlPage() {
  String html;
  html += "<!DOCTYPE html><html><head><meta charset='utf-8'>";
  html += "<meta name='viewport' content='width=device-width, initial-scale=1'>";
  html += "<title>Shroom Bros Relay Controller</title>";
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
  html += "<h1>Shroom Bros - Relay Controller</h1>";
  html += "<p>IP: <strong>" + WiFi.localIP().toString() + "</strong> | Modo: <strong>" + operationMode + "</strong></p>";

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
  Serial.println("Shroom Bros Relay Controller iniciando...");

  connectWifi();

  if (MDNS.begin("shroombros-relay")) {
    Serial.println("[MDNS] http://shroombros-relay.local");
  }

  setupRoutes();
  server.begin();

  Serial.println("[HTTP] Servidor iniciado");
}

void loop() {
  server.handleClient();
}
