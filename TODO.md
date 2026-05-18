# Mantener single source of truth, single responsability, 

## Filtros, Orden, paginación

- agregar a la app la opción de filtrar por columnas, ordenar por columnas y paginar los datos. Esto implica modificar backend y frontend.
- este punto está muy relacionado con mostrar en la URL lo que está viendo el usuario actualmente así que entra acá también.

## Autenticación, recuperar password

- mínimamente usuario + contraseña, opcionalmente 2FA (pista: se puede usar alguna app como authenticator)
- los usuarios y sus datos tienen que estar en la misma db que los datos de negocio?
- todos los usuarios pueden hacer todo?

## UX/UI

- botón de tema claro/oscuro (GR: es que me copa mucho el tema oscuro para las cosas)
- botón para lenguaje EN / ES
- interfaz para agregar/editar podría estar en un modal o de alguna otra forma menos fea que la actual
- tablas arriba o en un menú a la izquierda?
- qué hacemos con el overflow?
- responsive?

## Foreign keys

- En las inscripciones hay foreign keys, estaría bueno que cuando hay una foreign key y se desee editar/agregar una fila, estos valores estén en un select.
- Puede tener sentido que algunas foreign keys dependan de otras, particularmente cuando son compuestas. Por ejemplo si tenemos tabla departamento y la pk de materia es el código de departamento + código de materia, tendría sentido que seleccionar un departamento te habilite únicamente a seleccionar materias de ese departamento y viceversa.

## CRUD genéricos + qué es potestad del frontend y qué del backend

- Si agregamos una tabla no deberíamos agregar 4 apis nuevas. Tiene que haber 1 api por cada operación que nos interese.
- Definimos la estructura y los tipos en el frontend. Eso debería estar en el frontend o en el backend? Al frontend qué debería interesarle? Lo que necesita saber el frontend de dónde debería provenir?

## Migraciones, query a base de datos, inyecciones SQL

- Qué hacemos si tiene que cambiar el schema de alguna tabla? Por ej agregar algún campo
- Qué hacemos si hay que agregar tablas?
- Cómo construimos las queries para pegarle a la DB sin que el usuario pueda hacerse el vivo?

## Validaciones de tipo, de foreign key, de fecha, de negocio, etc.

- Por ejemplo si un campo tiene que seguir el formato de una regex particular, eso debería saberlo el frontend y el backend? Debería saberlo el backend y transmitírselo al frontend?
- Quién tiene que forzar esas validaciones?

## Errores + logging

- Qué errores hay que logear en el backend? en dónde se guarda ese log?
- Qué errores hay que logear en el frontend? Se los debería enviar al backend?
- Qué errores del backend hay que mostrar en el frontend y cómo?

## Testing

- Qué queremos que cumpla la app end to end?
- Qué queremos que cumpla el backend?
- Cómo podemos testear semi-automáticamente la interacción del usuario con el frontend?