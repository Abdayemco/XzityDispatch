import React, { useState } from "react";
// Only import react-native if not web
const isWeb = typeof window !== "undefined" && typeof document !== "undefined";
let Platform: any, View: any, Text: any, TouchableOpacity: any, Modal: any, TextInput: any, StyleSheet: any, ActivityIndicator: any;
if (!isWeb) {
  // @ts-ignore
  ({ Platform, View, Text, TouchableOpacity, Modal, TextInput, StyleSheet, ActivityIndicator } = require("react-native"));
}
import { API_URL } from "../utils/config";

const API = API_URL.replace(/\/$/, "");

export default function ContactAdminButton() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", tel: "", message: "" });
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (key: string, value: string) =>
    setForm({ ...form, [key]: value });

  const handleClose = () => {
    setOpen(false);
    setSent(false);
    setError("");
    setForm({ name: "", tel: "", message: "" });
  };

  const handleSubmit = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/contact-admin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Failed to send message");
      setSent(true);
    } catch {
      setError("Failed to send message. Please try again.");
    }
    setLoading(false);
  };

  // Web version (standard React)
  if (isWeb) {
    return (
      <>
        <button
          onClick={() => setOpen(true)}
          style={{
            position: "fixed",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            background: "#1976D2",
            color: "#fff",
            border: "none",
            padding: "12px 22px",
            borderRadius: 28,
            fontWeight: 600,
            fontSize: 17,
            cursor: "pointer",
            zIndex: 10000,
            boxShadow: "0 2px 12px #0002",
          }}
        >
          Contact Administrator
        </button>
        {open && (
          <div
            style={{
              position: "fixed",
              left: 0,
              top: 0,
              width: "100vw",
              height: "100vh",
              background: "rgba(0,0,0,0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999,
            }}
            onClick={handleClose}
          >
            <div
              style={{
                background: "#fff",
                padding: 32,
                borderRadius: 10,
                minWidth: 320,
                maxWidth: "90vw",
                boxShadow: "0 2px 24px #0003",
                position: "relative",
              }}
              onClick={e => e.stopPropagation()}
            >
              <button
                onClick={handleClose}
                style={{
                  position: "absolute",
                  right: 12,
                  top: 12,
                  background: "transparent",
                  border: "none",
                  fontSize: 22,
                  cursor: "pointer",
                  color: "#888",
                }}
                aria-label="Close"
                title="Close"
                type="button"
              >
                ×
              </button>
              <h3 style={{ marginTop: 0, marginBottom: 20, color: "#1976D2" }}>
                Contact Administrator
              </h3>
              {sent ? (
                <p
                  style={{
                    color: "#388e3c",
                    textAlign: "center",
                    fontWeight: 500,
                  }}
                >
                  Message sent to admin!
                </p>
              ) : (
                <form
                  onSubmit={e => {
                    e.preventDefault();
                    handleSubmit();
                  }}
                  style={{ minWidth: 260 }}
                >
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: "block", marginBottom: 2 }}>
                      Name:
                    </label>
                    <input
                      name="name"
                      value={form.name}
                      onChange={e => handleChange("name", e.target.value)}
                      required
                      style={{
                        width: "100%",
                        padding: "7px",
                        borderRadius: 5,
                        border: "1px solid #ccc",
                      }}
                    />
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: "block", marginBottom: 2 }}>
                      Tel:
                    </label>
                    <input
                      name="tel"
                      value={form.tel}
                      onChange={e => handleChange("tel", e.target.value)}
                      required
                      style={{
                        width: "100%",
                        padding: "7px",
                        borderRadius: 5,
                        border: "1px solid #ccc",
                      }}
                    />
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: "block", marginBottom: 2 }}>
                      Message:
                    </label>
                    <textarea
                      name="message"
                      value={form.message}
                      onChange={e => handleChange("message", e.target.value)}
                      required
                      rows={3}
                      style={{
                        width: "100%",
                        padding: "7px",
                        borderRadius: 5,
                        border: "1px solid #ccc",
                      }}
                    />
                  </div>
                  <button
                    type="submit"
                    style={{
                      background: "#1976D2",
                      color: "#fff",
                      border: "none",
                      padding: "9px 24px",
                      borderRadius: 6,
                      fontWeight: 600,
                      fontSize: 16,
                      cursor: "pointer",
                      width: "100%",
                    }}
                  >
                    {loading ? "Sending..." : "Send"}
                  </button>
                  {error && (
                    <p
                      style={{
                        color: "#d32f2f",
                        marginTop: 8,
                        textAlign: "center",
                      }}
                    >
                      {error}
                    </p>
                  )}
                </form>
              )}
            </div>
          </div>
        )}
      </>
    );
  }

  // Native version (Expo/React Native)
  if (!isWeb) {
    return (
      <>
        <TouchableOpacity
          style={styles.button}
          onPress={() => setOpen(true)}
          activeOpacity={0.85}
        >
          <Text style={styles.buttonText}>Contact Administrator</Text>
        </TouchableOpacity>
        <Modal
          visible={open}
          animationType="slide"
          transparent
          onRequestClose={handleClose}
        >
          <View style={styles.modalBg}>
            <View style={styles.modalContent}>
              <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
                <Text style={{ fontSize: 23, color: "#888" }}>×</Text>
              </TouchableOpacity>
              <Text style={styles.title}>Contact Administrator</Text>
              {sent ? (
                <Text style={styles.successMsg}>Message sent to admin!</Text>
              ) : (
                <>
                  <TextInput
                    style={styles.input}
                    placeholder="Name"
                    value={form.name}
                    onChangeText={t => handleChange("name", t)}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Tel"
                    value={form.tel}
                    onChangeText={t => handleChange("tel", t)}
                    keyboardType="phone-pad"
                  />
                  <TextInput
                    style={[styles.input, { height: 100 }]}
                    placeholder="Message"
                    value={form.message}
                    onChangeText={t => handleChange("message", t)}
                    multiline
                  />
                  <TouchableOpacity
                    style={styles.submitBtn}
                    onPress={handleSubmit}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.submitBtnText}>Send</Text>
                    )}
                  </TouchableOpacity>
                  {error ? (
                    <Text style={styles.errorMsg}>{error}</Text>
                  ) : null}
                </>
              )}
            </View>
          </View>
        </Modal>
      </>
    );
  }

  return null;
}

const styles = !isWeb
  ? StyleSheet.create({
      button: {
        position: "absolute",
        bottom: 18,
        alignSelf: "center",
        backgroundColor: "#1976D2",
        paddingVertical: 11,
        paddingHorizontal: 30,
        borderRadius: 24,
        zIndex: 10000,
        elevation: 3,
      },
      buttonText: { color: "#fff", fontWeight: "bold", fontSize: 17 },
      modalBg: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.35)",
        justifyContent: "center",
        alignItems: "center",
      },
      modalContent: {
        backgroundColor: "#fff",
        borderRadius: 12,
        padding: 24,
        width: 330,
        maxWidth: "90%",
        shadowColor: "#000",
        shadowOpacity: 0.18,
        shadowRadius: 8,
        elevation: 7,
      },
      closeBtn: { position: "absolute", right: 12, top: 8, zIndex: 2 },
      title: {
        fontSize: 19,
        fontWeight: "bold",
        color: "#1976d2",
        marginTop: 4,
        marginBottom: 18,
        alignSelf: "center",
      },
      input: {
        borderWidth: 1,
        borderColor: "#ccc",
        borderRadius: 6,
        padding: 10,
        marginBottom: 13,
        fontSize: 15,
      },
      submitBtn: {
        backgroundColor: "#1976D2",
        padding: 11,
        borderRadius: 8,
        marginTop: 5,
        alignItems: "center",
      },
      submitBtnText: { color: "#fff", fontWeight: "bold", fontSize: 17 },
      errorMsg: { marginTop: 8, color: "#d32f2f", textAlign: "center" },
      successMsg: {
        color: "#388e3c",
        textAlign: "center",
        fontWeight: "bold",
        marginVertical: 14,
        fontSize: 16,
      },
    })
  : undefined;