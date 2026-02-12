async function loadSettings() {
    try {
        const response = await fetch("/api/settings");
        if (!response.ok) {
            return;
        }
        const data = await safeParseJson(response);
        if (!data) {
            return;
        }
        if (data && data.settings) {
            appSettings = { ...appSettings, ...data.settings };
            updateSettingsInfo();
            syncSettingsForm();
        }
    } catch (err) {
        console.warn("Failed to load settings:", err);
    }
}

function updateSettingsInfo() {
    if (!settingsInfo) return;
    const detected = currentMeetingData.originalLanguage || "";
    const transcriptLang = appSettings.default_language || "auto";
    const summaryLang = appSettings.summary_language || transcriptLang;

    const detectedLabel = detected && detected.toLowerCase() !== "unknown" && detected.toLowerCase() !== "english"
        ? ` (${detected})`
        : "";

    const transcriptLabel = transcriptLang === "auto"
        ? `Auto${detectedLabel}`
        : transcriptLang;
    const summaryLabel = summaryLang === "auto"
        ? `Auto${detectedLabel}`
        : summaryLang;

    settingsInfo.textContent = `Defaults: transcript ${transcriptLabel}, summary ${summaryLabel}`;
}

function syncSettingsForm() {
    if (!defaultLanguageSelect || !summaryLanguageSelect || !autoDetectQaToggle) return;
    defaultLanguageSelect.value = appSettings.default_language || "auto";
    summaryLanguageSelect.value = appSettings.summary_language || "auto";
    autoDetectQaToggle.checked = appSettings.auto_detect_qa !== false;
}

async function saveSettings() {
    if (!defaultLanguageSelect || !summaryLanguageSelect || !autoDetectQaToggle) return;
    const payload = {
        default_language: defaultLanguageSelect.value,
        summary_language: summaryLanguageSelect.value,
        auto_detect_qa: autoDetectQaToggle.checked
    };

    if (settingsStatus) {
        settingsStatus.textContent = "Saving…";
    }
    if (settingsSaveBtn) {
        settingsSaveBtn.disabled = true;
    }

    try {
        const response = await fetch("/api/settings", {
            method: "PUT",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ settings: payload })
        });

        if (!response.ok) {
            throw new Error(`Save failed (${response.status})`);
        }

        const data = await safeParseJson(response);
        if (!data) {
            throw new Error("Unexpected response");
        }
        if (data && data.settings) {
            appSettings = { ...appSettings, ...data.settings };
            updateSettingsInfo();
            syncSettingsForm();
        }

        if (settingsStatus) {
            settingsStatus.textContent = "Saved.";
        }
    } catch (err) {
        if (settingsStatus) {
            settingsStatus.textContent = "Save failed.";
        }
        console.warn("Failed to save settings:", err);
    } finally {
        if (settingsSaveBtn) {
            settingsSaveBtn.disabled = false;
        }
    }
}

if (settingsBtn && settingsModal) {
    settingsBtn.addEventListener("click", () => {
        if (settingsStatus) settingsStatus.textContent = "";
        syncSettingsForm();
        settingsModal.show();
    });
}

if (settingsSaveBtn) {
    settingsSaveBtn.addEventListener("click", saveSettings);
}

loadSettings();
