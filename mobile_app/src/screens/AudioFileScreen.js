import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export default function AudioFileScreen({ meetingName, onBack }) {
    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={onBack} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={22} color="#2D3748" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Upload Recording</Text>
                <View style={styles.headerSpacer} />
            </View>

            <View style={styles.card}>
                <Ionicons name="cloud-upload" size={36} color="#1D71B8" />
                <Text style={styles.title}>Select an audio file</Text>
                <Text style={styles.subtitle}>
                    Upload a recording for {meetingName || "your meeting"}.
                </Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F4F6FA",
        paddingHorizontal: 24,
        paddingTop: 56
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 32
    },
    backButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#FFFFFF",
        shadowColor: "#000",
        shadowOpacity: 0.06,
        shadowOffset: { width: 0, height: 4 },
        shadowRadius: 10,
        elevation: 4
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: "700",
        color: "#2D3748"
    },
    headerSpacer: {
        width: 36
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
        fontSize: 18,
        fontWeight: "700",
        color: "#2D3748"
    },
    subtitle: {
        marginTop: 8,
        fontSize: 14,
        color: "#64748B",
        textAlign: "center"
    }
});
