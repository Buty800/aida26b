import { TableStructure } from '../types/types';

type LocalizedText = {
  es: string;
  en: string;
};

function getCurrentLanguage(): keyof LocalizedText {
  return globalThis.localStorage?.getItem('language') === 'en' ? 'en' : 'es';
}

function localizeText(text: LocalizedText): string {
  return text[getCurrentLanguage()] ?? text.es;
}

export const structure = {
  tables: {
    users: {
      columns: {
        username: {
          type: 'string',
          label: { es: 'Nombre de usuario (@)', en: 'Username (@)' },
          readonlyOnEdit: true,
          validator: {
            required: true,
          },
        },
        displayname: {
          type: 'string',
          label: { es: 'Nombre a Mostrar', en: 'Display Name' },
          validator: {
            required: true,
          },
        },
        password: {
          type: 'string',
          label: { es: 'Contraseña', en: 'Password' },
          validator: {
            required: true,
          },
        },
        created_at: {
          type: 'string',
          label: { es: 'Fecha de Creación', en: 'Created At' },
          input: 'date',
          editable: false,
        },
      },
      pk: 'username',
      uiName: { es: 'Usuario', en: 'User' },
      title: { es: 'Usuarios', en: 'Users' },
      addButtonLabel: { es: 'Agregar Usuario', en: 'Add User' },
    } satisfies TableStructure,

    friends: {
      columns: {
        friend1: {
          type: 'string',
          label: { es: 'Amigo 1', en: 'Friend 1' },
          input: 'select',
          validator: {
            required: true,
          },
          foreignKey: {
            table: 'users',
            valueField: 'username',
            labelField: 'displayname',
          },
        },
        friend2: {
          type: 'string',
          label: { es: 'Amigo 2', en: 'Friend 2' },
          input: 'select',
          validator: {
            required: true,
          },
          foreignKey: {
            table: 'users',
            valueField: 'username',
            labelField: 'displayname',
          },
        },
        request: {
          type: 'string',
          label: { es: 'Estado de Solicitud', en: 'Request Status' },
          input: 'select',
          validator: {
            required: true,
          },
          options: [
            { value: 'pending', label: { es: 'Pendiente', en: 'Pending' } },
            { value: 'accepted', label: { es: 'Aceptado', en: 'Accepted' } },
            { value: 'rejected', label: { es: 'Rechazado', en: 'Rejected' } },
          ],
        },
      },
      pk: ['friend1', 'friend2'],
      uiName: { es: 'Amigo', en: 'Friend' },
      title: { es: 'Amigos', en: 'Friends' },
      addButtonLabel: { es: 'Agregar Amigo', en: 'Add Friend' },
    } satisfies TableStructure,

    groups: {
      columns: {
        id: {
          type: 'string',
          label: { es: 'ID Grupo', en: 'Group ID' },
          editable: false,
          readonlyOnEdit: true,
        },
        displayname: {
          type: 'string',
          label: { es: 'Nombre de Grupo', en: 'Group Name' },
          validator: {
            required: true,
          },
        },
        description: {
          type: 'string',
          label: { es: 'Descripción', en: 'Description' },
          input: 'textarea',
          validator: {
            nullable: true,
          },
        },
        created_at: {
          type: 'string',
          label: { es: 'Fecha de Creación', en: 'Created At' },
          input: 'date',
          editable: false,
        },
      },
      pk: 'id',
      uiName: { es: 'Grupo', en: 'Group' },
      title: { es: 'Grupos', en: 'Groups' },
      addButtonLabel: { es: 'Agregar Grupo', en: 'Add Group' },
    } satisfies TableStructure,

    user_group: {
      columns: {
        id_relation: {
          type: 'string',
          label: { es: 'ID de Relación', en: 'Relation ID' },
          editable: false,
          readonlyOnEdit: true,
        },
        user_id: {
          type: 'string',
          label: { es: 'Usuario', en: 'User' },
          input: 'select',
          validator: {
            required: true,
          },
          foreignKey: {
            table: 'users',
            valueField: 'username',
            labelField: 'displayname',
          },
        },
        group_id: {
          type: 'string',
          label: { es: 'Grupo', en: 'Group' },
          input: 'select',
          validator: {
            required: true,
          },
          foreignKey: {
            table: 'groups',
            valueField: 'id',
            labelField: 'displayname',
          },
        },
        created_at: {
          type: 'string',
          label: { es: 'Fecha de Creación', en: 'Created At' },
          input: 'date',
          editable: false,
        },
        role: {
          type: 'string',
          label: { es: 'Rol', en: 'Role' },
          validator: {
            required: true,
          },
        },
        status: {
          type: 'string',
          label: { es: 'Estado', en: 'Status' },
          input: 'select',
          validator: {
            required: true,
          },
          options: [
            { value: 'invited', label: { es: 'Invitado', en: 'Invited' } },
            { value: 'active', label: { es: 'Activo', en: 'Active' } },
            { value: 'left', label: { es: 'Se retiró', en: 'Left' } },
          ],
        },
      },
      pk: 'id_relation',
      uiName: { es: 'Miembro', en: 'Member' },
      title: { es: 'Miembros de Grupo', en: 'Group Members' },
      addButtonLabel: { es: 'Agregar Miembro', en: 'Add Member' },
    } satisfies TableStructure,

    track: {
      columns: {
        id: {
          type: 'number',
          label: { es: 'ID de Actividad', en: 'Activity ID' },
          editable: false,
          readonlyOnEdit: true,
        },
        title: {
          type: 'string',
          label: { es: 'Título', en: 'Title' },
          validator: {
            required: true,
          },
        },
        body: {
          type: 'string',
          label: { es: 'Cuerpo', en: 'Body' },
          input: 'textarea',
          validator: {
            nullable: true,
          },
        },
        group: {
          type: 'string',
          label: { es: 'Grupo', en: 'Group' },
          input: 'select',
          validator: {
            required: true,
          },
          foreignKey: {
            table: 'groups',
            valueField: 'id',
            labelField: 'displayname',
          },
        },
        status: {
          type: 'string',
          label: { es: 'Estado', en: 'Status' },
          validator: {
            required: true,
          },
        },
        created_at: {
          type: 'string',
          label: { es: 'Fecha de Creación', en: 'Created At' },
          input: 'date',
          editable: false,
        },
      },
      pk: 'id',
      uiName: { es: 'Actividad', en: 'Activity' },
      title: { es: 'Actividades', en: 'Activities' },
      addButtonLabel: { es: 'Agregar Actividad', en: 'Add Activity' },
    } satisfies TableStructure,

    log: {
      columns: {
        id: {
          type: 'string',
          label: { es: 'ID de Registro', en: 'Log ID' },
          editable: false,
          readonlyOnEdit: true,
        },
        user_id: {
          type: 'string',
          label: { es: 'Usuario', en: 'User' },
          input: 'select',
          validator: {
            required: true,
          },
          foreignKey: {
            table: 'users',
            valueField: 'username',
            labelField: 'displayname',
          },
        },
        track: {
          type: 'number',
          label: { es: 'Actividad', en: 'Activity' },
          input: 'select',
          validator: {
            required: true,
          },
          foreignKey: {
            table: 'track',
            valueField: 'id',
            labelField: 'title',
          },
        },
        value: {
          type: 'number',
          label: { es: 'Valor', en: 'Value' },
          input: 'number',
          validator: {
            required: true,
            integer: true,
            minValue: 0,
          },
        },
        fecha: {
          type: 'string',
          label: { es: 'Fecha', en: 'Date' },
          input: 'date',
          validator: {
            required: true,
          },
        },
        commentar: {
          type: 'string',
          label: { es: 'Comentario', en: 'Comment' },
          validator: {
            nullable: true,
          },
        },
      },
      pk: 'id',
      uiName: { es: 'Registro', en: 'Log' },
      title: { es: 'Registros de Actividades', en: 'Activity Logs' },
      addButtonLabel: { es: 'Agregar Registro', en: 'Add Log' },
    } satisfies TableStructure,
  },

  menu: {
    theme: {
      title: { es: 'Tema', en: 'Theme' },
      id: 'theme-picker',
      handler: (value: string) => {
        try {
          if (!value) throw new Error('Theme value is required');

          document.body.setAttribute('data-theme', value);
          localStorage.setItem('theme', value);
        } catch (err) {
          console.error('Error changing theme:', err);
          alert(localizeText(structure.commonText.themeChangeError));
        }
      },
      options: [
        { value: 'light', label: { es: 'Claro', en: 'Light' } },
        { value: 'dark', label: { es: 'Oscuro', en: 'Dark' } },
      ],
      initial: () => localStorage.getItem('theme') || 'light',
    },

    language: {
      title: { es: 'Idioma', en: 'Language' },
      id: 'language-picker',
      handler: (value: string) => {
        try {
          if (value !== 'es' && value !== 'en') {
            throw new Error('Invalid language value');
          }

          localStorage.setItem('language', value);

          window.dispatchEvent(
            new CustomEvent('languagechange', {
              detail: { language: value },
            })
          );
        } catch (err) {
          console.error('Error changing language:', err);
          alert(localizeText(structure.commonText.languageChangeError));
        }
      },
      options: [
        { value: 'es', label: { es: 'Español', en: 'Spanish' } },
        { value: 'en', label: { es: 'Inglés', en: 'English' } },
      ],
      initial: () => localStorage.getItem('language') || 'es',
    },
  },

  commonText: {
    actions: { es: 'Acciones', en: 'Actions' },
    add: { es: 'Agregar', en: 'Add' },
    appTitle: {
      es: 'Gestor de Base de Datos Tracker',
      en: 'Tracker DB Manager',
    },
    cancel: { es: 'Cancelar', en: 'Cancel' },
    delete: { es: 'Eliminar', en: 'Delete' },
    edit: { es: 'Editar', en: 'Edit' },
    update: { es: 'Actualizar', en: 'Update' },
    login: { es: 'Ingresar', en: 'Login' },
    password: { es: 'Contraseña', en: 'Password' },
    changePassword: { es: 'Cambiar contraseña', en: 'Change Password' },
    currentPassword: { es: 'Contraseña actual', en: 'Current Password' },
    newPassword: { es: 'Nueva contraseña', en: 'New Password' },
    logout: { es: 'Salir', en: 'Logout' },
    added: { es: 'agregado', en: 'added' },

    // Auth / session messages
    sessionExpired: { es: 'La sesión expiró', en: 'Session expired' },
    passwordChangeRequired: { es: 'Hay que cambiar la contraseña', en: 'Password change required' },
    noPermission: { es: 'No tenés permiso para esa acción', en: 'You do not have permission for that action' },
    invalidCredentials: { es: 'Credenciales inválidas', en: 'Invalid credentials' },
    loginError: { es: 'Error ingresando', en: 'Login error' },
    passwordChangeFailed: { es: 'No se pudo cambiar la contraseña', en: 'Password change failed' },
    passwordChangeError: { es: 'Error cambiando contraseña', en: 'Password change error' },
    themeChangeError: { es: 'Error al cambiar el tema', en: 'Error changing theme' },
    languageChangeError: { es: 'Error al cambiar el idioma', en: 'Error changing language' },

    // Data / record messages
    errorLoadingData: { es: 'Error cargando datos', en: 'Error loading data' },
    errorSaving: { es: 'Error guardando', en: 'Error saving' },
    errorDeleting: { es: 'Error eliminando', en: 'Error deleting' },
    errorLoadingRecord: { es: 'Error cargando registro', en: 'Error loading record' },

    // User management
    onlyAdminCanCreateUsers: { es: 'Solo admin puede crear usuarios', en: 'Only admin can create users' },
    errorCreatingUser: { es: 'Error creando usuario', en: 'Error creating user' },
    noEditPermission: { es: 'No tenés permiso para editar', en: 'You do not have edit permission' },
    studentAndUserCreated: { es: 'Alumno y usuario creados', en: 'Student and user created' },
    userAdded: { es: 'Usuario agregado', en: 'User added' },

    // Form labels
    initialPassword: { es: 'Contraseña inicial', en: 'Initial Password' },
    usernameLabel: { es: 'Usuario', en: 'Username' },
    emailLabel: { es: 'Email', en: 'Email' },
    editorRole: { es: 'Editor', en: 'Editor' },
    adminRole: { es: 'Admin', en: 'Admin' },
    readerRole: { es: 'Lector', en: 'Reader' },
    addUser: { es: 'Agregar usuario de sistema', en: 'Add system user' },
    roleLabel: { es: 'Rol', en: 'Role' },

    // Filters / pagination
    addFilter: { es: 'Agregar Filtro', en: 'Add Filter' },
    selectColumn: { es: 'Seleccionar columna', en: 'Select column' },
    pageInfo: { es: 'Página', en: 'Page' },
    pageOf: { es: 'de', en: 'of' },
    total: { es: 'Total', en: 'Total' },
    previous: { es: 'Anterior', en: 'Previous' },
    next: { es: 'Siguiente', en: 'Next' },
    filterPlaceholder: { es: 'Filtrar...', en: 'Filter...' },

    // Delete confirmation
    deleteConfirm: {
      es: '¿Está seguro de que desea eliminar este',
      en: 'Are you sure you want to delete this',
    },
  } satisfies Record<string, LocalizedText>,
};