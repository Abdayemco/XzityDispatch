import React from "react";
import logo from "../assets/logo.png";

export default function Logo() {
  return (
    <div style={{ textAlign: "center", margin: "2rem 0" }}>
      <img src={logo} alt="xzity Logo" width={180} />
    </div>
  );
}