
import { useEffect, useMemo, useState } from "react";

import {
  Package,
  Warehouse,
  ChartPie,
  MapPin,
  Boxes,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

import { obtenerInventario } from "../../services/inventarioService";
import {
  obtenerUbicaciones,
  obtenerOcupacion,
} from "../../services/ubicacionesService";

import "./DashboardPage.css";

// =============================================
// FUNCIONES AUXILIARES
// =============================================

function extraerLista(respuesta) {
  if (Array.isArray(respuesta)) {
    return respuesta;
  }

  if (Array.isArray(respuesta?.data)) {
    return respuesta.data;
  }

  if (Array.isArray(respuesta?.registros)) {
    return respuesta.registros;
  }

  if (Array.isArray(respuesta?.ubicaciones)) {
    return respuesta.ubicaciones;
  }

  return [];
}

function formatoNumero(valor) {
  return Number(valor || 0).toLocaleString("es-PE");
}

// =============================================
// COMPONENTE PRINCIPAL
// =============================================

function DashboardPage() {

  const [inventario, setInventario] = useState([]);
  const [ubicaciones, setUbicaciones] = useState([]);
  const [ocupacion, setOcupacion] = useState([]);

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const [recarga, setRecarga] = useState(0);

  // ===========================================
  // CONSULTAR INFORMACIÓN DEL BACKEND
  // ===========================================

  useEffect(() => {

    let cancelado = false;

    async function cargarDashboard() {

      setCargando(true);
      setError("");

      try {

        const resultados = await Promise.allSettled([

          obtenerInventario(),

          obtenerUbicaciones(),

          obtenerOcupacion(),

        ]);

        if (cancelado) return;

        const [resultadoInventario, resultadoUbicaciones, resultadoOcupacion] =
          resultados;

        const errores = [];

        // Inventario.
        if (resultadoInventario.status === "fulfilled") {

          setInventario(
            extraerLista(resultadoInventario.value)
          );

        } else {

          setInventario([]);

          errores.push("inventario");
          console.error(
            "Error consultando inventario:",
            resultadoInventario.reason
          );

        }

        // Ubicaciones.
        if (resultadoUbicaciones.status === "fulfilled") {

          setUbicaciones(
            extraerLista(resultadoUbicaciones.value)
          );

        } else {

          setUbicaciones([]);

          errores.push("ubicaciones");
          console.error(
            "Error consultando ubicaciones:",
            resultadoUbicaciones.reason
          );

        }

        // Ocupación.
        if (resultadoOcupacion.status === "fulfilled") {

          setOcupacion(
            extraerLista(resultadoOcupacion.value)
          );

        } else {

          setOcupacion([]);

          errores.push("ocupación");
          console.error(
            "Error consultando ocupación:",
            resultadoOcupacion.reason
          );

        }

        if (errores.length > 0) {

          setError(
            `No se pudo consultar correctamente: ${errores.join(", ")}.`
          );

        }

      } catch (err) {

        if (!cancelado) {

          console.error(
            "Error cargando Dashboard:",
            err
          );

          setError(
            err.message || "No se pudo cargar el Dashboard."
          );

        }

      } finally {

        if (!cancelado) {
          setCargando(false);
        }

      }

    }

    cargarDashboard();

    return () => {
      cancelado = true;
    };

  }, [recarga]);

  // ===========================================
  // PROCESAR INFORMACIÓN DE OCUPACIÓN
  // ===========================================

  const resumen = useMemo(() => {

    const ocupacionPorUbicacion = new Map();

    ocupacion.forEach((registro) => {

      const id = String(
        registro.ubicacion ?? registro.id ?? ""
      );

      if (id) {
        ocupacionPorUbicacion.set(id, registro);
      }

    });

    const ubicacionesProcesadas = ubicaciones.map(
      (ubicacion) => {

        const id = String(ubicacion.id);

        const registroOcupacion =
          ocupacionPorUbicacion.get(id);

        const tieneSubdivisiones = Boolean(
          ubicacion.tieneSubdivisiones
        );

        const capacidad = Number(
          registroOcupacion?.capacidad ??
          ubicacion.capacidad ??
          (
            tieneSubdivisiones
              ? ubicacion.subdivisiones?.length || 0
              : 1
          )
        );

        const ocupados = Number(
          registroOcupacion?.ocupados ??
          ubicacion.ocupados ??
          0
        );

        const ocupacionReal = Math.min(
          ocupados,
          capacidad
        );

        const disponibles = Math.max(
          0,
          capacidad - ocupacionReal
        );

        return {
          ...ubicacion,
          id,
          capacidad,
          ocupados: ocupacionReal,
          disponibles,
          porcentaje:
            capacidad > 0
              ? (ocupacionReal / capacidad) * 100
              : 0,
        };

      }
    );

    const capacidadTotal = ubicacionesProcesadas.reduce(
      (total, item) => total + item.capacidad,
      0
    );

    const espaciosOcupados = ubicacionesProcesadas.reduce(
      (total, item) => total + item.ocupados,
      0
    );

    const espaciosDisponibles = ubicacionesProcesadas.reduce(
      (total, item) => total + item.disponibles,
      0
    );

    const porcentajeOcupacion =
      capacidadTotal > 0
        ? Math.round(
            (espaciosOcupados / capacidadTotal) * 100
          )
        : 0;

    const componentesActivos = inventario.filter(
      (registro) =>
        String(registro.estado ?? "Activo").toLowerCase() ===
        "activo"
    ).length;

    const ubicacionesOcupadas = ubicacionesProcesadas.filter(
      (item) => item.ocupados > 0
    ).length;

    return {
      ubicacionesProcesadas,
      capacidadTotal,
      espaciosOcupados,
      espaciosDisponibles,
      porcentajeOcupacion,
      componentesActivos,
      ubicacionesOcupadas,
      ubicacionesTotales: ubicacionesProcesadas.length,
    };

  }, [inventario, ubicaciones, ocupacion]);

  // ===========================================
  // ORGANIZAR DISTRIBUCIÓN POR ESTANTES
  // ===========================================

  const distribucion = useMemo(() => {

    return ["A", "B"].map((estante) => ({

      estante,

      pisos: [1, 2, 3, 4].map((piso) => ({

        piso,

        ubicaciones: resumen.ubicacionesProcesadas
          .filter(
            (item) =>
              item.estante === estante &&
              Number(item.piso) === piso
          )
          .sort(
            (a, b) => Number(a.columna) - Number(b.columna)
          ),

      })),

    }));

  }, [resumen.ubicacionesProcesadas]);

  // ===========================================
  // TARJETAS DE INDICADORES
  // ===========================================

  const indicadores = [

    {
      titulo: "Componentes registrados",
      descripcion: "Materiales asociados al inventario",
      valor: formatoNumero(resumen.componentesActivos),
      icono: Package,
      color: "blue",
    },

    {
      titulo: "Capacidad total",
      descripcion: "Espacios físicos organizados",
      valor: formatoNumero(resumen.capacidadTotal),
      icono: Warehouse,
      color: "green",
    },

    {
      titulo: "Ocupación",
      descripcion: `${formatoNumero(resumen.espaciosOcupados)} espacios utilizados`,
      valor: `${resumen.porcentajeOcupacion}%`,
      icono: ChartPie,
      color: "orange",
    },

    {
      titulo: "Espacios disponibles",
      descripcion: "Divisiones libres del almacén",
      valor: formatoNumero(resumen.espaciosDisponibles),
      icono: MapPin,
      color: "red",
    },

  ];

  // ===========================================
  // VISTA
  // ===========================================

  return (

    <div className="dashboard-page">

      {/* ENCABEZADO */}

      <div className="dashboard-heading">

        <div>

          <span className="dashboard-eyebrow">
            CONTROL OPERATIVO
          </span>

          <h1>Dashboard</h1>

          <p>
            Resumen general del almacén · Área de motores
          </p>

        </div>

        <button
          type="button"
          className="dashboard-refresh"
          onClick={() => setRecarga((valor) => valor + 1)}
          disabled={cargando}
          title="Actualizar información"
        >

          <RefreshCw
            size={17}
            className={cargando ? "dashboard-spinning" : ""}
          />

          Actualizar

        </button>

      </div>

      {/* MENSAJE DE ERROR */}

      {error && (

        <div className="dashboard-error">

          <AlertCircle size={18} />

          <span>{error}</span>

        </div>

      )}

      {/* INDICADORES GENERALES */}

      <section className="dashboard-stats">

        {indicadores.map((item) => {

          const Icono = item.icono;

          return (

            <article
              className="dashboard-stat-card"
              key={item.titulo}
            >

              <div className={`dashboard-stat-icon ${item.color}`}>

                <Icono size={21} />

              </div>

              <div className="dashboard-stat-info">

                <span>{item.titulo}</span>

                <strong>
                  {cargando ? "..." : item.valor}
                </strong>

                <small>{item.descripcion}</small>

              </div>

            </article>

          );

        })}

      </section>

      {/* DISTRIBUCIÓN Y OCUPACIÓN */}

      <section className="dashboard-main-grid">

        {/* DISTRIBUCIÓN FÍSICA */}

        <article className="dashboard-card dashboard-distribution">

          <div className="dashboard-card-heading">

            <div>

              <span className="dashboard-section-label">
                DISTRIBUCIÓN FÍSICA
              </span>

              <h2>Distribución del almacén</h2>

              <p>
                Consulta la organización de los estantes
                y sus ubicaciones.
              </p>

            </div>

            <div className="dashboard-heading-icon">

              <Warehouse size={21} />

            </div>

          </div>

          {cargando ? (

            <div className="dashboard-map-placeholder">
              <RefreshCw className="dashboard-spinning" size={30} />
              <strong>Cargando distribución...</strong>
            </div>

          ) : resumen.ubicacionesTotales === 0 ? (

            <div className="dashboard-map-placeholder">

              <Boxes size={38} />

              <strong>No hay ubicaciones disponibles</strong>

              <p>
                No se recibieron ubicaciones desde el servidor.
              </p>

            </div>

          ) : (

            <div className="dashboard-map">

              <div className="dashboard-map-legend">

                <span>
                  <i className="legend-dot occupied" />
                  Ocupado
                </span>

                <span>
                  <i className="legend-dot available" />
                  Disponible
                </span>

                <span>
                  {resumen.ubicacionesOcupadas} de{" "}
                  {resumen.ubicacionesTotales} ubicaciones utilizadas
                </span>

              </div>

              {distribucion.map((grupo) => (

                <div
                  className="dashboard-rack"
                  key={grupo.estante}
                >

                  <div className="dashboard-rack-heading">

                    <Warehouse size={18} />

                    <strong>
                      ESTANTE {grupo.estante}
                    </strong>

                  </div>

                  {grupo.pisos.map((nivel) => (

                    <div
                      className="dashboard-floor"
                      key={`${grupo.estante}-${nivel.piso}`}
                    >

                      <span className="dashboard-floor-label">
                        Piso {nivel.piso}
                      </span>

                      <div className="dashboard-location-grid">

                        {nivel.ubicaciones.map((ubicacion) => (

                          <div
                            className={`dashboard-location ${
                              ubicacion.ocupados > 0
                                ? "is-occupied"
                                : "is-available"
                            }`}
                            key={ubicacion.id}
                            title={`${ubicacion.id} | ${ubicacion.ocupados}/${ubicacion.capacidad} espacios ocupados`}
                          >

                            <strong>{ubicacion.id}</strong>

                            <small>
                              {ubicacion.ocupados}/
                              {ubicacion.capacidad}
                            </small>

                            <span>
                              {ubicacion.ocupados > 0
                                ? "En uso"
                                : "Libre"}
                            </span>

                          </div>

                        ))}

                      </div>

                    </div>

                  ))}

                </div>

              ))}

            </div>

          )}

        </article>

        {/* OCUPACIÓN */}

        <article className="dashboard-card dashboard-occupancy">

          <div className="dashboard-card-heading">

            <div>

              <span className="dashboard-section-label">
                CONTROL DE ESPACIOS
              </span>

              <h2>Ocupación del almacén</h2>

              <p>
                Resumen de los espacios utilizados y disponibles.
              </p>

            </div>

            <div className="dashboard-heading-icon orange">

              <ChartPie size={21} />

            </div>

          </div>

          <div className="dashboard-occupancy-content">

            <div className="dashboard-occupancy-chart">

              <div
                className="dashboard-donut"
                style={{
                  background: `conic-gradient(#dc171c ${
                    resumen.porcentajeOcupacion
                  }%, #e5e7eb ${
                    resumen.porcentajeOcupacion
                  }% 100%)`,
                }}
              >

                <div className="dashboard-donut-center">

                  <strong>
                    {cargando
                      ? "..."
                      : `${resumen.porcentajeOcupacion}%`}
                  </strong>

                </div>

              </div>

              <span>Ocupación</span>

            </div>

            <div className="dashboard-occupancy-legend">

              <div>

                <span className="legend-dot occupied" />

                <span>Ocupados</span>

                <strong>
                  {cargando
                    ? "..."
                    : formatoNumero(resumen.espaciosOcupados)}
                </strong>

              </div>

              <div>

                <span className="legend-dot available" />

                <span>Disponibles</span>

                <strong>
                  {cargando
                    ? "..."
                    : formatoNumero(resumen.espaciosDisponibles)}
                </strong>

              </div>

            </div>

          </div>

          <div className="dashboard-progress">

            <div>

              <span>Uso de la capacidad</span>

              <strong>
                {cargando
                  ? "Cargando..."
                  : `${resumen.porcentajeOcupacion}%`}
              </strong>

            </div>

            <div className="dashboard-progress-track">

              <div
                style={{
                  width: `${resumen.porcentajeOcupacion}%`,
                }}
              />

            </div>

          </div>

          <div className="dashboard-occupancy-footer">

            <CheckCircle2 size={15} />

            <span>
              {resumen.espaciosDisponibles > 0
                ? "El almacén tiene espacios disponibles."
                : "La capacidad del almacén está completa."}
            </span>

          </div>

        </article>

      </section>

    </div>

  );

}

export default DashboardPage;
