import { CallbackError, MongooseError } from 'mongoose'
import handleError from '../config/mailer.js'
import PartRecord from '../model/partRecord.js'
import { PartRecordSchema } from '../app/interfaces.js'

const callbackHandler = {
    updateRecord: (err: CallbackError, record: any) => {
        if (err) {
            return handleError(err)
        }
        PartRecord.findByIdAndUpdate(record.prev, { next: record._id }, (err: MongooseError, record: PartRecordSchema) => {
            if (err) {
                return handleError(err)
            }
        })
    },
    callbackHandleError: (err: CallbackError, record: any) => {
        if (err) {
            return handleError(err)
        }
    }
}

export default callbackHandler
