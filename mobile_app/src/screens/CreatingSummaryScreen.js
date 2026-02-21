import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Animated } from "react-native";

function formatElapsed(seconds) {
    if (seconds == null || seconds < 0) return "";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}:${String(s).padStart(2, "0")}` : `0:${String(s).padStart(2, "0")}`;
}

export default function CreatingSummaryScreen({
    meetingName,
    onBack,
    title = "Creating Summary",
    steps = ["Transcribing meeting", "Analyzing agenda", "Extracting action items"],
    helperText = "This usually takes under a minute.",
    cancelLabel = "Cancel",
    progress = null,
    progressMessage = null,
    elapsedSeconds = null
}) {
    const progressAnim = useRef(new Animated.Value(0)).current;
    const hasServerProgress = typeof progress === "number" && progress >= 0;

    useEffect(() => {
        if (hasServerProgress) return;
        let mounted = true;
        const loop = () => {
            if (!mounted) return;
            progressAnim.setValue(0);
            Animated.timing(progressAnim, {
                toValue: 1,
                duration: 2000,
                useNativeDriver: false
            }).start(({ finished }) => {
                if (finished && mounted) loop();
            });
        };
        loop();
        return () => {
            mounted = false;
            progressAnim.stopAnimation();
        };
    }, [progressAnim, hasServerProgress]);

    const progressWidthPercent = hasServerProgress
        ? `${Math.round((progress || 0) * 100)}%`
        : null;
    const progressWidthAnimated = progressAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ["0%", "100%"]
    });

    return (
        <View style={styles.container}>
            <View style={styles.modalCard}>
                <Text style={styles.screenTitle}>{title}</Text>
                <View style={styles.progressBarTrack}>
                    {hasServerProgress ? (
                        <View style={[styles.progressBarFill, { width: progressWidthPercent }]} />
                    ) : (
                        <Animated.View style={[styles.progressBarFill, { width: progressWidthAnimated }]} />
                    )}
                </View>
                {typeof elapsedSeconds === "number" && elapsedSeconds >= 0 && (
                    <Text style={styles.elapsedText}>Elapsed: {formatElapsed(elapsedSeconds)}</Text>
                )}
                {hasServerProgress && progressMessage ? (
                    <Text style={styles.progressMessage}>{progressMessage}</Text>
                ) : (
                    <View style={styles.stepList}>
                        {steps.map((step) => (
                            <View key={step} style={styles.stepRow}>
                                <Text style={styles.stepText}>{step}</Text>
                            </View>
                        ))}
                    </View>
                )}
                {!hasServerProgress && (
                    <Text style={styles.helperText}>
                        {helperText}
                        {meetingName ? ` (${meetingName})` : ""}
                    </Text>
                )}
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
    progressBarTrack: {
        height: 6,
        backgroundColor: "#E2E8F0",
        borderRadius: 3,
        overflow: "hidden",
        marginBottom: 20
    },
    progressBarFill: {
        height: "100%",
        backgroundColor: "#1D71B8",
        borderRadius: 3
    },
    elapsedText: {
        fontSize: 14,
        color: "#6B7280",
        fontWeight: "600",
        textAlign: "center",
        marginBottom: 6
    },
    progressMessage: {
        fontSize: 15,
        color: "#5B667A",
        fontWeight: "600",
        textAlign: "center",
        marginBottom: 8
    },
    stepList: {
        gap: 14
    },
    stepRow: {
        alignItems: "center",
        justifyContent: "center"
    },
    stepText: {
        fontSize: 15,
        color: "#5B667A",
        fontWeight: "600",
        textAlign: "center"
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
