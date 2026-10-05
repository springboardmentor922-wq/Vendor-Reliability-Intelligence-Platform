import React, { useEffect, useState } from "react";

import {
  getProcurementRequests,
  createProcurementRequest,
  updateProcurementRequest,
  approveProcurementRequest,
  rejectProcurementRequest,
  convertProcurementRequest,
  deleteProcurementRequest,
} from "../services/procurementService";

function getToken() {
  return (
    localStorage.getItem("token") ||
    localStorage.getItem("access_token") ||
    localStorage.getItem("authToken") ||
    sessionStorage.getItem("token") ||
    sessionStorage.getItem("access_token") ||
    sessionStorage.getItem("authToken") ||
    ""
  );
}

function getCurrentUser() {
  const savedUser =
    localStorage.getItem("user") ||
    localStorage.getItem("currentUser") ||
    sessionStorage.getItem("user") ||
    sessionStorage.getItem("currentUser");

  if (!savedUser) {
    return null;
  }

  try {
    const parsedUser = JSON.parse(savedUser);

    if (parsedUser && parsedUser.user) {
      return parsedUser.user;
    }

    return parsedUser;
  } catch {
    return null;
  }
}

function getLoggedInRole() {
  const user = getCurrentUser();

  if (user && user.role) {
    return String(user.role).toLowerCase();
  }

  return String(
    localStorage.getItem("role") ||
      sessionStorage.getItem("role") ||
      "unknown"
  ).toLowerCase();
}

function getStatus(request) {
  return String(request.status || "pending").toLowerCase();
}

function formatAmount(value) {
  const amount = Number(value || 0);

  return amount.toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  });
}

function getErrorMessage(error) {
  if (!error) {
    return "Something went wrong.";
  }

  if (typeof error === "string") {
    return error;
  }

  if (error.message) {
    return error.message;
  }

  if (error.detail) {
    if (typeof error.detail === "string") {
      return error.detail;
    }

    return JSON.stringify(error.detail);
  }

  return "Something went wrong.";
}

export default function ProcurementRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [showPOModal, setShowPOModal] = useState(false);

  const [editingRequest, setEditingRequest] = useState(null);
  const [convertingRequest, setConvertingRequest] = useState(null);
  const [selectedPO, setSelectedPO] = useState(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [form, setForm] = useState({
    vendor_id: "",
    description: "",
    quantity: 1,
    estimated_amount: "",
  });

  const [convertForm, setConvertForm] = useState({
    expected_delivery_date: "",
    total_amount: "",
  });

  const role = getLoggedInRole();

  const isAdmin = role === "administrator";
  const isProcurementManager = role === "procurement_manager";

  useEffect(() => {
    loadRequests();
  }, []);

  async function loadRequests() {
    try {
      setLoading(true);
      setError("");

      const token = getToken();

      if (!token) {
        setRequests([]);
        setError("Please login again. Authentication token was not found.");
        return;
      }

      const response = await getProcurementRequests();

      if (Array.isArray(response)) {
        setRequests(response);
      } else if (response && Array.isArray(response.data)) {
        setRequests(response.data);
      } else if (response && Array.isArray(response.requests)) {
        setRequests(response.requests);
      } else {
        setRequests([]);
      }
    } catch (err) {
      console.error("Load procurement requests error:", err);
      setError(getErrorMessage(err));
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }

  function clearMessages() {
    setError("");
    setSuccess("");
  }

  function openCreateModal() {
    clearMessages();

    setEditingRequest(null);

    setForm({
      vendor_id: "",
      description: "",
      quantity: 1,
      estimated_amount: "",
    });

    setShowModal(true);
  }

  function openEditModal(request) {
    clearMessages();

    setEditingRequest(request);

    setForm({
      vendor_id:
        request.vendor_id !== null && request.vendor_id !== undefined
          ? String(request.vendor_id)
          : "",
      description: request.description || "",
      quantity: request.quantity || 1,
      estimated_amount:
        request.estimated_amount !== null &&
        request.estimated_amount !== undefined
          ? request.estimated_amount
          : "",
    });

    setShowModal(true);
  }

  function closeModal() {
    if (saving) {
      return;
    }

    setShowModal(false);
    setEditingRequest(null);
  }

  function handleFormChange(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  function handleConvertChange(event) {
    const { name, value } = event.target;

    setConvertForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    clearMessages();

    if (!form.description.trim()) {
      setError("Description is required.");
      return;
    }

    if (form.quantity === "" || Number(form.quantity) <= 0) {
      setError("Quantity must be greater than 0.");
      return;
    }

    if (
      form.estimated_amount === "" ||
      Number(form.estimated_amount) < 0
    ) {
      setError("Estimated amount must be 0 or greater.");
      return;
    }

    try {
      setSaving(true);

      const payload = {
        description: form.description.trim(),
        quantity: Number(form.quantity),
        estimated_amount: Number(form.estimated_amount),
      };

      if (form.vendor_id.trim() !== "") {
        payload.vendor_id = Number(form.vendor_id);
      }

      if (editingRequest) {
        await updateProcurementRequest(editingRequest.id, payload);

        setSuccess("Procurement request updated successfully.");
      } else {
        await createProcurementRequest(payload);

        setSuccess("Procurement request created successfully.");
      }

      setShowModal(false);
      setEditingRequest(null);

      setForm({
        vendor_id: "",
        description: "",
        quantity: 1,
        estimated_amount: "",
      });

      await loadRequests();
    } catch (err) {
      console.error("Save procurement request error:", err);
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleApprove(request) {
    if (!isAdmin) {
      setError("Only an administrator can approve requests.");
      return;
    }

    if (getStatus(request) !== "pending") {
      setError("Only pending requests can be approved.");
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to approve this procurement request?"
    );

    if (!confirmed) {
      return;
    }

    try {
      clearMessages();
      setSaving(true);

      await approveProcurementRequest(request.id);

      setSuccess("Procurement request approved successfully.");

      await loadRequests();
    } catch (err) {
      console.error("Approve procurement request error:", err);
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleReject(request) {
    if (!isAdmin) {
      setError("Only an administrator can reject requests.");
      return;
    }

    if (getStatus(request) !== "pending") {
      setError("Only pending requests can be rejected.");
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to reject this procurement request?"
    );

    if (!confirmed) {
      return;
    }

    try {
      clearMessages();
      setSaving(true);

      await rejectProcurementRequest(request.id);

      setSuccess("Procurement request rejected successfully.");

      await loadRequests();
    } catch (err) {
      console.error("Reject procurement request error:", err);
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(request) {
    if (!isProcurementManager) {
      setError("Only a procurement manager can delete requests.");
      return;
    }

    if (getStatus(request) !== "pending") {
      setError("Only pending requests can be deleted.");
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to delete this procurement request?"
    );

    if (!confirmed) {
      return;
    }

    try {
      clearMessages();
      setSaving(true);

      await deleteProcurementRequest(request.id);

      setSuccess("Procurement request deleted successfully.");

      await loadRequests();
    } catch (err) {
      console.error("Delete procurement request error:", err);
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  function openConvertModal(request) {
    clearMessages();

    setConvertingRequest(request);

    setConvertForm({
      expected_delivery_date: "",
      total_amount:
        request.estimated_amount !== null &&
        request.estimated_amount !== undefined
          ? String(request.estimated_amount)
          : "",
    });

    setShowConvertModal(true);
  }

  function closeConvertModal() {
    if (saving) {
      return;
    }

    setShowConvertModal(false);
    setConvertingRequest(null);

    setConvertForm({
      expected_delivery_date: "",
      total_amount: "",
    });
  }

  async function handleConvertToPO(event) {
    event.preventDefault();

    clearMessages();

    if (!convertingRequest) {
      setError("No procurement request selected.");
      return;
    }

    if (!convertForm.expected_delivery_date) {
      setError("Expected delivery date is required for the purchase order.");
      return;
    }

    if (
      convertForm.total_amount === "" ||
      Number(convertForm.total_amount) <= 0
    ) {
      setError("Total amount must be greater than 0.");
      return;
    }

    try {
      setSaving(true);

      const payload = {
        expected_delivery_date: convertForm.expected_delivery_date,
        total_amount: Number(convertForm.total_amount),
      };

      const response = await convertProcurementRequest(
        convertingRequest.id,
        payload
      );

      let createdPO = null;

      if (response && response.purchase_order) {
        createdPO = response.purchase_order;
      } else if (response && response.po) {
        createdPO = response.po;
      } else if (response && response.data) {
        if (response.data.purchase_order) {
          createdPO = response.data.purchase_order;
        } else if (response.data.po) {
          createdPO = response.data.po;
        } else {
          createdPO = response.data;
        }
      } else if (response) {
        createdPO = response;
      }

      if (createdPO) {
        setSelectedPO({
          ...createdPO,
          procurement_request_id:
            createdPO.procurement_request_id ||
            convertingRequest.id,
          request_number:
            createdPO.request_number ||
            convertingRequest.request_number,
          vendor_id:
            createdPO.vendor_id ||
            convertingRequest.vendor_id,
          description:
            createdPO.description ||
            convertingRequest.description,
          quantity:
            createdPO.quantity ||
            convertingRequest.quantity,
          total_amount:
            createdPO.total_amount ||
            convertForm.total_amount,
          expected_delivery_date:
            createdPO.expected_delivery_date ||
            convertForm.expected_delivery_date,
        });
      }

      setSuccess(
        "Procurement request converted to purchase order successfully."
      );

      setShowConvertModal(false);
      setConvertingRequest(null);

      setConvertForm({
        expected_delivery_date: "",
        total_amount: "",
      });

      await loadRequests();
    } catch (err) {
      console.error("Convert procurement request error:", err);
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  function openExistingPO(request) {
    clearMessages();

    const poData =
      request.purchase_order ||
      request.po ||
      request.purchaseOrder ||
      request;

    setSelectedPO({
      ...poData,
      procurement_request_id:
        poData.procurement_request_id || request.id,
      request_number:
        poData.request_number || request.request_number,
      vendor_id: poData.vendor_id || request.vendor_id,
      description: poData.description || request.description,
      quantity: poData.quantity || request.quantity,
      estimated_amount:
        poData.estimated_amount || request.estimated_amount,
    });

    setShowPOModal(true);
  }

  function closePOModal() {
    setShowPOModal(false);
    setSelectedPO(null);
  }

  const filteredRequests = requests.filter((request) => {
    const status = getStatus(request);

    const requestNumber = String(
      request.request_number || request.id || ""
    ).toLowerCase();

    const description = String(
      request.description || ""
    ).toLowerCase();

    const vendorId = String(
      request.vendor_id || ""
    ).toLowerCase();

    const searchText = search.toLowerCase().trim();

    const matchesSearch =
      !searchText ||
      requestNumber.includes(searchText) ||
      description.includes(searchText) ||
      vendorId.includes(searchText);

    const matchesStatus =
      statusFilter === "all" || status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const totalRequests = requests.length;

  const pendingRequests = requests.filter(
    (request) => getStatus(request) === "pending"
  ).length;

  const approvedRequests = requests.filter(
    (request) => getStatus(request) === "approved"
  ).length;

  const convertedRequests = requests.filter(
    (request) =>
      getStatus(request) === "converted" ||
      getStatus(request) === "converted_to_po"
  ).length;

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>Procurement Requests</h1>

            <p style={styles.subtitle}>
              Create and manage procurement requests for vendor purchases.
            </p>
          </div>

          {isProcurementManager && (
            <button
              type="button"
              onClick={openCreateModal}
              style={styles.primaryButton}
            >
              + Create Procurement Request
            </button>
          )}
        </div>

        {error && (
          <div style={styles.errorBox}>
            <span>{error}</span>

            <button
              type="button"
              onClick={() => setError("")}
              style={styles.closeMessageButton}
            >
              ×
            </button>
          </div>
        )}

        {success && (
          <div style={styles.successBox}>
            <span>{success}</span>

            <button
              type="button"
              onClick={() => setSuccess("")}
              style={styles.closeMessageButton}
            >
              ×
            </button>
          </div>
        )}

        <div style={styles.statsGrid}>
          <StatCard
            title="Total Requests"
            value={totalRequests}
            icon="📋"
          />

          <StatCard
            title="Pending"
            value={pendingRequests}
            icon="⏳"
          />

          <StatCard
            title="Approved"
            value={approvedRequests}
            icon="✓"
          />

          <StatCard
            title="Converted to PO"
            value={convertedRequests}
            icon="📦"
          />
        </div>

        <div style={styles.filterCard}>
          <div style={styles.searchContainer}>
            <label style={styles.label}>Search</label>

            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search request number, vendor ID or description"
              style={styles.input}
            />
          </div>

          <div style={styles.filterContainer}>
            <label style={styles.label}>Status</label>

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value)
              }
              style={styles.input}
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="converted">Converted</option>
              <option value="converted_to_po">Converted to PO</option>
            </select>
          </div>

          <button
            type="button"
            onClick={loadRequests}
            style={styles.refreshButton}
          >
            ↻ Refresh
          </button>
        </div>

        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <div>
              <h2 style={styles.cardTitle}>
                Procurement Request Records
              </h2>

              <p style={styles.cardSubtitle}>
                Showing {filteredRequests.length} of {requests.length} requests
              </p>
            </div>
          </div>

          {loading ? (
            <div style={styles.centerMessage}>
              <div style={styles.spinner}>⟳</div>
              <p>Loading procurement requests...</p>
            </div>
          ) : filteredRequests.length === 0 ? (
            <div style={styles.emptyState}>
              <div style={styles.emptyIcon}>📋</div>

              <h3 style={styles.emptyTitle}>
                No procurement requests found
              </h3>

              <p style={styles.emptyText}>
                Create a procurement request to see it here.
              </p>

              {isProcurementManager && (
                <button
                  type="button"
                  onClick={openCreateModal}
                  style={styles.primaryButton}
                >
                  + Create Request
                </button>
              )}
            </div>
          ) : (
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Request No.</th>
                    <th style={styles.th}>Vendor ID</th>
                    <th style={styles.th}>Description</th>
                    <th style={styles.th}>Quantity</th>
                    <th style={styles.th}>Estimated Amount</th>
                    <th style={styles.th}>Status</th>
                    <th style={styles.th}>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredRequests.map((request) => {
                    const status = getStatus(request);

                    const hasPO =
                      request.purchase_order ||
                      request.po ||
                      request.purchaseOrder ||
                      request.po_number ||
                      request.purchase_order_number;

                    return (
                      <tr
                        key={
                          request.id ||
                          request.request_number ||
                          `${request.vendor_id}-${request.description}`
                        }
                        style={styles.tr}
                      >
                        <td style={styles.td}>
                          <strong>
                            {request.request_number ||
                              `PR-${request.id || "N/A"}`}
                          </strong>
                        </td>

                        <td style={styles.td}>
                          {request.vendor_id || "-"}
                        </td>

                        <td style={styles.td}>
                          <div style={styles.descriptionCell}>
                            {request.description || "-"}
                          </div>
                        </td>

                        <td style={styles.td}>
                          {request.quantity || 0}
                        </td>

                        <td style={styles.td}>
                          {formatAmount(
                            request.estimated_amount
                          )}
                        </td>

                        <td style={styles.td}>
                          <StatusBadge status={status} />
                        </td>

                        <td style={styles.td}>
                          <div style={styles.actions}>
                            {isProcurementManager &&
                              status === "pending" && (
                                <>
                                  <ActionButton
                                    text="Edit"
                                    onClick={() =>
                                      openEditModal(request)
                                    }
                                  />

                                  <ActionButton
                                    text="Delete"
                                    danger
                                    onClick={() =>
                                      handleDelete(request)
                                    }
                                  />
                                </>
                              )}

                            {isAdmin && status === "pending" && (
                              <>
                                <ActionButton
                                  text="Approve"
                                  success
                                  onClick={() =>
                                    handleApprove(request)
                                  }
                                />

                                <ActionButton
                                  text="Reject"
                                  danger
                                  onClick={() =>
                                    handleReject(request)
                                  }
                                />
                              </>
                            )}

                            {isProcurementManager &&
                              status === "approved" && (
                                <ActionButton
                                  text="Convert to PO"
                                  primary
                                  onClick={() =>
                                    openConvertModal(request)
                                  }
                                />
                              )}

                            {(status === "converted" ||
                              status === "converted_to_po" ||
                              hasPO) && (
                              <ActionButton
                                text="View PO"
                                primary
                                onClick={() =>
                                  openExistingPO(request)
                                }
                              />
                            )}

                            {status === "rejected" && (
                              <span style={styles.rejectedText}>
                                Rejected
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <div>
                <h2 style={styles.modalTitle}>
                  {editingRequest
                    ? "Edit Procurement Request"
                    : "Create Procurement Request"}
                </h2>

                <p style={styles.modalSubtitle}>
                  Enter procurement request details.
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                style={styles.modalClose}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div style={styles.formGrid}>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>
                    Vendor ID
                  </label>

                  <input
                    type="number"
                    name="vendor_id"
                    value={form.vendor_id}
                    onChange={handleFormChange}
                    placeholder="Enter vendor ID"
                    style={styles.formInput}
                  />

                  <small style={styles.helperText}>
                    Enter the numeric vendor ID used by the database.
                  </small>
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>
                    Description{" "}
                    <span style={styles.required}>*</span>
                  </label>

                  <input
                    type="text"
                    name="description"
                    value={form.description}
                    onChange={handleFormChange}
                    placeholder="Enter material or service description"
                    style={styles.formInput}
                    required
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>
                    Quantity{" "}
                    <span style={styles.required}>*</span>
                  </label>

                  <input
                    type="number"
                    name="quantity"
                    value={form.quantity}
                    onChange={handleFormChange}
                    min="1"
                    step="1"
                    style={styles.formInput}
                    required
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>
                    Estimated Amount{" "}
                    <span style={styles.required}>*</span>
                  </label>

                  <input
                    type="number"
                    name="estimated_amount"
                    value={form.estimated_amount}
                    onChange={handleFormChange}
                    min="0"
                    step="0.01"
                    placeholder="Enter estimated amount"
                    style={styles.formInput}
                    required
                  />
                </div>
              </div>

              <div style={styles.modalFooter}>
                <button
                  type="button"
                  onClick={closeModal}
                  style={styles.cancelButton}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  style={styles.primaryButton}
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : editingRequest
                    ? "Update Request"
                    : "Create Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showConvertModal && convertingRequest && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <div>
                <h2 style={styles.modalTitle}>
                  Convert to Purchase Order
                </h2>

                <p style={styles.modalSubtitle}>
                  Convert the approved procurement request into a purchase
                  order.
                </p>
              </div>

              <button
                type="button"
                onClick={closeConvertModal}
                style={styles.modalClose}
              >
                ×
              </button>
            </div>

            <div style={styles.convertInfo}>
              <div>
                <strong>Request:</strong>{" "}
                {convertingRequest.request_number ||
                  `PR-${convertingRequest.id}`}
              </div>

              <div>
                <strong>Vendor ID:</strong>{" "}
                {convertingRequest.vendor_id || "-"}
              </div>

              <div>
                <strong>Description:</strong>{" "}
                {convertingRequest.description || "-"}
              </div>

              <div>
                <strong>Quantity:</strong>{" "}
                {convertingRequest.quantity || 0}
              </div>

              <div>
                <strong>Estimated Amount:</strong>{" "}
                {formatAmount(
                  convertingRequest.estimated_amount
                )}
              </div>
            </div>

            <form onSubmit={handleConvertToPO}>
              <div style={styles.formGrid}>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>
                    Expected Delivery Date{" "}
                    <span style={styles.required}>*</span>
                  </label>

                  <input
                    type="date"
                    name="expected_delivery_date"
                    value={convertForm.expected_delivery_date}
                    onChange={handleConvertChange}
                    min={new Date().toISOString().split("T")[0]}
                    style={styles.formInput}
                    required
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>
                    Total Amount{" "}
                    <span style={styles.required}>*</span>
                  </label>

                  <input
                    type="number"
                    name="total_amount"
                    value={convertForm.total_amount}
                    onChange={handleConvertChange}
                    min="0"
                    step="0.01"
                    style={styles.formInput}
                    required
                  />
                </div>
              </div>

              <div style={styles.modalFooter}>
                <button
                  type="button"
                  onClick={closeConvertModal}
                  style={styles.cancelButton}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  style={styles.primaryButton}
                  disabled={saving}
                >
                  {saving ? "Creating PO..." : "Create Purchase Order"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPOModal && selectedPO && (
        <div style={styles.overlay}>
          <div style={styles.poModal}>
            <div style={styles.modalHeader}>
              <div>
                <h2 style={styles.modalTitle}>
                  Purchase Order Details
                </h2>

                <p style={styles.modalSubtitle}>
                  Complete details of the purchase order created from this
                  procurement request.
                </p>
              </div>

              <button
                type="button"
                onClick={closePOModal}
                style={styles.modalClose}
              >
                ×
              </button>
            </div>

            <div style={styles.poDetails}>
              <PODetail
                label="PO Number"
                value={
                  selectedPO.po_number ||
                  selectedPO.purchase_order_number ||
                  selectedPO.number ||
                  "PO not available"
                }
              />

              <PODetail
                label="Procurement Request"
                value={
                  selectedPO.request_number ||
                  selectedPO.procurement_request_number ||
                  selectedPO.procurement_request_id ||
                  "-"
                }
              />

              <PODetail
                label="Vendor ID"
                value={selectedPO.vendor_id || "-"}
              />

              <PODetail
                label="Description"
                value={selectedPO.description || "-"}
              />

              <PODetail
                label="Quantity"
                value={selectedPO.quantity || "-"}
              />

              <PODetail
                label="Total Amount"
                value={formatAmount(
                  selectedPO.total_amount ||
                    selectedPO.amount ||
                    selectedPO.estimated_amount
                )}
              />

              <PODetail
                label="Expected Delivery Date"
                value={
                  selectedPO.expected_delivery_date ||
                  selectedPO.expectedDeliveryDate ||
                  "-"
                }
              />

              <PODetail
                label="PO Status"
                value={
                  selectedPO.status ||
                  selectedPO.po_status ||
                  "Created"
                }
              />

              <PODetail
                label="Approval Status"
                value={
                  selectedPO.approval_status ||
                  selectedPO.approvalStatus ||
                  "Pending"
                }
              />

              <PODetail
                label="Created Date"
                value={
                  selectedPO.created_at ||
                  selectedPO.created_date ||
                  selectedPO.createdAt ||
                  "-"
                }
              />

              <PODetail
                label="Purchase Order ID"
                value={
                  selectedPO.id ||
                  selectedPO.purchase_order_id ||
                  "-"
                }
              />
            </div>

            <div style={styles.modalFooter}>
              <button
                type="button"
                onClick={closePOModal}
                style={styles.primaryButton}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PODetail({ label, value }) {
  return (
    <div style={styles.poDetailItem}>
      <div style={styles.poDetailLabel}>{label}</div>

      <div style={styles.poDetailValue}>
        {value !== null && value !== undefined && value !== ""
          ? String(value)
          : "-"}
      </div>
    </div>
  );
}

function StatCard({ title, value, icon }) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statIcon}>{icon}</div>

      <div>
        <p style={styles.statTitle}>{title}</p>
        <h3 style={styles.statValue}>{value}</h3>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const normalizedStatus = String(
    status || "pending"
  ).toLowerCase();

  let background = "#f3f4f6";
  let color = "#374151";

  if (normalizedStatus === "pending") {
    background = "#fff7ed";
    color = "#c2410c";
  }

  if (normalizedStatus === "approved") {
    background = "#ecfdf5";
    color = "#047857";
  }

  if (normalizedStatus === "rejected") {
    background = "#fef2f2";
    color = "#b91c1c";
  }

  if (
    normalizedStatus === "converted" ||
    normalizedStatus === "converted_to_po"
  ) {
    background = "#eff6ff";
    color = "#1d4ed8";
  }

  const displayStatus =
    normalizedStatus === "converted_to_po"
      ? "Converted to PO"
      : normalizedStatus.charAt(0).toUpperCase() +
        normalizedStatus.slice(1);

  return (
    <span
      style={{
        ...styles.statusBadge,
        backgroundColor: background,
        color,
      }}
    >
      {displayStatus}
    </span>
  );
}

function ActionButton({
  text,
  onClick,
  danger = false,
  success = false,
  primary = false,
}) {
  let background = "#f3f4f6";
  let color = "#374151";

  if (danger) {
    background = "#fef2f2";
    color = "#b91c1c";
  }

  if (success) {
    background = "#ecfdf5";
    color = "#047857";
  }

  if (primary) {
    background = "#eff6ff";
    color = "#1d4ed8";
  }

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...styles.actionButton,
        backgroundColor: background,
        color,
      }}
    >
      {text}
    </button>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    backgroundColor: "#f8fafc",
    padding: "30px",
    boxSizing: "border-box",
    fontFamily:
      "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
  },

  container: {
    maxWidth: "1450px",
    margin: "0 auto",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "20px",
    marginBottom: "25px",
  },

  title: {
    margin: 0,
    fontSize: "30px",
    fontWeight: "700",
    color: "#111827",
  },

  subtitle: {
    margin: "8px 0 0",
    color: "#6b7280",
    fontSize: "15px",
  },

  primaryButton: {
    border: "none",
    borderRadius: "8px",
    padding: "12px 18px",
    backgroundColor: "#2563eb",
    color: "#ffffff",
    fontWeight: "600",
    fontSize: "14px",
    cursor: "pointer",
  },

  errorBox: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "14px 16px",
    marginBottom: "15px",
    borderRadius: "8px",
    backgroundColor: "#fef2f2",
    color: "#b91c1c",
    border: "1px solid #fecaca",
  },

  successBox: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "14px 16px",
    marginBottom: "15px",
    borderRadius: "8px",
    backgroundColor: "#ecfdf5",
    color: "#047857",
    border: "1px solid #a7f3d0",
  },

  closeMessageButton: {
    border: "none",
    background: "transparent",
    color: "inherit",
    fontSize: "20px",
    cursor: "pointer",
  },

  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: "18px",
    marginBottom: "22px",
  },

  statCard: {
    backgroundColor: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "12px",
    padding: "20px",
    display: "flex",
    alignItems: "center",
    gap: "15px",
    boxShadow: "0 2px 8px rgba(15, 23, 42, 0.04)",
  },

  statIcon: {
    width: "45px",
    height: "45px",
    borderRadius: "10px",
    backgroundColor: "#eff6ff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "20px",
  },

  statTitle: {
    margin: 0,
    color: "#6b7280",
    fontSize: "13px",
  },

  statValue: {
    margin: "5px 0 0",
    color: "#111827",
    fontSize: "24px",
  },

  filterCard: {
    backgroundColor: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "12px",
    padding: "18px",
    display: "flex",
    alignItems: "flex-end",
    gap: "18px",
    marginBottom: "22px",
  },

  searchContainer: {
    flex: 1,
  },

  filterContainer: {
    width: "220px",
  },

  label: {
    display: "block",
    marginBottom: "7px",
    fontSize: "13px",
    fontWeight: "600",
    color: "#374151",
  },

  input: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #d1d5db",
    borderRadius: "8px",
    padding: "11px 12px",
    fontSize: "14px",
    outline: "none",
    backgroundColor: "#ffffff",
  },

  refreshButton: {
    border: "1px solid #d1d5db",
    borderRadius: "8px",
    padding: "11px 16px",
    backgroundColor: "#ffffff",
    color: "#374151",
    fontWeight: "600",
    cursor: "pointer",
  },

  card: {
    backgroundColor: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "12px",
    overflow: "hidden",
    boxShadow: "0 2px 8px rgba(15, 23, 42, 0.04)",
  },

  cardHeader: {
    padding: "20px",
    borderBottom: "1px solid #e5e7eb",
  },

  cardTitle: {
    margin: 0,
    fontSize: "18px",
    color: "#111827",
  },

  cardSubtitle: {
    margin: "5px 0 0",
    color: "#6b7280",
    fontSize: "13px",
  },

  tableWrapper: {
    width: "100%",
    overflowX: "auto",
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: "1100px",
  },

  th: {
    textAlign: "left",
    padding: "14px 16px",
    backgroundColor: "#f8fafc",
    color: "#475569",
    fontSize: "12px",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: "0.03em",
    borderBottom: "1px solid #e5e7eb",
    whiteSpace: "nowrap",
  },

  td: {
    padding: "15px 16px",
    borderBottom: "1px solid #f1f5f9",
    color: "#374151",
    fontSize: "14px",
    verticalAlign: "middle",
  },

  tr: {
    backgroundColor: "#ffffff",
  },

  descriptionCell: {
    maxWidth: "350px",
    lineHeight: "1.5",
  },

  actions: {
    display: "flex",
    alignItems: "center",
    gap: "7px",
    flexWrap: "wrap",
  },

  actionButton: {
    border: "none",
    borderRadius: "6px",
    padding: "7px 10px",
    fontSize: "12px",
    fontWeight: "600",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },

  statusBadge: {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: "20px",
    padding: "6px 10px",
    fontSize: "12px",
    fontWeight: "700",
    whiteSpace: "nowrap",
  },

  rejectedText: {
    color: "#b91c1c",
    fontSize: "12px",
    fontWeight: "600",
  },

  centerMessage: {
    minHeight: "300px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    color: "#6b7280",
  },

  spinner: {
    fontSize: "30px",
    marginBottom: "10px",
  },

  emptyState: {
    minHeight: "330px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "30px",
    textAlign: "center",
  },

  emptyIcon: {
    fontSize: "45px",
    marginBottom: "10px",
  },

  emptyTitle: {
    margin: "5px 0",
    color: "#111827",
  },

  emptyText: {
    margin: "5px 0 20px",
    color: "#6b7280",
  },

  overlay: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
    zIndex: 1000,
  },

  modal: {
    width: "100%",
    maxWidth: "650px",
    maxHeight: "90vh",
    overflowY: "auto",
    backgroundColor: "#ffffff",
    borderRadius: "14px",
    boxShadow: "0 20px 50px rgba(0, 0, 0, 0.2)",
  },

  poModal: {
    width: "100%",
    maxWidth: "800px",
    maxHeight: "90vh",
    overflowY: "auto",
    backgroundColor: "#ffffff",
    borderRadius: "14px",
    boxShadow: "0 20px 50px rgba(0, 0, 0, 0.2)",
  },

  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: "22px",
    borderBottom: "1px solid #e5e7eb",
  },

  modalTitle: {
    margin: 0,
    color: "#111827",
    fontSize: "21px",
  },

  modalSubtitle: {
    margin: "6px 0 0",
    color: "#6b7280",
    fontSize: "13px",
  },

  modalClose: {
    border: "none",
    background: "transparent",
    color: "#6b7280",
    fontSize: "28px",
    lineHeight: "1",
    cursor: "pointer",
  },

  formGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "18px",
    padding: "22px",
  },

  formGroup: {
    display: "flex",
    flexDirection: "column",
  },

  formLabel: {
    marginBottom: "7px",
    fontSize: "13px",
    fontWeight: "600",
    color: "#374151",
  },

  required: {
    color: "#dc2626",
  },

  formInput: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #d1d5db",
    borderRadius: "8px",
    padding: "11px 12px",
    fontSize: "14px",
    outline: "none",
    backgroundColor: "#ffffff",
  },

  helperText: {
    marginTop: "5px",
    color: "#6b7280",
    fontSize: "11px",
  },

  modalFooter: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "10px",
    padding: "18px 22px",
    borderTop: "1px solid #e5e7eb",
  },

  cancelButton: {
    border: "1px solid #d1d5db",
    borderRadius: "8px",
    padding: "11px 17px",
    backgroundColor: "#ffffff",
    color: "#374151",
    fontWeight: "600",
    cursor: "pointer",
  },

  convertInfo: {
    margin: "20px 22px 0",
    padding: "15px",
    borderRadius: "8px",
    backgroundColor: "#f8fafc",
    color: "#475569",
    fontSize: "13px",
    lineHeight: "1.8",
  },

  poDetails: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "15px",
    padding: "22px",
  },

  poDetailItem: {
    border: "1px solid #e5e7eb",
    borderRadius: "9px",
    padding: "15px",
    backgroundColor: "#f8fafc",
  },

  poDetailLabel: {
    fontSize: "12px",
    fontWeight: "600",
    color: "#6b7280",
    marginBottom: "6px",
    textTransform: "uppercase",
  },

  poDetailValue: {
    fontSize: "15px",
    fontWeight: "600",
    color: "#111827",
    wordBreak: "break-word",
  },
};