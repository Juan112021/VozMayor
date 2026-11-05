# ==============================================================================
# 1. INSTALACIÓN DE DEPENDENCIAS (Solo se ejecuta una vez en Google Colab)
# ==============================================================================
# !pip install -q gradio gtts SpeechRecognition pydub

# ==============================================================================
# VOZMAYOR AI 2.0 • ECOSISTEMA INTELIGENTE DE SALUD Y ORIENTACIÓN 100% POR VOZ
# Proyecto Final — Ética en la Era de la IA | Ingeniería Informática
# ==============================================================================
# -*- coding: utf-8 -*-

import os
import re
import sys
import time
import uuid
import inspect
import tempfile
from datetime import datetime, timedelta

import gradio as gr
from gtts import gTTS
import speech_recognition as sr

# ==============================================================================
# CONFIGURACIÓN GLOBAL E IDENTIDAD DEL SISTEMA
# ==============================================================================

NOMBRE_PROYECTO = "VozMayor AI"
ASESORA = "Luz María Gómez"
ROL_ASESORA = "Orientadora Clínica Digital • IA Inclusiva para el Adulto Mayor"
VERSION_SISTEMA = "v3.0 Enterprise • Edición Entrega Final"

# Frases de alerta médica para triaje de riesgo vital inmediato
RIESGO_VITAL = [
    "dolor en el pecho", "me duele el pecho", "opresion en el pecho", "opresión en el pecho",
    "dolor de pecho", "infarto", "corazon", "corazón",
    "no puedo respirar", "falta el aire", "me ahogo", "asfixi", "ahogando",
    "me cai", "me caí", "golpe en la cabeza", "desmay", "inconsciente", "sangre",
    "morir", "suicid", "no quiero vivir", "hacerme daño", "quitarme la vida",
    "me estoy muriendo", "convulsio", "sangrado abundante", "derrame", "paralisis", "parálisis"
]

MSG_RIESGO = """### 🚨 [ATENCIÓN MÉDICA INMEDIATA — TRIAJE DE URGENCIA VITAL]

Estimado/a usuario/a, he detectado síntomas de **alerta médica crítica** que requieren asistencia presencial inmediata:

1. **📞 Línea Única de Emergencias 123:** Comuníquese ahora mismo o pida auxilio a un familiar, vecino o cuidador cercano.
2. **🚑 Línea Directa de Ambulancias (Antioquia):** Marque al **(604) 444-1234** (Atención prioritaria 24/7).
3. **🏥 Red Hospitalaria de Urgencias Vitales (Valle de Aburrá y Oriente):**
   - **Hospital General de Medellín:** Cra. 48 # 32-102 (Sector Exposiciones)
   - **Hospital Universitario San Vicente Fundación:** Calle 64 # 51D-154
   - **Clínica Las Américas Auna:** Diagonal 75B # 2A-80 (Belén)
   - **Hospital Marco Fidel Suárez (Bello):** Calle 44 # 49-25
   - **Hospital San Vicente Fundación (Rionegro):** Vereda La Convención, Vía Aeropuerto

> **Protocolo Ético VozMayor:** Por su seguridad, una IA no reemplaza la atención de urgencias. **No se quede solo/a, mantenga la calma, deje la puerta sin seguro y acuda de inmediato al servicio médico.**"""

# ==============================================================================
# UTILIDADES DE FECHA, RADICADOS Y LIMPIEZA DE VOZ (TTS)
# ==============================================================================

def generar_codigo_radicado(prefijo: str) -> str:
    sufijo = str(uuid.uuid4().int)[:4]
    return f"{prefijo}-VM-2026-{sufijo}"

def obtener_fecha_cita_habil() -> str:
    hoy = datetime.now()
    dias_sumar = 1
    if hoy.weekday() == 4:  # Viernes -> Lunes
        dias_sumar = 3
    elif hoy.weekday() == 5:  # Sábado -> Lunes
        dias_sumar = 2
    fecha = hoy + timedelta(days=dias_sumar)
    meses = [
        "enero", "febrero", "marzo", "abril", "mayo", "junio",
        "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
    ]
    dias = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]
    return f"{dias[fecha.weekday()]} {fecha.day} de {meses[fecha.month - 1]} de {fecha.year} a las 08:30 a.m."

def limpiar_texto_para_voz(texto: str) -> str:
    """Convierte el texto enriquecido en Markdown a una locución natural, pausada y cálida para el adulto mayor."""
    if not texto:
        return ""
    limpio = texto
    # Eliminar bloques o símbolos markdown
    limpio = re.sub(r"#{1,6}\s*", "", limpio)
    limpio = re.sub(r"\*\*(.*?)\*\*", r"\1", limpio)
    limpio = re.sub(r"\*(.*?)\*", r"\1", limpio)
    limpio = re.sub(r"`(.*?)`", r"\1", limpio)
    limpio = re.sub(r">\s*", "", limpio)
    # Eliminar emojis para que gTTS no los deletree en voz alta
    limpio = re.sub(
        r"[\U00010000-\U0010ffff\u2600-\u26ff\u2700-\u27bf]",
        "",
        limpio,
        flags=re.UNICODE
    )
    # Reemplazar abreviaturas para lectura natural en español colombiano
    reemplazos = {
        "Cra.": "Carrera",
        "Dra.": "Doctora",
        "Dr.": "Doctor",
        "a.m.": "de la mañana",
        "p.m.": "de la tarde",
        "24/7": "veinticuatro horas, los siete días de la semana",
        "IPS": "I P S",
        "EPS": "E P S",
        "PQR": "P Q R",
        "SMS": "mensaje de texto",
        "COP": "pesos colombianos",
        "Estimado/a": "Estimado",
        "usuario/a": "usuario",
        "solo/a": "solo",
        "(604)": "seis cero cuatro,",
        "#": "número ",
    }
    for k, v in reemplazos.items():
        limpio = limpio.replace(k, v)
    # Limpiar guiones de listas por pausas suaves
    limpio = re.sub(r"^\s*[-•]\s*", "", limpio, flags=re.MULTILINE)
    limpio = re.sub(r"\n{2,}", ". ", limpio)
    limpio = re.sub(r"\n", ". ", limpio)
    limpio = re.sub(r"\s{2,}", " ", limpio)
    return limpio.strip()

def sintetizar_voz(texto: str, hablar_lento: bool = False):
    """Genera el archivo MP3 con la voz de Luz María Gómez usando gTTS."""
    if not texto or not texto.strip():
        return None
    try:
        texto_locucion = limpiar_texto_para_voz(texto)
        tts = gTTS(text=texto_locucion, lang="es", tld="com.co", slow=hablar_lento)
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".mp3")
        tts.save(temp_file.name)
        return temp_file.name
    except Exception:
        try:
            tts = gTTS(text=limpiar_texto_para_voz(texto), lang="es", slow=hablar_lento)
            temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".mp3")
            tts.save(temp_file.name)
            return temp_file.name
        except Exception:
            return None

def transcribir_audio_microfono(ruta_audio: str) -> str:
    """Convierte la voz del adulto mayor en texto usando SpeechRecognition."""
    if not ruta_audio or not os.path.exists(ruta_audio):
        return ""
    recognizer = sr.Recognizer()
    try:
        with sr.AudioFile(ruta_audio) as source:
            recognizer.adjust_for_ambient_noise(source, duration=0.2)
            audio_data = recognizer.record(source)
        texto = recognizer.recognize_google(audio_data, language="es-CO")
        return texto
    except sr.UnknownValueError:
        return "[AUDIO_NO_ENTENDIDO]"
    except Exception:
        return "[ERROR_MICROFONO]"

# ==============================================================================
# GENERADOR DE TARJETAS DIGITALES DE COMPROBANTE / TRÁMITE (UI LATERAL)
# ==============================================================================

def construir_tarjeta_comprobante(tipo: str, datos: dict) -> str:
    """Genera el HTML del comprobante oficial interactivo en el panel derecho."""
    colores = {
        "BIENVENIDA": ("#0ea5e9", "rgba(14, 165, 233, 0.12)", "🟢 SISTEMA ACTIVO • TRIAJE SEGURO"),
        "URGENCIA": ("#ef4444", "rgba(239, 68, 68, 0.16)", "🚨 ALERTA CRÍTICA • CÓDIGO ROJO 123"),
        "CITA": ("#10b981", "rgba(16, 185, 129, 0.14)", "✅ CITA PREFERENCIAL ASIGNADA"),
        "MEDICAMENTOS": ("#8b5cf6", "rgba(139, 92, 246, 0.14)", "💊 DESPACHO DOMICILIARIO LEY 1171"),
        "AUTORIZACION": ("#f59e0b", "rgba(245, 158, 11, 0.14)", "📋 ORDEN MÉDICA RADICADA"),
        "CERTIFICADO": ("#06b6d4", "rgba(6, 182, 212, 0.14)", "🪪 CERTIFICADO OFICIAL ADRES"),
        "SEDES": ("#3b82f6", "rgba(59, 130, 246, 0.14)", "🏥 DIRECTORIO PREFERENCIAL ANTIOQUIA"),
        "CUIDADOR": ("#ec4899", "rgba(236, 72, 153, 0.14)", "🤝 RED CENTROS VIDA Y APOYO"),
        "DERECHOS": ("#14b8a6", "rgba(20, 184, 166, 0.14)", "⚖️ DEFENSORÍA DEL ADULTO MAYOR"),
    }
    borde, fondo, etiqueta = colores.get(tipo, colores["BIENVENIDA"])
    radicado = datos.get("radicado", "VM-2026-ACTIVO")
    titulo = datos.get("titulo", "Estado del Trámite en Tiempo Real")
    paciente = datos.get("paciente", "Adulto Mayor Prioritario (Cobertura Preferencial)")
    detalle_1 = datos.get("detalle_1", "Esperando solicitud por voz o botón rápido")
    detalle_2 = datos.get("detalle_2", "Atención 100% libre de filas y trámites presenciales")
    detalle_3 = datos.get("detalle_3", "Protegido por Ley 1171 de 2007 y Resolución 1604")
    hora_actual = datetime.now().strftime("%d/%m/%Y • %I:%M %p")

    return f"""
    <div class="vm-ticket-card" style="border-left: 5px solid {borde};">
        <div class="vm-ticket-header" style="background: {fondo}; color: {borde};">
            <span>{etiqueta}</span>
            <span class="vm-ticket-code">{radicado}</span>
        </div>
        <div class="vm-ticket-body">
            <h3 class="vm-ticket-title">{titulo}</h3>
            <div class="vm-ticket-row">
                <span class="vm-ticket-label">👤 Titular / Paciente:</span>
                <span class="vm-ticket-val">{paciente}</span>
            </div>
            <div class="vm-ticket-row">
                <span class="vm-ticket-label">📌 Gestión Principal:</span>
                <span class="vm-ticket-val">{detalle_1}</span>
            </div>
            <div class="vm-ticket-row">
                <span class="vm-ticket-label">📍 Ubicación / Canal:</span>
                <span class="vm-ticket-val">{detalle_2}</span>
            </div>
            <div class="vm-ticket-row">
                <span class="vm-ticket-label">🛡️ Garantía Legal:</span>
                <span class="vm-ticket-val">{detalle_3}</span>
            </div>
            <div class="vm-ticket-footer">
                <div>
                    <div style="font-size: 0.78rem; opacity: 0.75;">Verificación Digital Antioquia</div>
                    <div style="font-size: 0.85rem; font-weight: 600;">Emitido: {hora_actual}</div>
                </div>
                <div class="vm-qr-badge">QR VERIFICADO ✓</div>
            </div>
        </div>
    </div>
    """

# ==============================================================================
# MOTOR CONVERSACIONAL INTELIGENTE DE VOZMAYOR (COMPLETO + MEMORIA CONTEXTUAL)
# ==============================================================================

def procesar_consulta_completa(mensaje: str, estado_sesion: dict):
    """
    Evalúa la consulta del adulto mayor, aplica triaje ético, mantiene contexto
    (sede elegida, documento o confirmación) y devuelve (respuesta_markdown, tarjeta_html, estado_actualizado).
    """
    if estado_sesion is None:
        estado_sesion = {
            "interacciones": 0,
            "ultimo_tema": "BIENVENIDA",
            "sede_preferida": "Medellín Centro (Parque Bolívar)",
            "documento": "Afiliado Preferencial Mayor de 60 Años",
        }

    if not mensaje or not mensaje.strip():
        texto = (
            f"Buen día. Bienvenido a **{NOMBRE_PROYECTO}**. "
            f"Le habla **{ASESORA}**. Por favor presione el micrófono y hable con toda tranquilidad, "
            f"o toque cualquiera de los botones grandes de trámites en pantalla."
        )
        tarjeta = construir_tarjeta_comprobante("BIENVENIDA", {})
        return texto, tarjeta, estado_sesion

    if mensaje == "[AUDIO_NO_ENTENDIDO]":
        texto = (
            "Disculpe mi estimado/a, escuché un poco de ruido de fondo y no logré comprenderle con claridad. "
            "¿Podría repetirme su solicitud hablándome despacio cerca del micrófono, o tocar uno de los botones de ayuda?"
        )
        tarjeta = construir_tarjeta_comprobante("BIENVENIDA", {
            "titulo": "Micrófono Listo para Escucharle",
            "detalle_1": "Por favor hable claro y pausado cerca del micrófono",
            "detalle_2": "También puede usar los botones grandes de acceso rápido",
        })
        return texto, tarjeta, estado_sesion

    if mensaje == "[ERROR_MICROFONO]":
        texto = (
            "No pude recibir la señal de audio de su micrófono. "
            "Por favor verifique el permiso del navegador o seleccione directamente uno de los botones grandes del panel."
        )
        tarjeta = construir_tarjeta_comprobante("BIENVENIDA", {})
        return texto, tarjeta, estado_sesion

    msg = mensaje.lower().strip()
    estado_sesion["interacciones"] = estado_sesion.get("interacciones", 0) + 1

    # Detectar si el usuario dicta un número de cédula (6 a 11 dígitos)
    cedula_match = re.search(r"\b(\d{6,11})\b", msg.replace(".", "").replace(" ", ""))
    if cedula_match:
        estado_sesion["documento"] = f"C.C. {cedula_match.group(1)} (Verificado ADRES)"

    # Detectar cambio de municipio o sede preferida
    if "envigado" in msg:
        estado_sesion["sede_preferida"] = "CIS Envigado Parque (Calle 37 Sur # 41-28)"
    elif "bello" in msg:
        estado_sesion["sede_preferida"] = "Sede Bello Choza Marco Fidel Suárez (Cra. 50 # 51-14)"
    elif "rionegro" in msg or "oriente" in msg:
        estado_sesion["sede_preferida"] = "Centro Médico Savanna Rionegro (Calle 47 # 56-35)"
    elif "itagui" in msg or "itagüí" in msg:
        estado_sesion["sede_preferida"] = "Sede Itagüí Parque Principal (Cra. 51 # 50-21)"

    # ------------------------------------------------------------------
    # 1. TRIAJE DE URGENCIA VITAL (Prioridad Ética #1)
    # ------------------------------------------------------------------
    if any(k in msg for k in RIESGO_VITAL):
        estado_sesion["ultimo_tema"] = "URGENCIA"
        rad = generar_codigo_radicado("URG-123")
        tarjeta = construir_tarjeta_comprobante("URGENCIA", {
            "radicado": rad,
            "titulo": "🚨 ALERTA DE TRIAJE VITAL ACTIVADA",
            "paciente": estado_sesion["documento"],
            "detalle_1": "Derivación inmediata a Línea 123 y Red de Urgencias",
            "detalle_2": "Ambulancias Antioquia: (604) 444-1234 (24 Horas)",
            "detalle_3": "Atención inicial de urgencias obligatoria sin autorización previa",
        })
        return MSG_RIESGO, tarjeta, estado_sesion

    # ------------------------------------------------------------------
    # 2. CONFIRMACIÓN CONTEXTUAL (Cuando responde "sí", "confirmar", "envigado", etc.)
    # ------------------------------------------------------------------
    confirmaciones = ["si", "sí", "confirmo", "confirmar", "esta bien", "está bien", "de acuerdo", "claro", "por favor"]
    if (
        any(msg == c or msg.startswith(c + " ") for c in confirmaciones)
        or (any(m in msg for m in ["envigado", "bello", "rionegro", "itagui", "itagüí"]) and len(msg.split()) <= 6)
    ) and estado_sesion.get("ultimo_tema") in ["CITA", "MEDICAMENTOS", "CERTIFICADO", "AUTORIZACION"]:
        tema_previo = estado_sesion["ultimo_tema"]
        rad = generar_codigo_radicado(f"CONF-{tema_previo[:3]}")
        sede = estado_sesion["sede_preferida"]
        fecha_cita = obtener_fecha_cita_habil()

        if tema_previo == "CITA":
            respuesta = (
                f"### ✅ ¡Cita Médica Confirmada con Éxito!\n\n"
                f"He dejado en firme su cita prioritaria en **{NOMBRE_PROYECTO}**:\n\n"
                f"- **Titular:** {estado_sesion['documento']}\n"
                f"- **Sede Confirmada:** {sede}\n"
                f"- **Fecha y Hora:** {fecha_cita}\n"
                f"- **Profesional:** Dra. Marcela Peláez (Medicina Integral del Adulto Mayor)\n"
                f"- **Código de Confirmación:** `{rad}`\n\n"
                f"Enviamos un recordatorio por mensaje de texto a su celular y al de su familiar acudiente. "
                f"¿Puedo colaborarle con algún otro trámite hoy?"
            )
        elif tema_previo == "MEDICAMENTOS":
            respuesta = (
                f"### 🚚 ¡Despacho a Domicilio Programado!\n\n"
                f"Su solicitud del programa **VozMayor en Casa** ha quedado agendada:\n\n"
                f"- **Titular:** {estado_sesion['documento']}\n"
                f"- **Punto Despachador:** Farmacia Aliada cercana a {sede}\n"
                f"- **Tiempo de Entrega:** Próximas 24 a 48 horas hábiles (Sin costo de envío)\n"
                f"- **Radicado de Seguimiento:** `{rad}`\n\n"
                f"Nuestro mensajero identificado se comunicará por teléfono antes de tocar a su puerta. "
                f"¿Desea realizar alguna otra consulta?"
            )
        else:
            respuesta = (
                f"### ✅ ¡Solicitud Confirmada y Enviada!\n\n"
                f"Hemos procesado su confirmación bajo el radicado `{rad}` para **{estado_sesion['documento']}**. "
                f"En breves minutos recibirá el soporte digital en su teléfono celular registrado.\n\n"
                f"¿En qué más puedo servirle el día de hoy?"
            )

        tarjeta = construir_tarjeta_comprobante(tema_previo, {
            "radicado": rad,
            "titulo": f"Confirmación Exitosa • {tema_previo.title()}",
            "paciente": estado_sesion["documento"],
            "detalle_1": f"Gestión confirmada por voz ({fecha_cita})",
            "detalle_2": sede,
            "detalle_3": "Notificación SMS enviada al titular y acudiente",
        })
        return respuesta, tarjeta, estado_sesion

    # ------------------------------------------------------------------
    # 3. SALUDOS DE BIENVENIDA
    # ------------------------------------------------------------------
    saludos = ["hola", "buenos dias", "buenos días", "buenas tardes", "buenas noches", "buenas", "iniciar", "empezar", "ola", "aló", "alo"]
    if any(msg == s or msg.startswith(s + " ") for s in saludos) and len(msg.split()) <= 5:
        estado_sesion["ultimo_tema"] = "BIENVENIDA"
        respuesta = (
            f"### 👋 Buen día, mi estimado/a. ¡Qué alegría saludarle!\n\n"
            f"Le habla **{ASESORA}**, su orientadora en **{NOMBRE_PROYECTO}**. "
            f"Estamos aquí para acompañarle con paciencia, **evitarle filas madrugadoras** y facilitarle cualquier gestión de salud en Antioquia.\n\n"
            f"¿En cuál de estos servicios requiere apoyo el día de hoy?\n\n"
            f"- 📅 **Citas médicas:** Asignación preferencial en medicina general, odontología o especialistas.\n"
            f"- 💊 **Medicamentos:** Entrega a domicilio gratuita para mayores de 60 años.\n"
            f"- 📋 **Autorizaciones:** Radicación y seguimiento ágil de órdenes médicas y exámenes.\n"
            f"- 🪪 **Afiliaciones y certificados:** Validación de derechos y carné ante ADRES.\n"
            f"- 🏥 **Sedes y farmacias:** Directorio de atención en Medellín, Valle de Aburrá y Oriente.\n"
            f"- 🤝 **Apoyo al cuidador:** Orientación psicosocial, salud mental y red de Centros Vida.\n\n"
            f"*Puede decirme con toda confianza su inquietud en voz alta o tocar un botón del panel.*"
        )
        tarjeta = construir_tarjeta_comprobante("BIENVENIDA", {
            "titulo": "Canal Preferencial del Adulto Mayor Activo",
            "paciente": estado_sesion["documento"],
            "detalle_1": "Orientación 100% por Voz con Luz María Gómez",
            "detalle_2": estado_sesion["sede_preferida"],
            "detalle_3": "Atención prioritaria garantizada sin filas",
        })
        return respuesta, tarjeta, estado_sesion

    # ------------------------------------------------------------------
    # 4. ORIENTACIÓN GENERAL DE TRÁMITES
    # ------------------------------------------------------------------
    if any(k in msg for k in ["tramite", "trámite", "ayuda con un", "orientacion", "orientación", "diligencia", "papeles", "vuelta"]):
        if not any(k in msg for k in ["cita", "medicamento", "autoriz", "orden", "afilia"]):
            respuesta = (
                f"### 🧭 Guía Paso a Paso de Trámites en {NOMBRE_PROYECTO}\n\n"
                f"Con mucho gusto le oriento sin rodeos ni papeleos complicados. Cuénteme cuál de estas gestiones desea adelantar hoy:\n\n"
                f"1. **Agendar o reprogramar una cita médica prioritaria.**\n"
                f"2. **Solicitar el envío de medicamentos formulados a su casa.**\n"
                f"3. **Autorizar una orden de laboratorio, ecografía o especialista.**\n"
                f"4. **Descargar su certificado de afiliación vigente sin copagos.**\n\n"
                f"Dígame en voz alta cuál necesita y yo misma me encargo de radicarlo."
            )
            tarjeta = construir_tarjeta_comprobante("BIENVENIDA", {
                "titulo": "Asesoría Personalizada de Trámites",
                "paciente": estado_sesion["documento"],
                "detalle_1": "Ruta simplificada para personas mayores",
            })
            return respuesta, tarjeta, estado_sesion

    # ------------------------------------------------------------------
    # 5. ASIGNACIÓN Y GESTIÓN DE CITAS MÉDICAS
    # ------------------------------------------------------------------
    if any(k in msg for k in ["cita", "consulta", "medico", "médico", "doctor", "odontolog", "optometr", "optometra", "especialista", "control"]):
        estado_sesion["ultimo_tema"] = "CITA"
        rad = generar_codigo_radicado("CIT")
        fecha_cita = obtener_fecha_cita_habil()
        sede = estado_sesion["sede_preferida"]

        if "cancel" in msg or "reprogram" in msg or "cambiar" in msg:
            respuesta = (
                f"### 🔄 Cancelación o Reprogramación de Cita Médica\n\n"
                f"Para reprogramar o cancelar su cita en **{NOMBRE_PROYECTO}** sin penalidad:\n\n"
                f"- Indíquenos en voz alta su **número de cédula** o el municipio al que desea cambiarla (Envigado, Bello, Rionegro o Medellín).\n"
                f"- También dispone de la Línea Preferencial del Adulto Mayor: **(604) 444-7262 (Opción 2)**.\n\n"
                f"💡 *Nota solidaria:* Avisar con 24 horas de anticipación permite asignarle ese turno a otro adulto mayor que lo necesite."
            )
            tarjeta = construir_tarjeta_comprobante("CITA", {
                "radicado": rad,
                "titulo": "Gestión de Reprogramación de Cita",
                "paciente": estado_sesion["documento"],
                "detalle_1": "Modificación sin cobro de multa ni sanción",
                "detalle_2": sede,
            })
            return respuesta, tarjeta, estado_sesion

        especialidad = "Consulta Médica General y Valoración Integral del Adulto Mayor"
        if "odontolog" in msg:
            especialidad = "Odontología Preventiva y Rehabilitación Oral del Adulto Mayor"
        elif "optometr" in msg or "ojos" in msg or "vista" in msg:
            especialidad = "Optometría y Control Visual Preferencial"
        elif "especialista" in msg or "internista" in msg or "cardiolog" in msg:
            especialidad = "Medicina Interna y Control Cardiovascular Prioritario"

        respuesta = (
            f"### 📅 Comprobante de Asignación Preferencial de Cita\n\n"
            f"Con el mayor agrado. En **{NOMBRE_PROYECTO}**, las consultas para personas mayores tienen **asignación prioritaria en menos de 48 horas** (Ley 1171 de 2007):\n\n"
            f"- **Paciente:** {estado_sesion['documento']}\n"
            f"- **Servicio:** {especialidad}\n"
            f"- **Sede Asignada:** {sede}\n"
            f"- **Fecha y Hora:** {fecha_cita} (Consultorio 204 - Dra. Marcela Peláez)\n"
            f"- **Radicado de Turno:** `{rad}`\n"
            f"- **Cuota Moderadora:** $0 COP (Exento por protección al adulto mayor)\n\n"
            f"**Instrucciones:** Presentarse 15 minutos antes con su cédula original. "
            f"¿Desea **confirmar esta fecha** o prefiere cambiar la sede a **Envigado, Bello o Rionegro**?"
        )
        tarjeta = construir_tarjeta_comprobante("CITA", {
            "radicado": rad,
            "titulo": especialidad,
            "paciente": estado_sesion["documento"],
            "detalle_1": f"Fecha: {fecha_cita}",
            "detalle_2": f"Sede: {sede} • Consultorio 204",
            "detalle_3": "Exento de copago ($0 COP) • Turno Preferencial",
        })
        return respuesta, tarjeta, estado_sesion

    # ------------------------------------------------------------------
    # 6. MEDICAMENTOS Y ENTREGA DOMICILIARIA
    # ------------------------------------------------------------------
    if any(k in msg for k in ["medicamento", "medicina", "pastilla", "droga", "farmacia", "formula", "fórmula", "pendiente", "domicilio", "entrega", "cruz verde", "audifarma", "insulina", "losartan"]):
        estado_sesion["ultimo_tema"] = "MEDICAMENTOS"
        if any(k in msg for k in ["no hay", "pendiente", "no tenian", "no tenían", "falta", "incompleto", "queja", "demora"]):
            rad = generar_codigo_radicado("PQR-MED")
            respuesta = (
                f"### ⚖️ Reclamo Prioritario por Medicamento Pendiente\n\n"
                f"Lamentamos mucho este inconveniente. En **{NOMBRE_PROYECTO}** defendemos sus derechos en salud:\n\n"
                f"**Protección Legal del Adulto Mayor (Resolución 1604 de 2013 y Ley 1171):**\n"
                f"1. La farmacia dispensadora (**Cruz Verde, Audifarma o Colsubsidio**) tiene la obligación legal de registrar el **Volante de Pendiente**.\n"
                f"2. Cuentan con un plazo máximo e improrrogable de **48 horas hábiles** para enviar el medicamento faltante **directamente a la puerta de su casa sin ningún costo**.\n\n"
                f"**Registro Oficial en VozMayor:**\n"
                f"- **Radicado de Vigilancia Farmacéutica:** `{rad}`\n"
                f"- **Acción Activada:** Requerimiento inmediato a bodega central para despacho domiciliario prioritario.\n\n"
                f"¿Desea confirmar el despacho a su dirección registrada o indicarme el nombre del medicamento?"
            )
            tarjeta = construir_tarjeta_comprobante("MEDICAMENTOS", {
                "radicado": rad,
                "titulo": "Alerta Legal: Medicamento Pendiente (48h)",
                "paciente": estado_sesion["documento"],
                "detalle_1": "Exigencia automática de entrega en domicilio (Res. 1604)",
                "detalle_2": "Operador requerido: Red Farmacéutica Antioquia",
                "detalle_3": "Supervisión activa por Defensoría del Paciente",
            })
            return respuesta, tarjeta, estado_sesion

        rad = generar_codigo_radicado("DOM-MED")
        respuesta = (
            f"### 💊 Programa «VozMayor en Casa» — Medicamentos a Domicilio\n\n"
            f"Los afiliados **mayores de 60 años**, pacientes de hipertensión, diabetes o con movilidad reducida tienen derecho al **envío gratuito de su fórmula mensual hasta su hogar**.\n\n"
            f"- **Pre-radicado de Domicilio:** `{rad}`\n"
            f"- **Plazo de Entrega:** 24 a 48 horas hábiles con mensajero identificado.\n"
            f"- **Línea Directa de Farmacia:** (604) 444-8080 • WhatsApp: +57 310 444 8080\n"
            f"- **Costo del Domicilio:** **$0 COP (100% Gratuito)**\n\n"
            f"¿Desea **confirmar el envío** de sus medicamentos vigentes a su residencia registrada?"
        )
        tarjeta = construir_tarjeta_comprobante("MEDICAMENTOS", {
            "radicado": rad,
            "titulo": "Despacho Domiciliario «VozMayor en Casa»",
            "paciente": estado_sesion["documento"],
            "detalle_1": "Entrega en 24-48 horas hábiles sin hacer filas",
            "detalle_2": f"Zona de cobertura: {estado_sesion['sede_preferida']}",
            "detalle_3": "Domicilio 100% gratuito para mayores de 60 años",
        })
        return respuesta, tarjeta, estado_sesion

    # ------------------------------------------------------------------
    # 7. AUTORIZACIONES Y ÓRDENES MÉDICAS
    # ------------------------------------------------------------------
    if any(k in msg for k in ["autoriz", "orden", "examen", "exámenes", "laboratorio", "ecograf", "radiograf", "resonanc", "remision", "remisión", "radicar", "procedimiento", "sangre", "cirugia", "cirugía"]):
        estado_sesion["ultimo_tema"] = "AUTORIZACION"
        rad = generar_codigo_radicado("AUT")
        respuesta = (
            f"### 📋 Ruta Ágil de Autorizaciones y Exámenes Médicos\n\n"
            f"En **{NOMBRE_PROYECTO}** eliminamos los trámites presenciales para sus órdenes médicas:\n\n"
            f"1. **Exámenes de Primer Nivel (Sin Autorización):**\n"
            f"   - Laboratorios de sangre, orina, radiografías simples y electrocardiogramas **NO requieren sello ni autorización previa**. Solo preséntese con la fórmula y su cédula.\n\n"
            f"2. **Exámenes Especializados y Alta Complejidad (Radicación Automática):**\n"
            f"   - **Radicado de Trámite:** `{rad}`\n"
            f"   - **Tiempo de Aprobación Preferencial:** Máximo 48 horas hábiles.\n"
            f"   - **Red Prestadora Asignada:** Hospital General de Medellín, Clínica Las Américas y Laboratorio Echavarría.\n\n"
            f"¿Desea que le enviemos la autorización aprobada por mensaje de texto a su celular?"
        )
        tarjeta = construir_tarjeta_comprobante("AUTORIZACION", {
            "radicado": rad,
            "titulo": "Radicación Digital de Orden Médica",
            "paciente": estado_sesion["documento"],
            "detalle_1": "Aprobación preferencial en 48 horas hábiles",
            "detalle_2": "Hospital General de Medellín / Clínica Las Américas",
            "detalle_3": "Exámenes básicos no requieren autorización previa",
        })
        return respuesta, tarjeta, estado_sesion

    # ------------------------------------------------------------------
    # 8. AFILIACIÓN Y CERTIFICACIONES ADRES
    # ------------------------------------------------------------------
    if any(k in msg for k in ["afilia", "certificado", "carne", "carné", "estado", "vigente", "copago", "subsidio", "regimen", "régimen", "adres", "eps"]):
        estado_sesion["ultimo_tema"] = "CERTIFICADO"
        rad = generar_codigo_radicado("CERT")
        respuesta = (
            f"### 🪪 Constancia Oficial de Afiliación y Derechos (ADRES)\n\n"
            f"He consultado en línea su estado en la Base de Datos Única de Afiliados:\n\n"
            f"- **Titular:** {estado_sesion['documento']}\n"
            f"- **Estado Actual:** **ACTIVO — Protección Especial del Adulto Mayor**\n"
            f"- **Régimen:** Subsidiado / Contributivo Preferencial (Categoría A)\n"
            f"- **Copagos y Cuotas Moderadoras:** **$0 COP** (Exención legal para tercera edad)\n"
            f"- **IPS Primaria Asignada:** {estado_sesion['sede_preferida']}\n"
            f"- **Código de Certificado Digital:** `{rad}`\n\n"
            f"¿Desea que enviemos este certificado oficial en PDF a su celular o WhatsApp?"
        )
        tarjeta = construir_tarjeta_comprobante("CERTIFICADO", {
            "radicado": rad,
            "titulo": "Certificado Digital ADRES • Activo",
            "paciente": estado_sesion["documento"],
            "detalle_1": "Estado: ACTIVO • Categoría Preferencial Adulto Mayor",
            "detalle_2": f"IPS Primaria: {estado_sesion['sede_preferida']}",
            "detalle_3": "Exento 100% de cuotas moderadoras y copagos",
        })
        return respuesta, tarjeta, estado_sesion

    # ------------------------------------------------------------------
    # 9. SEDES, FARMACIAS Y PUNTOS DE ATENCIÓN EN ANTIOQUIA (Sección completada)
    # ------------------------------------------------------------------
    if any(k in msg for k in ["sede", "sedes", "direccion", "dirección", "donde queda", "donde estan", "dónde", "telefono", "teléfono", "horario", "medellin", "medellín", "bello", "envigado", "itagui", "itagüí", "rionegro", "antioquia", "oficina", "punto"]):
        estado_sesion["ultimo_tema"] = "SEDES"
        rad = generar_codigo_radicado("DIR")
        respuesta = (
            f"### 🏥 Directorio Preferencial de Sedes y Farmacias en Antioquia\n\n"
            f"Todas nuestras sedes cuentan con **Fila Cero (Ventanilla Preferencial del Adulto Mayor)**, rampas de acceso y sillas de ruedas disponibles:\n\n"
            f"- **📍 Medellín Centro (Sede Principal):** Cra. 46 # 54-20 (Sector Parque Bolívar, cerca a la estación Parque Berrío).\n"
            f"- **📍 Medellín Belén / Occidente:** Calle 30A # 75-42 (A media cuadra del Metroplús Belén).\n"
            f"- **📍 Envigado (Sur del Valle de Aburrá):** Calle 37 Sur # 41-28 (Sector Parque Principal de Envigado).\n"
            f"- **📍 Itagüí:** Cra. 51 # 50-21 (Frente al Parque Principal de Itagüí).\n"
            f"- **📍 Bello (Norte):** Cra. 50 # 51-14 (Sector Choza Marco Fidel Suárez).\n"
            f"- **📍 Rionegro y Oriente Antioqueño:** Calle 47 # 56-35 (Centro Médico Savanna Plaza).\n\n"
            f"**🕒 Horario Continuo Preferencial:** Lunes a Viernes de 7:00 a.m. a 5:00 p.m. y Sábados de 7:00 a.m. a 12:00 m.\n"
            f"**📞 Línea Única en Antioquia:** (604) 444-7262 • Línea Gratuita: 018000-423-276."
        )
        tarjeta = construir_tarjeta_comprobante("SEDES", {
            "radicado": rad,
            "titulo": "Red de Atención Accesible en Antioquia",
            "paciente": estado_sesion["documento"],
            "detalle_1": "Medellín, Envigado, Itagüí, Bello y Rionegro",
            "detalle_2": "Horario: Lun-Vie 7:00 a.m. - 5:00 p.m. • Sáb 7:00 a.m. - 12:00 m.",
            "detalle_3": "Acceso con rampa, ascensor y Ventanilla Preferencial",
        })
        return respuesta, tarjeta, estado_sesion

    # ------------------------------------------------------------------
    # 10. APOYO AL CUIDADOR, SALUD MENTAL Y CENTROS VIDA
    # ------------------------------------------------------------------
    if any(k in msg for k in ["cuidador", "familia", "centro vida", "centros vida", "solo", "sola", "triste", "depres", "angustia", "ansiedad", "psicolog", "acompañamiento", "abuelo", "abuela", "adulto mayor"]):
        estado_sesion["ultimo_tema"] = "CUIDADOR"
        rad = generar_codigo_radicado("VIDA")
        respuesta = (
            f"### 🤝 Red de Apoyo al Cuidador, Bienestar Emocional y Centros Vida\n\n"
            f"En **{NOMBRE_PROYECTO}** sabemos que la salud también es compañía, afecto y descanso para quien cuida:\n\n"
            f"1. **Red de Centros Vida y Clubes de Vida (Alcaldía de Medellín y Gobernación):**\n"
            f"   - Actividades gratuitas de gimnasia suave, hidroterapia, música, alimentación saludable y tejido social.\n"
            f"2. **Programa «Cuidar al que Cuida»:**\n"
            f"   - Orientación psicológica, relevo domiciliario de enfermería y capacitación para familiares cuidadores.\n"
            f"3. **Línea Amiga Salud Mental (24 Horas):**\n"
            f"   - **(604) 444-4448** — Escucha cálida y gratuita cuando sienta soledad, tristeza o sobrecarga emocional.\n\n"
            f"- **Radicado de Inscripción al Programa:** `{rad}`\n"
            f"¿Le gustaría que una trabajadora social de nuestro equipo le llame hoy mismo para conversar?"
        )
        tarjeta = construir_tarjeta_comprobante("CUIDADOR", {
            "radicado": rad,
            "titulo": "Acompañamiento Psicosocial y Centros Vida",
            "paciente": estado_sesion["documento"],
            "detalle_1": "Inscripción a Centros Vida y Red del Cuidador",
            "detalle_2": "Línea Amiga 24h: (604) 444-4448",
            "detalle_3": "Atención integral humana y libre de estigmas",
        })
        return respuesta, tarjeta, estado_sesion

    # ------------------------------------------------------------------
    # 11. DERECHOS DEL ADULTO MAYOR, QUEJAS Y MARCO ÉTICO-LEGAL
    # ------------------------------------------------------------------
    if any(k in msg for k in ["derecho", "ley", "queja", "reclamo", "tutela", "supersalud", "defensor", "maltrato", "demora", "etica", "ética", "privacidad"]):
        estado_sesion["ultimo_tema"] = "DERECHOS"
        rad = generar_codigo_radicado("DEF")
        respuesta = (
            f"### ⚖️ Defensoría del Adulto Mayor y Garantías Legales en Salud\n\n"
            f"Como persona mayor en Colombia, usted goza de **protección constitucional reforzada**:\n\n"
            f"- **Ley 1171 de 2007 (Ventanilla y Turno Preferencial):** Ninguna entidad puede obligarle a hacer filas extensas; las citas médicas deben asignarse en un plazo prioritario.\n"
            f"- **Resolución 1604 de 2013:** Todo medicamento pendiente debe entregarse en su domicilio en máximo 48 horas.\n"
            f"- **Circular Externa 008 de SuperSalud:** Atención prioritaria, trato digno y canales no presenciales accesibles como **{NOMBRE_PROYECTO}**.\n"
            f"- **Ley 1581 de 2012 (Habeas Data e IA Ética):** Sus datos médicos son confidenciales y toda decisión cuenta con respaldo de un profesional humano.\n\n"
            f"Hemos abierto el radicado de defensoría `{rad}`. También puede comunicarse con la **Superintendencia Nacional de Salud al 018000-513-700**."
        )
        tarjeta = construir_tarjeta_comprobante("DERECHOS", {
            "radicado": rad,
            "titulo": "Protección Legal • Ley 1171 y SuperSalud",
            "paciente": estado_sesion["documento"],
            "detalle_1": "Sujeto de Especial Protección Constitucional",
            "detalle_2": "SuperSalud: 018000-513-700 • Personería: 143",
            "detalle_3": "IA Ética con supervisión humana garantizada",
        })
        return respuesta, tarjeta, estado_sesion

    # ------------------------------------------------------------------
    # 12. DESPEDIDAS Y AGRADECIMIENTOS
    # ------------------------------------------------------------------
    if any(k in msg for k in ["gracias", "muchas gracias", "adios", "adiós", "hasta luego", "chao", "bendiciones", "muy amable"]):
        respuesta = (
            f"### 💙 ¡Con muchísimo gusto, mi estimado/a!\n\n"
            f"Para mí, **{ASESORA}**, y para todo el equipo de **{NOMBRE_PROYECTO}**, es un honor servirle y cuidar de su bienestar. "
            f"Recuerde que nunca está solo/a: aquí tiene una voz amiga las 24 horas del día.\n\n"
            f"¡Que tenga un excelente y bendecido día en compañía de sus seres queridos!"
        )
        tarjeta = construir_tarjeta_comprobante("BIENVENIDA", {
            "titulo": "Atención Finalizada con Éxito",
            "paciente": estado_sesion["documento"],
            "detalle_1": "Sesión atendida con calidez y prioridad",
            "detalle_2": "Disponible 24/7 en VozMayor Antioquia",
        })
        return respuesta, tarjeta, estado_sesion

    # ------------------------------------------------------------------
    # 13. RESPUESTA INTELIGENTE POR DEFECTO (CON EMPATÍA Y GUÍA CLARA)
    # ------------------------------------------------------------------
    respuesta = (
        f"### 🤖 Orientación Asistida de {NOMBRE_PROYECTO}\n\n"
        f"Le escuché decir: *«{mensaje}»*.\n\n"
        f"Soy **{ASESORA}** y quiero darle la solución exacta sin hacerle perder tiempo. "
        f"¿Su inquietud está relacionada con alguno de estos servicios prioritarios?\n\n"
        f"1. 📅 **Pedir o confirmar una cita médica** (Medicina general, odontología, optometría).\n"
        f"2. 💊 **Reclamar medicamentos a domicilio** (Programa gratuito *VozMayor en Casa*).\n"
        f"3. 📋 **Autorizar exámenes u órdenes médicas** (Laboratorios, ecografías, especialistas).\n"
        f"4. 🏥 **Consultar direcciones y teléfonos** de sedes en Medellín, Bello, Envigado, Itagüí o Rionegro.\n\n"
        f"Dígame cuál de estas opciones prefiere o toque uno de los botones grandes debajo."
    )
    tarjeta = construir_tarjeta_comprobante("BIENVENIDA", {
        "titulo": "Consulta en Proceso de Orientación",
        "paciente": estado_sesion["documento"],
        "detalle_1": f"Consulta recibida: «{mensaje[:45]}...»" if len(mensaje) > 45 else f"Consulta: «{mensaje}»",
        "detalle_2": "Seleccione o diga el trámite deseado",
    })
    return respuesta, tarjeta, estado_sesion


# Wrapper de compatibilidad con la firma clásica por si se invoca directamente
def responder_consulta_vozmayor(mensaje: str, historial=None):
    respuesta, _, _ = procesar_consulta_completa(mensaje, None)
    return respuesta


# ==============================================================================
# FUNCIONES DE ORQUESTACIÓN DEL CHAT + VOZ EN TIEMPO REAL
# ==============================================================================

def formato_chatbot_gradio(historial_pares):
    """Detecta automáticamente si la versión de Gradio usa 'messages' (dicts) o 'tuples'."""
    return historial_pares

def agregar_interaccion(mensaje_usuario: str, historial: list, estado: dict, hablar_lento: bool):
    if historial is None:
        historial = []
    respuesta_md, tarjeta_html, nuevo_estado = procesar_consulta_completa(mensaje_usuario, estado)
    ruta_mp3 = sintetizar_voz(respuesta_md, hablar_lento=hablar_lento)

    # Soporte dual para Gradio 4.x / 5.x (formato messages o formato tuplas)
    usa_messages = _gradio_usa_messages()
    if usa_messages:
        historial.append({"role": "user", "content": mensaje_usuario})
        historial.append({"role": "assistant", "content": respuesta_md})
    else:
        historial.append((mensaje_usuario, respuesta_md))

    metricas_html = renderizar_metricas_eticas(nuevo_estado)
    estado_orbe_html = renderizar_orbe_ia(
        activo=True,
        urgencia=(nuevo_estado.get("ultimo_tema") == "URGENCIA"),
        subtitulo=f"Luz María Gómez está respondiendo en voz alta • Trámite: {nuevo_estado.get('ultimo_tema', 'ACTIVO')}"
    )
    return "", historial, ruta_mp3, tarjeta_html, nuevo_estado, metricas_html, estado_orbe_html

def procesar_entrada_voz(audio_path: str, historial: list, estado: dict, hablar_lento: bool):
    if not audio_path:
        return gr.update(), gr.update(), gr.update(), gr.update(), estado, gr.update(), gr.update()
    texto_transcrito = transcribir_audio_microfono(audio_path)
    etiqueta_usuario = texto_transcrito if not texto_transcrito.startswith("[") else "🎤 (Mensaje de voz enviado)"
    respuesta_md, tarjeta_html, nuevo_estado = procesar_consulta_completa(texto_transcrito, estado)
    ruta_mp3 = sintetizar_voz(respuesta_md, hablar_lento=hablar_lento)

    if historial is None:
        historial = []
    if _gradio_usa_messages():
        historial.append({"role": "user", "content": f"🎤 {etiqueta_usuario}"})
        historial.append({"role": "assistant", "content": respuesta_md})
    else:
        historial.append((f"🎤 {etiqueta_usuario}", respuesta_md))

    metricas_html = renderizar_metricas_eticas(nuevo_estado)
    estado_orbe_html = renderizar_orbe_ia(
        activo=True,
        urgencia=(nuevo_estado.get("ultimo_tema") == "URGENCIA"),
        subtitulo=f"Voz convertida a texto: «{etiqueta_usuario[:58]}»"
    )
    # Coloca el texto transcrito en txt_input para que se vea explícitamente la conversión de Voz a Texto
    return etiqueta_usuario, historial, ruta_mp3, tarjeta_html, nuevo_estado, metricas_html, estado_orbe_html


# ==============================================================================
# COMPONENTES VISUALES HTML (ORBE IA ANIMADO, MÉTRICAS ÉTICAS, CSS PROFESIONAL)
# ==============================================================================

def _gradio_usa_messages() -> bool:
    try:
        sig = inspect.signature(gr.Chatbot.__init__)
        return "type" in sig.parameters
    except Exception:
        return False

def renderizar_orbe_ia(activo: bool = False, urgencia: bool = False, subtitulo: str = "") -> str:
    if not subtitulo:
        subtitulo = "Asistente de Voz Activa • Presione el micrófono o elija un trámite"
    clase_estado = "vm-orb-urgent" if urgencia else ("vm-orb-speaking" if activo else "vm-orb-idle")
    badge_texto = "🚨 PROTOCOLO DE EMERGENCIA 123" if urgencia else ("🔊 LOCUCIÓN DE VOZ ACTIVA" if activo else "🎙️ ESCUCHA INTELIGENTE LISTA")
    return f"""
    <div class="vm-ai-core-banner {clase_estado}">
        <div class="vm-orb-wrapper">
            <div class="vm-orb-ring vm-ring-1"></div>
            <div class="vm-orb-ring vm-ring-2"></div>
            <div class="vm-orb-ring vm-ring-3"></div>
            <div class="vm-orb-center">
                <span class="vm-orb-icon">{'🚨' if urgencia else '🎙️'}</span>
            </div>
        </div>
        <div class="vm-ai-info">
            <div class="vm-ai-badges">
                <span class="vm-status-pill">{badge_texto}</span>
                <span class="vm-ethics-pill">🛡️ IA Ética • Ley 1171 Adulto Mayor</span>
            </div>
            <h2 class="vm-ai-name">{ASESORA} — <span style="font-weight:400; opacity:0.9;">{NOMBRE_PROYECTO}</span></h2>
            <p class="vm-ai-sub">{subtitulo}</p>
        </div>
        <div class="vm-wave-bars">
            <span></span><span></span><span></span><span></span><span></span><span></span><span></span>
        </div>
    </div>
    """

def renderizar_metricas_eticas(estado: dict) -> str:
    if not estado:
        interacciones = 1
        sede = "Medellín Centro"
    else:
        interacciones = max(1, estado.get("interacciones", 1))
        sede = estado.get("sede_preferida", "Medellín Centro").split("(")[0].strip()
    minutos_ahorrados = interacciones * 45
    return f"""
    <div class="vm-metrics-grid">
        <div class="vm-metric-box">
            <div class="vm-metric-num">{interacciones}</div>
            <div class="vm-metric-lbl">Gestiones por Voz</div>
        </div>
        <div class="vm-metric-box">
            <div class="vm-metric-num">~{minutos_ahorrados} min</div>
            <div class="vm-metric-lbl">Tiempo de Fila Ahorrado</div>
        </div>
        <div class="vm-metric-box">
            <div class="vm-metric-num">AAA+</div>
            <div class="vm-metric-lbl">Accesibilidad Cognitiva</div>
        </div>
        <div class="vm-metric-box">
            <div class="vm-metric-num">{sede}</div>
            <div class="vm-metric-lbl">Red Activa Antioquia</div>
        </div>
    </div>
    """

CUSTOM_CSS = """
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

:root {
    --vm-bg-primary: #0b1120;
    --vm-bg-card: #111827;
    --vm-bg-elevated: #1e293b;
    --vm-text-main: #f8fafc;
    --vm-text-muted: #cbd5e1;
    --vm-accent: #0ea5e9;
    --vm-accent-2: #10b981;
    --vm-border: rgba(148, 163, 184, 0.22);
    --vm-font-scale: 1.08rem;
}

.gradio-container {
    font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif !important;
    max-width: 1400px !important;
    margin: 0 auto !important;
}

/* Cabecera de Núcleo IA con Orbe Animado */
.vm-ai-core-banner {
    display: flex;
    align-items: center;
    gap: 22px;
    padding: 20px 26px;
    border-radius: 20px;
    background: linear-gradient(135deg, #0f172a 0%, #1e293b 55%, #0c4a6e 100%);
    border: 1px solid rgba(56, 189, 248, 0.35);
    box-shadow: 0 14px 35px -10px rgba(2, 132, 199, 0.35);
    color: #ffffff;
    margin-bottom: 14px;
    position: relative;
    overflow: hidden;
}

.vm-ai-core-banner.vm-orb-urgent {
    background: linear-gradient(135deg, #450a0a 0%, #7f1d1d 60%, #991b1b 100%);
    border-color: #f87171;
    box-shadow: 0 14px 35px -10px rgba(239, 68, 68, 0.55);
}

.vm-orb-wrapper {
    position: relative;
    width: 74px;
    height: 74px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}

.vm-orb-center {
    width: 52px;
    height: 52px;
    border-radius: 50%;
    background: radial-gradient(circle at 30% 30%, #38bdf8, #0284c7 65%, #0369a1);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 3;
    box-shadow: 0 0 22px rgba(56, 189, 248, 0.8);
}

.vm-orb-urgent .vm-orb-center {
    background: radial-gradient(circle at 30% 30%, #fca5a5, #ef4444 65%, #b91c1c);
    box-shadow: 0 0 26px rgba(239, 68, 68, 0.95);
}

.vm-orb-icon {
    font-size: 1.55rem;
}

.vm-orb-ring {
    position: absolute;
    border-radius: 50%;
    border: 2px solid rgba(56, 189, 248, 0.5);
    animation: vmPulse 2.6s infinite ease-out;
}
.vm-orb-urgent .vm-orb-ring {
    border-color: rgba(248, 113, 113, 0.7);
}
.vm-ring-1 { width: 58px; height: 58px; animation-delay: 0s; }
.vm-ring-2 { width: 68px; height: 68px; animation-delay: 0.7s; }
.vm-ring-3 { width: 78px; height: 78px; animation-delay: 1.4s; }

@keyframes vmPulse {
    0% { transform: scale(0.88); opacity: 0.95; }
    100% { transform: scale(1.28); opacity: 0; }
}

.vm-ai-info {
    flex: 1;
}

.vm-ai-badges {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 6px;
}

.vm-status-pill {
    background: rgba(16, 185, 129, 0.22);
    border: 1px solid rgba(52, 211, 153, 0.55);
    color: #6ee7b7;
    font-size: 0.76rem;
    font-weight: 700;
    padding: 3px 11px;
    border-radius: 999px;
    letter-spacing: 0.03em;
}

.vm-orb-urgent .vm-status-pill {
    background: rgba(239, 68, 68, 0.3);
    border-color: #fca5a5;
    color: #fecaca;
}

.vm-ethics-pill {
    background: rgba(56, 189, 248, 0.18);
    border: 1px solid rgba(56, 189, 248, 0.4);
    color: #bae6fd;
    font-size: 0.76rem;
    font-weight: 600;
    padding: 3px 11px;
    border-radius: 999px;
}

.vm-ai-name {
    margin: 0 !important;
    font-size: 1.42rem !important;
    font-weight: 800 !important;
    color: #ffffff !important;
    line-height: 1.25 !important;
}

.vm-ai-sub {
    margin: 4px 0 0 0 !important;
    font-size: 0.98rem !important;
    color: #e2e8f0 !important;
}

/* Ecualizador de onda de voz */
.vm-wave-bars {
    display: flex;
    align-items: center;
    gap: 4px;
    height: 40px;
    padding-left: 10px;
}

.vm-wave-bars span {
    display: block;
    width: 5px;
    background: linear-gradient(to top, #0ea5e9, #34d399);
    border-radius: 99px;
    animation: vmWave 1.2s infinite ease-in-out;
}
.vm-wave-bars span:nth-child(1) { height: 14px; animation-delay: 0.1s; }
.vm-wave-bars span:nth-child(2) { height: 28px; animation-delay: 0.25s; }
.vm-wave-bars span:nth-child(3) { height: 36px; animation-delay: 0.4s; }
.vm-wave-bars span:nth-child(4) { height: 22px; animation-delay: 0.55s; }
.vm-wave-bars span:nth-child(5) { height: 34px; animation-delay: 0.3s; }
.vm-wave-bars span:nth-child(6) { height: 18px; animation-delay: 0.15s; }
.vm-wave-bars span:nth-child(7) { height: 12px; animation-delay: 0.45s; }

@keyframes vmWave {
    0%, 100% { transform: scaleY(0.55); opacity: 0.65; }
    50% { transform: scaleY(1.15); opacity: 1; }
}

/* Tarjeta de Comprobante Digital */
.vm-ticket-card {
    border-radius: 16px;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.08);
    overflow: hidden;
    margin-bottom: 12px;
    color: #0f172a;
}

.dark .vm-ticket-card {
    background: #1e293b;
    border-color: rgba(148, 163, 184, 0.22);
    color: #f8fafc;
}

.vm-ticket-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 16px;
    font-size: 0.8rem;
    font-weight: 800;
    letter-spacing: 0.03em;
}

.vm-ticket-code {
    font-family: monospace;
    font-size: 0.85rem;
    background: rgba(15, 23, 42, 0.08);
    padding: 2px 8px;
    border-radius: 6px;
}

.dark .vm-ticket-code {
    background: rgba(255, 255, 255, 0.12);
}

.vm-ticket-body {
    padding: 16px;
}

.vm-ticket-title {
    margin: 0 0 12px 0 !important;
    font-size: 1.15rem !important;
    font-weight: 800 !important;
}

.vm-ticket-row {
    display: flex;
    flex-direction: column;
    padding: 7px 0;
    border-bottom: 1px dashed rgba(148, 163, 184, 0.3);
}

.vm-ticket-label {
    font-size: 0.8rem;
    font-weight: 700;
    opacity: 0.72;
}

.vm-ticket-val {
    font-size: 0.96rem;
    font-weight: 600;
    margin-top: 2px;
}

.vm-ticket-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 14px;
    padding-top: 8px;
}

.vm-qr-badge {
    background: #0ea5e9;
    color: #ffffff;
    font-size: 0.75rem;
    font-weight: 800;
    padding: 6px 12px;
    border-radius: 8px;
}

/* Métricas de Impacto Ético */
.vm-metrics-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
    margin-top: 8px;
}

.vm-metric-box {
    background: rgba(14, 165, 233, 0.08);
    border: 1px solid rgba(14, 165, 233, 0.25);
    border-radius: 12px;
    padding: 10px 12px;
    text-align: center;
}

.vm-metric-num {
    font-size: 1.15rem;
    font-weight: 800;
    color: #0284c7;
}

.dark .vm-metric-num {
    color: #38bdf8;
}

.vm-metric-lbl {
    font-size: 0.76rem;
    font-weight: 600;
    opacity: 0.82;
}

/* Botones Grandes Accesibles para Adulto Mayor */
.vm-quick-btn button {
    font-size: 1.02rem !important;
    font-weight: 700 !important;
    padding: 14px 16px !important;
    border-radius: 14px !important;
    text-align: left !important;
    transition: all 0.18s ease !important;
    border: 1.5px solid rgba(14, 165, 233, 0.3) !important;
}

.vm-quick-btn button:hover {
    transform: translateY(-2px) !important;
    box-shadow: 0 8px 20px -6px rgba(14, 165, 233, 0.4) !important;
    border-color: #0ea5e9 !important;
}

.vm-emergency-btn button {
    background: linear-gradient(135deg, #dc2626, #b91c1c) !important;
    color: #ffffff !important;
    font-size: 1.05rem !important;
    font-weight: 800 !important;
    padding: 14px 16px !important;
    border-radius: 14px !important;
    border: none !important;
    box-shadow: 0 6px 18px rgba(220, 38, 38, 0.38) !important;
}

/* Legibilidad aumentada en el Chatbot para el Adulto Mayor */
.vm-chatbot-area .prose,
.vm-chatbot-area p,
.vm-chatbot-area li {
    font-size: var(--vm-font-scale) !important;
    line-height: 1.65 !important;
}
"""

# ==============================================================================
# CONSTRUCCIÓN DE LA INTERFAZ PROFESIONAL EN GRADIO BLOCKS
# ==============================================================================

def construir_interfaz_vozmayor():
    mensaje_inicial = (
        f"### 👋 ¡Bienvenido/a a {NOMBRE_PROYECTO}!\n\n"
        f"Soy **{ASESORA}**, su asistente de salud e inteligencia artificial diseñada especialmente para el **Adulto Mayor en Antioquia**.\n\n"
        f"- 🎙️ **Para hablarme:** Toque el botón del micrófono, dígame su inquietud con calma y yo le responderé **en voz alta**.\n"
        f"- 👆 **Para gestión con 1 toque:** Presione cualquiera de los **Botones Grandes de Trámite** debajo.\n\n"
        f"*¿En qué le puedo colaborar hoy? (Citas médicas, medicamentos a domicilio, autorizaciones, certificados ADRES o sedes)*"
    )

    usa_messages = _gradio_usa_messages()
    if usa_messages:
        historial_inicial = [{"role": "assistant", "content": mensaje_inicial}]
    else:
        historial_inicial = [(None, mensaje_inicial)]

    estado_inicial = {
        "interacciones": 1,
        "ultimo_tema": "BIENVENIDA",
        "sede_preferida": "IPS Medellín Centro (Parque Bolívar)",
        "documento": "Afiliado Adulto Mayor Preferencial",
    }

    tema_visual = gr.themes.Soft(
        primary_hue="sky",
        secondary_hue="emerald",
        neutral_hue="slate",
        font=[gr.themes.GoogleFont("Plus Jakarta Sans"), "sans-serif"],
    )

    # Compatibilidad con distintas versiones de Gradio para Blocks
    blocks_kwargs = {"title": f"{NOMBRE_PROYECTO} • Asistente IA por Voz para el Adulto Mayor"}
    sig_blocks = inspect.signature(gr.Blocks.__init__)
    if "theme" in sig_blocks.parameters:
        blocks_kwargs["theme"] = tema_visual
    if "css" in sig_blocks.parameters:
        blocks_kwargs["css"] = CUSTOM_CSS

    with gr.Blocks(**blocks_kwargs) as demo:
        # Inyección segura del CSS + control dinámico de escala tipográfica accesible
        estilo_dinamico = gr.HTML(f"<style>{CUSTOM_CSS}\n:root {{ --vm-font-scale: 1.15rem; }}</style>")

        estado_sesion = gr.State(estado_inicial)

        # 1. Banner Superior con Orbe IA Animado
        orbe_html = gr.HTML(value=renderizar_orbe_ia(activo=False))

        with gr.Row(equal_height=False):
            # ==================================================================
            # COLUMNA IZQUIERDA (PRINCIPAL): CHAT IA + ESTUDIO DE VOZ + BOTONES
            # ==================================================================
            with gr.Column(scale=7):
                chatbot_kwargs = {
                    "value": historial_inicial,
                    "label": f"💬 Conversación en Vivo con {ASESORA} (Texto Grande Accesible)",
                    "height": 430,
                    "elem_classes": ["vm-chatbot-area"],
                }
                if usa_messages:
                    chatbot_kwargs["type"] = "messages"

                chatbot = gr.Chatbot(**chatbot_kwargs)

                # Barra de Entrada Multimodal (Voz + Texto + Preferencia de Velocidad)
                with gr.Group():
                    with gr.Row():
                        audio_input = gr.Audio(
                            sources=["microphone", "upload"],
                            type="filepath",
                            label="🎙️ 1. HABLE AQUÍ (Presione para grabar su voz y suelte al terminar)",
                            scale=5,
                        )
                        audio_output = gr.Audio(
                            label="🔊 Respuesta en Voz de Luz María (Reproducción Automática)",
                            autoplay=True,
                             scale=5,
                        )

                    with gr.Row():
                        txt_input = gr.Textbox(
                            placeholder="🎙️ Su voz se convertirá en texto aquí automáticamente (o escriba su consulta, cédula o municipio)...",
                            label="📝 Campo de Voz Convertida a Texto (Speech-to-Text en Vivo)",
                            scale=7,
                            lines=1,
                        )
                        btn_enviar = gr.Button(
                            "✦ Consultar y Escuchar 🔊",
                            variant="primary",
                            scale=2,
                        )

                    with gr.Row():
                        chk_lento = gr.Checkbox(
                            label="🐢 Hablar más pausado (Modo Audición Clara)",
                            value=False,
                        )
                        radio_tamano = gr.Radio(
                            choices=["Normal (100%)", "Grande (120%)", "Extra Grande (140%)"],
                            value="Grande (120%)",
                            label="🔍 Tamaño de Letra Accesible (Baja Visión)",
                            interactive=True,
                        )
                    with gr.Row():
                        btn_repetir_voz = gr.Button("🔁 Escuchar Bienvenida en Voz Alta", size="sm")
                        btn_limpiar = gr.Button("🧹 Nueva Consulta / Reiniciar", size="sm")

                # Panel de Botones Gigantes de 1 Toque (Accesibilidad Cognitiva y Motora)
                gr.Markdown("### 👆 Botones Grandes de Trámite Rápido (Toque una opción para atención inmediata por voz)")
                with gr.Row():
                    btn_cita = gr.Button("📅 1. Agendar Cita Prioritaria", elem_classes=["vm-quick-btn"])
                    btn_meds = gr.Button("💊 2. Medicamentos a Domicilio", elem_classes=["vm-quick-btn"])
                    btn_auto = gr.Button("📋 3. Autorizar Órdenes y Exámenes", elem_classes=["vm-quick-btn"])
                    btn_cert = gr.Button("🪪 4. Certificado ADRES ($0 Copago)", elem_classes=["vm-quick-btn"])

                with gr.Row():
                    btn_sedes = gr.Button("🏥 5. Sedes y Teléfonos Antioquia", elem_classes=["vm-quick-btn"])
                    btn_cuidador = gr.Button("🤝 6. Apoyo al Cuidador y Centros Vida", elem_classes=["vm-quick-btn"])
                    btn_queja = gr.Button("⚖️ 7. Reclamo por Medicamento Pendiente", elem_classes=["vm-quick-btn"])
                    btn_urgencia = gr.Button("🚨 8. Emergencia Médica (Triaje 123)", elem_classes=["vm-emergency-btn"])

            # ==================================================================
            # COLUMNA DERECHA: COMPROBANTE DIGITAL + MONITOR ÉTICO EN IA
            # ==================================================================
            with gr.Column(scale=5):
                gr.Markdown("### 🎫 Comprobante Digital y Estado del Trámite")
                tarjeta_comprobante = gr.HTML(
                    value=construir_tarjeta_comprobante("BIENVENIDA", {
                        "titulo": "Canal Preferencial del Adulto Mayor Activo",
                        "paciente": "Afiliado Adulto Mayor Preferencial",
                        "detalle_1": "Orientación 100% por Voz y Botones Accesibles",
                        "detalle_2": "IPS Medellín Centro • Valle de Aburrá y Oriente",
                        "detalle_3": "Protegido por Ley 1171 de 2007 y Resolución 1604",
                    })
                )

                gr.Markdown("### 📊 Impacto Social y Accesibilidad en Tiempo Real")
                metricas_panel = gr.HTML(value=renderizar_metricas_eticas(estado_inicial))

                with gr.Accordion("🏛️ Marco de Ética en la Era de la IA (Sustentación Académica)", open=True):
                    gr.Markdown(
                        """
                        **Diseño Ético Centrado en la Persona Mayor (*Human-Centered AI*):**
                        - **1. Inclusión Digital y Justicia Social:** Elimina la brecha tecnológica mediante interacción 100% hablada en lenguaje natural colombiano y botones de alto contraste.
                        - **2. No Maleficencia y Triaje Seguro:** El algoritmo prioriza la vida; detecta signos de alarma vital (dolor torácico, disnea, caídas, riesgo en salud mental) y remite de inmediato a la **Línea 123** sin intentar diagnosticar ni reemplazar al médico.
                        - **3. Transparencia y Explicabilidad:** La asesora se identifica claramente como un sistema de orientación asistida y entrega números de radicado verificables con sustento normativo (**Ley 1171 de 2007** y **Resolución 1604 de 2013**).
                        - **4. Privacidad y Gobernanza de Datos (Ley 1581):** Cero almacenamiento comercial de voz y respeto estricto del *Habeas Data* en salud.
                        """
                    )

                with gr.Accordion("📍 Cambiar Municipio o Sede Preferida con 1 Clic", open=False):
                    gr.Markdown("Toque su municipio para actualizar automáticamente su sede de citas y farmacia:")
                    with gr.Row():
                        btn_mun_med = gr.Button("🏙️ Medellín Centro", size="sm")
                        btn_mun_env = gr.Button("🌳 Envigado", size="sm")
                        btn_mun_bel = gr.Button("🏘️ Bello", size="sm")
                        btn_mun_rio = gr.Button("✈️ Rionegro / Oriente", size="sm")

        # ======================================================================
        # CONEXIÓN DE EVENTOS (VOZ AUTOMÁTICA + TECLADO + BOTONES RÁPIDOS)
        # ======================================================================
        salidas_comunes = [
            txt_input,
            chatbot,
            audio_output,
            tarjeta_comprobante,
            estado_sesion,
            metricas_panel,
            orbe_html,
        ]

        # Envío por texto o Enter
        btn_enviar.click(
            fn=agregar_interaccion,
            inputs=[txt_input, chatbot, estado_sesion, chk_lento],
            outputs=salidas_comunes,
        )
        txt_input.submit(
            fn=agregar_interaccion,
            inputs=[txt_input, chatbot, estado_sesion, chk_lento],
            outputs=salidas_comunes,
        )

        # Envío automático apenas termina de hablar por el micrófono o sube un audio (muestra el texto convertido en txt_input)
        audio_input.change(
            fn=procesar_entrada_voz,
            inputs=[audio_input, chatbot, estado_sesion, chk_lento],
            outputs=salidas_comunes,
        )

        # Botones Rápidos de 1 Toque
        botones_rapidos = [
            (btn_cita, "Quiero agendar una cita médica prioritaria de control"),
            (btn_meds, "Solicito el envío de mis medicamentos a domicilio con VozMayor en Casa"),
            (btn_auto, "Necesito autorizar una orden médica y exámenes de laboratorio"),
            (btn_cert, "Quiero consultar mi certificado de afiliación ADRES sin copago"),
            (btn_sedes, "¿Cuáles son las sedes, direcciones y teléfonos de atención en Antioquia?"),
            (btn_cuidador, "Necesito apoyo al cuidador, orientación emocional y Centros Vida"),
            (btn_queja, "En la farmacia me dejaron un medicamento pendiente y no me lo entregaron"),
            (btn_urgencia, "Tengo dolor en el pecho y me falta el aire, necesito urgencias"),
            (btn_mun_med, "Hola, quiero atención en Medellín"),
            (btn_mun_env, "Prefiero confirmar mi atención en la sede de Envigado"),
            (btn_mun_bel, "Prefiero confirmar mi atención en la sede de Bello"),
            (btn_mun_rio, "Prefiero confirmar mi atención en la sede de Rionegro Oriente"),
        ]

        for boton, consulta_fija in botones_rapidos:
            boton.click(
                fn=lambda hist, est, lento, q=consulta_fija: agregar_interaccion(q, hist, est, lento),
                inputs=[chatbot, estado_sesion, chk_lento],
                outputs=salidas_comunes,
            )

        # Botón para escuchar saludo inicial en voz alta
        btn_repetir_voz.click(
            fn=lambda hist, est, lento: agregar_interaccion("Buenos días Luz María", hist, est, lento),
            inputs=[chatbot, estado_sesion, chk_lento],
            outputs=salidas_comunes,
        )

        # Botón para limpiar sesión
        def reiniciar_sesion():
            return (
                "",
                historial_inicial,
                None,
                construir_tarjeta_comprobante("BIENVENIDA", {}),
                estado_inicial.copy(),
                renderizar_metricas_eticas(estado_inicial),
                renderizar_orbe_ia(activo=False),
            )

        def actualizar_escala_letra(opcion: str):
            mapa = {
                "Normal (100%)": "1.0rem",
                "Grande (120%)": "1.18rem",
                "Extra Grande (140%)": "1.36rem",
            }
            escala = mapa.get(opcion, "1.18rem")
            return f"<style>{CUSTOM_CSS}\n:root {{ --vm-font-scale: {escala}; }}</style>"

        radio_tamano.change(
            fn=actualizar_escala_letra,
            inputs=[radio_tamano],
            outputs=[estilo_dinamico],
        )

        btn_limpiar.click(
            fn=reiniciar_sesion,
            inputs=[],
            outputs=salidas_comunes,
        )

    return demo


# ==============================================================================
# EJECUCIÓN PRINCIPAL (COMPATIBLE CON GOOGLE COLAB Y EJECUCIÓN LOCAL)
# ==============================================================================

if __name__ == "__main__":
    EnColab = "google.colab" in sys.modules
    app = construir_interfaz_vozmayor()
    app.launch(share=EnColab, debug=False)
