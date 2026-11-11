(() => {
  const key = "cerca.demo.v1";
  const weekdays = [1, 2, 3, 4, 5];
  const modes = ["Presencial", "Remota", "Mixta"];
  const states = ["Sin cubrir", "Buscando profesional", "Pendiente de documentación",
    "Cubierto", "Requiere reemplazo", "Finalizado"];
  const normalize = (value) => value.trim().toLocaleLowerCase("es").normalize("NFD").replace(/\p{Diacritic}/gu, "");
  const baseCase = { institutionId: "horizonte", type: "Acompañamiento terapéutico", coverage: "Cobertura ficticia",
    requirements: "", start: "2026-11-11", urgency: "Programada", zone: "Boedo", mode: "Presencial",
    days: weekdays, from: "14:00", to: "18:00" };

  function initialData() {
    return {
      institutions: [{ id: "horizonte", name: "Centro Horizonte" }],
      professionals: [
        { id: "jacaranda", name: "Marina Jacarandá", active: true, experience: "6 años de experiencia declarada en acompañamiento domiciliario.", documents: "Constancia y referencias declaradas." },
        { id: "lapacho", name: "Sofía Lapacho", active: true, experience: "4 años de experiencia declarada en acompañamiento escolar.", documents: "Constancia declarada. Referencias pendientes." },
        { id: "ceibo", name: "Tomás Ceibo", active: true, experience: "2 años de experiencia declarada en acompañamiento comunitario.", documents: "Documentación declarada pendiente." },
        { id: "tala", name: "Elena Tala", active: true, experience: "5 años de experiencia declarada en seguimiento remoto.", documents: "Constancia declarada." },
      ],
      availability: [
        { professionalId: "jacaranda", zone: "Boedo", mode: "Presencial", days: weekdays, from: "13:00", to: "19:00" },
        { professionalId: "lapacho", zone: "Boedo", mode: "Presencial", days: weekdays, from: "14:00", to: "18:00" },
        { professionalId: "ceibo", zone: "Boedo", mode: "Presencial", days: weekdays, from: "15:00", to: "18:00" },
        { professionalId: "tala", zone: "Almagro", mode: "Remota", days: [2, 4], from: "09:00", to: "13:00" },
      ],
      cases: [
        { ...baseCase, code: "CASE-035", status: "Sin cubrir", requirements: "Experiencia domiciliaria declarada." },
        { ...baseCase, code: "CASE-036", status: "Cubierto", days: [1, 3, 5] },
        { ...baseCase, code: "CASE-037", status: "Buscando profesional", zone: "Almagro", mode: "Remota", days: [2, 4], from: "10:00", to: "12:00" },
        { ...baseCase, code: "CASE-038", status: "Pendiente de documentación", days: [2, 4] },
      ],
      assignments: [{ caseCode: "CASE-036", professionalId: "jacaranda", startedAt: "2026-11-11T17:00:00Z", endedAt: null, result: "Activa" }],
    };
  }

  function persist(data) {
    localStorage.setItem(key, JSON.stringify(data));
  }

  function read() {
    const stored = localStorage.getItem(key);
    if (stored !== null) return JSON.parse(stored);
    const data = initialData();
    persist(data);
    return data;
  }

  function findCase(data, code) {
    const item = data.cases.find((entry) => entry.code === code);
    if (!item) throw new Error("No se encontró el caso.");
    return item;
  }

  function saveCase(fields) {
    const data = read();
    const code = fields.code.trim().toUpperCase();
    const zone = fields.zone.trim();
    if (!/^[A-Z0-9-]{1,24}$/.test(code)) throw new Error("Usá un código de hasta 24 letras, números o guiones.");
    if (data.cases.some((item) => item.code === code)) throw new Error("Ese código ya existe.");
    if (!zone || !fields.start || !fields.days.length || !fields.from || !fields.to || fields.from >= fields.to) {
      throw new Error("Ingresá una zona, al menos un día, una fecha y un horario de fin posterior al inicio.");
    }
    const item = { ...baseCase, ...fields, code, zone, status: "Sin cubrir" };
    data.cases.unshift(item);
    persist(data);
    return item;
  }

  function matching(data, item) {
    const history = data.assignments.filter((entry) => entry.caseCode === item.code);
    const excluded = item.status === "Requiere reemplazo" ? history.at(-1)?.professionalId : undefined;
    return data.professionals.filter((at) => at.id !== excluded).map((at) => {
      const slots = data.availability.filter((slot) => slot.professionalId === at.id);
      const inZone = slots.filter((slot) => normalize(slot.zone) === normalize(item.zone));
      const inMode = inZone.filter((slot) => slot.mode === item.mode);
      const days = item.days.every((day) => inMode.some((slot) => slot.days.includes(day)));
      const hours = item.days.every((day) => inMode.some((slot) =>
        slot.days.includes(day) && slot.from <= item.from && slot.to >= item.to));
      const reasons = [
        ["Zona", inZone.length > 0],
        ["Modalidad en la zona", inMode.length > 0],
        ["Todos los días solicitados", days],
        ["Franja horaria completa", hours],
        ["Profesional activo", at.active],
      ];
      return { at, reasons, compatible: reasons.every(([, ok]) => ok) };
    }).sort((a, b) => Number(b.compatible) - Number(a.compatible));
  }

  function updateCase(code, action, professionalId) {
    const data = read();
    const item = findCase(data, code);
    const active = data.assignments.find((entry) => entry.caseCode === code && !entry.endedAt);
    const now = new Date().toISOString();
    if (item.status === "Finalizado") throw new Error("El caso ya está finalizado.");
    if (action === "assign") {
      if (active || !matching(data, item).some(({ at, compatible }) => at.id === professionalId && compatible)) {
        throw new Error("El profesional ya no se puede asignar a este caso.");
      }
      data.assignments.push({ caseCode: code, professionalId, startedAt: now, endedAt: null, result: "Activa" });
      item.status = "Cubierto";
    } else if (action === "replace") {
      if (!active) throw new Error("El caso no tiene una asignación activa.");
      active.endedAt = now;
      active.result = "Reemplazada";
      item.status = "Requiere reemplazo";
    } else if (action === "finish") {
      if (active) {
        active.endedAt = now;
        active.result = "Finalizada";
      }
      item.status = "Finalizado";
    } else if (!active && states.slice(0, 3).includes(action) && item.status !== "Requiere reemplazo") {
      item.status = action;
    } else {
      throw new Error("No se pudo cambiar el estado.");
    }
    persist(data);
  }

  window.CercaStore = {
    read, modes, states, normalize, saveCase,
    getCases: () => read().cases,
    getProfessionals: () => read().professionals,
    getAssignments: (code) => read().assignments.filter((entry) => entry.caseCode === code),
    matching: (code) => { const data = read(); return matching(data, findCase(data, code)); },
    createAssignment: (code, at) => updateCase(code, "assign", at),
    replaceAssignment: (code) => updateCase(code, "replace"),
    setStatus: updateCase,
    resetDemoData: () => persist(initialData()),
  };
})();
