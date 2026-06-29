'use client';

import { FormEvent, useState } from 'react';
import { useLogin } from '../hooks/use-login';
import styles from './login-form.module.css';

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, isLoading, error } = useLogin();

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await login(email, password);
  }

  return (
    <div className={styles.wrapper}>
      {/* Panel izquierdo — marca */}
      <div className={styles.brandPanel}>
        <div className={styles.logoMark} aria-hidden="true">PC</div>
        <h1 className={styles.brandName}>Plataforma Clínica Hospitalaria</h1>
        <p className={styles.brandTagline}>
          Sistema integral de digitalización, registro y gestión de historias clínicas para equipos de salud.
        </p>
        <ul className={styles.features} aria-label="Características del sistema">
          <li className={styles.featureItem}>
            <span className={styles.featureDot} aria-hidden="true" />
            Gestión de pacientes e historias clínicas
          </li>
          <li className={styles.featureItem}>
            <span className={styles.featureDot} aria-hidden="true" />
            Digitalización de documentos con extracción automática
          </li>
          <li className={styles.featureItem}>
            <span className={styles.featureDot} aria-hidden="true" />
            Control de acceso basado en roles clínicos
          </li>
        </ul>
      </div>

      {/* Panel derecho — formulario */}
      <div className={styles.formPanel}>
        <div className={styles.formHeader}>
          <h2 className={styles.formTitle}>Iniciar sesión</h2>
          <p className={styles.formSubtitle}>Ingresa con tus credenciales institucionales</p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form} noValidate>
          <div className={styles.field}>
            <label htmlFor="email" className={styles.label}>
              Correo electrónico
            </label>
            <input
              id="email"
              type="email"
              className={styles.input}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              autoFocus
              disabled={isLoading}
              required
              placeholder="usuario@hospital.org"
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="password" className={styles.label}>
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              className={styles.input}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              disabled={isLoading}
              required
            />
          </div>

          {error && (
            <p role="alert" className={styles.error}>
              <span aria-hidden="true">⚠</span>
              {error === 'login_failed'
                ? 'Correo o contraseña incorrectos. Verifica tus credenciales.'
                : 'No se pudo conectar al servidor. Inténtalo nuevamente.'}
            </p>
          )}

          <button type="submit" className={styles.button} disabled={isLoading}>
            {isLoading ? 'Verificando…' : 'Ingresar al sistema'}
          </button>
        </form>
      </div>
    </div>
  );
}
