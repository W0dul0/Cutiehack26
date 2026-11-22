# CutieHack26: Alice in Wonderland Hologram

> An interactive 3D hologram experience featuring Alice in Wonderland!

---

## Features

- **360° Holographic Display** - Shows a stunning 3D Alice in Wonderland scene from all angles inside a four-sided pyramid
- **Hand Gesture Control** - Use your webcam to track hand movements and pinch gestures  
- **Pick Up Characters** - Simply pinch the character with your fingers to "grab" it
- **ESP32 Rotator System** - Three rotary encoders enable precise rotation, tilt, and zoom
- **Easy Testing** - Built-in keyboard controls for quick testing

---

## Built With

| Technology | Purpose |
|------------|---------|
| JavaScript & Three.js | 3D rendering and holographic visualization |
| MediaPipe | AI-powered hand tracking and gesture recognition |
| Vite | Fast frontend build tool |
| ESP32 + Rotary Encoders | Physical rotation, tilt, and zoom hardware |

---

## Run the Project


1. Ensure you have **Node.js** and **pnpm** installed  
2. Clone the repository:
   ```bash
   git clone https://github.com/W0dul0/Cutiehack26.git
   cd Cutiehack26
   ```
3. Install dependencies:
   ```bash
   pnpm install
   ```
4. Start the frontend:
   ```bash
   pnpm dev:frontend
   ```
5. Open the local URL in your browser and **allow camera access** when prompted  


---

## Controls Reference

| Input | Action |
|-----------|-----------|
| Rotation (left/right) | Tilt (up/down) |
| Rotation (left/right) | Rotate (left/right) |
| Rotation (left/right) | Zoom in / out |
| Rotation (left/right) | **Pick up the character** |

---

## Physical Controls

To use the rotary encoders:
1. Upload `ESP_32_Rotator_Convert_V3/ESP32_convert_V3.ino` to your ESP32 board  
2. Connect the board to your computer  
3. Select **Connect Encoders** in the project settings  

---

## Team


Add your team members here!
Matthew Cho
Yi-Kai Cheng
Jeffrey Ngov
Sahng Chu

---

Made for **[CutieHack 2026](https://cutiehack.com)**

[![GitHub](https://img.shields.io/github/stars/W0dul0/Cutiehack26)](https://github.com/W0dul0/Cutiehack26)
[![Website](https://cutiehack26.vercel.app/)]

## Inspiration
We were inspired by Disney's Pepper Ghost technique to project a 3d hologram into real life. We wanted to apply this amazing invention to this year's project with the theme of Alice in Wonderland.

## What it does
We have rotary motors that move the 3d image left, right, up and down and to be zoomed in and out. We also have a hand tracking tool that lets you interact with the 3d space.

## How we built it
We built it used 3 rotary encoders, ESP-32, a webcam, a holographic image, with added software ( html, css, javascript, c++ ) to make this happen.

## Challenges we ran into
Challenges we ran into
- Handtracking not being accurate and not reading inputs.
- Hardware issues where we had to go find parts to make this happen.
- Using external libraries to fix a slow rotary motor's inputs.
- 3D model issues of it not loading or configuring to how it was supposed to.
- Incorrect hitboxes and sensor tracking.

## Accomplishments that we're proud of
- Successfully made an action correlate to the 3d space
- Resolving hardware issues
- Fixing/Debugging code that was broken due to external pushes
- Working as a team to create this 3d hologram project

## What we learned
- We learned combine multiple API's
- Split tasks among each other in a high intense environment
- How to translate hardware and software
- Hand tracking actions and motions
- 3D modeling

## What's next for Wonderlens
- New advanced movements to make hand tracking software more advanced
- Webcam tracking improvement
- Scaling this to be a bigger 3D field
- New light sensors for the hand-cam to not get distorted by bright lights