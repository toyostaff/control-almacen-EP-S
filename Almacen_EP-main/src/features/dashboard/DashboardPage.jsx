
import {
  Package,
  Warehouse,
  ChartPie,
  MapPin,
  Boxes,
} from "lucide-react";

import "./DashboardPage.css";

const indicadores = [
  {
    titulo: "Componentes registrados",
    descripcion: "Materiales asociados al inventario",
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
    descripcion: "Espacios actualmente utilizados",
    valor: "—",
    icono: ChartPie,
    color: "orange",
  },
  {
    titulo: "Espacios disponibles",
    descripcion: "Ubicaciones libres",
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
                <strong>{item.valor}</strong>
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

          <div className="dashboard-map-placeholder">

            <div className="dashboard-empty-icon">
              <Boxes size={38} />
            </div>

            <strong>Mapa de distribución</strong>

            <p>
              Aquí podrás visualizar los estantes,
              pisos y espacios del almacén.
            </p>

            <small>
              Selecciona una ubicación para consultar su contenido.
            </small>

          </div>

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
              <span>Uso de la capacidad</span>
              <strong>Sin datos</strong>
            </div>

            <div className="dashboard-progress-track">
              <div />
            </div>

          </div>

        </article>

      </section>

    </div>
  );
}

export default DashboardPage;
