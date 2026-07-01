# Tracker de actividades 

Este trabajo es para comparar entre grupos de amigos las frecuencias y momentos en que ocurre un evento dado para cada usuario, por ejemplo, la cantidad de veces que cada uno fue a comprar al supermercado. Además, puede tomar, agrupar y analizar estadísticas del grupo y cada uno individualmente y en relación al resto

## Proceso de modelado

Para modelar la base de datos usamos el siguiente diagrama

 !["Esquema de la base de datos"](esquema.png)

Decidimos agregar una tabla de _friends_ porque queriamos que solamente los amigos puedan agregar a gente al grupo.

Para mantener la consistencia, la parte

Para evitar que se dupliquen los friends, uno tiene que ser mayor que el otro. Constraint en la base de datos

## Proceso de desarrollo


## Aprendizajes

+ Postgres en Windows hay que tener en cuenta que si lo tenés activo el servicio y abris el postgresql, entonces va a ir al que tengas local y no en docker, generando conflictos
+ No poner que retorne 200 si no está implementado
