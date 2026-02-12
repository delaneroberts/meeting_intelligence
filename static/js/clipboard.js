// ---- Copy button functionality ----
function copyToClipboard(text, button) {
    navigator.clipboard.writeText(text).then(() => {
        const originalText = button.textContent;
        button.textContent = "✓ Copied!";
        button.classList.add("btn-success");
        button.classList.remove("btn-outline-secondary");

        setTimeout(() => {
            button.textContent = originalText;
            button.classList.remove("btn-success");
            button.classList.add("btn-outline-secondary");
        }, 2000);
    }).catch(err => {
        console.error("Failed to copy:", err);
        alert("Failed to copy to clipboard. Try again.");
    });
}

copySummaryBtn.addEventListener("click", () => {
    if (summaryText.textContent) {
        copyToClipboard(summaryText.textContent, copySummaryBtn);
    } else {
        alert("No summary to copy yet.");
    }
});

copyTranscriptBtn.addEventListener("click", () => {
    if (transcriptText.textContent) {
        copyToClipboard(transcriptText.textContent, copyTranscriptBtn);
    } else {
        alert("No transcript to copy yet.");
    }
});
