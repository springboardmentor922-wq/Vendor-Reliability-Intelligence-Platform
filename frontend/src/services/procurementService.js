const API_URL = "http://127.0.0.1:8000";

/* =========================
   GET TOKEN
========================= */

function getToken() {
  const token =
    localStorage.getItem("access_token") ||
    localStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    sessionStorage.getItem("access_token") ||
    sessionStorage.getItem("token") ||
    sessionStorage.getItem("authToken");

  if (token) {
    return token;
  }

  // Check if token is inside saved user object
  try {
    const localUser = localStorage.getItem("user");
    const sessionUser = sessionStorage.getItem("user");

    const user = localUser
      ? JSON.parse(localUser)
      : sessionUser
      ? JSON.parse(sessionUser)
      : null;

    if (user) {
      return (
        user.access_token ||
        user.accessToken ||
        user.token ||
        ""
      );
    }
  } catch (error) {
    console.warn("Unable to read saved user:", error);
  }

  return "";
}

/* =========================
   API REQUEST
========================= */

async function apiRequest(endpoint, options = {}) {
  const token = getToken();

  const headers = {
    ...(options.body !== undefined
      ? { "Content-Type": "application/json" }
      : {}),
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  console.log("API Request:", endpoint);
  console.log("Token available:", !!token);

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  let data = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error(
        "Not authenticated. Please logout and login again."
      );
    }

    if (response.status === 403) {
      throw new Error(
        data?.detail ||
          "You do not have permission for this action."
      );
    }

    throw new Error(
      data?.detail ||
        `Request failed with status ${response.status}`
    );
  }

  return data;
}

/* =========================
   PROCUREMENT REQUESTS
========================= */

export async function getProcurementRequests() {
  return apiRequest("/procurement-requests");
}

export async function getProcurementRequest(id) {
  return apiRequest(`/procurement-requests/${id}`);
}

export async function createProcurementRequest(data) {
  return apiRequest("/procurement-requests", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateProcurementRequest(id, data) {
  return apiRequest(`/procurement-requests/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function approveProcurementRequest(id) {
  return apiRequest(
    `/procurement-requests/${id}/approve`,
    {
      method: "PUT",
    }
  );
}

export async function rejectProcurementRequest(id) {
  return apiRequest(
    `/procurement-requests/${id}/reject`,
    {
      method: "PUT",
    }
  );
}


  export async function convertProcurementRequest(id, data) {
  return apiRequest(`/procurement-requests/${id}/converted`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}
export async function deleteProcurementRequest(id) {
  return apiRequest(
    `/procurement-requests/${id}`,
    {
      method: "DELETE",
    }
  );
}

/* =========================
   PURCHASE ORDERS
========================= */

/*
   Main Purchase Order API
   Used by Supply Chain Manager
*/

export async function getPurchaseOrders() {
  return apiRequest("/purchase-orders");
}

export async function getPurchaseOrder(id) {
  return apiRequest(`/purchase-orders/${id}`);
}

/*
   Procurement Manager / Admin
*/

export async function createPurchaseOrder(data) {
  return apiRequest("/purchase-orders", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updatePurchaseOrder(id, data) {
  return apiRequest(`/purchase-orders/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function approvePurchaseOrder(id) {
  return apiRequest(
    `/purchase-orders/${id}/approve`,
    {
      method: "PUT",
    }
  );
}

export async function cancelPurchaseOrder(id) {
  return apiRequest(
    `/purchase-orders/${id}/cancel`,
    {
      method: "PUT",
    }
  );
}

/*
   Supply Chain Manager
   Approved PO → Ship
*/

export async function shipPurchaseOrder(id) {
  return apiRequest(
    `/purchase-orders/${id}/ship`,
    {
      method: "PUT",
    }
  );
}

/*
   Supply Chain Manager
   Shipped PO → Deliver
*/

export async function deliverPurchaseOrder(id) {
  return apiRequest(
    `/purchase-orders/${id}/deliver`,
    {
      method: "PUT",
    }
  );
}

/* =========================
   ALTERNATIVE PROCUREMENT PO
   ENDPOINTS
========================= */

/*
   These are kept because your Procurement
   Management backend also exposes them.
*/

export async function getProcurementPurchaseOrders() {
  return apiRequest(
    "/procurement-requests/purchase-orders/list"
  );
}

export async function getProcurementPurchaseOrder(id) {
  return apiRequest(
    `/procurement-requests/purchase-orders/${id}`
  );
}

export async function approveProcurementPurchaseOrder(id) {
  return apiRequest(
    `/procurement-requests/purchase-orders/${id}/approve`,
    {
      method: "PUT",
    }
  );
}

export async function rejectProcurementPurchaseOrder(id) {
  return apiRequest(
    `/procurement-requests/purchase-orders/${id}/reject`,
    {
      method: "PUT",
    }
  );
}

export async function updateProcurementPurchaseOrderStatus(
  id,
  status
) {
  return apiRequest(
    `/procurement-requests/purchase-orders/${id}/status/${status}`,
    {
      method: "PUT",
    }
  );
}

/* =========================
   VENDORS
========================= */

export async function getVendors() {
  return apiRequest("/vendors");
}

/* =========================
   SUPPLIERS
========================= */

export async function getSuppliers() {
  return apiRequest("/suppliers");
}