const API_URL = "http://127.0.0.1:8000";

function getToken() {
  return (
    localStorage.getItem("access_token") ||
    sessionStorage.getItem("access_token") ||
    localStorage.getItem("token") ||
    sessionStorage.getItem("token") ||
    ""
  );
}

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

  const response = await fetch(
    `${API_URL}${endpoint}`,
    {
      ...options,
      headers,
    }
  );

  let data = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(
      data?.detail ||
        `Request failed with status ${response.status}`
    );
  }

  return data;
}


// ============================================================
// GET ALL COMMUNICATIONS
// ============================================================

export async function getCommunications() {
  return apiRequest("/communications");
}


// ============================================================
// GET INBOX
// ============================================================

export async function getInbox() {
  return apiRequest("/communications/inbox");
}


// ============================================================
// GET SENT MESSAGES
// ============================================================

export async function getSentMessages() {
  return apiRequest("/communications/sent");
}


// ============================================================
// GET SINGLE COMMUNICATION
// ============================================================

export async function getCommunication(id) {
  return apiRequest(
    `/communications/${id}`
  );
}


// ============================================================
// SEND COMMUNICATION
// ============================================================

export async function sendCommunication(data) {
  return apiRequest(
    "/communications",
    {
      method: "POST",
      body: JSON.stringify(data),
    }
  );
}


// ============================================================
// MARK AS READ
// ============================================================

export async function markCommunicationRead(id) {
  return apiRequest(
    `/communications/${id}/read`,
    {
      method: "PUT",
    }
  );
}


// ============================================================
// UPDATE COMMUNICATION
// ============================================================

export async function updateCommunication(
  id,
  data
) {
  return apiRequest(
    `/communications/${id}`,
    {
      method: "PUT",
      body: JSON.stringify(data),
    }
  );
}


// ============================================================
// DELETE COMMUNICATION
// ============================================================

export async function deleteCommunication(id) {
  return apiRequest(
    `/communications/${id}`,
    {
      method: "DELETE",
    }
  );
}