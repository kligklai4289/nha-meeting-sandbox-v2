const form = document.querySelector("#chatForm");
const input = document.querySelector("#messageInput");
const messages = document.querySelector("#messages");
const sources = document.querySelector("#sources");
const statusBadge = document.querySelector("#statusBadge");

const sessionId = crypto.randomUUID();

function addMessage(role, text) {
  const node = document.createElement("div");
  node.className = `message ${role}`;
  node.textContent = text;
  messages.appendChild(node);
  messages.scrollTop = messages.scrollHeight;
}

function renderSources(items) {
  if (!items.length) {
    sources.textContent = "ไม่มีแหล่งข้อมูลสำหรับคำตอบนี้";
    return;
  }

  sources.innerHTML = "";
  for (const item of items) {
    const node = document.createElement("div");
    node.className = "source-item";
    node.innerHTML = `
      <strong>${item.title || item.dataset}</strong>
      <span>${item.dataset}${item.reference ? ` #${item.reference}` : ""}</span>
      <span>${item.snippet || ""}</span>
    `;
    sources.appendChild(node);
  }
}

async function refreshHealth() {
  try {
    const response = await fetch("/health");
    const health = await readJsonOrThrow(response);
    statusBadge.textContent = `${health.status} | Oracle: ${health.oracle_available ? "ready" : "not ready"} | OpenAI: ${health.openai_configured ? "ready" : "missing"}`;
    statusBadge.className = `status ${health.status}`;
  } catch {
    statusBadge.textContent = "health unavailable";
    statusBadge.className = "status degraded";
  }
}

async function readJsonOrThrow(response) {
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { detail: text || response.statusText || "Non-JSON response" };
  }

  if (!response.ok) {
    throw new Error(payload.detail || `HTTP ${response.status}`);
  }
  return payload;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = input.value.trim();
  if (!message) return;

  const button = form.querySelector("button");
  button.disabled = true;
  addMessage("user", message);
  input.value = "";

  try {
    const response = await fetch("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, session_id: sessionId }),
    });
    const payload = await readJsonOrThrow(response);
    addMessage("assistant", `${payload.answer}\n\nroute: ${payload.route}${payload.cached ? " | cached" : ""}`);
    renderSources(payload.sources || []);
  } catch (error) {
    addMessage("assistant", `เกิดข้อผิดพลาด: ${error.message}`);
    renderSources([]);
  } finally {
    button.disabled = false;
    input.focus();
  }
});

addMessage("assistant", "พร้อมรับคำถามครับ ลองถามเรื่องมติประชุมหรือความคืบหน้าได้เลย");
refreshHealth();
