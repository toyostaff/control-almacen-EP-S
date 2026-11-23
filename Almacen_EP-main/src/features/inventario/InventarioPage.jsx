import { useEffect, useMemo, useRef, useState } from "react";

import {
  Boxes,
  Camera,
  Image as ImageIcon,
  Trash2,
  Plus,
  Search,
  Pencil,
  Power,
  X,
  Check,
  Barcode,
  ChevronDown,
  MapPin,
} from "lucide-react";

import { obtenerCatalogo } from "../../services/catalogoService";

import {
  obtenerInventario,
  crearRegistroInventario,
  editarRegistroInventario,
  cambiarEstadoRegistro,
} from "../../services/inventarioService";

import { obtenerUbicaciones } from "../../services/ubicacionesService";

const formularioInicial = {
  skuId: "",
  sku: "",
  descripcion: "",
  tieneCodigo: false,
  codigo: "",
  codigoReemplazo: "",
  ubicacion: "",
  subdivision: "",
  observacion: "",
  foto: "",
};

function normalizarTexto(texto) {
  return (texto || "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function InventarioPage() {
  // ==========================================
  // ESTADOS DEL COMPONENTE
  // ==========================================

  const [inventario, setInventario] = useState([]);
  const [catalogo, setCatalogo] = useState([]);
  const [ubicaciones, setUbicaciones] = useState([]);

  const [formulario, setFormulario] = useState({ ...formularioInicial });
  const [busqueda, setBusqueda] = useState("");
  const [busquedaMaterial, setBusquedaMaterial] = useState("");

  const [mostrarResultados, setMostrarResultados] = useState(false);
  const [ubicacionMenuAbierto, setUbicacionMenuAbierto] = useState(false);
  const [subdivisionMenuAbierto, setSubdivisionMenuAbierto] = useState(false);

  const [error, setError] = useState("");
  const [modalAbierto, setModalAbierto] = useState(false);
  const [registroEditando, setRegistroEditando] = useState(null);

  const galeriaInputRef = useRef(null);
  const camaraInputRef = useRef(null);

  // ==========================================
  // CARGA DE DATOS
  // ==========================================

  async function cargarDatos() {
  try {
    const [registros, materiales, espacios] = await Promise.all([
      obtenerInventario(),
      obtenerCatalogo(),
      obtenerUbicaciones(),
    ]);

    const listaInventario = Array.isArray(registros)
      ? registros
      : Array.isArray(registros?.data)
        ? registros.data
        : [];

    const listaCatalogo = Array.isArray(materiales)
      ? materiales
      : Array.isArray(materiales?.data)
        ? materiales.data
        : [];

    const listaUbicaciones = Array.isArray(espacios)
      ? espacios
      : Array.isArray(espacios?.data)
        ? espacios.data
        : [];

    setInventario(listaInventario);

    setCatalogo(
      listaCatalogo.filter(
        (material) => material.estado === "Activo"
      )
    );

    const ubicacionesNormalizadas = listaUbicaciones.map(
      (ubicacion) => ({
        ...ubicacion,

        id: String(ubicacion.id),

        nombre: String(
          ubicacion.nombre ?? ubicacion.id
        ),

        tieneSubdivisiones:
          ubicacion.tieneSubdivisiones === true ||
          ubicacion.tieneSubdivisiones === 1 ||
          ubicacion.tieneSubdivisiones === "1",

        subdivisiones: (
          Array.isArray(ubicacion.subdivisiones)
            ? ubicacion.subdivisiones
            : []
        ).map((division) => ({
          ...division,
          id: String(division.id ?? division.codigo),
        })),
      })
    );

    setUbicaciones(ubicacionesNormalizadas);

    console.log(
      "Ubicaciones cargadas:",
      ubicacionesNormalizadas.length
    );

  } catch (err) {
    console.error("Error cargando inventario:", err);

    setError(
      err.message ||
      "No se pudieron cargar los datos del almacén."
    );
  }
}


  useEffect(() => {
    cargarDatos();
  }, []);

  // BUSCADOR DE INVENTARIO
  const inventarioFiltrado = useMemo(() => {
    const termino = normalizarTexto(busqueda);

    if (!termino) return inventario;

    return inventario.filter((registro) =>
      [
        registro.sku,
        registro.descripcion,
        registro.codigo,
        registro.codigoReemplazo,
        registro.ubicacion,
        registro.subdivision,
      ].some((valor) => normalizarTexto(valor).includes(termino)),
    );
  }, [inventario, busqueda]);

  // BUSCADOR DE MATERIALES
  const materialesFiltrados = useMemo(() => {
    const termino = normalizarTexto(busquedaMaterial);

    if (!termino) return [];

    return catalogo
      .filter((material) => {
        const descripcion = normalizarTexto(material.descripcion);
        const sku = normalizarTexto(material.sku);

        return descripcion.startsWith(termino) || sku.startsWith(termino);
      })
      .sort((a, b) =>
        normalizarTexto(a.descripcion).localeCompare(
          normalizarTexto(b.descripcion),
          "es",
        ),
      )
      .slice(0, 8);
  }, [catalogo, busquedaMaterial]);

  const totalActivos = inventario.filter(
    (registro) => registro.estado === "Activo",
  ).length;

  const totalInactivos = inventario.filter(
    (registro) => registro.estado === "Inactivo",
  ).length;

  const ubicacionFormulario = ubicaciones.find(
    (ubicacion) => String(ubicacion.id) === String(formulario.ubicacion),
  );

  // ==========================================
  // CONTROL DE CAPACIDAD DE UBICACIONES
  // ==========================================

  function obtenerRegistrosOcupantes(ubicacion) {
    if (!ubicacion) return [];

    return inventario.filter(
      (registro) =>
        registro.estado === "Activo" &&
        String(registro.ubicacion) === String(ubicacion.id) &&
        String(registro.id) !== String(registroEditando?.id ?? ""),
    );
  }

  function obtenerCapacidadUbicacion(ubicacion) {
    const registros = obtenerRegistrosOcupantes(ubicacion);

    const capacidad = ubicacion.tieneSubdivisiones
      ? ubicacion.subdivisiones?.length || 0
      : 1;

    // Contar espacios internos ocupados, no solamente filas de inventario.
    const ocupados = ubicacion.tieneSubdivisiones
      ? new Set(
          registros
            .map((registro) => String(registro.subdivision || ""))
            .filter(Boolean),
        ).size
      : registros.length > 0
        ? 1
        : 0;

    const disponibles = Math.max(0, capacidad - ocupados);
    const porcentaje =
      capacidad > 0
        ? Math.min(100, Math.round((ocupados / capacidad) * 100))
        : 100;

    return {
      capacidad,
      ocupados,
      disponibles,
      porcentaje,
      completa: capacidad === 0 || disponibles === 0,
    };
  }

  function divisionEstaOcupada(ubicacion, divisionId) {
    if (!ubicacion) return false;

    return inventario.some(
      (registro) =>
        registro.estado === "Activo" &&
        String(registro.ubicacion) === String(ubicacion.id) &&
        String(registro.subdivision || "") === String(divisionId) &&
        String(registro.id) !== String(registroEditando?.id ?? ""),
    );
  }

  // ==========================================
  // APERTURA Y CIERRE DE MODALES
  // ==========================================

  function abrirNuevoRegistro() {
    setRegistroEditando(null);
    setFormulario({ ...formularioInicial });

    setBusquedaMaterial("");
    setMostrarResultados(false);
    setUbicacionMenuAbierto(false);
    setSubdivisionMenuAbierto(false);
    setError("");

    setModalAbierto(true);
  }

  function abrirEdicion(registro) {
    const tieneCodigo = Boolean(registro.codigo?.trim());

    setRegistroEditando(registro);

    setFormulario({
      skuId: registro.skuId,
      sku: registro.sku,
      descripcion: registro.descripcion,
      tieneCodigo,
      codigo: registro.codigo || "",
      codigoReemplazo: tieneCodigo ? registro.codigoReemplazo || "" : "",
      ubicacion: registro.ubicacion,
      subdivision: registro.subdivision || "",
      observacion: registro.observacion || "",
      foto: registro.foto || "",
    });

    setBusquedaMaterial(registro.descripcion);
    setMostrarResultados(false);
    setUbicacionMenuAbierto(false);
    setSubdivisionMenuAbierto(false);
    setError("");

    setModalAbierto(true);
  }

  function cerrarModal() {
    setModalAbierto(false);
    setRegistroEditando(null);
    setFormulario({ ...formularioInicial });

    setBusquedaMaterial("");
    setMostrarResultados(false);
    setUbicacionMenuAbierto(false);
    setSubdivisionMenuAbierto(false);
    setError("");

    if (galeriaInputRef.current) {
      galeriaInputRef.current.value = "";
    }

    if (camaraInputRef.current) {
      camaraInputRef.current.value = "";
    }
  }

  // ==========================================
  // ACTUALIZACIÓN DE CAMPOS
  // ==========================================

  function actualizarCampo(event) {
    const { name, value } = event.target;

    setFormulario((actual) => ({
      ...actual,
      [name]: value,
      ...(name === "ubicacion" ? { subdivision: "" } : {}),
    }));

    setError("");
  }

  function cambiarTieneCodigo(valor) {
    setFormulario((actual) => ({
      ...actual,
      tieneCodigo: valor,
      codigo: valor ? actual.codigo : "",
      codigoReemplazo: valor ? actual.codigoReemplazo : "",
    }));

    setError("");
  }

  // ==========================================
  // SELECCIÓN DE MATERIAL
  // ==========================================

  function seleccionarMaterial(material) {
    setFormulario((actual) => ({
      ...actual,
      skuId: material.id,
      sku: material.sku,
      descripcion: material.descripcion,
    }));

    setBusquedaMaterial(material.descripcion);
    setMostrarResultados(false);
    setError("");
  }

  function cambiarBusquedaMaterial(event) {
    const valor = event.target.value;

    setBusquedaMaterial(valor);
    setMostrarResultados(true);

    setFormulario((actual) => ({
      ...actual,
      skuId: "",
      sku: "",
      descripcion: "",
    }));
  }

  // ==========================================
  // SELECCIÓN DE UBICACIONES
  // ==========================================

  function seleccionarUbicacion(ubicacion) {
    const capacidad = obtenerCapacidadUbicacion(ubicacion);

    if (capacidad.completa) {
      setError("Esta ubicación está completa. Selecciona otra.");
      return;
    }

    setFormulario((actual) => ({
      ...actual,
      ubicacion: String(ubicacion.id),
      subdivision: "",
    }));

    setUbicacionMenuAbierto(false);
    setSubdivisionMenuAbierto(false);
    setError("");
  }

  function seleccionarSubdivision(division) {
    if (divisionEstaOcupada(ubicacionFormulario, division.id)) {
      setError("Esta división ya está ocupada. Selecciona otra.");
      return;
    }

    setFormulario((actual) => ({
      ...actual,
      subdivision: division.id,
    }));

    setSubdivisionMenuAbierto(false);
    setError("");
  }

  // ==========================================
  // FOTOGRAFÍAS
  // ==========================================

  function cambiarFotografia(event) {
    const archivo = event.target.files?.[0];

    if (!archivo) return;

    const formatosPermitidos = ["image/jpeg", "image/png", "image/webp"];

    if (!formatosPermitidos.includes(archivo.type)) {
      setError("Selecciona una imagen JPG, PNG o WEBP.");
      event.target.value = "";
      return;
    }

    if (archivo.size > 2 * 1024 * 1024) {
      setError("La fotografía no debe superar los 2 MB.");
      event.target.value = "";
      return;
    }

    const lector = new FileReader();

    lector.onload = () => {
      setFormulario((actual) => ({
        ...actual,
        foto: lector.result,
      }));

      setError("");
    };

    lector.onerror = () => {
      setError("No se pudo leer la fotografía.");
    };

    lector.readAsDataURL(archivo);
    event.target.value = "";
  }

  function eliminarFotografia() {
    setFormulario((actual) => ({
      ...actual,
      foto: "",
    }));

    if (galeriaInputRef.current) {
      galeriaInputRef.current.value = "";
    }

    if (camaraInputRef.current) {
      camaraInputRef.current.value = "";
    }
  }

  // ==========================================
  // VALIDACIÓN Y GUARDADO
  // ==========================================

  async function guardarRegistro(event) {
    event.preventDefault();
    setError("");

    try {
      if (!formulario.skuId) {
        throw new Error("Debes seleccionar un material del Catálogo Maestro.");
      }

      if (!formulario.ubicacion) {
        throw new Error("Debes seleccionar una ubicación.");
      }

      const ubicacionSeleccionada = ubicaciones.find(
        (ubicacion) => String(ubicacion.id) === String(formulario.ubicacion),
      );

      if (!ubicacionSeleccionada) {
        throw new Error("La ubicación seleccionada no existe.");
      }

      // VALIDAR CAPACIDAD
      const capacidad = obtenerCapacidadUbicacion(ubicacionSeleccionada);

      if (capacidad.completa) {
        throw new Error("Esta ubicación ya está completa. Selecciona otra.");
      }

      // VALIDAR DIVISIONES
      if (ubicacionSeleccionada.tieneSubdivisiones) {
        if (!formulario.subdivision) {
          throw new Error("Debes seleccionar una división interna.");
        }

        const divisionExiste = ubicacionSeleccionada.subdivisiones?.some(
          (division) => String(division.id) === String(formulario.subdivision),
        );

        if (!divisionExiste) {
          throw new Error("La división seleccionada no es válida.");
        }

        if (
          divisionEstaOcupada(ubicacionSeleccionada, formulario.subdivision)
        ) {
          throw new Error("Esta división ya está ocupada. Selecciona otra.");
        }
      } else {
        // UNA SOLA PLAZA PARA UBICACIONES ESTÁNDAR
        if (capacidad.ocupados >= 1) {
          throw new Error("Esta ubicación ya está ocupada.");
        }

        // Las ubicaciones estándar no utilizan subdivisiones.
        if (formulario.subdivision) {
          throw new Error("Esta ubicación no dispone de divisiones internas.");
        }
      }

      if (formulario.tieneCodigo && !formulario.codigo.trim()) {
        throw new Error("Debes ingresar el código del repuesto.");
      }

      const datos = {
        ...formulario,
        // El backend espera el ID real de ubicaciones.id.
        ubicacion: String(ubicacionSeleccionada.id),
        subdivision: formulario.subdivision
          ? String(formulario.subdivision)
          : "",
        codigo: formulario.tieneCodigo ? formulario.codigo.trim() : "",
        codigoReemplazo: formulario.tieneCodigo
          ? formulario.codigoReemplazo.trim()
          : "",
      };

      if (registroEditando) {
        await editarRegistroInventario(registroEditando.id, datos);
      } else {
        await crearRegistroInventario(datos);
      }

      // Consultar nuevamente los datos confirmados por Railway.
      await cargarDatos();
      cerrarModal();
    } catch (err) {
      setError(err.message || "No se pudo guardar el registro.");
    }
  }

  // ==========================================
  // ACTIVAR / DESACTIVAR REGISTRO
  // ==========================================

  async function cambiarEstado(id) {
    try {
      setError("");
      await cambiarEstadoRegistro(id);
      await cargarDatos();
    } catch (err) {
      setError(err.message || "No se pudo actualizar el estado del repuesto.");
    }
  }

  // ==========================================
  // INTERFAZ
  // ==========================================

  return (
    <section className="inventario-page">
      {/* ENCABEZADO */}

      <div className="page-heading">
        <div>
          <span className="page-eyebrow">CONTROL OPERATIVO</span>

          <h1>Inventario</h1>

          <p>
            Asocia los códigos utilizados en almacén con los materiales
            registrados en el Catálogo Maestro.
          </p>
        </div>

        <button
          type="button"
          className="button button-primary"
          onClick={abrirNuevoRegistro}
        >
          <Plus size={19} />
          Nueva asociación
        </button>
      </div>

      {/* RESUMEN */}

      <div className="summary-grid">
        <article className="summary-card">
          <span>Asociaciones</span>
          <strong>{inventario.length}</strong>
          <small>Registros totales</small>
        </article>

        <article className="summary-card">
          <span>Activos</span>
          <strong>{totalActivos}</strong>
          <small>Registros disponibles</small>
        </article>

        <article className="summary-card">
          <span>Inactivos</span>
          <strong>{totalInactivos}</strong>
          <small>Registros deshabilitados</small>
        </article>
      </div>

      {/* TABLA DE INVENTARIO */}

      <div className="content-card">
        <div className="table-toolbar">
          <div>
            <h2>Inventario registrado</h2>
            <p>Identificación de materiales y su ubicación física.</p>
          </div>

          <div className="search-box">
            <Search size={18} />

            <input
              type="search"
              placeholder="Buscar material, SKU, código o ubicación..."
              value={busqueda}
              onChange={(event) => setBusqueda(event.target.value)}
            />
          </div>
        </div>

        <div className="table-wrapper">
          <table className="data-table inventory-table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Material</th>
                <th>Código</th>
                <th>Reemplazo</th>
                <th>Ubicación</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>

            <tbody>
              {inventarioFiltrado.map((registro) => (
                <tr key={registro.id}>
                  <td>
                    <span className="sku-code">{registro.sku}</span>
                  </td>

                  <td>
                    <strong>{registro.descripcion}</strong>
                  </td>

                  <td>
                    <span className="external-code">
                      {registro.codigo || "Sin código"}
                    </span>
                  </td>

                  <td>{registro.codigoReemplazo || "—"}</td>

                  <td>
                    <span className="location-badge">
                      {registro.ubicacion}
                      {registro.subdivision ? ` · ${registro.subdivision}` : ""}
                    </span>
                  </td>

                  <td>
                    <span
                      className={`status-badge ${
                        registro.estado === "Activo"
                          ? "status-active"
                          : "status-inactive"
                      }`}
                    >
                      {registro.estado}
                    </span>
                  </td>

                  <td>
                    <div className="table-actions">
                      <button
                        type="button"
                        className="icon-action"
                        title="Editar asociación"
                        onClick={() => abrirEdicion(registro)}
                      >
                        <Pencil size={17} />
                      </button>

                      <button
                        type="button"
                        className="icon-action"
                        title={
                          registro.estado === "Activo"
                            ? "Desactivar"
                            : "Activar"
                        }
                        onClick={() => cambiarEstado(registro.id)}
                      >
                        <Power size={17} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {inventarioFiltrado.length === 0 && (
                <tr>
                  <td colSpan="7">
                    <div className="empty-table">
                      <Boxes size={38} />

                      <strong>No hay asociaciones registradas</strong>

                      <span>
                        Registra el primer material y asígnale una ubicación
                        física.
                      </span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DE REGISTRO */}

      {modalAbierto && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              cerrarModal();
            }
          }}
        >
          <div className="modal-card inventory-modal">
            {/* CABECERA DEL MODAL */}

            <div className="modal-header">
              <div>
                <span className="page-eyebrow">
                  {registroEditando ? "EDITAR ASOCIACIÓN" : "NUEVA ASOCIACIÓN"}
                </span>

                <h2>
                  {registroEditando
                    ? "Editar material en inventario"
                    : "Asignar ubicación al material"}
                </h2>
              </div>

              <button
                type="button"
                className="modal-close"
                onClick={cerrarModal}
                aria-label="Cerrar"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={guardarRegistro}>
              {/* BUSCADOR DE MATERIAL */}

              {!registroEditando && (
                <div className="form-group form-full material-search-container">
                  <label htmlFor="materialSearch">
                    Material del Catálogo Maestro *
                  </label>

                  <div className="material-search-input">
                    <Search size={18} />

                    <input
                      id="materialSearch"
                      type="text"
                      value={busquedaMaterial}
                      placeholder="Buscar material por nombre..."
                      autoComplete="off"
                      onFocus={() => setMostrarResultados(true)}
                      onChange={cambiarBusquedaMaterial}
                    />
                  </div>

                  {mostrarResultados && busquedaMaterial.trim().length >= 1 && (
                    <div className="material-search-results">
                      {materialesFiltrados.length > 0 ? (
                        materialesFiltrados.map((material) => (
                          <button
                            key={material.id}
                            type="button"
                            className="material-search-option"
                            onClick={() => seleccionarMaterial(material)}
                          >
                            <div>
                              <strong>{material.descripcion}</strong>

                              <span>{material.sku}</span>
                            </div>
                          </button>
                        ))
                      ) : (
                        <div className="material-search-empty">
                          No se encontraron materiales.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* MATERIAL SELECCIONADO */}

              {formulario.sku && (
                <div className="selected-material">
                  <span>Material asociado</span>

                  <div>
                    <strong>{formulario.sku}</strong>
                    <p>{formulario.descripcion}</p>
                  </div>
                </div>
              )}

              {/* FOTOGRAFÍA */}

              <div className="form-group form-full inventory-photo-field">
                <label>Fotografía del repuesto (opcional)</label>

                <div className="inventory-photo-content">
                  <div className="inventory-photo-preview">
                    {formulario.foto ? (
                      <img
                        src={formulario.foto}
                        alt="Vista previa del repuesto"
                      />
                    ) : (
                      <ImageIcon size={28} />
                    )}
                  </div>

                  <div className="inventory-photo-actions">
                    <button
                      type="button"
                      className="button button-secondary"
                      onClick={() => camaraInputRef.current?.click()}
                    >
                      <Camera size={16} />
                      Tomar fotografía
                    </button>

                    <button
                      type="button"
                      className="button button-secondary"
                      onClick={() => galeriaInputRef.current?.click()}
                    >
                      <ImageIcon size={16} />
                      Elegir de galería
                    </button>

                    {formulario.foto && (
                      <button
                        type="button"
                        className="inventory-photo-remove"
                        onClick={eliminarFotografia}
                      >
                        <Trash2 size={14} />
                        Quitar fotografía
                      </button>
                    )}
                  </div>
                </div>

                <small>JPG, PNG o WEBP. Tamaño máximo: 2 MB.</small>

                <input
                  ref={camaraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={cambiarFotografia}
                  hidden
                />

                <input
                  ref={galeriaInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={cambiarFotografia}
                  hidden
                />
              </div>

              {/* CÓDIGOS */}

              <div className="inventory-form-grid">
                <div className="form-group form-full code-question">
                  <label>¿El repuesto tiene código?</label>

                  <div
                    className="code-radio-group"
                    role="radiogroup"
                    aria-label="¿El repuesto tiene código?"
                  >
                    <label
                      className={`code-radio-option ${
                        formulario.tieneCodigo === true ? "selected" : ""
                      }`}
                    >
                      <input
                        type="radio"
                        name="tieneCodigo"
                        value="si"
                        checked={formulario.tieneCodigo === true}
                        onChange={() => cambiarTieneCodigo(true)}
                      />

                      <Check size={19} />
                      <span>Sí, tiene código</span>
                    </label>

                    <label
                      className={`code-radio-option ${
                        formulario.tieneCodigo === false ? "selected" : ""
                      }`}
                    >
                      <input
                        type="radio"
                        name="tieneCodigo"
                        value="no"
                        checked={formulario.tieneCodigo === false}
                        onChange={() => cambiarTieneCodigo(false)}
                      />

                      <X size={19} />
                      <span>No tiene código</span>
                    </label>
                  </div>
                </div>

                {formulario.tieneCodigo && (
                  <>
                    <div className="form-group">
                      <label htmlFor="codigo">
                        <Barcode size={15} />
                        Código del repuesto *
                      </label>

                      <input
                        id="codigo"
                        name="codigo"
                        type="text"
                        value={formulario.codigo}
                        onChange={actualizarCampo}
                        placeholder="Ej. 45872"
                        required
                      />

                      <small>Ingresa el código utilizado por el almacén.</small>
                    </div>

                    <div className="form-group">
                      <label htmlFor="codigoReemplazo">
                        Código de reemplazo
                      </label>

                      <input
                        id="codigoReemplazo"
                        name="codigoReemplazo"
                        type="text"
                        value={formulario.codigoReemplazo}
                        onChange={actualizarCampo}
                        placeholder="Opcional"
                      />

                      <small>Solo si existe un código alternativo.</small>
                    </div>
                  </>
                )}
              </div>

              {/* UBICACIÓN FÍSICA */}

              <div className="form-group form-full">
                <label>
                  <MapPin size={15} />
                  Ubicación física *
                </label>

                <div
                  className="custom-location-select"
                  onBlur={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget)) {
                      setUbicacionMenuAbierto(false);
                    }
                  }}
                >
                  <button
                    type="button"
                    className={`location-select-trigger ${
                      ubicacionMenuAbierto ? "is-open" : ""
                    } ${formulario.ubicacion ? "has-value" : ""}`}
                    onClick={() => setUbicacionMenuAbierto((actual) => !actual)}
                    aria-expanded={ubicacionMenuAbierto}
                    aria-haspopup="listbox"
                  >
                    <div className="location-trigger-content">
                      <div className="location-trigger-icon">
                        <Boxes size={20} />
                      </div>

                      <div className="location-trigger-text">
                        <strong>
                          {formulario.ubicacion || "Seleccionar ubicación"}
                        </strong>

                        <span>
                          {ubicacionFormulario
                            ? ubicacionFormulario.tieneSubdivisiones
                              ? "Jaba con subdivisiones internas"
                              : "Jaba estándar"
                            : "Selecciona el espacio físico del material"}
                        </span>
                      </div>
                    </div>

                    <ChevronDown size={19} className="location-chevron" />
                  </button>

                  {/* LISTA DE UBICACIONES */}

                  {ubicacionMenuAbierto && (
                    <div className="location-options-panel" role="listbox">
                      <div className="location-options-heading">
                        <div>
                          <strong>Ubicaciones disponibles</strong>

                          <span>Selecciona una jaba del almacén</span>
                        </div>

                        <span className="location-options-count">
                          {ubicaciones.length} espacios
                        </span>
                      </div>

                      <div className="location-options-list">
                        {ubicaciones.map((ubicacion) => {
                          const tieneDivisiones = ubicacion.tieneSubdivisiones;

                          const seleccionada =
                            String(formulario.ubicacion) ===
                            String(ubicacion.id);

                          const capacidad =
                            obtenerCapacidadUbicacion(ubicacion);

                          return (
                            <button
                              key={ubicacion.id}
                              type="button"
                              role="option"
                              aria-selected={seleccionada}
                              disabled={capacidad.completa}
                              className={`location-option ${
                                seleccionada ? "selected" : ""
                              } ${
                                tieneDivisiones
                                  ? "option-divided"
                                  : "option-standard"
                              } ${
                                capacidad.completa ? "location-option-full" : ""
                              }`}
                              onClick={() => seleccionarUbicacion(ubicacion)}
                            >
                              <div className="location-option-icon">
                                {tieneDivisiones ? (
                                  <Boxes size={19} />
                                ) : (
                                  <Check size={19} />
                                )}
                              </div>

                              <div className="location-option-info">
                                <strong>{ubicacion.nombre}</strong>

                                <span>
                                  Estante {ubicacion.estante}
                                  {" · "}
                                  Piso {ubicacion.piso}
                                  {" · "}
                                  Columna {ubicacion.columna}
                                </span>
                              </div>

                              {/* CAPACIDAD A LA DERECHA */}

                              <div className="location-option-side">
                                <div className="location-option-capacity">
                                  <div className="location-capacity-label">
                                    <strong>
                                      {capacidad.ocupados}/{capacidad.capacidad}
                                    </strong>

                                    <small>
                                      {capacidad.completa
                                        ? "Completa"
                                        : `${capacidad.disponibles} libres`}
                                    </small>
                                  </div>

                                  <div className="location-capacity-track">
                                    <div
                                      className={
                                        capacidad.completa
                                          ? "capacity-full"
                                          : "capacity-available"
                                      }
                                      style={{
                                        width: `${capacidad.porcentaje}%`,
                                      }}
                                    />
                                  </div>
                                </div>

                                <span
                                  className={`location-type-badge ${
                                    tieneDivisiones
                                      ? "badge-divided"
                                      : "badge-standard"
                                  }`}
                                >
                                  {tieneDivisiones ? "3 × 2" : "Estándar"}
                                </span>
                              </div>

                              {seleccionada && (
                                <Check
                                  size={18}
                                  className="location-selected-check"
                                />
                              )}
                            </button>
                          );
                        })}
                      </div>

                      <div className="location-options-footer">
                        <span className="location-legend divided">
                          <i />
                          Con subdivisiones
                        </span>

                        <span className="location-legend standard">
                          <i />
                          Sin subdivisiones
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* INFORMACIÓN DE UBICACIÓN SELECCIONADA */}

                {ubicacionFormulario && (
                  <div
                    className={`location-selected-info ${
                      ubicacionFormulario.tieneSubdivisiones
                        ? "selected-divided"
                        : "selected-standard"
                    }`}
                  >
                    <div className="location-selected-icon">
                      <Boxes size={21} />
                    </div>

                    <div className="location-selected-description">
                      <strong>
                        Estante {ubicacionFormulario.estante}
                        {" · "}
                        {ubicacionFormulario.nombre}
                      </strong>

                      <span>
                        Piso {ubicacionFormulario.piso}
                        {" · "}
                        Columna {ubicacionFormulario.columna}
                      </span>

                      <p>
                        {ubicacionFormulario.tieneSubdivisiones
                          ? `Esta jaba dispone de ${ubicacionFormulario.subdivisiones.length} divisiones internas. Selecciona dónde guardarás el material.`
                          : "Espacio estándar sin subdivisiones internas. El material se asignará directamente a esta ubicación."}
                      </p>
                    </div>

                    <span className="location-selected-badge">
                      {ubicacionFormulario.tieneSubdivisiones
                        ? "3 × 2"
                        : "Estándar"}
                    </span>
                  </div>
                )}
              </div>

              {/* DIVISIONES INTERNAS */}

              {ubicacionFormulario?.tieneSubdivisiones && (
                <div className="form-group form-full subdivision-selector">
                  <label>División interna *</label>

                  <div className="custom-subdivision-select">
                    <button
                      type="button"
                      className={`subdivision-trigger ${
                        subdivisionMenuAbierto ? "is-open" : ""
                      }`}
                      onClick={() => {
                        setUbicacionMenuAbierto(false);
                        setSubdivisionMenuAbierto((actual) => !actual);
                      }}
                      aria-expanded={subdivisionMenuAbierto}
                      aria-haspopup="listbox"
                    >
                      <div className="subdivision-trigger-content">
                        <strong>
                          {formulario.subdivision || "Seleccionar división"}
                        </strong>

                        <span>
                          {formulario.subdivision
                            ? ubicacionFormulario.subdivisiones.find(
                                (division) =>
                                  String(division.id) ===
                                  String(formulario.subdivision),
                              )?.nombre
                            : "Selecciona el espacio interno del material"}
                        </span>
                      </div>

                      <ChevronDown size={18} className="location-chevron" />
                    </button>

                    {subdivisionMenuAbierto && (
                      <div
                        className="subdivision-options-panel"
                        role="listbox"
                        aria-label="Divisiones internas"
                      >
                        {ubicacionFormulario.subdivisiones.map((division) => {
                          const seleccionada =
                            String(formulario.subdivision) ===
                            String(division.id);

                          const ocupada = divisionEstaOcupada(
                            ubicacionFormulario,
                            division.id,
                          );

                          return (
                            <button
                              key={division.id}
                              type="button"
                              className={`subdivision-option ${
                                seleccionada ? "selected" : ""
                              } ${ocupada ? "division-option-full" : ""}`}
                              role="option"
                              aria-selected={seleccionada}
                              disabled={ocupada}
                              onClick={() => seleccionarSubdivision(division)}
                            >
                              <strong>{division.id}</strong>

                              <span>{division.nombre}</span>

                              {ocupada ? (
                                <small>Ocupada</small>
                              ) : seleccionada ? (
                                <Check size={15} />
                              ) : (
                                <small>Disponible</small>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* OBSERVACIONES */}

              <div className="form-group form-full">
                <label htmlFor="observacion">Observación</label>

                <textarea
                  id="observacion"
                  name="observacion"
                  rows="3"
                  value={formulario.observacion}
                  onChange={actualizarCampo}
                  placeholder="Información adicional del material..."
                />
              </div>

              {/* ERRORES */}

              {error && <div className="form-error">{error}</div>}

              {/* BOTONES */}

              <div className="modal-actions">
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={cerrarModal}
                >
                  Cancelar
                </button>

                <button type="submit" className="button button-primary">
                  {registroEditando ? "Guardar cambios" : "Guardar ubicación"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}

export default InventarioPage;
