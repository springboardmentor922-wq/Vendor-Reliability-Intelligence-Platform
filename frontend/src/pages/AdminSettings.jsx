import React, { useEffect, useState } from "react";
import DashboardLayout from "../components/DashboardLayout";

const STORAGE_KEY = "vriprm_admin_settings";

const defaultSettings = {
  organizationName: "VRIPRM",
  organizationEmail: "",
  phone: "",
  currency: "INR (₹)",

  vendorApproval: true,
  complianceReminder: true,
  complianceReminderDays: "30",

  procurementNotifications: true,
  poNotifications: true,
  deliveryNotifications: true,
  invoiceNotifications: true,
  paymentNotifications: true,
  contractNotifications: true,
  emailNotifications: true,

  sessionTimeout: "30",
  passwordExpiry: "90",

  itemsPerPage: "10",
  dateFormat: "DD/MM/YYYY",
};

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      onClick={onChange}
      aria-pressed={checked}
      style={{
        width: "46px",
        height: "24px",
        borderRadius: "20px",
        border: "none",
        backgroundColor: checked ? "#2563eb" : "#cbd5e1",
        cursor: "pointer",
        position: "relative",
        padding: 0,
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: "3px",
          left: checked ? "25px" : "3px",
          width: "18px",
          height: "18px",
          borderRadius: "50%",
          backgroundColor: "#ffffff",
          transition: "left 0.2s ease",
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.2)",
        }}
      />
    </button>
  );
}

function Section({ icon, title, description, children }) {
  return (
    <div style={styles.section}>
      <div style={styles.sectionHeader}>
        <div style={styles.sectionIcon}>{icon}</div>

        <div>
          <h3 style={styles.sectionTitle}>{title}</h3>

          <p style={styles.sectionDescription}>
            {description}
          </p>
        </div>
      </div>

      <div style={styles.sectionContent}>{children}</div>
    </div>
  );
}

function SettingRow({ title, description, children }) {
  return (
    <div style={styles.settingRow}>
      <div style={styles.settingInfo}>
        <div style={styles.settingTitle}>{title}</div>

        <div style={styles.settingDescription}>
          {description}
        </div>
      </div>

      <div style={styles.settingControl}>{children}</div>
    </div>
  );
}

function AdminSettings() {
  const [settings, setSettings] = useState(() => {
    try {
      const savedSettings = localStorage.getItem(STORAGE_KEY);

      if (savedSettings) {
        return {
          ...defaultSettings,
          ...JSON.parse(savedSettings),
        };
      }
    } catch (error) {
      console.error("Failed to load settings:", error);
    }

    return defaultSettings;
  });

  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSaved(false);
  }, [settings]);

  const handleChange = (field, value) => {
    setSettings((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const handleSave = () => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(settings)
      );

      setSaved(true);

      setTimeout(() => {
        setSaved(false);
      }, 3000);
    } catch (error) {
      console.error("Failed to save settings:", error);
    }
  };

  return (
    <DashboardLayout
      title="Settings"
      role="Administrator"
      menuItems={[
        "Dashboard",
        "Users",
        "Vendors",
        "Suppliers",
        "Procurement",
        "Purchase Orders",
        "Risk Analysis",
        "Contract & Compliance",
        "Reports",
        "Settings",
        "Notifications",
      ]}
    >
      <div style={styles.page}>
        <div style={styles.header}>
          <div>
            <div style={styles.breadcrumb}>
              Administration / Settings
            </div>

            <h1 style={styles.pageTitle}>
              System Settings
            </h1>

            <p style={styles.pageSubtitle}>
              Manage organization, procurement, notifications,
              security, and system preferences.
            </p>
          </div>

          <button
            type="button"
            onClick={handleSave}
            style={styles.saveButton}
          >
            Save Changes
          </button>
        </div>

        {saved && (
          <div style={styles.successMessage}>
            <span>✓</span>
            <span>Settings saved successfully.</span>
          </div>
        )}

        {/* ORGANIZATION */}

        <Section
          icon="🏢"
          title="Organization"
          description="Manage the organization information used throughout VRIPRM."
        >
          <div style={styles.formGrid}>
            <div style={styles.field}>
              <label style={styles.label}>
                Organization Name
              </label>

              <input
                type="text"
                value={settings.organizationName}
                onChange={(event) =>
                  handleChange(
                    "organizationName",
                    event.target.value
                  )
                }
                style={styles.input}
                placeholder="Enter organization name"
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>
                Organization Email
              </label>

              <input
                type="email"
                value={settings.organizationEmail}
                onChange={(event) =>
                  handleChange(
                    "organizationEmail",
                    event.target.value
                  )
                }
                style={styles.input}
                placeholder="admin@example.com"
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>
                Contact Phone
              </label>

              <input
                type="text"
                value={settings.phone}
                onChange={(event) =>
                  handleChange(
                    "phone",
                    event.target.value
                  )
                }
                style={styles.input}
                placeholder="+91 XXXXX XXXXX"
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>
                Currency
              </label>

              <select
                value={settings.currency}
                onChange={(event) =>
                  handleChange(
                    "currency",
                    event.target.value
                  )
                }
                style={styles.input}
              >
                <option value="INR (₹)">INR (₹)</option>
                <option value="USD ($)">USD ($)</option>
                <option value="EUR (€)">EUR (€)</option>
                <option value="GBP (£)">GBP (£)</option>
              </select>
            </div>
          </div>
        </Section>

        {/* PROCUREMENT */}

        <Section
          icon="🛒"
          title="Procurement"
          description="Configure procurement and compliance preferences."
        >
          <SettingRow
            title="Vendor Approval Required"
            description="New vendors must be approved before becoming active."
          >
            <Toggle
              checked={settings.vendorApproval}
              onChange={() =>
                handleChange(
                  "vendorApproval",
                  !settings.vendorApproval
                )
              }
            />
          </SettingRow>

          <SettingRow
            title="Compliance Expiry Reminder"
            description="Enable reminders for vendor documents approaching expiry."
          >
            <Toggle
              checked={settings.complianceReminder}
              onChange={() =>
                handleChange(
                  "complianceReminder",
                  !settings.complianceReminder
                )
              }
            />
          </SettingRow>

          {settings.complianceReminder && (
            <div style={styles.inlineField}>
              <div>
                <div style={styles.settingTitle}>
                  Reminder Period
                </div>

                <div style={styles.settingDescription}>
                  Number of days before document expiry.
                </div>
              </div>

              <select
                value={settings.complianceReminderDays}
                onChange={(event) =>
                  handleChange(
                    "complianceReminderDays",
                    event.target.value
                  )
                }
                style={styles.smallInput}
              >
                <option value="7">7 days</option>
                <option value="15">15 days</option>
                <option value="30">30 days</option>
                <option value="60">60 days</option>
                <option value="90">90 days</option>
              </select>
            </div>
          )}
        </Section>

        {/* NOTIFICATIONS */}

        <Section
          icon="🔔"
          title="Notifications"
          description="Control notifications generated by important system events."
        >
          <SettingRow
            title="Procurement Notifications"
            description="Notify users when procurement requests are created or updated."
          >
            <Toggle
              checked={settings.procurementNotifications}
              onChange={() =>
                handleChange(
                  "procurementNotifications",
                  !settings.procurementNotifications
                )
              }
            />
          </SettingRow>

          <SettingRow
            title="Purchase Order Notifications"
            description="Notify users about purchase order creation, approval, and status changes."
          >
            <Toggle
              checked={settings.poNotifications}
              onChange={() =>
                handleChange(
                  "poNotifications",
                  !settings.poNotifications
                )
              }
            />
          </SettingRow>

          <SettingRow
            title="Delivery Notifications"
            description="Notify users about shipments, deliveries, and delays."
          >
            <Toggle
              checked={settings.deliveryNotifications}
              onChange={() =>
                handleChange(
                  "deliveryNotifications",
                  !settings.deliveryNotifications
                )
              }
            />
          </SettingRow>

          <SettingRow
            title="Invoice Notifications"
            description="Notify finance users when invoices are submitted or updated."
          >
            <Toggle
              checked={settings.invoiceNotifications}
              onChange={() =>
                handleChange(
                  "invoiceNotifications",
                  !settings.invoiceNotifications
                )
              }
            />
          </SettingRow>

          <SettingRow
            title="Payment Notifications"
            description="Notify users when payments are processed or completed."
          >
            <Toggle
              checked={settings.paymentNotifications}
              onChange={() =>
                handleChange(
                  "paymentNotifications",
                  !settings.paymentNotifications
                )
              }
            />
          </SettingRow>

          <SettingRow
            title="Contract Notifications"
            description="Notify administrators about upcoming contract expiry."
          >
            <Toggle
              checked={settings.contractNotifications}
              onChange={() =>
                handleChange(
                  "contractNotifications",
                  !settings.contractNotifications
                )
              }
            />
          </SettingRow>

          <SettingRow
            title="Email Notifications"
            description="Enable email notifications for supported system events."
          >
            <Toggle
              checked={settings.emailNotifications}
              onChange={() =>
                handleChange(
                  "emailNotifications",
                  !settings.emailNotifications
                )
              }
            />
          </SettingRow>
        </Section>

        {/* SECURITY */}

        <Section
          icon="🔐"
          title="Security"
          description="Configure basic authentication and session preferences."
        >
          <div style={styles.formGrid}>
            <div style={styles.field}>
              <label style={styles.label}>
                Session Timeout
              </label>

              <select
                value={settings.sessionTimeout}
                onChange={(event) =>
                  handleChange(
                    "sessionTimeout",
                    event.target.value
                  )
                }
                style={styles.input}
              >
                <option value="15">15 minutes</option>
                <option value="30">30 minutes</option>
                <option value="60">1 hour</option>
                <option value="120">2 hours</option>
              </select>
            </div>

            <div style={styles.field}>
              <label style={styles.label}>
                Password Expiry
              </label>

              <select
                value={settings.passwordExpiry}
                onChange={(event) =>
                  handleChange(
                    "passwordExpiry",
                    event.target.value
                  )
                }
                style={styles.input}
              >
                <option value="30">30 days</option>
                <option value="60">60 days</option>
                <option value="90">90 days</option>
                <option value="180">180 days</option>
                <option value="0">Never</option>
              </select>
            </div>
          </div>
        </Section>

        {/* SYSTEM PREFERENCES */}

        <Section
          icon="⚙️"
          title="System Preferences"
          description="Configure how records and dates are displayed."
        >
          <div style={styles.formGrid}>
            <div style={styles.field}>
              <label style={styles.label}>
                Date Format
              </label>

              <select
                value={settings.dateFormat}
                onChange={(event) =>
                  handleChange(
                    "dateFormat",
                    event.target.value
                  )
                }
                style={styles.input}
              >
                <option value="DD/MM/YYYY">
                  DD/MM/YYYY
                </option>

                <option value="MM/DD/YYYY">
                  MM/DD/YYYY
                </option>

                <option value="YYYY-MM-DD">
                  YYYY-MM-DD
                </option>
              </select>
            </div>

            <div style={styles.field}>
              <label style={styles.label}>
                Records Per Page
              </label>

              <select
                value={settings.itemsPerPage}
                onChange={(event) =>
                  handleChange(
                    "itemsPerPage",
                    event.target.value
                  )
                }
                style={styles.input}
              >
                <option value="10">10 records</option>
                <option value="25">25 records</option>
                <option value="50">50 records</option>
                <option value="100">100 records</option>
              </select>
            </div>
          </div>
        </Section>

        <div style={styles.bottomActions}>
          <button
            type="button"
            onClick={handleSave}
            style={styles.saveButton}
          >
            Save Changes
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}

const styles = {
  page: {
    padding: "28px",
    backgroundColor: "#f6f8fb",
    minHeight: "100%",
    fontFamily:
      "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: "20px",
    marginBottom: "24px",
  },

  breadcrumb: {
    fontSize: "13px",
    color: "#64748b",
    marginBottom: "8px",
  },

  pageTitle: {
    margin: 0,
    fontSize: "28px",
    fontWeight: 700,
    color: "#0f172a",
  },

  pageSubtitle: {
    margin: "8px 0 0",
    color: "#64748b",
    fontSize: "14px",
    lineHeight: 1.6,
  },

  saveButton: {
    border: "none",
    backgroundColor: "#2563eb",
    color: "#ffffff",
    padding: "11px 18px",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
    boxShadow: "0 2px 5px rgba(37, 99, 235, 0.2)",
  },

  successMessage: {
    display: "flex",
    alignItems: "center",
    gap: "9px",
    backgroundColor: "#ecfdf5",
    color: "#047857",
    border: "1px solid #a7f3d0",
    borderRadius: "8px",
    padding: "12px 16px",
    marginBottom: "18px",
    fontSize: "14px",
    fontWeight: 500,
  },

  section: {
    backgroundColor: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: "12px",
    marginBottom: "18px",
    overflow: "hidden",
    boxShadow: "0 1px 3px rgba(15, 23, 42, 0.04)",
  },

  sectionHeader: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
    padding: "20px 22px",
    borderBottom: "1px solid #e2e8f0",
    backgroundColor: "#fafbfc",
  },

  sectionIcon: {
    width: "42px",
    height: "42px",
    borderRadius: "9px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eff6ff",
    fontSize: "19px",
    flexShrink: 0,
  },

  sectionTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: "16px",
    fontWeight: 600,
  },

  sectionDescription: {
    margin: "4px 0 0",
    color: "#64748b",
    fontSize: "13px",
  },

  sectionContent: {
    padding: "4px 22px",
  },

  settingRow: {
    minHeight: "72px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "30px",
    borderBottom: "1px solid #eef2f7",
    padding: "14px 0",
  },

  settingInfo: {
    flex: 1,
  },

  settingTitle: {
    color: "#1e293b",
    fontSize: "14px",
    fontWeight: 600,
    marginBottom: "4px",
  },

  settingDescription: {
    color: "#64748b",
    fontSize: "12px",
    lineHeight: 1.5,
  },

  settingControl: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
  },

  formGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(260px, 1fr))",
    gap: "20px",
    padding: "20px 0",
  },

  field: {
    display: "flex",
    flexDirection: "column",
    gap: "7px",
  },

  label: {
    fontSize: "13px",
    fontWeight: 600,
    color: "#334155",
  },

  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: "11px 12px",
    border: "1px solid #cbd5e1",
    borderRadius: "7px",
    backgroundColor: "#ffffff",
    color: "#1e293b",
    fontSize: "14px",
    outline: "none",
    caretColor: "#0f172a",
  },

  smallInput: {
    width: "150px",
    padding: "9px 10px",
    border: "1px solid #cbd5e1",
    borderRadius: "7px",
    backgroundColor: "#ffffff",
    color: "#1e293b",
    fontSize: "13px",
    outline: "none",
  },

  inlineField: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "20px",
    padding: "16px 0",
    borderBottom: "1px solid #eef2f7",
  },

  bottomActions: {
    display: "flex",
    justifyContent: "flex-end",
    paddingBottom: "20px",
  },
};

export default AdminSettings;