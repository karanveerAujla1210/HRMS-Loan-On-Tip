import PageHeader from "@/components/PageHeader";
import {
  MOBILE_APP_DOWNLOAD_PATH,
  MOBILE_APP_FILE_NAME,
  MOBILE_APP_VERSION,
} from "@/lib/mobile-app";

export default function DownloadAppPage() {
  return (
    <>
      <PageHeader
        title="Download Mobile App"
        subtitle="Get the HRMS app on your Android device"
      />
      <div className="page-body">
        <div
          className="card"
          style={{
            maxWidth: 500,
            margin: "0 auto",
            textAlign: "center",
            padding: "40px 20px",
          }}
        >
          <div style={{ fontSize: "48px", marginBottom: "20px" }}>Mobile</div>
          <h2 style={{ marginBottom: "15px" }}>Loan On Tip HRMS for Android</h2>
          <p
            style={{
              marginBottom: "10px",
              color: "var(--text-3)",
              fontWeight: 600,
            }}
          >
            Version {MOBILE_APP_VERSION}
          </p>
          <p style={{ marginBottom: "30px", color: "var(--gray-500)" }}>
            Install our mobile app to easily punch in, manage your attendance,
            and access self-service features directly from your phone.
          </p>
          <a
            href={MOBILE_APP_DOWNLOAD_PATH}
            download
            className="btn btn-primary"
            style={{ display: "inline-flex", gap: "8px", alignItems: "center" }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Download APK
          </a>

          <div
            style={{
              marginTop: "40px",
              textAlign: "left",
              fontSize: "14px",
              color: "var(--gray-500)",
            }}
          >
            <strong>Installation Instructions:</strong>
            <ol style={{ marginTop: "10px", paddingLeft: "20px" }}>
              <li>Tap the download button above.</li>
              <li>
                Once downloaded, open the <code>{MOBILE_APP_FILE_NAME}</code>{" "}
                file.
              </li>
              <li>
                If prompted, allow your browser to &quot;Install unknown apps&quot;.
              </li>
              <li>Follow the on-screen prompts to install.</li>
            </ol>
          </div>
        </div>
      </div>
    </>
  );
}
