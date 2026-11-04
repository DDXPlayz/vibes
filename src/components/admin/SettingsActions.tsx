"use client";

import { SaveStatus, api, useSaver } from "./ui";

export function SettingsActions({ isOwner }: { isOwner: boolean }) {
  const saver = useSaver();
  return (
    <div className="adm-card">
      <h2>Demo data</h2>
      <p className="adm-note">Restore the sample archive — every saree, artisan, order and page — to its original state. Uploaded files are kept.</p>
      <div className="row" style={{ marginTop: 16 }}>
        <button
          className="btn btn-ghost btn-sm"
          disabled={!isOwner}
          onClick={() => {
            if (confirm("Reset all data to the sample archive?")) saver.run(() => api("/api/admin/reset", "POST"));
          }}
        >
          Reset sample data
        </button>
        <SaveStatus state={saver.state} error={saver.error} />
      </div>
      {!isOwner && <p className="adm-note">Only the owner can reset data.</p>}
    </div>
  );
}
