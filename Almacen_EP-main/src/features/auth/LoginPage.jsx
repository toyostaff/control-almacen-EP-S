
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  Eye,
  EyeOff,
  UserRound,
  LockKeyhole,
  Warehouse,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";

import "./LoginPage.css";

function LoginPage({ onLogin }) {
  const navigate = useNavigate();

  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function manejarLogin(event) {
    event.preventDefault();
    setError("");

    const nombreUsuario = usuario.trim();

    if (!nombreUsuario || !password) {
      setError("Ingresa tu usuario y contraseña.");
      return;
    }

    if (typeof onLogin !== "function") {
      setError("El servicio de autenticación no está conectado.");
      return;
    }

    try {
      setCargando(true);

      await onLogin(nombreUsuario, password);

      navigate("/", { replace: true });

    } catch (err) {
      setError(
        err.message || "No se pudo iniciar sesión."
      );
    } finally {
      setCargando(false);
    }
  }

  return (
    <main className="login-page">

      {/* PANEL IZQUIERDO */}
      <section className="login-visual">

        <div className="login-visual-overlay" />

        <div className="login-brand">
          <div className="login-brand-icon">
            <Warehouse size={27} />
          </div>

          <div>
            <strong>CONTROL DE ALMACÉN</strong>
            <span>Gestión de inventario</span>
          </div>
        </div>

        <div className="login-visual-content">

          <span className="login-tag">
            SISTEMA DE GESTIÓN
          </span>

          <h1>
            Organización,
            <br />
            control y eficiencia
            <br />
            en cada componente.
          </h1>

          <p>
            Gestiona los repuestos, consulta sus ubicaciones
            y mantén el control de los componentes del área
            de motores.
          </p>

          <div className="login-visual-line" />

        </div>

        <div className="login-visual-footer">
          SISTEMA DE CONTROL DE ALMACÉN
        </div>

      </section>

      {/* PANEL DERECHO */}
      <section className="login-form-panel">

        <div className="login-form-container">

          <div className="login-mobile-brand">
            <div className="login-brand-icon">
              <Warehouse size={25} />
            </div>

            <strong>CONTROL DE ALMACÉN</strong>
          </div>

          {/* ENCABEZADO */}
          <div className="login-heading">

            <div className="login-heading-icon">
              <ShieldCheck size={25} />
            </div>

            <span>BIENVENIDO AL SISTEMA</span>

            <h2>Iniciar sesión</h2>

            <p>
              Ingresa tus credenciales para acceder
              al sistema de gestión de almacén.
            </p>

          </div>

          {/* FORMULARIO */}
          <form onSubmit={manejarLogin}>

            {/* USUARIO */}
            <div className="login-field">

              <label htmlFor="usuario">
                Usuario
              </label>

              <div className="login-input-wrapper">

                <UserRound size={19} />

                <input
                  id="usuario"
                  type="text"
                  placeholder="Ingresa tu usuario"
                  value={usuario}
                  onChange={(e) => setUsuario(e.target.value)}
                  autoComplete="username"
                  autoFocus
                  required
                />

              </div>

            </div>

            {/* CONTRASEÑA */}
            <div className="login-field">

              <label htmlFor="password">
                Contraseña
              </label>

              <div className="login-input-wrapper">

                <LockKeyhole size={19} />

                <input
                  id="password"
                  type={mostrarPassword ? "text" : "password"}
                  placeholder="Ingresa tu contraseña"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />

                <button
                  type="button"
                  className="login-password-toggle"
                  onClick={() =>
                    setMostrarPassword((actual) => !actual)
                  }
                  aria-label={
                    mostrarPassword
                      ? "Ocultar contraseña"
                      : "Mostrar contraseña"
                  }
                >
                  {mostrarPassword
                    ? <EyeOff size={19} />
                    : <Eye size={19} />
                  }
                </button>

              </div>

            </div>

            {/* ERROR */}
            {error && (
              <div className="login-error" role="alert">
                {error}
              </div>
            )}

            {/* INGRESAR */}
            <button
              type="submit"
              className="login-submit"
              disabled={cargando}
            >
              <span>
                {cargando
                  ? "Ingresando..."
                  : "Ingresar al sistema"}
              </span>

              {!cargando && <ArrowRight size={19} />}

            </button>

          </form>

          {/* SEGURIDAD */}
          <div className="login-security">
            <LockKeyhole size={15} />

            <span>
              Acceso protegido para personal autorizado
            </span>
          </div>

        </div>

        <footer className="login-footer">
          Control de Almacén · Gestión de inventario
        </footer>

      </section>

    </main>
  );
}

export default LoginPage;
