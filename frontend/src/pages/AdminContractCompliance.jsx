import React, { useEffect, useState } from "react";

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

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body
        ? { "Content-Type": "application/json" }
        : {}),
      ...(token
        ? { Authorization: `Bearer ${token}` }
        : {}),
      ...(options.headers || {}),
    },
  });

  const text = await response.text();

  let data = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {
      detail: text || "Unknown server response",
    };
  }

  if (!response.ok) {
    let errorMessage = "Request failed";

    const detail = data?.detail;
    const message = data?.message;

    if (typeof detail === "string") {
      errorMessage = detail;
    } else if (Array.isArray(detail)) {
      errorMessage = detail
        .map((item) => {
          if (typeof item === "string") {
            return item;
          }

          if (item?.msg) {
            const field =
              Array.isArray(item.loc)
                ? item.loc[item.loc.length - 1]
                : "";

            return field
              ? `${field}: ${item.msg}`
              : item.msg;
          }

          return JSON.stringify(item);
        })
        .join(", ");
    } else if (
      detail &&
      typeof detail === "object"
    ) {
      errorMessage =
        detail.message ||
        detail.msg ||
        detail.error ||
        JSON.stringify(detail);
    } else if (typeof message === "string") {
      errorMessage = message;
    } else if (
      message &&
      typeof message === "object"
    ) {
      errorMessage =
        message.message ||
        message.error ||
        JSON.stringify(message);
    }

    throw new Error(errorMessage);
  }

  return data;
}

function AdminContractCompliance() {
  const [activeTab, setActiveTab] =
    useState("overview");

  const [overview, setOverview] = useState(null);
  const [contracts, setContracts] = useState([]);
  const [compliance, setCompliance] = useState([]);
  const [certifications, setCertifications] =
    useState([]);
  const [vendorDocuments, setVendorDocuments] =
    useState([]);
  const [alerts, setAlerts] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showContractForm, setShowContractForm] =
    useState(false);

  const [showComplianceForm, setShowComplianceForm] =
    useState(false);

  const [showCertificationForm, setShowCertificationForm] =
    useState(false);

  const [showVendorDocumentForm, setShowVendorDocumentForm] =
    useState(false);

  const [editingContract, setEditingContract] =
    useState(null);

  const [editingCompliance, setEditingCompliance] =
    useState(null);

  const [editingCertification, setEditingCertification] =
    useState(null);

  const [editingVendorDocument, setEditingVendorDocument] =
    useState(null);

  const [contractForm, setContractForm] = useState({
    contract_number: "",
    vendor_id: "",
    title: "",
    description: "",
    start_date: "",
    end_date: "",
    contract_value: "",
    status: "draft",
  });

  const [complianceForm, setComplianceForm] =
    useState({
      vendor_id: "",
      document_name: "",
      document_type: "GST Certificate",
      document_number: "",
      issue_date: "",
      expiry_date: "",
      file_name: "",
      file_path: "",
      remarks: "",
    });

  const [certificationForm, setCertificationForm] =
    useState({
      vendor_id: "",
      certification_name: "",
      certification_type: "",
      certificate_number: "",
      issuing_authority: "",
      issue_date: "",
      expiry_date: "",
      file_name: "",
      file_path: "",
      remarks: "",
    });

  const [vendorDocumentForm, setVendorDocumentForm] =
    useState({
      vendor_id: "",
      document_name: "",
      document_type: "",
      description: "",
      file_name: "",
      file_path: "",
      status: "active",
    });

  const loadAllData = async () => {
    try {
      setLoading(true);
      setError("");

      const [
        overviewData,
        contractsData,
        complianceData,
        certificationsData,
        vendorDocumentsData,
        alertsData,
      ] = await Promise.all([
        apiRequest(
          "/contract-compliance/overview"
        ),
        apiRequest(
          "/contract-compliance/contracts"
        ),
        apiRequest(
          "/contract-compliance/compliance"
        ),
        apiRequest(
          "/contract-compliance/certifications"
        ),
        apiRequest(
          "/contract-compliance/vendor-documents"
        ),
        apiRequest(
          "/contract-compliance/alerts"
        ),
      ]);

      setOverview(overviewData);
      setContracts(
        Array.isArray(contractsData)
          ? contractsData
          : []
      );
      setCompliance(
        Array.isArray(complianceData)
          ? complianceData
          : []
      );
      setCertifications(
        Array.isArray(certificationsData)
          ? certificationsData
          : []
      );
      setVendorDocuments(
        Array.isArray(vendorDocumentsData)
          ? vendorDocumentsData
          : []
      );
      setAlerts(alertsData || {});
    } catch (err) {
      console.error(
        "Contract compliance loading error:",
        err
      );

      setError(
        err.message ||
          "Unable to load contract and compliance data"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const showSuccess = (message) => {
    setSuccess(message);

    setTimeout(() => {
      setSuccess("");
    }, 3000);
  };

  const handleContractSubmit = async (event) => {
    event.preventDefault();

    try {
      setError("");

      const payload = {
        contract_number:
          contractForm.contract_number,
        vendor_id: Number(contractForm.vendor_id),
        title: contractForm.title,
        description:
          contractForm.description || null,
        start_date:
          contractForm.start_date || null,
        end_date:
          contractForm.end_date || null,
        contract_value:
          contractForm.contract_value === ""
            ? null
            : Number(contractForm.contract_value),
        
      };

      if (editingContract) {
        await apiRequest(
          `/contract-compliance/contracts/${editingContract.id}`,
          {
            method: "PUT",
            body: JSON.stringify(payload),
          }
        );

        showSuccess(
          "Contract updated successfully"
        );
      } else {
        await apiRequest(
          "/contract-compliance/contracts",
          {
            method: "POST",
            body: JSON.stringify(payload),
          }
        );

        showSuccess(
          "Contract created successfully"
        );
      }

      closeContractForm();
      await loadAllData();
    } catch (err) {
      setError(
        err.message ||
          "Unable to save contract"
      );
    }
  };

  const handleComplianceSubmit = async (event) => {
    event.preventDefault();

    try {
      setError("");

      const payload = {
        vendor_id: Number(complianceForm.vendor_id),
        document_name:
          complianceForm.document_name,
        document_type:
          complianceForm.document_type,
        document_number:
          complianceForm.document_number || null,
        issue_date:
          complianceForm.issue_date || null,
        expiry_date:
          complianceForm.expiry_date || null,
        file_name:
          complianceForm.file_name || null,
        file_path:
          complianceForm.file_path || null,
        remarks:
          complianceForm.remarks || null,
      };

      if (editingCompliance) {
        await apiRequest(
          `/contract-compliance/compliance/${editingCompliance.id}`,
          {
            method: "PUT",
            body: JSON.stringify(payload),
          }
        );

        showSuccess(
          "Compliance document updated successfully"
        );
      } else {
        await apiRequest(
          "/contract-compliance/compliance",
          {
            method: "POST",
            body: JSON.stringify(payload),
          }
        );

        showSuccess(
          "Compliance document created successfully"
        );
      }

      closeComplianceForm();
      await loadAllData();
    } catch (err) {
      setError(
        err.message ||
          "Unable to save compliance document"
      );
    }
  };

  const handleCertificationSubmit = async (
    event
  ) => {
    event.preventDefault();

    try {
      setError("");

      const payload = {
        vendor_id: Number(
          certificationForm.vendor_id
        ),
        certification_name:
          certificationForm.certification_name,
        certification_type:
          certificationForm.certification_type ||
          null,
        certificate_number:
          certificationForm.certificate_number ||
          null,
        issuing_authority:
          certificationForm.issuing_authority ||
          null,
        issue_date:
          certificationForm.issue_date || null,
        expiry_date:
          certificationForm.expiry_date || null,
        file_name:
          certificationForm.file_name || null,
        file_path:
          certificationForm.file_path || null,
        remarks:
          certificationForm.remarks || null,
      };

      if (editingCertification) {
        await apiRequest(
          `/contract-compliance/certifications/${editingCertification.id}`,
          {
            method: "PUT",
            body: JSON.stringify(payload),
          }
        );

        showSuccess(
          "Certification updated successfully"
        );
      } else {
        await apiRequest(
          "/contract-compliance/certifications",
          {
            method: "POST",
            body: JSON.stringify(payload),
          }
        );

        showSuccess(
          "Certification created successfully"
        );
      }

      closeCertificationForm();
      await loadAllData();
    } catch (err) {
      setError(
        err.message ||
          "Unable to save certification"
      );
    }
  };

  const handleVendorDocumentSubmit = async (
    event
  ) => {
    event.preventDefault();

    try {
      setError("");

      const payload = {
        vendor_id: Number(
          vendorDocumentForm.vendor_id
        ),
        document_name:
          vendorDocumentForm.document_name,
        document_type:
          vendorDocumentForm.document_type ||
          null,
        description:
          vendorDocumentForm.description ||
          null,
        file_name:
          vendorDocumentForm.file_name || null,
        file_path:
          vendorDocumentForm.file_path || null,
        status:
          vendorDocumentForm.status,
      };

      if (editingVendorDocument) {
        await apiRequest(
          `/contract-compliance/vendor-documents/${editingVendorDocument.id}`,
          {
            method: "PUT",
            body: JSON.stringify(payload),
          }
        );

        showSuccess(
          "Vendor document updated successfully"
        );
      } else {
        await apiRequest(
          "/contract-compliance/vendor-documents",
          {
            method: "POST",
            body: JSON.stringify(payload),
          }
        );

        showSuccess(
          "Vendor document created successfully"
        );
      }

      closeVendorDocumentForm();
      await loadAllData();
    } catch (err) {
      setError(
        err.message ||
          "Unable to save vendor document"
      );
    }
  };

  const deleteContract = async (id) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this contract?"
      )
    ) {
      return;
    }

    try {
      await apiRequest(
        `/contract-compliance/contracts/${id}`,
        {
          method: "DELETE",
        }
      );

      showSuccess(
        "Contract deleted successfully"
      );

      await loadAllData();
    } catch (err) {
      setError(err.message);
    }
  };

  const deleteCompliance = async (id) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this compliance document?"
      )
    ) {
      return;
    }

    try {
      await apiRequest(
        `/contract-compliance/compliance/${id}`,
        {
          method: "DELETE",
        }
      );

      showSuccess(
        "Compliance document deleted successfully"
      );

      await loadAllData();
    } catch (err) {
      setError(err.message);
    }
  };

  const deleteCertification = async (id) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this certification?"
      )
    ) {
      return;
    }

    try {
      await apiRequest(
        `/contract-compliance/certifications/${id}`,
        {
          method: "DELETE",
        }
      );

      showSuccess(
        "Certification deleted successfully"
      );

      await loadAllData();
    } catch (err) {
      setError(err.message);
    }
  };

  const deleteVendorDocument = async (id) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this vendor document?"
      )
    ) {
      return;
    }

    try {
      await apiRequest(
        `/contract-compliance/vendor-documents/${id}`,
        {
          method: "DELETE",
        }
      );

      showSuccess(
        "Vendor document deleted successfully"
      );

      await loadAllData();
    } catch (err) {
      setError(err.message);
    }
  };

  const verifyCompliance = async (id) => {
    try {
      await apiRequest(
        `/contract-compliance/compliance/${id}/verify`,
        {
          method: "PUT",
        }
      );

      showSuccess(
        "Compliance document verified successfully"
      );

      await loadAllData();
    } catch (err) {
      setError(err.message);
    }
  };

  const rejectCompliance = async (id) => {
    try {
      await apiRequest(
        `/contract-compliance/compliance/${id}/reject`,
        {
          method: "PUT",
        }
      );

      showSuccess(
        "Compliance document rejected"
      );

      await loadAllData();
    } catch (err) {
      setError(err.message);
    }
  };

  const renewContract = async (contract) => {
    const newDate = window.prompt(
      `Enter new end date for ${contract.contract_number} (YYYY-MM-DD):`,
      contract.end_date || ""
    );

    if (!newDate) {
      return;
    }

    try {
      await apiRequest(
        `/contract-compliance/contracts/${contract.id}/renew`,
        {
          method: "PUT",
          body: JSON.stringify({
            new_end_date: newDate,
          }),
        }
      );

      showSuccess(
        "Contract renewed successfully"
      );

      await loadAllData();
    } catch (err) {
      setError(err.message);
    }
  };

  const openContractForm = (contract = null) => {
    setEditingContract(contract);

    if (contract) {
      setContractForm({
        contract_number:
          contract.contract_number || "",
        vendor_id:
          contract.vendor_id || "",
        title: contract.title || "",
        description:
          contract.description || "",
        start_date:
          contract.start_date
            ? contract.start_date.substring(0, 10)
            : "",
        end_date:
          contract.end_date
            ? contract.end_date.substring(0, 10)
            : "",
        contract_value:
          contract.contract_value ?? "",
        status:
          contract.status || "draft",
      });
    } else {
      setContractForm({
        contract_number: "",
        vendor_id: "",
        title: "",
        description: "",
        start_date: "",
        end_date: "",
        contract_value: "",
        status: "draft",
      });
    }

    setShowContractForm(true);
  };

  const closeContractForm = () => {
    setShowContractForm(false);
    setEditingContract(null);
  };

  const openComplianceForm = (
    document = null
  ) => {
    setEditingCompliance(document);

    if (document) {
      setComplianceForm({
        vendor_id:
          document.vendor_id || "",
        document_name:
          document.document_name || "",
        document_type:
          document.document_type ||
          "GST Certificate",
        document_number:
          document.document_number || "",
        issue_date:
          document.issue_date
            ? document.issue_date.substring(0, 10)
            : "",
        expiry_date:
          document.expiry_date
            ? document.expiry_date.substring(0, 10)
            : "",
        file_name:
          document.file_name || "",
        file_path:
          document.file_path || "",
        remarks:
          document.remarks || "",
      });
    } else {
      setComplianceForm({
        vendor_id: "",
        document_name: "",
        document_type:
          "GST Certificate",
        document_number: "",
        issue_date: "",
        expiry_date: "",
        file_name: "",
        file_path: "",
        remarks: "",
      });
    }

    setShowComplianceForm(true);
  };

  const closeComplianceForm = () => {
    setShowComplianceForm(false);
    setEditingCompliance(null);
  };

  const openCertificationForm = (
    certification = null
  ) => {
    setEditingCertification(certification);

    if (certification) {
      setCertificationForm({
        vendor_id:
          certification.vendor_id || "",
        certification_name:
          certification.certification_name || "",
        certification_type:
          certification.certification_type || "",
        certificate_number:
          certification.certificate_number || "",
        issuing_authority:
          certification.issuing_authority || "",
        issue_date:
          certification.issue_date
            ? certification.issue_date.substring(0, 10)
            : "",
        expiry_date:
          certification.expiry_date
            ? certification.expiry_date.substring(0, 10)
            : "",
        file_name:
          certification.file_name || "",
        file_path:
          certification.file_path || "",
        remarks:
          certification.remarks || "",
      });
    } else {
      setCertificationForm({
        vendor_id: "",
        certification_name: "",
        certification_type: "",
        certificate_number: "",
        issuing_authority: "",
        issue_date: "",
        expiry_date: "",
        file_name: "",
        file_path: "",
        remarks: "",
      });
    }

    setShowCertificationForm(true);
  };

  const closeCertificationForm = () => {
    setShowCertificationForm(false);
    setEditingCertification(null);
  };

  const openVendorDocumentForm = (
    document = null
  ) => {
    setEditingVendorDocument(document);

    if (document) {
      setVendorDocumentForm({
        vendor_id:
          document.vendor_id || "",
        document_name:
          document.document_name || "",
        document_type:
          document.document_type || "",
        description:
          document.description || "",
        file_name:
          document.file_name || "",
        file_path:
          document.file_path || "",
        status:
          document.status || "active",
      });
    } else {
      setVendorDocumentForm({
        vendor_id: "",
        document_name: "",
        document_type: "",
        description: "",
        file_name: "",
        file_path: "",
        status: "active",
      });
    }

    setShowVendorDocumentForm(true);
  };

  const closeVendorDocumentForm = () => {
    setShowVendorDocumentForm(false);
    setEditingVendorDocument(null);
  };

  const formatDate = (date) => {
    if (!date) return "—";

    return new Date(date).toLocaleDateString(
      "en-GB",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }
    );
  };

  const formatCurrency = (value) => {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return "—";
    }

    return `₹${Number(value).toLocaleString(
      "en-IN"
    )}`;
  };

  const getStatusStyle = (value) => {
    const statusValue =
      value?.toLowerCase();

    if (
      statusValue === "active" ||
      statusValue === "valid" ||
      statusValue === "verified"
    ) {
      return {
        background: "#e8f7ee",
        color: "#16803c",
      };
    }

    if (
      statusValue === "expired" ||
      statusValue === "rejected" ||
      statusValue === "terminated"
    ) {
      return {
        background: "#ffeaea",
        color: "#c62828",
      };
    }

    if (
      statusValue === "expiring" ||
      statusValue === "pending"
    ) {
      return {
        background: "#fff4df",
        color: "#b26a00",
      };
    }

    return {
      background: "#eeeeee",
      color: "#555",
    };
  };

  if (loading) {
    return (
      <div style={page}>
        <div style={loadingBox}>
          Loading Contract & Compliance Management...
        </div>
      </div>
    );
  }

  return (
    <div style={page}>
      <div style={pageHeader}>
        <div>
          <div style={eyebrow}>
            ADMINISTRATOR MANAGEMENT
          </div>

          <h1 style={pageTitle}>
            Contract & Compliance
          </h1>

          <p style={pageSubtitle}>
            Manage vendor contracts, compliance
            documents, certifications and vendor
            records.
          </p>
        </div>

        <button
          style={refreshButton}
          onClick={loadAllData}
        >
          ↻ Refresh
        </button>
      </div>

      {error && (
        <div style={errorBanner}>
          <strong>Error:</strong> {error}

          <button
            style={closeMessage}
            onClick={() => setError("")}
          >
            ×
          </button>
        </div>
      )}

      {success && (
        <div style={successBanner}>
          ✓ {success}
        </div>
      )}

      <div style={tabs}>
        <TabButton
          active={activeTab === "overview"}
          onClick={() =>
            setActiveTab("overview")
          }
        >
          Overview
        </TabButton>

        <TabButton
          active={activeTab === "contracts"}
          onClick={() =>
            setActiveTab("contracts")
          }
        >
          Contracts
        </TabButton>

        <TabButton
          active={activeTab === "compliance"}
          onClick={() =>
            setActiveTab("compliance")
          }
        >
          Compliance
        </TabButton>

        <TabButton
          active={activeTab === "certifications"}
          onClick={() =>
            setActiveTab("certifications")
          }
        >
          Certifications
        </TabButton>

        <TabButton
          active={activeTab === "documents"}
          onClick={() =>
            setActiveTab("documents")
          }
        >
          Vendor Documents
        </TabButton>

        <TabButton
          active={activeTab === "alerts"}
          onClick={() =>
            setActiveTab("alerts")
          }
        >
          Alerts
        </TabButton>
      </div>

      {activeTab === "overview" && (
        <OverviewSection
          overview={overview}
          alerts={alerts}
        />
      )}

      {activeTab === "contracts" && (
        <ContractsSection
          contracts={contracts}
          onAdd={() =>
            openContractForm()
          }
          onEdit={openContractForm}
          onDelete={deleteContract}
          onRenew={renewContract}
          formatDate={formatDate}
          formatCurrency={formatCurrency}
          getStatusStyle={getStatusStyle}
        />
      )}

      {activeTab === "compliance" && (
        <ComplianceSection
          compliance={compliance}
          onAdd={() =>
            openComplianceForm()
          }
          onEdit={openComplianceForm}
          onDelete={deleteCompliance}
          onVerify={verifyCompliance}
          onReject={rejectCompliance}
          formatDate={formatDate}
          getStatusStyle={getStatusStyle}
        />
      )}

      {activeTab === "certifications" && (
        <CertificationsSection
          certifications={certifications}
          onAdd={() =>
            openCertificationForm()
          }
          onEdit={openCertificationForm}
          onDelete={deleteCertification}
          formatDate={formatDate}
          getStatusStyle={getStatusStyle}
        />
      )}

      {activeTab === "documents" && (
        <VendorDocumentsSection
          documents={vendorDocuments}
          onAdd={() =>
            openVendorDocumentForm()
          }
          onEdit={openVendorDocumentForm}
          onDelete={deleteVendorDocument}
          formatDate={formatDate}
          getStatusStyle={getStatusStyle}
        />
      )}

      {activeTab === "alerts" && (
        <AlertsSection
          alerts={alerts}
          formatDate={formatDate}
        />
      )}

      {showContractForm && (
        <Modal
          title={
            editingContract
              ? "Edit Contract"
              : "Add Contract"
          }
          onClose={closeContractForm}
        >
          <form onSubmit={handleContractSubmit}>
            <div style={formGrid}>
              <Input
                label="Contract Number *"
                value={
                  contractForm.contract_number
                }
                onChange={(value) =>
                  setContractForm({
                    ...contractForm,
                    contract_number: value,
                  })
                }
                required
              />

              <Input
                label="Vendor ID *"
                type="number"
                value={
                  contractForm.vendor_id
                }
                onChange={(value) =>
                  setContractForm({
                    ...contractForm,
                    vendor_id: value,
                  })
                }
                required
              />

              <Input
                label="Contract Title *"
                value={contractForm.title}
                onChange={(value) =>
                  setContractForm({
                    ...contractForm,
                    title: value,
                  })
                }
                required
              />

              <Input
                label="Contract Value"
                type="number"
                value={
                  contractForm.contract_value
                }
                onChange={(value) =>
                  setContractForm({
                    ...contractForm,
                    contract_value: value,
                  })
                }
              />

              <Input
                label="Start Date"
                type="date"
                value={
                  contractForm.start_date
                }
                onChange={(value) =>
                  setContractForm({
                    ...contractForm,
                    start_date: value,
                  })
                }
              />

              <Input
                label="End Date"
                type="date"
                value={
                  contractForm.end_date
                }
                onChange={(value) =>
                  setContractForm({
                    ...contractForm,
                    end_date: value,
                  })
                }
              />

              <SelectInput
                label="Status"
                value={contractForm.status}
                onChange={(value) =>
                  setContractForm({
                    ...contractForm,
                    status: value,
                  })
                }
                options={[
                  ["draft", "Draft"],
                  ["active", "Active"],
                  ["expired", "Expired"],
                  [
                    "terminated",
                    "Terminated",
                  ],
                ]}
              />

              <TextArea
                label="Description"
                value={
                  contractForm.description
                }
                onChange={(value) =>
                  setContractForm({
                    ...contractForm,
                    description: value,
                  })
                }
                fullWidth
              />
            </div>

            <FormButtons
              onCancel={closeContractForm}
              submitText={
                editingContract
                  ? "Update Contract"
                  : "Create Contract"
              }
            />
          </form>
        </Modal>
      )}

      {showComplianceForm && (
        <Modal
          title={
            editingCompliance
              ? "Edit Compliance Document"
              : "Add Compliance Document"
          }
          onClose={closeComplianceForm}
        >
          <form onSubmit={handleComplianceSubmit}>
            <div style={formGrid}>
              <Input
                label="Vendor ID *"
                type="number"
                value={
                  complianceForm.vendor_id
                }
                onChange={(value) =>
                  setComplianceForm({
                    ...complianceForm,
                    vendor_id: value,
                  })
                }
                required
              />

              <Input
                label="Document Name *"
                value={
                  complianceForm.document_name
                }
                onChange={(value) =>
                  setComplianceForm({
                    ...complianceForm,
                    document_name: value,
                  })
                }
                required
              />

              <SelectInput
                label="Document Type"
                value={
                  complianceForm.document_type
                }
                onChange={(value) =>
                  setComplianceForm({
                    ...complianceForm,
                    document_type: value,
                  })
                }
                options={[
                  [
                    "GST Certificate",
                    "GST Certificate",
                  ],
                  [
                    "PAN Card",
                    "PAN Card",
                  ],
                  [
                    "Tax Certificate",
                    "Tax Certificate",
                  ],
                  [
                    "Quality Certificate",
                    "Quality Certificate",
                  ],
                  [
                    "Safety Certificate",
                    "Safety Certificate",
                  ],
                  [
                    "Environmental Certificate",
                    "Environmental Certificate",
                  ],
                  [
                    "ISO Certificate",
                    "ISO Certificate",
                  ],
                  [
                    "Business License",
                    "Business License",
                  ],
                  ["Other", "Other"],
                ]}
              />

              <Input
                label="Document Number"
                value={
                  complianceForm.document_number
                }
                onChange={(value) =>
                  setComplianceForm({
                    ...complianceForm,
                    document_number: value,
                  })
                }
              />

              <Input
                label="Issue Date"
                type="date"
                value={
                  complianceForm.issue_date
                }
                onChange={(value) =>
                  setComplianceForm({
                    ...complianceForm,
                    issue_date: value,
                  })
                }
              />

              <Input
                label="Expiry Date"
                type="date"
                value={
                  complianceForm.expiry_date
                }
                onChange={(value) =>
                  setComplianceForm({
                    ...complianceForm,
                    expiry_date: value,
                  })
                }
              />

              <Input
                label="File Name"
                value={
                  complianceForm.file_name
                }
                onChange={(value) =>
                  setComplianceForm({
                    ...complianceForm,
                    file_name: value,
                  })
                }
              />

              <Input
                label="File Path"
                value={
                  complianceForm.file_path
                }
                onChange={(value) =>
                  setComplianceForm({
                    ...complianceForm,
                    file_path: value,
                  })
                }
              />

              <TextArea
                label="Remarks"
                value={
                  complianceForm.remarks
                }
                onChange={(value) =>
                  setComplianceForm({
                    ...complianceForm,
                    remarks: value,
                  })
                }
                fullWidth
              />
            </div>

            <FormButtons
              onCancel={closeComplianceForm}
              submitText={
                editingCompliance
                  ? "Update Document"
                  : "Add Document"
              }
            />
          </form>
        </Modal>
      )}

      {showCertificationForm && (
        <Modal
          title={
            editingCertification
              ? "Edit Certification"
              : "Add Certification"
          }
          onClose={closeCertificationForm}
        >
          <form
            onSubmit={
              handleCertificationSubmit
            }
          >
            <div style={formGrid}>
              <Input
                label="Vendor ID *"
                type="number"
                value={
                  certificationForm.vendor_id
                }
                onChange={(value) =>
                  setCertificationForm({
                    ...certificationForm,
                    vendor_id: value,
                  })
                }
                required
              />

              <Input
                label="Certification Name *"
                value={
                  certificationForm.certification_name
                }
                onChange={(value) =>
                  setCertificationForm({
                    ...certificationForm,
                    certification_name:
                      value,
                  })
                }
                required
              />

              <Input
                label="Certification Type"
                value={
                  certificationForm.certification_type
                }
                onChange={(value) =>
                  setCertificationForm({
                    ...certificationForm,
                    certification_type:
                      value,
                  })
                }
              />

              <Input
                label="Certificate Number"
                value={
                  certificationForm.certificate_number
                }
                onChange={(value) =>
                  setCertificationForm({
                    ...certificationForm,
                    certificate_number:
                      value,
                  })
                }
              />

              <Input
                label="Issuing Authority"
                value={
                  certificationForm.issuing_authority
                }
                onChange={(value) =>
                  setCertificationForm({
                    ...certificationForm,
                    issuing_authority:
                      value,
                  })
                }
              />

              <Input
                label="Issue Date"
                type="date"
                value={
                  certificationForm.issue_date
                }
                onChange={(value) =>
                  setCertificationForm({
                    ...certificationForm,
                    issue_date: value,
                  })
                }
              />

              <Input
                label="Expiry Date"
                type="date"
                value={
                  certificationForm.expiry_date
                }
                onChange={(value) =>
                  setCertificationForm({
                    ...certificationForm,
                    expiry_date: value,
                  })
                }
              />

              <Input
                label="File Name"
                value={
                  certificationForm.file_name
                }
                onChange={(value) =>
                  setCertificationForm({
                    ...certificationForm,
                    file_name: value,
                  })
                }
              />

              <Input
                label="File Path"
                value={
                  certificationForm.file_path
                }
                onChange={(value) =>
                  setCertificationForm({
                    ...certificationForm,
                    file_path: value,
                  })
                }
              />

              <TextArea
                label="Remarks"
                value={
                  certificationForm.remarks
                }
                onChange={(value) =>
                  setCertificationForm({
                    ...certificationForm,
                    remarks: value,
                  })
                }
                fullWidth
              />
            </div>

            <FormButtons
              onCancel={
                closeCertificationForm
              }
              submitText={
                editingCertification
                  ? "Update Certification"
                  : "Add Certification"
              }
            />
          </form>
        </Modal>
      )}

      {showVendorDocumentForm && (
        <Modal
          title={
            editingVendorDocument
              ? "Edit Vendor Document"
              : "Add Vendor Document"
          }
          onClose={
            closeVendorDocumentForm
          }
        >
          <form
            onSubmit={
              handleVendorDocumentSubmit
            }
          >
            <div style={formGrid}>
              <Input
                label="Vendor ID *"
                type="number"
                value={
                  vendorDocumentForm.vendor_id
                }
                onChange={(value) =>
                  setVendorDocumentForm({
                    ...vendorDocumentForm,
                    vendor_id: value,
                  })
                }
                required
              />

              <Input
                label="Document Name *"
                value={
                  vendorDocumentForm.document_name
                }
                onChange={(value) =>
                  setVendorDocumentForm({
                    ...vendorDocumentForm,
                    document_name: value,
                  })
                }
                required
              />

              <Input
                label="Document Type"
                value={
                  vendorDocumentForm.document_type
                }
                onChange={(value) =>
                  setVendorDocumentForm({
                    ...vendorDocumentForm,
                    document_type: value,
                  })
                }
              />

              <SelectInput
                label="Status"
                value={
                  vendorDocumentForm.status
                }
                onChange={(value) =>
                  setVendorDocumentForm({
                    ...vendorDocumentForm,
                    status: value,
                  })
                }
                options={[
                  ["active", "Active"],
                  [
                    "inactive",
                    "Inactive",
                  ],
                  [
                    "expired",
                    "Expired",
                  ],
                ]}
              />

              <Input
                label="File Name"
                value={
                  vendorDocumentForm.file_name
                }
                onChange={(value) =>
                  setVendorDocumentForm({
                    ...vendorDocumentForm,
                    file_name: value,
                  })
                }
              />

              <Input
                label="File Path"
                value={
                  vendorDocumentForm.file_path
                }
                onChange={(value) =>
                  setVendorDocumentForm({
                    ...vendorDocumentForm,
                    file_path: value,
                  })
                }
              />

              <TextArea
                label="Description"
                value={
                  vendorDocumentForm.description
                }
                onChange={(value) =>
                  setVendorDocumentForm({
                    ...vendorDocumentForm,
                    description: value,
                  })
                }
                fullWidth
              />
            </div>

            <FormButtons
              onCancel={
                closeVendorDocumentForm
              }
              submitText={
                editingVendorDocument
                  ? "Update Document"
                  : "Add Document"
              }
            />
          </form>
        </Modal>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}) {
  return (
    <button
      onClick={onClick}
      style={{
        ...tabButton,
        ...(active ? activeTabStyle : {}),
      }}
    >
      {children}
    </button>
  );
}

function OverviewSection({
  overview,
  alerts,
}) {
  const cards = [
    [
      "Total Contracts",
      overview?.contracts ?? 0,
      "📑",
    ],
    [
      "Active Contracts",
      overview?.active_contracts ?? 0,
      "✅",
    ],
    [
      "Expiring Contracts",
      overview?.expiring_contracts ?? 0,
      "⏰",
    ],
    [
      "Expired Contracts",
      overview?.expired_contracts ?? 0,
      "⚠️",
    ],
    [
      "Compliance Documents",
      overview?.compliance_documents ?? 0,
      "📄",
    ],
    [
      "Valid Documents",
      overview?.valid_documents ?? 0,
      "✔️",
    ],
    [
      "Certifications",
      overview?.certifications ?? 0,
      "🏆",
    ],
    [
      "Vendor Documents",
      overview?.vendor_documents ?? 0,
      "🗂️",
    ],
  ];

  return (
    <>
      <div style={statsGrid}>
        {cards.map(
          ([label, value, icon]) => (
            <div
              style={statCard}
              key={label}
            >
              <div style={statIcon}>
                {icon}
              </div>

              <div>
                <p style={statLabel}>
                  {label}
                </p>

                <h2 style={statValue}>
                  {value}
                </h2>
              </div>
            </div>
          )
        )}
      </div>

      <div style={overviewGrid}>
        <div style={infoCard}>
          <h3 style={sectionTitle}>
            Compliance Summary
          </h3>

          <SummaryRow
            label="Valid Documents"
            value={
              overview?.valid_documents ?? 0
            }
          />

          <SummaryRow
            label="Expiring Documents"
            value={
              overview?.expiring_documents ?? 0
            }
          />

          <SummaryRow
            label="Expired Documents"
            value={
              overview?.expired_documents ?? 0
            }
          />
        </div>

        <div style={infoCard}>
          <h3 style={sectionTitle}>
            Certification Summary
          </h3>

          <SummaryRow
            label="Total Certifications"
            value={
              overview?.certifications ?? 0
            }
          />

          <SummaryRow
            label="Valid Certifications"
            value={
              overview?.valid_certifications ?? 0
            }
          />

          <SummaryRow
            label="Expiring Certifications"
            value={
              overview?.expiring_certifications ?? 0
            }
          />

          <SummaryRow
            label="Expired Certifications"
            value={
              overview?.expired_certifications ?? 0
            }
          />
        </div>
      </div>

      <div style={infoCard}>
        <h3 style={sectionTitle}>
          Current Alerts
        </h3>

        <p style={alertSummary}>
          {alerts?.total_alerts ?? 0} active
          contract/compliance alerts
        </p>
      </div>
    </>
  );
}

function ContractsSection({
  contracts,
  onAdd,
  onEdit,
  onDelete,
  onRenew,
  formatDate,
  formatCurrency,
  getStatusStyle,
}) {
  return (
    <div style={card}>
      <SectionHeader
        title="Contract Repository"
        subtitle="Manage vendor contracts and renewals."
        buttonText="+ Add Contract"
        onClick={onAdd}
      />

      {contracts.length === 0 ? (
        <EmptyState text="No contracts found." />
      ) : (
        <div style={tableWrapper}>
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>Contract</th>
                <th style={th}>Vendor</th>
                <th style={th}>Number</th>
                <th style={th}>Start</th>
                <th style={th}>End</th>
                <th style={th}>Value</th>
                <th style={th}>Status</th>
                <th style={th}>Actions</th>
              </tr>
            </thead>

            <tbody>
              {contracts.map(
                (contract) => (
                  <tr key={contract.id}>
                    <td style={td}>
                      <strong>
                        {contract.title ||
                          "Untitled"}
                      </strong>

                      {contract.description && (
                        <div
                          style={smallText}
                        >
                          {
                            contract.description
                          }
                        </div>
                      )}
                    </td>

                    <td style={td}>
                      {contract.vendor_name ||
                        `Vendor #${contract.vendor_id}`}
                    </td>

                    <td style={td}>
                      {
                        contract.contract_number
                      }
                    </td>

                    <td style={td}>
                      {formatDate(
                        contract.start_date
                      )}
                    </td>

                    <td style={td}>
                      {formatDate(
                        contract.end_date
                      )}
                    </td>

                    <td style={td}>
                      {formatCurrency(
                        contract.contract_value
                      )}
                    </td>

                    <td style={td}>
                      <Badge
                        value={
                          contract.status
                        }
                        styleGetter={
                          getStatusStyle
                        }
                      />
                    </td>

                    <td style={td}>
                      <div style={actionGroup}>
                        <button
                          style={
                            secondaryButton
                          }
                          onClick={() =>
                            onEdit(contract)
                          }
                        >
                          Edit
                        </button>

                        <button
                          style={
                            renewButton
                          }
                          onClick={() =>
                            onRenew(
                              contract
                            )
                          }
                        >
                          Renew
                        </button>

                        <button
                          style={
                            dangerButton
                          }
                          onClick={() =>
                            onDelete(
                              contract.id
                            )
                          }
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ComplianceSection({
  compliance,
  onAdd,
  onEdit,
  onDelete,
  onVerify,
  onReject,
  formatDate,
  getStatusStyle,
}) {
  return (
    <div style={card}>
      <SectionHeader
        title="Compliance Documents"
        subtitle="Review and verify vendor compliance records."
        buttonText="+ Add Compliance"
        onClick={onAdd}
      />

      {compliance.length === 0 ? (
        <EmptyState text="No compliance documents found." />
      ) : (
        <div style={tableWrapper}>
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>Document</th>
                <th style={th}>Vendor</th>
                <th style={th}>Type</th>
                <th style={th}>Number</th>
                <th style={th}>Expiry</th>
                <th style={th}>Status</th>
                <th style={th}>Verification</th>
                <th style={th}>Actions</th>
              </tr>
            </thead>

            <tbody>
              {compliance.map(
                (document) => (
                  <tr key={document.id}>
                    <td style={td}>
                      <strong>
                        {
                          document.document_name
                        }
                      </strong>

                      {document.remarks && (
                        <div
                          style={smallText}
                        >
                          {document.remarks}
                        </div>
                      )}
                    </td>

                    <td style={td}>
                      {document.vendor_name ||
                        `Vendor #${document.vendor_id}`}
                    </td>

                    <td style={td}>
                      {
                        document.document_type
                      }
                    </td>

                    <td style={td}>
                      {
                        document.document_number ||
                        "—"
                      }
                    </td>

                    <td style={td}>
                      {formatDate(
                        document.expiry_date
                      )}
                    </td>

                    <td style={td}>
                      <Badge
                        value={
                          document.status
                        }
                        styleGetter={
                          getStatusStyle
                        }
                      />
                    </td>

                    <td style={td}>
                      <Badge
                        value={
                          document.verification_status
                        }
                        styleGetter={
                          getStatusStyle
                        }
                      />
                    </td>

                    <td style={td}>
                      <div style={actionGroup}>
                        {document.verification_status !==
                          "verified" && (
                          <button
                            style={
                              successButton
                            }
                            onClick={() =>
                              onVerify(
                                document.id
                              )
                            }
                          >
                            Verify
                          </button>
                        )}

                        {document.verification_status !==
                          "rejected" && (
                          <button
                            style={
                              rejectButton
                            }
                            onClick={() =>
                              onReject(
                                document.id
                              )
                            }
                          >
                            Reject
                          </button>
                        )}

                        <button
                          style={
                            secondaryButton
                          }
                          onClick={() =>
                            onEdit(document)
                          }
                        >
                          Edit
                        </button>

                        <button
                          style={
                            dangerButton
                          }
                          onClick={() =>
                            onDelete(
                              document.id
                            )
                          }
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CertificationsSection({
  certifications,
  onAdd,
  onEdit,
  onDelete,
  formatDate,
  getStatusStyle,
}) {
  return (
    <div style={card}>
      <SectionHeader
        title="Certifications"
        subtitle="Manage vendor certifications and expiry dates."
        buttonText="+ Add Certification"
        onClick={onAdd}
      />

      {certifications.length === 0 ? (
        <EmptyState text="No certifications found." />
      ) : (
        <div style={tableWrapper}>
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>Certification</th>
                <th style={th}>Vendor</th>
                <th style={th}>Certificate No.</th>
                <th style={th}>Authority</th>
                <th style={th}>Issue Date</th>
                <th style={th}>Expiry Date</th>
                <th style={th}>Status</th>
                <th style={th}>Actions</th>
              </tr>
            </thead>

            <tbody>
              {certifications.map(
                (certification) => (
                  <tr key={certification.id}>
                    <td style={td}>
                      <strong>
                        {
                          certification.certification_name
                        }
                      </strong>

                      {certification.certification_type && (
                        <div
                          style={smallText}
                        >
                          {
                            certification.certification_type
                          }
                        </div>
                      )}
                    </td>

                    <td style={td}>
                      {certification.vendor_name ||
                        `Vendor #${certification.vendor_id}`}
                    </td>

                    <td style={td}>
                      {
                        certification.certificate_number ||
                        "—"
                      }
                    </td>

                    <td style={td}>
                      {
                        certification.issuing_authority ||
                        "—"
                      }
                    </td>

                    <td style={td}>
                      {formatDate(
                        certification.issue_date
                      )}
                    </td>

                    <td style={td}>
                      {formatDate(
                        certification.expiry_date
                      )}
                    </td>

                    <td style={td}>
                      <Badge
                        value={
                          certification.status
                        }
                        styleGetter={
                          getStatusStyle
                        }
                      />
                    </td>

                    <td style={td}>
                      <div style={actionGroup}>
                        <button
                          style={
                            secondaryButton
                          }
                          onClick={() =>
                            onEdit(
                              certification
                            )
                          }
                        >
                          Edit
                        </button>

                        <button
                          style={
                            dangerButton
                          }
                          onClick={() =>
                            onDelete(
                              certification.id
                            )
                          }
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function VendorDocumentsSection({
  documents,
  onAdd,
  onEdit,
  onDelete,
  formatDate,
  getStatusStyle,
}) {
  return (
    <div style={card}>
      <SectionHeader
        title="Vendor Documents"
        subtitle="Manage vendor registration and supporting documents."
        buttonText="+ Add Vendor Document"
        onClick={onAdd}
      />

      {documents.length === 0 ? (
        <EmptyState text="No vendor documents found." />
      ) : (
        <div style={tableWrapper}>
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>Document</th>
                <th style={th}>Vendor</th>
                <th style={th}>Type</th>
                <th style={th}>Description</th>
                <th style={th}>Status</th>
                <th style={th}>Uploaded</th>
                <th style={th}>Actions</th>
              </tr>
            </thead>

            <tbody>
              {documents.map(
                (document) => (
                  <tr key={document.id}>
                    <td style={td}>
                      <strong>
                        {
                          document.document_name
                        }
                      </strong>
                    </td>

                    <td style={td}>
                      {document.vendor_name ||
                        `Vendor #${document.vendor_id}`}
                    </td>

                    <td style={td}>
                      {
                        document.document_type ||
                        "—"
                      }
                    </td>

                    <td style={td}>
                      {
                        document.description ||
                        "—"
                      }
                    </td>

                    <td style={td}>
                      <Badge
                        value={
                          document.status
                        }
                        styleGetter={
                          getStatusStyle
                        }
                      />
                    </td>

                    <td style={td}>
                      {formatDate(
                        document.created_at
                      )}
                    </td>

                    <td style={td}>
                      <div style={actionGroup}>
                        <button
                          style={
                            secondaryButton
                          }
                          onClick={() =>
                            onEdit(document)
                          }
                        >
                          Edit
                        </button>

                        <button
                          style={
                            dangerButton
                          }
                          onClick={() =>
                            onDelete(
                              document.id
                            )
                          }
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AlertsSection({
  alerts,
  formatDate,
}) {
  const contracts =
    alerts?.contracts || [];

  const compliance =
    alerts?.compliance_documents || [];

  const certifications =
    alerts?.certifications || [];

  const total =
    alerts?.total_alerts ??
    contracts.length +
      compliance.length +
      certifications.length;

  return (
    <div style={card}>
      <div style={sectionHeader}>
        <div>
          <h2 style={cardTitle}>
            Contract & Compliance Alerts
          </h2>

          <p style={cardSubtitle}>
            Records requiring administrator attention.
          </p>
        </div>
      </div>

      <div style={alertTotal}>
        <strong>{total}</strong>
        <span>Active Alerts</span>
      </div>

      {contracts.length > 0 && (
        <AlertGroup
          title="Contract Alerts"
          items={contracts}
          formatDate={formatDate}
        />
      )}

      {compliance.length > 0 && (
        <AlertGroup
          title="Compliance Document Alerts"
          items={compliance}
          formatDate={formatDate}
        />
      )}

      {certifications.length > 0 && (
        <AlertGroup
          title="Certification Alerts"
          items={certifications}
          formatDate={formatDate}
        />
      )}

      {total === 0 && (
        <EmptyState text="No active contract or compliance alerts." />
      )}
    </div>
  );
}

function AlertGroup({
  title,
  items,
  formatDate,
}) {
  return (
    <div style={alertGroup}>
      <h3 style={sectionTitle}>
        {title}
      </h3>

      {items.map((item, index) => (
        <div
          key={
            item.id ||
            item.contract_id ||
            index
          }
          style={alertItem}
        >
          <div>
            <strong>
              {item.contract_number ||
                item.document_name ||
                item.certification_name ||
                "Alert"}
            </strong>

            <div style={smallText}>
              {item.vendor_name ||
                `Vendor #${item.vendor_id}`}
            </div>
          </div>

          <div style={alertDate}>
            {item.end_date
              ? formatDate(item.end_date)
              : item.expiry_date
              ? formatDate(
                  item.expiry_date
                )
              : ""}
          </div>
        </div>
      ))}
    </div>
  );
}

function SectionHeader({
  title,
  subtitle,
  buttonText,
  onClick,
}) {
  return (
    <div style={sectionHeader}>
      <div>
        <h2 style={cardTitle}>
          {title}
        </h2>

        <p style={cardSubtitle}>
          {subtitle}
        </p>
      </div>

      <button
        style={primaryButton}
        onClick={onClick}
      >
        {buttonText}
      </button>
    </div>
  );
}

function SummaryRow({
  label,
  value,
}) {
  return (
    <div style={summaryRow}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Badge({
  value,
  styleGetter,
}) {
  return (
    <span
      style={{
        ...badge,
        ...styleGetter(value),
      }}
    >
      {value || "Pending"}
    </span>
  );
}

function EmptyState({ text }) {
  return (
    <div style={emptyState}>
      {text}
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
  required = false,
}) {
  return (
    <label style={field}>
      <span style={fieldLabel}>
        {label}
      </span>

      <input
        type={type}
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        required={required}
        style={input}
      />
    </label>
  );
}

function SelectInput({
  label,
  value,
  onChange,
  options,
}) {
  return (
    <label style={field}>
      <span style={fieldLabel}>
        {label}
      </span>

      <select
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        style={input}
      >
        {options.map(
          ([optionValue, optionLabel]) => (
            <option
              key={optionValue}
              value={optionValue}
            >
              {optionLabel}
            </option>
          )
        )}
      </select>
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  fullWidth = false,
}) {
  return (
    <label
      style={{
        ...field,
        ...(fullWidth
          ? {
              gridColumn:
                "1 / -1",
            }
          : {}),
      }}
    >
      <span style={fieldLabel}>
        {label}
      </span>

      <textarea
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        style={{
          ...input,
          minHeight: "90px",
          resize: "vertical",
        }}
      />
    </label>
  );
}

function FormButtons({
  onCancel,
  submitText,
}) {
  return (
    <div style={formButtons}>
      <button
        type="button"
        style={cancelButton}
        onClick={onCancel}
      >
        Cancel
      </button>

      <button
        type="submit"
        style={primaryButton}
      >
        {submitText}
      </button>
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
}) {
  return (
    <div style={modalOverlay}>
      <div style={modal}>
        <div style={modalHeader}>
          <h2 style={modalTitle}>
            {title}
          </h2>

          <button
            style={modalClose}
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </div>

        <div style={modalBody}>
          {children}
        </div>
      </div>
    </div>
  );
}

const page = {
  padding: "24px",
  minHeight: "100%",
  background: "#f5f7fb",
};

const pageHeader = {
  background: "#fff",
  padding: "24px",
  borderRadius: "14px",
  marginBottom: "18px",
  boxShadow:
    "0 3px 12px rgba(0,0,0,0.05)",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "20px",
};

const eyebrow = {
  fontSize: "10px",
  fontWeight: "700",
  letterSpacing: "1.4px",
  color: "#777",
};

const pageTitle = {
  margin: "6px 0 0",
  color: "#17152f",
  fontSize: "28px",
};

const pageSubtitle = {
  margin: "7px 0 0",
  color: "#777",
  fontSize: "13px",
};

const refreshButton = {
  border: "none",
  background: "#17152f",
  color: "#fff",
  padding: "10px 17px",
  borderRadius: "8px",
  cursor: "pointer",
  fontWeight: "600",
};

const tabs = {
  background: "#fff",
  padding: "8px",
  borderRadius: "12px",
  marginBottom: "18px",
  display: "flex",
  gap: "5px",
  flexWrap: "wrap",
  boxShadow:
    "0 3px 12px rgba(0,0,0,0.05)",
};

const tabButton = {
  border: "none",
  background: "transparent",
  color: "#666",
  padding: "10px 16px",
  borderRadius: "8px",
  cursor: "pointer",
  fontSize: "13px",
  fontWeight: "600",
};

const activeTabStyle = {
  background: "#17152f",
  color: "#fff",
};

const statsGrid = {
  display: "grid",
  gridTemplateColumns:
    "repeat(4, minmax(0, 1fr))",
  gap: "16px",
  marginBottom: "18px",
};

const statCard = {
  background: "#fff",
  padding: "20px",
  borderRadius: "12px",
  boxShadow:
    "0 3px 12px rgba(0,0,0,0.05)",
  display: "flex",
  alignItems: "center",
  gap: "14px",
};

const statIcon = {
  width: "44px",
  height: "44px",
  borderRadius: "10px",
  background: "#f0f2f8",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "21px",
};

const statLabel = {
  margin: 0,
  color: "#777",
  fontSize: "12px",
};

const statValue = {
  margin: "5px 0 0",
  color: "#17152f",
  fontSize: "26px",
};

const overviewGrid = {
  display: "grid",
  gridTemplateColumns:
    "repeat(2, minmax(0, 1fr))",
  gap: "18px",
  marginBottom: "18px",
};

const infoCard = {
  background: "#fff",
  padding: "22px",
  borderRadius: "14px",
  boxShadow:
    "0 3px 12px rgba(0,0,0,0.05)",
  marginBottom: "18px",
};

const sectionTitle = {
  margin: "0 0 15px",
  color: "#17152f",
  fontSize: "17px",
};

const summaryRow = {
  display: "flex",
  justifyContent: "space-between",
  padding: "12px 0",
  borderBottom: "1px solid #eee",
  color: "#666",
  fontSize: "13px",
};

const alertSummary = {
  color: "#777",
  margin: 0,
  fontSize: "13px",
};

const card = {
  background: "#fff",
  padding: "22px",
  borderRadius: "14px",
  boxShadow:
    "0 3px 12px rgba(0,0,0,0.05)",
};

const sectionHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "15px",
  marginBottom: "18px",
};

const cardTitle = {
  margin: 0,
  color: "#17152f",
  fontSize: "18px",
};

const cardSubtitle = {
  margin: "5px 0 0",
  color: "#888",
  fontSize: "12px",
};

const primaryButton = {
  border: "none",
  background: "#17152f",
  color: "#fff",
  padding: "9px 15px",
  borderRadius: "7px",
  cursor: "pointer",
  fontWeight: "600",
  fontSize: "12px",
};

const secondaryButton = {
  border: "1px solid #ddd",
  background: "#fff",
  color: "#333",
  padding: "6px 9px",
  borderRadius: "6px",
  cursor: "pointer",
  fontSize: "11px",
  fontWeight: "600",
};

const renewButton = {
  border: "none",
  background: "#eef3ff",
  color: "#2855b8",
  padding: "6px 9px",
  borderRadius: "6px",
  cursor: "pointer",
  fontSize: "11px",
  fontWeight: "600",
};

const dangerButton = {
  border: "none",
  background: "#ffeaea",
  color: "#c62828",
  padding: "6px 9px",
  borderRadius: "6px",
  cursor: "pointer",
  fontSize: "11px",
  fontWeight: "600",
};

const successButton = {
  border: "none",
  background: "#e8f7ee",
  color: "#16803c",
  padding: "6px 9px",
  borderRadius: "6px",
  cursor: "pointer",
  fontSize: "11px",
  fontWeight: "600",
};

const rejectButton = {
  border: "none",
  background: "#fff4df",
  color: "#a25d00",
  padding: "6px 9px",
  borderRadius: "6px",
  cursor: "pointer",
  fontSize: "11px",
  fontWeight: "600",
};

const actionGroup = {
  display: "flex",
  gap: "5px",
  flexWrap: "wrap",
};

const tableWrapper = {
  overflowX: "auto",
};

const table = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: "1100px",
};

const th = {
  textAlign: "left",
  padding: "12px",
  background: "#f5f7fb",
  color: "#555",
  fontSize: "11px",
  whiteSpace: "nowrap",
};

const td = {
  padding: "13px 12px",
  borderBottom: "1px solid #eee",
  fontSize: "12px",
  verticalAlign: "top",
};

const smallText = {
  marginTop: "5px",
  color: "#888",
  fontSize: "10px",
  maxWidth: "240px",
};

const badge = {
  display: "inline-block",
  padding: "5px 9px",
  borderRadius: "20px",
  fontSize: "10px",
  fontWeight: "700",
  textTransform: "capitalize",
  whiteSpace: "nowrap",
};

const emptyState = {
  padding: "35px",
  textAlign: "center",
  background: "#f8f9fb",
  borderRadius: "10px",
  color: "#777",
  fontSize: "13px",
};

const alertTotal = {
  display: "flex",
  flexDirection: "column",
  background: "#f8f9fb",
  padding: "18px",
  borderRadius: "10px",
  marginBottom: "20px",
};

const alertGroup = {
  marginBottom: "22px",
};

const alertItem = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "13px",
  border: "1px solid #eee",
  borderRadius: "8px",
  marginBottom: "7px",
};

const alertDate = {
  color: "#b26a00",
  fontSize: "11px",
  fontWeight: "600",
};

const loadingBox = {
  padding: "60px",
  textAlign: "center",
  color: "#777",
  background: "#f5f7fb",
  minHeight: "300px",
};

const errorBanner = {
  position: "relative",
  padding: "13px 40px 13px 15px",
  marginBottom: "15px",
  background: "#ffeaea",
  color: "#c62828",
  borderRadius: "8px",
  fontSize: "12px",
};

const successBanner = {
  padding: "13px 15px",
  marginBottom: "15px",
  background: "#e8f7ee",
  color: "#16803c",
  borderRadius: "8px",
  fontSize: "12px",
  fontWeight: "600",
};

const closeMessage = {
  position: "absolute",
  right: "12px",
  top: "8px",
  border: "none",
  background: "transparent",
  color: "#c62828",
  fontSize: "20px",
  cursor: "pointer",
};

const modalOverlay = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
  padding: "20px",
};

const modal = {
  width: "min(850px, 100%)",
  maxHeight: "90vh",
  overflowY: "auto",
  background: "#fff",
  borderRadius: "14px",
  boxShadow:
    "0 15px 50px rgba(0,0,0,0.2)",
};

const modalHeader = {
  padding: "18px 22px",
  borderBottom: "1px solid #eee",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const modalTitle = {
  margin: 0,
  color: "#17152f",
  fontSize: "19px",
};

const modalClose = {
  border: "none",
  background: "transparent",
  fontSize: "26px",
  color: "#777",
  cursor: "pointer",
};

const modalBody = {
  padding: "22px",
};

const formGrid = {
  display: "grid",
  gridTemplateColumns:
    "repeat(2, minmax(0, 1fr))",
  gap: "16px",
};

const field = {
  display: "flex",
  flexDirection: "column",
  gap: "7px",
};

const fieldLabel = {
  fontSize: "11px",
  fontWeight: "700",
  color: "#555",
};

const input = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #ddd",
  borderRadius: "7px",
  padding: "10px 11px",
  fontSize: "12px",
  outline: "none",
  background: "#fff",
};

const formButtons = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "10px",
  marginTop: "22px",
  paddingTop: "18px",
  borderTop: "1px solid #eee",
};

const cancelButton = {
  border: "1px solid #ddd",
  background: "#fff",
  color: "#555",
  padding: "9px 15px",
  borderRadius: "7px",
  cursor: "pointer",
  fontWeight: "600",
  fontSize: "12px",
};

export default AdminContractCompliance;