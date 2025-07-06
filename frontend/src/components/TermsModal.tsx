import React, { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";

export default function TermsModal({ onClose }: { onClose: () => void }) {
  const [content, setContent] = useState("");

  useEffect(() => {
    fetch("/assets/TERMS_AND_PRIVACY_POLICY.md")
      .then(res => res.text())
      .then(setContent);
  }, []);

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh",
      background: "rgba(0,0,0,0.30)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center"
    }}>
      <div style={{
        background: "#fff", borderRadius: 8, padding: 24, maxWidth: 520, boxShadow: "0 4px 24px #0003", position: "relative"
      }}>
        <h3 style={{ marginTop: 0 }}>Terms & Privacy Policy</h3>
        <div style={{ maxHeight: 360, overflowY: "auto", fontSize: 14, marginBottom: 12 }}>
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
        <button
          style={{
            background: "#1976D2",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            padding: "0.5em 1.2em",
            fontWeight: "bold"
          }}
          onClick={onClose}
        >
          Close
        </button>
      </div>
    </div>
  );
}