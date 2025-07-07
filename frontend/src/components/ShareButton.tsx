import React from "react";
import {
  FaWhatsapp,
  FaFacebookMessenger,
  FaTelegram,
  FaXTwitter,
  FaLink
} from "react-icons/fa6";
import { MdSms } from "react-icons/md";

const shareUrl = window.location.origin;
const shareText = "Try Xzity for your next ride!";

const encodedUrl = encodeURIComponent(shareUrl);
const encodedText = encodeURIComponent(`${shareText} ${shareUrl}`);

export default function ShareButton() {
  return (
    <div style={{
      position: "absolute",
      top: 18,
      right: 18,
      zIndex: 100,
      display: "flex",
      gap: 10,
      background: "#fff",
      borderRadius: 30,
      boxShadow: "0 2px 8px #0001",
      padding: "6px 12px"
    }}>
      {/* WhatsApp */}
      <a
        href={`https://wa.me/?text=${encodedText}`}
        target="_blank"
        rel="noopener noreferrer"
        title="Share on WhatsApp"
        style={{ color: "#25D366" }}
      >
        <FaWhatsapp size={28} />
      </a>
      {/* Messenger */}
      <a
        href={`https://www.facebook.com/dialog/send?link=${encodedUrl}&app_id=1076997051024429&redirect_uri=${encodedUrl}`}
        target="_blank"
        rel="noopener noreferrer"
        title="Share on Messenger"
        style={{ color: "#0084ff" }}
      >
        <FaFacebookMessenger size={28} />
      </a>
      {/* Telegram */}
      <a
        href={`https://t.me/share/url?url=${encodedUrl}&text=${encodeURIComponent(shareText)}`}
        target="_blank"
        rel="noopener noreferrer"
        title="Share on Telegram"
        style={{ color: "#0088cc" }}
      >
        <FaTelegram size={28} />
      </a>
      {/* X / Twitter */}
      <a
        href={`https://twitter.com/intent/tweet?text=${encodedText}`}
        target="_blank"
        rel="noopener noreferrer"
        title="Share on X"
        style={{ color: "#000" }}
      >
        <FaXTwitter size={26} />
      </a>
      {/* SMS (mobile) */}
      <a
        href={`sms:?&body=${encodedText}`}
        title="Share via SMS"
        style={{ color: "#1976D2" }}
      >
        <MdSms size={26} />
      </a>
      {/* Copy link */}
      <button
        onClick={() => {
          navigator.clipboard.writeText(shareUrl);
          alert("Link copied!");
        }}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "#1976D2",
          fontSize: 26,
          padding: 0
        }}
        title="Copy link"
      >
        <FaLink size={26} />
      </button>
    </div>
  );
}