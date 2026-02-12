// DOM elements
const uploadForm = document.getElementById("uploadForm");
const audioFileInput = document.getElementById("audioFile");
const processBtn = document.getElementById("processBtn");
const openTranscriptsBtn = document.getElementById("openTranscriptsBtn");

const progressSection = document.getElementById("progressSection");
const progressBar = document.getElementById("progressBar");
const progressLabel = document.getElementById("progressLabel");
const progressPercent = document.getElementById("progressPercent");

const errorBox = document.getElementById("errorBox");
const errorMessage = document.getElementById("errorMessage");
const retryBtn = document.getElementById("retryBtn");

const resultsSection = document.getElementById("resultsSection");
const languageInfo = document.getElementById("languageInfo");
const languageText = document.getElementById("languageText");
const summaryText = document.getElementById("summaryText");
const actionItemsList = document.getElementById("actionItemsList");
const transcriptText = document.getElementById("transcriptText");
const transcriptFileInfo = document.getElementById("transcriptFileInfo");
const settingsInfo = document.getElementById("settingsInfo");

// Copy buttons
const copySummaryBtn = document.getElementById("copySummaryBtn");
const copyTranscriptBtn = document.getElementById("copyTranscriptBtn");

// Translation elements
const translationControls = document.getElementById("translationControls");
const targetLanguageSelect = document.getElementById("targetLanguageSelect");
const translateBtn = document.getElementById("translateBtn");
const translationStatus = document.getElementById("translationStatus");
const currentLanguageLabel = document.getElementById("currentLanguageLabel");

// Post-processing actions (PDF / discard)
const postActions = document.getElementById("postActions");
const downloadPdfBtn = document.getElementById("downloadPdfBtn");
const discardBtn = document.getElementById("discardBtn");

// Agenda elements
const agendaBtn = document.getElementById("agendaBtn");
const agendaStatus = document.getElementById("agendaStatus");
const agendaModal = new bootstrap.Modal(document.getElementById("agendaModal"));
const agendaTextArea = document.getElementById("agendaTextArea");
const agendaFile = document.getElementById("agendaFile");
const agendaSaveBtn = document.getElementById("agendaSaveBtn");
const agendaClearBtn = document.getElementById("agendaClearBtn");

// Settings elements
const settingsBtn = document.getElementById("settingsBtn");
const settingsModalEl = document.getElementById("settingsModal");
const settingsModal = settingsModalEl ? new bootstrap.Modal(settingsModalEl) : null;
const defaultLanguageSelect = document.getElementById("defaultLanguageSelect");
const summaryLanguageSelect = document.getElementById("summaryLanguageSelect");
const autoDetectQaToggle = document.getElementById("autoDetectQaToggle");
const settingsSaveBtn = document.getElementById("settingsSaveBtn");
const settingsStatus = document.getElementById("settingsStatus");

// Live recording elements
const recordBtn = document.getElementById("recordBtn");
const pauseBtn = document.getElementById("pauseBtn");
const stopBtn = document.getElementById("stopBtn");
const liveStatus = document.getElementById("liveStatus");
const coachBtn = document.getElementById("coachBtn");

// Auto-detect Q&A panel elements
const autoQAPanel = document.getElementById("autoQAPanel");
const autoQAToggle = document.getElementById("autoQAToggle");
const autoQAList = document.getElementById("autoQAList");
const autoQACount = document.getElementById("autoQACount");

// Store current agenda in memory
let currentAgenda = "";

// Store original and translated content
let currentMeetingData = {
    originalLanguage: "Unknown",
    originalSummary: "",
    originalTranscript: "",
    englishSummary: "",
    englishTranscript: "",
    actionItems: [],
    currentDisplayLanguage: "English" // Track what language is currently displayed
};

let appSettings = {
    default_language: "auto",
    summary_language: "auto",
    auto_detect_qa: true
};

// Live recording via MediaRecorder
let mediaRecorder = null;
let recordedChunks = [];
let recordingStream = null;

// Live transcript for current recording
let currentLiveTranscript = "";

// Auto-detect Q&A state
let detectedQuestions = []; // Array of {question, answer, isRhetorical}
let lastProcessedTranscriptLength = 0;
let autoQAPanelCollapsed = false;
let autoDetectionInterval = null;
