import { useEffect, useRef, useState } from "react";

import {
  buscarRepuestoPorVoz,
  seleccionarOpcionRepuesto,
} from "../../services/vozService";

function VoiceAssistant({ onResultado }) {
  const [escuchando, setEscuchando] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [soporteVoz, setSoporteVoz] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [tipoMensaje, setTipoMensaje] = useState("");
  const [opciones, setOpciones] = useState([]);

  const reconocimientoRef = useRef(null);
  const activoRef = useRef(false);
  const procesandoRef = useRef(false);
  const onResultadoRef = useRef(onResultado);

  // Evitar respuestas habladas duplicadas.
  const ultimoTextoHabladoRef = useRef("");
  const ultimaReproduccionRef = useRef(0);

  useEffect(() => {
    onResultadoRef.current = onResultado;
  }, [onResultado]);

  // =====================================
  // RESPUESTA HABLADA
  // =====================================

  const hablar = (texto) => {
    if (!("speechSynthesis" in window) || !texto) return;

    const textoLimpio = String(texto).trim();

    if (!textoLimpio) return;

    const ahora = Date.now();

    // Evitar reproducir dos veces el mismo mensaje.
    if (
      ultimoTextoHabladoRef.current === textoLimpio &&
      ahora - ultimaReproduccionRef.current < 1800
    ) {
      return;
    }

    ultimoTextoHabladoRef.current = textoLimpio;
    ultimaReproduccionRef.current = ahora;

    window.speechSynthesis.cancel();

    const respuesta = new SpeechSynthesisUtterance(textoLimpio);

    respuesta.lang = "es-PE";
    respuesta.rate = 0.95;
    respuesta.pitch = 1;
    respuesta.volume = 1;

    window.speechSynthesis.speak(respuesta);
  };

  // =====================================
  // LIMPIAR RESULTADO ANTERIOR
  // =====================================

  const limpiarResultado = () => {
    setOpciones([]);
    onResultadoRef.current?.(null);
  };

  // =====================================
  // PROCESAR CONSULTA
  // =====================================

  const procesarConsulta = async (texto) => {
    if (procesandoRef.current || !texto?.trim()) return;

    setProcesando(true);
    procesandoRef.current = true;

    setOpciones([]);
    setMensaje("Consultando inventario...");
    setTipoMensaje("processing");

    try {
      const datos = await buscarRepuestoPorVoz(texto);

      // CASO 1: EXISTEN VARIAS OPCIONES.
      // No redireccionar hasta que el usuario seleccione.

      if (datos.requiereSeleccion) {
        setOpciones(datos.opciones || []);
        setMensaje(datos.respuesta);
        setTipoMensaje("options");

        limpiarResultado();

        hablar(datos.respuesta);

        return;
      }

      // CASO 2: RESULTADO ÚNICO.

      setOpciones([]);
      setMensaje(datos.respuesta);

      const ubicacionValida =
        datos.encontrado === true &&
        datos.registro &&
        datos.ubicacion &&
        datos.ubicacion.estante;

      if (ubicacionValida) {
        setTipoMensaje("success");

        // Redireccionar únicamente cuando existe ubicación.
        onResultadoRef.current?.(datos);
      } else {
        setTipoMensaje("error");

        // No mostrar una ubicación inexistente.
        onResultadoRef.current?.(null);
      }

      hablar(datos.respuesta);

    } catch (error) {
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
    if (!opcion || procesandoRef.current) return;

    const resultado = seleccionarOpcionRepuesto(opcion);

    setOpciones([]);
    setMensaje(resultado.respuesta);

    const ubicacionValida =
      resultado.encontrado === true &&
      resultado.registro &&
      resultado.ubicacion &&
      resultado.ubicacion.estante;

    if (ubicacionValida) {
      setTipoMensaje("success");

      // Solo ahora se muestra la ubicación seleccionada.
      onResultadoRef.current?.(resultado);

    } else {
      setTipoMensaje("error");

      onResultadoRef.current?.(null);
    }

    hablar(resultado.respuesta);
  };

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
      setEscuchando(true);
      setMensaje("Te escucho...");
      setTipoMensaje("listening");
      setOpciones([]);
    };

    reconocimiento.onresult = (event) => {
      const texto =
        event.results[0][0].transcript.trim();

      if (texto) {
        void procesarConsulta(texto);
      }
    };

    reconocimiento.onerror = (event) => {
      activoRef.current = false;
      setEscuchando(false);

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

    ultimoTextoHabladoRef.current = "";

    limpiarResultado();

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
  // CANCELAR ESCUCHA
  // =====================================

  const cancelarEscucha = () => {
    activoRef.current = false;

    reconocimientoRef.current?.abort();

    window.speechSynthesis?.cancel();

    setEscuchando(false);
    setOpciones([]);
    setMensaje("Consulta cancelada.");
    setTipoMensaje("error");
  };

  // =====================================
  // INTERFAZ
  // =====================================

  return (
    <div className="voice-control">

      <button
        type="button"
        className={`voice-control-button ${
          escuchando ? "is-listening" : ""
        }`}
        onClick={
          escuchando
            ? cancelarEscucha
            : iniciarEscucha
        }
        disabled={procesando || !soporteVoz}
        title={
          escuchando
            ? "Cancelar consulta"
            : "Buscar repuesto mediante voz"
        }
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