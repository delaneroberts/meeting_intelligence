// ---- Agenda management ----

function updateAgendaStatus() {
    if (currentAgenda.trim()) {
        const itemCount = currentAgenda.trim().split("\n").filter(line => line.trim()).length;
        agendaStatus.textContent = `✓ Agenda set (${itemCount} items)`;
        agendaStatus.classList.remove("text-danger");
        agendaStatus.classList.add("text-success");
    } else {
        agendaStatus.textContent = "No agenda";
        agendaStatus.classList.remove("text-success");
        agendaStatus.classList.add("text-muted");
    }
}

agendaBtn.addEventListener("click", () => {
    // Reset form when opening modal
    agendaTextArea.value = currentAgenda;
    agendaFile.value = "";
    agendaModal.show();
});

agendaSaveBtn.addEventListener("click", async () => {
    // Check if text input has content
    const textContent = agendaTextArea.value.trim();

    if (textContent) {
        currentAgenda = textContent;
        updateAgendaStatus();
        agendaModal.hide();
        return;
    }

    // Check if file was uploaded
    if (agendaFile.files.length > 0) {
        const file = agendaFile.files[0];

        if (file.type === "application/pdf") {
            // For PDF, we'd need a library to parse it. For now, show a message.
            showError("PDF parsing is not yet supported. Please paste the content as text.");
            return;
        }

        try {
            const content = await file.text();
            currentAgenda = content;
            updateAgendaStatus();
            agendaModal.hide();
        } catch (err) {
            showError("Could not read the agenda file: " + err.message);
        }
    } else {
        showError("Please enter agenda items or upload a file.");
    }
});

agendaClearBtn.addEventListener("click", () => {
    currentAgenda = "";
    agendaTextArea.value = "";
    agendaFile.value = "";
    updateAgendaStatus();
    agendaModal.hide();
});

// Initialize agenda status
updateAgendaStatus();
