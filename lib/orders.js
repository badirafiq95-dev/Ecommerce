export const ORDERS_STORAGE_KEY = "mint-lane-orders";
export const LAST_ORDER_STORAGE_KEY = "freaking-collectibles-last-order";

export function compactOrderForStorage(order) {
  const {
    id,
    status,
    createdAt,
    updatedAt,
    syncedAt,
    items
  } = order || {};

  return {
    id,
    status,
    createdAt,
    updatedAt,
    syncedAt,
    items: Array.isArray(items)
      ? items.map((item) => ({
          id: item.id,
          name: item.name,
          category: item.category,
          image: item.image,
          quantity: item.quantity
        }))
      : []
  };
}

function parseOrders(value) {
  try {
    const parsed = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? parsed.map(compactOrderForStorage) : [];
  } catch {
    return [];
  }
}

function parseOrder(value) {
  try {
    const parsed = value ? JSON.parse(value) : null;
    return parsed?.id ? compactOrderForStorage(parsed) : null;
  } catch {
    return null;
  }
}

function orderBelongsToCustomer(order, uid = "", email = "") {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const orderEmail = String(order.userEmail || order.email || "").trim().toLowerCase();
  return !order.userId || order.userId === uid || (normalizedEmail && orderEmail === normalizedEmail);
}

function sortOrdersByCreatedAt(orders) {
  return orders.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

function getOrderTimeValue(order, field) {
  const value = order?.[field];
  if (!value) return 0;
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.seconds === "number") return value.seconds * 1000;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function getOrderModifiedTime(order) {
  return (
    getOrderTimeValue(order, "updatedAt") ||
    getOrderTimeValue(order, "syncedAt") ||
    getOrderTimeValue(order, "createdAt")
  );
}

export function mergeOrderLists(...orderLists) {
  const orderMap = new Map();
  orderLists.flat().filter(Boolean).forEach((order) => {
    const nextOrder = compactOrderForStorage(order);
    const existingOrder = orderMap.get(nextOrder.id);
    if (!existingOrder) {
      orderMap.set(nextOrder.id, nextOrder);
      return;
    }

    const existingTime = getOrderModifiedTime(existingOrder);
    const nextTime = getOrderModifiedTime(nextOrder);
    const mergedOrder =
      nextTime >= existingTime
        ? { ...existingOrder, ...nextOrder }
        : { ...nextOrder, ...existingOrder };
    orderMap.set(nextOrder.id, mergedOrder);
  });
  return sortOrdersByCreatedAt(Array.from(orderMap.values()));
}

export function generateOrderId() {
  const date = new Date();
  const stamp = date.toISOString().slice(2, 10).replaceAll("-", "");
  const time = Date.now().toString(36).toUpperCase().slice(-5);
  let random = Math.random().toString(36).slice(2, 7).toUpperCase();

  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const values = crypto.getRandomValues(new Uint8Array(4));
    random = Array.from(values, (value) => value.toString(36).padStart(2, "0")).join("").slice(0, 5).toUpperCase();
  }

  return `FC-${stamp}-${time}-${random}`;
}

export function readOrders() {
  if (typeof window === "undefined") return [];

  try {
    const saved = localStorage.getItem(ORDERS_STORAGE_KEY);
    const orders = parseOrders(saved);
    if (saved && saved !== JSON.stringify(orders)) {
      localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(orders));
    }
    return orders;
  } catch {
    return [];
  }
}

export function readLocalOrderBackups() {
  if (typeof window === "undefined") return [];

  const localBackup = parseOrder(localStorage.getItem(LAST_ORDER_STORAGE_KEY));
  const sessionBackup = parseOrder(sessionStorage.getItem(LAST_ORDER_STORAGE_KEY));
  try {
    if (localBackup) localStorage.setItem(LAST_ORDER_STORAGE_KEY, JSON.stringify(localBackup));
  } catch {}
  try {
    if (sessionBackup) sessionStorage.setItem(LAST_ORDER_STORAGE_KEY, JSON.stringify(sessionBackup));
  } catch {}
  return [localBackup, sessionBackup].filter(Boolean);
}

export function readCustomerLocalOrders(uid = "", email = "") {
  return mergeOrderLists(readOrders(), readLocalOrderBackups()).filter((order) =>
    orderBelongsToCustomer(order, uid, email)
  );
}

function saveLastOrderBackup(order) {
  const compactOrder = compactOrderForStorage(order);
  try {
    localStorage.setItem(LAST_ORDER_STORAGE_KEY, JSON.stringify(compactOrder));
  } catch {
    // The session backup is still enough for the immediate post-checkout view.
  }
  try {
    sessionStorage.setItem(LAST_ORDER_STORAGE_KEY, JSON.stringify(compactOrder));
  } catch {
    // Ignore storage-denied browsers.
  }
}

export function saveOrder(order) {
  saveLastOrderBackup(order);
  const orders = readOrders().map(compactOrderForStorage);
  const nextOrders = mergeOrderLists([compactOrderForStorage(order)], orders);
  try {
    localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(nextOrders));
  } catch (error) {
    const fallbackOrders = mergeOrderLists([compactOrderForStorage(order)], orders.slice(0, 20));
    try {
      localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(fallbackOrders));
    } catch {
      localStorage.removeItem(ORDERS_STORAGE_KEY);
      try {
        localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify([compactOrderForStorage(order)]));
      } catch {
        // The last-order backup above still lets the user view this order.
      }
    }
  }
  window.dispatchEvent(new Event("mint-lane-orders-updated"));
  return nextOrders;
}

export function updateOrderStatus(orderId, status, fallbackOrder = null) {
  const orders = readOrders();
  const updatedAt = new Date().toISOString();
  let hasOrder = false;
  const nextOrders = orders.map((order) =>
    order.id === orderId
      ? (() => {
          hasOrder = true;
          return {
            ...compactOrderForStorage(fallbackOrder || order),
            ...compactOrderForStorage(order),
            status,
            updatedAt
          };
        })()
      : compactOrderForStorage(order)
  );

  if (!hasOrder && fallbackOrder) {
    nextOrders.unshift({
      ...compactOrderForStorage(fallbackOrder),
      id: orderId,
      status,
      updatedAt
    });
  }

  const mergedOrders = mergeOrderLists(nextOrders);
  const updatedOrder = mergedOrders.find((order) => order.id === orderId);
  if (updatedOrder) saveLastOrderBackup(updatedOrder);
  localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(mergedOrders));
  window.dispatchEvent(new Event("mint-lane-orders-updated"));
  return mergedOrders;
}

export function clearRejectedOrders() {
  const orders = readOrders();
  const nextOrders = orders
    .filter((order) => order.status !== "Rejected" && order.status !== "Cancelled")
    .map(compactOrderForStorage);
  localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(nextOrders));
  window.dispatchEvent(new Event("mint-lane-orders-updated"));
  return nextOrders;
}

export function clearActiveOrders() {
  const orders = readOrders();
  const nextOrders = orders
    .filter((order) => order.status === "Rejected" || order.status === "Cancelled")
    .map(compactOrderForStorage);
  localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(nextOrders));
  window.dispatchEvent(new Event("mint-lane-orders-updated"));
  return nextOrders;
}
