#include <Arduino.h>

// ======================================
// CONFIGURATION
// ======================================

const int ENCODER_COUNT = 3;

// Safe ESP32 GPIOs with internal pull-ups & interrupt support
const int PIN_A[3] = {18, 21, 23};
const int PIN_B[3] = {19, 22, 25};

const char* positiveAction[3] = {"RIGHT", "UP",   "ZOOM_IN"};
const char* negativeAction[3] = {"LEFT",  "DOWN", "ZOOM_OUT"};

// Set to -1 to reverse a knob's direction
const int directionSign[3] = {1, 1, 1};

// Quadrature transitions per physical click (use 2 or 4 depending on your encoder)
const int STEPS_PER_CLICK = 4;

const unsigned long SEND_INTERVAL = 15; // ms
unsigned long lastSendTime = 0;

// ======================================
// INTERRUPT STATE
// ======================================

// Gray-code quadrature lookup table
const int8_t QEM[16] = {
   0, -1,  1,  0,
   1,  0,  0, -1,
  -1,  0,  0,  1,
   0,  1, -1,  0
};

volatile uint8_t prevState[3] = {0, 0, 0};
volatile long rawSteps[3]     = {0, 0, 0};

void IRAM_ATTR handleEncoder(int i) {
  uint8_t a = digitalRead(PIN_A[i]);
  uint8_t b = digitalRead(PIN_B[i]);
  uint8_t currState = (a << 1) | b;
  uint8_t idx = (prevState[i] << 2) | currState;
  rawSteps[i] += QEM[idx] * directionSign[i];
  prevState[i] = currState;
}

void IRAM_ATTR isr0() { handleEncoder(0); }
void IRAM_ATTR isr1() { handleEncoder(1); }
void IRAM_ATTR isr2() { handleEncoder(2); }

// ======================================
// HELPERS
// ======================================

void sendMovement(int encoder, long clicks) {
  const char* action = (clicks > 0) ? positiveAction[encoder]
                                    : negativeAction[encoder];
  Serial.print("E");
  Serial.print(encoder + 1);
  Serial.print(",");
  Serial.print(action);
  Serial.print(",");
  Serial.println(abs(clicks));
}

// ======================================
// SETUP / LOOP
// ======================================

void setup() {
  Serial.begin(115200);

  for (int i = 0; i < ENCODER_COUNT; i++) {
    pinMode(PIN_A[i], INPUT_PULLUP);
    pinMode(PIN_B[i], INPUT_PULLUP);
    prevState[i] = (digitalRead(PIN_A[i]) << 1) | digitalRead(PIN_B[i]);
  }

  attachInterrupt(digitalPinToInterrupt(PIN_A[0]), isr0, CHANGE);
  attachInterrupt(digitalPinToInterrupt(PIN_B[0]), isr0, CHANGE);

  attachInterrupt(digitalPinToInterrupt(PIN_A[1]), isr1, CHANGE);
  attachInterrupt(digitalPinToInterrupt(PIN_B[1]), isr1, CHANGE);

  attachInterrupt(digitalPinToInterrupt(PIN_A[2]), isr2, CHANGE);
  attachInterrupt(digitalPinToInterrupt(PIN_B[2]), isr2, CHANGE);

  Serial.println("READY");
}

void loop() {
  if (millis() - lastSendTime >= SEND_INTERVAL) {
    lastSendTime = millis();

    for (int i = 0; i < ENCODER_COUNT; i++) {
      noInterrupts();
      long steps = rawSteps[i];
      long clicks = steps / STEPS_PER_CLICK;
      if (clicks != 0) {
        rawSteps[i] -= clicks * STEPS_PER_CLICK;
      }
      interrupts();

      if (clicks != 0) {
        sendMovement(i, clicks);
      }
    }
  }
}
