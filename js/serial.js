// ESP32 rotary encoders over Web Serial (Chrome/Edge), 115200 baud.
// The ESP32 sends lines like "E1,RIGHT,3" (see ESP_32_Rotator_Convert_V3).
//
// Browsers only allow the FIRST connection from a click (askUser: true -> port picker).
// After that, askUser: false reconnects to the already-allowed port with no click (used on page load).
import { SERIAL_BAUD } from "./config.js";

let activePort = null;
const emit = (name) => window.dispatchEvent(new CustomEvent(name));

export async function connectEncoders(onControl, { askUser = true } = {}) {
  if (!("serial" in navigator)) {
    if (askUser) alert("Web Serial API is not supported in this browser. Use Chrome or Edge.");
    return;
  }
  if (activePort) return; // already connected

  let port;
  try {
    port = askUser ? await navigator.serial.requestPort() : (await navigator.serial.getPorts())[0];
    if (!port) return; // nothing allowed yet: click "Connect Encoders" once

    await port.open({ baudRate: SERIAL_BAUD });
    await port.setSignals({ dataTerminalReady: false, requestToSend: false }); // don't reset the ESP32
    activePort = port;
    emit("serialconnected");
    console.log(`Encoders connected at ${SERIAL_BAUD} baud`);

    await readLines(port, (line) => parseLine(line, onControl));
  } catch (err) {
    if (err.name !== "NotFoundError") console.error("Serial connection error:", err); // NotFoundError = picker cancelled
  } finally {
    if (port && activePort === port) {
      activePort = null;
      await port.close().catch(() => {});
      emit("serialdisconnected");
    }
  }
}

// Reads text from the port until it closes or is unplugged, calling onLine for each full line
async function readLines(port, onLine) {
  const reader = port.readable.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop(); // keep the unfinished last line for next time
      lines.forEach(onLine);
    }
  } finally {
    reader.releaseLock();
  }
}

// "E1,RIGHT,3" -> onControl("E1", "RIGHT", 3). Anything else (e.g. "READY") is ignored.
function parseLine(line, onControl) {
  const [encoderId, action, amount] = line.split(",").map((s) => s.trim());
  const clicks = parseInt(amount, 10);
  if (encoderId && action && !Number.isNaN(clicks)) onControl(encoderId, action.toUpperCase(), clicks);
}
