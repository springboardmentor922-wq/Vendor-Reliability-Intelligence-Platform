import React, { useEffect, useMemo, useState } from "react";

const API_URL = "http://127.0.0.1:8000";

function ProcurementVendors() {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [search, setSearch] = useState("");

  const [selectedVendor, setSelectedVendor] = useState(null);

  const getToken = () => {
    return (
      localStorage.getItem("access_token") ||
      sessionStorage.getItem("access_token") ||
      localStorage.getItem("token") ||
      sessionStorage.getItem("token")
    );
  };

  useEffect(() => {
    loadVendors();
  }, []);

  const loadVendors = async () => {
    try {
      setLoading(true);
      setError("");

      const token = getToken();

      if (!token) {
        setError("Authentication token not found. Please login again.");
        setLoading(false);
        return;
      }

      const response = await fetch(`${API_URL}/vendors`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });

      let data = [];

      try {
        data = await response.json();
      } catch {
        data = [];
      }

      if (!response.ok) {
        throw new Error(
          data?.detail || data?.message || "Unable to load vendors."
        );
      }

      setVendors(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Vendor loading error:", err);
      setError(err.message || "Unable to load vendors.");
    } finally {
      setLoading(false);
    }
  };

  const normalizeValue = (value) => {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, "_");
  };

  const getStatus = (vendor) => {
    return normalizeValue(vendor.vendor_status || vendor.status || "pending");
  };

  const getCategory = (vendor) => {
    return (
      vendor.category ||
      vendor.vendor_category ||
      vendor.type ||
      "Uncategorized"
    );
  };

  const categories = useMemo(() => {
    const categoryMap = {};

    vendors.forEach((vendor) => {
      const category = getCategory(vendor);

      if (!categoryMap[category]) {
        categoryMap[category] = 0;
      }

      categoryMap[category]++;
    });

    return Object.entries(categoryMap)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, count]) => ({
        name,
        count,
      }));
  }, [vendors]);

  const statusCounts = useMemo(() => {
    return {
      all: vendors.length,
      pending: vendors.filter((v) => getStatus(v) === "pending").length,
      active: vendors.filter((v) => getStatus(v) === "active").length,
      inactive: vendors.filter((v) => getStatus(v) === "inactive").length,
      suspended: vendors.filter((v) => getStatus(v) === "suspended").length,
    };
  }, [vendors]);

  const filteredVendors = useMemo(() => {
    const searchValue = search.toLowerCase().trim();

    return vendors.filter((vendor) => {
      const category = getCategory(vendor);
      const status = getStatus(vendor);

      const categoryMatch =
        selectedCategory === "All" || category === selectedCategory;

      const statusMatch =
        selectedStatus === "all" || status === selectedStatus;

      const searchMatch =
        !searchValue ||
        String(vendor.company_name || "")
          .toLowerCase()
          .includes(searchValue) ||
        String(vendor.contact_person || "")
          .toLowerCase()
          .includes(searchValue) ||
        String(vendor.email || "")
          .toLowerCase()
          .includes(searchValue) ||
        String(vendor.phone || "")
          .toLowerCase()
          .includes(searchValue) ||
        String(category)
          .toLowerCase()
          .includes(searchValue);

      return categoryMatch && statusMatch && searchMatch;
    });
  }, [vendors, selectedCategory, selectedStatus, search]);

  const getReliability = (vendor) => {
    const score = Number(vendor.reliability_score || 0);

    return Math.min(Math.max(score, 0), 100);
  };

  const getReliabilityText = (score) => {
    if (score >= 80) return "Excellent";
    if (score >= 60) return "Good";
    if (score >= 40) return "Average";
    return "Low";
  };

  return (
    <div className="procurement-vendors-page">
      <div className="procurement-vendors-container">
        {/* HEADER */}
        <div className="vendors-header">
          <div className="vendors-header-left">
            <div className="vendors-header-icon">🏢</div>

            <div>
              <div className="vendors-eyebrow">PROCUREMENT</div>

              <h1>Vendors</h1>

              <p>
                Browse vendors by category, monitor their status, and review
                vendor information.
              </p>
            </div>
          </div>

          <button
            className="vendors-refresh-button"
            onClick={loadVendors}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "↻ Refresh"}
          </button>
        </div>

        {/* STATUS FILTERS */}
        <div className="vendors-status-section">
          <div className="vendors-section-title">
            <div>
              <h2>Vendor Status</h2>
              <p>Filter vendors based on their current status.</p>
            </div>
          </div>

          <div className="vendors-status-tabs">
            <button
              className={`status-tab ${
                selectedStatus === "all" ? "active" : ""
              }`}
              onClick={() => setSelectedStatus("all")}
            >
              <span className="status-tab-icon">👥</span>

              <span>
                <strong>All Vendors</strong>
                <small>{statusCounts.all} Vendors</small>
              </span>
            </button>

            <button
              className={`status-tab ${
                selectedStatus === "pending" ? "active" : ""
              }`}
              onClick={() => setSelectedStatus("pending")}
            >
              <span className="status-tab-icon">⏳</span>

              <span>
                <strong>Pending</strong>
                <small>{statusCounts.pending} Vendors</small>
              </span>
            </button>

            <button
              className={`status-tab ${
                selectedStatus === "active" ? "active" : ""
              }`}
              onClick={() => setSelectedStatus("active")}
            >
              <span className="status-tab-icon">✓</span>

              <span>
                <strong>Active</strong>
                <small>{statusCounts.active} Vendors</small>
              </span>
            </button>

            <button
              className={`status-tab ${
                selectedStatus === "inactive" ? "active" : ""
              }`}
              onClick={() => setSelectedStatus("inactive")}
            >
              <span className="status-tab-icon">○</span>

              <span>
                <strong>Inactive</strong>
                <small>{statusCounts.inactive} Vendors</small>
              </span>
            </button>

            <button
              className={`status-tab ${
                selectedStatus === "suspended" ? "active" : ""
              }`}
              onClick={() => setSelectedStatus("suspended")}
            >
              <span className="status-tab-icon">!</span>

              <span>
                <strong>Suspended</strong>
                <small>{statusCounts.suspended} Vendors</small>
              </span>
            </button>
          </div>
        </div>

        {/* CATEGORY SECTION */}
        <div className="vendors-category-section">
          <div className="vendors-section-heading">
            <div>
              <h2>Vendor Categories</h2>
              <p>Select a category to view the vendors available in it.</p>
            </div>

            <div className="category-result-count">
              {filteredVendors.length} vendors
            </div>
          </div>

          <div className="category-grid">
            <button
              className={`category-card ${
                selectedCategory === "All" ? "selected" : ""
              }`}
              onClick={() => setSelectedCategory("All")}
            >
              <div className="category-icon">🏢</div>

              <div className="category-content">
                <h3>All Categories</h3>
                <p>{vendors.length} Vendors</p>
              </div>

              <div className="category-arrow">→</div>
            </button>

            {categories.map((category) => (
              <button
                key={category.name}
                className={`category-card ${
                  selectedCategory === category.name ? "selected" : ""
                }`}
                onClick={() => setSelectedCategory(category.name)}
              >
                <div className="category-icon">
                  {getCategoryIcon(category.name)}
                </div>

                <div className="category-content">
                  <h3>{category.name}</h3>
                  <p>
                    {category.count}{" "}
                    {category.count === 1 ? "Vendor" : "Vendors"}
                  </p>
                </div>

                <div className="category-arrow">→</div>
              </button>
            ))}
          </div>
        </div>

        {/* SELECTED CATEGORY TITLE */}
        <div className="vendors-list-section">
          <div className="vendors-list-header">
            <div>
              <div className="vendors-eyebrow">VENDOR DIRECTORY</div>

              <h2>
                {selectedCategory === "All"
                  ? "All Vendors"
                  : selectedCategory}
              </h2>

              <p>
                {selectedStatus === "all"
                  ? "Vendors available for procurement activities."
                  : `Showing ${formatStatus(selectedStatus)} vendors in this category.`}
              </p>
            </div>

            <div className="vendors-search">
              <span>⌕</span>

              <input
                type="text"
                placeholder="Search vendors..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div className="vendors-error-box">
              <div>
                <strong>Unable to load vendors</strong>
                <p>{error}</p>
              </div>

              <button onClick={loadVendors}>Retry</button>
            </div>
          )}

          {loading ? (
            <div className="vendors-empty-state">
              <div className="vendors-loading-icon">⟳</div>
              <h3>Loading vendors...</h3>
              <p>Please wait while vendor information is loaded.</p>
            </div>
          ) : filteredVendors.length === 0 ? (
            <div className="vendors-empty-state">
              <div className="vendors-empty-icon">🏢</div>

              <h3>No vendors found</h3>

              <p>
                {search
                  ? "Try a different search term."
                  : "There are no vendors matching the selected filters."}
              </p>

              <button
                className="clear-filter-button"
                onClick={() => {
                  setSelectedCategory("All");
                  setSelectedStatus("all");
                  setSearch("");
                }}
              >
                Clear Filters
              </button>
            </div>
          ) : (
            <div className="vendor-cards-grid">
              {filteredVendors.map((vendor) => {
                const reliability = getReliability(vendor);
                const status = getStatus(vendor);
                const category = getCategory(vendor);

                return (
                  <div
                    className="vendor-card"
                    key={vendor.id}
                    onClick={() => setSelectedVendor(vendor)}
                  >
                    <div className="vendor-card-top">
                      <div className="vendor-company-icon">
                        {getCompanyInitial(vendor.company_name)}
                      </div>

                      <StatusBadge value={status} />
                    </div>

                    <div className="vendor-card-body">
                      <h3>
                        {vendor.company_name || "Unnamed Vendor"}
                      </h3>

                      <p className="vendor-category">
                        {getCategoryIcon(category)} {category}
                      </p>

                      <div className="vendor-contact">
                        <span>👤</span>
                        <span>
                          {vendor.contact_person || "Contact not available"}
                        </span>
                      </div>

                      <div className="vendor-contact">
                        <span>✉</span>
                        <span>
                          {vendor.email || "Email not available"}
                        </span>
                      </div>
                    </div>

                    <div className="vendor-card-footer">
                      <div className="reliability-info">
                        <div className="reliability-label">
                          <span>Reliability</span>
                          <strong>{reliability.toFixed(0)}%</strong>
                        </div>

                        <div className="reliability-track">
                          <div
                            className="reliability-fill"
                            style={{
                              width: `${reliability}%`,
                            }}
                          />
                        </div>

                        <small>
                          {getReliabilityText(reliability)}
                        </small>
                      </div>

                      <button
                        className="vendor-view-button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedVendor(vendor);
                        }}
                      >
                        View →
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* FOOTER SUMMARY */}
        <div className="vendors-footer">
          <div className="vendors-footer-card">
            <div className="vendors-footer-icon">🏢</div>

            <div>
              <strong>{vendors.length}</strong>
              <span>Total Vendors</span>
            </div>
          </div>

          <div className="vendors-footer-card">
            <div className="vendors-footer-icon">✓</div>

            <div>
              <strong>{statusCounts.active}</strong>
              <span>Active Vendors</span>
            </div>
          </div>

          <div className="vendors-footer-card">
            <div className="vendors-footer-icon">📂</div>

            <div>
              <strong>{categories.length}</strong>
              <span>Categories</span>
            </div>
          </div>
        </div>
      </div>

      {/* VENDOR DETAILS MODAL */}
      {selectedVendor && (
        <div
          className="vendor-modal-overlay"
          onClick={() => setSelectedVendor(null)}
        >
          <div
            className="vendor-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="vendor-modal-header">
              <div className="vendor-modal-title-area">
                <div className="vendor-modal-company-icon">
                  {getCompanyInitial(selectedVendor.company_name)}
                </div>

                <div>
                  <div className="vendors-eyebrow">VENDOR DETAILS</div>

                  <h2>
                    {selectedVendor.company_name || "Unnamed Vendor"}
                  </h2>

                  <p>
                    {getCategoryIcon(getCategory(selectedVendor))}{" "}
                    {getCategory(selectedVendor)}
                  </p>
                </div>
              </div>

              <button
                className="vendor-modal-close"
                onClick={() => setSelectedVendor(null)}
              >
                ×
              </button>
            </div>

            <div className="vendor-modal-status">
              <span>Current Vendor Status</span>

              <StatusBadge value={getStatus(selectedVendor)} />
            </div>

            <div className="vendor-details-grid">
              <DetailBox
                label="Vendor ID"
                value={`#${selectedVendor.id ?? "N/A"}`}
              />

              <DetailBox
                label="Category"
                value={getCategory(selectedVendor)}
              />

              <DetailBox
                label="Contact Person"
                value={
                  selectedVendor.contact_person || "Not available"
                }
              />

              <DetailBox
                label="Email"
                value={selectedVendor.email || "Not available"}
              />

              <DetailBox
                label="Phone"
                value={selectedVendor.phone || "Not available"}
              />

              <DetailBox
                label="Approval Status"
                value={
                  selectedVendor.approval_status || "Pending"
                }
              />

              <DetailBox
                label="Vendor Status"
                value={formatStatus(getStatus(selectedVendor))}
              />

              <DetailBox
                label="Reliability Score"
                value={`${getReliability(selectedVendor).toFixed(0)}%`}
              />

              <DetailBox
                label="Address"
                value={selectedVendor.address || "Not available"}
                fullWidth
              />
            </div>

            <div className="vendor-modal-reliability">
              <div className="modal-reliability-header">
                <span>Vendor Reliability</span>

                <strong>
                  {getReliability(selectedVendor).toFixed(0)}%
                </strong>
              </div>

              <div className="modal-reliability-track">
                <div
                  className="modal-reliability-fill"
                  style={{
                    width: `${getReliability(selectedVendor)}%`,
                  }}
                />
              </div>

              <p>
                {getReliabilityText(
                  getReliability(selectedVendor)
                )}{" "}
                reliability based on the available vendor score.
              </p>
            </div>

            <div className="vendor-modal-footer">
              <button
                className="vendor-close-button"
                onClick={() => setSelectedVendor(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        * {
          box-sizing: border-box;
        }

        .procurement-vendors-page {
          min-height: 100vh;
          background: #f5f6fa;
          padding: 28px;
          color: #17152f;
        }

        .procurement-vendors-container {
          max-width: 1400px;
          margin: 0 auto;
        }

        /* HEADER */

        .vendors-header {
          background: #ffffff;
          border-radius: 16px;
          padding: 24px 26px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 22px;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
        }

        .vendors-header-left {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .vendors-header-icon {
          width: 52px;
          height: 52px;
          border-radius: 13px;
          background: #eef1f7;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 25px;
        }

        .vendors-eyebrow {
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 1.5px;
          color: #858894;
          text-transform: uppercase;
        }

        .vendors-header h1 {
          margin: 5px 0 4px;
          font-size: 27px;
          line-height: 1.2;
          color: #17152f;
        }

        .vendors-header p {
          margin: 0;
          color: #777b87;
          font-size: 13px;
        }

        .vendors-refresh-button {
          border: none;
          background: #17152f;
          color: #ffffff;
          padding: 11px 18px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 700;
          white-space: nowrap;
        }

        .vendors-refresh-button:hover {
          background: #29264b;
        }

        .vendors-refresh-button:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }

        /* STATUS SECTION */

        .vendors-status-section {
          background: #ffffff;
          border-radius: 15px;
          padding: 22px;
          margin-bottom: 22px;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
        }

        .vendors-section-title {
          margin-bottom: 17px;
        }

        .vendors-section-title h2,
        .vendors-section-heading h2 {
          margin: 0;
          font-size: 18px;
          color: #17152f;
        }

        .vendors-section-title p,
        .vendors-section-heading p {
          margin: 5px 0 0;
          font-size: 12px;
          color: #858894;
        }

        .vendors-status-tabs {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 10px;
        }

        .status-tab {
          border: 1px solid #e3e5eb;
          background: #ffffff;
          border-radius: 10px;
          padding: 13px 14px;
          display: flex;
          align-items: center;
          gap: 11px;
          text-align: left;
          cursor: pointer;
          transition: 0.2s ease;
          color: #33333f;
        }

        .status-tab:hover {
          border-color: #bfc4d2;
          background: #fafbfc;
        }

        .status-tab.active {
          border-color: #17152f;
          background: #f1f2f7;
          box-shadow: inset 0 0 0 1px #17152f;
        }

        .status-tab-icon {
          width: 32px;
          height: 32px;
          min-width: 32px;
          border-radius: 8px;
          background: #eef1f7;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 15px;
          font-weight: 800;
        }

        .status-tab strong {
          display: block;
          font-size: 12px;
          margin-bottom: 3px;
        }

        .status-tab small {
          display: block;
          color: #858894;
          font-size: 10px;
        }

        /* CATEGORIES */

        .vendors-category-section {
          background: #ffffff;
          border-radius: 15px;
          padding: 22px;
          margin-bottom: 22px;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
        }

        .vendors-section-heading {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 15px;
          margin-bottom: 18px;
        }

        .category-result-count {
          background: #f1f2f6;
          color: #555967;
          padding: 7px 12px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 700;
          white-space: nowrap;
        }

        .category-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 13px;
        }

        .category-card {
          border: 1px solid #e2e4ea;
          background: #ffffff;
          border-radius: 12px;
          padding: 16px;
          display: flex;
          align-items: center;
          gap: 12px;
          text-align: left;
          cursor: pointer;
          transition: 0.2s ease;
          min-height: 82px;
        }

        .category-card:hover {
          transform: translateY(-1px);
          border-color: #c5c8d3;
          box-shadow: 0 5px 14px rgba(0, 0, 0, 0.05);
        }

        .category-card.selected {
          border-color: #17152f;
          background: #f4f4f8;
          box-shadow: inset 0 0 0 1px #17152f;
        }

        .category-icon {
          width: 42px;
          height: 42px;
          min-width: 42px;
          border-radius: 10px;
          background: #eef1f7;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 19px;
        }

        .category-content {
          min-width: 0;
          flex: 1;
        }

        .category-content h3 {
          margin: 0 0 4px;
          color: #242332;
          font-size: 13px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .category-content p {
          margin: 0;
          color: #888b96;
          font-size: 11px;
        }

        .category-arrow {
          color: #7a7d89;
          font-size: 16px;
          font-weight: 700;
        }

        /* VENDOR LIST */

        .vendors-list-section {
          background: #ffffff;
          border-radius: 15px;
          padding: 22px;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
        }

        .vendors-list-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
          margin-bottom: 20px;
        }

        .vendors-list-header h2 {
          margin: 5px 0 4px;
          font-size: 20px;
          color: #17152f;
        }

        .vendors-list-header p {
          margin: 0;
          color: #858894;
          font-size: 12px;
        }

        .vendors-search {
          width: 300px;
          height: 40px;
          border: 1px solid #dfe1e7;
          border-radius: 9px;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0 12px;
          background: #ffffff;
        }

        .vendors-search span {
          font-size: 19px;
          color: #858894;
        }

        .vendors-search input {
          border: none;
          outline: none;
          width: 100%;
          font-size: 12px;
          color: #33333f;
          background: transparent;
        }

        .vendors-search input::placeholder {
          color: #a1a3ab;
        }

        /* ERROR */

        .vendors-error-box {
          background: #fff1f2;
          border: 1px solid #ffd6da;
          border-radius: 10px;
          padding: 13px 15px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 15px;
          margin-bottom: 18px;
        }

        .vendors-error-box strong {
          color: #a51d2d;
          font-size: 12px;
        }

        .vendors-error-box p {
          margin: 3px 0 0;
          color: #b42318;
          font-size: 11px;
        }

        .vendors-error-box button {
          border: none;
          background: #b42318;
          color: #ffffff;
          padding: 7px 13px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 11px;
          font-weight: 700;
        }

        /* VENDOR CARDS */

        .vendor-cards-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 15px;
        }

        .vendor-card {
          border: 1px solid #e3e5eb;
          border-radius: 13px;
          background: #ffffff;
          overflow: hidden;
          cursor: pointer;
          transition: 0.2s ease;
        }

        .vendor-card:hover {
          transform: translateY(-2px);
          border-color: #c6c9d4;
          box-shadow: 0 8px 22px rgba(0, 0, 0, 0.07);
        }

        .vendor-card-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding: 17px 17px 0;
        }

        .vendor-company-icon {
          width: 45px;
          height: 45px;
          border-radius: 11px;
          background: #eef1f7;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 17px;
          font-weight: 800;
          color: #17152f;
        }

        .vendor-card-body {
          padding: 14px 17px 16px;
        }

        .vendor-card-body h3 {
          margin: 0 0 6px;
          color: #20202e;
          font-size: 15px;
        }

        .vendor-category {
          margin: 0 0 13px;
          color: #717582;
          font-size: 11px;
        }

        .vendor-contact {
          display: flex;
          align-items: center;
          gap: 7px;
          color: #777b86;
          font-size: 11px;
          margin-top: 7px;
          min-width: 0;
        }

        .vendor-contact span:last-child {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .vendor-card-footer {
          border-top: 1px solid #eeeeee;
          padding: 13px 17px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 15px;
        }

        .reliability-info {
          flex: 1;
          min-width: 0;
        }

        .reliability-label {
          display: flex;
          justify-content: space-between;
          margin-bottom: 5px;
          font-size: 10px;
          color: #858894;
        }

        .reliability-label strong {
          color: #33333f;
        }

        .reliability-track {
          height: 5px;
          background: #e7e8ed;
          border-radius: 10px;
          overflow: hidden;
        }

        .reliability-fill {
          height: 100%;
          background: #17152f;
          border-radius: 10px;
          transition: width 0.3s ease;
        }

        .reliability-info small {
          display: block;
          margin-top: 5px;
          font-size: 9px;
          color: #8a8d98;
        }

        .vendor-view-button {
          border: none;
          background: #eef1f7;
          color: #17152f;
          padding: 8px 11px;
          border-radius: 7px;
          cursor: pointer;
          font-size: 10px;
          font-weight: 800;
          white-space: nowrap;
        }

        .vendor-view-button:hover {
          background: #e3e6ee;
        }

        /* STATUS BADGE */

        .vendor-status-badge {
          display: inline-flex;
          align-items: center;
          padding: 5px 9px;
          border-radius: 20px;
          font-size: 9px;
          font-weight: 800;
          text-transform: capitalize;
          white-space: nowrap;
        }

        .status-active {
          background: #e8f7ee;
          color: #16803c;
        }

        .status-pending {
          background: #fff5dc;
          color: #9b6500;
        }

        .status-inactive {
          background: #f0f1f4;
          color: #666b76;
        }

        .status-suspended {
          background: #fff0f1;
          color: #b42318;
        }

        .status-default {
          background: #eef1f7;
          color: #555967;
        }

        /* EMPTY */

        .vendors-empty-state {
          text-align: center;
          padding: 60px 20px;
          color: #777b86;
        }

        .vendors-empty-icon,
        .vendors-loading-icon {
          width: 55px;
          height: 55px;
          margin: 0 auto 14px;
          border-radius: 14px;
          background: #eef1f7;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 25px;
        }

        .vendors-loading-icon {
          animation: vendorSpin 1s linear infinite;
        }

        @keyframes vendorSpin {
          from {
            transform: rotate(0deg);
          }

          to {
            transform: rotate(360deg);
          }
        }

        .vendors-empty-state h3 {
          margin: 0 0 7px;
          color: #33333f;
          font-size: 15px;
        }

        .vendors-empty-state p {
          margin: 0;
          font-size: 12px;
        }

        .clear-filter-button {
          margin-top: 15px;
          border: none;
          background: #17152f;
          color: #ffffff;
          padding: 9px 15px;
          border-radius: 7px;
          cursor: pointer;
          font-size: 11px;
          font-weight: 700;
        }

        /* FOOTER */

        .vendors-footer {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 15px;
          margin-top: 18px;
        }

        .vendors-footer-card {
          background: #ffffff;
          border-radius: 12px;
          padding: 17px;
          display: flex;
          align-items: center;
          gap: 12px;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
        }

        .vendors-footer-icon {
          width: 39px;
          height: 39px;
          border-radius: 9px;
          background: #eef1f7;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
        }

        .vendors-footer-card strong {
          display: block;
          font-size: 17px;
          color: #17152f;
        }

        .vendors-footer-card span {
          display: block;
          margin-top: 2px;
          color: #858894;
          font-size: 10px;
        }

        /* MODAL */

        .vendor-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(12, 13, 25, 0.48);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 2000;
          padding: 20px;
        }

        .vendor-modal {
          width: 100%;
          max-width: 720px;
          max-height: 90vh;
          overflow-y: auto;
          background: #ffffff;
          border-radius: 17px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
        }

        .vendor-modal-header {
          padding: 21px 23px;
          border-bottom: 1px solid #eeeeee;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }

        .vendor-modal-title-area {
          display: flex;
          align-items: center;
          gap: 13px;
        }

        .vendor-modal-company-icon {
          width: 49px;
          height: 49px;
          border-radius: 12px;
          background: #eef1f7;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #17152f;
          font-size: 18px;
          font-weight: 800;
        }

        .vendor-modal-title-area h2 {
          margin: 4px 0 3px;
          font-size: 19px;
          color: #17152f;
        }

        .vendor-modal-title-area p {
          margin: 0;
          font-size: 11px;
          color: #777b86;
        }

        .vendor-modal-close {
          width: 33px;
          height: 33px;
          border: none;
          border-radius: 50%;
          background: #f0f1f5;
          color: #555967;
          cursor: pointer;
          font-size: 22px;
          line-height: 1;
        }

        .vendor-modal-status {
          margin: 18px 23px 0;
          padding: 13px 15px;
          background: #f7f8fb;
          border-radius: 10px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .vendor-modal-status > span {
          font-size: 11px;
          font-weight: 700;
          color: #666a76;
        }

        .vendor-details-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 11px;
          padding: 18px 23px;
        }

        .vendor-detail-box {
          background: #f7f8fb;
          border-radius: 9px;
          padding: 12px 13px;
        }

        .vendor-detail-box.full-width {
          grid-column: 1 / -1;
        }

        .vendor-detail-label {
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.5px;
          color: #888b95;
          text-transform: uppercase;
          margin-bottom: 5px;
        }

        .vendor-detail-value {
          color: #30313d;
          font-size: 12px;
          font-weight: 650;
          word-break: break-word;
        }

        .vendor-modal-reliability {
          margin: 0 23px 20px;
          padding: 15px;
          border: 1px solid #e5e6eb;
          border-radius: 11px;
        }

        .modal-reliability-header {
          display: flex;
          justify-content: space-between;
          font-size: 11px;
          color: #6e717c;
          margin-bottom: 7px;
        }

        .modal-reliability-header strong {
          color: #17152f;
        }

        .modal-reliability-track {
          height: 7px;
          background: #e5e6eb;
          border-radius: 10px;
          overflow: hidden;
        }

        .modal-reliability-fill {
          height: 100%;
          background: #17152f;
          border-radius: 10px;
        }

        .vendor-modal-reliability p {
          margin: 7px 0 0;
          font-size: 10px;
          color: #8a8d97;
        }

        .vendor-modal-footer {
          padding: 15px 23px;
          border-top: 1px solid #eeeeee;
          display: flex;
          justify-content: flex-end;
        }

        .vendor-close-button {
          border: none;
          background: #17152f;
          color: #ffffff;
          padding: 10px 18px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 11px;
          font-weight: 700;
        }

        /* RESPONSIVE */

        @media (max-width: 1100px) {
          .category-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .vendor-cards-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .vendors-status-tabs {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        @media (max-width: 760px) {
          .procurement-vendors-page {
            padding: 15px;
          }

          .vendors-header {
            align-items: flex-start;
            flex-direction: column;
          }

          .vendors-refresh-button {
            width: 100%;
          }

          .vendors-status-tabs {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .category-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .vendor-cards-grid {
            grid-template-columns: 1fr;
          }

          .vendors-list-header {
            align-items: stretch;
            flex-direction: column;
          }

          .vendors-search {
            width: 100%;
          }

          .vendors-footer {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 480px) {
          .vendors-status-tabs,
          .category-grid {
            grid-template-columns: 1fr;
          }

          .vendor-details-grid {
            grid-template-columns: 1fr;
          }

          .vendor-detail-box.full-width {
            grid-column: auto;
          }
        }
      `}</style>
    </div>
  );
}

function StatusBadge({ value }) {
  const normalized = String(value || "pending")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  let className = "status-default";

  if (normalized === "active") {
    className = "status-active";
  } else if (normalized === "pending") {
    className = "status-pending";
  } else if (normalized === "inactive") {
    className = "status-inactive";
  } else if (normalized === "suspended") {
    className = "status-suspended";
  }

  return (
    <span className={`vendor-status-badge ${className}`}>
      {formatStatus(normalized)}
    </span>
  );
}

function DetailBox({ label, value, fullWidth = false }) {
  return (
    <div
      className={`vendor-detail-box ${
        fullWidth ? "full-width" : ""
      }`}
    >
      <div className="vendor-detail-label">{label}</div>

      <div className="vendor-detail-value">{value}</div>
    </div>
  );
}

function formatStatus(value) {
  if (!value) return "Unknown";

  return String(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getCompanyInitial(companyName) {
  if (!companyName) return "V";

  const words = String(companyName).trim().split(/\s+/);

  if (words.length >= 2) {
    return `${words[0][0]}${words[1][0]}`.toUpperCase();
  }

  return words[0].substring(0, 2).toUpperCase();
}

function getCategoryIcon(category) {
  const value = String(category || "").toLowerCase();

  if (
    value.includes("raw") ||
    value.includes("material") ||
    value.includes("metal")
  ) {
    return "🔩";
  }

  if (
    value.includes("technology") ||
    value.includes("software") ||
    value.includes("it")
  ) {
    return "💻";
  }

  if (
    value.includes("service") ||
    value.includes("consult")
  ) {
    return "🛠️";
  }

  if (
    value.includes("transport") ||
    value.includes("logistics")
  ) {
    return "🚚";
  }

  if (
    value.includes("office") ||
    value.includes("stationery")
  ) {
    return "📎";
  }

  if (
    value.includes("equipment") ||
    value.includes("machine")
  ) {
    return "⚙️";
  }

  if (
    value.includes("electrical") ||
    value.includes("electronic")
  ) {
    return "🔌";
  }

  if (
    value.includes("food") ||
    value.includes("catering")
  ) {
    return "🍱";
  }

  return "🏢";
}

export default ProcurementVendors;