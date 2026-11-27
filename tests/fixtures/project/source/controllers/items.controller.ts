import {
    Body,
    Controllable,
    Get,
    Post,
} from "../../../../../source/framework/index.ts";
import {Example, Input, Output, t} from "../../../../../source/contracts/index.ts";

const CreateItem = t.object({
    name: t.string().min(2),
    email: t.string().email().optional(),
});

const Item = t.object({
    id: t.integer(),
    name: t.string(),
});

@Controllable("/items")
export class ItemsController {
    @Get("/:id")
    @Output(Item)
    show() {
        return {id: 1, name: "Raiton"};
    }

    @Post("/")
    @Input(CreateItem)
    @Output(Item)
    @Example({name: "create", body: {name: "Raiton"}, expectedStatus: 200})
    create(@Body() input: {name: string}) {
        return {id: 2, name: input.name};
    }
}
