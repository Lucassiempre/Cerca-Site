(() => {
  const store = window.CercaStore;
  const days = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
  const date = new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires" });
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const button = (label, action, id = "", primary = false) =>
    `<button type="button" class="btn ${primary ? "" : "secondary"}" data-action="${action}" data-id="${esc(id)}">${label}</button>`;
  const statusPill = (status) => `<span class="pill ${status === "Cubierto" ? "ok" : status === "Requiere reemplazo" || status === "Sin cubrir" ? "pending" : "review"}">${esc(status)}</span>`;
  const schedule = (row) => `${row.days.join() === "1,2,3,4,5" ? "Lunes a viernes" : row.days.map((day) => days[day - 1]).join(", ")} · ${row.from} a ${row.to}`;

  function formCase() {
    return `<form class="card filters" data-form="case">
      <div class="grid-2">
        <label>Código del caso<input name="code" required maxlength="24" placeholder="CASE-039"></label>
        <label>Zona<input name="zone" required maxlength="80" placeholder="Boedo"></label>
      </div>
      <fieldset class="case-days"><legend>Días</legend>
        ${days.map((day, index) => `<label><input name="days" type="checkbox" value="${index + 1}">${day}</label>`).join("")}
      </fieldset>
      <div class="grid-2">
        <label>Hora de inicio<input name="from" type="time" value="14:00" required></label>
        <label>Hora de finalización<input name="to" type="time" value="18:00" required></label>
        <label>Modalidad<select name="mode">${store.modes.map((mode) => `<option>${mode}</option>`).join("")}</select></label>
        <label>Fecha de inicio<input name="start" type="date" required></label>
        <label>Cobertura declarada<input name="coverage" maxlength="100" required placeholder="Cobertura ficticia"></label>
        <label>Urgencia<select name="urgency"><option>Programada</option><option>Urgente</option></select></label>
      </div>
      <label>Requisitos<textarea name="requirements" maxlength="500" placeholder="Usá datos ficticios. Evitá nombres de pacientes e información clínica."></textarea></label>
      <button class="btn" type="submit">Crear caso</button>
    </form>`;
  }

  function profile(at, availability) {
    return `<article class="card stack">
      <div><h3>${esc(at.name)}</h3><p>Acompañante terapéutico · ${at.active ? "Activo" : "Inactivo"}</p></div>
      <div><strong>Experiencia declarada</strong><p>${esc(at.experience)}</p></div>
      <div><strong>Documentación declarada</strong><p>${esc(at.documents)}</p></div>
      <h4>Disponibilidad semanal</h4>
      ${availability.filter((slot) => slot.professionalId === at.id).map((slot) =>
        `<div class="list-row">${esc(slot.zone)} · ${esc(slot.mode)} · ${esc(schedule(slot))}</div>`).join("") || "<p>Sin horarios cargados.</p>"}
    </article>`;
  }

  function directory(data, professionalId) {
    const at = data.professionals.find((entry) => entry.id === professionalId);
    if (at) return button("Volver al directorio", "directory") + profile(at, data.availability);
    return `<div class="stack"><label>Nombre, zona o modalidad<input type="search" data-filter></label>
      <p data-empty hidden>No hay AT que coincidan.</p>
      ${data.professionals.map((entry) => {
        const slots = data.availability.filter((slot) => slot.professionalId === entry.id);
        return `<article data-provider class="card row-between"><div><h3>${esc(entry.name)}</h3>
          <p>${esc([...new Set(slots.map((slot) => slot.zone + " · " + slot.mode))].join(" / "))}</p></div>
          ${button("Ver AT", "professional", entry.id)}</article>`;
      }).join("")}</div>`;
  }

  function dashboard(data) {
    const count = (status) => data.cases.filter((item) => item.status === status).length;
    const stats = [["Casos activos", data.cases.length - count("Finalizado")], ["Cubiertos", count("Cubierto")],
      ["Sin cubrir", count("Sin cubrir")], ["Requieren reemplazo", count("Requiere reemplazo")],
      ["AT registrados", data.professionals.length]];
    return `<div class="stack">
      <div class="demo-metrics">${stats.map(([label, value]) =>
        `<div class="metric"><small>${label}</small><strong>${value}</strong></div>`).join("")}</div>
      <div class="row-between"><h3>Casos</h3>${button("Crear caso", "create", "", true)}</div>
      ${data.cases.map((item) => `<article class="card row-between"><div><h3>${esc(item.code)}</h3>
        <p>${esc(item.zone)} · ${esc(schedule(item))}</p>${statusPill(item.status)}</div>
        ${button("Ver caso", "case", item.code)}</article>`).join("")}
    </div>`;
  }

  function caseDetail(data, item, selectedId) {
    const history = data.assignments.filter((entry) => entry.caseCode === item.code);
    const active = history.find((entry) => !entry.endedAt);
    const atName = (id) => data.professionals.find((entry) => entry.id === id)?.name;
    const isOpen = !active && item.status !== "Finalizado";
    const showMatching = isOpen && item.status !== "Sin cubrir";
    const matches = showMatching ? store.matching(item.code) : [];
    const selected = matches.find(({ at }) => at.id === selectedId);
    const canSetStatus = store.states.slice(0, 3).includes(item.status);
    return `<div class="stack">
      <div>${button("Volver a casos", "panel")}</div>
      <article class="card stack">
        <div><h3>${esc(item.code)} · ${esc(item.type)}</h3>${statusPill(item.status)}
          <p>${esc(item.zone)} · ${esc(schedule(item))} · ${esc(item.mode)}</p></div>
        <div><strong>Inicio:</strong> ${esc(item.start.split("-").reverse().join("/"))} · ${esc(item.urgency)}<br>
          <strong>Cobertura declarada:</strong> ${esc(item.coverage)}<br>
          <strong>Requisitos:</strong> ${esc(item.requirements || "Sin requisitos adicionales")}</div>
        ${active ? `<strong>AT asignado: ${esc(atName(active.professionalId))}</strong>` : ""}
        <div class="case-actions">
          ${item.status === "Sin cubrir" ? button("Ejecutar matching", "matching", "", true) : ""}
          ${active ? button("Solicitar reemplazo", "replace", "", true) : ""}
          ${item.status !== "Finalizado" ? button("Finalizar caso", "finish") : ""}
        </div>
        ${canSetStatus ? `<label>Estado de búsqueda<select data-case-status>${store.states.slice(0, 3).map((status) =>
          `<option${status === item.status ? " selected" : ""}>${status}</option>`).join("")}</select></label>` : ""}
      </article>
      ${showMatching ? `<section class="card stack"><h3>${item.status === "Requiere reemplazo" ? "Matching para reemplazo" : "Matching de AT"}</h3>
        <p>${matches.filter((entry) => entry.compatible).length} AT compatibles</p>
        ${matches.map(({ at, reasons, compatible }) => `<div class="list-row">
          <div class="row-between"><div><strong>${esc(at.name)}</strong>
            <p>${compatible ? "Compatible" : "No compatible"}</p></div>${button("Ver AT", "professional", at.id)}</div>
          <ul class="match-reasons">${reasons.map(([label, ok]) =>
            `<li class="pill ${ok ? "ok" : "pending"}">${ok ? "✓" : "✕"} ${label}</li>`).join("")}</ul>
        </div>`).join("")}</section>` : ""}
      ${selected ? `<section class="stack" data-profile tabindex="-1">
        ${profile(selected.at, data.availability)}
        ${selected.compatible ? button("Asignar AT", "assign", selected.at.id, true) : ""}
      </section>` : ""}
      <section class="card stack"><h3>Historial de asignaciones</h3>
        ${history.slice().reverse().map((entry) => `<div class="list-row">
          <strong>${esc(atName(entry.professionalId))}</strong>
          <p>${date.format(new Date(entry.startedAt))} → ${entry.endedAt ? date.format(new Date(entry.endedAt)) : "Actual"} · ${entry.result}</p>
        </div>`).join("") || "<p>Sin asignaciones.</p>"}
      </section>
    </div>`;
  }

  function open(root, route) {
    let code = "";
    let professionalId = "";
    function showError(error) {
      root.querySelector("[data-status]").textContent = error instanceof Error ? error.message : String(error);
    }
    function render(message = "") {
      root.innerHTML = `<div class="wrap section stack">
        <div class="row-between demo-heading"><div>
          <h2>${{ buscar: "Directorio de AT", institucion: "Panel institución", publicar: "Crear caso", prestador: "Panel prestador" }[route]}</h2>
          <p data-institution></p><span class="badge">Datos ficticios para demostración.</span>
        </div>${route === "institucion" ? button("Restablecer datos de demostración", "reset") : ""}</div>
        <p data-status role="status" class="muted">${esc(message)}</p>
        <div data-content></div></div>`;
      try {
        const data = store.read();
        root.querySelector("[data-institution]").textContent = data.institutions[0].name;
        const item = data.cases.find((entry) => entry.code === code);
        root.querySelector("[data-content]").innerHTML = item ? caseDetail(data, item, professionalId) :
          route === "buscar" ? directory(data, professionalId) :
          route === "prestador" ? profile(data.professionals[0], data.availability) :
          route === "publicar" ? formCase() : dashboard(data);
      } catch {
        showError("No pudimos leer los datos de la demo. Revisá el almacenamiento del navegador o restablecé la demo desde el panel.");
      }
    }

    root.onclick = (event) => {
      const control = event.target.closest("[data-action]");
      if (!control) return;
      const { action, id } = control.dataset;
      try {
        if (action === "create") { window.navigate("publicar"); return; }
        if (action === "panel") { window.navigate("institucion"); return; }
        if (action === "case") { code = id; professionalId = ""; }
        if (action === "directory") professionalId = "";
        if (action === "professional") professionalId = id;
        if (action === "matching") store.setStatus(code, "Buscando profesional");
        if (action === "assign") { store.createAssignment(code, id); professionalId = ""; }
        if (action === "replace") {
          if (!window.confirm("¿Cerrar la asignación actual y buscar un reemplazo?")) return;
          store.replaceAssignment(code);
          professionalId = "";
        }
        if (action === "finish") {
          if (!window.confirm("¿Finalizar este caso?")) return;
          store.setStatus(code, "finish");
        }
        if (action === "reset") {
          if (!window.confirm("¿Restablecer la demo? Se perderán los cambios guardados en este navegador.")) return;
          store.resetDemoData();
          code = professionalId = "";
        }
        render(action === "reset" ? "Datos de demostración restablecidos." : "");
        if (action === "professional") root.querySelector("[data-profile]")?.focus();
      } catch (error) { showError(error); }
    };

    root.onchange = (event) => {
      if (!event.target.matches("[data-case-status]")) return;
      try {
        store.setStatus(code, event.target.value);
        professionalId = "";
        render();
      } catch (error) { showError(error); }
    };
    root.oninput = (event) => {
      if (!event.target.matches("[data-filter]")) return;
      const query = store.normalize(event.target.value);
      const cards = [...root.querySelectorAll("[data-provider]")];
      cards.forEach((card) => { card.hidden = !store.normalize(card.textContent).includes(query); });
      root.querySelector("[data-empty]").hidden = cards.some((card) => !card.hidden);
    };
    root.onsubmit = (event) => {
      if (!event.target.matches('[data-form="case"]')) return;
      event.preventDefault();
      try {
        const fields = new FormData(event.target);
        const item = store.saveCase({ ...Object.fromEntries(fields), days: fields.getAll("days").map(Number) });
        window.navigate("institucion");
        const panel = document.getElementById("page-institucion");
        const row = [...panel.querySelectorAll('[data-action="case"]')].find((entry) => entry.dataset.id === item.code);
        row?.focus();
        panel.querySelector("[data-status]").textContent = "Caso creado. Abrilo para iniciar el matching.";
      } catch (error) { showError(error); }
    };
    render();
  }

  window.CercaDemo = { open };
})();
