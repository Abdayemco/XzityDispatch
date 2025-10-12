import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function AppFooter() {
  return (
    <View style={styles.footer}>
      <Text style={styles.footerText}>© 2024 Xzity Dispatch</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    backgroundColor: "#f5f5f5",
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
    borderTopWidth: 1,
    borderTopColor: "#ddd",
  },
  footerText: {
    color: "#666",
    fontSize: 12,
  },
});
