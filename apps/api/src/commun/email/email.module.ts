import { Global, Module } from "@nestjs/common";

import { ServiceEmail } from "./email.service";

@Global()
@Module({
  providers: [ServiceEmail],
  exports: [ServiceEmail],
})
export class ModuleEmail {}
