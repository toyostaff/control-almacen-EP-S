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

import { ubicacionesAlmacen } from "../../data/ubicaciones";

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
  const [inventario, setInventario] = useState([]);
  const [catalogo, setCatalogo] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [busquedaMaterial, setBusquedaMaterial] = useState("");
  const [mostrarResultados, setMostrarResultados] = useState(false);

  const [modalAbierto, setModalAbierto] = useState(false);
  const [ubicacionMenuAbierto, setUbicacionMenuAbierto] = useState(false);
  const [subdivisionMenuAbierto, setSubdivisionMenuAbierto] = useState(false);

  const [registroEditando, setRegistroEditando] = useState(null);
  const [formulario, setFormulario] = useState(formularioInicial);
  const [error, setError] = useState("");

  const galeriaInputRef = useRef(null);
  const camaraInputRef = useRef(null);

  // CARGA DE DATOS DESDE RAILWAY
  async function cargarDatos() {
    try {
      const [registros, materiales] = await Promise.all([
        obtenerInventario(),
        obtenerCatalogo(),
      ]);

      setInventario(Array.isArray(registros) ? registros : []);
      setCatalogo(
        (Array.isArray(materiales) ? materiales : []).filter(
          (material) => material.estado === "Activo",
        ),
      );
    } catch (err) {
      setError(err.message || "No se pudieron cargar los datos del almacén.");
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

  const ubicacionFormulario = ubicacionesAlmacen.find(
    (ubicacion) => ubicacion.nombre === formulario.ubicacion,
  );

  // ==========================================
  // CONTROL DE CAPACIDAD DE UBICACIONES
  // ==========================================

  function obtenerRegistrosOcupantes(ubicacion) {
    return inventario.filter(
      (registro) =>
        registro.estado === "Activo" &&
        registro.ubicacion === ubicacion.nombre &&
        registro.id !== registroEditando?.id,
    );
  }

  function obtenerCapacidadUbicacion(ubicacion) {
    const registros = obtenerRegistrosOcupantes(ubicacion);

    const capacidad = ubicacion.tieneSubdivisiones
      ? ubicacion.subdivisiones?.length || 6
      : 1;

    const ocupados = registros.length;

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
      completa: disponibles === 0,
    };
  }

  function divisionEstaOcupada(ubicacion, divisionId) {
    return inventario.some(
      (registro) =>
        registro.estado === "Activo" &&
        registro.ubicacion === ubicacion.nombre &&
        registro.subdivision === divisionId &&
        registro.id !== registroEditando?.id,
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
  // ACTUALIZACIÃ“N DE CAMPOS
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
  // SELECCIÃ“N DE MATERIAL
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
  // SELECCIÃ“N DE UBICACIONES
  // ==========================================

  function seleccionarUbicacion(ubicacion) {
    const capacidad = obtenerCapacidadUbicacion(ubicacion);

    if (capacidad.completa) {
      setError("Esta ubicaciÃ³n estÃ¡ completa. Selecciona otra.");
      return;
    }

    setFormulario((actual) => ({
      ...actual,
      ubicacion: ubicacion.nombre,
      subdivision: "",
    }));

    setUbicacionMenuAbierto(false);
    setSubdivisionMenuAbierto(false);
    setError("");
  }

  function seleccionarSubdivision(division) {
    if (divisionEstaOcupada(ubicacionFormulario, division.id)) {
      setError("Esta divisiÃ³n ya estÃ¡ ocupada. Selecciona otra.");
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
  // FOTOGRAFÃAS
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
      setError("La fotografÃ­a no debe superar los 2 MB.");
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
      setError("No se pudo leer la fotografÃ­a.");
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
  // VALIDACIÃ“N Y GUARDADO
  // ==========================================

  async function guardarRegistro(event) {
    event.preventDefault();
    setError("");

    try {
      if (!formulario.skuId) {
        throw new Error("Debes seleccionar un material del CatÃ¡logo Maestro.");
      }

      if (!formulario.ubicacion) {
        throw new Error("Debes seleccionar una ubicaciÃ³n.");
      }

      const ubicacionSeleccionada = ubicacionesAlmacen.find(
        (ubicacion) => ubicacion.nombre === formulario.ubicacion,
      );

      if (!ubicacionSeleccionada) {
        throw new Error("La ubicaciÃ³n seleccionada no existe.");
      }

      // VALIDAR CAPACIDAD
      const capacidad = obtenerCapacidadUbicacion(ubicacionSeleccionada);

      if (capacidad.completa) {
        throw new Error("Esta ubicaciÃ³n ya estÃ¡ completa. Selecciona otra.");
      }

      // VALIDAR DIVISIONES
      if (ubicacionSeleccionada.tieneSubdivisiones) {
        if (!formulario.subdivision) {
          throw new Error("Debes seleccionar una divisiÃ³n interna.");
        }

        const divisionExiste = ubicacionSeleccionada.subdivisiones?.some(
          (division) => division.id === formulario.subdivision,
        );

        if (!divisionExiste) {
          throw new Error("La divisiÃ³n seleccionada no es vÃ¡lida.");
        }

        if (
          divisionEstaOcupada(ubicacionSeleccionada, formulario.subdivision)
        ) {
          throw new Error("Esta divisiÃ³n ya estÃ¡ ocupada. Selecciona otra.");
        }
      } else {
        // UNA SOLA PLAZA PARA UBICACIONES ESTÃNDAR
        if (capacidad.ocupados >= 1) {
          throw new Error("Esta ubicaciÃ³n ya estÃ¡ ocupada.");
        }

        // Las ubicaciones estÃ¡ndar no utilizan subdivisiones.
        if (formulario.subdivision) {
          throw new Error("Esta ubicaciÃ³n no dispone de divisiones internas.");
        }
      }

      if (formulario.tieneCodigo && !formulario.codigo.trim()) {
        throw new Error("Debes ingresar el cÃ³digo del repuesto.");
      }

      const datos = {
        ...formulario,
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
      setError(
        err.message || "No se pudo actualizar el estado del repuesto.",
      );
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
            Asocia los cÃ³digos utilizados en almacÃ©n con los materiales
            registrados en el CatÃ¡logo Maestro.
          </p>
        </div>

        <button
          type="button"
          className="button button-primary"
          onClick={abrirNuevoRegistro}
        >
          <Plus size={19} />
          Nueva asociaciÃ³n
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
            <p>IdentificaciÃ³n de materiales y su ubicaciÃ³n fÃ­sica.</p>
          </div>

          <div className="search-box">
            <Search size={18} />

            <input
              type="search"
              placeholder="Buscar material, SKU, cÃ³digo o ubicaciÃ³n..."
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
                <th>CÃ³digo</th>
                <th>Reemplazo</th>
                <th>UbicaciÃ³n</th>
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
                      {registro.codigo || "Sin cÃ³digo"}
                    </span>
                  </td>

                  <td>{registro.codigoReemplazo || "â€”"}</td>

                  <td>
                    <span className="location-badge">
                      {registro.ubicacion}
                      {registro.subdivision ? ` Â· ${registro.subdivision}` : ""}
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
                        title="Editar asociaciÃ³n"
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
                        Registra el primer material y asÃ­gnale una ubicaciÃ³n
                        fÃ­sica.
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
                  {registroEditando ? "EDITAR ASOCIACIÃ“N" : "NUEVA ASOCIACIÃ“N"}
                </span>

                <h2>
                  {registroEditando
                    ? "Editar material en inventario"
                    : "Asignar ubicaciÃ³n al material"}
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
                    Material del CatÃ¡logo Maestro *
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

              {/* FOTOGRAFÃA */}

              <div className="form-group form-full inventory-photo-field">
                <label>FotografÃ­a del repuesto (opcional)</label>

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
                      Tomar fotografÃ­a
                    </button>

                    <button
                      type="button"
                      className="button button-secondary"
                      onClick={() => galeriaInputRef.current?.click()}
                    >
                      <ImageIcon size={16} />
                      Elegir de galerÃ­a
                    </button>

                    {formulario.foto && (
                      <button
                        type="button"
                        className="inventory-photo-remove"
                        onClick={eliminarFotografia}
                      >
                        <Trash2 size={14} />
                        Quitar fotografÃ­a
                      </button>
                    )}
                  </div>
                </div>

                <small>JPG, PNG o WEBP. TamaÃ±o mÃ¡ximo: 2 MB.</small>

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

              {/* CÃ“DIGOS */}

              <div className="inventory-form-grid">
                <div className="form-group form-full code-question">
                  <label>Â¿El repuesto tiene cÃ³digo?</label>

                  <div
                    className="code-radio-group"
                    role="radiogroup"
                    aria-label="Â¿El repuesto tiene cÃ³digo?"
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
                      <span>SÃ­, tiene cÃ³digo</span>
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
                      <span>No tiene cÃ³digo</span>
                    </label>
                  </div>
                </div>

                {formulario.tieneCodigo && (
                  <>
                    <div className="form-group">
                      <label htmlFor="codigo">
                        <Barcode size={15} />
                        CÃ³digo del repuesto *
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

                      <small>Ingresa el cÃ³digo utilizado por el almacÃ©n.</small>
                    </div>

                    <div className="form-group">
                      <label htmlFor="codigoReemplazo">
                        CÃ³digo de reemplazo
                      </label>

                      <input
                        id="codigoReemplazo"
                        name="codigoReemplazo"
                        type="text"
                        value={formulario.codigoReemplazo}
                        onChange={actualizarCampo}
                        placeholder="Opcional"
                      />

                      <small>Solo si existe un cÃ³digo alternativo.</small>
                    </div>
                  </>
                )}
              </div>

              {/* UBICACIÃ“N FÃSICA */}

              <div className="form-group form-full">
                <label>
                  <MapPin size={15} />
                  UbicaciÃ³n fÃ­sica *
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
                          {formulario.ubicacion || "Seleccionar ubicaciÃ³n"}
                        </strong>

                        <span>
                          {ubicacionFormulario
                            ? ubicacionFormulario.tieneSubdivisiones
                              ? "Jaba con subdivisiones internas"
                              : "Jaba estÃ¡ndar"
                            : "Selecciona el espacio fÃ­sico del material"}
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

                          <span>Selecciona una jaba del almacÃ©n</span>
                        </div>

                        <span className="location-options-count">
                          {ubicacionesAlmacen.length} espacios
                        </span>
                      </div>

                      <div className="location-options-list">
                        {ubicacionesAlmacen.map((ubicacion) => {
                          const tieneDivisiones = ubicacion.tieneSubdivisiones;

                          const seleccionada =
                            formulario.ubicacion === ubicacion.nombre;

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
                                  {" Â· "}
                                  Piso {ubicacion.piso}
                                  {" Â· "}
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
                                  {tieneDivisiones ? "3 Ã— 2" : "EstÃ¡ndar"}
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

                {/* INFORMACIÃ“N DE UBICACIÃ“N SELECCIONADA */}

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
                        {" Â· "}
                        {ubicacionFormulario.nombre}
                      </strong>

                      <span>
                        Piso {ubicacionFormulario.piso}
                        {" Â· "}
                        Columna {ubicacionFormulario.columna}
                      </span>

                      <p>
                        {ubicacionFormulario.tieneSubdivisiones
                          ? "Esta jaba dispone de 6 divisiones internas. Selecciona la divisiÃ³n donde guardarÃ¡s el material."
                          : "Espacio estÃ¡ndar sin subdivisiones internas. El material se asignarÃ¡ directamente a esta ubicaciÃ³n."}
                      </p>
                    </div>

                    <span className="location-selected-badge">
                      {ubicacionFormulario.tieneSubdivisiones
                        ? "3 Ã— 2"
                        : "EstÃ¡ndar"}
                    </span>
                  </div>
                )}
              </div>

              {/* DIVISIONES INTERNAS */}

              {ubicacionFormulario?.tieneSubdivisiones && (
                <div className="form-group form-full subdivision-selector">
                  <label>DivisiÃ³n interna *</label>

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
                          {formulario.subdivision || "Seleccionar divisiÃ³n"}
                        </strong>

                        <span>
                          {formulario.subdivision
                            ? ubicacionFormulario.subdivisiones.find(
                                (division) =>
                                  division.id === formulario.subdivision,
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
                            formulario.subdivision === division.id;

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
                <label htmlFor="observacion">ObservaciÃ³n</label>

                <textarea
                  id="observacion"
                  name="observacion"
                  rows="3"
                  value={formulario.observacion}
                  onChange={actualizarCampo}
                  placeholder="InformaciÃ³n adicional del material..."
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
                  {registroEditando ? "Guardar cambios" : "Guardar ubicaciÃ³n"}
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
