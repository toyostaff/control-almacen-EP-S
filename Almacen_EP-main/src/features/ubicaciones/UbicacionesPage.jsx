import { useEffect, useMemo, useRef, useState } from "react";

import {
  Warehouse,
  Package,
  PackageOpen,
  Search,
  X,
  MapPinned,
  Layers3,
  CheckCircle2,
  CircleDot,
  ArrowUpRight,
  Wrench,
} from "lucide-react";

import { ubicacionesAlmacen, estantesAlmacen } from "../../data/ubicaciones";

import { obtenerInventario } from "../../services/inventarioService";

import VoiceAssistant from "../../components/voice/VoiceAssistant";

// =====================================================

// NORMALIZAR BÚSQUEDAS

// =====================================================

function normalizar(texto) {
  return (texto || "")

    .toString()

    .normalize("NFD")

    .replace(/[\u0300-\u036f]/g, "")

    .toLowerCase()

    .trim();
}

// =====================================================

// COMPONENTE PRINCIPAL

// =====================================================

function UbicacionesPage() {
  const [inventario, setInventario] = useState([]);

  const [cargandoInventario, setCargandoInventario] = useState(true);

  const [errorInventario, setErrorInventario] = useState("");

  const [ubicacionSeleccionada, setUbicacionSeleccionada] = useState(null);

  const [busqueda, setBusqueda] = useState("");

  const [fotoAmpliada, setFotoAmpliada] = useState(null);

  // Ubicación y división que se deben localizar

  const [ubicacionResaltada, setUbicacionResaltada] = useState(null);

  const [subdivisionResaltada, setSubdivisionResaltada] = useState(null);

  // Referencias de las jabas físicas

  const ubicacionesRefs = useRef({});

  // ===================================================

  // CARGAR INVENTARIO

  // ===================================================

  // Cargar inventario centralizado desde Railway.

  // La vista se actualiza al entrar, al volver a la pestaña y cada 15 segundos.

  useEffect(() => {
    let activo = true;

    let cargando = false;

    async function cargarInventario() {
      if (cargando) return;

      cargando = true;

      try {
        const datos = await obtenerInventario();

        if (activo) {
          setInventario(Array.isArray(datos) ? datos : []);

          setErrorInventario("");
        }
      } catch (error) {
        if (activo) {
          setErrorInventario(
            error.message || "No se pudo cargar el inventario del servidor.",
          );
        }
      } finally {
        cargando = false;

        if (activo) setCargandoInventario(false);
      }
    }

    function alVolverAPestana() {
      if (document.visibilityState === "visible") cargarInventario();
    }

    cargarInventario();

    const intervalo = window.setInterval(cargarInventario, 15000);

    window.addEventListener("focus", cargarInventario);

    document.addEventListener("visibilitychange", alVolverAPestana);

    return () => {
      activo = false;

      window.clearInterval(intervalo);

      window.removeEventListener("focus", cargarInventario);

      document.removeEventListener("visibilitychange", alVolverAPestana);
    };
  }, []);

  // ===================================================

  // AGRUPAR MATERIALES POR UBICACIÓN

  // ===================================================

  const ubicacionesConDatos = useMemo(() => {
    return ubicacionesAlmacen.map((ubicacion) => {
      const registros = inventario.filter(
        (registro) =>
          registro.ubicacion === ubicacion.nombre &&
          registro.estado === "Activo",
      );

      const subdivisiones = (ubicacion.subdivisiones || []).map((division) => {
        const registrosDivision = registros.filter(
          (registro) => registro.subdivision === division.id,
        );

        return {
          ...division,

          registros: registrosDivision,

          ocupada: registrosDivision.length > 0,
        };
      });

      return {
        ...ubicacion,

        registros,

        subdivisionesConDatos: subdivisiones,

        cantidadRegistros: registros.length,

        cantidadDivisionesOcupadas: subdivisiones.filter(
          (division) => division.ocupada,
        ).length,
      };
    });
  }, [inventario]);

  // ===================================================

  // BUSCADOR GENERAL

  // ===================================================

  const resultadosBusqueda = useMemo(() => {
    const termino = normalizar(busqueda);

    if (!termino) return [];

    const resultados = inventario.filter((registro) => {
      if (registro.estado !== "Activo") return false;

      const campos = [
        registro.descripcion,

        registro.sku,

        registro.codigo,

        registro.codigoReemplazo,

        registro.ubicacion,

        registro.subdivision,
      ];

      return campos.some((campo) => normalizar(campo).includes(termino));
    });

    return resultados.sort((a, b) => {
      const camposA = [a.descripcion, a.sku, a.codigo, a.codigoReemplazo];

      const camposB = [b.descripcion, b.sku, b.codigo, b.codigoReemplazo];

      const prioridadA = camposA.some((campo) =>
        normalizar(campo).startsWith(termino),
      )
        ? 0
        : 1;

      const prioridadB = camposB.some((campo) =>
        normalizar(campo).startsWith(termino),
      )
        ? 0
        : 1;

      return prioridadA - prioridadB;
    });
  }, [inventario, busqueda]);

  // ===================================================

  // UBICACIONES ENCONTRADAS

  // ===================================================

  const ubicacionesEncontradas = useMemo(() => {
    return new Set(resultadosBusqueda.map((registro) => registro.ubicacion));
  }, [resultadosBusqueda]);

  // ===================================================

  // DIVISIONES ENCONTRADAS

  // ===================================================

  const subdivisionesEncontradas = useMemo(() => {
    return new Set(
      resultadosBusqueda

        .filter((registro) => registro.subdivision)

        .map((registro) => `${registro.ubicacion}|${registro.subdivision}`),
    );
  }, [resultadosBusqueda]);

  // ===================================================

  // INDICADORES

  // ===================================================

  const ubicacionesOcupadas = ubicacionesConDatos.filter(
    (ubicacion) => ubicacion.cantidadRegistros > 0,
  ).length;

  const ubicacionesDisponibles =
    ubicacionesConDatos.length - ubicacionesOcupadas;

  const totalComponentes = inventario.filter(
    (registro) => registro.estado === "Activo",
  ).length;

  const porcentajeOcupacion =
    ubicacionesConDatos.length > 0
      ? Math.round((ubicacionesOcupadas / ubicacionesConDatos.length) * 100)
      : 0;

  // ===================================================

  // OBTENER UBICACIÓN

  // ===================================================

  function obtenerUbicacion(nombre) {
    return ubicacionesConDatos.find((ubicacion) => ubicacion.nombre === nombre);
  }

  // ===================================================

  // LOCALIZAR REPUESTO EN LOS ESTANTES

  // ===================================================

  function localizarRepuesto(registro) {
    if (!registro?.ubicacion) return;

    const ubicacion = obtenerUbicacion(registro.ubicacion);

    if (!ubicacion) return;

    setUbicacionResaltada(registro.ubicacion);

    setSubdivisionResaltada(registro.subdivision || null);

    // Cerrar cualquier detalle abierto

    setUbicacionSeleccionada(null);

    // Mantener el resultado seleccionado mientras se localiza.
    // La ubicación se desplazará automáticamente mediante useEffect.
  }

  // ===================================================

  // RESULTADO DEL ASISTENTE DE VOZ

  // ===================================================

  function manejarResultadoVoz(resultado) {
    if (resultado?.encontrado && resultado.registro) {
      // Localizar automáticamente el repuesto encontrado.

      localizarRepuesto(resultado.registro);

      return;
    }

    // Limpiar resaltados anteriores si no se encuentra.

    setUbicacionResaltada(null);

    setSubdivisionResaltada(null);

    setUbicacionSeleccionada(null);
  }

  // ===================================================

  // DESPLAZAMIENTO AUTOMÁTICO HACIA LA JABA

  // ===================================================

  useEffect(() => {
    if (!ubicacionResaltada) return;

    const temporizador = setTimeout(() => {
      const elemento = ubicacionesRefs.current[ubicacionResaltada];

      if (elemento) {
        elemento.scrollIntoView({
          behavior: "smooth",

          block: "center",

          inline: "center",
        });
      }
    }, 150);

    return () => clearTimeout(temporizador);
  }, [ubicacionResaltada]);

  // ===================================================

  // ABRIR Y CERRAR JABA

  // ===================================================

  function abrirUbicacion(ubicacion) {
    if (!ubicacion) return;

    setUbicacionSeleccionada(obtenerUbicacion(ubicacion.nombre));
  }

  function cerrarUbicacion() {
    setUbicacionSeleccionada(null);
  }

  // ===================================================

  // DISTRIBUCIÓN DE LOS PISOS

  // ===================================================

  function obtenerPiso(estante, piso) {
    return ubicacionesConDatos

      .filter(
        (ubicacion) => ubicacion.estante === estante && ubicacion.piso === piso,
      )

      .sort((a, b) => a.columna - b.columna);
  }

  // ===================================================

  // INTERFAZ

  // ===================================================

  return (
    <section className="ubicaciones-page">
      {errorInventario && (
        <div className="form-error" role="alert">
          {errorInventario}

          <button type="button" onClick={() => window.location.reload()}>
            Reintentar
          </button>
        </div>
      )}

      {cargandoInventario && (
        <div className="warehouse-search-feedback" role="status">
          Cargando inventario desde el servidor...
        </div>
      )}

      {/* ENCABEZADO */}

      <div className="page-heading locations-page-heading">
        <div>
          <span className="page-eyebrow">DISTRIBUCIÓN FÍSICA</span>

          <h1>Ubicaciones</h1>

          <p>
            Visualiza y localiza el repuesto dentro de las estanterías del área
            de motores
          </p>
        </div>
      </div>

      {/* BUSCADOR GENERAL */}

      <div className="warehouse-global-search">
        <div className="warehouse-global-search-input">
          <Search size={19} />

          <input
            type="search"
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
            placeholder="Buscar repuesto, SKU o código..."
          />

          {busqueda && (
            <button
              type="button"
              onClick={() => {
                setBusqueda("");

                setUbicacionResaltada(null);

                setSubdivisionResaltada(null);
              }}
              aria-label="Limpiar búsqueda"
            >
              <X size={19} />
            </button>
          )}

          <VoiceAssistant onResultado={manejarResultadoVoz} />
        </div>

        {/* RESULTADOS */}

        {busqueda && (
          <div className="warehouse-search-feedback">
            {resultadosBusqueda.length > 0 ? (
              <>
                <CheckCircle2 size={18} />

                <span>
                  {resultadosBusqueda.length} resultado(s) encontrado(s).
                  Selecciona un repuesto para localizarlo en el almacén.
                </span>
              </>
            ) : (
              <>
                <Search size={18} />

                <span>No se encontraron componentes con «{busqueda}».</span>
              </>
            )}
          </div>
        )}

        {busqueda && resultadosBusqueda.length > 0 && (
          <div className="warehouse-search-results">
            {resultadosBusqueda.map((registro) => (
              <button
                type="button"
                key={registro.id}
                className={
                  ubicacionResaltada === registro.ubicacion &&
                  subdivisionResaltada === (registro.subdivision || null)
                    ? "search-result-selected"
                    : ""
                }
                onClick={() => localizarRepuesto(registro)}
              >
                <div className="warehouse-search-result-info">
                  <strong>{registro.descripcion}</strong>

                  <small>
                    {registro.sku || "Sin SKU"}

                    {" · "}

                    {registro.codigo || "Sin código"}
                  </small>
                </div>

                <span className="warehouse-search-result-location">
                  {registro.ubicacion}

                  {registro.subdivision ? ` · ${registro.subdivision}` : ""}
                </span>

                <ArrowUpRight size={17} />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* INDICADORES */}

      <div className="locations-summary">
        <article className="location-stat-card">
          <div className="location-stat-icon neutral">
            <Layers3 size={21} />
          </div>

          <div>
            <span>Ubicaciones totales</span>

            <strong>{ubicacionesConDatos.length}</strong>

            <small>Espacios organizados</small>
          </div>
        </article>

        <article className="location-stat-card">
          <div className="location-stat-icon occupied">
            <PackageOpen size={21} />
          </div>

          <div>
            <span>Ocupadas</span>

            <strong>{ubicacionesOcupadas}</strong>

            <small>Con componentes registrados</small>
          </div>
        </article>

        <article className="location-stat-card">
          <div className="location-stat-icon available">
            <CheckCircle2 size={21} />
          </div>

          <div>
            <span>Disponibles</span>

            <strong>{ubicacionesDisponibles}</strong>

            <small>Espacios libres</small>
          </div>
        </article>

        <article className="location-stat-card">
          <div className="location-stat-icon components">
            <Package size={21} />
          </div>

          <div>
            <span>Componentes</span>

            <strong>{totalComponentes}</strong>

            <small>Registros activos</small>
          </div>
        </article>
      </div>

      {/* DISTRIBUCIÓN DEL ALMACÉN */}

      <div className="warehouse-visual-card">
        <div className="warehouse-visual-header">
          <div>
            <span className="page-eyebrow">VISTA GENERAL</span>

            <h2>Distribución del almacén</h2>

            <p>
              Selecciona un compartimento para consultar sus componentes y
              divisiones.
            </p>
          </div>

          <div className="warehouse-capacity">
            <div className="warehouse-capacity-top">
              <span>Ocupación</span>

              <strong>{porcentajeOcupacion}%</strong>
            </div>

            <div className="warehouse-progress">
              <div
                style={{
                  width: `${porcentajeOcupacion}%`,
                }}
              />
            </div>

            <small>
              {ubicacionesOcupadas} de {ubicacionesConDatos.length} jabas
              ocupadas
            </small>
          </div>
        </div>

        {/* LEYENDA */}

        <div className="warehouse-legend">
          <div>
            <span className="legend-square occupied" />

            <span>Ocupado</span>
          </div>

          <div>
            <span className="legend-square available" />

            <span>Disponible</span>
          </div>

          <div>
            <span className="legend-square found" />

            <span>Resultado de búsqueda</span>
          </div>

          <span className="warehouse-legend-note">
            Haz clic en una jaba para ver su contenido.
          </span>
        </div>

        {/* ESTANTES */}

        <div className="warehouse-realistic-layout">
          {estantesAlmacen.map((estante) => {
            const ubicacionesEstante = ubicacionesConDatos.filter(
              (ubicacion) => ubicacion.estante === estante.codigo,
            );

            const ocupadasEstante = ubicacionesEstante.filter(
              (ubicacion) => ubicacion.cantidadRegistros > 0,
            ).length;

            return (
              <article className="warehouse-rack" key={estante.codigo}>
                {/* IDENTIFICACIÓN DEL ESTANTE */}

                <div className="rack-identification">
                  <div className="rack-identification-icon">
                    <Warehouse size={22} />
                  </div>

                  <div className="rack-identification-info">
                    <span>ESTRUCTURA DE ALMACENAMIENTO</span>

                    <h3>{estante.nombre}</h3>

                    <small>4 pisos · 3 columnas</small>
                  </div>

                  <div className="rack-identification-count">
                    <strong>{ocupadasEstante}/12</strong>

                    <span>Ocupadas</span>
                  </div>
                </div>

                {/* ESTRUCTURA METÁLICA */}

                <div className="rack-frame">
                  <div className="rack-top-beam">
                    <span />

                    <span />

                    <span />
                  </div>

                  <div className="rack-levels">
                    {[4, 3, 2, 1].map((piso) => {
                      const ubicacionesPiso = obtenerPiso(estante.codigo, piso);

                      return (
                        <div className="rack-level" key={piso}>
                          <div className="rack-level-label">
                            <strong>{String(piso).padStart(2, "0")}</strong>

                            <span>PISO</span>
                          </div>

                          <div className="rack-level-content">
                            {ubicacionesPiso.map((ubicacion) => {
                              const ocupada = ubicacion.cantidadRegistros > 0;

                              const encontrada = ubicacionesEncontradas.has(
                                ubicacion.nombre,
                              );

                              const seleccionada =
                                ubicacionSeleccionada?.id === ubicacion.id;

                              const esDestino =
                                ubicacionResaltada === ubicacion.nombre;

                              const divisionDestino = esDestino
                                ? subdivisionResaltada
                                : null;

                              const nombresMateriales = ubicacion.registros

                                .map((registro) => registro.descripcion)

                                .filter(Boolean)

                                .join(", ");

                              return (
                                <button
                                  type="button"
                                  key={ubicacion.id}
                                  ref={(elemento) => {
                                    if (elemento) {
                                      ubicacionesRefs.current[
                                        ubicacion.nombre
                                      ] = elemento;
                                    } else {
                                      delete ubicacionesRefs.current[
                                        ubicacion.nombre
                                      ];
                                    }
                                  }}
                                  className={[
                                    "rack-bin",

                                    ocupada ? "occupied" : "available",

                                    encontrada ? "location-found" : "",

                                    seleccionada ? "selected" : "",

                                    esDestino ? "location-target-pulse" : "",
                                  ]

                                    .filter(Boolean)

                                    .join(" ")}
                                  onClick={() => abrirUbicacion(ubicacion)}
                                  aria-label={`Abrir ${ubicacion.nombre}`}
                                >
                                  <div className="rack-bin-interior">
                                    <div className="rack-bin-icon">
                                      {esDestino ? (
                                        <Wrench size={25} strokeWidth={2.5} />
                                      ) : ocupada ? (
                                        <PackageOpen size={24} />
                                      ) : (
                                        <Package size={24} />
                                      )}
                                    </div>

                                    <strong>{ubicacion.nombre}</strong>

                                    <span className="rack-bin-material-name">
                                      {ocupada
                                        ? nombresMateriales
                                        : "Disponible"}
                                    </span>

                                    {ubicacion.tieneSubdivisiones && (
                                      <small className="rack-bin-division-count">
                                        {ubicacion.cantidadDivisionesOcupadas}/6{" "}
                                        divisiones
                                      </small>
                                    )}

                                    {/* DIVISIÓN EXACTA ENCONTRADA */}

                                    {divisionDestino && (
                                      <span className="rack-bin-target-division">
                                        <MapPinned size={12} />

                                        {divisionDestino}
                                      </span>
                                    )}
                                  </div>

                                  <div className="rack-bin-bottom" />
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="rack-bottom-beam" />

                  <div className="rack-feet">
                    <span />

                    <span />
                  </div>
                </div>

                {/* BASE DEL ESTANTE */}

                <div className="rack-base">
                  <span />

                  <strong>{estante.codigo}</strong>

                  <span />
                </div>
              </article>
            );
          })}
        </div>

        <div className="warehouse-visual-footer">
          <MapPinned size={17} />

          <span>
            Cada jaba tiene un código único para facilitar la identificación
            física.
          </span>
        </div>
      </div>

      {/* MODAL DE LA JABA */}

      {ubicacionSeleccionada && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              cerrarUbicacion();
            }
          }}
        >
          <div
            className="modal-card location-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="location-modal-title"
          >
            {/* CABECERA */}

            <div className="modal-header">
              <div>
                <span className="page-eyebrow">
                  ESTANTE {ubicacionSeleccionada.estante}
                  {" · "}
                  PISO {String(ubicacionSeleccionada.piso).padStart(2, "0")}
                  {" · "}
                  COLUMNA {ubicacionSeleccionada.columna}
                </span>

                <h2 id="location-modal-title">
                  {ubicacionSeleccionada.nombre}
                </h2>

                <p>Componentes y distribución interna del compartimento.</p>
              </div>

              <button
                type="button"
                className="modal-close"
                onClick={cerrarUbicacion}
                aria-label="Cerrar"
              >
                <X size={20} />
              </button>
            </div>

            {/* ESTADO DE LA JABA */}

            <div className="location-modal-status">
              {ubicacionSeleccionada.cantidadRegistros > 0 ? (
                <>
                  <CircleDot size={17} />

                  <span>
                    Ubicación ocupada ·{" "}
                    {ubicacionSeleccionada.cantidadRegistros} componente(s)
                  </span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={17} />

                  <span>Ubicación disponible</span>
                </>
              )}
            </div>

            {/* DIVISIONES INTERNAS */}

            {ubicacionSeleccionada.tieneSubdivisiones && (
              <div className="location-divisions-section">
                <div className="location-divisions-heading">
                  <div>
                    <h3>Distribución interna</h3>

                    <p>Organización de la jaba · 3 columnas × 2 filas</p>
                  </div>

                  <span>
                    {ubicacionSeleccionada.cantidadDivisionesOcupadas}/6{" "}
                    ocupadas
                  </span>
                </div>

                <div className="location-divisions">
                  {ubicacionSeleccionada.subdivisionesConDatos.map(
                    (division) => {
                      const registros = division.registros;

                      const encontrada =
                        subdivisionResaltada === division.id &&
                        ubicacionResaltada === ubicacionSeleccionada.nombre;

                      return (
                        <div
                          key={division.id}
                          className={[
                            "location-division",

                            division.ocupada
                              ? "division-occupied"
                              : "division-available",

                            encontrada ? "division-found" : "",
                          ]

                            .filter(Boolean)

                            .join(" ")}
                        >
                          <span className="division-icon">
                            {encontrada ? (
                              <Wrench size={23} strokeWidth={2.5} />
                            ) : division.ocupada ? (
                              <PackageOpen size={21} />
                            ) : (
                              <Package size={21} />
                            )}
                          </span>

                          <strong>{division.id}</strong>

                          {registros.length > 0 ? (
                            <div className="division-materials">
                              {registros.map((registro) => (
                                <span key={registro.id}>
                                  {registro.descripcion}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <small>Disponible</small>
                          )}
                        </div>
                      );
                    },
                  )}
                </div>

                {ubicacionSeleccionada.registros.some(
                  (registro) => !registro.subdivision,
                ) && (
                  <p className="division-unassigned-warning">
                    Hay componentes sin división asignada. Edita su asociación
                    en Inventario para ubicarlos correctamente.
                  </p>
                )}
              </div>
            )}

            {/* LISTADO DE COMPONENTES */}

            <div className="location-products-section">
              <div className="location-products-heading">
                <div>
                  <h3>Componentes almacenados</h3>

                  <p>Repuestos registrados en esta ubicación.</p>
                </div>

                <span>
                  {ubicacionSeleccionada.cantidadRegistros} componentes
                </span>
              </div>

              <div className="location-material-list">
                {ubicacionSeleccionada.registros.length > 0 ? (
                  ubicacionSeleccionada.registros.map((registro) => (
                    <article
                      className="location-material-card"
                      key={registro.id}
                    >
                      {registro.foto ? (
                        <button
                          type="button"
                          className="location-material-photo"
                          onClick={() =>
                            setFotoAmpliada({
                              src: registro.foto,

                              nombre: registro.descripcion,
                            })
                          }
                          aria-label={`Ampliar fotografía de ${registro.descripcion}`}
                        >
                          <img src={registro.foto} alt={registro.descripcion} />

                          <span>
                            <Search size={15} />
                          </span>
                        </button>
                      ) : (
                        <div className="location-material-symbol">
                          <PackageOpen size={22} />
                        </div>
                      )}

                      <div className="location-material-main">
                        <strong className="location-product-name">
                          {registro.descripcion}
                        </strong>

                        {registro.codigo && (
                          <small>
                            Código: <strong>{registro.codigo}</strong>
                          </small>
                        )}

                        {registro.codigoReemplazo && (
                          <small>
                            Código de reemplazo:{" "}
                            <strong>{registro.codigoReemplazo}</strong>
                          </small>
                        )}

                        {registro.subdivision && (
                          <div className="location-product-exact">
                            <span>DIVISIÓN EXACTA</span>

                            <strong>{registro.subdivision}</strong>
                          </div>
                        )}

                        {registro.observacion && (
                          <small>Observación: {registro.observacion}</small>
                        )}
                      </div>

                      <span className="status-badge status-active">Activo</span>
                    </article>
                  ))
                ) : (
                  <div className="location-empty">
                    <Package size={38} />

                    <strong>Compartimento disponible</strong>

                    <span>
                      Todavía no hay componentes registrados en{" "}
                      {ubicacionSeleccionada.nombre}.
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* ACCIONES */}

            <div className="modal-actions">
              <button
                type="button"
                className="button button-secondary"
                onClick={cerrarUbicacion}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VISUALIZADOR DE FOTOGRAFÁA */}

      {fotoAmpliada && (
        <div
          className="location-photo-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setFotoAmpliada(null);
            }
          }}
        >
          <div
            className="location-photo-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Fotografía del repuesto"
          >
            <div className="location-photo-header">
              <div>
                <strong>{fotoAmpliada.nombre}</strong>

                <small>Fotografía del componente</small>
              </div>

              <button
                type="button"
                onClick={() => setFotoAmpliada(null)}
                aria-label="Cerrar fotografía"
              >
                <X size={21} />
              </button>
            </div>

            <div className="location-photo-view">
              <img src={fotoAmpliada.src} alt={fotoAmpliada.nombre} />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default UbicacionesPage;
