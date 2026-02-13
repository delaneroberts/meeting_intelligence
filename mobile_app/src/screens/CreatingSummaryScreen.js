import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";

export default function CreatingSummaryScreen({ meetingName, onBack }) {
    return (
        <View style={styles.container}>
            <View style={styles.card}>
                <ActivityIndicator size="large" color="#1D71B8" />
                <Text style={styles.title}>Creating Summary</Text>
                <Text style={styles.subtitle}>
                    Preparing notes for {meetingName || "your meeting"}.
                </Text>
            </View>

            <TouchableOpacity style={styles.backButton} onPress={onBack}>
                <Text style={styles.backText}>Back to Home</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F4F6FA",
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 24
    },
    card: {
        backgroundColor: "#FFFFFF",
        borderRadius: 20,
        paddingVertical: 32,
        paddingHorizontal: 24,
        alignItems: "center",
        shadowColor: "#000",
        shadowOpacity: 0.08,
        shadowOffset: { width: 0, height: 8 },
        shadowRadius: 14,
        elevation: 6
    },
    title: {
        marginTop: 16,
        fontSize: 20,
        fontWeight: "700",
        color: "#2D3748"
    },
    subtitle: {
        marginTop: 8,
        fontSize: 14,
        color: "#64748B",
        textAlign: "center"
    },
    backButton: {
        marginTop: 24,
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 16,
        backgroundColor: "#1D71B8"
    },
    backText: {
        color: "#FFFFFF",
        fontWeight: "600",
        fontSize: 14
    }
});
