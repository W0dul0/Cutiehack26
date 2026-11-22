// ESP32 rotary encoders over Web Serial (Chrome/Edge).
// The ESP32 sends lines like "E1,RIGHT,3" (see ESP_32_Rotator_Convert_V3).
import { SERIAL_BAUD } from "./config.js";

export async function connectEncoders(onControl) {
  if (!("serial" in navigator)) {
    alert("Web Serial API is not supported in this browser. Use Chrome or Edge.");
    return;
  }

  try {
    const port = await navigator.serial.requestPort();
    await port.open({ baudRate: SERIAL_BAUD });
    await port.setSignals({ dataTerminalReady: false, requestToSend: false }); // don't reset the ESP32
    const reader = port.readable.pipeThrough(new TextDecoderStream()).getReader();
    window.dispatchEvent(new CustomEvent("serialconnected"));

    let buffer = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop(); // keep the unfinished last line for next time
      for (const line of lines) parseLine(line, onControl);
    }
  } catch (err) {
    console.error("Serial connection error:", err);
  }
}

// "E1,RIGHT,3" -> onControl("E1", "RIGHT", 3). Anything else (e.g. "READY") is ignored.
function parseLine(line, onControl) {
  const [encoderId, action, amount] = line.split(",").map((s) => s.trim());
  const clicks = parseInt(amount, 10);
  if (encoderId && action && !Number.isNaN(clicks)) onControl(encoderId, action.toUpperCase(), clicks);
}
