import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export default function CreatingSummaryScreen({
    meetingName,
    onBack,
    title = "Creating Summary",
    steps = ["Transcribing meeting", "Analyzing agenda", "Extracting action items"],
    helperText = "This usually takes under a minute.",
    cancelLabel = "Cancel"
}) {
    return (
        <View style={styles.container}>
            <View style={styles.modalCard}>
                <Text style={styles.screenTitle}>{title}</Text>
                <View style={styles.stepList}>
                    {steps.map((step) => (
                        <View key={step} style={styles.stepRow}>
                            <Ionicons name="ellipse-outline" size={18} color="#9DC6EA" />
                            <Text style={styles.stepText}>{step}</Text>
                        </View>
                    ))}
                </View>
                <Text style={styles.helperText}>
                    {helperText}
                    {meetingName ? ` (${meetingName})` : ""}
                </Text>
                <TouchableOpacity style={styles.primaryButton} onPress={onBack}>
                    <Text style={styles.primaryButtonText}>{cancelLabel}</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 24
    },
    modalCard: {
        width: "100%",
        backgroundColor: "#FFFFFF",
        borderRadius: 20,
        paddingVertical: 22,
        paddingHorizontal: 22,
        shadowColor: "#0F172A",
        shadowOpacity: 0.1,
        shadowOffset: { width: 0, height: 10 },
        shadowRadius: 18,
        elevation: 8
    },
    screenTitle: {
        fontSize: 20,
        fontWeight: "700",
        color: "#2D3748",
        marginBottom: 16
    },
    stepList: {
        gap: 14
    },
    stepRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12
    },
    stepText: {
        fontSize: 15,
        color: "#5B667A",
        fontWeight: "600"
    },
    helperText: {
        marginTop: 16,
        fontSize: 14,
        color: "#6B7280",
        textAlign: "left"
    },
    primaryButton: {
        marginTop: 18,
        alignSelf: "center",
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 14,
        backgroundColor: "#1D71B8"
    },
    primaryButtonText: {
        fontSize: 12,
        color: "#FFFFFF",
        fontWeight: "600"
    }
});
