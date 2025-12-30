import {secureHeaders} from './headers'
import {secureCors} from './cors'
import {secureRateLimit} from './rate-limit'
import {secureBodyLimit} from './body-limit'
import {secureMethodGuard} from './method-guard'

export class SecureApp {
    static headers = secureHeaders
    static cors = secureCors
    static rateLimit = secureRateLimit
    static bodyLimit = secureBodyLimit
    static methodGuard = secureMethodGuard
}
