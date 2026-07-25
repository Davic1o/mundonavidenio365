INSERT IGNORE INTO mundonav_navidad.clientes (
    id, nombres, ci_o_ruc, telefono, direccion, correo, creado_por, actualizado_por, created_at, updated_at, deleted_at
)
SELECT
    id, nombre, ci_o_ruc, telefono, direccion, email, 1,
    NULL, created_at, updated_at, NULL
FROM mundonav_navidad365.clientes;


INSERT IGNORE INTO mundonav_navidad.proveedores (
    id,
    nombre,
    telefono,
    ci_o_ruc,
    registrado_por,
    actualizado_por,
    eliminado_por,
    deleted_at,
    created_at,
    updated_at
)
SELECT
    id,
    nombre,
    telefono,
    ruc,
    1,
    NULL,
    NULL,
    NULL,
    created_at,
    updated_at
FROM mundonav_navidad365.proveedores;


INSERT IGNORE INTO mundonav_navidad.productos (
    id,
    nombre,
    codigo,
    cantidad_total,
    registrado_por,
    actualizado_por,
    eliminado_por,
    deleted_at,
    created_at,
    updated_at
)
SELECT
	id,
    nombre,
    barcode,
    cantidad,
    1,
    NULL,
    NULL,
    NULL,
    created_at,
    updated_at
FROM mundonav_navidad365.productos;




INSERT IGNORE INTO mundonav_navidad.lotes (
    producto_id,
    proveedor_id,
    cantidad_compra,
    fecha_compra,
    anio,
    precio_compra,
    costo_transporte,
    costo_general,
    precio_compra_final,
    porcentaje_ganancia,
    precio_total,
    registrado_por,
    actualizado_por,
    eliminado_por,
    deleted_at,
    created_at,
    updated_at
)
SELECT
    id,
    proveedor_id,
    cantidad,
    DATE(created_at) AS fecha_compra,   -- solo la fecha
    YEAR(created_at) AS anio,           -- solo el año
    precio_compra,
    porcentaje_transporte,
    porcentaje_costo_general,
    precio_venta AS precio_compra_final,
    porcentaje_ganancia,
    precio_venta AS precio_total,
    1,
    NULL,
    NULL,
    NULL,
    created_at,
    updated_at
FROM mundonav_navidad365.productos;

INSERT IGNORE INTO mundonav_navidad.ventas (
    cliente_id, fecha, estab, pto_emision, secuencial, numero, autorizacion, estado,
    subtotal, impuesto_15, impuesto_0, descuento, total, creada_por,
    created_at, updated_at, deleted_at
)
SELECT
    v.cliente_id,                        -- int
    v.fecha_establecimiento,             -- date/datetime
    v.establecimiento,                   -- string
    v.punto_emision,                     -- string
    v.secuencial,                        -- int
    v.secuencial,                        -- puedes dejarlo int o formatear como string tipo SRI
    v.clave_de_acceso,                   -- string
    'autorizada' AS estado,              -- string
    v.subtotal_sin_impuestos,            -- decimal(10,2)
    v.impuesto,                          -- decimal(10,2)
    0.00 AS impuesto_0,                  -- decimal(10,2)
    v.descuento,                         -- decimal(10,2)
    v.valor_a_pagar,                     -- decimal(10,2)
    1 AS creada_por,                     -- int
    v.created_at,                        -- datetime
    v.updated_at,                        -- datetime
    NULL AS deleted_at                   -- null real
FROM mundonav_navidad365.ventas v;

INSERT IGNORE INTO mundonav_navidad.venta_pagos (
    venta_id, codigo,nombre, valor, created_at, updated_at

)
SELECT
    v.venta_id,
    v.nombre,
    'EFECTIVO',
    v.valor,
    v.created_at,
    v.updated_at
FROM mundonav_navidad365.metodo_pagos v;
