import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import {config} from './config/env.js';
import {comprobarConexion} from './config/db.js';
import authRoutes from './routes/auth.routes.js';
import catalogoRoutes from './routes/catalogo.routes.js';
import inventarioRoutes from './routes/inventario.routes.js';
import ubicacionesRoutes from './routes/ubicaciones.routes.js';
import historialRoutes from './routes/historial.routes.js';
import vozRoutes from './routes/voz.routes.js';
import {noEncontrado,manejarError} from './middleware/errors.js';

const app=express();
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({origin:(origin,cb)=>{if(!origin||config.corsOrigins.includes('*')||config.corsOrigins.includes(origin))return cb(null,true);return cb(new Error('Origen no permitido por CORS.'));}}));
app.use(express.json({limit:'7mb'}));
app.use(express.urlencoded({extended:true,limit:'1mb'}));
app.use(morgan(config.nodeEnv==='production'?'combined':'dev'));
app.use('/api',rateLimit({windowMs:15*60*1000,limit:300,standardHeaders:true,legacyHeaders:false}));
app.get('/api/health',async(req,res)=>{try{await comprobarConexion();res.json({ok:true,servicio:'API Control de Almacén',baseDatos:'conectada'});}catch(e){res.status(503).json({ok:false,servicio:'API Control de Almacén',baseDatos:'desconectada'});}});
app.use('/api/auth',authRoutes);
app.use('/api/catalogo',catalogoRoutes);
app.use('/api/inventario',inventarioRoutes);
app.use('/api/ubicaciones',ubicacionesRoutes);
app.use('/api/historial',historialRoutes);
app.use('/api/voz',vozRoutes);
app.use(noEncontrado);
app.use(manejarError);

try{await comprobarConexion();console.log('MySQL conectado correctamente.');}catch(e){console.error('No se pudo conectar a MySQL:',e.message);console.error('Revisa las variables DB_HOST, DB_PORT, DB_NAME, DB_USER y DB_PASSWORD del hosting.');}
app.listen(config.port,()=>console.log(`API escuchando en el puerto ${config.port}`));
