import {Router} from 'express';
import multer from 'multer';
import multerConfig from './config/multer';
import User from './app/models/User';
import UserController from './app/controllers/UserController';
import SessionController from './app/controllers/SessionController';
import ProviderController from './app/controllers/ProviderController';
import FileController from './app/controllers/FileController';
import authMiddleware from './app/middlewares/auth';
import AppointmentController from './app/controllers/AppointmentController';
import ScheduleController from './app/controllers/ScheduleController';


const routes = new Router();
const upload = multer(multerConfig);

routes.post('/users', UserController.store);

routes.post('/sessions', SessionController.store);

routes.use(authMiddleware);

routes.put('/users', UserController.update);

routes.get('/providers', ProviderController.index)

routes.post('/appointments', AppointmentController.store);

routes.get('/appointments', AppointmentController.index);

routes.get('/schedule', ScheduleController.index)

routes.post('/files', upload.single('file'), FileController.store);



export default  routes;