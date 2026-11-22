
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  History,
  Search,
  RefreshCw,
  Trash2,
  CalendarDays,
  UserRound,
  ClipboardList,
  Package,
  Pencil,
  Power,
  PlusCircle,
  Filter,
  AlertCircle,
  CheckCircle2,
  Clock,
  X,
} from "lucide-react";

import {
  obtenerHistorial,
  limpiarHistorial,
} from "../../services/historialService";

import { useUser } from "../../context/UserContext";

// =====================================================
// FORMATEAR FECHA
// =====================================================

function formatearFecha(fecha) {
  if (!fecha) return "Sin fecha";

  const fechaObjeto = new Date(fecha);

  if (Number.isNaN(fechaObjeto.getTime())) {
    return "Fecha no disponible";
  }

  return fechaObjeto.toLocaleString("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

// =====================================================
// NORMALIZAR TEXTO
// =====================================================

function normalizar(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

// =====================================================
// ICONO SEGÚN ACCIÓN
// =====================================================

function obtenerIcono(accion) {
  const accionNormalizada = normalizar(accion);

  if (accionNormalizada.includes("creacion")) {
    return <PlusCircle size={17} />;
  }

  if (accionNormalizada.includes("edicion")) {
    return <Pencil size={17} />;
  }

  if (
    accionNormalizada.includes("activacion") ||
    accionNormalizada.includes("desactivacion")
  ) {
    return <Power size={17} />;
  }

  return <ClipboardList size={17} />;
}

// =====================================================
// COLOR SEGÚN ACCIÓN
// =====================================================

function obtenerClaseAccion(accion) {
  const accionNormalizada = normalizar(accion);

  if (accionNormalizada.includes("creacion")) {
    return "history-action-created";
  }

  if (accionNormalizada.includes("edicion")) {
    return "history-action-edited";
  }

  if (accionNormalizada.includes("activacion")) {
    return "history-action-activated";
  }

  if (accionNormalizada.includes("desactivacion")) {
    return "history-action-disabled";
  }

  return "history-action-default";
}

// =====================================================
// COMPONENTE PRINCIPAL
// =====================================================

function HistorialPage() {
  const { esAdministrador } = useUser();

  const [historial, setHistorial] = useState([]);

  const [busqueda, setBusqueda] = useState("");

  const [filtroModulo, setFiltroModulo] = useState("Todos");

  const [cargando, setCargando] = useState(true);

  const [actualizando, setActualizando] = useState(false);

  const [error, setError] = useState("");

  const [mensaje, setMensaje] = useState("");

  const [modalConfirmacion, setModalConfirmacion] = useState(false);

  const [limpiando, setLimpiando] = useState(false);

  // ===================================================
  // CARGAR HISTORIAL DESDE RAILWAY
  // ===================================================

  const cargarHistorial = useCallback(async (manual = false) => {
    if (manual) {
      setActualizando(true);
    } else {
      setCargando(true);
    }

    setError("");

    try {
      const resultado = await obtenerHistorial(500);

      if (!Array.isArray(resultado)) {
        throw new Error(
          "El servidor devolvió un formato de historial inválido."
        );
      }

      setHistorial(resultado);

    } catch (err) {
      setError(
        err.message || "No se pudo consultar el historial."
      );
    } finally {
      setCargando(false);
      setActualizando(false);
    }
  }, []);

  // ===================================================
  // CARGA INICIAL
  // ===================================================

  useEffect(() => {
    cargarHistorial();
  }, [cargarHistorial]);

  // ===================================================
  // OBTENER MÓDULOS DISPONIBLES
  // ===================================================

  const modulos = useMemo(() => {
    const valores = [
      ...new Set(
        historial
          .map((registro) => registro.modulo)
          .filter(Boolean)
      ),
    ];

    return valores.sort((a, b) => a.localeCompare(b));
  }, [historial]);

  // ===================================================
  // FILTRAR HISTORIAL
  // ===================================================

  const historialFiltrado = useMemo(() => {
    const termino = normalizar(busqueda);

    return historial.filter((registro) => {
      const coincideBusqueda =
        !termino ||
        [
          registro.modulo,
          registro.accion,
          registro.descripcion,
          registro.referencia,
          registro.usuario,
        ].some((campo) =>
          normalizar(campo).includes(termino)
        );

      const coincideModulo =
        filtroModulo === "Todos" ||
        registro.modulo === filtroModulo;

      return coincideBusqueda && coincideModulo;
    });
  }, [historial, busqueda, filtroModulo]);

  // ===================================================
  // INDICADORES
  // ===================================================

  const totalMovimientos = historial.length;

  const movimientosFiltrados = historialFiltrado.length;

  const totalCreaciones = historial.filter(
    (registro) =>
      normalizar(registro.accion).includes("creacion")
  ).length;

  const totalEdiciones = historial.filter(
    (registro) =>
      normalizar(registro.accion).includes("edicion")
  ).length;

  // ===================================================
  // LIMPIAR HISTORIAL
  // ===================================================

  async function confirmarLimpieza() {
    if (!esAdministrador || limpiando) return;

    setLimpiando(true);
    setError("");
    setMensaje("");

    try {
      await limpiarHistorial();

      setHistorial([]);
      setBusqueda("");
      setFiltroModulo("Todos");
      setModalConfirmacion(false);

      setMensaje("El historial se limpió correctamente.");

    } catch (err) {
      setError(
        err.message || "No se pudo limpiar el historial."
      );
    } finally {
      setLimpiando(false);
    }
  }

  // ===================================================
  // INTERFAZ
  // ===================================================

  return (
    <section className="historial-page">

      {/* ENCABEZADO */}

      <div className="page-heading">
        <div>
          <span className="page-eyebrow">
            CONTROL Y SEGUIMIENTO
          </span>

          <h1>Historial de actividades</h1>

          <p>
            Consulta los movimientos y las operaciones
            realizadas dentro del sistema de almacén.
          </p>
        </div>

        <div className="history-header-actions">

          <button
            type="button"
            className="button button-secondary"
            onClick={() => cargarHistorial(true)}
            disabled={actualizando || cargando}
          >
            <RefreshCw
              size={18}
              className={actualizando ? "history-spinning" : ""}
            />

            {actualizando ? "Actualizando..." : "Actualizar"}
          </button>

          {esAdministrador && (
            <button
              type="button"
              className="button button-secondary"
              onClick={() => setModalConfirmacion(true)}
              disabled={historial.length === 0}
            >
              <Trash2 size={18} />
              Limpiar historial
            </button>
          )}

        </div>
      </div>

      {/* MENSAJES */}

      {error && (
        <div className="history-alert history-alert-error">
          <AlertCircle size={19} />
          <span>{error}</span>
        </div>
      )}

      {mensaje && (
        <div className="history-alert history-alert-success">
          <CheckCircle2 size={19} />
          <span>{mensaje}</span>

          <button
            type="button"
            onClick={() => setMensaje("")}
            aria-label="Cerrar mensaje"
          >
            <X size={17} />
          </button>
        </div>
      )}

      {/* INDICADORES */}

      <div className="summary-grid">

        <article className="summary-card">
          <div className="history-stat-icon">
            <History size={21} />
          </div>

          <span>Total de movimientos</span>

          <strong>{totalMovimientos}</strong>

          <small>Registros almacenados</small>
        </article>

        <article className="summary-card">
          <div className="history-stat-icon">
            <PlusCircle size={21} />
          </div>

          <span>Creaciones</span>

          <strong>{totalCreaciones}</strong>

          <small>Registros nuevos</small>
        </article>

        <article className="summary-card">
          <div className="history-stat-icon">
            <Pencil size={21} />
          </div>

          <span>Ediciones</span>

          <strong>{totalEdiciones}</strong>

          <small>Modificaciones realizadas</small>
        </article>

        <article className="summary-card">
          <div className="history-stat-icon">
            <Filter size={21} />
          </div>

          <span>Resultados actuales</span>

          <strong>{movimientosFiltrados}</strong>

          <small>Según los filtros aplicados</small>
        </article>

      </div>

      {/* TABLA PRINCIPAL */}

      <div className="content-card">

        <div className="table-toolbar">

          <div>
            <h2>Registro de actividades</h2>

            <p>
              Movimientos registrados por los usuarios del sistema.
            </p>
          </div>

          <div className="history-filters">

            <div className="search-box">
              <Search size={18} />

              <input
                type="search"
                placeholder="Buscar actividad, usuario o referencia..."
                value={busqueda}
                onChange={(event) =>
                  setBusqueda(event.target.value)
                }
              />

              {busqueda && (
                <button
                  type="button"
                  onClick={() => setBusqueda("")}
                  aria-label="Limpiar búsqueda"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            <select
              value={filtroModulo}
              onChange={(event) =>
                setFiltroModulo(event.target.value)
              }
              aria-label="Filtrar por módulo"
            >
              <option value="Todos">Todos los módulos</option>

              {modulos.map((modulo) => (
                <option key={modulo} value={modulo}>
                  {modulo}
                </option>
              ))}
            </select>

          </div>

        </div>

        {/* TABLA */}

        <div className="table-wrapper">

          <table className="data-table">

            <thead>
              <tr>
                <th>Fecha y hora</th>
                <th>Módulo</th>
                <th>Acción</th>
                <th>Descripción</th>
                <th>Referencia</th>
                <th>Usuario</th>
              </tr>
            </thead>

            <tbody>

              {cargando ? (

                <tr>
                  <td colSpan="6">
                    <div className="history-empty">
                      <RefreshCw
                        size={28}
                        className="history-spinning"
                      />

                      <strong>Cargando historial...</strong>

                      <span>
                        Consultando los registros de Railway.
                      </span>
                    </div>
                  </td>
                </tr>

              ) : historialFiltrado.length > 0 ? (

                historialFiltrado.map((registro) => (

                  <tr key={registro.id}>

                    <td>
                      <div className="history-date">
                        <CalendarDays size={16} />

                        <span>
                          {formatearFecha(registro.fecha)}
                        </span>
                      </div>
                    </td>

                    <td>
                      <span className="history-module">
                        {registro.modulo || "General"}
                      </span>
                    </td>

                    <td>
                      <span
                        className={`history-action ${obtenerClaseAccion(
                          registro.accion
                        )}`}
                      >
                        {obtenerIcono(registro.accion)}

                        {registro.accion || "Actividad"}
                      </span>
                    </td>

                    <td>
                      <span className="history-description">
                        {registro.descripcion || "Sin descripción"}
                      </span>
                    </td>

                    <td>
                      <span className="sku-code">
                        {registro.referencia || "—"}
                      </span>
                    </td>

                    <td>
                      <div className="history-user">
                        <UserRound size={16} />

                        <strong>
                          {registro.usuario || "Sistema"}
                        </strong>
                      </div>
                    </td>

                  </tr>

                ))

              ) : (

                <tr>
                  <td colSpan="6">

                    <div className="history-empty">

                      {historial.length === 0 ? (
                        <History size={38} />
                      ) : (
                        <Search size={38} />
                      )}

                      <strong>
                        {historial.length === 0
                          ? "Todavía no hay movimientos"
                          : "No encontramos resultados"}
                      </strong>

                      <span>
                        {historial.length === 0
                          ? "Las operaciones realizadas aparecerán aquí."
                          : "Prueba con otro término o selecciona otro módulo."}
                      </span>

                    </div>

                  </td>
                </tr>

              )}

            </tbody>

          </table>

        </div>

        {/* PIE */}

        <div className="history-table-footer">

          <div>
            <Clock size={16} />

            <span>
              Mostrando {movimientosFiltrados} de {totalMovimientos} movimientos
            </span>
          </div>

          <span>
            Datos centralizados en Railway
          </span>

        </div>

      </div>

      {/* MODAL DE CONFIRMACIÓN */}

      {modalConfirmacion && esAdministrador && (

        <div className="modal-backdrop">

          <div className="modal-card">

            <div className="modal-header">

              <div>
                <span className="page-eyebrow">
                  CONFIRMAR OPERACIÓN
                </span>

                <h2>Limpiar historial</h2>
              </div>

              <button
                type="button"
                className="modal-close"
                onClick={() => setModalConfirmacion(false)}
                disabled={limpiando}
                aria-label="Cerrar"
              >
                <X size={20} />
              </button>

            </div>

            <div className="history-confirmation">

              <AlertCircle size={34} />

              <p>
                ¿Estás seguro de que deseas eliminar todos los
                registros del historial?
              </p>

              <small>
                Esta operación eliminará los {totalMovimientos}
                {" "}movimientos almacenados y no se podrá deshacer.
              </small>

            </div>

            <div className="modal-actions">

              <button
                type="button"
                className="button button-secondary"
                onClick={() => setModalConfirmacion(false)}
                disabled={limpiando}
              >
                Cancelar
              </button>

              <button
                type="button"
                className="button button-primary"
                onClick={confirmarLimpieza}
                disabled={limpiando}
              >
                <Trash2 size={17} />

                {limpiando ? "Limpiando..." : "Sí, limpiar historial"}
              </button>

            </div>

          </div>

        </div>

      )}

    </section>
  );
}

export default HistorialPage;
