// ============================================================================
// VOZMAYOR AI 3.0 • CONVERSACIÓN ACUMULATIVA ESTILO PLANE AI + GEMINI
// Compatible con Opera, Chrome, Edge, Brave y Firefox (Web Speech + Whisper IA)
// ============================================================================

const NOMBRE_PROYECTO = "VozMayor";
const ASESORA = "Luz María Gómez";

// Frases de alerta médica para triaje de riesgo vital
const RIESGO_VITAL = [
    "dolor en el pecho", "me duele el pecho", "opresion en el pecho", "opresión en el pecho",
    "dolor de pecho", "infarto", "corazon", "corazón",
    "no puedo respirar", "falta el aire", "me ahogo", "asfixi", "ahogando",
    "me cai", "me caí", "golpe en la cabeza", "desmay", "inconsciente", "sangre",
    "morir", "suicid", "no quiero vivir", "hacerme daño", "quitarme la vida",
    "me estoy muriendo", "convulsio", "sangrado abundante", "derrame", "paralisis", "parálisis"
];

const SEDES_ANTIOQUIA = [
    {
        corto: "Medellín Centro",
        ciudadBase: "Medellín",
        direccion: "IPS Aliada Medellín Centro (Cra. 46 # 54-20, Parque Bolívar)",
        cobertura: ["medellin", "medellín", "centro", "laureles", "belen", "belén", " poblado", "robledo", "aranjuez", "manrique", "buenos aires", "castilla"]
    },
    {
        corto: "Envigado • Sur",
        ciudadBase: "Envigado",
        direccion: "CIS Envigado Parque (Calle 37 Sur # 41-28, Sur del Valle de Aburrá)",
        cobertura: ["envigado", "sabaneta", "la estrella", "caldas"]
    },
    {
        corto: "Bello • Norte",
        ciudadBase: "Bello",
        direccion: "Sede Bello Choza Marco Fidel Suárez (Cra. 50 # 51-14, Norte del Valle de Aburrá)",
        cobertura: ["bello", "copacabana", "girardota", "barbosa", "niquia", "niquía"]
    },
    {
        corto: "Rionegro • Oriente",
        ciudadBase: "Rionegro",
        direccion: "Centro Médico Savanna Rionegro (Calle 47 # 56-35, Oriente Antioqueño)",
        cobertura: ["rionegro", "oriente", "marinilla", "la ceja", "el retiro", "guarne", "carmen de viboral", "santuario"]
    },
    {
        corto: "Itagüí • Sur",
        ciudadBase: "Itagüí",
        direccion: "Sede Itagüí Parque Principal (Cra. 51 # 50-21, Suroccidente)",
        cobertura: ["itagui", "itagüí", "san antonio de prado"]
    }
];

const estadoSesion = {
    interacciones: 0,
    ultimoTema: "BIENVENIDA",
    indiceSede: 0,
    sedePreferida: SEDES_ANTIOQUIA[0].direccion,
    municipioCorto: SEDES_ANTIOQUIA[0].corto,
    documento: "Pendiente de registro (Indique su nombre y cédula)",
    hablarLento: false,
    vozActiva: true,
    ultimoMensajeTextoPlano: "",
    ultimoRadicado: "EPS-VM-2026-9182",
    escuchandoMicrofono: false,
    paciente: {
        nombre: "",
        edad: "",
        cedula: "",
        ciudad: "",
        eps: "EPS SURA / Savia Salud"
    },
    consultasReales: []
};

// ============================================================================
// EXTRACCIÓN INTELIGENTE DE DATOS DEL ADULTO MAYOR (VOZ O TEXTO) Y SEDE CERCANA
// ============================================================================

function capitalizarPalabras(str) {
    if (!str) return "";
    return str
        .trim()
        .split(/\s+/)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(" ");
}

function extraerDatosPacienteDeTexto(textoOriginal) {
    if (!textoOriginal) return false;
    const txt = textoOriginal.trim();
    const lower = txt.toLowerCase();
    let detectoAlgunDato = false;

    // 1. Detectar Nombre ("me llamo ...", "mi nombre es ...", "soy ...")
    const regexNombre = /(?:me llamo|mi nombre es|nombre es|habla con|yo soy|soy)\s+([a-záéíóúñ]+(?:\s+[a-záéíóúñ]+){0,3}?)(?=\s*(?:,|\.|y\s+tengo|tengo|mi\s+edad|de\s+\d+|mi\s+c[eé]dula|c[eé]dula|vivo|resido|soy\s+de|necesito|quiero|$))/i;
    const matchNombre = txt.match(regexNombre);
    if (matchNombre && matchNombre[1]) {
        const candidato = matchNombre[1].trim();
        const palabrasNoNombre = ["de", "en", "afiliado", "adulto", "mayor", "eps", "sura", "nueva", "savia", "sanitas", "medellin", "medellín", "bello", "envigado"];
        if (!palabrasNoNombre.includes(candidato.toLowerCase()) && candidato.length >= 3) {
            estadoSesion.paciente.nombre = capitalizarPalabras(candidato);
            detectoAlgunDato = true;
        }
    }

    // 2. Detectar Edad ("tengo 68 años", "68 años", "edad 72")
    const matchEdad = lower.match(/(?:tengo\s+|edad\s*:?\s*|de\s+)?(\b(?:[5-9]\d|10\d)\b)\s*(?:años|anos|año)/i) ||
                      lower.match(/(?:tengo|edad)\s+(\b(?:[5-9]\d|10\d)\b)/i);
    if (matchEdad && matchEdad[1]) {
        estadoSesion.paciente.edad = matchEdad[1];
        detectoAlgunDato = true;
    }

    // 3. Detectar Cédula (números de 6 a 11 dígitos, incluso separados por puntos o espacios tras la palabra cédula/documento)
    const matchCedulaExplicita = lower.match(/(?:c[eé]dula|documento|identificaci[oó]n|cc|número|numero)\s*(?:es|n[uú]mero|:)?\s*([\d\.\s]{6,15})/i);
    if (matchCedulaExplicita && matchCedulaExplicita[1]) {
        const soloDigitos = matchCedulaExplicita[1].replace(/\D/g, "");
        if (soloDigitos.length >= 5 && soloDigitos.length <= 11) {
            estadoSesion.paciente.cedula = soloDigitos;
            detectoAlgunDato = true;
        }
    } else {
        const textoSinPuntos = lower.replace(/\./g, "");
        const matchNumLargo = textoSinPuntos.match(/\b(\d{6,11})\b/);
        if (matchNumLargo && matchNumLargo[1]) {
            estadoSesion.paciente.cedula = matchNumLargo[1];
            detectoAlgunDato = true;
        }
    }

    // 4. Detectar Ciudad / Municipio en Antioquia y recomendar la sede más cercana
    for (let i = 0; i < SEDES_ANTIOQUIA.length; i++) {
        const sede = SEDES_ANTIOQUIA[i];
        const coincidencia = sede.cobertura.find(m => lower.includes(m));
        if (coincidencia) {
            estadoSesion.indiceSede = i;
            estadoSesion.sedePreferida = sede.direccion;
            estadoSesion.municipioCorto = sede.corto;
            estadoSesion.paciente.ciudad = capitalizarPalabras(coincidencia);
            detectoAlgunDato = true;
            break;
        }
    }

    // 5. Detectar EPS
    if (lower.includes("sura") || lower.includes("suramericana")) {
        estadoSesion.paciente.eps = "EPS SURA";
        detectoAlgunDato = true;
    } else if (lower.includes("nueva eps")) {
        estadoSesion.paciente.eps = "Nueva EPS";
        detectoAlgunDato = true;
    } else if (lower.includes("savia")) {
        estadoSesion.paciente.eps = "Savia Salud EPS";
        detectoAlgunDato = true;
    } else if (lower.includes("sanitas")) {
        estadoSesion.paciente.eps = "EPS Sanitas";
        detectoAlgunDato = true;
    } else if (lower.includes("salud total")) {
        estadoSesion.paciente.eps = "Salud Total EPS";
        detectoAlgunDato = true;
    } else if (lower.includes("coosalud")) {
        estadoSesion.paciente.eps = "Coosalud EPS";
        detectoAlgunDato = true;
    }

    actualizarResumenDocumentoPaciente();
    sincronizarInputsFichaPacienteDOM();
    return detectoAlgunDato;
}

function actualizarResumenDocumentoPaciente() {
    const p = estadoSesion.paciente;
    const partes = [];
    if (p.nombre) partes.push(p.nombre);
    if (p.edad) partes.push(`${p.edad} años`);
    if (p.cedula) partes.push(`C.C. ${p.cedula}`);
    if (p.ciudad) partes.push(p.ciudad);
    if (p.eps) partes.push(p.eps);

    if (partes.length > 0) {
        estadoSesion.documento = partes.join(" • ");
    } else {
        estadoSesion.documento = "Adulto Mayor Preferencial (Ley 1171)";
    }

    const sedePill = document.getElementById("activeSedePill");
    if (sedePill) {
        sedePill.textContent = p.nombre
            ? `${p.nombre} • Sede ${estadoSesion.municipioCorto}`
            : `VozMayor • ${estadoSesion.municipioCorto}`;
    }
}

function sincronizarInputsFichaPacienteDOM() {
    const p = estadoSesion.paciente;
    const inNombre = document.querySelectorAll(".js-input-nombre");
    const inEdad = document.querySelectorAll(".js-input-edad");
    const inCedula = document.querySelectorAll(".js-input-cedula");
    const inCiudad = document.querySelectorAll(".js-input-ciudad");
    const inEps = document.querySelectorAll(".js-input-eps");

    if (p.nombre) inNombre.forEach(el => { el.value = p.nombre; });
    if (p.edad) inEdad.forEach(el => { el.value = p.edad; });
    if (p.cedula) inCedula.forEach(el => { el.value = p.cedula; });
    if (p.ciudad) inCiudad.forEach(el => { el.value = p.ciudad; });
    if (p.eps) inEps.forEach(el => { el.value = p.eps; });
}

function guardarDatosFormularioPaciente(btnElement) {
    const card = btnElement ? btnElement.closest(".patient-eps-card") : document;
    const nombre = (card.querySelector(".js-input-nombre")?.value || "").trim();
    const edad = (card.querySelector(".js-input-edad")?.value || "").trim();
    const cedula = (card.querySelector(".js-input-cedula")?.value || "").trim();
    const ciudad = (card.querySelector(".js-input-ciudad")?.value || "").trim();
    const eps = (card.querySelector(".js-input-eps")?.value || "").trim();

    if (nombre) estadoSesion.paciente.nombre = capitalizarPalabras(nombre);
    if (edad) estadoSesion.paciente.edad = edad.replace(/\D/g, "") || edad;
    if (cedula) estadoSesion.paciente.cedula = cedula.replace(/\D/g, "") || cedula;
    if (ciudad) estadoSesion.paciente.ciudad = capitalizarPalabras(ciudad);
    if (eps) estadoSesion.paciente.eps = eps;

    const fraseSintetica = `Mis datos son: me llamo ${estadoSesion.paciente.nombre || "Adulto Mayor"}, tengo ${estadoSesion.paciente.edad || "68"} años, mi cédula es ${estadoSesion.paciente.cedula || "por confirmar"}, vivo en ${estadoSesion.paciente.ciudad || "Medellín"} y mi EPS es ${estadoSesion.paciente.eps || "EPS SURA"}`;
    enviarConsulta(fraseSintetica, false);
}

function construirTarjetaFichaPacienteHtml() {
    const p = estadoSesion.paciente;
    const tieneDatosCompletos = Boolean(p.nombre && p.cedula && p.ciudad);
    return `
        <div class="patient-eps-card">
            <div class="patient-eps-header">
                <div class="patient-eps-title">
                    <i class="fa-regular fa-id-card" style="color: var(--accent-blue);"></i>
                    <span>Ficha de Preparación para EPS y Asignación de Sede Cercana</span>
                </div>
                <span class="state-badge ${tieneDatosCompletos ? 'done' : 'review'}">
                    <i class="fa-solid ${tieneDatosCompletos ? 'fa-circle-check' : 'fa-microphone'}"></i>
                    ${tieneDatosCompletos ? 'Listo para presentar en EPS' : 'Puede dictar sus datos por voz o completarlos aquí'}
                </span>
            </div>

            <div class="patient-form-grid">
                <div class="patient-field-group">
                    <label><i class="fa-regular fa-user"></i> Nombre completo</label>
                    <input type="text" class="patient-field-input js-input-nombre" placeholder="Ej: Carlos Restrepo" value="${p.nombre}" />
                </div>
                <div class="patient-field-group">
                    <label><i class="fa-solid fa-cake-candles"></i> Edad (años)</label>
                    <input type="text" class="patient-field-input js-input-edad" placeholder="Ej: 68" value="${p.edad}" />
                </div>
                <div class="patient-field-group">
                    <label><i class="fa-regular fa-address-card"></i> Número de Cédula</label>
                    <input type="text" class="patient-field-input js-input-cedula" placeholder="Ej: 70123456" value="${p.cedula}" />
                </div>
                <div class="patient-field-group">
                    <label><i class="fa-solid fa-location-dot"></i> Ciudad / Municipio</label>
                    <input type="text" class="patient-field-input js-input-ciudad" placeholder="Ej: Medellín, Envigado, Bello..." value="${p.ciudad}" />
                </div>
                <div class="patient-field-group">
                    <label><i class="fa-regular fa-hospital"></i> Su EPS actual</label>
                    <input type="text" class="patient-field-input js-input-eps" placeholder="Ej: EPS SURA, Nueva EPS..." value="${p.eps}" />
                </div>
            </div>

            <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap;">
                <span style="font-size: 0.82rem; color: var(--text-secondary);">
                    <i class="fa-solid fa-building-shield" style="color: var(--accent-blue);"></i>
                    <strong>Sede cercana recomendada:</strong> ${estadoSesion.sedePreferida}
                </span>
                <button type="button" class="btn-save-patient" onclick="guardarDatosFormularioPaciente(this)">
                    <i class="fa-solid fa-check-double"></i>
                    <span>Guardar mis datos y recomendar sede</span>
                </button>
            </div>
        </div>
    `;
}

// ============================================================================
// HISTORIAL REAL DE CONSULTAS RECIENTES EN LA BARRA LATERAL IZQUIERDA
// ============================================================================

function cargarConsultasRecientesDeStorage() {
    try {
        const guardado = localStorage.getItem("VOZMAYOR_RECENT_QUERIES");
        if (guardado) {
            estadoSesion.consultasReales = JSON.parse(guardado) || [];
        }
    } catch (e) {
        estadoSesion.consultasReales = [];
    }
    renderizarConsultasRecientesReales();
}

function registrarConsultaReal(textoConsulta, desdeVoz = false) {
    if (!textoConsulta) return;
    const limpia = textoConsulta.trim();
    if (!limpia || limpia === "__SALUDO_INICIAL__") return;

    const ahora = new Date();
    const hora = ahora.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });

    // Evitar duplicar exactamente la última consulta consecutiva
    estadoSesion.consultasReales = estadoSesion.consultasReales.filter(item => item.texto.toLowerCase() !== limpia.toLowerCase());

    estadoSesion.consultasReales.unshift({
        texto: limpia,
        hora: hora,
        desdeVoz: desdeVoz
    });

    if (estadoSesion.consultasReales.length > 12) {
        estadoSesion.consultasReales = estadoSesion.consultasReales.slice(0, 12);
    }

    try {
        localStorage.setItem("VOZMAYOR_RECENT_QUERIES", JSON.stringify(estadoSesion.consultasReales));
    } catch (e) {}

    renderizarConsultasRecientesReales();
}

function renderizarConsultasRecientesReales() {
    const contenedor = document.getElementById("recentQueriesList");
    if (!contenedor) return;

    if (!estadoSesion.consultasReales || estadoSesion.consultasReales.length === 0) {
        contenedor.innerHTML = `<div class="recent-empty-msg">Sus consultas reales aparecerán aquí a medida que hable o consulte con Luz María.</div>`;
        return;
    }

    contenedor.innerHTML = estadoSesion.consultasReales.map((item, idx) => {
        const textoSeguro = item.texto.replace(/'/g, "\\'").replace(/"/g, "&quot;");
        const icono = item.desdeVoz ? "fa-solid fa-microphone-lines" : "fa-regular fa-comment-dots";
        return `
            <button type="button" class="sidebar-link ${idx === 0 ? 'active' : ''}" onclick="enviarConsulta('${textoSeguro}', false)" title="${item.texto} (${item.hora})">
                <i class="${icono}" style="font-size: 0.75rem; color: var(--accent-blue); flex-shrink: 0;"></i>
                <span style="flex: 1; overflow: hidden; text-overflow: ellipsis;">${item.texto}</span>
            </button>
        `;
    }).join("");
}

function limpiarHistorialConsultasReales() {
    estadoSesion.consultasReales = [];
    try {
        localStorage.removeItem("VOZMAYOR_RECENT_QUERIES");
    } catch (e) {}
    renderizarConsultasRecientesReales();
}

// Las 6 opciones principales como tarjetas de acceso rápido estilo Gemini (con flecha ↳)
const ACCESOS_RAPIDOS_6 = [
    {
        titulo: "Citas médicas prioritarias",
        sub: "Asignación preferencial en medicina general, odontología o especialistas",
        consulta: "Quiero agendar una cita médica prioritaria",
        icono: "fa-regular fa-calendar-check"
    },
    {
        titulo: "Medicamentos a domicilio",
        sub: "Entrega gratuita en casa para mayores de 60 años (VozMayor en Casa)",
        consulta: "Solicito entrega de medicamentos a domicilio gratuita",
        icono: "fa-solid fa-pills"
    },
    {
        titulo: "Autorizaciones y órdenes",
        sub: "Radicación y seguimiento ágil de órdenes médicas y exámenes",
        consulta: "Necesito autorizar una orden médica y exámenes",
        icono: "fa-solid fa-file-medical"
    },
    {
        titulo: "Afiliaciones y certificados",
        sub: "Validación de derechos, exención de copagos y carné ante ADRES",
        consulta: "Consultar mi certificado de afiliación ADRES",
        icono: "fa-regular fa-id-card"
    },
    {
        titulo: "Sedes y farmacias Antioquia",
        sub: "Directorio de atención en Medellín, Valle de Aburrá y Oriente",
        consulta: "Cuáles son las sedes y farmacias de atención en Antioquia",
        icono: "fa-regular fa-hospital"
    },
    {
        titulo: "Apoyo al cuidador y Centros Vida",
        sub: "Orientación psicosocial, Línea Amiga 24h y red de Centros Vida",
        consulta: "Necesito apoyo al cuidador y red de Centros Vida",
        icono: "fa-solid fa-hand-holding-heart"
    }
];

function construirTarjetasGeminiHtml(lista) {
    return `
        <div class="ai-suggestions-grid" style="margin: 14px 0;">
            ${lista.map(item => `
                <button type="button" class="suggestion-card-btn" onclick="enviarConsulta('${item.consulta.replace(/'/g, "\\'")}')">
                    <div>
                        <div class="suggestion-card-text">${item.titulo}</div>
                        <span class="suggestion-card-sub">${item.sub}</span>
                    </div>
                    <div class="suggestion-card-bottom">
                        <i class="fa-solid fa-turn-up fa-rotate-90" title="Ejecutar acceso rápido"></i>
                        <i class="${item.icono}" style="opacity: 0.75;"></i>
                    </div>
                </button>
            `).join("")}
        </div>
    `;
}

// ============================================================================
// UTILIDADES DE RADICADO, FECHA HÁBIL Y LIMPIEZA FONÉTICA
// ============================================================================

function generarRadicado(prefijo) {
    const num = Math.floor(1000 + Math.random() * 9000);
    return `${prefijo}-VM-2026-${num}`;
}

function obtenerFechaCitaHabil() {
    const hoy = new Date();
    let diasSumar = 1;
    if (hoy.getDay() === 5) diasSumar = 3;
    else if (hoy.getDay() === 6) diasSumar = 2;

    const cita = new Date(hoy.getTime() + diasSumar * 24 * 60 * 60 * 1000);
    const dias = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
    const meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
    return `${dias[cita.getDay()]} ${cita.getDate()} de ${meses[cita.getMonth()]} de ${cita.getFullYear()}, 08:30 a.m.`;
}

function limpiarTextoParaLocucion(htmlOrText) {
    if (!htmlOrText) return "";
    const temp = document.createElement("div");
    temp.innerHTML = htmlOrText;
    let limpio = temp.textContent || temp.innerText || "";

    const reemplazos = [
        [/Cra\./g, "Carrera"],
        [/Dra\./g, "Doctora"],
        [/Dr\./g, "Doctor"],
        [/a\.m\./g, "de la mañana"],
        [/p\.m\./g, "de la tarde"],
        [/24\/7/g, "veinticuatro horas"],
        [/\$0 COP/g, "cero pesos"],
        [/COP/g, "pesos"],
        [/\(604\)/g, "seis cero cuatro,"],
        [/#/g, "número "],
        [/Estimado\/a/g, "Estimado"],
        [/usuario\/a/g, "usuario"],
        [/solo\/a/g, "solo"]
    ];

    for (const [regex, valor] of reemplazos) {
        limpio = limpio.replace(regex, valor);
    }

    return limpio.replace(/\s{2,}/g, " ").trim();
}

// ============================================================================
// MOTOR CONVERSACIONAL DE VOZMAYOR
// ============================================================================

function procesarConsultaVozMayor(mensajeUsuario) {
    const msg = (mensajeUsuario || "").toLowerCase().trim();
    estadoSesion.interacciones += 1;

    // Extraer automáticamente Nombre, Edad, Cédula, Ciudad/Municipio y EPS de lo que diga o escriba el Adulto Mayor
    const detectoDatosNuevos = extraerDatosPacienteDeTexto(mensajeUsuario);
    const p = estadoSesion.paciente;
    const saludoPersonalizado = p.nombre ? `estimado/a <strong>${p.nombre}</strong>` : `estimado/a usuario/a`;

    // 1. TRIAJE DE URGENCIA VITAL
    if (RIESGO_VITAL.some(frase => msg.includes(frase))) {
        estadoSesion.ultimoTema = "URGENCIA";
        const rad = generarRadicado("URG-123");
        estadoSesion.ultimoRadicado = rad;
        return {
            esUrgencia: true,
            thoughts: [
                "Detectados síntomas de alerta médica vital en la voz del usuario",
                "Activando protocolo ético de No Maleficencia y derivación inmediata a Línea 123",
                "Localizando centros hospitalarios de urgencias en el Valle de Aburrá"
            ],
            html: `
                <h3><i class="fa-solid fa-triangle-exclamation" style="color:#dc2626;"></i> [ATENCIÓN MÉDICA INMEDIATA — TRIAJE DE URGENCIA]</h3>
                <p>Mi ${saludoPersonalizado}, los síntomas que describe requieren <strong>asistencia médica presencial inmediata</strong>:</p>
                <ol>
                    <li><strong>Línea de Emergencias 123:</strong> Comuníquese sin demora o pida auxilio a un familiar o persona cercana.</li>
                    <li><strong>Línea de Ambulancias de Urgencia:</strong> Marque al <strong>(604) 444-1234</strong> (disponible las 24 horas).</li>
                    <li><strong>Centros Hospitalarios de Urgencias en el Valle de Aburrá:</strong>
                        <ul>
                            <li>Hospital General de Medellín: Cra. 48 # 32-102</li>
                            <li>Hospital San Vicente Fundación: Calle 64 # 51D-154</li>
                            <li>Clínica Las Américas: Diagonal 75B # 2A-80</li>
                            <li>Hospital Marco Fidel Suárez (Bello): Calle 44 # 49-25</li>
                        </ul>
                    </li>
                </ol>
                <p><strong>Por su seguridad, no se quede solo y acuda al servicio de urgencias más cercano.</strong></p>
            `,
            filasTabla: [
                { id: rad, titulo: "Derivación Inmediata a Línea Única 123", estado: "Urgencia Vital", claseEstado: "urgent", prioridad: "Inmediata", responsable: "CRUE Antioquia 123" },
                { id: "AMB-604-444", titulo: "Despacho de Ambulancia Prioritaria 24/7", estado: "Disponible", claseEstado: "urgent", prioridad: "Crítica", responsable: "Red Hospitalaria Medellín" }
            ],
            tituloSugerencias: "Acciones rápidas de emergencia y acompañamiento:",
            sugerencias: [
                { titulo: "Ver hospitales de urgencias cercanos", sub: "Direcciones en Medellín, Bello, Envigado y Rionegro", consulta: "Cuáles son las sedes y hospitales en Antioquia", icono: "fa-solid fa-truck-medical" },
                { titulo: "Comunicar con Línea Amiga 24 Horas", sub: "Apoyo emocional y orientación familiar inmediata", consulta: "Necesito apoyo al cuidador y Línea Amiga", icono: "fa-solid fa-phone-volume" },
                { titulo: "Volver al inicio de VozMayor", sub: "Reiniciar orientación general", consulta: "Mostrar mi ficha de datos para la EPS", icono: "fa-solid fa-rotate-left" }
            ]
        };
    }

    // 2. REGISTRO DE DATOS PERSONALES / PREPARACIÓN DE FICHA PARA IR A LA EPS
    const pideFichaExplicita = ["ficha", "mis datos", "me llamo", "mi nombre es", "mi cedula", "mi cédula", "tengo "].some(k => msg.includes(k));
    const mencionaTramiteEspecifico = ["cita", "medicamento", "medicina", "pastilla", "farmacia", "pendiente", "domicilio", "autoriz", "orden", "examen", "exámenes", "certificado", "cuidador"].some(k => msg.includes(k));

    if ((detectoDatosNuevos || pideFichaExplicita) && !mencionaTramiteEspecifico) {
        estadoSesion.ultimoTema = "REGISTRO_EPS";
        const rad = generarRadicado("EPS-FICHA");
        estadoSesion.ultimoRadicado = rad;

        const faltantes = [];
        if (!p.nombre) faltantes.push("su <strong>nombre completo</strong>");
        if (!p.edad) faltantes.push("su <strong>edad</strong>");
        if (!p.cedula) faltantes.push("su <strong>número de cédula</strong>");
        if (!p.ciudad) faltantes.push("la <strong>ciudad o municipio donde vive</strong>");

        const mensajeFaltantes = faltantes.length > 0
            ? `<p style="background: var(--badge-amber-bg); color: var(--badge-amber-text); padding: 10px 14px; border-radius: 9px; font-weight: 600;">
                <i class="fa-solid fa-circle-info"></i> Para dejar su orden 100% lista para la EPS, aún puede indicarme por voz o escribir abajo: ${faltantes.join(", ")}.
               </p>`
            : `<p style="background: var(--badge-green-bg); color: var(--badge-green-text); padding: 10px 14px; border-radius: 9px; font-weight: 600;">
                <i class="fa-solid fa-circle-check"></i> ¡Sus datos están completos! Su Ficha Preferencial para <strong>${p.eps}</strong> ya está lista sin filas en la sede más cercana a <strong>${p.ciudad}</strong>.
               </p>`;

        return {
            esUrgencia: false,
            thoughts: [
                `Registrando datos del afiliado: ${estadoSesion.documento}`,
                `Calculando sede IPS más cercana a ${p.ciudad || "su residencia en Antioquia"} -> ${estadoSesion.sedePreferida}`,
                `Dejando lista la Ficha de Atención Prioritaria EPS #${rad} (Ley 1171 de 2007)`
            ],
            html: `
                <h3><i class="fa-solid fa-id-card-clip" style="color:var(--accent-blue);"></i> Datos Registrados y Sede Cercana Recomendada para su EPS</h3>
                <p>Muchas gracias, mi ${saludoPersonalizado}. He actualizado su expediente preferencial en <strong>${NOMBRE_PROYECTO}</strong> para que no tenga que hacer filas en su EPS:</p>
                <ul>
                    <li><strong>Nombre del Adulto Mayor:</strong> ${p.nombre || "Por indicar"}</li>
                    <li><strong>Edad y Prioridad Legal:</strong> ${p.edad ? `${p.edad} años (Prelación Ley 1171 de 2007 Activa)` : "Adulto Mayor (+60 años - Ley 1171)"}</li>
                    <li><strong>Cédula de Ciudadanía:</strong> ${p.cedula ? `C.C. ${p.cedula} (Validado ADRES)` : "Por indicar"}</li>
                    <li><strong>Ciudad de Residencia:</strong> ${p.ciudad || "Medellín / Antioquia"}</li>
                    <li><strong>EPS de Afiliación:</strong> ${p.eps || "EPS SURA / Savia Salud"}</li>
                    <li><strong>Sede IPS Más Cercana Recomendada:</strong> <strong>${estadoSesion.sedePreferida}</strong></li>
                    <li><strong>Código Único para Ventanilla EPS:</strong> <code>${rad}</code></li>
                </ul>
                ${mensajeFaltantes}
                ${construirTarjetaFichaPacienteHtml()}
                <p><strong>Ahora que tenemos su sede cercana lista, ¿qué trámite desea adelantar hoy?</strong> Toque una opción o dígamelo por voz:</p>
                ${construirTarjetasGeminiHtml(ACCESOS_RAPIDOS_6)}
            `,
            filasTabla: [
                { id: rad, titulo: `Ficha Lista para EPS (${p.nombre || "Adulto Mayor"} • C.C. ${p.cedula || "Pendiente"})`, estado: faltantes.length === 0 ? "Lista para EPS" : "En Registro", claseEstado: faltantes.length === 0 ? "done" : "review", prioridad: "Prioridad +60", responsable: p.eps },
                { id: "SEDE-CERCANA", titulo: `Sede Recomendada: ${estadoSesion.sedePreferida}`, estado: "Asignada", claseEstado: "done", prioridad: `Cercana a ${p.ciudad || "usted"}`, responsable: estadoSesion.municipioCorto }
            ],
            tituloSugerencias: "",
            sugerencias: []
        };
    }

    // 3. CONFIRMACIÓN CONTEXTUAL
    const palabrasConfirmacion = ["si", "sí", "confirmo", "confirmar", "esta bien", "está bien", "de acuerdo", "claro", "por favor"];
    const esConfirmacionCorta = palabrasConfirmacion.some(pConf => msg === pConf || msg.startsWith(pConf + " ")) ||
        (["envigado", "bello", "rionegro", "itagui", "itagüí"].some(m => msg.includes(m)) && msg.split(" ").length <= 7);

    if (esConfirmacionCorta && ["CITA", "MEDICAMENTOS", "AUTORIZACION", "CERTIFICADO", "REGISTRO_EPS"].includes(estadoSesion.ultimoTema)) {
        const rad = generarRadicado("CONF-EPS");
        estadoSesion.ultimoRadicado = rad;
        const fecha = obtenerFechaCitaHabil();
        return {
            esUrgencia: false,
            thoughts: [
                `Confirmando solicitud del paciente ${estadoSesion.documento}`,
                `Dejando orden lista en la sede más cercana: ${estadoSesion.sedePreferida}`,
                `Generando comprobante oficial #${rad} listo para presentar en ${p.eps}`
            ],
            html: `
                <h3><i class="fa-solid fa-circle-check" style="color:#16a34a;"></i> Orden Lista para Presentar en su EPS — ${NOMBRE_PROYECTO}</h3>
                <p>Con mucho gusto, mi ${saludoPersonalizado}. Su solicitud y sus datos han quedado confirmados en firme sin hacer filas:</p>
                <ul>
                    <li><strong>Paciente Titular:</strong> ${p.nombre || "Adulto Mayor Preferencial"} ${p.edad ? `(${p.edad} años)` : ""}</li>
                    <li><strong>Documento Cédula:</strong> ${p.cedula ? `C.C. ${p.cedula}` : "Verificado en sistema"} • <strong>EPS:</strong> ${p.eps}</li>
                    <li><strong>Sede Cercana Asignada (${p.ciudad || estadoSesion.municipioCorto}):</strong> ${estadoSesion.sedePreferida}</li>
                    <li><strong>Fecha y Hora Preferencial:</strong> ${fecha}</li>
                    <li><strong>Código para Ventanilla Preferencial EPS:</strong> <code>${rad}</code></li>
                </ul>
                <p>Presente únicamente su cédula original y este código en la <strong>Ventanilla del Adulto Mayor</strong>. ¿En qué otra gestión le puedo colaborar?</p>
            `,
            filasTabla: [
                { id: rad, titulo: `Orden Oficial Lista para ${p.eps} (${estadoSesion.ultimoTema})`, estado: "Confirmado", claseEstado: "done", prioridad: "Alta • Ley 1171", responsable: estadoSesion.municipioCorto },
                { id: "COP-000", titulo: "Exención de Cuota Moderadora y Copago ($0 COP)", estado: "Aplicado", claseEstado: "done", prioridad: "Adulto Mayor", responsable: p.eps }
            ],
            tituloSugerencias: "¿Desea realizar alguna otra gestión?",
            sugerencias: ACCESOS_RAPIDOS_6.slice(0, 3)
        };
    }

    // 4. CITAS MÉDICAS
    if (["cita", "consulta", "medico", "médico", "doctor", "odontolog", "optometr", "optometra", "especialista", "control"].some(k => msg.includes(k))) {
        estadoSesion.ultimoTema = "CITA";
        const rad = generarRadicado("CIT-EPS");
        estadoSesion.ultimoRadicado = rad;
        const fecha = obtenerFechaCitaHabil();

        if (msg.includes("cancel") || msg.includes("reprogram")) {
            return {
                esUrgencia: false,
                thoughts: [
                    `Consultando agenda de citas activas de ${estadoSesion.documento}`,
                    "Aplicando exención de multa por reprogramación preferencial",
                    "Habilitando cambio inmediato de fecha o municipio en Antioquia"
                ],
                html: `
                    <h3><i class="fa-solid fa-calendar-xmark" style="color:var(--accent-blue);"></i> Cancelación o Reprogramación de Cita Médica</h3>
                    <p>Para reprogramar su cita médica en <strong>${NOMBRE_PROYECTO}</strong>, mi ${saludoPersonalizado}:</p>
                    <ul>
                        <li><strong>Paciente:</strong> ${estadoSesion.documento}</li>
                        <li><strong>Sede Actual:</strong> ${estadoSesion.sedePreferida}</li>
                        <li>Díganos en el micrófono para qué municipio o jornada desea cambiarla, o llame al <strong>(604) 444-7262 (Opción 2)</strong>.</li>
                    </ul>
                `,
                filasTabla: [
                    { id: rad, titulo: "Solicitud de Reprogramación sin Penalidad", estado: "En Proceso", claseEstado: "review", prioridad: "Preferencial", responsable: "Central Citas (604) 444-7262" }
                ],
                tituloSugerencias: "Opciones rápidas para su cita médica:",
                sugerencias: [
                    { titulo: "Reprogramar para la sede de Envigado", sub: "CIS Envigado Parque (Calle 37 Sur # 41-28)", consulta: "Prefiero confirmar mi cita en la sede de Envigado", icono: "fa-solid fa-location-dot" },
                    { titulo: "Reprogramar para la sede de Bello", sub: "Sede Bello Choza Marco Fidel Suárez", consulta: "Prefiero confirmar mi cita en la sede de Bello", icono: "fa-solid fa-location-dot" },
                    { titulo: "Agendar nueva cita prioritaria en 48h", sub: "Medicina general o valoración integral", consulta: "Quiero agendar una cita médica prioritaria", icono: "fa-regular fa-calendar-check" }
                ]
            };
        }

        let servicio = "Consulta Médica General y Valoración Integral del Adulto Mayor";
        if (msg.includes("odontolog")) servicio = "Odontología Preventiva y Rehabilitación Oral Adulto Mayor";
        else if (msg.includes("optometr")) servicio = "Optometría y Control Visual Preferencial";

        return {
            esUrgencia: false,
            thoughts: [
                "Validando derecho de asignación prioritaria en máximo 48h (Ley 1171 de 2007)",
                `Seleccionando la sede más cercana a ${p.ciudad || estadoSesion.municipioCorto}: ${estadoSesion.sedePreferida}`,
                `Dejando orden de cita #${rad} lista para presentar en ${p.eps} con $0 de copago`
            ],
            html: `
                <h3><i class="fa-regular fa-calendar-check" style="color:#16a34a;"></i> Cita Médica Prioritaria Lista para su EPS</h3>
                <p>Con el mayor gusto, mi ${saludoPersonalizado}. He agendado su cita prioritaria en la sede más cercana a su residencia:</p>
                <ul>
                    <li><strong>Paciente:</strong> ${p.nombre || "Adulto Mayor Preferencial"} ${p.edad ? `• <strong>Edad:</strong> ${p.edad} años` : ""}</li>
                    <li><strong>Cédula:</strong> ${p.cedula ? `C.C. ${p.cedula}` : "Pendiente de indicar"} • <strong>EPS:</strong> ${p.eps}</li>
                    <li><strong>Servicio Médico:</strong> ${servicio}</li>
                    <li><strong>Sede Cercana Recomendada:</strong> <strong>${estadoSesion.sedePreferida}</strong></li>
                    <li><strong>Fecha y Hora Asignada:</strong> ${fecha} (Consultorio 204 - Dra. Marcela Peláez)</li>
                    <li><strong>Radicado para presentar en EPS:</strong> <code>${rad}</code></li>
                </ul>
                ${(!p.nombre || !p.cedula) ? `<p style="color:var(--badge-amber-text); font-weight:600;"><i class="fa-solid fa-user-check"></i> Recuerde que puede decirme su nombre completo, edad, cédula y ciudad por el micrófono para dejar esta orden personalizada con su documento.</p>` : ""}
                <p><strong>Instrucciones para ir a su EPS:</strong> Llegar 15 minutos antes a la <strong>Ventanilla Preferencial del Adulto Mayor</strong> con su cédula original. ¿Desea confirmar esta cita o cambiar de municipio?</p>
            `,
            filasTabla: [
                { id: rad, titulo: `${servicio} (${p.nombre || "Titular"})`, estado: "Lista para EPS", claseEstado: "done", prioridad: "Prioritaria 48h", responsable: "Dra. Marcela Peláez" },
                { id: "COP-EXENTO", titulo: `Exención Cuota Moderadora en ${p.eps} ($0 COP)`, estado: "Aplicado", claseEstado: "done", prioridad: "Ley 1171", responsable: estadoSesion.municipioCorto }
            ],
            tituloSugerencias: "Accesos rápidos sugeridos para su cita médica:",
            sugerencias: [
                { titulo: "Confirmar esta fecha y hora asignada", sub: `Dejar en firme el turno ${rad} en ${estadoSesion.municipioCorto}`, consulta: "Sí, confirmo esta fecha de mi cita médica", icono: "fa-solid fa-check" },
                { titulo: "Actualizar mis datos (Nombre, Cédula, Ciudad)", sub: "Dejar lista mi ficha personal para la EPS", consulta: "Mostrar mi ficha de datos para la EPS", icono: "fa-regular fa-id-card" },
                { titulo: "Solicitar medicamentos a domicilio", sub: "Coordinar envío gratuito con VozMayor en Casa", consulta: "Solicito entrega de medicamentos a domicilio gratuita", icono: "fa-solid fa-pills" }
            ]
        };
    }

    // 5. MEDICAMENTOS Y ENTREGA DOMICILIARIA
    if (["medicamento", "medicina", "pastilla", "droga", "farmacia", "formula", "fórmula", "pendiente", "domicilio", "entrega", "cruz verde", "audifarma"].some(k => msg.includes(k))) {
        estadoSesion.ultimoTema = "MEDICAMENTOS";

        if (["no hay", "pendiente", "no tenian", "no tenían", "falta", "incompleto", "queja"].some(k => msg.includes(k))) {
            const rad = generarRadicado("PQR-MED");
            estadoSesion.ultimoRadicado = rad;
            return {
                esUrgencia: false,
                thoughts: [
                    "Activando protección legal Resolución 1604 de 2013 para medicamentos pendientes",
                    `Vinculando titular ${estadoSesion.documento} con farmacia de ${estadoSesion.municipioCorto}`,
                    "Programando despacho obligatorio a domicilio en plazo máximo de 48 horas hábiles"
                ],
                html: `
                    <h3><i class="fa-solid fa-scale-balanced" style="color:#b45309;"></i> Reclamo de Medicamento Pendiente (Entrega en 48 Horas)</h3>
                    <p>Mi ${saludoPersonalizado}, en <strong>${NOMBRE_PROYECTO}</strong> hacemos cumplir la <strong>Resolución 1604 de 2013</strong> ante su EPS (${p.eps}):</p>
                    <ol>
                        <li>La farmacia dispensadora tiene obligación legal de entregarle sus medicamentos pendientes en <strong>máximo 48 horas hábiles en la puerta de su casa en ${p.ciudad || estadoSesion.municipioCorto}</strong> sin costo.</li>
                        <li>Hemos radicado la orden prioritaria a nombre de <strong>${estadoSesion.documento}</strong>.</li>
                    </ol>
                    <ul>
                        <li><strong>Número de Radicado ante EPS y Farmacia:</strong> <code>${rad}</code></li>
                        <li><strong>Sede Farmacéutica Responsable:</strong> ${estadoSesion.sedePreferida}</li>
                    </ul>
                `,
                filasTabla: [
                    { id: rad, titulo: "Exigencia Legal de Despacho en 48h (Res. 1604)", estado: "Radicado", claseEstado: "review", prioridad: "Urgente 48h", responsable: `Farmacia ${p.eps}` },
                    { id: "DOM-GRATIS", titulo: `Envío a domicilio en ${p.ciudad || estadoSesion.municipioCorto} ($0 COP)`, estado: "Garantizado", claseEstado: "done", prioridad: "Alta", responsable: estadoSesion.municipioCorto }
                ],
                tituloSugerencias: "Acciones sugeridas para su reclamo farmacéutico:",
                sugerencias: [
                    { titulo: "Confirmar envío a mi casa en 48h", sub: "Activar mensajero prioritario sin costo", consulta: "Sí, confirmo el envío de mis medicamentos a mi domicilio", icono: "fa-solid fa-truck-fast" },
                    { titulo: "Ver o completar mi Ficha EPS", sub: "Verificar nombre, cédula y ciudad de entrega", consulta: "Mostrar mi ficha de datos para la EPS", icono: "fa-regular fa-id-card" },
                    { titulo: "Ver teléfonos y sedes de farmacias", sub: "Directorio en Medellín, Bello, Envigado y Rionegro", consulta: "Cuáles son las sedes y farmacias de atención en Antioquia", icono: "fa-regular fa-hospital" }
                ]
            };
        }

        const rad = generarRadicado("DOM-MED");
        estadoSesion.ultimoRadicado = rad;
        return {
            esUrgencia: false,
            thoughts: [
                "Verificando elegibilidad en el programa «VozMayor en Casa» (+60 años)",
                `Sincronizando orden de ${estadoSesion.documento} con farmacia en ${estadoSesion.municipioCorto}`,
                `Generando radicado de envío domiciliario gratuito #${rad}`
            ],
            html: `
                <h3><i class="fa-solid fa-pills" style="color:var(--accent-blue);"></i> Programa «VozMayor en Casa» — Medicamentos a Domicilio</h3>
                <p>Con mucho gusto, mi ${saludoPersonalizado}. Por su condición de adulto mayor, hemos preparado la orden de entrega gratuita en casa con su EPS (<strong>${p.eps}</strong>):</p>
                <ul>
                    <li><strong>Paciente Titular:</strong> ${estadoSesion.documento}</li>
                    <li><strong>Farmacia Cercana Asignada:</strong> ${estadoSesion.sedePreferida}</li>
                    <li><strong>Plazo de entrega en su casa:</strong> 24 a 48 horas hábiles ($0 COP).</li>
                    <li><strong>Radicado de Domicilio:</strong> <code>${rad}</code></li>
                </ul>
                <p>¿Desea dejar confirmada la entrega a su domicilio?</p>
            `,
            filasTabla: [
                { id: rad, titulo: `Despacho «VozMayor en Casa» (${p.nombre || "Titular"})`, estado: "Programado", claseEstado: "done", prioridad: "Prioritaria", responsable: `Farmacia ${estadoSesion.municipioCorto}` },
                { id: "ENV-000", titulo: "Tarifa de Domicilio Adulto Mayor ($0 COP)", estado: "Exento", claseEstado: "done", prioridad: "Ley 1171", responsable: p.eps }
            ],
            tituloSugerencias: "Accesos rápidos sugeridos para sus medicamentos:",
            sugerencias: [
                { titulo: "Confirmar despacho a domicilio ahora", sub: "Entrega en 24 a 48 horas hábiles sin costo", consulta: "Sí, confirmo el despacho de medicamentos a mi casa", icono: "fa-solid fa-check" },
                { titulo: "Reportar un medicamento pendiente", sub: "Exigir entrega en 48h bajo Resolución 1604", consulta: "En la farmacia dejaron mi medicamento pendiente", icono: "fa-solid fa-scale-balanced" },
                { titulo: "Agendar cita médica de control", sub: "Renovación de fórmula médica", consulta: "Quiero agendar una cita médica prioritaria", icono: "fa-regular fa-calendar-check" }
            ]
        };
    }

    // 6. AUTORIZACIONES Y ÓRDENES MÉDICAS
    if (["autoriz", "orden", "examen", "exámenes", "laboratorio", "ecograf", "radiograf", "resonanc", "remision", "remisión", "radicar", "procedimiento"].some(k => msg.includes(k))) {
        estadoSesion.ultimoTema = "AUTORIZACION";
        const rad = generarRadicado("AUT-EPS");
        estadoSesion.ultimoRadicado = rad;
        return {
            esUrgencia: false,
            thoughts: [
                `Validando órdenes médicas del paciente ${estadoSesion.documento}`,
                "Aplicando exención de autorización para exámenes de primer nivel (Circular SuperSalud)",
                `Radicando solicitud preferencial #${rad} en la sede más cercana: ${estadoSesion.sedePreferida}`
            ],
            html: `
                <h3><i class="fa-solid fa-file-medical" style="color:var(--accent-blue);"></i> Autorización de Órdenes y Exámenes Lista para EPS</h3>
                <p>Mi ${saludoPersonalizado}, hemos dejado lista la ruta de sus exámenes en <strong>${p.eps}</strong> para que no haga filas innecesarias:</p>
                <ul>
                    <li><strong>Paciente:</strong> ${estadoSesion.documento}</li>
                    <li><strong>Exámenes de laboratorio de sangre, orina, rayos X simples y electrocardiograma:</strong> <strong>NO requieren autorización</strong>. Puede ir directamente a <strong>${estadoSesion.sedePreferida}</strong> solo con su cédula.</li>
                    <li><strong>Exámenes especializados:</strong> Quedan radicados bajo el código <code>${rad}</code> con aprobación preferencial en máximo 48 horas hábiles.</li>
                </ul>
            `,
            filasTabla: [
                { id: rad, titulo: "Autorización de Exámenes Especializados", estado: "En Revisión 48h", claseEstado: "review", prioridad: "Alta", responsable: `Auditoría ${p.eps}` },
                { id: "LAB-DIR", titulo: "Laboratorios de Sangre, Orina y Rayos X Simples", estado: "Sin Autorización", claseEstado: "done", prioridad: "Paso Directo", responsable: estadoSesion.municipioCorto }
            ],
            tituloSugerencias: "Opciones sugeridas para sus órdenes médicas:",
            sugerencias: [
                { titulo: "Confirmar envío de autorización por SMS", sub: "Recibir orden aprobada directamente en el celular", consulta: "Sí, confirmo el envío de la autorización a mi celular", icono: "fa-solid fa-mobile-screen" },
                { titulo: "Agendar cita con médico especialista", sub: "Medicina interna, cardiología, optometría u odontología", consulta: "Quiero agendar una cita con médico especialista", icono: "fa-solid fa-user-doctor" },
                { titulo: "Ver o actualizar mi Ficha para la EPS", sub: "Confirmar nombre, edad, cédula y ciudad", consulta: "Mostrar mi ficha de datos para la EPS", icono: "fa-regular fa-id-card" }
            ]
        };
    }

    // 7. AFILIACIÓN Y CERTIFICADOS ADRES
    if (["afilia", "certificado", "carne", "carné", "estado", "vigente", "copago", "subsidio", "regimen", "régimen", "adres"].some(k => msg.includes(k))) {
        estadoSesion.ultimoTema = "CERTIFICADO";
        const rad = generarRadicado("CERT-ADRES");
        estadoSesion.ultimoRadicado = rad;
        return {
            esUrgencia: false,
            thoughts: [
                "Consultando en línea la Base de Datos Única de Afiliados (ADRES)",
                `Verificando protección constitucional del Adulto Mayor para ${estadoSesion.documento}`,
                `Emitiendo certificado oficial #${rad} listo para imprimir o presentar en EPS`
            ],
            html: `
                <h3><i class="fa-regular fa-id-card" style="color:#15803d;"></i> Certificado de Afiliación ADRES y Exención de Copagos</h3>
                <p>Constancia oficial generada para presentar directamente en su EPS (<strong>${p.eps}</strong>):</p>
                <ul>
                    <li><strong>Nombre del Titular:</strong> ${p.nombre || "Adulto Mayor Preferencial"} ${p.edad ? `(${p.edad} años)` : ""}</li>
                    <li><strong>Cédula de Ciudadanía:</strong> ${p.cedula ? `C.C. ${p.cedula}` : "Verificado por voz"}</li>
                    <li><strong>EPS y Estado:</strong> ${p.eps} — <strong>ACTIVO (Prelación Ley 1171 de 2007)</strong></li>
                    <li><strong>Copagos y Cuotas Moderadoras:</strong> <strong>EXENTO ($0 COP)</strong></li>
                    <li><strong>Sede IPS Más Cercana Asignada:</strong> ${estadoSesion.sedePreferida}</li>
                    <li><strong>Código de Certificado ADRES:</strong> <code>${rad}</code></li>
                </ul>
            `,
            filasTabla: [
                { id: rad, titulo: `Certificado ADRES Activo • ${estadoSesion.documento}`, estado: "Activo", claseEstado: "done", prioridad: "Preferencial", responsable: "Base de Datos ADRES" },
                { id: "EXEN-1171", titulo: "Exención 100% de Copagos y Cuotas Moderadoras", estado: "Vigente", claseEstado: "done", prioridad: "Permanente", responsable: p.eps }
            ],
            tituloSugerencias: "Gestiones rápidas disponibles con su afiliación activa:",
            sugerencias: ACCESOS_RAPIDOS_6.slice(0, 3)
        };
    }

    // 8. SEDES Y FARMACIAS EN ANTIOQUIA
    if (["sede", "sedes", "direccion", "dirección", "donde queda", "donde estan", "dónde", "telefono", "teléfono", "horario", "antioquia"].some(k => msg.includes(k))) {
        estadoSesion.ultimoTema = "SEDES";
        const rad = generarRadicado("DIR-ANT");
        estadoSesion.ultimoRadicado = rad;
        return {
            esUrgencia: false,
            thoughts: [
                "Consultando red de IPS y farmacias con Ventanilla del Adulto Mayor en Antioquia",
                `Recomendando sede más cercana según ciudad (${p.ciudad || "Medellín"}): ${estadoSesion.sedePreferida}`,
                "Habilitando cambio de sede con un clic"
            ],
            html: `
                <h3><i class="fa-regular fa-hospital" style="color:var(--accent-blue);"></i> Sedes Recomendadas en Antioquia (Sin Filas para Adulto Mayor)</h3>
                <p>Mi ${saludoPersonalizado}, según su ubicación en <strong>${p.ciudad || "el Valle de Aburrá"}</strong>, su sede recomendada es <strong>${estadoSesion.sedePreferida}</strong>. Aquí tiene todo nuestro directorio con Ventanilla Preferencial:</p>
                <ul>
                    <li><strong>Medellín Centro (Principal):</strong> Cra. 46 # 54-20 (Sector Parque Bolívar).</li>
                    <li><strong>Envigado y Sur (Sabaneta, La Estrella):</strong> Calle 37 Sur # 41-28 (Parque de Envigado).</li>
                    <li><strong>Itagüí:</strong> Cra. 51 # 50-21 (Parque Principal de Itagüí).</li>
                    <li><strong>Bello y Norte (Copacabana, Girardota):</strong> Cra. 50 # 51-14 (Choza Marco Fidel Suárez).</li>
                    <li><strong>Rionegro y Oriente Antioqueño:</strong> Calle 47 # 56-35 (Centro Médico Savanna Plaza).</li>
                </ul>
            `,
            filasTabla: [
                { id: "MED-01", titulo: "IPS Aliada Medellín Centro (Cra. 46 # 54-20)", estado: "Fila Cero Activa", claseEstado: "done", prioridad: "Centro", responsable: "Medellín" },
                { id: "ENV-02", titulo: "CIS Envigado Parque (Calle 37 Sur # 41-28)", estado: "Fila Cero Activa", claseEstado: "done", prioridad: "Sur Aburrá", responsable: "Envigado" },
                { id: "BEL-03", titulo: "Sede Bello Marco Fidel Suárez (Cra. 50 # 51-14)", estado: "Fila Cero Activa", claseEstado: "done", prioridad: "Norte Aburrá", responsable: "Bello" },
                { id: "RIO-04", titulo: "Centro Médico Savanna Rionegro (Calle 47 # 56-35)", estado: "Fila Cero Activa", claseEstado: "done", prioridad: "Oriente", responsable: "Rionegro" }
            ],
            tituloSugerencias: "Seleccione su ciudad para asignarle la sede más cercana:",
            sugerencias: [
                { titulo: "Vivo en Envigado o Sur del Aburrá", sub: "Asignar CIS Envigado Parque (Calle 37 Sur # 41-28)", consulta: "Vivo en Envigado, asignar sede cercana", icono: "fa-solid fa-location-dot" },
                { titulo: "Vivo en Bello o Norte del Aburrá", sub: "Asignar Sede Bello Marco Fidel Suárez", consulta: "Vivo en Bello, asignar sede cercana", icono: "fa-solid fa-location-dot" },
                { titulo: "Vivo en Rionegro u Oriente", sub: "Asignar Centro Médico Savanna Rionegro", consulta: "Vivo en Rionegro, asignar sede cercana", icono: "fa-solid fa-location-dot" }
            ]
        };
    }

    // 9. APOYO AL CUIDADOR, CENTROS VIDA Y LEY 1171
    if (["cuidador", "familia", "centro vida", "centros vida", "solo", "sola", "triste", "depres", "angustia", "psicolog", "acompañamiento", "ley 1171", "derecho"].some(k => msg.includes(k))) {
        estadoSesion.ultimoTema = "CUIDADOR";
        const rad = generarRadicado("VIDA");
        estadoSesion.ultimoRadicado = rad;
        return {
            esUrgencia: false,
            thoughts: [
                "Consultando programas de bienestar psicosocial y Red de Centros Vida en Antioquia",
                "Activando ruta de apoyo familiar «Cuidar al que Cuida»",
                "Verificando garantías éticas y constitucionales de la Ley 1171 de 2007"
            ],
            html: `
                <h3><i class="fa-solid fa-hand-holding-heart" style="color:#be185d;"></i> Apoyo al Cuidador, Centros Vida y Garantías Ley 1171</h3>
                <ul>
                    <li><strong>Red de Centros Vida (Antioquia):</strong> Actividades gratuitas de gimnasia adaptada, nutrición, música y encuentro social para el adulto mayor en ${p.ciudad || "su municipio"}.</li>
                    <li><strong>Programa «Cuidar al que Cuida»:</strong> Relevos domiciliarios de enfermería y orientación psicológica para familiares cuidadores.</li>
                    <li><strong>Línea Amiga Salud Mental (24/7):</strong> <strong>(604) 444-4448</strong> — Escucha cálida y gratuita.</li>
                </ul>
                <p>Su solicitud ha quedado registrada bajo el radicado <code>${rad}</code>.</p>
            `,
            filasTabla: [
                { id: rad, titulo: "Inscripción a Red de Centros Vida y Apoyo Familiar", estado: "Inscrito", claseEstado: "done", prioridad: "Prioritaria", responsable: "Trabajo Social VozMayor" },
                { id: "LIN-4448", titulo: "Línea Amiga de Escucha y Salud Mental (604) 444-4448", estado: "Activa 24/7", claseEstado: "done", prioridad: "Gratuita", responsable: "Red Salud Mental" }
            ],
            tituloSugerencias: "Otras gestiones que puedo adelantar por usted:",
            sugerencias: ACCESOS_RAPIDOS_6.slice(0, 3)
        };
    }

    // 10. BIENVENIDA INICIAL: LUZ MARÍA PIDE NOMBRE, EDAD, CÉDULA, CIUDAD Y EPS PARA RECOMENDAR SEDE Y DEJARLO LISTO PARA IR A LA EPS
    estadoSesion.ultimoTema = "BIENVENIDA";
    return {
        esUrgencia: false,
        thoughts: [
            "Iniciando recepción asistida por voz del Adulto Mayor (Ley 1171 de 2007)",
            "Preparando registro de Nombre, Edad, Cédula, Ciudad de residencia y EPS",
            "Listo para recomendar la sede IPS más cercana en Antioquia y emitir orden sin filas"
        ],
        html: `
            <h3><i class="fa-solid fa-user-nurse" style="color:var(--accent-blue);"></i> Buen día, mi estimado/a. Qué alegría saludarle.</h3>
            <p>Le habla <strong>${ASESORA}</strong>, su orientadora en <strong>${NOMBRE_PROYECTO}</strong>. Mi propósito es dejarle todo listo para que cuando vaya a su <strong>EPS</strong> lo atiendan por <strong>Ventanilla Preferencial sin hacer filas</strong>.</p>
            <p><strong>Para empezar y recomendarle la sede más cercana a su casa, por favor presione «Dictar por voz» (o escríbalo abajo) y dígame:</strong></p>
            <ul>
                <li><strong>1. Su nombre completo y su edad</strong> (para activar su prioridad de la Ley 1171).</li>
                <li><strong>2. Su número de cédula y su EPS</strong> (SURA, Nueva EPS, Savia Salud, Sanitas...).</li>
                <li><strong>3. La ciudad o municipio donde vive</strong> (Medellín, Envigado, Bello, Itagüí, Rionegro...) para asignarle la sede más cercana.</li>
            </ul>
            ${construirTarjetaFichaPacienteHtml()}
            <p><strong>O si prefiere ir directamente a un trámite de salud, toque cualquiera de estos accesos rápidos:</strong></p>
            ${construirTarjetasGeminiHtml(ACCESOS_RAPIDOS_6)}
        `,
        filasTabla: [
            { id: "PASO-1-DATOS", titulo: "Registro de Nombre, Edad, Cédula y Ciudad de Residencia", estado: p.nombre ? "Completado" : "Esperando sus datos", claseEstado: p.nombre ? "done" : "review", prioridad: "Paso Inicial", responsable: "Luz María Gómez IA" },
            { id: "PASO-2-SEDE", titulo: `Asignación de Sede Cercana: ${estadoSesion.sedePreferida}`, estado: "Disponible", claseEstado: "done", prioridad: "Cero Filas", responsable: estadoSesion.municipioCorto },
            { id: "PASO-3-EPS", titulo: "Orden Oficial de Atención Preferencial Lista para EPS (Ley 1171)", estado: "Activa", claseEstado: "done", prioridad: "Exento Copago ($0)", responsable: p.eps }
        ],
        tituloSugerencias: "",
        sugerencias: []
    };
}

// ============================================================================
// CONSTRUCCIÓN ACUMULATIVA DE CADA TURNO EN LA CONVERSACIÓN
// ============================================================================

function construirHtmlTabla(filas) {
    const rowsHtml = filas.map(f => `
        <tr>
            <td class="td-code">${f.id}</td>
            <td style="font-weight: 500;">${f.titulo}</td>
            <td>
                <span class="state-badge ${f.claseEstado}">
                    <i class="fa-solid ${f.claseEstado === 'urgent' ? 'fa-triangle-exclamation' : (f.claseEstado === 'done' ? 'fa-check' : 'fa-clock')}"></i>
                    ${f.estado}
                </span>
            </td>
            <td style="color: var(--text-secondary); font-weight: 500;">${f.prioridad}</td>
            <td>
                <span class="assignee-cell">
                    <i class="fa-solid fa-user-doctor" style="color: var(--accent-blue); font-size: 0.78rem;"></i>
                    <span>${f.responsable}</span>
                </span>
            </td>
        </tr>
    `).join("");

    return `
        <div class="ai-structured-table-wrap">
            <table class="ai-structured-table">
                <thead>
                    <tr>
                        <th>Radicado</th>
                        <th>Trámite / Servicio de Salud</th>
                        <th>Estado</th>
                        <th>Prioridad</th>
                        <th>Sede / Responsable</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
            </table>
        </div>
    `;
}

function construirHtmlSugerencias(titulo, listaSugerencias) {
    if (!listaSugerencias || listaSugerencias.length === 0) {
        return `
            <div class="response-feedback-bar">
                <button class="feedback-icon-btn" title="Respuesta útil" onclick="repetirUltimaLocucion()">
                    <i class="fa-regular fa-thumbs-up"></i>
                </button>
                <button class="feedback-icon-btn" title="Escuchar o repetir en voz alta" onclick="repetirUltimaLocucion()">
                    <i class="fa-solid fa-rotate-right"></i>
                </button>
                <button class="feedback-icon-btn" title="Copiar radicado" onclick="copiarComprobante()">
                    <i class="fa-regular fa-copy"></i>
                </button>
                <button class="feedback-icon-btn" title="Imprimir o guardar PDF" onclick="window.print()">
                    <i class="fa-solid fa-print"></i>
                </button>
            </div>
        `;
    }

    return `
        <section class="ai-suggestions-section">
            <h3 class="ai-suggestions-heading">${titulo}</h3>
            ${construirTarjetasGeminiHtml(listaSugerencias)}
            <div class="response-feedback-bar">
                <button class="feedback-icon-btn" title="Respuesta útil" onclick="repetirUltimaLocucion()">
                    <i class="fa-regular fa-thumbs-up"></i>
                </button>
                <button class="feedback-icon-btn" title="Escuchar o repetir en voz alta" onclick="repetirUltimaLocucion()">
                    <i class="fa-solid fa-rotate-right"></i>
                </button>
                <button class="feedback-icon-btn" title="Copiar radicado" onclick="copiarComprobante()">
                    <i class="fa-regular fa-copy"></i>
                </button>
                <button class="feedback-icon-btn" title="Imprimir o guardar PDF" onclick="window.print()">
                    <i class="fa-solid fa-print"></i>
                </button>
            </div>
        </section>
    `;
}

// Función invocada cuando el Adulto Mayor presiona el botón azul grande "Enviar consulta"
function enviarConsultaDesdeBoton() {
    const input = document.getElementById("composerVttInput");
    const textoEnInput = input ? input.value.trim() : "";
    const textoEnMemoriaVoz = (textoAcumuladoVoz + " " + textoParcialActual).replace(/\s{2,}/g, " ").trim();

    // Tomar la versión más completa disponible en el instante exacto del clic (0 ms de retraso)
    const consultaFinal = textoEnInput.length >= textoEnMemoriaVoz.length ? textoEnInput : textoEnMemoriaVoz;
    const veniaDeMicrofono = mantenerMicrofonoActivo || estadoSesion.escuchandoMicrofono || Boolean(textoEnMemoriaVoz);

    if (mantenerMicrofonoActivo || estadoSesion.escuchandoMicrofono) {
        detenerCapturaAudioHardware();
        restaurarEstadoMicrofono();
    }

    textoAcumuladoVoz = "";
    textoParcialActual = "";

    if (!consultaFinal) {
        if (input) input.focus();
        return;
    }

    enviarConsulta(consultaFinal, veniaDeMicrofono);
}

function enviarConsulta(textoExplicito, desdeVoz = false) {
    if (mantenerMicrofonoActivo) {
        detenerCapturaAudioHardware();
        restaurarEstadoMicrofono();
    }

    const input = document.getElementById("composerVttInput");
    const consulta = (textoExplicito !== undefined ? textoExplicito : (input ? input.value : "")).trim();
    if (!consulta) return;

    if (input) {
        input.value = "";
    }

    // Registrar en el historial REAL de Consultas Recientes en la barra lateral izquierda
    registrarConsultaReal(consulta, desdeVoz);

    const res = procesarConsultaVozMayor(consulta);
    actualizarResumenDocumentoPaciente();

    const threadInner = document.getElementById("aiThreadInner");
    if (!threadInner) return;

    const turnDiv = document.createElement("div");
    turnDiv.className = "conversation-turn";

    const thoughtsHtml = res.thoughts.map(t => `<div class="thought-step">${t}</div>`).join("");

    turnDiv.innerHTML = `
        <div class="user-query-row">
            <div class="user-query-pill">
                <i class="fa-solid ${desdeVoz ? 'fa-microphone-lines' : 'fa-comment-medical'}" style="color: var(--accent-blue);"></i>
                <span>${consulta}</span>
            </div>
        </div>

        <div class="ai-thoughts-block">
            <button class="thoughts-toggle-btn" onclick="const tl = this.nextElementSibling; tl.style.display = tl.style.display === 'none' ? 'flex' : 'none';">
                <span>Proceso de verificación IA</span>
                <i class="fa-solid fa-caret-down"></i>
            </button>
            <div class="thoughts-timeline">
                ${thoughtsHtml}
            </div>
        </div>

        <article class="ai-narrative-response ai-response-card-box ${res.esUrgencia ? 'urgent-card' : ''}">
            ${res.html}
        </article>

        ${construirHtmlSugerencias(res.tituloSugerencias, res.sugerencias)}

        ${construirHtmlTabla(res.filasTabla)}
    `;

    threadInner.appendChild(turnDiv);

    setTimeout(() => {
        turnDiv.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 30);

    hablarRespuesta(res.html);
}

// ============================================================================
// SÍNTESIS DE VOZ (TEXT-TO-SPEECH)
// ============================================================================

function hablarRespuesta(htmlRespuesta) {
    const textoLimpio = limpiarTextoParaLocucion(htmlRespuesta);
    estadoSesion.ultimoMensajeTextoPlano = textoLimpio;

    if (!estadoSesion.vozActiva || !("speechSynthesis" in window)) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(textoLimpio);
    utterance.lang = "es-CO";
    utterance.rate = estadoSesion.hablarLento ? 0.82 : 0.98;
    utterance.pitch = 1.02;

    const voces = window.speechSynthesis.getVoices();
    const vozPreferida =
        voces.find(v => v.lang.includes("es-CO") && /salome|female|mujer|natural|helena|sabina|paulina/i.test(v.name)) ||
        voces.find(v => v.lang.includes("es-CO")) ||
        voces.find(v => v.lang.startsWith("es") && /natural|online|google|microsoft|sabina|paulina|helena/i.test(v.name)) ||
        voces.find(v => v.lang.startsWith("es"));

    if (vozPreferida) utterance.voice = vozPreferida;

    const statusLbl = document.getElementById("vttStatusLabel");
    utterance.onstart = () => {
        if (statusLbl) statusLbl.textContent = "Luz María está hablando en voz alta...";
    };
    utterance.onend = () => {
        if (statusLbl) statusLbl.textContent = "Voz a texto activo (es-CO)";
    };

    window.speechSynthesis.speak(utterance);
}

// ============================================================================
// MOTOR DE RECONOCIMIENTO DE VOZ ULTRA RÁPIDO EN TIEMPO REAL
// Escribe al instante cada palabra y espera a que el Adulto Mayor presione "Enviar consulta"
// ============================================================================

let reconocimiento = null;
let mantenerMicrofonoActivo = false;
let textoConsolidadoSesionesPrevias = "";
let textoAcumuladoVoz = "";
let textoParcialActual = "";
let timerSilencioEnvio = null;
let webSpeechFuncionando = false;

// Variables para Motor Cloud IA (Groq whisper-large-v3-turbo / OpenAI whisper-1)
let mediaStreamCloud = null;
let mediaRecorderCloud = null;
let chunksAudioCloud = [];
let mimeTypeCloud = "audio/webm";
let intervaloCloudVivo = null;
let transcribiendoCloud = false;
let audioContextMonitor = null;
let analyserMonitor = null;
let animFrameMonitor = null;
let huboVozCloud = false;

const PROMPT_CONTEXTO_SALUD =
    "Consulta de salud para adulto mayor en Antioquia, Colombia (Ley 1171). " +
    "Me llamo Carlos Restrepo, tengo 68 años, mi cédula es 70123456, vivo en Medellín, Envigado, Bello, Itagüí, Rionegro, EPS SURA, Nueva EPS, Savia Salud. " +
    "Necesito agendar una cita médica prioritaria, medicamentos a domicilio, medicamento pendiente, autorizar exámenes, certificado ADRES.";

function obtenerApiKeyCloud() {
    return (localStorage.getItem("VOZMAYOR_CLOUD_STT_KEY") || "").trim();
}

function actualizarBotonMotorVozUI() {
    const btn = document.getElementById("btnCloudSttConfig");
    if (!btn) return;
    const key = obtenerApiKeyCloud();
    const esOpera = /OPR\/|Opera|Brave/i.test(navigator.userAgent);
    if (key) {
        btn.innerHTML = `<i class="fa-solid fa-cloud-bolt" style="color: #16a34a;"></i><span>Whisper IA Activo</span>`;
    } else if (esOpera) {
        btn.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color: #d97706;"></i><span>Activar API Voz (Opera)</span>`;
    } else {
        btn.innerHTML = `<i class="fa-solid fa-sliders"></i><span>Motor Voz IA</span>`;
    }
}

function configurarApiKeyVoz() {
    const actual = obtenerApiKeyCloud();
    const esOpera = /OPR\/|Opera/i.test(navigator.userAgent);
    const mensaje =
        (esOpera
            ? "NOTA IMPORTANTE: El navegador Opera bloquea el servidor gratuito de voz de Google.\n\n" +
              "Tiene 2 soluciones inmediatas:\n" +
              "1) Abrir esta misma dirección (http://127.0.0.1:5500) en Google Chrome o Microsoft Edge (donde el dictado en vivo funciona gratis sin clave).\n" +
              "2) O pegar aquí una API Key gratuita de Groq Cloud (https://console.groq.com/keys - inicia por 'gsk_...') o de OpenAI ('sk-...') para usar el modelo profesional Whisper Large-v3-Turbo en vivo dentro de Opera:\n\n"
            : "Configure su clave opcional de Groq Cloud (gsk_...) u OpenAI (sk-...) para usar el motor neuronal Whisper Large-v3-Turbo, o déjelo vacío para usar el motor nativo en tiempo real de Chrome/Edge:\n\n") +
        "Ingrese su API Key (gsk_... o sk-...):";

    const nueva = window.prompt(mensaje, actual);
    if (nueva !== null) {
        const limpia = nueva.trim();
        if (limpia) {
            localStorage.setItem("VOZMAYOR_CLOUD_STT_KEY", limpia);
        } else {
            localStorage.removeItem("VOZMAYOR_CLOUD_STT_KEY");
        }
        actualizarBotonMotorVozUI();
    }
}

function corregirTerminosSaludColombia(textoRaw) {
    if (!textoRaw) return "";
    let t = textoRaw.trim();
    const correcciones = [
        [/\bsita\b/gi, "cita"],
        [/\bsitas\b/gi, "citas"],
        [/\bmodontología\b/gi, "odontología"],
        [/\badres\b/gi, "ADRES"],
        [/\benbigado\b/gi, "Envigado"],
        [/\brionegro\b/gi, "Rionegro"],
        [/\bmedellin\b/gi, "Medellín"],
        [/\bluz maria\b/gi, "Luz María"],
        [/\bvoz mayor\b/gi, "VozMayor"]
    ];
    for (const [reg, rep] of correcciones) {
        t = t.replace(reg, rep);
    }
    return t.trim();
}

function limpiarTimerSilencio() {
    if (timerSilencioEnvio) {
        clearTimeout(timerSilencioEnvio);
        timerSilencioEnvio = null;
    }
    if (intervaloCloudVivo) {
        clearInterval(intervaloCloudVivo);
        intervaloCloudVivo = null;
    }
    if (animFrameMonitor) {
        cancelAnimationFrame(animFrameMonitor);
        animFrameMonitor = null;
    }
}

function insertarTextoDictado(frase) {
    const input = document.getElementById("composerVttInput");
    if (input) {
        input.value = frase;
    }
    textoAcumuladoVoz = frase;
    textoParcialActual = "";
    enviarConsultaDesdeBoton();
}

// ============================================================================
// ESTRATEGIA B: TRANSCRIPCIÓN EN VIVO CON API CLOUD (GROQ WHISPER-LARGE-V3-TURBO)
// ============================================================================

async function transcribirBlobEnCloudAPI(blobAudio) {
    const apiKey = obtenerApiKeyCloud();
    if (!apiKey || !blobAudio || blobAudio.size < 1800) return null;

    const esOpenAI = apiKey.startsWith("sk-") && !apiKey.startsWith("gsk_");
    const endpoint = esOpenAI
        ? "https://api.openai.com/v1/audio/transcriptions"
        : "https://api.groq.com/openai/v1/audio/transcriptions";
    const modelo = esOpenAI ? "whisper-1" : "whisper-large-v3-turbo";

    const ext = mimeTypeCloud.includes("mp4") ? "mp4" : mimeTypeCloud.includes("ogg") ? "ogg" : "webm";
    const archivo = new File([blobAudio], `vozmayor.${ext}`, { type: mimeTypeCloud });

    const formData = new FormData();
    formData.append("file", archivo);
    formData.append("model", modelo);
    formData.append("language", "es");
    formData.append("prompt", PROMPT_CONTEXTO_SALUD);
    formData.append("temperature", "0");

    const resp = await fetch(endpoint, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`
        },
        body: formData
    });

    if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
    }
    const data = await resp.json();
    return data && data.text ? corregirTerminosSaludColombia(data.text) : "";
}

async function iniciarCapturaCloudWhisperAPI() {
    try {
        chunksAudioCloud = [];
        huboVozCloud = false;

        mediaStreamCloud = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }
        });

        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        audioContextMonitor = new AudioCtx();
        const source = audioContextMonitor.createMediaStreamSource(mediaStreamCloud);
        analyserMonitor = audioContextMonitor.createAnalyser();
        analyserMonitor.fftSize = 512;
        source.connect(analyserMonitor);

        const dataArray = new Uint8Array(analyserMonitor.frequencyBinCount);
        const monitorearVolumen = () => {
            if (!mantenerMicrofonoActivo) return;
            analyserMonitor.getByteFrequencyData(dataArray);
            let suma = 0;
            for (let i = 0; i < dataArray.length; i++) suma += dataArray[i];
            if (suma / dataArray.length > 12) {
                huboVozCloud = true;
            }
            animFrameMonitor = requestAnimationFrame(monitorearVolumen);
        };
        animFrameMonitor = requestAnimationFrame(monitorearVolumen);

        const tiposPreferidos = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
        for (const t of tiposPreferidos) {
            if (window.MediaRecorder && MediaRecorder.isTypeSupported(t)) {
                mimeTypeCloud = t;
                break;
            }
        }

        mediaRecorderCloud = new MediaRecorder(mediaStreamCloud, { mimeType: mimeTypeCloud });
        mediaRecorderCloud.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) {
                chunksAudioCloud.push(e.data);
            }
        };
        mediaRecorderCloud.start(300);

        intervaloCloudVivo = setInterval(async () => {
            if (!mantenerMicrofonoActivo || transcribiendoCloud || !huboVozCloud || chunksAudioCloud.length < 2) return;
            transcribiendoCloud = true;
            try {
                const blobParcial = new Blob(chunksAudioCloud, { type: mimeTypeCloud });
                const textoVivo = await transcribirBlobEnCloudAPI(blobParcial);
                if (textoVivo && mantenerMicrofonoActivo) {
                    textoAcumuladoVoz = textoVivo;
                    const input = document.getElementById("composerVttInput");
                    const helperTxt = document.getElementById("listeningHelperText");
                    if (input) input.value = textoVivo;
                    if (helperTxt) helperTxt.textContent = `Escribiendo en vivo: «${textoVivo}» (Presione «Enviar consulta» al terminar)`;
                    extraerDatosPacienteDeTexto(textoVivo);
                }
            } catch (err) {
                const helperTxt = document.getElementById("listeningHelperText");
                if (helperTxt) {
                    helperTxt.textContent = "Error en API Key de Voz. Revise el botón 'Motor Voz IA' arriba a la derecha.";
                }
            } finally {
                transcribiendoCloud = false;
            }
        }, 1100);

        return true;
    } catch (e) {
        return false;
    }
}

function detenerCapturaAudioHardware() {
    limpiarTimerSilencio();
    mantenerMicrofonoActivo = false;

    if (reconocimiento) {
        try { reconocimiento.stop(); } catch (e) {}
    }
    if (mediaRecorderCloud && mediaRecorderCloud.state !== "inactive") {
        try { mediaRecorderCloud.stop(); } catch (e) {}
    }
    mediaRecorderCloud = null;

    if (audioContextMonitor) {
        try { audioContextMonitor.close(); } catch (e) {}
        audioContextMonitor = null;
    }
    if (mediaStreamCloud) {
        mediaStreamCloud.getTracks().forEach(t => t.stop());
        mediaStreamCloud = null;
    }
}

// ============================================================================
// ESTRATEGIA A: RECONOCIMIENTO EN TIEMPO REAL INSTANTÁNEO (CHROME / EDGE)
// Sin retrasos, lee toda la frase completa desde el índice 0 y espera al botón "Enviar consulta"
// ============================================================================

function inicializarWebSpeechNativo() {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) return null;

    const rec = new SpeechRec();
    rec.lang = "es-CO";
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onresult = (event) => {
        webSpeechFuncionando = true;
        let finalesSesion = "";
        let parcialesSesion = "";

        // Recorrer desde 0 garantiza que ninguna palabra se pierda ni se corte a mitad de frase
        for (let i = 0; i < event.results.length; i++) {
            const pieza = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                finalesSesion += " " + pieza;
            } else {
                parcialesSesion += " " + pieza;
            }
        }

        textoAcumuladoVoz = (textoConsolidadoSesionesPrevias + " " + finalesSesion).replace(/\s{2,}/g, " ").trim();
        textoParcialActual = parcialesSesion.replace(/\s{2,}/g, " ").trim();

        const textoCompleto = corregirTerminosSaludColombia(
            (textoAcumuladoVoz + " " + textoParcialActual).replace(/\s{2,}/g, " ")
        );

        const input = document.getElementById("composerVttInput");
        const helperTxt = document.getElementById("listeningHelperText");

        if (input && textoCompleto) {
            input.value = textoCompleto;
            input.scrollLeft = input.scrollWidth;
        }
        if (helperTxt && textoCompleto) {
            helperTxt.innerHTML = `Escribiendo en vivo: <strong>«${textoCompleto}»</strong> — <em>Cuando termine, presione el botón azul «Enviar consulta»</em>`;
        }

        // Si el adulto mayor va diciendo sus datos (nombre, edad, cédula, ciudad), ir llenando su ficha en vivo
        if (textoCompleto.length > 6) {
            extraerDatosPacienteDeTexto(textoCompleto);
        }
    };

    rec.onerror = (event) => {
        if (!mantenerMicrofonoActivo) return;

        if (event.error === "network" || event.error === "service-not-allowed") {
            const helperTxt = document.getElementById("listeningHelperText");
            const label = document.getElementById("vttStatusLabel");
            if (label) {
                label.textContent = "Navegador Opera detectado: requiere API Key o abrir en Chrome/Edge";
            }
            if (helperTxt) {
                helperTxt.innerHTML =
                    `<i class="fa-solid fa-triangle-exclamation" style="color:#d97706;"></i> ` +
                    `<strong>Opera bloquea el servidor de voz de Google.</strong> Abra <code>http://127.0.0.1:5500</code> en <strong>Google Chrome</strong> o <strong>Microsoft Edge</strong> (funciona al instante gratis), o haga clic en <a href="javascript:void(0)" onclick="configurarApiKeyVoz()" style="color:var(--accent-blue);text-decoration:underline;font-weight:700;">Activar API Voz (Groq Whisper IA)</a>.`;
            }
        }
    };

    rec.onend = () => {
        // Si el navegador hace una pausa técnica mientras el adulto mayor piensa, conservar lo hablado y seguir escuchando
        if (mantenerMicrofonoActivo && webSpeechFuncionando) {
            textoConsolidadoSesionesPrevias = (textoAcumuladoVoz + " " + textoParcialActual).replace(/\s{2,}/g, " ").trim();
            textoParcialActual = "";
            try { rec.start(); } catch (e) {}
        }
    };

    return rec;
}

async function finalizarYEnviarVozManual() {
    enviarConsultaDesdeBoton();
}

function restaurarEstadoMicrofono() {
    estadoSesion.escuchandoMicrofono = false;
    const btnMic = document.getElementById("btnMicGiant");
    const box = document.getElementById("vttContainerBox");
    const label = document.getElementById("vttStatusLabel");

    if (btnMic) {
        btnMic.classList.remove("recording");
        btnMic.innerHTML = `<i class="fa-solid fa-microphone"></i><span>Dictar por voz</span>`;
    }
    if (box) box.classList.remove("listening");
    if (label) label.textContent = "Voz a texto activo (es-CO)";
}

async function alternarMicrofono() {
    if (mantenerMicrofonoActivo || estadoSesion.escuchandoMicrofono) {
        enviarConsultaDesdeBoton();
        return;
    }

    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    textoConsolidadoSesionesPrevias = "";
    textoAcumuladoVoz = "";
    textoParcialActual = "";
    webSpeechFuncionando = false;

    const input = document.getElementById("composerVttInput");
    if (input) {
        // Si ya había escrito algo y quiere agregar más por voz, conservarlo como base
        textoConsolidadoSesionesPrevias = input.value.trim();
        input.focus();
    }

    mantenerMicrofonoActivo = true;
    estadoSesion.escuchandoMicrofono = true;

    const btnMic = document.getElementById("btnMicGiant");
    const box = document.getElementById("vttContainerBox");
    const label = document.getElementById("vttStatusLabel");
    const helperTxt = document.getElementById("listeningHelperText");

    if (btnMic) {
        btnMic.classList.add("recording");
        btnMic.innerHTML = `<i class="fa-solid fa-microphone-lines"></i><span>Escuchando su voz...</span>`;
    }
    if (box) box.classList.add("listening");

    const apiKeyCloud = obtenerApiKeyCloud();

    if (apiKeyCloud) {
        if (label) label.textContent = "Escuchando en vivo con Whisper Large-v3-Turbo (Cloud IA)...";
        if (helperTxt) {
            helperTxt.textContent = "Micrófono activo: Hable con calma y, cuando termine, presione el botón azul «Enviar consulta»...";
        }
        await iniciarCapturaCloudWhisperAPI();
        return;
    }

    if (label) label.textContent = "Escuchando en vivo... presione «Enviar consulta» cuando termine de hablar";
    if (helperTxt) {
        helperTxt.textContent = "Micrófono activo: Hable con tranquilidad, sus palabras se escriben al instante. Al terminar, presione «Enviar consulta».";
    }

    if (!reconocimiento) {
        reconocimiento = inicializarWebSpeechNativo();
    }
    if (reconocimiento) {
        try {
            reconocimiento.start();
        } catch (e) {
            try {
                reconocimiento.stop();
                setTimeout(() => {
                    if (mantenerMicrofonoActivo) reconocimiento.start();
                }, 80);
            } catch (err) {}
        }
    } else if (helperTxt) {
        helperTxt.textContent = "Este navegador no incluye Web Speech nativo. Use Google Chrome / Microsoft Edge o active una API Key en 'Motor Voz IA'.";
    }
}

// ============================================================================
// MODO CLARO / MODO OSCURO Y CONTROLES DE ACCESIBILIDAD
// ============================================================================

function alternarModoClaroOscuro() {
    document.body.classList.toggle("dark-mode");
    const esOscuro = document.body.classList.contains("dark-mode");
    const icon = document.getElementById("themeToggleIcon");
    const txt = document.getElementById("themeToggleText");

    if (icon) icon.className = esOscuro ? "fa-solid fa-sun" : "fa-solid fa-moon";
    if (txt) txt.textContent = esOscuro ? "Modo Claro" : "Modo Oscuro";
}

function cambiarEscalaLetra(escalaCuerpo, btnId) {
    document.documentElement.style.setProperty("--font-scale", escalaCuerpo);
    document.querySelectorAll(".font-scale-btn").forEach(b => b.classList.remove("active"));
    const btn = document.getElementById(btnId);
    if (btn) btn.classList.add("active");
}

function alternarVelocidadVoz() {
    estadoSesion.hablarLento = !estadoSesion.hablarLento;
    const btn = document.getElementById("btnSlowVoice");
    if (btn) {
        btn.classList.toggle("active", estadoSesion.hablarLento);
    }
    if (estadoSesion.ultimoMensajeTextoPlano) {
        hablarRespuesta(estadoSesion.ultimoMensajeTextoPlano);
    }
}

function repetirUltimaLocucion() {
    if (estadoSesion.ultimoMensajeTextoPlano) {
        hablarRespuesta(estadoSesion.ultimoMensajeTextoPlano);
    }
}

function silenciarLocucion() {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    const statusLbl = document.getElementById("vttStatusLabel");
    if (statusLbl) statusLbl.textContent = "Voz silenciada";
}

function seleccionarMunicipioRapido(municipio) {
    enviarConsulta(`Vivo en ${municipio}, asignar mi sede cercana`, false);
}

function cambiarSedeCiclico() {
    estadoSesion.indiceSede = (estadoSesion.indiceSede + 1) % SEDES_ANTIOQUIA.length;
    const nueva = SEDES_ANTIOQUIA[estadoSesion.indiceSede];
    seleccionarMunicipioRapido(nueva.ciudadBase);
}

function copiarComprobante() {
    const texto = `VozMayor AI • Paciente: ${estadoSesion.documento} • Radicado EPS: ${estadoSesion.ultimoRadicado} • Sede: ${estadoSesion.sedePreferida}`;
    if (navigator.clipboard) {
        navigator.clipboard.writeText(texto);
    }
    const statusLbl = document.getElementById("vttStatusLabel");
    if (statusLbl) statusLbl.textContent = `Ficha ${estadoSesion.ultimoRadicado} copiada al portapapeles`;
}

function reiniciarConversacion() {
    if (mantenerMicrofonoActivo) {
        detenerCapturaAudioHardware();
        restaurarEstadoMicrofono();
    }
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    const threadInner = document.getElementById("aiThreadInner");
    if (threadInner) threadInner.innerHTML = "";
    const input = document.getElementById("composerVttInput");
    if (input) input.value = "";
    cargarVistaInicial(false);
}

function cargarVistaInicial(hablar = false) {
    const threadInner = document.getElementById("aiThreadInner");
    if (!threadInner) return;

    const res = procesarConsultaVozMayor("__SALUDO_INICIAL__");
    estadoSesion.ultimoMensajeTextoPlano = limpiarTextoParaLocucion(res.html);

    const turnDiv = document.createElement("div");
    turnDiv.className = "conversation-turn";
    const thoughtsHtml = res.thoughts.map(t => `<div class="thought-step">${t}</div>`).join("");

    turnDiv.innerHTML = `
        <div class="ai-thoughts-block">
            <button class="thoughts-toggle-btn" onclick="const tl = this.nextElementSibling; tl.style.display = tl.style.display === 'none' ? 'flex' : 'none';">
                <span>Proceso de verificación IA</span>
                <i class="fa-solid fa-caret-down"></i>
            </button>
            <div class="thoughts-timeline">
                ${thoughtsHtml}
            </div>
        </div>

        <article class="ai-narrative-response ai-response-card-box">
            ${res.html}
        </article>

        ${construirHtmlSugerencias(res.tituloSugerencias, res.sugerencias)}

        ${construirHtmlTabla(res.filasTabla)}
    `;

    threadInner.appendChild(turnDiv);

    if (hablar) hablarRespuesta(res.html);
}

window.addEventListener("DOMContentLoaded", () => {
    if ("speechSynthesis" in window) {
        window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
    }
    actualizarBotonMotorVozUI();
    cargarConsultasRecientesDeStorage();
    cargarVistaInicial(false);

    const input = document.getElementById("composerVttInput");
    if (input) {
        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                enviarConsultaDesdeBoton();
            }
        });
    }
});
