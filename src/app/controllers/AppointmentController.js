import User from '../models/User';
import Appoitment from '../models/Appointment';
import File from '../models/File';
import * as Yup from  'yup';
import { startOfHour, parseISO, isBefore, format, subHours} from 'date-fns';
import pt from 'date-fns/locale/pt';
import Notification from '../schemas/notification';
import Appointment from '../models/Appointment';
import Queue from '../../lib/Mail';
import CancellationMail  from '../jobs/CancellationMail';

import { model } from 'mongoose';

class AppointmentController{
    async index(req, res){
        const {page = 1 } = req.query;
        const appointments = await Appoitment.findAll({
            where: {user_id: req.user_Id, canceled_at: null},
            order: ['date'],
            attributes: ['id', 'date'],
            limit: 20,
            offset: (page- 1) * 20,
            include: [
                {
                    model: User,
                    as: 'provider',
                    attributes: ['id', 'name'],
                    include: [{
                            model: File,
                            as: 'avatar',
                            attributes: ['id', 'path','url']
                        }
                    ]
                },
            ]
        })
        return res.json(appointments);
    }
    async store(req, res) {
        const schema = Yup.object().shape({
          provider_id: Yup.number().required(),
          date: Yup.date().required(),
        });
        if(!(await schema.isValid(req.body))){
            return res.status(400).json({error: 'Validation fails'})
        }
        const {provider_id, date} = req.body;
        const isProvider = await User.findOne({
            where: {id: provider_id, provider:true}
        })
        if(!isProvider){
            return res.status(401).json({error: 'User is not a provider'})
        }
        const hourstart = startOfHour(parseISO(date))
        if(isBefore(hourstart, new Date)){
            return res.status(400).json({error: 'past dates are not permited'})
        }

        const checkAvailability = await Appoitment.findOne({
            where: {
                provider_id,
                canceled_at: null,
                date: hourstart,
            }
        })
        if(checkAvailability){
            return res.status(400).json({error: 'Appointment date is not avaliable'})
        }

        const appointment = await Appoitment.create({
            user_id: req.user_Id,
            provider_id,
            date: hourstart,
        });
        //notify appointment provider
        const user = await User.findByPk(req.user_Id)
        const formattedDate = format(
            hourstart,
            "'dia' dd 'de' MMMM', às' H:mm'h'",
            { locale: pt }
          );
        await Notification.create({
            content: `Novo agendamento de ${user.name} para ${formattedDate}`,
            user: provider_id,
        })
        return res.json(appointment);
    }
    async delete(req,res){
        const appointment = await Appointment.findByPk(req.params.id,{
            include:[{
                model: User,
                as: 'provider',
                attributes: ['name', 'email'],
                },
                {
                    model:User,
                    as: 'user',
                    attributes: ['name'],
                },
            
            ]
        });
        if(appointment.user_id !== req.user_Id){
            return res.status(401).json({error: "You don't have permission to cancel this appointment"})
        }
        const dateWithSub = subHours(appointment.date, 2);
        if (isBefore(dateWithSub, new Date())){
            return res.status(401).json({error: "You can't only cancel appointments 2 hours into advance"})
        }
        appointment.canceled_at = new Date();
        
        await Queue.add(CancellationMail.key,{
            appointment,
        });

        await appointment.save();
        
        return res.json(appointment);
    }
}
export default new AppointmentController();