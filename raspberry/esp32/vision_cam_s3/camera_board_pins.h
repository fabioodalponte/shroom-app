#pragma once

// Board pin profiles derived from Espressif's official CameraWebServer example:
// https://raw.githubusercontent.com/espressif/arduino-esp32/master/libraries/ESP32/examples/Camera/CameraWebServer/camera_pins.h

#if defined(CAMERA_MODEL_XIAO_ESP32S3)
#define PWDN_GPIO_NUM -1
#define RESET_GPIO_NUM -1
#define XCLK_GPIO_NUM 10
#define SIOD_GPIO_NUM 40
#define SIOC_GPIO_NUM 39
#define Y9_GPIO_NUM 48
#define Y8_GPIO_NUM 11
#define Y7_GPIO_NUM 12
#define Y6_GPIO_NUM 14
#define Y5_GPIO_NUM 16
#define Y4_GPIO_NUM 18
#define Y3_GPIO_NUM 17
#define Y2_GPIO_NUM 15
#define VSYNC_GPIO_NUM 38
#define HREF_GPIO_NUM 47
#define PCLK_GPIO_NUM 13
#elif defined(CAMERA_MODEL_ESP32S3_CAM_LCD)
#define PWDN_GPIO_NUM -1
#define RESET_GPIO_NUM -1
#define XCLK_GPIO_NUM 40
#define SIOD_GPIO_NUM 17
#define SIOC_GPIO_NUM 18
#define Y9_GPIO_NUM 39
#define Y8_GPIO_NUM 41
#define Y7_GPIO_NUM 42
#define Y6_GPIO_NUM 12
#define Y5_GPIO_NUM 3
#define Y4_GPIO_NUM 14
#define Y3_GPIO_NUM 47
#define Y2_GPIO_NUM 13
#define VSYNC_GPIO_NUM 21
#define HREF_GPIO_NUM 38
#define PCLK_GPIO_NUM 11
#elif defined(CAMERA_MODEL_ESP32S3_EYE)
#define PWDN_GPIO_NUM -1
#define RESET_GPIO_NUM -1
#define XCLK_GPIO_NUM 15
#define SIOD_GPIO_NUM 4
#define SIOC_GPIO_NUM 5
#define Y2_GPIO_NUM 11
#define Y3_GPIO_NUM 9
#define Y4_GPIO_NUM 8
#define Y5_GPIO_NUM 10
#define Y6_GPIO_NUM 12
#define Y7_GPIO_NUM 18
#define Y8_GPIO_NUM 17
#define Y9_GPIO_NUM 16
#define VSYNC_GPIO_NUM 6
#define HREF_GPIO_NUM 7
#define PCLK_GPIO_NUM 13
#elif defined(CAMERA_MODEL_DFRobot_FireBeetle2_ESP32S3) || defined(CAMERA_MODEL_DFRobot_Romeo_ESP32S3)
#define PWDN_GPIO_NUM -1
#define RESET_GPIO_NUM -1
#define XCLK_GPIO_NUM 45
#define SIOD_GPIO_NUM 1
#define SIOC_GPIO_NUM 2
#define Y9_GPIO_NUM 48
#define Y8_GPIO_NUM 46
#define Y7_GPIO_NUM 8
#define Y6_GPIO_NUM 7
#define Y5_GPIO_NUM 4
#define Y4_GPIO_NUM 41
#define Y3_GPIO_NUM 40
#define Y2_GPIO_NUM 39
#define VSYNC_GPIO_NUM 6
#define HREF_GPIO_NUM 42
#define PCLK_GPIO_NUM 5
#elif defined(CAMERA_MODEL_M5STACK_CAMS3_UNIT)
#define PWDN_GPIO_NUM -1
#define RESET_GPIO_NUM 21
#define XCLK_GPIO_NUM 11
#define SIOD_GPIO_NUM 17
#define SIOC_GPIO_NUM 41
#define Y9_GPIO_NUM 13
#define Y8_GPIO_NUM 4
#define Y7_GPIO_NUM 10
#define Y6_GPIO_NUM 5
#define Y5_GPIO_NUM 7
#define Y4_GPIO_NUM 16
#define Y3_GPIO_NUM 15
#define Y2_GPIO_NUM 6
#define VSYNC_GPIO_NUM 42
#define HREF_GPIO_NUM 18
#define PCLK_GPIO_NUM 12
#elif defined(CAMERA_MODEL_CUSTOM_S3)
#ifndef CUSTOM_PWDN_GPIO_NUM
#error "CAMERA_MODEL_CUSTOM_S3 selected, but custom camera pins were not defined in device_config.h"
#endif

#define PWDN_GPIO_NUM CUSTOM_PWDN_GPIO_NUM
#define RESET_GPIO_NUM CUSTOM_RESET_GPIO_NUM
#define XCLK_GPIO_NUM CUSTOM_XCLK_GPIO_NUM
#define SIOD_GPIO_NUM CUSTOM_SIOD_GPIO_NUM
#define SIOC_GPIO_NUM CUSTOM_SIOC_GPIO_NUM
#define Y9_GPIO_NUM CUSTOM_Y9_GPIO_NUM
#define Y8_GPIO_NUM CUSTOM_Y8_GPIO_NUM
#define Y7_GPIO_NUM CUSTOM_Y7_GPIO_NUM
#define Y6_GPIO_NUM CUSTOM_Y6_GPIO_NUM
#define Y5_GPIO_NUM CUSTOM_Y5_GPIO_NUM
#define Y4_GPIO_NUM CUSTOM_Y4_GPIO_NUM
#define Y3_GPIO_NUM CUSTOM_Y3_GPIO_NUM
#define Y2_GPIO_NUM CUSTOM_Y2_GPIO_NUM
#define VSYNC_GPIO_NUM CUSTOM_VSYNC_GPIO_NUM
#define HREF_GPIO_NUM CUSTOM_HREF_GPIO_NUM
#define PCLK_GPIO_NUM CUSTOM_PCLK_GPIO_NUM
#else
#error "Select a supported ESP32-S3 camera model in device_config.h"
#endif
