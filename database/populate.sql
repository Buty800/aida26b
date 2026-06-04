SET client_encoding = 'UTF8';

-- Clean up existing data to avoid conflicts
DELETE FROM enrollments;
DELETE FROM students;
DELETE FROM subjects;

-- Insert 25 students
INSERT INTO students (numero_libreta, dni, first_name, last_name, email, enrollment_date, status) VALUES
('101/24', '45123456', 'Juan', 'Pérez', 'juan.perez@exactas.uba.ar', '2024-03-01', 'active'),
('102/24', '45234567', 'María', 'Gómez', 'maria.gomez@exactas.uba.ar', '2024-03-01', 'active'),
('103/24', '45345678', 'Lucas', 'Rodríguez', 'lucas.rodriguez@exactas.uba.ar', '2024-03-01', 'active'),
('104/24', '45456789', 'Sofía', 'Fernández', 'sofia.fernandez@exactas.uba.ar', '2024-03-01', 'active'),
('105/24', '45567890', 'Mateo', 'López', 'mateo.lopez@exactas.uba.ar', '2024-03-01', 'active'),
('106/24', '45678901', 'Valentina', 'Martínez', 'valentina.martinez@exactas.uba.ar', '2024-03-01', 'active'),
('107/24', '45789012', 'Santiago', 'González', 'santiago.gonzalez@exactas.uba.ar', '2024-03-01', 'active'),
('108/24', '45890123', 'Camila', 'Álvarez', 'camila.alvarez@exactas.uba.ar', '2024-03-01', 'active'),
('109/24', '45901234', 'Matías', 'Romero', 'matias.romero@exactas.uba.ar', '2024-03-01', 'active'),
('110/24', '46012345', 'Isabella', 'Sánchez', 'isabella.sanchez@exactas.uba.ar', '2024-03-01', 'active'),
('111/24', '46123456', 'Nicolás', 'Díaz', 'nicolas.diaz@exactas.uba.ar', '2024-03-01', 'active'),
('112/24', '46234567', 'Catalina', 'Paz', 'catalina.paz@exactas.uba.ar', '2024-03-01', 'active'),
('113/24', '46345678', 'Tomás', 'Torres', 'tomas.torres@exactas.uba.ar', '2024-03-01', 'active'),
('114/24', '46456789', 'Martina', 'Ruiz', 'martina.ruiz@exactas.uba.ar', '2024-03-01', 'active'),
('115/24', '46567890', 'Felipe', 'Morales', 'felipe.morales@exactas.uba.ar', '2024-03-01', 'active'),
('116/24', '46678901', 'Delfina', 'Herrera', 'delfina.herrera@exactas.uba.ar', '2024-03-01', 'active'),
('117/24', '46789012', 'Benjamín', 'Castro', 'benjamin.castro@exactas.uba.ar', '2024-03-01', 'active'),
('118/24', '46890123', 'Olivia', 'Ortiz', 'olivia.ortiz@exactas.uba.ar', '2024-03-01', 'active'),
('119/24', '46901234', 'Joaquín', 'Silva', 'joaquin.silva@exactas.uba.ar', '2024-03-01', 'active'),
('120/24', '47012345', 'Emma', 'García', 'emma.garcia@exactas.uba.ar', '2024-03-01', 'active'),
('121/24', '47123456', 'Lautaro', 'Ríos', 'lautaro.rios@exactas.uba.ar', '2024-03-01', 'active'),
('122/24', '47234567', 'Alma', 'Molina', 'alma.molina@exactas.uba.ar', '2024-03-01', 'active'),
('123/24', '47345678', 'Julián', 'Suárez', 'julian.suarez@exactas.uba.ar', '2024-03-01', 'active'),
('124/24', '47456789', 'Zoe', 'Ortega', 'zoe.ortega@exactas.uba.ar', '2024-03-01', 'active'),
('125/24', '47567890', 'Bautista', 'de Suto Nagy', 'bautista.desuto@exactas.uba.ar', '2024-01-01', 'active');

-- Insert 25 subjects
INSERT INTO subjects (cod_mat, name, description, credits, department) VALUES
('DM101', 'Análisis Matemático I', 'Cálculo en una variable, límites, derivadas e integrales', 10, 'Matemática'),
('DM102', 'Álgebra I', 'Sistemas de ecuaciones lineales, matrices, determinantes y espacios vectoriales', 10, 'Matemática'),
('DM103', 'Análisis Matemático II', 'Cálculo multivariable, integrales múltiples y análisis vectorial', 10, 'Matemática'),
('DM104', 'Álgebra Lineal', 'Espacios vectoriales avanzados, transformaciones lineales y formas bilineales', 10, 'Matemática'),
('DM105', 'Probabilidad y Estadística', 'Variables aleatorias, distribuciones y estimación estadística', 8, 'Matemática'),
('DC101', 'Algoritmos y Estructuras de Datos I', 'Conceptos básicos de programación, tipos de datos y estructuras lineales', 10, 'Computación'),
('DC102', 'Algoritmos y Estructuras de Datos II', 'Estructuras de datos no lineales, árboles, grafos y algoritmos de ordenación', 10, 'Computación'),
('DC103', 'Organización del Computador I', 'Representación de datos, ensamblador y arquitectura básica', 8, 'Computación'),
('DC104', 'Organización del Computador II', 'Arquitectura de procesadores, memoria caché y pipelines', 8, 'Computación'),
('DC105', 'Sistemas Operativos', 'Procesos, hilos, administración de memoria y sistemas de archivos', 10, 'Computación'),
('DC106', 'Bases de Datos', 'Modelado entidad-relación, SQL avanzado y transacciones', 8, 'Computación'),
('DC107', 'Ingeniería de Software I', 'Metodologías de desarrollo, patrones de diseño y modelado UML', 8, 'Computación'),
('DF101', 'Física I', 'Mecánica clásica, cinemática y dinámica de partículas', 10, 'Física'),
('DF102', 'Física II', 'Termodinámica, electromagnetismo y ondas', 10, 'Física'),
('DF103', 'Física Experimental I', 'Laboratorio de mecánica y medición de errores', 6, 'Física'),
('DF104', 'Física Experimental II', 'Laboratorio de electromagnetismo y circuitos básicos', 6, 'Física'),
('DQ101', 'Química General I', 'Estructura atómica, enlaces químicos y estequiometría', 8, 'Química'),
('DQ102', 'Química Inorgánica I', 'Química de los elementos representativos y de transición', 10, 'Química'),
('DQ103', 'Química Orgánica I', 'Estructura, reactividad y síntesis de compuestos de carbono', 10, 'Química'),
('DB101', 'Biología General', 'Estructura celular, genética básica y evolución', 8, 'Biología'),
('DB102', 'Genética I', 'Leyes de Mendel, genética molecular y del desarrollo', 8, 'Biología'),
('DB103', 'Fisiología Animal', 'Sistemas biológicos y regulación homeostática en animales', 10, 'Biología'),
('DG101', 'Geología General', 'Procesos internos y externos de la Tierra, rocas y minerales', 8, 'Geología'),
('DG102', 'Paleontología', 'Estudio de fósiles y evolución geológica', 8, 'Geología'),
('DG103', 'Mineralogía', 'Propiedades físicas y químicas de los minerales', 10, 'Geología');

-- Insert 25 enrollments
INSERT INTO enrollments (numero_libreta, cod_mat, enrollment_date, grade, status) VALUES
('101/24', 'DM101', '2024-03-05', 8.50, 'completed'),
('102/24', 'DM101', '2024-03-05', 7.00, 'completed'),
('103/24', 'DM102', '2024-03-06', 9.00, 'completed'),
('104/24', 'DM102', '2024-03-06', 4.00, 'completed'),
('105/24', 'DC101', '2024-03-07', 8.00, 'completed'),
('106/24', 'DC101', '2024-03-07', 9.50, 'completed'),
('107/24', 'DF101', '2024-03-08', 6.50, 'completed'),
('108/24', 'DF101', '2024-03-08', 5.00, 'completed'),
('109/24', 'DQ101', '2024-03-09', 7.50, 'completed'),
('110/24', 'DQ101', '2024-03-09', 8.00, 'completed'),
('111/24', 'DB101', '2024-03-10', 9.00, 'completed'),
('112/24', 'DB101', '2024-03-10', 8.50, 'completed'),
('113/24', 'DG101', '2024-03-11', 7.00, 'completed'),
('114/24', 'DG101', '2024-03-11', 10.00, 'completed'),
('115/24', 'DM103', '2024-03-12', NULL, 'enrolled'),
('116/24', 'DC102', '2024-03-12', NULL, 'enrolled'),
('117/24', 'DF102', '2024-03-13', NULL, 'enrolled'),
('118/24', 'DQ102', '2024-03-13', NULL, 'enrolled'),
('119/24', 'DB102', '2024-03-14', NULL, 'enrolled'),
('120/24', 'DG102', '2024-03-14', NULL, 'enrolled'),
('121/24', 'DM104', '2024-03-15', 3.00, 'failed'),
('122/24', 'DC103', '2024-03-15', 2.00, 'failed'),
('123/24', 'DF103', '2024-03-16', 7.50, 'completed'),
('124/24', 'DQ103', '2024-03-16', 8.00, 'completed'),
('125/24', 'DC101', '2024-01-15', 9.50, 'completed');
