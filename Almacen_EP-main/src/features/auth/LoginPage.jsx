
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

      {/* PANEL VISUAL IZQUIERDO */}

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

      {/* PANEL DEL FORMULARIO */}

      <section className="login-form-panel">

        <div className="login-form-container">

          {/* MARCA PARA CELULARES */}

          <div className="login-mobile-brand">

            <div className="login-brand-icon">
              <Warehouse size={25} />
            </div>

            <div>
              <strong>CONTROL DE ALMACÉN /</strong>
              <span> M.A.R.I.O.</span>
            </div>

          </div>

          {/* ENCABEZADO */}

          <div className="login-heading">


            <span>BIENVENIDO</span>

            <h2>Iniciar sesión</h2>

          </div>

          {/* FORMULARIO */}

          <form onSubmit={manejarLogin}>

            {/* USUARIO */}

            <div className="login-field">

              <label htmlFor="usuario">
                Usuario
              </label>

              <div className="login-input-wrapper">

                <UserRound size={19} aria-hidden="true" />

                <input
                  id="usuario"
                  type="text"
                  placeholder="Ingresa tu usuario"
                  value={usuario}
                  onChange={(e) => {
                    setUsuario(e.target.value);
                    setError("");
                  }}
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                  disabled={cargando}
                />

              </div>

            </div>

            {/* CONTRASEÑA */}

            <div className="login-field">

              <label htmlFor="password">
                Contraseña
              </label>

              <div className="login-input-wrapper">

                <LockKeyhole size={19} aria-hidden="true" />

                <input
                  id="password"
                  type={mostrarPassword ? "text" : "password"}
                  placeholder="Ingresa tu contraseña"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError("");
                  }}
                  autoComplete="current-password"
                  required
                  disabled={cargando}
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
                  aria-pressed={mostrarPassword}
                  disabled={cargando}
                >
                  {mostrarPassword
                    ? <EyeOff size={19} />
                    : <Eye size={19} />
                  }
                </button>

              </div>

            </div>

            {/* MENSAJE DE ERROR */}

            {error && (
              <div
                className="login-error"
                role="alert"
                aria-live="assertive"
              >
                {error}
              </div>
            )}

            {/* BOTÓN DE INGRESO */}

            <button
              type="submit"
              className="login-submit"
              disabled={cargando}
              aria-busy={cargando}
            >

              <span>
                {cargando
                  ? "Ingresando..."
                  : "Ingresar"}
              </span>

              {!cargando && (
                <ArrowRight size={19} />
              )}

            </button>

          </form>

          {/* SEGURIDAD */}

          <div className="login-security">

            <LockKeyhole size={15} />

            <span>
              Acceso protegido para personal Grupo Pana
            </span>

          </div>

        </div>

        {/* PIE DE PÁGINA */}

        <footer className="login-footer">
          GRUPO PANA
        </footer>

      </section>

    </main>
  );
}

export default LoginPage;
