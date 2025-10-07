#include <Arduino.h>

#include <ESP8266WiFi.h>
#include <ESP8266WiFiMulti.h>

#include <WiFiManager.h>
#include <WebSocketsClient.h>

#include <Hash.h>
#include "secrets.h"

ESP8266WiFiMulti WiFiMulti;
WebSocketsClient webSocket;

const unsigned long interval = 30000;
unsigned long lastSend = 0;

const char* host = "3ljjqnmprj.execute-api.eu-west-3.amazonaws.com";
const char* url = "https://3ljjqnmprj.execute-api.eu-west-3.amazonaws.com/prod/key";
const int httpsPort = 443;

const int buttonPin = D1;
bool oneClick = false;
String apiKeyWs = "";

WiFiClientSecure client;

void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
    switch(type) {
        case WStype_DISCONNECTED:
            Serial.printf("[WSc] Disconnected!\n");
            break;
        case WStype_CONNECTED:
            Serial.printf("[WSc] Connected to url: %s\n",  payload);
            break;
        case WStype_TEXT:
            Serial.print("DONE\n");
            break;
    }

}

void setup() {
  Serial.begin(115200);
  delay(1000);

  pinMode(buttonPin, INPUT_PULLUP);

  Serial.setDebugOutput(true);
  WiFiManager wifiManager;

  //wifiManager.resetSettings();
  std::vector<const char *> menu = {"wifi"};
  wifiManager.setMenu(menu);
  wifiManager.setClass("invert");
  wifiManager.setMinimumSignalQuality(10);

  wifiManager.autoConnect("Wemos_Config");
  
  Serial.println("Connecté au WiFi !");
  Serial.print("Adresse IP : ");
  Serial.println(WiFi.localIP());

  delay(2000);

  client.setInsecure();

  if (!client.connect(host, httpsPort)) {
    Serial.println("connection failed");
    return;
  }

  client.print(String("GET ") + url + " HTTP/1.1\r\n" +
               "Host: " + host + "\r\n" +
               "x-api-key: " + apiToken + "\r\n" +
               "User-Agent: 14 ESP8266\r\n" +
               "Connection: close\r\n\r\n");

  while (client.connected()) {
    String line = client.readStringUntil('\n');
    if (line == "\r") {
      Serial.println("headers received");
      break;
    }
  }
  String payload = "";
  while (client.available()) {
    char c = client.read();
    payload += c;
  }

  client.stop();

  int idx = payload.indexOf("\"secret\":\"");
  if (idx != -1) {
    idx += 10; // longueur de '"secret":"'
    int endIdx = idx + 20; // API key 20 chars
    if (endIdx != -1) {
      apiKeyWs = payload.substring(idx, endIdx);
    }
  }

  Serial.print("✅ Api key extracted: ");
  Serial.println(apiKeyWs);

  webSocket.beginSSL("npvgq643c2.execute-api.eu-west-3.amazonaws.com", 443, "/dev");
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(5000);
}

void loop() {
  webSocket.loop();
  delay(100);
  if(!oneClick && digitalRead(buttonPin) == LOW) {
    String message = "{\"apiKey\":\"" + apiKeyWs + "\"}";
    webSocket.sendTXT(message);
    oneClick = true;
  }
    //   if (millis() - lastSend > interval) {
    //   lastSend = millis();
    // }
}