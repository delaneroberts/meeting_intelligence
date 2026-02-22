/**
 * Central API client for Meeting Intelligence.
 * All backend fetch calls go through this module.
 * Callers should .catch() and update global error state.
 */

import Constants from "expo-constants";
import appConfig from "../config/appConfig";

/**
 * Resolve base URL for the backend (config or auto from Expo host).
 * @returns {string} Base URL or empty string if unavailable
 */
export function getBaseUrl() {
    if (appConfig.apiBaseUrl && appConfig.apiBaseUrl !== "auto") {
        return appConfig.apiBaseUrl;
    }
    const hostUri =
        Constants.expoConfig?.hostUri ||
        Constants.manifest?.hostUri ||
        Constants.manifest?.debuggerHost;
    if (!hostUri) return "";
    const host = hostUri.split(":")[0];
    return `http://${host}:8001`;
}

/**
 * Fetch meeting templates (for "Meeting Type?" modal).
 * @returns {Promise<{ templates: Array<{ id: number, name: string, prompt_text: string }> }>}
 */
export async function getTemplates() {
    const base = getBaseUrl();
    if (!base) {
        throw new Error("Cannot reach server. Set apiBaseUrl in config.");
    }
    const response = await fetch(`${base}/api/templates`, { method: "GET" }).catch((err) => {
        throw new Error(err?.message || "Network error.");
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data?.error || `Templates failed (${response.status}).`);
    }
    return data;
}

/**
 * Create a new meeting template.
 * @param {{ name: string, prompt_text: string }} body
 * @returns {Promise<{ id: number, name: string, prompt_text: string, is_default: boolean, created_at: string }>}
 */
export async function createTemplate(body) {
    const base = getBaseUrl();
    if (!base) {
        throw new Error("Cannot reach server. Set apiBaseUrl in config.");
    }
    const response = await fetch(`${base}/api/templates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: body.name, prompt_text: body.prompt_text ?? "" }),
    }).catch((err) => {
        throw new Error(err?.message || "Network error.");
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data?.error || `Create template failed (${response.status}).`);
    }
    return data;
}

/**
 * Upload audio and start processing (async job).
 * Use progress_job_id to get 202 and poll status.
 * @param {Object} options
 * @param {string} options.audioUri - Local file URI
 * @param {string} [options.jobId] - If set, request returns 202 and runs async
 * @param {string} [options.agenda]
 * @param {string} [options.userId='1']
 * @param {number|null} [options.templateId] - MeetingTemplate id for summary prompt; omit for default
 * @returns {Promise<{ status: number, job_id?: string, ...result }>}
 */
export async function processAudio(options = {}) {
    const { audioUri, jobId, agenda = "", userId = "1", signal, transcriptionLanguage = "auto", diarization = true, waitForCompletion = true, templateId } = options;
    const base = getBaseUrl();
    if (!base) {
        throw new Error("Cannot reach server. Set apiBaseUrl in config.");
    }
    const formData = new FormData();
    formData.append("audio_file", {
        uri: audioUri,
        name: "audio.m4a",
        type: "audio/m4a",
    });
    if (jobId) {
        formData.append("progress_job_id", jobId);
        formData.append("wait_for_completion", waitForCompletion ? "1" : "0");
    }
    formData.append("user_id", userId);
    if (agenda) formData.append("agenda", agenda);
    if (transcriptionLanguage) formData.append("transcription_language", transcriptionLanguage);
    formData.append("diarization", diarization ? "1" : "0");
    if (templateId != null && templateId !== "") {
        formData.append("template_id", String(templateId));
    }

    const response = await fetch(`${base}/api/process`, {
        method: "POST",
        body: formData,
        signal,
    }).catch((err) => {
        throw new Error(err?.message || "Network error.");
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
        const msg = body?.error || `Request failed (${response.status}).`;
        throw new Error(msg);
    }
    return { status: response.status, ...body };
}

/**
 * Poll process job status. Retries on 404 a few times (server may not have registered job yet).
 * @param {string} jobId
 * @param {AbortSignal} [signal]
 * @param {{ retry404Count?: number }} [options]
 * @returns {Promise<{ status, progress, message, result?, error? }>}
 */
export async function getProcessStatus(jobId, signal, options = {}) {
    const { retry404Count = 15 } = options;
    const base = getBaseUrl();
    if (!base) throw new Error("Cannot reach server. Set apiBaseUrl in config.");
    const url = `${base}/api/process/status/${encodeURIComponent(jobId)}`;
    let last404 = null;
    for (let attempt = 0; attempt <= retry404Count; attempt++) {
        const response = await fetch(url, { signal }).catch((err) => {
            if (err?.name === "AbortError") throw err;
            throw new Error(err?.message || "Network error.");
        });
        const data = await response.json().catch(() => ({}));
        if (response.status === 404) {
            last404 = new Error(data?.message || "Job not found. The server may have restarted.");
            if (attempt < retry404Count) {
                const delayMs = 1500 + attempt * 800;
                await new Promise((r) => setTimeout(r, delayMs));
                continue;
            }
            throw last404;
        }
        if (!response.ok) {
            throw new Error(data?.error || `Status check failed (${response.status}).`);
        }
        return data;
    }
    throw last404;
}

/**
 * Translate summary and transcript to target language.
 * @param {Object} body
 * @param {string} body.summary
 * @param {string} body.transcript
 * @param {string} [body.target_language='English']
 * @returns {Promise<{ translated_summary, translated_transcript }>}
 */
export async function translateContent(body) {
    const base = getBaseUrl();
    if (!base) {
        throw new Error("Cannot reach server. Set apiBaseUrl in config.");
    }
    const response = await fetch(`${base}/api/translate_content`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            summary: body.summary ?? "",
            transcript: body.transcript ?? "",
            target_language: body.target_language ?? "English",
        }),
    }).catch((err) => {
        throw new Error(err?.message || "Network error.");
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(payload?.error || "Translation failed.");
    }
    return payload;
}
