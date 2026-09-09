import {secureHeaders} from './headers.ts'
import {secureCors} from './cors.ts'
import {secureRateLimit} from './rate-limit.ts'
import {secureBodyLimit} from './body-limit.ts'
import {secureMethodGuard} from './method-guard.ts'
import {secureCsrf} from './csrf.ts'

export class Security {
    static headers = secureHeaders
    static cors = secureCors
    static rateLimit = secureRateLimit
    static bodyLimit = secureBodyLimit
    static methodGuard = secureMethodGuard
    static csrf = secureCsrf
}
