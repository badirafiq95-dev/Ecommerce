export async function sendOrderEmail(action, order) {
  try {
    const response = await fetch("/api/order-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ action, order })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { ok: false, result };
    }
    return { ok: true, result };
  } catch (error) {
    return { ok: false, error };
  }
}
