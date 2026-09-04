'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AdminPermission, AdminRole } from '@/features/admin';
import {
  createRole,
  deleteRole,
  listPermissions,
  listRoles,
  replaceRolePermissions,
  updateRole,
} from '@/features/admin';
import { useSession } from '@/features/auth';
import { PageShell } from '@/shared/components/page-shell';
import { can } from '@/shared/permissions/can';
import { ApiError } from '@/shared/services/api-client';
import { Icon, Spinner } from '@/shared/ui';
import { useUnsavedChangesGuard } from '@/features/admin/hooks/use-unsaved-changes-guard';
import styles from './roles.module.css';

const ADMIN_REQUIRED = new Set([
  'users.read', 'users.create', 'users.update', 'users.deactivate',
  'roles.read', 'roles.manage', 'admin.users.manage', 'admin.roles.manage',
  'admin.audit.read',
]);

const GROUP_LABELS: Record<string, string> = {
  users: 'Usuarios', roles: 'Roles', admin: 'Administración', patients: 'Pacientes',
  records: 'Historias clínicas', documents: 'Documentos', entities: 'Entidades', review: 'Revisión',
};

function permissionGroup(key: string): string {
  return key.split('.')[0] ?? 'otros';
}

function normalizeRoleKey(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

export function RolesView() {
  const { user } = useSession();
  const router = useRouter();
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [permissions, setPermissions] = useState<AdminPermission[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');

  const canManageCatalog = Boolean(user && can(user.permissions, 'roles.manage'));
  const canManageMatrix = Boolean(user && can(user.permissions, 'admin.roles.manage'));
  const actorPermissions = useMemo(() => new Set(user?.permissions ?? []), [user]);
  const selected = roles.find((role) => role.id === selectedId) ?? null;
  const groupedPermissions = useMemo(() => {
    const groups = new Map<string, AdminPermission[]>();
    for (const permission of permissions) {
      const group = permissionGroup(permission.key);
      groups.set(group, [...(groups.get(group) ?? []), permission]);
    }
    return [...groups.entries()];
  }, [permissions]);
  const matrixHasHigherPermissions = Boolean(selected?.permissions.some(({ key }) => !actorPermissions.has(key)));
  const metadataDirty = Boolean(selected && (name.trim() !== selected.name || description.trim() !== (selected.description ?? '')));
  const permissionDirty = Boolean(selected && (
    selectedPermissions.size !== selected.permissions.length
    || selected.permissions.some(({ key }) => !selectedPermissions.has(key))
  ));
  const createDirty = showCreate && Boolean(
    newKey.trim() || newName.trim() || newDescription.trim(),
  );
  const hasUnsavedChanges = metadataDirty || permissionDirty || createDirty;
  useUnsavedChangesGuard(
    hasUnsavedChanges,
    'Hay cambios del rol sin guardar. ¿Deseas salir y descartarlos?',
  );

  useEffect(() => {
    let active = true;
    Promise.all([listRoles(), listPermissions()])
      .then(([loadedRoles, loadedPermissions]) => {
        if (!active) return;
        setRoles(loadedRoles);
        setPermissions(loadedPermissions);
        const initialRole = loadedRoles[0] ?? null;
        setSelectedId(initialRole?.id ?? null);
        setName(initialRole?.name ?? '');
        setDescription(initialRole?.description ?? '');
        setSelectedPermissions(new Set(initialRole?.permissions.map(({ key }) => key) ?? []));
        setError(null);
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : 'No se pudieron cargar los roles.');
      })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, []);

  function applyRoleSelection(role: AdminRole) {
    setSelectedId(role.id);
    setName(role.name);
    setDescription(role.description ?? '');
    setSelectedPermissions(new Set(role.permissions.map(({ key }) => key)));
    setNotice(null);
    setError(null);
  }

  function requestRoleSelection(role: AdminRole) {
    if (role.id === selectedId) return;
    if (
      hasUnsavedChanges
      && !window.confirm('Hay cambios sin guardar. ¿Deseas cambiar de rol y descartarlos?')
    ) return;
    if (createDirty) {
      setNewKey('');
      setNewName('');
      setNewDescription('');
      setShowCreate(false);
    }
    applyRoleSelection(role);
  }

  function toggleCreatePanel() {
    if (
      (showCreate ? createDirty : hasUnsavedChanges)
      && !window.confirm(
        showCreate
          ? 'Hay datos del nuevo rol sin guardar. ¿Deseas descartarlos?'
          : 'Hay cambios sin guardar. ¿Deseas descartarlos y crear otro rol?',
      )
    ) return;
    if (!showCreate && selected && hasUnsavedChanges) {
      setName(selected.name);
      setDescription(selected.description ?? '');
      setSelectedPermissions(new Set(selected.permissions.map(({ key }) => key)));
    }
    if (showCreate) {
      setNewKey('');
      setNewName('');
      setNewDescription('');
    }
    setShowCreate((value) => !value);
  }

  function goToUsers() {
    if (hasUnsavedChanges && !window.confirm('Hay cambios sin guardar. ¿Deseas salir?')) return;
    router.push('/admin/users');
  }

  function replaceRoleInState(updated: AdminRole) {
    setRoles((current) => current.map((role) => role.id === updated.id ? updated : role));
  }

  async function saveMetadata(event: React.FormEvent) {
    event.preventDefault();
    if (!selected || !canManageCatalog || !metadataDirty) return;
    setIsSaving(true); setError(null); setNotice(null);
    try {
      const updated = await updateRole(
        selected.id,
        { name: name.trim(), description: description.trim() },
        selected.updatedAt,
      );
      replaceRoleInState(updated);
      setNotice('Datos del rol actualizados.');
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'No se pudo actualizar el rol.');
    } finally { setIsSaving(false); }
  }

  async function savePermissions() {
    if (!selected || !canManageMatrix || matrixHasHigherPermissions || !permissionDirty) return;
    setIsSaving(true); setError(null); setNotice(null);
    try {
      const updated = await replaceRolePermissions(
        selected.id,
        [...selectedPermissions],
        selected.updatedAt,
      );
      replaceRoleInState(updated);
      setNotice('Matriz de permisos actualizada. Las sesiones afectadas fueron revocadas.');
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'No se pudo actualizar la matriz.');
    } finally { setIsSaving(false); }
  }

  function togglePermission(key: string) {
    setSelectedPermissions((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
    setNotice(null);
  }

  async function createNewRole(event: React.FormEvent) {
    event.preventDefault();
    setIsSaving(true); setError(null); setNotice(null);
    try {
      const created = await createRole({ key: newKey, name: newName.trim(), description: newDescription.trim() || undefined });
      setRoles((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name, 'es')));
      applyRoleSelection(created);
      setNewKey(''); setNewName(''); setNewDescription(''); setShowCreate(false);
      setNotice('Rol creado sin permisos. Configura su matriz antes de asignarlo.');
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'No se pudo crear el rol.');
    } finally { setIsSaving(false); }
  }

  async function removeSelected() {
    if (!selected || selected.isSystem || selected.userCount > 0) return;
    if (!window.confirm(`Eliminar el rol "${selected.name}"? Esta acción no se puede deshacer.`)) return;
    setIsSaving(true); setError(null);
    try {
      await deleteRole(selected.id, selected.updatedAt);
      const remaining = roles.filter((role) => role.id !== selected.id);
      setRoles(remaining);
      if (remaining[0]) applyRoleSelection(remaining[0]);
      else {
        setSelectedId(null);
        setName('');
        setDescription('');
        setSelectedPermissions(new Set());
      }
      setNotice('Rol personalizado eliminado.');
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'No se pudo eliminar el rol.');
    } finally { setIsSaving(false); }
  }

  return (
    <PageShell>
      <header className={styles.pageHeader}>
        <div>
          <h1>Roles y permisos</h1>
          <p>Define accesos por capacidad y conserva una administración segura.</p>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.secondaryButton} type="button" onClick={goToUsers}><Icon name="users" size={16} /> Usuarios</button>
          {canManageCatalog && <button className={styles.primaryButton} type="button" onClick={toggleCreatePanel} aria-expanded={showCreate} aria-controls="create-role-panel"><Icon name="shield" size={16} /> Nuevo rol</button>}
        </div>
      </header>

      {showCreate && (
        <form id="create-role-panel" className={styles.createPanel} data-unsaved-guard-submit="allow" onSubmit={(event) => void createNewRole(event)}>
          <div><h2>Crear rol personalizado</h2><p>La clave queda fija; los permisos se agregan después de crearlo.</p></div>
          <label>Nombre<input value={newName} minLength={2} maxLength={80} onChange={(e) => { setNewName(e.target.value); if (!newKey) setNewKey(normalizeRoleKey(e.target.value)); }} required /></label>
          <label>Clave<input value={newKey} minLength={3} maxLength={50} pattern="[A-Z][A-Z0-9_]*" onChange={(e) => setNewKey(normalizeRoleKey(e.target.value))} required /><small>MAYUSCULAS_Y_GUIONES</small></label>
          <label className={styles.createDescription}>Descripción<input value={newDescription} maxLength={240} onChange={(e) => setNewDescription(e.target.value)} /></label>
          <div className={styles.formActions}><button className={styles.secondaryButton} type="button" onClick={toggleCreatePanel}>Cancelar</button><button className={styles.primaryButton} type="submit" disabled={isSaving}>Crear rol</button></div>
        </form>
      )}

      {error && <p className={styles.error} role="alert">{error}</p>}
      {notice && <p className={styles.notice} role="status">{notice}</p>}
      {isLoading && <Spinner label="Cargando roles…" />}

      {!isLoading && (
        <div className={styles.layout}>
          <section className={styles.roleList} aria-labelledby="role-list-title">
            <div className={styles.panelHeader}><h2 id="role-list-title">Catálogo</h2><span>{roles.length}</span></div>
            <div className={styles.roleOptions}>
              {roles.map((role) => (
                <button key={role.id} className={`${styles.roleOption} ${role.id === selectedId ? styles.roleOptionActive : ''}`} type="button" onClick={() => requestRoleSelection(role)} aria-pressed={role.id === selectedId}>
                  <span className={styles.roleOptionTop}><strong>{role.name}</strong>{role.isSystem && <span className={styles.systemBadge}>Base</span>}</span>
                  <code>{role.key}</code>
                  <span>{role.permissions.length} permisos · {role.userCount} usuarios</span>
                </button>
              ))}
              {roles.length === 0 && <p className={styles.empty}>No hay roles registrados.</p>}
            </div>
          </section>

          <section className={styles.editor} aria-live="polite">
            {!selected ? <p className={styles.empty}>Selecciona un rol para administrarlo.</p> : <>
              <form className={styles.metadataForm} data-unsaved-guard-submit="allow" onSubmit={(event) => void saveMetadata(event)}>
                <div className={styles.editorHeader}>
                  <div><span className={styles.eyebrow}>Rol seleccionado</span><h2>{selected.name}</h2><code>{selected.key}</code></div>
                  {canManageCatalog && !selected.isSystem && <button className={styles.dangerButton} type="button" onClick={() => void removeSelected()} disabled={selected.userCount > 0 || isSaving} title={selected.userCount > 0 ? 'Reasigna sus usuarios antes de eliminarlo' : undefined}>Eliminar rol</button>}
                </div>
                <div className={styles.metadataGrid}>
                  <label>Nombre<input value={name} maxLength={80} minLength={2} onChange={(e) => setName(e.target.value)} disabled={!canManageCatalog} required /></label>
                  <label>Descripción<textarea value={description} maxLength={240} rows={2} onChange={(e) => setDescription(e.target.value)} disabled={!canManageCatalog} /></label>
                </div>
                {canManageCatalog && <div className={styles.formActions}><button className={styles.secondaryButton} type="button" onClick={() => { setName(selected.name); setDescription(selected.description ?? ''); }} disabled={!metadataDirty || isSaving}>Descartar</button><button className={styles.primaryButton} type="submit" disabled={!metadataDirty || isSaving}>Guardar datos</button></div>}
              </form>

              <div className={styles.matrixHeader}><div><h3>Matriz de permisos</h3><p>Marca solo las capacidades necesarias para este rol.</p></div><span>{selectedPermissions.size} de {permissions.length}</span></div>
              {matrixHasHigherPermissions && <p className={styles.warning} role="note">Este rol contiene capacidades superiores a las tuyas; no puedes modificarlo.</p>}
              <div className={styles.permissionGroups}>
                {groupedPermissions.map(([group, items]) => (
                  <fieldset key={group} className={styles.permissionGroup} disabled={!canManageMatrix || matrixHasHigherPermissions || isSaving}>
                    <legend>{GROUP_LABELS[group] ?? group}</legend>
                    {items.map((permission) => {
                      const requiredAdminPermission =
                        selected.key === 'ADMINISTRADOR'
                        && ADMIN_REQUIRED.has(permission.key)
                        && selectedPermissions.has(permission.key);
                      const unavailable = !actorPermissions.has(permission.key);
                      return (
                        <label key={permission.id} className={`${styles.permissionItem} ${(unavailable || requiredAdminPermission) ? styles.permissionItemLocked : ''}`}>
                          <input type="checkbox" checked={selectedPermissions.has(permission.key)} onChange={() => togglePermission(permission.key)} disabled={unavailable || requiredAdminPermission} />
                          <span><strong>{permission.key}</strong><small>{permission.description ?? 'Sin descripción.'}</small></span>
                        </label>
                      );
                    })}
                  </fieldset>
                ))}
              </div>
              {canManageMatrix && <div className={styles.matrixActions}><p>Guardar revoca las sesiones de los usuarios afectados.</p><button className={styles.primaryButton} type="button" onClick={() => void savePermissions()} disabled={!permissionDirty || matrixHasHigherPermissions || isSaving}>Guardar permisos</button></div>}
            </>}
          </section>
        </div>
      )}
    </PageShell>
  );
}
