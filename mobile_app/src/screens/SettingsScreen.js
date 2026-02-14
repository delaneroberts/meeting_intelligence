import React, { useMemo } from "react";
import {
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

const OptionGroup = ({ options, selected, onChange }) => (
    <View style={styles.optionGroup}>
        {options.map((option) => {
            const isActive = option === selected;
            return (
                <TouchableOpacity
                    key={option}
                    onPress={() => onChange(option)}
                    style={[styles.optionButton, isActive && styles.optionButtonActive]}
                >
                    <Text style={[styles.optionText, isActive && styles.optionTextActive]}>
                        {option}
                    </Text>
                </TouchableOpacity>
            );
        })}
    </View>
);

const SettingToggle = ({ label, value, onValueChange, description }) => (
    <View style={styles.settingRow}>
        <View style={styles.settingTextBlock}>
            <Text style={styles.settingLabel}>{label}</Text>
            {description ? <Text style={styles.settingDescription}>{description}</Text> : null}
        </View>
        <Switch value={value} onValueChange={onValueChange} />
    </View>
);

export default function SettingsScreen({
    onClose,
    onShowHome,
    onShowLibrary,
    settings,
    onSettingsChange
}) {
    const recordingOptions = useMemo(() => ["Standard", "High", "Lossless"], []);
    const summaryOptions = useMemo(() => ["Short", "Medium", "Detailed"], []);
    const themeOptions = useMemo(() => ["Light", "Dark", "System"], []);

    const {
        recordingQuality = "Standard",
        autoTranscribe = true,
        autoSummary = true,
    promptSummaryLength = true,
        summaryLength = "Medium",
        meetingNameFormat = "Untitled {date} {time}",
        backgroundRecording = false,
        announceRecordingInProgress = true,
        announceRecordingStopped = true,
        wifiOnly = true,
        maxFileSize = "200",
        notifySummaryReady = true,
        notifyUploadComplete = true,
        notifyErrors = true,
        theme = "System",
        language = "English",
        forceDefaultLanguage = false
    } = settings || {};

    const handleChange = (key, value) => {
        onSettingsChange?.({ [key]: value });
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Settings</Text>
                <TouchableOpacity onPress={onClose} style={styles.headerButton}>
                    <Ionicons name="close" size={20} color="#64748B" />
                </TouchableOpacity>
            </View>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Recording</Text>
                    <Text style={styles.sectionLabel}>Default recording quality</Text>
                    <OptionGroup
                        options={recordingOptions}
                        selected={recordingQuality}
                        onChange={(value) => handleChange("recordingQuality", value)}
                    />
                    <SettingToggle
                        label="Keep recording when the screen locks or you switch apps"
                        value={backgroundRecording}
                        onValueChange={(value) => handleChange("backgroundRecording", value)}
                    />
                    <SettingToggle
                        label="Auto-announce that a recording is in progress"
                        value={announceRecordingInProgress}
                        onValueChange={(value) =>
                            handleChange("announceRecordingInProgress", value)
                        }
                    />
                    <SettingToggle
                        label="Auto-announce when recording stops"
                        value={announceRecordingStopped}
                        onValueChange={(value) => handleChange("announceRecordingStopped", value)}
                    />
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Transcription & Summary</Text>
                    <SettingToggle
                        label="Auto-transcribe after upload"
                        value={autoTranscribe}
                        onValueChange={(value) => handleChange("autoTranscribe", value)}
                    />
                    <SettingToggle
                        label="Auto-generate summary"
                        value={autoSummary}
                        onValueChange={(value) => handleChange("autoSummary", value)}
                    />
                    <SettingToggle
                        label="Prompt for summary length"
                        value={promptSummaryLength}
                        onValueChange={(value) =>
                            handleChange("promptSummaryLength", value)
                        }
                    />
                    <Text style={styles.sectionLabel}>Preferred summary length</Text>
                    <OptionGroup
                        options={summaryOptions}
                        selected={summaryLength}
                        onChange={(value) => handleChange("summaryLength", value)}
                    />
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Meeting Defaults</Text>
                    <Text style={styles.sectionLabel}>Default meeting name format</Text>
                    <TextInput
                        value={meetingNameFormat}
                        onChangeText={(value) => handleChange("meetingNameFormat", value)}
                        style={styles.textInput}
                        placeholder="Untitled {date} {time}"
                        placeholderTextColor="#94A3B8"
                    />
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Storage & Cleanup</Text>
                    <View style={styles.settingRow}>
                        <View>
                            <Text style={styles.settingLabel}>Storage usage</Text>
                            <Text style={styles.settingDescription}>2.4 GB used</Text>
                        </View>
                        <TouchableOpacity style={styles.smallButton}>
                            <Text style={styles.smallButtonText}>Clear Cache</Text>
                        </TouchableOpacity>
                    </View>
                    <TouchableOpacity style={styles.secondaryButton}>
                        <Text style={styles.secondaryButtonText}>Remove Old Uploads</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Upload Settings</Text>
                    <SettingToggle
                        label="Wi-Fi only uploads"
                        value={wifiOnly}
                        onValueChange={(value) => handleChange("wifiOnly", value)}
                    />
                    <Text style={styles.sectionLabel}>Max file size (MB)</Text>
                    <TextInput
                        value={maxFileSize}
                        onChangeText={(value) => handleChange("maxFileSize", value)}
                        style={styles.textInput}
                        keyboardType="numeric"
                    />
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Notifications</Text>
                    <SettingToggle
                        label="Summary ready"
                        value={notifySummaryReady}
                        onValueChange={(value) => handleChange("notifySummaryReady", value)}
                    />
                    <SettingToggle
                        label="Upload complete"
                        value={notifyUploadComplete}
                        onValueChange={(value) => handleChange("notifyUploadComplete", value)}
                    />
                    <SettingToggle
                        label="Errors & failures"
                        value={notifyErrors}
                        onValueChange={(value) => handleChange("notifyErrors", value)}
                    />
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Appearance</Text>
                    <Text style={styles.sectionLabel}>Theme</Text>
                    <OptionGroup
                        options={themeOptions}
                        selected={theme}
                        onChange={(value) => handleChange("theme", value)}
                    />
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Language</Text>
                    <Text style={styles.sectionLabel}>Default language</Text>
                    <TextInput
                        value={language}
                        onChangeText={(value) => handleChange("language", value)}
                        style={styles.textInput}
                        placeholder="English"
                        placeholderTextColor="#94A3B8"
                    />
                    <SettingToggle
                        label="Always transcribe and summarize in default language"
                        value={forceDefaultLanguage}
                        onValueChange={(value) => handleChange("forceDefaultLanguage", value)}
                    />
                </View>
            </ScrollView>

            <View style={styles.tabBar}>
                <TouchableOpacity style={styles.tabItem} onPress={onShowHome}>
                    <Ionicons name="home" size={22} color="#94A3B8" />
                    <Text style={styles.tabLabel}>Home</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.tabItem} onPress={onShowLibrary}>
                    <Ionicons name="albums" size={22} color="#94A3B8" />
                    <Text style={styles.tabLabel}>Library</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.tabItem} activeOpacity={0.8}>
                    <Ionicons name="settings" size={22} color="#1D71B8" />
                    <Text style={styles.tabLabelActive}>Settings</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F1F5F9",
        paddingTop: 56,
        paddingHorizontal: 24
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 20
    },
    headerTitle: {
        fontSize: 26,
        fontWeight: "700",
        color: "#2D3748"
    },
    headerButton: {
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
    scrollContent: {
        paddingBottom: 140,
        gap: 18
    },
    section: {
        backgroundColor: "#FFFFFF",
        borderRadius: 18,
        padding: 16,
        gap: 12,
        shadowColor: "#000",
        shadowOpacity: 0.06,
        shadowOffset: { width: 0, height: 6 },
        shadowRadius: 12,
        elevation: 4
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: "700",
        color: "#1E293B"
    },
    sectionLabel: {
        fontSize: 13,
        color: "#64748B",
        fontWeight: "600"
    },
    optionGroup: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8
    },
    optionButton: {
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 12,
        backgroundColor: "#E2E8F0"
    },
    optionButtonActive: {
        backgroundColor: "#1D71B8"
    },
    optionText: {
        fontSize: 13,
        color: "#334155",
        fontWeight: "600"
    },
    optionTextActive: {
        color: "#FFFFFF"
    },
    settingRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12
    },
    settingTextBlock: {
        flex: 1
    },
    settingLabel: {
        fontSize: 14,
        fontWeight: "600",
        color: "#1E293B"
    },
    settingDescription: {
        marginTop: 4,
        fontSize: 12,
        color: "#94A3B8"
    },
    textInput: {
        height: 40,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: "#E2E8F0",
        paddingHorizontal: 12,
        fontSize: 13,
        color: "#0F172A"
    },
    smallButton: {
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 10,
        backgroundColor: "#1D71B8"
    },
    smallButtonText: {
        color: "#FFFFFF",
        fontSize: 12,
        fontWeight: "600"
    },
    secondaryButton: {
        paddingVertical: 10,
        borderRadius: 10,
        backgroundColor: "#E2E8F0",
        alignItems: "center"
    },
    secondaryButtonText: {
        color: "#1D71B8",
        fontWeight: "600",
        fontSize: 13
    },
    tabBar: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "#FFFFFF",
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 36,
        paddingTop: 10,
        paddingBottom: 18,
        flexDirection: "row",
        justifyContent: "space-between",
        shadowColor: "#000",
        shadowOpacity: 0.05,
        shadowOffset: { width: 0, height: -4 },
        shadowRadius: 10,
        elevation: 12
    },
    tabItem: {
        alignItems: "center",
        gap: 4
    },
    tabLabel: {
        fontSize: 12,
        color: "#94A3B8"
    },
    tabLabelActive: {
        fontSize: 12,
        color: "#1D71B8",
        fontWeight: "600"
    }
});
