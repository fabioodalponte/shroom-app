#pragma once

#include "esp_camera.h"

// Clone this file to device_config.h before flashing the colonizacao camera.

static const char *WIFI_SSID = "DALENET_ANDRE_2.4";
static const char *WIFI_PASSWORD = "dalponte1";
static const char *DEVICE_NAME = "vision-cam-colonizacao-01";
static const char *ROOM_NAME = "Colonizacao";

// Escolha exatamente um perfil suportado:
// #define CAMERA_MODEL_XIAO_ESP32S3
// #define CAMERA_MODEL_ESP32S3_CAM_LCD
// #define CAMERA_MODEL_ESP32S3_EYE
// #define CAMERA_MODEL_DFRobot_FireBeetle2_ESP32S3
// #define CAMERA_MODEL_M5STACK_CAMS3_UNIT
#define CAMERA_MODEL_CUSTOM_S3

// Se usar CAMERA_MODEL_CUSTOM_S3, preencha o pinout real da sua placa.
#define CUSTOM_PWDN_GPIO_NUM -1
#define CUSTOM_RESET_GPIO_NUM -1
#define CUSTOM_XCLK_GPIO_NUM 15
#define CUSTOM_SIOD_GPIO_NUM 4
#define CUSTOM_SIOC_GPIO_NUM 5
#define CUSTOM_Y9_GPIO_NUM 16
#define CUSTOM_Y8_GPIO_NUM 17
#define CUSTOM_Y7_GPIO_NUM 18
#define CUSTOM_Y6_GPIO_NUM 12
#define CUSTOM_Y5_GPIO_NUM 10
#define CUSTOM_Y4_GPIO_NUM 8
#define CUSTOM_Y3_GPIO_NUM 9
#define CUSTOM_Y2_GPIO_NUM 11
#define CUSTOM_VSYNC_GPIO_NUM 6
#define CUSTOM_HREF_GPIO_NUM 7
#define CUSTOM_PCLK_GPIO_NUM 13

static const uint16_t HTTP_PORT = 80;
static const unsigned long INITIAL_WIFI_CONNECT_TIMEOUT_MS = 30000UL;
static const unsigned long WIFI_RECONNECT_INTERVAL_MS = 5000UL;
static const unsigned long WIFI_MAX_DISCONNECTED_MS = 180000UL;
static const uint16_t WATCHDOG_TIMEOUT_SECONDS = 30;
static const uint8_t MAX_CONSECUTIVE_CAPTURE_FAILURES = 5;

static const framesize_t CAMERA_FRAME_SIZE = FRAMESIZE_VGA;
static const int CAMERA_JPEG_QUALITY = 14;
static const int CAMERA_FB_COUNT = 1;
static const camera_fb_location_t CAMERA_FB_LOCATION = CAMERA_FB_IN_PSRAM;
static const int CAMERA_XCLK_FREQ_HZ = 20000000;

static const int CAMERA_BRIGHTNESS = 0;
static const int CAMERA_CONTRAST = 0;
static const int CAMERA_SATURATION = 0;
static const bool CAMERA_HMIRROR = false;
static const bool CAMERA_VFLIP = false;
static const bool CAMERA_AUTO_EXPOSURE = true;
static const bool CAMERA_AUTO_GAIN = true;
static const bool CAMERA_AUTO_WHITEBALANCE = true;
