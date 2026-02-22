/**
 * Manage Templates modal: list templates, Create New with name + prompt textarea (pre-filled with Standard).
 */
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getTemplates, createTemplate } from "../api/client";

const DEFAULT_PROMPT_PLACEHOLDER = "Summarize the transcript in 5-10 bullet points. List action items as bullets.";

export default function ManageTemplatesModal({ visible, onClose, onTemplatesUpdated }) {
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [createName, setCreateName] = useState("");
    const [createPromptText, setCreatePromptText] = useState("");
    const [creating, setCreating] = useState(false);

    const loadTemplates = async () => {
        if (!visible) return;
        setLoading(true);
        setError("");
        try {
            const data = await getTemplates();
            setTemplates(data?.templates || []);
        } catch (e) {
            setError(e?.message || "Failed to load templates.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (visible) loadTemplates();
    }, [visible]);

    useEffect(() => {
        if (visible && templates.length && showCreateForm && !createPromptText) {
            const standard = templates.find((t) => t.is_default || t.name === "Standard");
            setCreatePromptText(standard?.prompt_text || templates[0]?.prompt_text || DEFAULT_PROMPT_PLACEHOLDER);
        }
    }, [visible, templates, showCreateForm]);

    const openCreateForm = () => {
        const standard = templates.find((t) => t.is_default || t.name === "Standard");
        setCreateName("");
        setCreatePromptText(standard?.prompt_text || templates[0]?.prompt_text || DEFAULT_PROMPT_PLACEHOLDER);
        setShowCreateForm(true);
        setError("");
    };

    const submitCreate = async () => {
        const name = (createName || "").trim();
        if (!name) {
            setError("Name is required.");
            return;
        }
        setCreating(true);
        setError("");
        try {
            await createTemplate({ name, prompt_text: createPromptText || "" });
            await loadTemplates();
            setShowCreateForm(false);
            setCreateName("");
            setCreatePromptText("");
            onTemplatesUpdated?.();
        } catch (e) {
            setError(e?.message || "Failed to create template.");
        } finally {
            setCreating(false);
        }
    };

    if (!visible) return null;

    return (
        <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
            <View style={styles.overlay}>
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
                <View style={styles.card}>
                    <View style={styles.header}>
                        <Text style={styles.title}>
                            {showCreateForm ? "Create template" : "Manage templates"}
                        </Text>
                        <TouchableOpacity onPress={onClose} hitSlop={12}>
                            <Ionicons name="close" size={24} color="#64748B" />
                        </TouchableOpacity>
                    </View>
                    {error ? (
                        <View style={styles.errorRow}>
                            <Text style={styles.errorText}>{error}</Text>
                        </View>
                    ) : null}
                    {showCreateForm ? (
                        <ScrollView style={styles.formScroll} keyboardShouldPersistTaps="handled">
                            <Text style={styles.label}>Name</Text>
                            <TextInput
                                style={styles.input}
                                value={createName}
                                onChangeText={setCreateName}
                                placeholder="e.g. Sales call"
                                placeholderTextColor="#94A3B8"
                                autoCapitalize="none"
                            />
                            <Text style={styles.label}>Prompt text</Text>
                            <TextInput
                                style={[styles.input, styles.textArea]}
                                value={createPromptText}
                                onChangeText={setCreatePromptText}
                                placeholder={DEFAULT_PROMPT_PLACEHOLDER}
                                placeholderTextColor="#94A3B8"
                                multiline
                                numberOfLines={8}
                            />
                            <View style={styles.formActions}>
                                <TouchableOpacity
                                    style={styles.cancelButton}
                                    onPress={() => { setShowCreateForm(false); setError(""); }}
                                    disabled={creating}
                                >
                                    <Text style={styles.cancelButtonText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.saveButton}
                                    onPress={submitCreate}
                                    disabled={creating}
                                >
                                    {creating ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.saveButtonText}>Create</Text>}
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    ) : (
                        <>
                            {loading ? (
                                <View style={styles.loadingRow}>
                                    <ActivityIndicator size="small" color="#1D71B8" />
                                    <Text style={styles.loadingText}>Loading…</Text>
                                </View>
                            ) : (
                                <ScrollView style={styles.listScroll}>
                                    {templates.map((t) => (
                                        <View key={t.id} style={styles.templateRow}>
                                            <Text style={styles.templateName}>{t.name}{t.is_default ? " (default)" : ""}</Text>
                                        </View>
                                    ))}
                                </ScrollView>
                            )}
                            {!showCreateForm && (
                                <TouchableOpacity style={styles.createButton} onPress={openCreateForm} disabled={loading}>
                                    <Ionicons name="add" size={20} color="#1D71B8" />
                                    <Text style={styles.createButtonText}>Create new template</Text>
                                </TouchableOpacity>
                            )}
                        </>
                    )}
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 24 },
    card: { backgroundColor: "#FFFFFF", borderRadius: 20, padding: 20, width: "100%", maxHeight: "85%" },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
    title: { fontSize: 20, fontWeight: "700", color: "#1E293B" },
    errorRow: { marginBottom: 12 },
    errorText: { fontSize: 14, color: "#B91C1C" },
    loadingRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 24 },
    loadingText: { fontSize: 15, color: "#64748B" },
    listScroll: { maxHeight: 280, marginBottom: 16 },
    templateRow: { paddingVertical: 12, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: "#E2E8F0" },
    templateName: { fontSize: 16, fontWeight: "600", color: "#334155" },
    createButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 12, backgroundColor: "#EFF6FF" },
    createButtonText: { fontSize: 16, fontWeight: "600", color: "#1D71B8" },
    formScroll: { maxHeight: 400 },
    label: { fontSize: 14, fontWeight: "600", color: "#475569", marginBottom: 6 },
    input: { borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: "#1E293B", marginBottom: 16 },
    textArea: { minHeight: 160, textAlignVertical: "top" },
    formActions: { flexDirection: "row", gap: 12, marginTop: 8 },
    cancelButton: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: "#E2E8F0", alignItems: "center" },
    cancelButtonText: { fontSize: 16, fontWeight: "600", color: "#475569" },
    saveButton: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: "#1D71B8", alignItems: "center" },
    saveButtonText: { fontSize: 16, fontWeight: "600", color: "#FFFFFF" }
});
