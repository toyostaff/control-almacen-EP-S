CREATE DATABASE IF NOT EXISTS almacen_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE almacen_db;

CREATE TABLE IF NOT EXISTS usuarios (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  rol ENUM('admin','almacen') NOT NULL DEFAULT 'almacen',
  estado ENUM('Activo','Inactivo') NOT NULL DEFAULT 'Activo',
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS catalogo (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  sku VARCHAR(30) NOT NULL UNIQUE,
  descripcion VARCHAR(255) NOT NULL,
  estado ENUM('Activo','Inactivo') NOT NULL DEFAULT 'Activo',
  fecha_creacion DATE NOT NULL DEFAULT (CURRENT_DATE),
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_catalogo_descripcion (descripcion)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ubicaciones (
  id VARCHAR(20) PRIMARY KEY,
  estante CHAR(1) NOT NULL,
  piso TINYINT UNSIGNED NOT NULL,
  columna_num TINYINT UNSIGNED NOT NULL,
  tiene_subdivisiones BOOLEAN NOT NULL DEFAULT FALSE,
  tipo_division VARCHAR(10) NULL,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS subdivisiones (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ubicacion_id VARCHAR(20) NOT NULL,
  codigo VARCHAR(10) NOT NULL,
  nombre VARCHAR(50) NOT NULL,
  fila_num TINYINT UNSIGNED NOT NULL,
  columna_num TINYINT UNSIGNED NOT NULL,
  UNIQUE KEY uq_subdivision (ubicacion_id, codigo),
  CONSTRAINT fk_subdivision_ubicacion FOREIGN KEY (ubicacion_id) REFERENCES ubicaciones(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS inventario (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  sku_id BIGINT UNSIGNED NOT NULL,
  sku VARCHAR(30) NOT NULL,
  descripcion VARCHAR(255) NOT NULL,
  codigo VARCHAR(100) NULL,
  tiene_codigo BOOLEAN NOT NULL DEFAULT FALSE,
  codigo_reemplazo VARCHAR(100) NULL,
  ubicacion_id VARCHAR(20) NOT NULL,
  subdivision_codigo VARCHAR(10) NULL,
  observacion TEXT NULL,
  foto_url TEXT NULL,
  estado ENUM('Activo','Inactivo') NOT NULL DEFAULT 'Activo',
  fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion DATETIME NULL,
  CONSTRAINT fk_inventario_catalogo FOREIGN KEY (sku_id) REFERENCES catalogo(id),
  CONSTRAINT fk_inventario_ubicacion FOREIGN KEY (ubicacion_id) REFERENCES ubicaciones(id),
  INDEX idx_inventario_estado (estado),
  INDEX idx_inventario_ubicacion (ubicacion_id, subdivision_codigo),
  INDEX idx_inventario_codigo (codigo),
  INDEX idx_inventario_descripcion (descripcion)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS historial (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  modulo VARCHAR(80) NOT NULL,
  accion VARCHAR(80) NOT NULL,
  descripcion TEXT NOT NULL,
  referencia VARCHAR(150) NULL,
  usuario_id BIGINT UNSIGNED NULL,
  usuario_nombre VARCHAR(120) NOT NULL DEFAULT 'Sistema',
  fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_historial_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL,
  INDEX idx_historial_fecha (fecha),
  INDEX idx_historial_modulo (modulo)
) ENGINE=InnoDB;

-- Catálogo inicial basado en catalogoSeed.js del frontend recibido.
INSERT IGNORE INTO catalogo (id, sku, descripcion, fecha_creacion, estado) VALUES
(1,'SKU-0001','Soga','2026-10-11','Activo'),
(2,'SKU-0002','Empalme unipolar','2026-10-11','Activo'),
(3,'SKU-0003','cinta 2228','2026-10-11','Activo'),
(4,'SKU-0004','Cinta aislante negro','2026-10-11','Activo'),
(5,'SKU-0005','Cable Naz','2026-10-11','Activo');

-- 24 ubicaciones A/B, pisos 1-4, columnas 1-3.
INSERT IGNORE INTO ubicaciones (id,estante,piso,columna_num,tiene_subdivisiones,tipo_division) VALUES
('A-01-01','A',1,1,0,NULL),('A-01-02','A',1,2,0,NULL),('A-01-03','A',1,3,0,NULL),
('A-02-01','A',2,1,1,'3x2'),('A-02-02','A',2,2,1,'3x2'),('A-02-03','A',2,3,1,'3x2'),
('A-03-01','A',3,1,1,'3x2'),('A-03-02','A',3,2,0,NULL),('A-03-03','A',3,3,1,'3x2'),
('A-04-01','A',4,1,0,NULL),('A-04-02','A',4,2,0,NULL),('A-04-03','A',4,3,0,NULL),
('B-01-01','B',1,1,0,NULL),('B-01-02','B',1,2,0,NULL),('B-01-03','B',1,3,0,NULL),
('B-02-01','B',2,1,1,'3x2'),('B-02-02','B',2,2,1,'3x2'),('B-02-03','B',2,3,1,'3x2'),
('B-03-01','B',3,1,1,'3x2'),('B-03-02','B',3,2,0,NULL),('B-03-03','B',3,3,1,'3x2'),
('B-04-01','B',4,1,0,NULL),('B-04-02','B',4,2,0,NULL),('B-04-03','B',4,3,0,NULL);

INSERT IGNORE INTO subdivisiones (ubicacion_id,codigo,nombre,fila_num,columna_num)
SELECT u.id, CONCAT('D-',LPAD(n.numero,2,'0')), CONCAT('División ',n.numero), CEIL(n.numero/3), MOD(n.numero-1,3)+1
FROM ubicaciones u
CROSS JOIN (SELECT 1 numero UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6) n
WHERE u.tiene_subdivisiones = 1;
