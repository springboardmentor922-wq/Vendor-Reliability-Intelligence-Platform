import React, { useEffect, useMemo, useState } from "react";

import {
  getProcurementRequests,
  createProcurementRequest,
  updateProcurementRequest,
  approveProcurementRequest,
  rejectProcurementRequest,
  convertProcurementRequest,
  deleteProcurementRequest,
} from "../services/procurementService";

const ProcurementManagement = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [editingRequest, setEditingRequest] = useState(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [formData, setFormData] = useState({
    vendor_id: "",
    description: "",
    quantity: 1,
    estimated_amount: "",
  });

  const [message, setMessage] = useState({
    type: "",
    text: "",
  });

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    try {
      setLoading(true);

      const data = await getProcurementRequests();

      setRequests(data);
    } catch (error) {
      showMessage("error", error.message);
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (type, text) => {
    setMessage({
      type,
      text,
    });

    setTimeout(() => {
      setMessage({
        type: "",
        text: "",
      });
    }, 3000);
  };

  const resetForm = () => {
    setFormData({
      vendor_id: "",
      description: "",
      quantity: 1,
      estimated_amount: "",
    });

    setEditingRequest(null);
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (request) => {
    setEditingRequest(request);

    setFormData({
      vendor_id: request.vendor_id || "",
      description: request.description || "",
      quantity: request.quantity || 1,
      estimated_amount: request.estimated_amount || "",
    });

    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    resetForm();
  };

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!formData.description.trim()) {
      showMessage("error", "Please enter a description.");
      return;
    }

    if (Number(formData.quantity) <= 0) {
      showMessage("error", "Quantity must be greater than zero.");
      return;
    }

    if (Number(formData.estimated_amount) < 0) {
      showMessage("error", "Estimated amount cannot be negative.");
      return;
    }

    try {
      const payload = {
        vendor_id:
          formData.vendor_id === ""
            ? null
            : Number(formData.vendor_id),

        description: formData.description.trim(),

        quantity: Number(formData.quantity),

        estimated_amount: Number(formData.estimated_amount),
      };

      if (editingRequest) {
        await updateProcurementRequest(editingRequest.id, payload);

        showMessage(
          "success",
          "Procurement request updated successfully."
        );
      } else {
        await createProcurementRequest(payload);

        showMessage(
          "success",
          "Procurement request created successfully."
        );
      }

      closeModal();
      loadRequests();
    } catch (error) {
      showMessage("error", error.message);
    }
  };

  const handleApprove = async (id) => {
    if (!window.confirm("Approve this procurement request?")) {
      return;
    }

    try {
      await approveProcurementRequest(id);

      showMessage("success", "Procurement request approved.");

      loadRequests();
    } catch (error) {
      showMessage("error", error.message);
    }
  };

  const handleReject = async (id) => {
    if (!window.confirm("Reject this procurement request?")) {
      return;
    }

    try {
      await rejectProcurementRequest(id);

      showMessage("success", "Procurement request rejected.");

      loadRequests();
    } catch (error) {
      showMessage("error", error.message);
    }
  };

  const handleConvert = async (id) => {
    if (!window.confirm("Mark this request as converted?")) {
      return;
    }

    try {
      await convertProcurementRequest(id);

      showMessage(
        "success",
        "Procurement request marked as converted."
      );

      loadRequests();
    } catch (error) {
      showMessage("error", error.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this procurement request?")) {
      return;
    }

    try {
      await deleteProcurementRequest(id);

      showMessage(
        "success",
        "Procurement request deleted successfully."
      );

      loadRequests();
    } catch (error) {
      showMessage("error", error.message);
    }
  };

  const filteredRequests = useMemo(() => {
    return requests.filter((request) => {
      const searchText = search.toLowerCase();

      const matchesSearch =
        request.request_number
          ?.toLowerCase()
          .includes(searchText) ||
        request.description
          ?.toLowerCase()
          .includes(searchText);

      const matchesStatus =
        statusFilter === "all" ||
        request.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [requests, search, statusFilter]);

  const totalRequests = requests.length;

  const pendingRequests = requests.filter(
    (request) => request.status === "pending"
  ).length;

  const approvedRequests = requests.filter(
    (request) => request.status === "approved"
  ).length;

  const rejectedRequests = requests.filter(
    (request) => request.status === "rejected"
  ).length;

  const convertedRequests = requests.filter(
    (request) => request.status === "converted"
  ).length;

  const getStatusClass = (status) => {
    switch (status) {
      case "pending":
        return "status pending";

      case "approved":
        return "status approved";

      case "rejected":
        return "status rejected";

      case "converted":
        return "status converted";

      default:
        return "status";
    }
  };

  return (
    <div className="procurement-page">

      {/* Header */}
      <div className="procurement-header">
        <div>
          <h1>Procurement Management</h1>

          <p>
            Manage procurement requests, approvals and purchasing
            activities.
          </p>
        </div>

        <button
          className="primary-button"
          onClick={openCreateModal}
        >
          + New Procurement Request
        </button>
      </div>

      {/* Message */}
      {message.text && (
        <div
          className={`alert ${
            message.type === "error"
              ? "alert-error"
              : "alert-success"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Statistics */}
      <div className="procurement-stats">

        <div className="stat-card">
          <div className="stat-icon">📋</div>

          <div>
            <span>Total Requests</span>
            <strong>{totalRequests}</strong>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">⏳</div>

          <div>
            <span>Pending</span>
            <strong>{pendingRequests}</strong>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">✓</div>

          <div>
            <span>Approved</span>
            <strong>{approvedRequests}</strong>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">✕</div>

          <div>
            <span>Rejected</span>
            <strong>{rejectedRequests}</strong>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">↗</div>

          <div>
            <span>Converted</span>
            <strong>{convertedRequests}</strong>
          </div>
        </div>

      </div>

      {/* Main Card */}
      <div className="procurement-card">

        {/* Toolbar */}
        <div className="procurement-toolbar">

          <div className="search-box">
            🔍
            <input
              type="text"
              placeholder="Search request number or description..."
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
            />
          </div>

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value)
            }
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="converted">Converted</option>
          </select>

          <button
            className="refresh-button"
            onClick={loadRequests}
          >
            ↻ Refresh
          </button>

        </div>

        {/* Table */}
        {loading ? (
          <div className="loading-state">
            Loading procurement requests...
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="empty-state">

            <div className="empty-icon">
              📋
            </div>

            <h3>No procurement requests found</h3>

            <p>
              Create a new procurement request to get started.
            </p>

            <button
              className="primary-button"
              onClick={openCreateModal}
            >
              + Create Request
            </button>

          </div>
        ) : (
          <div className="table-wrapper">

            <table className="procurement-table">

              <thead>
                <tr>
                  <th>Request No.</th>
                  <th>Description</th>
                  <th>Vendor ID</th>
                  <th>Quantity</th>
                  <th>Estimated Amount</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>

                {filteredRequests.map((request) => (
                  <tr key={request.id}>

                    <td>
                      <strong>
                        {request.request_number}
                      </strong>
                    </td>

                    <td>
                      <div className="description-cell">
                        {request.description}
                      </div>
                    </td>

                    <td>
                      {request.vendor_id
                        ? `Vendor #${request.vendor_id}`
                        : "Not assigned"}
                    </td>

                    <td>
                      {request.quantity}
                    </td>

                    <td>
                      ₹
                      {Number(
                        request.estimated_amount || 0
                      ).toLocaleString("en-IN")}
                    </td>

                    <td>
                      <span
                        className={getStatusClass(
                          request.status
                        )}
                      >
                        {request.status}
                      </span>
                    </td>

                    <td>
                      {request.created_at
                        ? new Date(
                            request.created_at
                          ).toLocaleDateString("en-IN")
                        : "-"}
                    </td>

                    <td>

                      <div className="action-buttons">

                        {request.status === "pending" && (
                          <>
                            <button
                              className="action edit"
                              onClick={() =>
                                openEditModal(request)
                              }
                              title="Edit"
                            >
                              ✎
                            </button>

                            <button
                              className="action approve"
                              onClick={() =>
                                handleApprove(request.id)
                              }
                              title="Approve"
                            >
                              ✓
                            </button>

                            <button
                              className="action reject"
                              onClick={() =>
                                handleReject(request.id)
                              }
                              title="Reject"
                            >
                              ✕
                            </button>
                          </>
                        )}

                        {request.status === "approved" && (
                          <button
                            className="action convert"
                            onClick={() =>
                              handleConvert(request.id)
                            }
                            title="Convert"
                          >
                            ↗
                          </button>
                        )}

                        {(request.status === "pending" ||
                          request.status === "rejected") && (
                          <button
                            className="action delete"
                            onClick={() =>
                              handleDelete(request.id)
                            }
                            title="Delete"
                          >
                            🗑
                          </button>
                        )}

                      </div>

                    </td>

                  </tr>
                ))}

              </tbody>

            </table>

          </div>
        )}

      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div
          className="modal-overlay"
          onClick={closeModal}
        >

          <div
            className="procurement-modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >

            <div className="modal-header">

              <div>
                <h2>
                  {editingRequest
                    ? "Edit Procurement Request"
                    : "New Procurement Request"}
                </h2>

                <p>
                  Enter the procurement requirement details.
                </p>
              </div>

              <button
                className="close-button"
                onClick={closeModal}
              >
                ×
              </button>

            </div>

            <form onSubmit={handleSubmit}>

              <div className="form-group">

                <label>
                  Vendor ID
                </label>

                <input
                  type="number"
                  name="vendor_id"
                  placeholder="Enter vendor ID"
                  value={formData.vendor_id}
                  onChange={handleChange}
                  min="1"
                />

                <small>
                  Leave empty if vendor has not been assigned.
                </small>

              </div>

              <div className="form-group">

                <label>
                  Description *
                </label>

                <textarea
                  name="description"
                  placeholder="Describe the procurement requirement..."
                  value={formData.description}
                  onChange={handleChange}
                  rows="4"
                  required
                />

              </div>

              <div className="form-row">

                <div className="form-group">

                  <label>
                    Quantity *
                  </label>

                  <input
                    type="number"
                    name="quantity"
                    min="1"
                    value={formData.quantity}
                    onChange={handleChange}
                    required
                  />

                </div>

                <div className="form-group">

                  <label>
                    Estimated Amount (₹) *
                  </label>

                  <input
                    type="number"
                    name="estimated_amount"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.estimated_amount}
                    onChange={handleChange}
                    required
                  />

                </div>

              </div>

              <div className="modal-actions">

                <button
                  type="button"
                  className="secondary-button"
                  onClick={closeModal}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary-button"
                >
                  {editingRequest
                    ? "Update Request"
                    : "Create Request"}
                </button>

              </div>

            </form>

          </div>

        </div>
      )}

    </div>
  );
};

export default ProcurementManagement;