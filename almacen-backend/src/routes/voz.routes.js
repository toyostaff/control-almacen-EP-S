import { Router } from "express";
import { pool } from "../config/db.js";
import { autenticar } from "../middleware/auth.js";
const router = Router();
router.use(autenticar);
const ignoradas = new Set([
  "necesito",
  "busco",
  "buscar",
  "quiero",
  "dame",
  "donde",
  "esta",
  "encuentra",
  "encuentro",
  "ubicacion",
  "localiza",
  "encontrar",
  "por",
  "favor",
  "el",
  "la",
  "los",
  "las",
  "un",
  "una",
  "de",
  "del",
  "hay",
  "tienes",
  "tienen",
  "me",
  "puedes",
  "indica",
  "repuesto",
]);
const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
function score(q, r) {
  let best = 0;
  for (const field of [r.descripcion, r.sku, r.codigo, r.codigo_reemplazo]
    .filter(Boolean)
    .map(norm)) {
    if (field === q) best = Math.max(best, 100);
    else if (field.startsWith(q)) best = Math.max(best, 85);
    else if (field.includes(q)) best = Math.max(best, 70);
    else {
      const words = q.split(" "),
        hits = words.filter((w) => field.split(" ").includes(w)).length,
        p = hits / words.length;
      if (p === 1) best = Math.max(best, 60);
      else if (p >= 0.6) best = Math.max(best, 40);
    }
  }
  return best;
}
router.post("/buscar", async (req, res, next) => {
  try {
    const q = norm(req.body.consulta || "")
      .split(" ")
      .filter((w) => w && !ignoradas.has(w))
      .join(" ");
    if (!q)
      return res.json({
        ok: true,
        data: {
          encontrado: false,
          respuesta: "Por favor, indica el nombre del repuesto que necesitas.",
          registro: null,
          ubicacion: null,
        },
      });
    const [rows] = await pool.execute(
      `SELECT i.*,u.estante,u.piso,u.columna_num,u.tiene_subdivisiones,s.nombre subdivision_nombre,s.fila_num subdivision_fila,s.columna_num subdivision_columna FROM inventario i JOIN ubicaciones u ON u.id=i.ubicacion_id LEFT JOIN subdivisiones s ON s.ubicacion_id=i.ubicacion_id AND s.codigo=i.subdivision_codigo WHERE i.estado='Activo'`,
    );
    const matches = rows
      .map((r, index) => ({ r, index, p: score(q, r) }))
      .filter((x) => x.p > 0)
      .sort((a, b) => b.p - a.p || a.index - b.index);
    if (!matches.length)
      return res.json({
        ok: true,
        data: {
          encontrado: false,
          respuesta: "No se encuentra el repuesto que estás buscando.",
          registro: null,
          ubicacion: null,
        },
      });
    const r = matches[0].r;
    const u = {
      estante: r.estante,
      piso: r.piso,
      columna: r.columna_num,
      codigo: r.ubicacion_id,
      tieneSubdivisiones: Boolean(r.tiene_subdivisiones),
      subdivision: r.subdivision_codigo
        ? {
            id: r.subdivision_codigo,
            nombre: r.subdivision_nombre,
            fila: r.subdivision_fila,
            columna: r.subdivision_columna,
          }
        : null,
    };
    let respuesta = `${r.descripcion || r.sku} se encuentra en el estante ${u.estante}, piso ${u.piso}, columna ${u.columna}`;
    if (u.subdivision)
      respuesta += `. Tiene subdivisión ${u.subdivision.id}, fila ${u.subdivision.fila}, columna ${u.subdivision.columna}`;
    const registro = {
      id: r.id,
      skuId: r.sku_id,
      sku: r.sku,
      descripcion: r.descripcion,
      codigo: r.codigo || "",
      codigoReemplazo: r.codigo_reemplazo || "",
      ubicacion: r.ubicacion_id,
      subdivision: r.subdivision_codigo || "",
      foto: r.foto_url || "",
      estado: r.estado,
    };
    res.json({
      ok: true,
      data: {
        encontrado: true,
        respuesta: respuesta + ".",
        registro,
        ubicacion: u,
      },
    });
  } catch (e) {
    next(e);
  }
});
export default router;
