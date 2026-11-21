
export async function registrarEvento(
  conn,
  {
    modulo,
    accion,
    descripcion,
    referencia = "",
    usuario = "Sistema",
  }
) {
  await conn.execute(
    `INSERT INTO historial (
      modulo,
      accion,
      descripcion,
      referencia,
      usuario_nombre
    ) VALUES (?, ?, ?, ?, ?)`,
    [
      modulo,
      accion,
      descripcion,
      referencia,
      usuario,
    ]
  );
}
