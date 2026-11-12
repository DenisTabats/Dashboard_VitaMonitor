const STORAGE_NOTES = "vitamonitor_notes_v1";
const STORAGE_CONSILIUMS = "vitamonitor_consiliums_v1";
const STORAGE_HANDOVER = "vitamonitor_handover_v1";

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function readStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    showToast("Не удалось сохранить данные в браузере.");
    return false;
  }
}

function statusClass(status) {
  if (status === "risk") return "status-risk";
  if (status === "watch") return "status-watch";
  return "status-stable";
}

function pulseLevel(value) {
  if (value > 100) return "alert";
  if (value > 90) return "warning";
  return "normal";
}

function pressureLevel(value) {
  const systolic = Number(String(value).split("/")[0]);
  if (systolic >= 160) return "alert";
  if (systolic >= 140) return "warning";
  return "normal";
}

function spo2Level(value) {
  if (value < 92) return "alert";
  if (value < 95) return "warning";
  return "normal";
}

function temperatureLevel(value) {
  const number = Number(String(value).replace(",", "."));
  if (number >= 38) return "alert";
  if (number >= 37.5) return "warning";
  return "normal";
}

function valueClass(level) {
  if (level === "alert") return "value-alert";
  if (level === "warning") return "value-warn";
  return "";
}

function showToast(message) {
  let toast = document.getElementById("appToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "appToast";
    toast.className = "toast";
    toast.setAttribute("role", "status");
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    toast.hidden = true;
  }, 3200);
}

function patientNotes(patient) {
  const stored = readStorage(STORAGE_NOTES, {});
  return stored[patient.id] || patient.notes;
}

function patientConsiliums(patient) {
  const stored = readStorage(STORAGE_CONSILIUMS, {});
  return stored[patient.id] || patient.consiliums;
}

function savePatientNotes(patient, notes) {
  const stored = readStorage(STORAGE_NOTES, {});
  stored[patient.id] = notes;
  writeStorage(STORAGE_NOTES, stored);
}

function savePatientConsiliums(patient, items) {
  const stored = readStorage(STORAGE_CONSILIUMS, {});
  stored[patient.id] = items;
  writeStorage(STORAGE_CONSILIUMS, stored);
}

function currentTime() {
  return "Сегодня, " + new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

function renderShiftRows() {
  const tbody = document.getElementById("shiftRows");
  if (!tbody) return;
  const search = document.getElementById("shiftSearch");
  const status = document.getElementById("shiftStatus");
  const count = document.getElementById("shiftCount");
  const query = search ? search.value.trim().toLowerCase() : "";
  const statusValue = status ? status.value : "all";

  const visible = patients.filter((patient) => {
    const haystack = `${patient.name} ${patient.room} ${patient.diagnosis}`.toLowerCase();
    return (!query || haystack.includes(query)) && (statusValue === "all" || patient.status === statusValue);
  });

  if (count) count.textContent = String(visible.length);

  if (!visible.length) {
    tbody.innerHTML = '<tr><td colspan="10" class="no-records">Пациенты не найдены. Измените запрос или фильтр.</td></tr>';
    return;
  }

  tbody.innerHTML = visible.map((patient) => {
    const lastNote = patientNotes(patient)[0];
    return `
      <tr>
        <td class="bed-cell">${escapeHtml(patient.room)}</td>
        <td class="patient-cell">
          <strong>${escapeHtml(patient.shortName)}</strong>
          <small>${patient.age} лет · история ${escapeHtml(patient.history)}</small>
        </td>
        <td class="diagnosis-cell">${escapeHtml(patient.diagnosis)}</td>
        <td class="num ${valueClass(pulseLevel(patient.vitals.pulse))}">${patient.vitals.pulse}</td>
        <td class="num ${valueClass(pressureLevel(patient.vitals.pressure))}">${escapeHtml(patient.vitals.pressure)}</td>
        <td class="num ${valueClass(spo2Level(patient.vitals.spo2))}">${patient.vitals.spo2}%</td>
        <td class="num ${valueClass(temperatureLevel(patient.vitals.temperature))}">${escapeHtml(patient.vitals.temperature)}</td>
        <td><span class="status ${statusClass(patient.status)}">${escapeHtml(patient.statusLabel)}</span></td>
        <td class="note-cell">${lastNote ? escapeHtml(lastNote.text) : "—"}</td>
        <td><a href="dashboard.html?patient=${encodeURIComponent(patient.id)}">Карта</a></td>
      </tr>
    `;
  }).join("");
}

function renderTodayConsiliums() {
  const feed = document.getElementById("todayConsiliums");
  if (!feed) return;
  const items = [];
  patients.forEach((patient) => {
    patientConsiliums(patient).forEach((item) => {
      items.push({ patient, item });
    });
  });
  if (!items.length) {
    feed.innerHTML = '<p class="no-records">На сегодня консилиумы не назначены.</p>';
    return;
  }
  feed.innerHTML = items.map(({ patient, item }) => `
    <div class="consilium-line">
      <time>${escapeHtml(item.time)}</time>
      <strong>${escapeHtml(item.specialty)} · ${escapeHtml(patient.shortName)}</strong>
      <p>${escapeHtml(item.text)}</p>
    </div>
  `).join("");
}

function initHandover() {
  const textarea = document.getElementById("handoverText");
  const button = document.getElementById("saveHandover");
  const status = document.getElementById("handoverStatus");
  if (!textarea || !button) return;

  const saved = readStorage(STORAGE_HANDOVER, null);
  if (saved) {
    textarea.value = saved.text || "";
    if (status) status.textContent = "сохранено " + (saved.time || "");
  }

  button.addEventListener("click", () => {
    const time = new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
    if (writeStorage(STORAGE_HANDOVER, { text: textarea.value.trim(), time })) {
      if (status) status.textContent = "сохранено " + time;
      showToast("Передача смены сохранена.");
    }
  });
}

function initShiftPage() {
  if (!document.getElementById("shiftRows")) return;
  renderShiftRows();
  renderTodayConsiliums();
  initHandover();
  const search = document.getElementById("shiftSearch");
  const status = document.getElementById("shiftStatus");
  if (search) search.addEventListener("input", renderShiftRows);
  if (status) status.addEventListener("change", renderShiftRows);
}

function renderPatientList() {
  const list = document.getElementById("patientList");
  const count = document.getElementById("patientCount");
  const search = document.getElementById("patientSearch");
  const filter = document.getElementById("statusFilter");
  if (!list || !count) return;

  const query = search ? search.value.trim().toLowerCase() : "";
  const status = filter ? filter.value : "all";
  const visible = patients.filter((patient) => {
    const haystack = `${patient.name} ${patient.room} ${patient.diagnosis}`.toLowerCase();
    return (!query || haystack.includes(query)) && (status === "all" || patient.status === status);
  });

  count.textContent = String(visible.length);
  if (!visible.length) {
    list.innerHTML = '<p class="no-records">Пациенты не найдены.</p>';
    return;
  }

  list.innerHTML = visible.map((patient) => `
    <button class="patient-item" type="button" data-patient-id="${patient.id}">
      <span class="patient-item-top">
        <strong>${escapeHtml(patient.shortName)}</strong>
        <span class="bed">палата ${escapeHtml(patient.room)}</span>
      </span>
      <small>${escapeHtml(patient.diagnosis)} · ${patient.age} лет</small>
      <small><span class="status ${statusClass(patient.status)}">${escapeHtml(patient.statusLabel)}</span></small>
    </button>
  `).join("");

  list.querySelectorAll("[data-patient-id]").forEach((button) => {
    button.addEventListener("click", () => selectPatient(button.dataset.patientId));
  });
}

function barChart(values, min, max, timeLabels, levelFn) {
  const rows = values.map((value, index) => {
    const width = Math.max(4, Math.min(100, ((value - min) / (max - min)) * 100));
    const level = levelFn(value);
    const fillClass = level === "alert" ? "alert" : level === "warning" ? "warning" : "";
    return `<div class="bar-row"><span class="bar-time">${timeLabels[index]}</span><span class="bar-track"><span class="bar-fill ${fillClass}" style="width:${width}%"></span></span><span class="bar-value">${value}</span></div>`;
  }).join("");
  return `<div class="bar-chart">${rows}</div>`;
}

function notesMarkup(notes) {
  if (!notes.length) return '<p class="no-records">Записей пока нет.</p>';
  return notes.map((note) => `
    <div class="timeline-item">
      <strong>${escapeHtml(note.author)}</strong>
      <span>${escapeHtml(note.time)}</span>
      <p>${escapeHtml(note.text)}</p>
    </div>
  `).join("");
}

function consiliumMarkup(items) {
  if (!items.length) return '<p class="no-records">Консилиумы не назначены.</p>';
  return items.map((item) => `
    <div class="consilium-entry">
      <strong>${escapeHtml(item.specialty)}</strong>
      <small>${escapeHtml(item.time)}</small>
      <p>${escapeHtml(item.text)}</p>
    </div>
  `).join("");
}

function renderPatient(patient, notes, consiliums) {
  const view = document.getElementById("patientView");
  if (!view) return;
  const lastNote = notes[0];
  const pulseLvl = pulseLevel(patient.vitals.pulse);
  const pressureLvl = pressureLevel(patient.vitals.pressure);
  const spo2Lvl = spo2Level(patient.vitals.spo2);
  const tempLvl = temperatureLevel(patient.vitals.temperature);

  const rows = patient.historyValues.labels.map((label, index) => {
    const pulse = patient.historyValues.pulse[index];
    const spo2 = patient.historyValues.spo2[index];
    const isLast = index === patient.historyValues.labels.length - 1;
    return `
      <tr>
        <td>${escapeHtml(label)}</td>
        <td class="${valueClass(pulseLevel(pulse))}">${pulse}</td>
        <td class="${valueClass(spo2Level(spo2))}">${spo2}%</td>
        <td>${isLast ? escapeHtml(patient.vitals.pressure) : "—"}</td>
        <td>${isLast ? escapeHtml(patient.vitals.temperature) : "—"}</td>
      </tr>
    `;
  }).join("");

  view.innerHTML = `
    <article class="patient-banner">
      <div class="patient-banner-top">
        <span class="patient-initials">${escapeHtml(patient.initials)}</span>
        <div class="patient-title">
          <h2>${escapeHtml(patient.name)}</h2>
          <p class="patient-meta">${patient.age} лет · палата ${escapeHtml(patient.room)} · история ${escapeHtml(patient.history)} · ${escapeHtml(patient.department)}</p>
          <div class="patient-badges">
            <span class="status ${statusClass(patient.status)}">${escapeHtml(patient.statusLabel)}</span>
            <span class="badge badge-diagnosis">${escapeHtml(patient.diagnosis)}</span>
            <span class="badge">обновлено ${escapeHtml(patient.updated)}</span>
          </div>
        </div>
        <div class="patient-actions">
          <button class="button button-secondary button-small" type="button" onclick="window.print()">Печать</button>
          <button class="button button-small" type="button" data-open-tab="consiliums">Консилиум</button>
        </div>
      </div>
      <div class="patient-tabs" role="tablist" aria-label="Разделы карты">
        <button class="tab is-active" type="button" role="tab" aria-selected="true" data-tab="overview">Обзор</button>
        <button class="tab" type="button" role="tab" aria-selected="false" data-tab="notes">Записи <span class="muted-small">${notes.length}</span></button>
        <button class="tab" type="button" role="tab" aria-selected="false" data-tab="consiliums">Консилиумы <span class="muted-small">${consiliums.length}</span></button>
      </div>
      <div class="patient-panel" data-panel="overview">
        <div class="vitals-strip">
          <div class="vital-box ${pulseLvl === "alert" ? "is-alert" : pulseLvl === "warning" ? "is-warning" : ""}">
            <span>Пульс</span><strong>${patient.vitals.pulse}</strong><small>уд/мин</small><em>норма 60–90</em>
          </div>
          <div class="vital-box ${pressureLvl === "alert" ? "is-alert" : pressureLvl === "warning" ? "is-warning" : ""}">
            <span>АД</span><strong>${escapeHtml(patient.vitals.pressure)}</strong><small>мм рт. ст.</small><em>норма &lt; 140/90</em>
          </div>
          <div class="vital-box ${spo2Lvl === "alert" ? "is-alert" : spo2Lvl === "warning" ? "is-warning" : ""}">
            <span>SpO₂</span><strong>${patient.vitals.spo2}%</strong><small>на воздухе</small><em>норма ≥ 95%</em>
          </div>
          <div class="vital-box ${tempLvl === "alert" ? "is-alert" : tempLvl === "warning" ? "is-warning" : ""}">
            <span>Температура</span><strong>${escapeHtml(patient.vitals.temperature)}</strong><small>°C</small><em>норма &lt; 37,5</em>
          </div>
        </div>

        <div class="clinical-grid">
          <div class="clinical-block">
            <div class="clinical-block-head"><h3>Лист наблюдения</h3><span>7 измерений за 12 часов</span></div>
            <table class="flowsheet">
              <thead><tr><th>Время</th><th>Пульс</th><th>SpO₂</th><th>АД</th><th>T</th></tr></thead>
              <tbody>${rows}</tbody>
            </table>
            <div class="chart-wrap">
              <div class="chart-title"><span>Пульс, уд/мин</span><span>норма 60–90</span></div>
              ${barChart(patient.historyValues.pulse, 50, 120, patient.historyValues.labels, pulseLevel)}
              <div class="chart-title" style="margin-top:6px"><span>SpO₂, %</span><span>норма ≥ 95%</span></div>
              ${barChart(patient.historyValues.spo2, 85, 100, patient.historyValues.labels, spo2Level)}
            </div>
          </div>

          <aside>
            <div class="side-block">
              <h3>Проблемы</h3>
              <ul class="side-list">
                <li>${escapeHtml(patient.diagnosis)}</li>
                <li>${pulseLvl === "normal" ? "Гемодинамика стабильна" : "Тахикардия, контроль пульса"}</li>
                <li>${spo2Lvl === "normal" ? "Сатурация в норме" : "Снижение SpO₂, контроль дыхания"}</li>
              </ul>
            </div>
            <div class="side-block">
              <h3>Аллергии</h3>
              <p class="side-text">Не выявлены.</p>
            </div>
            <div class="side-block">
              <h3>Последняя запись</h3>
              <p class="side-text">${lastNote ? escapeHtml(lastNote.text) : "Записей нет."}</p>
              <div class="side-actions"><button class="button button-secondary button-small" type="button" data-open-tab="notes">Все записи</button></div>
            </div>
          </aside>
        </div>
      </div>

      <div class="patient-panel" data-panel="notes" hidden>
        <div class="notes-layout">
          <form class="note-form" id="noteForm">
            <label>Автор
              <select id="noteAuthor">
                <option>Дежурный врач</option>
                <option>Лечащий врач</option>
                <option>Медицинская сестра</option>
              </select>
            </label>
            <label>Текст записи
              <textarea id="noteText" maxlength="280" placeholder="Что изменилось в состоянии пациента" required></textarea>
            </label>
            <button type="submit">Добавить запись</button>
          </form>
          <div class="timeline" id="notesTimeline">${notesMarkup(notes)}</div>
        </div>
      </div>

      <div class="patient-panel" data-panel="consiliums" hidden>
        <div class="consilium-layout">
          <form class="consilium-form" id="consiliumForm">
            <label>Профиль консультанта
              <select id="consiliumSpecialty">
                <option>Кардиолог</option>
                <option>Реаниматолог</option>
                <option>Терапевт</option>
                <option>Хирург</option>
                <option>Пульмонолог</option>
              </select>
            </label>
            <label>Вопрос к коллегам
              <textarea id="consiliumText" maxlength="240" placeholder="Что нужно уточнить" required></textarea>
            </label>
            <button type="submit">Отправить запрос</button>
          </form>
          <div class="consilium-list" id="consiliumList">${consiliumMarkup(consiliums)}</div>
        </div>
      </div>
    </article>
  `;

  const activateTab = (name) => {
    view.querySelectorAll(".tab").forEach((tab) => {
      const active = tab.dataset.tab === name;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", String(active));
    });
    view.querySelectorAll("[data-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.panel !== name;
    });
  };

  view.querySelectorAll("[data-tab]").forEach((tab) => {
    tab.addEventListener("click", () => activateTab(tab.dataset.tab));
  });
  view.querySelectorAll("[data-open-tab]").forEach((button) => {
    button.addEventListener("click", () => activateTab(button.dataset.openTab));
  });

  document.getElementById("noteForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const author = document.getElementById("noteAuthor").value;
    const text = document.getElementById("noteText").value.trim();
    if (text.length < 5) {
      showToast("Запись слишком короткая.");
      return;
    }
    const updated = [{ author, time: currentTime(), text }, ...notes];
    savePatientNotes(patient, updated);
    notes = updated;
    document.getElementById("notesTimeline").innerHTML = notesMarkup(notes);
    event.target.reset();
    showToast("Запись сохранена.");
  });

  document.getElementById("consiliumForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const specialty = document.getElementById("consiliumSpecialty").value;
    const text = document.getElementById("consiliumText").value.trim();
    if (text.length < 5) {
      showToast("Опишите вопрос для консилиума.");
      return;
    }
    const updated = [...consiliums, { specialty, time: currentTime(), text }];
    savePatientConsiliums(patient, updated);
    consiliums = updated;
    document.getElementById("consiliumList").innerHTML = consiliumMarkup(consiliums);
    event.target.reset();
    showToast("Запрос на консилиум добавлен.");
  });
}

function selectPatient(id) {
  const patient = patients.find((item) => item.id === id) || patients[0];
  if (!patient) return;
  document.querySelectorAll(".patient-item").forEach((item) => {
    item.classList.toggle("is-active", item.dataset.patientId === patient.id);
  });
  renderPatient(patient, patientNotes(patient), patientConsiliums(patient));
}

function initPatientPage() {
  if (!document.getElementById("patientView")) return;
  renderPatientList();
  const search = document.getElementById("patientSearch");
  const filter = document.getElementById("statusFilter");
  if (search) search.addEventListener("input", renderPatientList);
  if (filter) filter.addEventListener("change", renderPatientList);
  const requested = new URLSearchParams(window.location.search).get("patient");
  selectPatient(requested || patients[0].id);
}

document.addEventListener("DOMContentLoaded", () => {
  initShiftPage();
  initPatientPage();
});