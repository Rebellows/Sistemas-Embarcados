#include <Arduino.h>
#include <Preferences.h>
#include <WiFi.h>
#include <AsyncTCP.h>
#include <ESPAsyncWebServer.h>
#include "FS.h"
#include "SPIFFS.h"

#include <DHT.h>
#include <Adafruit_BMP085.h>

#define DHTPIN 4
#define DHTTYPE DHT22

Adafruit_BMP085 bmp;

DHT dht(DHTPIN, DHTTYPE);

String ssid = "";
String password = "";

// Variavel para armazenar o modo de operacao do ESP32
// 0 = AP (Access Point), 1 = STA (Station)
int esp_mode = 0;

Preferences memoria;
AsyncWebServer server(80);

const int rele = 2;
const int fanPin = 32;  
const int ledPin = 33;

float temp = 0, umid = 0, press = 0, alt = 0;

String le_temp() {
  float aux_temp = dht.readTemperature();
  if (!isnan(aux_temp)) {
    temp = aux_temp;
  }
  return String(temp, 1);
}

String le_umid() {
  float aux_umid = dht.readHumidity();
  if (!isnan(aux_umid)) {
    umid = aux_umid;
  }
  return String(umid, 1);
}

String le_press() {
  press = bmp.readPressure() / 100.0;
  return String(press, 1);
}

String le_alt() {
  alt = bmp.readAltitude();
  return String(alt, 1);
}

String le_vent() {
  if (temp > 25.0) {
    digitalWrite(fanPin, HIGH);
    return "Ligado";
  }
  digitalWrite(fanPin, LOW);
  return "Desligado";
}

String temp_icon() {
  if (temp < 20.0) return "/temp_frio.jpg";
  if (temp < 30.0) return "/temp_ameno.jpg";
  return "/temp_quente.jpg";
}

String processor(const String& var) {
  if (var == "TEMP") return le_temp();
  if (var == "TEMP_ICON") return temp_icon();
  if (var == "UMID") return le_umid();
  if (var == "PRESS") return le_press();
  if (var == "ALT") return le_alt();
  if (var == "VENT") return le_vent();
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
    delay(1000);        // dá tempo da resposta HTTP ser enviada antes do reboot
    ESP.restart();
  } 
  else {
    request->send(400, "text/plain", "Erro: parâmetros inválidos");
  }
}

void PaginaConfig(AsyncWebServerRequest *request) {
  request->send(SPIFFS, "/config.html", "text/html");
}

void setupAP() {
  esp_mode = 0;
  // Como não tinham as credenciais salvas, precisa criar uma rede wifi (access point).
  // A configuração é o usando o médoto softAP da lib Wifi, onde os parâmetros são:
  // nome da rede wi-fi do ESP32 e a senha de acesso.
  WiFi.softAP("Mesa5ESP32", "12345678");
  // O método server.on (192.168.4.1/) retorna um html (HTTP_GET) para o cliente.  
  server.on("/", HTTP_GET, PaginaConfig);
  // O método server.on (192.168.4.1/save) recebe parâmetro (HTTP_POST) do cliente.
  server.on("/save", HTTP_POST, PaginaSalva);
  // O método server.serverStatic (192.168.4.1/) busca todos arquivos que o html precise
  server.serveStatic("/", SPIFFS, "/"); 
  server.begin();
  Serial.println("AP iniciado. IP: 192.168.4.1");
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
    esp_mode = 1;
    server.on("/", HTTP_GET, [](AsyncWebServerRequest *request){
      request->send(SPIFFS, "/dashboard.html", String(), false, processor);
    });
    server.serveStatic("/", SPIFFS, "/");
    server.on("/on", HTTP_GET, [](AsyncWebServerRequest *request){
      digitalWrite(rele, HIGH);
      request->redirect("/");
    });
    server.on("/off", HTTP_GET, [](AsyncWebServerRequest *request){
      digitalWrite(rele, LOW);
      request->redirect("/");
    });
    server.begin();
  }
  else {
    Serial.println("\nFalha ao conectar, iniciando AP novamente...");
    setupAP();
  }
}


void setup() {
  Serial.begin(115200);

  pinMode(rele, OUTPUT);
  digitalWrite(rele, LOW);

  pinMode(ledPin, OUTPUT);
  digitalWrite(ledPin, LOW);

  pinMode(fanPin, OUTPUT);
  digitalWrite(fanPin, LOW);

  dht.begin();

  if (!bmp.begin()) {
    Serial.println("Erro ao encontrar o BMP085!");
  }

  if (!SPIFFS.begin(true)) {
    Serial.println("Erro ao montar SPIFFS");
    return;
  }

  memoria.begin("wifi", true);
  ssid = memoria.getString("ssid", "");
  password = memoria.getString("password", "");
  memoria.end();

  if (ssid == "" || password == "") {
    Serial.println("indo para o SetupAP");
    setupAP();
  } 
  else {
    Serial.println("indo para o SetupSTA");
    setupSTA();   
  }
}

void loop() {
  static unsigned long lastSensorCheck = 0;
  static unsigned long lastWifiCheck = 0;

  // caso ninguem esteja usando a pagina, ainda assim checa a temperatura
  // para atualizar o estado do ventilador
  if (millis() - lastSensorCheck > 2000) { 
    lastSensorCheck = millis();
    le_temp(); 
  }

  // acende o led se estiver no modo de operacao STA
  digitalWrite(ledPin, (esp_mode == 1) ? HIGH : LOW);
}
