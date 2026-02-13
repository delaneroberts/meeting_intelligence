import React, { useEffect, useState } from "react";
import { View, Text, TextInput, StyleSheet, TouchableOpacity } from "react-native";

export default function MeetingNameScreen({
    onClose,
    onStart,
    initialValue = "",
    buttonLabel = "Start Recording"
}) {
    const [meetingName, setMeetingName] = useState(initialValue);

    useEffect(() => {
        setMeetingName(initialValue);
    }, [initialValue]);
    const canStart = meetingName.trim().length > 0;

    const handleStart = () => {
        if (!canStart) {
            return;
        }
        onStart?.(meetingName.trim());
    };

    return (
        <View style={styles.container}>
            <View style={styles.modal}>
                <View style={styles.header}>
                    <Text style={styles.title}>Meeting Name</Text>
                    {onClose && (
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Text style={styles.closeText}>✕</Text>
                        </TouchableOpacity>
                    )}
                </View>
                <TextInput
                    placeholder="Enter meeting name"
                    placeholderTextColor="#94A3B8"
                    style={styles.input}
                    value={meetingName}
                    onChangeText={setMeetingName}
                />
                <TouchableOpacity
                    style={[styles.startButton, !canStart && styles.startButtonDisabled]}
                    onPress={handleStart}
                    disabled={!canStart}
                >
                    <Text style={styles.startText}>{buttonLabel}</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        justifyContent: "center",
        alignItems: "center"
    },
    modal: {
        width: 260,
        paddingVertical: 16,
        paddingHorizontal: 18,
        borderRadius: 12,
        backgroundColor: "#FFFFFF",
        borderWidth: 1,
        borderColor: "#E2E8F0",
        shadowColor: "#0F172A",
        shadowOpacity: 0.18,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 10 },
        elevation: 8
    },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 10
    },
    title: {
        fontSize: 17,
        fontWeight: "600",
        color: "#0F172A",
        marginBottom: 0
    },
    closeButton: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#F1F5F9"
    },
    closeText: {
        fontSize: 14,
        color: "#64748B"
    },
    input: {
        height: 36,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: "#CBD5F5",
        backgroundColor: "#FFFFFF",
        paddingHorizontal: 12,
        fontSize: 13,
        color: "#0F172A"
    },
    startButton: {
        marginTop: 12,
        paddingVertical: 10,
        borderRadius: 10,
        alignItems: "center",
        backgroundColor: "#1D71B8"
    },
    startButtonDisabled: {
        backgroundColor: "#CBD5F5"
    },
    startText: {
        color: "#FFFFFF",
        fontSize: 13,
        fontWeight: "600"
    }
});
