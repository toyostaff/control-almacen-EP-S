
import {
  Package,
  Warehouse,
  ChartPie,
  MapPin,
  AlertTriangle,
  ClipboardList,
  Clock,
  FileSpreadsheet,
  FileText,
  ArrowUpRight,
  Boxes,
  Activity,
} from "lucide-react";

import "./DashboardPage.css";

const indicadores = [
  {
    titulo: "Componentes",
    descripcion: "Registros activos",
    valor: "—",
    icono: Package,
    color: "blue",
  },
  {
    titulo: "Capacidad total",
    descripcion: "Espacios organizados",
    valor: "—",
    icono: Warehouse,
    color: "green",
  },
  {
    titulo: "Ocupación",
    descripcion: "Espacios utilizados",
    valor: "—",
    icono: ChartPie,
    color: "orange",
  },
  {
    titulo: "Disponibles",
    descripcion: "Espacios libres",
    valor: "—",
    icono: MapPin,
    color: "red",
  },
];

function DashboardPage() {
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
      </div>

      {/* INDICADORES */}
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
                <strong>{item.valor}</strong>
                <small>{item.descripcion}</small>
              </div>
            </article>
          );
        })}

      </section>

      {/* DISTRIBUCIÓN Y OCUPACIÓN */}
      <section className="dashboard-main-grid">

        <article className="dashboard-card dashboard-distribution">

          <div className="dashboard-card-heading">
            <div>
              <span className="dashboard-section-label">
                DISTRIBUCIÓN FÍSICA
              </span>

              <h2>Distribución del almacén</h2>

              <p>
                Visualiza la organización de los espacios
                y las ubicaciones.
              </p>
            </div>

            <div className="dashboard-heading-icon">
              <Warehouse size={21} />
            </div>
          </div>

          <div className="dashboard-map-placeholder">
            <div className="dashboard-empty-icon">
              <Boxes size={38} />
            </div>

            <strong>Mapa del almacén</strong>

            <p>
              Aquí se mostrará la distribución visual
              de los estantes y sus ubicaciones.
            </p>

            <small>
              Información pendiente de conexión con la base de datos.
            </small>
          </div>

        </article>

        <article className="dashboard-card dashboard-occupancy">

          <div className="dashboard-card-heading">
            <div>
              <span className="dashboard-section-label">
                CONTROL DE ESPACIOS
              </span>

              <h2>Ocupación</h2>

              <p>
                Estado de utilización de las ubicaciones.
              </p>
            </div>

            <div className="dashboard-heading-icon orange">
              <ChartPie size={21} />
            </div>
          </div>

          <div className="dashboard-occupancy-content">

            <div className="dashboard-occupancy-chart">
              <ChartPie size={58} />
              <strong>—</strong>
              <span>Ocupación</span>
            </div>

            <div className="dashboard-occupancy-legend">
              <div>
                <span className="legend-dot occupied" />
                <span>Ocupados</span>
                <strong>—</strong>
              </div>

              <div>
                <span className="legend-dot available" />
                <span>Disponibles</span>
                <strong>—</strong>
              </div>
            </div>

          </div>

          <div className="dashboard-progress">
            <div>
              <span>Distribución de espacios</span>
              <strong>Sin datos</strong>
            </div>

            <div className="dashboard-progress-track">
              <div />
            </div>
          </div>

        </article>

      </section>

      {/* ALERTAS */}
      <section className="dashboard-card dashboard-alerts">

        <div className="dashboard-card-heading">
          <div>
            <span className="dashboard-section-label">
              SUPERVISIÓN
            </span>

            <h2>Alertas del almacén</h2>

            <p>
              Situaciones que requieren atención.
            </p>
          </div>

          <div className="dashboard-heading-icon red">
            <AlertTriangle size={21} />
          </div>
        </div>

        <div className="dashboard-alert-list">

          <div className="dashboard-alert-item">
            <div className="dashboard-alert-icon orange">
              <ClipboardList size={20} />
            </div>

            <div>
              <strong>Registros incompletos</strong>
              <p>
                Componentes que requieren completar información.
              </p>
            </div>

            <span className="dashboard-alert-status">
              Pendiente
            </span>
          </div>

          <div className="dashboard-alert-item">
            <div className="dashboard-alert-icon red">
              <Warehouse size={20} />
            </div>

            <div>
              <strong>Ocupación de ubicaciones</strong>
              <p>
                Espacios que requieren supervisión por su ocupación.
              </p>
            </div>

            <span className="dashboard-alert-status">
              Pendiente
            </span>
          </div>

        </div>

      </section>

      {/* ACTIVIDAD Y REPORTES */}
      <section className="dashboard-bottom-grid">

        <article className="dashboard-card">

          <div className="dashboard-card-heading">
            <div>
              <span className="dashboard-section-label">
                SEGUIMIENTO
              </span>

              <h2>Actividad reciente</h2>

              <p>
                Últimos movimientos realizados en el sistema.
              </p>
            </div>

            <div className="dashboard-heading-icon">
              <Activity size={21} />
            </div>
          </div>

          <div className="dashboard-empty-state">
            <Clock size={29} />

            <strong>Sin actividad disponible</strong>

            <span>
              Aquí aparecerán los últimos registros
              y modificaciones del almacén.
            </span>
          </div>

        </article>

        <article className="dashboard-card">

          <div className="dashboard-card-heading">
            <div>
              <span className="dashboard-section-label">
                INFORMACIÓN
              </span>

              <h2>Reportes</h2>

              <p>
                Información para el seguimiento del almacén.
              </p>
            </div>

            <div className="dashboard-heading-icon green">
              <FileText size={21} />
            </div>
          </div>

          <div className="dashboard-report-list">

            <div className="dashboard-report-item">
              <div className="dashboard-report-icon">
                <FileSpreadsheet size={21} />
              </div>

              <div>
                <strong>Reporte de inventario</strong>
                <span>Componentes, códigos y ubicaciones.</span>
              </div>

              <ArrowUpRight size={18} />
            </div>

            <div className="dashboard-report-item">
              <div className="dashboard-report-icon">
                <ClipboardList size={21} />
              </div>

              <div>
                <strong>Reporte de actividad</strong>
                <span>Historial de operaciones y modificaciones.</span>
              </div>

              <ArrowUpRight size={18} />
            </div>

          </div>

        </article>

      </section>

    </div>
  );
}

export default DashboardPage;
