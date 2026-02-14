import React from "react";
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export default function AudioFileScreen({ meetingName, onBack, visible = true }) {
    return (
        <Modal animationType="slide" transparent visible={visible}>
            <View style={styles.overlay}>
                <Pressable style={styles.backdrop} onPress={onBack} />
                <View style={styles.modalCard}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.headerTitle}>Upload Recording</Text>
                        <TouchableOpacity onPress={onBack} style={styles.closeButton}>
                            <Ionicons name="close" size={20} color="#2D3748" />
                        </TouchableOpacity>
                    </View>
                    <View style={styles.cardContent}>
                        <Ionicons name="cloud-upload" size={36} color="#1D71B8" />
                        <Text style={styles.title}>Select an audio file</Text>
                        <Text style={styles.subtitle}>
                            Upload a recording for {meetingName || "your meeting"}.
                        </Text>
                        <Text style={styles.allowedFiles}>
                            Allowed files: MP3, WAV, M4A.
                        </Text>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: "center",
        paddingHorizontal: 20,
        backgroundColor: "rgba(15, 23, 42, 0.45)"
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject
    },
    modalCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: 24,
        paddingHorizontal: 24,
        paddingVertical: 20,
        shadowColor: "#0F172A",
        shadowOpacity: 0.18,
        shadowOffset: { width: 0, height: 10 },
        shadowRadius: 20,
        elevation: 12
    },
    modalHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 20
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: "700",
        color: "#2D3748"
    },
    closeButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#F1F5F9"
    },
    cardContent: {
        alignItems: "center",
        paddingBottom: 8
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
    },
    allowedFiles: {
        marginTop: 12,
        fontSize: 13,
        color: "#475569",
        textAlign: "center"
    }
});
