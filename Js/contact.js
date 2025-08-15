// Build WhatsApp links from the form message so both buttons share logic
const waPhone = "+91XXXXXXXXXX"; // <- your WhatsApp number

function waURL(text) {
  const base = `https://wa.me/${waPhone}`;
  const msg = text ? `?text=${encodeURIComponent(text)}` : "";
  return base + msg;
}

function currentWAFromForm() {
  const name = document.getElementById("cName")?.value?.trim() || "";
  const phone = document.getElementById("cPhone")?.value?.trim() || "";
  const msg = document.getElementById("cMsg")?.value?.trim() || "";
  const composed =
    `Hi Peltra,\n` +
    (name ? `Name: ${name}\n` : "") +
    (phone ? `Phone: ${phone}\n` : "") +
    (msg ? `Message: ${msg}\n` : "");
  return waURL(composed);
}

function wireWhatsAppButtons() {
  const waTop = document.getElementById("waTop");
  const waInline = document.getElementById("waInline");
  const update = () => {
    const url = currentWAFromForm();
    if (waTop) waTop.href = url;
    if (waInline) waInline.href = url;
  };
  ["input", "change"].forEach(ev => {
    ["cName", "cPhone", "cMsg"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener(ev, update);
    });
  });
  update();
}

function wireNetlifyForm() {
  const form = document.getElementById("contactForm");
  const status = document.getElementById("formStatus");
  if (!form) return;

  const encode = (data) =>
    Object.keys(data).map(k => encodeURIComponent(k) + "=" + encodeURIComponent(data[k])).join("&");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    status.textContent = "Sending…";
    status.className = "form-status";

    const payload = {
      "form-name": form.getAttribute("name"),
      name: form.name.value.trim(),
      phone: form.phone.value.trim(),
      message: form.message.value.trim()
    };

    try {
      await fetch("/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: encode(payload)
      });
      status.textContent = "Sent! We’ll get back to you shortly.";
      status.className = "form-status ok";
      form.reset();
      wireWhatsAppButtons(); // refresh WA link to empty message
    } catch (err) {
      console.error(err);
      status.textContent = "Could not send right now. Please try WhatsApp or call.";
      status.className = "form-status err";
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  wireWhatsAppButtons();
  wireNetlifyForm();
});