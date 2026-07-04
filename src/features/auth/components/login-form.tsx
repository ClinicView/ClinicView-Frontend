'use client';

import { FormEvent, useState } from 'react';
import { Icon } from '@/shared/ui';
import { useLogin } from '../hooks/use-login';
import styles from './login-form.module.css';

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const { login, isLoading, error } = useLogin();

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await login(email, password);
  }

  return (
    <div className={styles.wrapper}>
      {/* Panel izquierdo — marca e ilustración */}
      <div className={styles.brandPanel}>
        <div className={styles.brandHeader}>
          <span className={styles.logoMark} aria-hidden="true">PC</span>
          <span className={styles.logoText}>
            <span className={styles.logoName}>Plataforma Clínica</span>
            <span className={styles.logoSub}>HOSPITALARIA</span>
          </span>
        </div>

        <h1 className={styles.brandHeadline}>
          Digitalizamos la información para mejorar la atención
        </h1>
        <p className={styles.brandTagline}>
          Sistema integral de digitalización, registro y gestión de historias
          clínicas para equipos de salud.
        </p>

        <div className={styles.illustration} aria-hidden="true">
          <div className={styles.docCard}>
            <div className={styles.docCardHeader}>
              <span className={styles.docCardAvatar}>
                <Icon name="patient" size={16} />
              </span>
              <span className={styles.docCardTitle}>Historia Clínica</span>
            </div>
            {['Datos del paciente', 'Motivo de consulta', 'Antecedentes', 'Examen físico'].map(
              (section) => (
                <div key={section} className={styles.docCardSection}>
                  <span className={styles.docCardLabel}>{section}</span>
                  <span className={styles.docCardLine} />
                  <span className={`${styles.docCardLine} ${styles.docCardLineShort}`} />
                </div>
              ),
            )}
            <span className={styles.ocrBadge}>
              <Icon name="check" size={13} /> OCR
            </span>
          </div>
        </div>
      </div>

      {/* Panel derecho — formulario */}
      <div className={styles.formPanel}>
        <div className={styles.formCard}>
          <div className={styles.formBrand}>
            <span className={styles.logoMark} aria-hidden="true">PC</span>
            <span className={styles.logoText}>
              <span className={`${styles.logoName} ${styles.logoNameDark}`}>Plataforma Clínica</span>
              <span className={styles.logoSub}>HOSPITALARIA</span>
            </span>
          </div>

          <div className={styles.formHeader}>
            <h2 className={styles.formTitle}>Iniciar sesión</h2>
            <p className={styles.formSubtitle}>Accede con tus credenciales institucionales</p>
          </div>

          <form onSubmit={handleSubmit} className={styles.form} noValidate>
            <div className={styles.field}>
              <label htmlFor="email" className={styles.label}>
                Correo electrónico
              </label>
              <div className={styles.inputWrap}>
                <span className={styles.inputIcon} aria-hidden="true">
                  <Icon name="mail" size={17} />
                </span>
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
            </div>

            <div className={styles.field}>
              <label htmlFor="password" className={styles.label}>
                Contraseña
              </label>
              <div className={styles.inputWrap}>
                <span className={styles.inputIcon} aria-hidden="true">
                  <Icon name="lock" size={17} />
                </span>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  className={`${styles.input} ${styles.inputPassword}`}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  disabled={isLoading}
                  required
                  placeholder="••••••••••"
                />
                <button
                  type="button"
                  className={styles.eyeBtn}
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  tabIndex={-1}
                >
                  <Icon name={showPassword ? 'eye-off' : 'eye'} size={17} />
                </button>
              </div>
            </div>

            <label className={styles.remember}>
              <input
                type="checkbox"
                className={styles.checkbox}
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                disabled={isLoading}
              />
              Recordarme
            </label>

            {error && (
              <p role="alert" className={styles.error}>
                <Icon name="alert" size={16} />
                {error === 'login_failed'
                  ? 'Correo o contraseña incorrectos. Verifica tus credenciales.'
                  : 'No se pudo conectar al servidor. Inténtalo nuevamente.'}
              </p>
            )}

            <button type="submit" className={styles.button} disabled={isLoading}>
              {isLoading ? 'Verificando…' : 'Ingresar al sistema'}
              {!isLoading && <Icon name="arrow-right" size={17} />}
            </button>
          </form>

          <hr className={styles.divider} />

          <p className={styles.secureNote}>
            <Icon name="shield" size={15} />
            Acceso seguro para personal autorizado
          </p>
        </div>
      </div>
    </div>
  );
}
