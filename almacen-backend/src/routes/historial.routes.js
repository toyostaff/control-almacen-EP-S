import{Router}from'express';import{pool}from'../config/db.js';import{autenticar,exigirAdmin}from'../middleware/auth.js';import{HttpError}from'../utils/httpError.js';
const router=Router();router.use(autenticar);
router.get('/',async(req,res,next)=>{try{const limit=Math.min(Math.max(Number(req.query.limit)||200,1),500);const [rows]=await pool.query('SELECT id,modulo,accion,descripcion,referencia,usuario_nombre usuario,DATE_FORMAT(fecha, "%Y-%m-%dT%H:%i:%s.000Z") fecha FROM historial ORDER BY fecha DESC,id DESC LIMIT ?', [limit]);res.json({ok:true,data:rows});}catch(e){next(e);}});
router.delete('/',exigirAdmin,async(req,res,next)=>{try{await pool.query('DELETE FROM historial');res.json({ok:true,mensaje:'Historial eliminado.'});}catch(e){next(e);}});
export default router;
