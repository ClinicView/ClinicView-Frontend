'use client';

import Image from 'next/image';
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
    <main className={styles.wrapper}>
      <section className={styles.brandPanel} aria-labelledby="login-brand-heading">
        <Image
          src="/images/clinic-login-hero.png"
          alt=""
          fill
          priority
          sizes="(max-width: 767px) 100vw, 56vw"
          className={styles.heroImage}
        />

        <div className={styles.brandContent}>
          <div className={styles.brandHeader}>
            <span className={styles.logoMark} aria-hidden="true">
              CV
            </span>
            <span className={styles.logoText}>
              <span className={styles.logoName}>ClinicView</span>
              <span className={styles.logoSub}>PLATAFORMA CLÍNICA</span>
            </span>
          </div>

          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}>
              <span className={styles.eyebrowDot} aria-hidden="true" />
              Tecnología al servicio del cuidado
            </span>
            <h1 id="login-brand-heading" className={styles.brandHeadline}>
              La información correcta, cuando más importa.
            </h1>
            <p className={styles.brandTagline}>
              Historias clínicas organizadas, accesibles y seguras para que cada profesional
              pueda dedicar más tiempo a sus pacientes.
            </p>
          </div>

          <div className={styles.heroProof} aria-label="Beneficios de la plataforma">
            <span className={styles.proofItem}>
              <Icon name="shield" size={17} />
              Información protegida
            </span>
            <span className={styles.proofDivider} aria-hidden="true" />
            <span className={styles.proofItem}>
              <Icon name="check" size={17} />
              Gestión trazable
            </span>
          </div>
        </div>
      </section>

      <section className={styles.formPanel} aria-labelledby="login-title">
        <div className={styles.formCard}>
          <div className={styles.formBrand}>
            <span className={styles.logoMark} aria-hidden="true">
              CV
            </span>
            <span className={styles.logoText}>
              <span className={`${styles.logoName} ${styles.logoNameDark}`}>
                ClinicView
              </span>
              <span className={styles.logoSub}>PLATAFORMA CLÍNICA</span>
            </span>
          </div>

          <div className={styles.formHeader}>
            <span className={styles.formKicker}>Acceso institucional</span>
            <h2 id="login-title" className={styles.formTitle}>
              Bienvenido de nuevo
            </h2>
            <p className={styles.formSubtitle}>
              Ingresa tus credenciales para continuar a tu espacio clínico.
            </p>
          </div>

          <form onSubmit={handleSubmit} className={styles.form} noValidate aria-busy={isLoading}>
            <div className={styles.field}>
              <label htmlFor="email" className={styles.label}>
                Correo electrónico
              </label>
              <div className={styles.inputWrap}>
                <span className={styles.inputIcon} aria-hidden="true">
                  <Icon name="mail" size={18} />
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
                  aria-invalid={error === 'login_failed' ? true : undefined}
                  aria-describedby={error === 'login_failed' ? 'login-error' : undefined}
                />
              </div>
            </div>

            <div className={styles.field}>
              <label htmlFor="password" className={styles.label}>
                Contraseña
              </label>
              <div className={styles.inputWrap}>
                <span className={styles.inputIcon} aria-hidden="true">
                  <Icon name="lock" size={18} />
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
                  aria-invalid={error === 'login_failed' ? true : undefined}
                  aria-describedby={error === 'login_failed' ? 'login-error' : undefined}
                />
                <button
                  type="button"
                  className={styles.eyeBtn}
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  aria-controls="password"
                  aria-pressed={showPassword}
                >
                  <Icon name={showPassword ? 'eye-off' : 'eye'} size={18} />
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
              <span>Recordarme en este dispositivo</span>
            </label>

            {error && (
              <p id="login-error" role="alert" className={styles.error}>
                <Icon name="alert" size={17} />
                <span>
                  {error === 'login_failed'
                    ? 'Correo o contraseña incorrectos. Verifica tus credenciales.'
                    : 'No se pudo conectar al servidor. Inténtalo nuevamente.'}
                </span>
              </p>
            )}

            <button type="submit" className={styles.button} disabled={isLoading}>
              <span>{isLoading ? 'Verificando…' : 'Ingresar al sistema'}</span>
              {!isLoading && <Icon name="arrow-right" size={18} />}
            </button>
          </form>

          <div className={styles.securityFooter}>
            <span className={styles.securityIcon} aria-hidden="true">
              <Icon name="shield" size={17} />
            </span>
            <p className={styles.secureNote}>
              Conexión segura. Acceso exclusivo para personal autorizado.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
