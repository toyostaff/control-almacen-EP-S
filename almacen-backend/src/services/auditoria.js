
export async function registrarEvento(
  conn,
  {
    modulo,
    accion,
    descripcion,
    referencia = "",
    usuarioId = null,
    usuario = "Sistema",
  }
) {
  await conn.execute(
    `INSERT INTO historial (
      modulo,
      accion,
      descripcion,
      referencia,
      usuario_id,
      usuario_nombre
    ) VALUES (?, ?, ?, ?, ?, ?)`,
    [
      modulo,
      accion,
      descripcion,
      referencia,
      usuarioId,
      usuario,
    ]
  );
}
