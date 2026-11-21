#include <Arduino.h>

// ======================================
// CONFIGURATION
// ======================================

const int ENCODER_COUNT = 3;   // 1-3

const int PIN_A[3] = {18, 21, 23};
const int PIN_B[3] = {19, 22, 25};

const char* positiveAction[3] = {"RIGHT", "UP",   "ZOOM_IN"};
const char* negativeAction[3] = {"LEFT",  "DOWN", "ZOOM_OUT"};

// Set to -1 to reverse an encoder's direction
const int directionSign[3] = {1, 1, 1};

// How often accumulated movement is sent
const unsigned long SEND_INTERVAL = 10;   // ms
unsigned long lastSendTime = 0;

// After a click, both pins must stay high for this long before the next
// click can count. Raise if one click still counts twice; lower if fast
// spinning misses clicks.
const unsigned long SETTLE_MS = 10;

// ======================================
// STATE
// ======================================

bool armed[3]              = {false, false, false};
unsigned long lastLow[3]   = {0, 0, 0};   // last time either pin was seen low
long pendingMovement[3]    = {0, 0, 0};

// ======================================
// HELPERS
// ======================================

void sendMovement(int encoder, long movement) {
    const char* action = (movement > 0) ? positiveAction[encoder]
                                        : negativeAction[encoder];
    Serial.print("E");
    Serial.print(encoder + 1);
    Serial.print(",");
    Serial.print(action);
    Serial.print(",");
    Serial.println(abs(movement));
}

void updateEncoder(int i) {
    int a = digitalRead(PIN_A[i]);
    int b = digitalRead(PIN_B[i]);
    unsigned long now = millis();

    if (a == LOW || b == LOW) {
        lastLow[i] = now;                 // any low (including bounce) restarts the quiet timer

        if (armed[i]) {
            armed[i] = false;             // one count per click, no matter how it bounces

            if (a == LOW && b == HIGH) {
                pendingMovement[i] += directionSign[i];   // A dropped first
            }
            else if (b == LOW && a == HIGH) {
                pendingMovement[i] -= directionSign[i];   // B dropped first
            }
            // both low in the same sample: direction unknown, ignore
        }
    }
    else if (!armed[i] && (now - lastLow[i] >= SETTLE_MS)) {
        armed[i] = true;                  // both pins quiet and high: ready for next click
    }
}

// ======================================
// SETUP / LOOP
// ======================================

void setup() {
    Serial.begin(115200);

    for (int i = 0; i < ENCODER_COUNT; i++) {
        pinMode(PIN_A[i], INPUT_PULLUP);
        pinMode(PIN_B[i], INPUT_PULLUP);
    }

    Serial.println("READY");
}

void loop() {
    for (int i = 0; i < ENCODER_COUNT; i++) {
        updateEncoder(i);
    }

    if (millis() - lastSendTime >= SEND_INTERVAL) {
        lastSendTime = millis();

        for (int i = 0; i < ENCODER_COUNT; i++) {
            if (pendingMovement[i] != 0) {
                sendMovement(i, pendingMovement[i]);
                pendingMovement[i] = 0;
            }
        }
    }
}