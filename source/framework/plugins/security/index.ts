import {secureHeaders} from './headers'
import {secureCors} from './cors'
import {secureRateLimit} from './rate-limit'
import {secureBodyLimit} from './body-limit'
import {secureMethodGuard} from './method-guard'
import {secureCsrf} from './csrf'

export class Security {
    static headers = secureHeaders
    static cors = secureCors
    static rateLimit = secureRateLimit
    static bodyLimit = secureBodyLimit
    static methodGuard = secureMethodGuard
    static csrf = secureCsrf
}
