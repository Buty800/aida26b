# Tracker de Actividades

Este proyecto es un **tracker de actividades** diseñado para registrar, analizar y comparar el progreso de diferentes tareas o hábitos en grupos de amigos.

El objetivo principal es permitir a los usuarios hacer un seguimiento de sus actividades (como estudio, lectura, ejercicios, etc.) y visualizar estadísticas colectivas mediante representaciones gráficas interactivas, fomentando la colaboración y el entretenimiento.

## Cómo ejecutar el proyecto

Para iniciar el entorno completo (base de datos, backend y frontend) utilizando Docker:

1. Levantar los contenedores:
   ```bash
   docker-compose -f docker-compose.combined.yml up -d
   ```

2. Cargar los datos de ejemplo (seeding):
   ```bash
   docker exec -it aida26_app npm run seed-example
   ```

El frontend estará disponible en `http://localhost:3000`.

## Documentación detallada

Para conocer más detalles sobre el modelado de la base de datos, las decisiones de arquitectura, UX, seguridad y el desglose de los endpoints de la API, por favor consulta el [Informe de Implementación](informe.md).
