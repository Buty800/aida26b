# Tracker de actividades 

El objetivo de este trabajo es armar software para rastrear y comparar entre grupos de amigos las frecuencias y horarios en que ocurre un evento o acción dada para cada persona. Además, puede tomar, agrupar y analizar estadísticas del grupo con varias representaciones visuales. Esto puede servir, por ejemplo, para mantenerse al día con el progreso en grupos de estudio o de lectura, o solo por entretenimiento midiendo acciones cotidianas. 

## Proceso de modelado

Para modelar la base de datos usamos el siguiente diagrama



Decidimos agregar una tabla de _friends_ porque queríamos que solamente los amigos puedan agregar a gente al grupo, para evitar spam.

Para evitar que se dupliquen los amigos, el nombre de usuario (PK) del primero en la relación mayor al segundo. Esto usa un constraint en la base de datos. El tipo friend_request que usa es un enum con {accepted, rejected, pending_from_higher, pending_from_lower} para permitir esto.

Decidimos no validación en la página de administración para evitar estados ilegales porque qué sería un estado ilegal es demasiado complicado para representar en contraints y hacerlo por el lado del backend necesitaria funciones específicas para cada acción, lo cual violaria el SRP si quisiéramos modificar la base de datos a futuro. No nos parece problemático porque esos cambios se pueden hacer de manera correcta asegurada usando la funcionalidad de downgrade, explicada más adelante. 

Decidimos cambiar la PK de auth.users a un varchar de nombre de usuario para mejorar compatibilidad con la pantalla de administración. 

## UX
Nos aseguramos que el estado de la página sea accesible desde el URL.

También, usamos una estética uniforme para el usuario entienda de forma sencilla su propósito

En el login, al pasar de login a register mantenemos los valores de los inputs para ayudar al usuario en caso de equivocarse. 
 
No nos pareció que hubiera ningún otro formulario donde hay pérdida de información relevante en el caso de pérdida de sesión.

Para las estadísticas, decidimos calcularlas en queries de sql del backend para aprovechar la eficiencia de la base de datos, en vez de procesar la información en el frontend en base a datos puros. 

Nos aseguramos que cualquier acción que no se pueda deshacer (eliminar grupos, actividades, amigos) tenga pantalla de confirmación. Consideramos que rechazar una solicitud es algo que se puede deshacer, por lo cual no lo incluimos.


## Seguridad

Usamos usuarios de la base de datos diferentes con niveles de permisos diferentes para usuarios normales, admins, y autenticación. Usamos seguridad por columnas para que la información que pueden acceder users y admins en auth.users sea solo la que corresponda. 

Decidimos no proteger datos personales de la vista del admin, porque el host siempre tiene acceso a los datos desde la DB directamente. Si implementáramos a futuro encriptación por grupo E2E esto cambiaría. 
Dado que los admins ya pueden hacer y modificar cualquier cosa como si fueran los usuarios mismos, le permitimos downgradear al admin a el rol de cualquier usuario para tener mejor UX para modificar datos si es necesario. Esto, otra vez, se eliminaría en un sistema más seguro, pero por ahora tiene sentido.

Los usuarios de un grupo tienen como posible estado: 'invited', 'active', 'left'. Dejamos esos porque: invited sería esperando a que el usuario acepte, pero ya lo agregamos a la tabla, active no hace explicar, left porque no borramos su información cuando sale del grupo. 

## Proceso de desarrollo

Agregamos un endpoint especializado para contar la cantidad de filas en las tablas, para aprovechar el compilador de la base de datos y que no dé toda la información innecesaria

## Aprendizajes

+ Postgres en Windows hay que tener en cuenta que si lo tenés activo el servicio y abris el postgresql, entonces va a ir al que tengas local y no en docker, generando conflictos
+ No poner que retorne 200 si no está implementado
+ Desde 2023 existe una propiedad de CSS que permite deshabilitar el boton de submit visualmente cuando el form no cumple los requisitos. La IA no la sabe usar si no se lo pedis explicitamente. 
+ Es muy importante tener los diagramas de esquemas actualizados con los cambios que se hagan para no equivocarse.
+ Para instalar PostgreSQL no hace falta ser Sudo, pero cuando queres cerrarlo te pide permisos de sudo. 


