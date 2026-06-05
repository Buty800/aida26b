import {TableStructure} from '../types/types';

export const structure = {
  tables: {
    students: {
      columns:{
        numero_libreta   :{type: 'string', label: "Número de Libreta / Student ID:", readonlyOnEdit: true, validator: { required: true, pattern: '^\\d{1,4}/\\d{2}$', patternMessage: 'must match pattern NNNN/YY (1-4 digit number, slash, 2-digit year; leading zeros optional on the number)', normalize: { pattern: '^0+(?=\\d)', replacement: '' } }},
        dni              :{type: 'string', label: 'DNI / ID Number:', validator: { required: true, pattern: '^\\d{7,8}$', patternMessage: 'must be 7 or 8 digits' }},
        first_name       :{type: 'string', label: 'Nombre / First Name:', validator: { required: true, pattern: '^\\D+$', patternMessage: 'must not contain numbers' }},
        last_name        :{type: 'string', label: 'Apellido / Last Name:', validator: { required: true, pattern: '^\\D+$', patternMessage: 'must not contain numbers' }},
        email            :{type: 'string', label: 'Email:', input: 'email', validator: { nullable: true, pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$', patternMessage: 'must be a valid email address' }},
        enrollment_date  :{type: 'string', label: 'Fecha de Inscripción / Enrollment Date:', input: 'date', validator: { nullable: true, minDate: '1821-08-09', maxDayOffset: 0 }},
        status           :{type: 'string', label: 'Estado / Status:', input: 'select', validator: { nullable: true }, options: [
          { value: 'active', label: 'Activo / Active' },
          { value: 'graduated', label: 'Graduado / Graduated' },
          { value: 'interrupted', label: 'Interrumpido / Interrupted' },
        ]},
      },
      pk: 'numero_libreta',
      uiName: 'Student',
      title: 'Alumnos / Students',
      addButtonLabel: 'Agregar Alumno / Add Student'
    } satisfies TableStructure,
    subjects: {
      columns:{
        cod_mat     :{type: 'string', label: 'Código / Code:', readonlyOnEdit: true, validator: { required: true }},
        name        :{type: 'string', label: 'Nombre / Name:', validator: { required: true }},
        description :{type: 'string', label: 'Descripción / Description:', input: 'textarea', validator: { nullable: true }},
        credits     :{type: 'number', label: 'Créditos / Credits:', input: 'number', validator: { nullable: true, integer: true, minValue: 1 }},
        department  :{type: 'string', label: 'Departamento / Department:', validator: { nullable: true }},
      },
      pk: 'cod_mat',
      uiName: 'Subject',
      title: 'Materias / Subjects',
      addButtonLabel: 'Agregar Materia / Add Subject'
    } satisfies TableStructure,
    enrollments: {
      pk: ['numero_libreta', 'cod_mat'],
      uiName: 'Enrollment',
      columns: {
        numero_libreta: {
          type: 'string',
          label: 'Número de Libreta / Student ID:',
          readonlyOnEdit: true,
          validator: {
            required: true,
            pattern: '^\\d{1,4}/\\d{2}$',
            patternMessage: 'must match pattern NNNN/YY (1-4 digit number, slash, 2-digit year; leading zeros optional on the number)',
            normalize: {
              pattern: '^0+(?=\\d)',
              replacement: ''
            }
          }
        },

        student_name: {
          type: 'string',
          label: 'Nombre del Alumno / Student Name:',
          editable: false,
          derivable: {
            originTable: 'students',
            sqlGenerationStatement: `entityName.first_name || ' ' || entityName.last_name`
          }
        },

        cod_mat: {
          type: 'string',
          label: 'Código de Materia / Subject Code:',
          readonlyOnEdit: true,
          validator: {
            required: true
          }
        },

        subject_name: {
          type: 'string',
          label: 'Nombre de Materia / Subject Name:',
          editable: false,
          derivable: {
            originTable: 'subjects',
            sqlGenerationStatement: `entityName.name`
          }
        },

        enrollment_date: {
          type: 'string',
          label: 'Fecha de Inscripción / Enrollment Date:',
          input: 'date',
          validator: {
            required: true,
            minDate: '1821-08-09'
          }
        },

        grade: {
          type: 'number',
          label: 'Nota / Grade:',
          input: 'number',
          validator: {
            nullable: true,
            minValue: 0,
            maxValue: 10
          }
        },

        status: {
          type: 'string',
          label: 'Estado / Status:',
          input: 'select',
          validator: {
            nullable: true
          },
          options: [
            { value: 'enrolled', label: 'Inscrito / Enrolled' },
            { value: 'completed', label: 'Completado / Completed' },
            { value: 'failed', label: 'Fallido / Failed' },
          ]
        }
      },
      title: 'Inscripciones / Enrollments',
      addButtonLabel: 'Agregar Inscripción / Add Enrollment',
      referencedTables: ['students', 'subjects']
    } satisfies TableStructure
  },
  menu: {
    theme:{
      title: "🌙",
      handler: () => {
        try {
          const current = document.body.getAttribute("data-theme");
          if (current === "dark") {
            document.body.setAttribute("data-theme", "light");
          } else {
            document.body.setAttribute("data-theme", "dark");
          }
        } catch (err) {
          console.error("Theme toggle failed:", err);
          alert("Error al cambiar el tema / Error changing theme");
        }
      },
      id: "theme-toggle"
    },
    lenguage: {
      title: "EN/ES",
      handler: () => {
        try {
          alert("Funcionalidad de cambio de idioma no implementada / Language toggle not implemented");
        } catch (err) {
          console.error("Language toggle failed:", err);
          alert("Error al cambiar el idioma / Error changing language");
        }
      },
      id: "language-toggle"
    }
  }
}
