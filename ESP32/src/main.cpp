#include <Arduino.h>
#include <WiFi.h>
#include <WebSocketsClient.h>
#include <driver/i2s.h>

const char *ssid = "KinCollege";
const char *pass = "";
const char *host = "esp32serverproject2.onrender.com";

WebSocketsClient ws;
bool active = false;

// THE VERIFIED WORKING PINS
#define I2S_WS 25
#define I2S_SD 32
#define I2S_SCK 26

void setup()
{
  Serial.begin(115200);
  WiFi.begin(ssid, pass);
  while (WiFi.status() != WL_CONNECTED)
    delay(500);
  Serial.println("\n✅ WiFi Connected");

  // THE VERIFIED WORKING CONFIG
  i2s_config_t config = 
    {
      .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_RX),
      .sample_rate = 16000,
      .bits_per_sample = I2S_BITS_PER_SAMPLE_32BIT,
      .channel_format = I2S_CHANNEL_FMT_ONLY_RIGHT, // Matches your test
      .communication_format = I2S_COMM_FORMAT_I2S,
      .dma_buf_count = 8,
      .dma_buf_len = 512,
      .use_apll = false
    };

  i2s_pin_config_t pins = {
      .bck_io_num = I2S_SCK,
      .ws_io_num = I2S_WS,
      .data_out_num = -1,
      .data_in_num = I2S_SD};

  i2s_driver_install(I2S_NUM_0, &config, 0, NULL);
  i2s_set_pin(I2S_NUM_0, &pins);

  ws.beginSSL(host, 443, "/?type=ESP32");
  ws.onEvent([](WStype_t t, uint8_t *p, size_t l)
             {
        if(t == WStype_CONNECTED) Serial.println("✅ Connected to Server!");
        if(t == WStype_TEXT) {
            String msg = (char*)p;
            if(msg == "START") {
                active = true;
                Serial.println("🔴 Recording Started");
            }
            if(msg == "STOP") {
                active = false;
                Serial.println("🟦 Recording Stopped");
            }
        } });
}

void loop()
{
  ws.loop();
  if (active && ws.isConnected())
  {
    int32_t raw_samples[128]; // Read 32-bit chunks
    size_t bytesRead;

    i2s_read(I2S_NUM_0, raw_samples, sizeof(raw_samples), &bytesRead, portMAX_DELAY);

    int samplesCount = bytesRead / 4;
    int16_t clean_samples[128];

    for (int i = 0; i < samplesCount; i++)
    {
      // Apply the shift that worked in your test
      // We shift by 14 to bring 24-bit audio into 16-bit space
      clean_samples[i] = (int16_t)(raw_samples[i] >> 14);
    }

    // Send the clean 16-bit audio to the server
    ws.sendBIN((uint8_t *)clean_samples, samplesCount * 2);
  }
}