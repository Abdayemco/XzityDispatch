import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function AppHeader() {
  return (
    <View style={styles.header}>
      <Text style={styles.headerText}>Xzity Dispatch</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: "#1976D2",
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
  },
});
