// Debug panel buttons and status text.
export function initDebugPanel() {
  // Hide/Show: fade the webcam out and back in
  const hideButton = document.getElementById("hide-button");
  const webcam = document.getElementById("webcam");
  hideButton?.addEventListener("click", () => {
    const isHidden = webcam.classList.contains("webcam-hidden");
    webcam.classList.toggle("webcam-hidden", !isHidden);
    webcam.classList.toggle("webcam-shown", isHidden);
    hideButton.textContent = isHidden ? "Hide" : "Show";
  });

  // Collapse: slide the debug panel closed and open
  const collapseButton = document.getElementById("collapse");
  const panel = document.getElementById("debug-panel");
  collapseButton?.addEventListener("click", () => {
    const collapsed = panel.classList.toggle("panel-collapsed");
    collapseButton.classList.toggle("flipped", collapsed);
    collapseButton.title = collapsed ? "Expand panel" : "Collapse panel";
  });

  // Connection status turns green once the ESP32 encoders connect
  const status = document.getElementById("net-status");
  window.addEventListener("serialconnected", () => {
    if (!status) return;
    status.textContent = "Connected";
    status.classList.add("connected");
  });
}
