import { Controller, Get } from '@protorians/framework';
import { ApiOkResponse, ApiCreatedResponse, ApiBadRequestResponse, ApiResponse } from '@protorians/framework/decorators';

@Controller('/users')
export class UserController {
    // Example 1: Using ApiOkResponse to specify a 200 response with a specific type
    @Get()
    @ApiOkResponse({
        description='Returns a list of users',
        type: Array,
        isArray: true
    })
    async getUsers() {
        return [{ id: 1, name: 'John Doe' }, { id: 2, name: 'Jane Smith' }];
    }

    // Example 2: Using ApiCreatedResponse for a POST endpoint (would need @Post decorator)
    // @Post()
    // @ApiCreatedResponse({
    //     description='User created successfully',
    //     type: Object
    // })
    // async createUser() {
    //     // ... implementation
    // }

    // Example 3: Using ApiResponse for multiple response types
    @Get('/:id')
    @ApiResponse({
        status: 200,
        description='Returns the user if found',
        type: Object
    })
    @ApiResponse({
        status: 404,
        description='User not found'
    })
    @ApiResponse({
        status: 500,
        description='Internal server error'
    })
    async getUserById() {
        // ... implementation
        return { id: 1, name: 'John Doe' };
    }

    // Example 4: Using the shorthand decorators
    @Get('/health')
    @ApiOkResponse({ description='API is healthy' })
    async healthCheck() {
        return { status: 'OK' };
    }
}