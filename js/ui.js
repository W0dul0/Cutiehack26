// Debug panel buttons and status text.
export function initDebugPanel({ hitboxesShown, onToggleHitboxes }) {
  // Hide/Show Hitboxes: the grey hand square and Alice's red bubble
  const hitboxButton = document.getElementById("hitbox-button");
  let shown = hitboxesShown;
  const labelHitboxButton = () => {
    if (hitboxButton) hitboxButton.textContent = shown ? "Hide Hitboxes" : "Show Hitboxes";
  };
  labelHitboxButton();
  hitboxButton?.addEventListener("click", () => {
    shown = !shown;
    onToggleHitboxes(shown);
    labelHitboxButton();
  });

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

  // Connect button + status (green while the ESP32 encoders are connected)
  const connectButton = document.getElementById("connect-button");
  connectButton?.addEventListener("click", () => window.connectEncoders());

  const status = document.getElementById("net-status");
  const showConnected = (connected) => {
    if (status) {
      status.textContent = connected ? "Connected" : "Disconnected";
      status.classList.toggle("connected", connected);
    }
    if (connectButton) connectButton.hidden = connected;
  };
  window.addEventListener("serialconnected", () => showConnected(true));
  window.addEventListener("serialdisconnected", () => showConnected(false));

  // "Hitting Alice" card: true (green) while the grey hand hitbox overlaps her
  const aliceStatus = document.getElementById("alice-status");
  window.addEventListener("alicehit", (e) => {
    if (!aliceStatus) return;
    aliceStatus.textContent = String(e.detail.isHittingAlice);
    aliceStatus.classList.toggle("hit", e.detail.isHittingAlice);
  });
}
