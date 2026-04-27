export const ORDERS_STORAGE_KEY = "mint-lane-orders";

export function generateOrderId() {
  const date = new Date();
  const stamp = date.toISOString().slice(2, 10).replaceAll("-", "");
  const random = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `MLC-${stamp}-${random}`;
}

export function readOrders() {
  if (typeof window === "undefined") return [];

  try {
    const saved = localStorage.getItem(ORDERS_STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveOrder(order) {
  const orders = readOrders();
  const nextOrders = [order, ...orders];
  localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(nextOrders));
  window.dispatchEvent(new Event("mint-lane-orders-updated"));
  return nextOrders;
}

export function updateOrderStatus(orderId, status) {
  const orders = readOrders();
  const nextOrders = orders.map((order) =>
    order.id === orderId
      ? {
          ...order,
          status,
          updatedAt: new Date().toISOString()
        }
      : order
  );
  localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(nextOrders));
  window.dispatchEvent(new Event("mint-lane-orders-updated"));
  return nextOrders;
}

export function clearRejectedOrders() {
  const orders = readOrders();
  const nextOrders = orders.filter((order) => order.status !== "Rejected" && order.status !== "Cancelled");
  localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(nextOrders));
  window.dispatchEvent(new Event("mint-lane-orders-updated"));
  return nextOrders;
}

export function clearActiveOrders() {
  const orders = readOrders();
  const nextOrders = orders.filter((order) => order.status === "Rejected" || order.status === "Cancelled");
  localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(nextOrders));
  window.dispatchEvent(new Event("mint-lane-orders-updated"));
  return nextOrders;
}
