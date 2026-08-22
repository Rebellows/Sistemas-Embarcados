#include <Arduino.h>
#include <Preferences.h>
#include <WiFi.h>
#include <AsyncTCP.h>
#include <ESPAsyncWebServer.h>
#include "FS.h"
#include "SPIFFS.h"

String ssid = "";
String password = "";

int flag = 0;

Preferences memoria;
AsyncWebServer server(80);

const int led = 2;

String le_temp() {
  float temp = random(0, 1000) / 10.0;
  return String(temp, 1);
}

String le_umid() {
  float umid = random(0, 1000) / 10.0;
  return String(umid, 1);
}

String processor(const String& var) {
  if (var == "TEMP") return le_temp();
  if (var == "UMID") return le_umid();
  return String();
}

void PaginaSalva(AsyncWebServerRequest *request) {
  if (request->hasArg("ssid") && request->hasArg("password")) {
    String NovoSSID = request->arg("ssid");
    String NovaSenha = request->arg("password");
    // Salva no NVS
    memoria.begin("wifi", false);
    memoria.putString("ssid", NovoSSID);
    memoria.putString("password", NovaSenha);
    memoria.end();
    request->send(200, "text/html", "<h3>Configuração salva! Reinicie o ESP32.</h3>");
  } 
  else {
    request->send(400, "text/plain", "Erro: parâmetros inválidos");
  }
}
void setupAP() {
  flag = 0;
  // Como não tinham as credenciais salvas, precisa criar uma rede wifi (access point).
  // A configuração é o usando o médoto softAP da lib Wifi, onde os parâmetros são:
  // nome da rede wi-fi do ESP32 e a senha de acesso.
  WiFi.softAP("ESP32HOME", "12345678");
  // O método server.on (192.168.4.1/) retorna um html (HTTP_GET) para o cliente.  
  server.on("/", HTTP_GET, PaginaConfig);
  // O método server.on (192.168.4.1/save) recebe parâmetro (HTTP_POST) do cliente.
  server.on("/save", HTTP_POST, PaginaSalva);
  // O método server.serverStatic (192.168.4.1/) busca todos arquivos que o html precise
  server.serveStatic("/", SPIFFS, "/"); 
  server.begin();
}
void setupSTA() {
  WiFi.begin(ssid.c_str(), password.c_str());
  Serial.printf("Conectando em %s...\n", ssid.c_str());

  unsigned long start = millis();

  while (WiFi.status() != WL_CONNECTED && millis() - start < 10000) {
    delay(500);
    Serial.print(".");
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nConectado com sucesso!");
    Serial.println(WiFi.localIP());
    flag = 1;
    server.on("/", HTTP_GET, [](AsyncWebServerRequest *request){
      request->send(SPIFFS, "/index.html", String(), false, processor);
    });
    server.serveStatic("/", SPIFFS, "/");
    server.on("/on", HTTP_GET, [](AsyncWebServerRequest *request){
      digitalWrite(led, HIGH);
      request->redirect("/");
    });
    server.on("/off", HTTP_GET, [](AsyncWebServerRequest *request){
      digitalWrite(led, LOW);
      request->redirect("/");
    });
    server.on("/temp", HTTP_GET, [](AsyncWebServerRequest *request){
      request->send(200, "text/plain", le_temp());
    });
    server.on("/umid", HTTP_GET, [](AsyncWebServerRequest *request){
      request->send(200, "text/plain", le_umid());
    });
    server.begin();
  }
  else {
    Serial.println("\nFalha ao conectar, iniciando AP novamente...");
    setupAP();
  }
}

void PaginaConfig(AsyncWebServerRequest *request) {
  File arquivo = SPIFFS.open("/index.html", "r");
  request->send(SPIFFS, "/index.html", "text/html");
  arquivo.close();
}

void setup() {
  Serial.begin(115200);
  pinMode(led, OUTPUT);
  digitalWrite(led, LOW);

  if (!SPIFFS.begin(true)) {
    Serial.println("Erro ao montar SPIFFS");
    return;
  }

  memoria.begin("wifi", true);
  ssid = memoria.getString("ssid", "");
  password = memoria.getString("password", "");
  memoria.end();

  if (ssid == "" || password == "") {
    setupAP();
  } 
  else {
    setupSTA();   
  }
}

void loop() {
}
