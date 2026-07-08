# Tracker de actividades 

Este trabajo es para comparar entre grupos de amigos las frecuencias y momentos en que ocurre un evento dado para cada usuario, por ejemplo, la cantidad de veces que cada uno fue a comprar al supermercado. Además, puede tomar, agrupar y analizar estadísticas del grupo y cada uno individualmente y en relación al resto

## Proceso de modelado

Para modelar la base de datos usamos el siguiente diagrama

 !["Esquema de la base de datos"](esquema.png)

Decidimos agregar una tabla de _friends_ porque queriamos que solamente los amigos puedan agregar a gente al grupo.

Para mantener la consistencia, la parte

Para evitar que se dupliquen los friends, uno tiene que ser mayor que el otro. Constraint en la base de datos

Nos aseguramos que el estado del usuario sea accesible del URL.

Para las estadísticas, decidimos calcularlas en queries de sql del backend para aprovechar la eficiencia de la base de datos en vez de procesar le informacion en el frontend en base a datos puros. 

Nos aseguramos que cualquier acción que no se pueda deshacer (eliminar grupos, actividades, amigos) tenga pantalla de confirmacion. Consideramos que rechazar una solicitud es algo que se puede deshacer, por lo cual no lo incluimos.

El endpoint especializado principal 

## Proceso de desarrollo


## Aprendizajes

+ Postgres en Windows hay que tener en cuenta que si lo tenés activo el servicio y abris el postgresql, entonces va a ir al que tengas local y no en docker, generando conflictos
+ No poner que retorne 200 si no está implementado
+ Desde 2023 existe una propiedad de CSS que permite deshabilitar el boton de submit visualmente cuando el form no cumple los requisitos. La IA no la sabe usar si no se lo pedis explicitamente. 