
import { useEffect, useRef, useState } from "react";

import {
  buscarRepuestoPorVoz,
  seleccionarOpcionRepuesto
} from "../../services/vozService";

function VoiceAssistant({
  onResultado,
  busquedaEscrita = ""
}) {
  const [escuchando, setEscuchando] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [soporteVoz, setSoporteVoz] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [tipoMensaje, setTipoMensaje] = useState("");
  const [opciones, setOpciones] = useState([]);

  const reconocimientoRef = useRef(null);
  const activoRef = useRef(false);
  const procesandoRef = useRef(false);
  const cancelacionManualRef = useRef(false);

  const onResultadoRef = useRef(onResultado);
  const busquedaAnteriorRef = useRef(busquedaEscrita);

  // Identifica consultas para evitar mostrar resultados antiguos.
  const consultaIdRef = useRef(0);

  // =====================================
  // ACTUALIZAR REFERENCIAS
  // =====================================

  useEffect(() => {
    onResultadoRef.current = onResultado;
  }, [onResultado]);

  // =====================================
  // LIMPIAR VOZ AL ESCRIBIR
  // =====================================

  useEffect(() => {
    if (busquedaAnteriorRef.current === busquedaEscrita) {
      return;
    }

    busquedaAnteriorRef.current = busquedaEscrita;

    // Invalidar cualquier resultado de voz pendiente.
    consultaIdRef.current += 1;

    cancelacionManualRef.current = true;
    activoRef.current = false;

    reconocimientoRef.current?.abort();

    window.speechSynthesis?.cancel();

    setEscuchando(false);
    setOpciones([]);
    setMensaje("");
    setTipoMensaje("");
  }, [busquedaEscrita]);

  // =====================================
  // RESPUESTA HABLADA
  // =====================================

  const hablar = (texto) => {
    if (!("speechSynthesis" in window)) return;

    window.speechSynthesis.cancel();

    const respuesta = new SpeechSynthesisUtterance(texto);

    respuesta.lang = "es-PE";
    respuesta.rate = 0.95;
    respuesta.pitch = 1;

    window.speechSynthesis.speak(respuesta);
  };

  // =====================================
  // PROCESAR CONSULTA
  // =====================================

  const procesarConsulta = async (texto) => {
    if (procesandoRef.current) return;

    const consultaActual = ++consultaIdRef.current;

    setProcesando(true);
    procesandoRef.current = true;
    setOpciones([]);

    setMensaje("Consultando inventario...");
    setTipoMensaje("processing");

    try {
      const datos = await buscarRepuestoPorVoz(texto);

      // Si el usuario comenzó a escribir, ignorar
      // el resultado de la consulta de voz anterior.
      if (consultaActual !== consultaIdRef.current) {
        return;
      }

      if (datos.requiereSeleccion) {
        setOpciones(datos.opciones || []);
        setMensaje(datos.respuesta);
        setTipoMensaje("options");

        onResultadoRef.current?.(null);

        hablar(datos.respuesta);
        return;
      }

      setOpciones([]);
      setMensaje(datos.respuesta);

      setTipoMensaje(
        datos.encontrado ? "success" : "error"
      );

      onResultadoRef.current?.(datos);
      hablar(datos.respuesta);

    } catch (error) {
      // No mostrar errores de consultas que ya fueron
      // sustituidas por una búsqueda escrita.
      if (consultaActual !== consultaIdRef.current) {
        return;
      }

      console.error("Error consultando inventario:", error);

      const respuesta =
        "No pude consultar el inventario. Verifica tu conexión con el servidor.";

      setOpciones([]);
      setMensaje(respuesta);
      setTipoMensaje("error");

      onResultadoRef.current?.(null);
      hablar(respuesta);

    } finally {
      setProcesando(false);
      procesandoRef.current = false;
    }
  };

  // =====================================
  // SELECCIONAR MATERIAL
  // =====================================

  const seleccionarMaterial = (opcion) => {
    const resultado = seleccionarOpcionRepuesto(opcion);

    setOpciones([]);
    setMensaje(resultado.respuesta);

    setTipoMensaje(
      resultado.encontrado ? "success" : "error"
    );

    onResultadoRef.current?.(resultado);
    hablar(resultado.respuesta);
  };

  // =====================================
  // OCULTAR RESULTADOS AUTOMÁTICAMENTE
  // =====================================

  useEffect(() => {
    // Las opciones múltiples deben permanecer visibles.
    if (
      tipoMensaje !== "success" &&
      tipoMensaje !== "error"
    ) {
      return;
    }

    const temporizador = setTimeout(() => {
      setMensaje("");
      setTipoMensaje("");
    }, 8000);

    return () => clearTimeout(temporizador);
  }, [tipoMensaje, mensaje]);

  // =====================================
  // INICIALIZAR MICRÓFONO
  // =====================================

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSoporteVoz(false);
      return;
    }

    setSoporteVoz(true);

    const reconocimiento = new SpeechRecognition();

    reconocimiento.lang = "es-PE";
    reconocimiento.continuous = false;
    reconocimiento.interimResults = false;
    reconocimiento.maxAlternatives = 1;

    reconocimiento.onstart = () => {
      if (cancelacionManualRef.current) return;

      setEscuchando(true);
      setMensaje("Te escucho...");
      setTipoMensaje("listening");
      setOpciones([]);
    };

    reconocimiento.onresult = (event) => {
      if (
        cancelacionManualRef.current ||
        !activoRef.current
      ) {
        return;
      }

      const texto =
        event.results[0][0].transcript.trim();

      if (texto) {
        void procesarConsulta(texto);
      }
    };

    reconocimiento.onerror = (event) => {
      activoRef.current = false;
      setEscuchando(false);

      // Evitar mensajes de error después de cancelar.
      if (cancelacionManualRef.current) {
        cancelacionManualRef.current = false;
        return;
      }

      let respuesta = "No pude reconocer tu consulta.";

      if (
        event.error === "not-allowed" ||
        event.error === "service-not-allowed"
      ) {
        respuesta = "Permite el acceso al micrófono.";
      } else if (event.error === "no-speech") {
        respuesta =
          "No detecté ninguna voz. Inténtalo nuevamente.";
      } else if (event.error === "network") {
        respuesta =
          "Error de conexión al reconocer la voz.";
      } else if (event.error === "audio-capture") {
        respuesta =
          "No se encontró un micrófono disponible.";
      }

      setMensaje(respuesta);
      setTipoMensaje("error");
    };

    reconocimiento.onend = () => {
      activoRef.current = false;
      setEscuchando(false);

      if (cancelacionManualRef.current) {
        cancelacionManualRef.current = false;
        return;
      }
    };

    reconocimientoRef.current = reconocimiento;

    return () => {
      activoRef.current = false;

      reconocimiento.onresult = null;
      reconocimiento.onerror = null;
      reconocimiento.onstart = null;
      reconocimiento.onend = null;

      reconocimiento.abort();
      reconocimientoRef.current = null;

      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // =====================================
  // ACTIVAR MICRÓFONO
  // =====================================

  const iniciarEscucha = () => {
    if (!soporteVoz || !reconocimientoRef.current) {
      setMensaje("Reconocimiento de voz no disponible.");
      setTipoMensaje("error");
      return;
    }

    if (activoRef.current || procesandoRef.current) {
      return;
    }

    window.speechSynthesis?.cancel();

    cancelacionManualRef.current = false;

    setOpciones([]);
    setMensaje("");
    setTipoMensaje("");

    onResultadoRef.current?.(null);

    activoRef.current = true;

    setMensaje("Preparando micrófono...");
    setTipoMensaje("listening");

    try {
      reconocimientoRef.current.start();
    } catch (error) {
      activoRef.current = false;
      setEscuchando(false);

      setMensaje("No se pudo activar el micrófono.");
      setTipoMensaje("error");

      console.error(error);
    }
  };

  // =====================================
  // CANCELAR ESCUCHA CON X
  // =====================================

  const cancelarEscucha = () => {
    // Evitar que un resultado pendiente aparezca.
    consultaIdRef.current += 1;

    cancelacionManualRef.current = true;
    activoRef.current = false;

    reconocimientoRef.current?.abort();

    window.speechSynthesis?.cancel();

    setEscuchando(false);
    setOpciones([]);
    setMensaje("");
    setTipoMensaje("");
  };

  // =====================================
  // INTERFAZ
  // =====================================

  return (
    <div className="voice-control">

      {/* BOTÓN DEL MICRÓFONO */}

      <button
        type="button"
        className={`voice-control-button ${
          escuchando ? "is-listening" : ""
        }`}
        onClick={iniciarEscucha}
        disabled={
          procesando ||
          escuchando ||
          !soporteVoz
        }
        title="Buscar repuesto mediante voz"
        aria-label="Buscar repuesto mediante voz"
      >
        <svg
          viewBox="0 0 24 24"
          width="21"
          height="21"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect
            x="9"
            y="2"
            width="6"
            height="12"
            rx="3"
          />
          <path d="M5 10a7 7 0 0 0 14 0" />
          <path d="M12 17v5" />
          <path d="M8 22h8" />
        </svg>
      </button>

      {/* BOTÓN X PARA CANCELAR */}

      {escuchando && (
        <button
          type="button"
          className="voice-cancel-button"
          onClick={cancelarEscucha}
          title="Salir de búsqueda por voz"
          aria-label="Cancelar búsqueda por voz"
        >
          <svg
            viewBox="0 0 24 24"
            width="19"
            height="19"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          >
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      )}

      {/* MENSAJE DE ESTADO */}

      {mensaje && (
        <div
          className={`voice-inline-message ${tipoMensaje}`}
          role="status"
          aria-live="polite"
        >
          {escuchando && (
            <span className="voice-inline-indicator" />
          )}

          {procesando && (
            <span className="voice-inline-spinner" />
          )}

          <span>{mensaje}</span>
        </div>
      )}

      {/* OPCIONES DE MATERIALES */}

      {opciones.length > 0 && (
        <div className="voice-search-options">

          <p className="voice-search-options-title">
            Selecciona el material que necesitas:
          </p>

          {opciones.map((opcion) => (
            <button
              key={
                opcion.registro.sku ||
                opcion.registro.id
              }
              type="button"
              className="voice-search-option"
              onClick={() => seleccionarMaterial(opcion)}
              disabled={procesando}
            >
              <span className="voice-search-option-info">
                <strong>
                  {opcion.registro.descripcion}
                </strong>

                <small>
                  {opcion.registro.sku || "Sin SKU"}
                </small>
              </span>

              <span aria-hidden="true">›</span>
            </button>
          ))}

        </div>
      )}

    </div>
  );
}

export default VoiceAssistant;
